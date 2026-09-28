'use strict';
/* Sole Blessed — core rules and the async turn loop.
 * Decisions go through Game.who(p): Bot for bots, UI for the human (same method names).
 * All state lives in Game.state (plain JSON, saved as-is to localStorage). */

const ABORT = { abort: true };
const ICON_RE = /^(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)\s*/u;

const Game = {
  state: null,
  runId: 0,
  paused: false,
  skipping: false,        // user pressed Enter during a bot turn: fast-forward to the summary
  sim: false,             // headless simulation (tools/simulate.js): no UI, no delays
  turnLog: [],

  /* ================================================================ lookups */
  cur() { return this.state.players[this.state.turn]; },
  human() { return this.state.players.find(p => !p.isBot); },
  player(id) { return this.state.players[id]; },
  cls(p) { return DATA.CLASSES[p.classId]; },
  who(p) { return p.isBot ? Bot : UI; },
  isBlocking(id) {
    const sp = MapSys.spaces[id];
    return sp.type === 'B' && !this.state.army[sp.code].defeated;
  },
  isBuilding(id) { return MapSys.spaces[id].type === 'L'; },
  equipBonus(p, stat) {
    let v = 0;
    for (const slot of ['weapon', 'armor']) { const id = p.equip[slot]; if (id) v += DATA.GEAR[id][stat] || 0; }
    return v;
  },
  charmPct(p, stat) { const c = p.equip.charm && DATA.CHARMS[p.equip.charm]; return c ? c[stat + 'Pct'] || 0 : 0; },
  passiveMul(p, stat) {
    const id = this.cls(p).passive.id;
    if (stat === 'at' && id === 'beginner') return 1.2;
    if (stat === 'at' && id === 'hotheaded') return 1.5;
    if (stat === 'sp' && id === 'novice') return 1.2;
    return 1;
  },
  maxHp(p) { return U.round((p.base.hp + this.equipBonus(p, 'hp')) * (1 + this.charmPct(p, 'hp'))); },
  stat(p, s) {
    if (s === 'hp') return this.maxHp(p);
    return U.round((p.base[s] + this.equipBonus(p, s)) * this.passiveMul(p, s) * (1 + this.charmPct(p, s)));
  },
  /* Stars, then money, then level (spec §2). */
  ranking() {
    return this.state.players.slice().sort((a, b) => b.stars - a.stars || b.money - a.money || b.level - a.level || a.id - b.id);
  },
  rank(p) { return this.ranking().indexOf(p) + 1; },
  diceCount(p) { return (this.state.dlDefeated ? 2 : 1) + (p.buffs.dice || 0); },
  maxDays() { return this.state.rules.days; },            // 0 = endless
  endless() { return !this.state.rules.days; },
  frontierZone() { const a = this.state.army; return a.B01.defeated ? a.B02.defeated ? a.B03.defeated ? 4 : 3 : 2 : 1; },
  battleOf(p) { return this.state.battles.find(b => b.id === p.battleId) || null; },
  armyBattle(key) { return this.state.battles.find(b => b.kind === 'army' && b.armyKey === key) || null; },
  /* A monster / Demon Lord Army fight on p's space that p is not part of (duels are one-on-one). */
  fightHere(p) {
    return this.state.battles.find(b => b.kind !== 'duel' && b.space === p.spaceId && !b.parts.includes(p.id) && (b.parts.length || b.reserve)) || null;
  },
  /* Optional join at turn start (spec §3.2): only Demon Lord Army battles. */
  joinableBattle(p) {
    if (p.battleId) return null;
    return this.state.battles.find(b => b.kind === 'army' && b.space === p.spaceId && b.parts.length && !b.parts.includes(p.id)) || null;
  },
  /* Heroes knocked out / giving up rest; heroes in buildings are safe from fights. */
  canBeChallenged(o) { return !o.battleId && !o.down && !this.isBuilding(o.spaceId); },
  canSave() {
    const s = this.state;
    return !!s && !s.over && !this.cur().isBot && s.phase === 'preRoll' && !Battle.active && !this.cur().battleId;
  },

  /* ================================================================ timing / flow control */
  speed() { return (typeof UI !== 'undefined' && UI.settings && UI.settings.speed) || 1; },
  delayFactor() {
    if (this.sim || this.skipping) return 0;
    return 1 / this.speed();
  },
  async wait(ms) {
    const run = this.runId;
    const d = ms * this.delayFactor();
    if (d > 0) await U.sleep(d);
    while (this.paused && !this.sim) { await U.sleep(80); if (run !== this.runId) throw ABORT; }
    if (run !== this.runId) throw ABORT;
  },
  /* A human decision is needed: stop fast-forwarding so they can see what happens. */
  needHuman() { this.skipping = false; },
  /* Adventure log. `who` = player object/id, 'minion', 'king' or null. The leading emoji becomes the icon. */
  log(text, who) {
    const s = this.state;
    const m = ICON_RE.exec(text);
    const entry = { day: s.day, text: m ? text.slice(m[0].length) : text, icon: m ? m[1] : '•' };
    if (who != null) entry.who = typeof who === 'object' ? who.id : who;
    s.log.push(entry);
    if (s.log.length > DATA.LOG_SIZE) s.log.splice(0, s.log.length - DATA.LOG_SIZE);
    this.turnLog.push(text);
    if (!this.sim) UI.logLine(entry);
  },
  /* Info popup: bots auto-close quickly, the human confirms. */
  async say(p, title, text, icon) {
    if (this.sim) return;
    const auto = p && p.isBot ? 1300 * this.delayFactor() : 0;
    if (p && p.isBot && this.skipping) return;
    await UI.announce({ title, text, icon, auto, who: p });
  },

  /* ================================================================ setup */
  makePlayer(id, setup, isBot) {
    const S = DATA.START;
    return {
      id, name: setup.name, isBot, gender: setup.gender, color: DATA.PLAYER_COLORS[id], classId: setup.classId,
      level: S.level, exp: 0, freePts: 0,
      base: { hp: S.hp, at: S.at, df: S.df, sp: S.sp }, hp: S.hp, money: S.money, stars: 0,
      spaceId: '1-L01', respawnId: '1-L01',
      equip: { weapon: null, armor: null, charm: null }, items: [], books: [],
      special: null, specialDef: null, cd: { special: 0, specialDef: 0, classMove: 0 },
      jobExp: {}, mastered: [], unlocked: DATA.TIER1.slice(),
      merit: 0, usedLarb: false, wentAllIn: false,
      buffs: { dice: 0, energy: false, eater: false },
      battleId: null, itemUsed: false, turnOver: false,
      down: 0, downReason: null,
      record: { monsters: 0, heroesBeaten: 0, army: 0, treasures: 0, deaths: 0, requests: 0 },
      botMem: {},
    };
  },
  newState(setup, rules) {
    const s = {
      schema: DATA.SAVE_SCHEMA, version: DATA.VERSION, createdAt: new Date().toISOString(),
      rules: Object.assign({}, DATA.RULES_DEFAULT, rules),
      day: 1, turn: 0, phase: 'start', fresh: true,
      players: [], army: {}, minion: null, minionNextDay: DATA.MINION_FIRST_DAY,
      dlDefeated: false, head: { holder: null, space: null },
      chests: {}, traps: [], battles: [], nextBattleId: 1,
      request: null, requestsDone: 0,
      flags: { castleIntro: false, dlMet: false, generalMet: {} },
      log: [], over: false, ending: null, deliveredBy: null,
    };
    for (const k of ['B01', 'B02', 'B03', 'B04']) {
      const a = DATA.ARMY[k];
      s.army[k] = { hp: a.hp, maxHp: a.hp, cd: { special: 0, specialDef: 0 }, defeated: false };
    }
    const names = U.shuffle(DATA.BOT_NAMES.filter(n => !setup || n.toLowerCase() !== String(setup.name).toLowerCase()));
    const botSetup = () => ({ name: names.pop(), gender: U.chance(0.5) ? 'm' : 'f', classId: U.pick(DATA.TIER1) });
    s.players.push(this.makePlayer(0, setup || botSetup(), !setup));
    for (let i = 1; i < DATA.NUM_PLAYERS; i++) s.players.push(this.makePlayer(i, botSetup(), true));
    return s;
  },

  /* ================================================================ main loop */
  async start(state) {
    this.runId++;
    const run = this.runId;
    this.state = state; this.paused = false; this.skipping = false;
    if (!this.sim) UI.enterGame();
    try {
      if (state.fresh) {
        delete state.fresh;
        if (!this.sim) await UI.dialogue(DATA.DIALOGUE.prologue);
        this.log('☀️ Day 1 begins. The journey starts at the Royal Castle!', 'king');
        await this.postRequest();
      }
      while (!state.over) {
        await this.playTurn();
        if (state.over) break;
        await this.advance();
      }
      if (run === this.runId) await this.finish();
    } catch (e) {
      if (e && e.abort) return;
      console.error(e);
      if (!this.sim) UI.fatal(e); else throw e;
    }
  },
  stop() { this.runId++; this.state = null; this.paused = false; this.skipping = false; },

  async playTurn() {
    const s = this.state, p = this.cur();
    this.skipping = false;
    this.turnLog = [];
    s.phase = 'preRoll';
    if (!this.sim) UI.turnStart(p);
    if (p.down > 0) { await this.restTurn(p); return; }
    if (!this.sim && !p.isBot && !p.battleId) Save.autosave(s);
    await this.wait(p.isBot ? 600 : 250);
    if (p.battleId) {
      // Spec §6: an unfinished fight takes over the turn — straight to the battle screen.
      s.phase = 'battle';
      await Battle.continueFor(p);
    } else {
      const action = await this.who(p).turnAction(p);
      s.phase = 'acting';
      if (s.over) return;
      if (action.type === 'end' || p.turnOver || p.down) { /* turn consumed (e.g. a Challenge Letter duel) */ }
      else if (p.battleId) await Battle.continueFor(p);
      else if (action.type === 'join') await Battle.join(p, this.joinableBattle(p));
      else await this.moveTurn(p);
    }
    if (s.over) return;
    await this.endTurn(p);
    if (p.isBot && this.skipping && !this.sim) { this.skipping = false; await UI.turnSummary(p, this.turnLog); }
    this.skipping = false;
  },
  /* Knocked out or gave up: this turn is skipped (spec §6: DATA.DOWN_TURNS turns to resurrect / stand up). */
  async restTurn(p) {
    p.down--;
    const left = p.down;
    if (p.downReason === 'ko') this.log(`🪦 ${p.name} is resurrecting… ${left ? `${left} more turn${left > 1 ? 's' : ''}` : 'back next turn'}.`, p);
    else this.log(`😵 ${p.name} is still standing up… ${left ? `${left} more turn${left > 1 ? 's' : ''}` : 'back next turn'}.`, p);
    if (!this.sim) await UI.restTurn(p);
    await this.wait(700);
    if (!p.down) p.downReason = null;
    this.state.phase = 'between';
    p.itemUsed = false; p.turnOver = false;
    if (!this.sim) UI.refresh();
  },

  async moveTurn(p) {
    const n = this.diceCount(p);
    const rolls = this.sim ? Array.from({ length: n }, () => U.randInt(1, 6)) : await UI.rollDice(p, n);
    p.buffs.dice = 0;
    const total = rolls.reduce((a, b) => a + b, 0);
    this.log(`🎲 ${p.name} rolled ${total}${rolls.length > 1 ? ` (${rolls.join('+')})` : ''}.`, p);
    const moves = MapSys.exactMoves([p.spaceId], total, id => this.isBlocking(id));
    if (!moves.ends.size) {
      this.log(`🚧 ${p.name} has no route of exactly ${total} spaces and loses the turn.`, p);
      await this.say(p, 'Dead end!', `There is no route of exactly ${total} space${total > 1 ? 's' : ''} from here. Your turn is skipped.`, '🚧');
      return;
    }
    const choice = await this.who(p).chooseDestination(p, moves, total);
    if (!choice.walked && !this.sim) await UI.walk(p, choice.path);
    p.spaceId = choice.target;
    if (!this.sim) UI.refresh();
    await this.resolveLanding(p);
  },

  async endTurn(p) {
    if (this.cls(p).passive.id === 'looseTongue' && U.chance(0.5)) {
      const k = p.cd.classMove > 0 ? 'classMove' : p.cd.special > 0 ? 'special' : null;
      if (k) { p.cd[k]--; this.log(`🗣️ ${p.name}'s Loose Tongue shortens a cooldown by 1 day.`, p); }
    }
    p.itemUsed = false;
    p.turnOver = false;
    this.state.phase = 'between';
    if (!this.sim) UI.refresh();
  },

  async advance() {
    const s = this.state;
    s.turn++;
    if (s.turn < s.players.length) return;
    s.turn = 0;
    await this.endOfDay();
    if (s.over) return;
    s.day++;
    if (!this.endless() && s.day > this.maxDays()) { s.day = this.maxDays(); this.timeUp(); return; }
    await this.startOfDay();
  },

  async endOfDay() {
    const s = this.state;
    const tick = cd => { for (const k in cd) cd[k] = Math.max(0, cd[k] - 1); };
    for (const p of s.players) tick(p.cd);
    for (const k in s.army) tick(s.army[k].cd);
    if (s.minion) tick(s.minion.cd);
    await this.minionMove();
  },

  async startOfDay() {
    const s = this.state;
    this.log(`☀️ Day ${s.day} begins.`, 'king');
    if (!this.sim) await UI.dayStart(s.day);
    for (const p of s.players) {
      if (this.cls(p).passive.id === 'blessed' && p.hp < this.maxHp(p)) {
        const h = U.round(this.maxHp(p) * 0.1);
        p.hp = Math.min(this.maxHp(p), p.hp + h);
        this.log(`🙏 ${p.name}'s Blessed Merit restores ${h} HP.`, p);
      }
    }
    const dry = s.army.B02;
    if (!dry.defeated && dry.hp < dry.maxHp) dry.hp = Math.min(dry.maxHp, dry.hp + U.round(dry.maxHp * 0.05));
    for (const id in s.chests) if (s.day >= s.chests[id] + 3) delete s.chests[id];
    if (!s.minion && s.day >= s.minionNextDay) await this.spawnMinion();
    if ((s.day - 1) % DATA.REQUEST_DAYS === 0) await this.postRequest();
    if (!this.sim) UI.refresh();
  },

  timeUp() {
    const s = this.state;
    s.over = true;
    s.ending = s.dlDefeated ? 'secret' : 'bad';
    const n = this.maxDays();
    this.log(s.ending === 'bad' ? `🌑 ${n} days have passed. The Demon Lord was never defeated…` : `🌑 ${n} days have passed and the Demon Lord's Head never reached the castle…`, 'king');
  },

  async finish() {
    const s = this.state;
    const ranking = this.ranking();
    if (this.sim) return;
    const human = this.human();
    if (human) Save.recordGame(s.ending, ranking, human.id);
    Save.clearAutosave();
    await UI.ending(s.ending, ranking);
  },

  /* ================================================================ King's Requests (weekly) */
  async postRequest() {
    const s = this.state, zone = this.frontierZone();
    if (s.request && s.request.winner == null) this.log(`👑 Nobody completed the King's Request "${s.request.text}".`, 'king');
    const lastId = s.request && s.request.id;
    const pool = DATA.REQUESTS.filter(r => r.id !== lastId && (!r.minZone || zone >= r.minZone));
    const t = U.pick(pool);
    const req = { id: t.id, icon: t.icon, event: t.event, n: t.n || t.nByZone[zone], day: s.day, ends: s.day + DATA.REQUEST_DAYS - 1,
      reward: DATA.REQUEST_GOLD[zone], progress: {}, winner: null, text: t.text };
    if (t.id === 'bounty') { req.key = U.pick(DATA.ZONE_MONSTERS[zone]); req.text = t.text.replace('{monster}', DATA.MONSTERS[req.key].name); }
    if (t.id === 'letter') {
      const places = MapSys.list.filter(sp => sp.type === 'L' && sp.zone <= zone && sp.code !== 'L01');
      const sp = U.pick(places);
      req.key = sp.id;
      req.text = t.text.replace('{place}', `${DATA.PLACES[sp.code].name} in ${DATA.ZONES[sp.zone - 1].name}`);
    }
    req.text = req.text.replace('{n}', U.fmt(req.n));
    s.request = req;
    this.log(`👑 King's Request: ${req.text}. First hero to finish earns +1 ⭐ and ${req.reward} G!`, 'king');
    if (!this.sim) await UI.requestPosted(req);
  },
  /* Progress events: kill, killKey, chest, battleGold, level, duelWin, minion, merit, visit. */
  track(p, event, amount, key) {
    const s = this.state, r = s.request;
    if (!r || r.winner != null || r.event !== event || s.day > r.ends) return;
    if ((event === 'killKey' || event === 'visit') && key !== r.key) return;
    r.progress[p.id] = (r.progress[p.id] || 0) + (amount == null ? 1 : amount);
    if (r.progress[p.id] < r.n) return;
    r.winner = p.id;
    p.stars += 1; p.money += r.reward; p.record.requests++;
    s.requestsDone++;
    Sound.play('star');
    this.log(`👑 ${p.name} completed the King's Request! +1 ⭐ +${r.reward} G`, p);
    if (!this.sim) UI.toast(`👑 ${p.name} completed the King's Request! +1 ⭐`, p.isBot ? 'info' : 'good');
  },

  /* ================================================================ landing */
  async resolveLanding(p) {
    const s = this.state, sid = p.spaceId, sp = MapSys.spaces[sid];
    if (s.head.space === sid) {
      s.head.space = null; s.head.holder = p.id;
      this.log(`💀 ${p.name} picked up the Demon Lord's Head!`, p);
      Sound.play('star');
      await this.say(p, "Demon Lord's Head", `${p.name} picked up the Demon Lord's Head! Bring it to the Royal Castle.`, '💀');
    }
    if (sp.type === 'L') this.track(p, 'visit', 1, sid);
    if (s.minion && s.minion.spaceId === sid) {
      const b = this.armyBattle('minion');
      if (b) await this.enterFight(p, b); else await Battle.startArmy(p, 'minion');
      return;
    }
    const fight = this.fightHere(p);
    if (fight) { await this.enterFight(p, fight); return; }
    if (sp.type !== 'L') {
      const others = s.players.filter(o => o.id !== p.id && o.spaceId === sid && this.canBeChallenged(o));
      if (others.length) {
        const tid = await this.who(p).chooseChallenge(p, others);
        if (tid != null) { await Battle.startDuel(p, this.player(tid), {}); return; }
      }
    }
    const ti = s.traps.findIndex(t => t.space === sid && t.owner !== p.id);
    if (ti >= 0) {
      const trap = s.traps.splice(ti, 1)[0];
      const zone = Math.min(4, sp.zone + 1);
      this.log(`🕳️ ${p.name} stepped into ${this.player(trap.owner).name}'s Monster Trap!`, p);
      await this.say(p, 'Monster Trap!', `A trap set by ${this.player(trap.owner).name} springs! A monster from Zone ${zone} attacks!`, '🕳️');
      await Battle.startMonster(p, U.pick(DATA.ZONE_MONSTERS[zone]), {});
      return;
    }
    await this.spaceEffect(p, sp);
  },
  /* Spec §6: walking into someone else's fight is not optional — pick a target, then fight on
   * until you are knocked out, give up, or no opponent is left. */
  async enterFight(p, b) {
    const d = Battle.enemyDef(b);
    const heroes = b.parts.map(id => this.player(id)).filter(o => !o.down);
    this.log(`⚔️ ${p.name} walked into the fight against the ${d.name}!`, p);
    const c = await this.who(p).fightChoice(p, b, heroes);
    if (c && c.type === 'duel' && heroes.some(o => o.id === c.pid)) await Battle.startDuel(p, this.player(c.pid), { from: b });
    else await Battle.join(p, b);
  },

  async spaceEffect(p, sp) {
    const s = this.state;
    if (sp.type === 'B' && !s.army[sp.code].defeated) { await Battle.startArmy(p, sp.code); return; }
    if (sp.type === 'e' || sp.type === 'B') return this.emptySpace(p, sp);
    if (sp.type === 't') return this.treasure(p, sp);
    if (sp.type === 'L') return this.place(p, sp);
  },
  /* Tier by how deep the space lies in its zone (entrance → General), with some spill-over. */
  pickMonster(sp) {
    const keys = DATA.ZONE_MONSTERS[sp.zone];
    const d = sp.depth || 0, tier = d < 0.34 ? 0 : d < 0.67 ? 1 : 2, r = Math.random();
    let t = tier;
    if (r < 0.2 && tier > 0) t--; else if (r > 0.88 && tier < 2) t++;
    return keys[t];
  },

  async emptySpace(p, sp) {
    if (U.chance(0.7)) await Battle.startMonster(p, this.pickMonster(sp), {});
    else await this.randomEvent(p, sp);
  },

  async randomEvent(p, sp) {
    const key = U.weighted(Object.keys(DATA.EVENTS).map(k => [k, DATA.EVENTS[k].weight]));
    const ev = DATA.EVENTS[key];
    const w = this.who(p);
    if (key === 'E01') {
      const stat = U.pick(['hp', 'at', 'df', 'sp']), up = U.chance(0.5), d = up ? 1 : -1;
      if (stat === 'hp') { p.base.hp = Math.max(10, p.base.hp + 5 * d); p.hp = U.clamp(p.hp + (up ? 5 : 0), 1, this.maxHp(p)); }
      else p.base[stat] = Math.max(1, p.base[stat] + d);
      const label = stat === 'hp' ? `Max HP ${up ? '+5' : '−5'}` : `${stat.toUpperCase()} ${up ? '+1' : '−1'}`;
      this.log(`🏋️ ${p.name} trained: ${label}.`, p);
      Sound.play(up ? 'levelup' : 'error');
      await this.say(p, ev.name, up ? `Great workout! ${label}.` : `Pulled a muscle… ${label}.`, ev.icon);
    } else if (key === 'E02') {
      const cost = U.round(p.money * 0.1), max = this.maxHp(p);
      const yes = await w.yesNo(p, 'doctor', { title: `${ev.icon} ${ev.name}`, text: `A kind doctor offers to restore your HP (${p.hp}/${max}) to full for ${cost} G (10% of your money).`, cost });
      if (yes) { p.money -= cost; p.hp = max; Sound.play('heal'); this.log(`🩺 ${p.name} paid ${cost} G and was fully healed.`, p); }
      else this.log(`🩺 ${p.name} politely declined the doctor.`, p);
    } else if (key === 'E03') {
      const amt = DATA.EVENT_MONEY[sp.zone];
      p.money += amt; Sound.play('coin');
      this.log(`💰 ${p.name} found ${amt} G on the road.`, p);
      await this.say(p, ev.name, `You found ${amt} G on the road!`, ev.icon);
    } else {
      const mk = DATA.ZONE_MONSTERS[sp.zone][2];
      const m = DATA.MONSTERS[mk];
      const yes = await w.yesNo(p, 'e04', { title: `${ev.icon} ${ev.name}`, text: `Townspeople beg for help against a fearsome ${m.name} (Lv ${m.lv}, HP & AT ×1.3). Win to earn 1 extra ⭐!`, monster: mk });
      if (yes) { this.log(`🙏 ${p.name} agreed to help the townspeople!`, p); await Battle.startMonster(p, mk, { e04: true }); }
      else this.log(`🙏 ${p.name} turned the townspeople away.`, p);
    }
  },

  async treasure(p, sp) {
    const s = this.state;
    if (s.chests[sp.id] != null && s.day < s.chests[sp.id] + 3) {
      this.log(`📦 ${p.name} found an empty chest.`, p);
      await this.say(p, 'Empty Chest', 'This chest was opened recently. It refills 3 days after being opened.', '📦');
      return;
    }
    s.chests[sp.id] = s.day;
    p.record.treasures++;
    this.track(p, 'chest');
    Sound.play('chest');
    const r = Math.random();
    if (r < 0.5 || r >= 0.9) {
      const isCharm = r >= 0.9;
      const id = isCharm ? U.pick(Object.keys(DATA.CHARMS)) : U.weighted(DATA.TREASURE_ITEMS);
      const it = isCharm ? DATA.CHARMS[id] : DATA.ITEMS[id];
      this.log(`🎁 ${p.name} found ${it.icon} ${it.name}!`, p);
      await this.say(p, 'Treasure!', `You found ${it.icon} ${it.name}!`, '🎁');
      if (isCharm) await this.addCharm(p, id); else await this.addItem(p, id);
    } else if (r < 0.7) {
      const books = Object.keys(DATA.ITEMS).filter(k => DATA.ITEMS[k].tab === 'books' && DATA.ITEMS[k].zone <= sp.zone);
      const id = U.pick(books), it = DATA.ITEMS[id];
      this.log(`🎁 ${p.name} found the spellbook ${it.icon} ${it.name}!`, p);
      await this.say(p, 'Treasure!', `You found the spellbook ${it.icon} ${it.name}!`, '🎁');
      await this.addItem(p, id);
    } else {
      const amt = DATA.TREASURE_MONEY[sp.zone];
      p.money += amt; Sound.play('coin');
      this.log(`🎁 ${p.name} found ${amt} G in a chest!`, p);
      await this.say(p, 'Treasure!', `The chest is full of gold: +${amt} G!`, '💰');
    }
  },

  async place(p, sp) {
    switch (sp.code) {
      case 'L01': return this.royalCastle(p, sp);
      case 'L02': return this.who(p).shop(p, 'item', sp.zone);
      case 'L03': return this.who(p).shop(p, 'equip', sp.zone);
      case 'L04': return this.who(p).shop(p, 'skill', sp.zone);
      case 'L05': return this.placeMenu(p, sp, 'temple');
      case 'L06': return this.who(p).shop(p, 'larb', sp.zone);
      case 'L07': return this.horseTrack(p, sp);
    }
  },

  async royalCastle(p, sp) {
    const s = this.state;
    if (s.head.holder === p.id) {
      p.stars += 5;
      s.deliveredBy = p.id; s.over = true; s.ending = 'good';
      Sound.play('star');
      this.log(`👑 ${p.name} delivered the Demon Lord's Head to the King! +5 ⭐`, p);
      if (!this.sim) await UI.announce({ title: "The Head is Delivered!", text: `${p.name} presents the Demon Lord's Head to the King. +5 ⭐`, icon: '👑', auto: 0 });
      return;
    }
    await this.placeMenu(p, sp, 'castle');
  },
  /* Royal Castle / Temple menu (spec §5: the only places to change class). Repeats until "Leave". */
  async placeMenu(p, sp, kind) {
    const done = {};
    for (let guard = 0; guard < 8; guard++) {
      const others = p.unlocked.filter(c => c !== p.classId);
      const opts = [
        { id: 'class', label: 'Change Class', icon: '🔁', disabled: !others.length || done.class, reason: done.class ? 'You already changed class here.' : 'No other class unlocked yet.' },
        { id: 'respawn', label: 'Set Respawn Point', icon: '🚩', disabled: p.respawnId === sp.id, reason: 'This is already your respawn point.' },
      ];
      if (kind === 'temple') {
        const cost = U.round(p.money * 0.1);
        opts.push({ id: 'merit', label: `Make Merit (donate ${cost} G)`, icon: '🙏', cost, disabled: done.merit || cost <= 0, reason: done.merit ? 'Once per visit.' : 'You have no money to donate.' });
      }
      opts.push({ id: 'leave', label: 'Leave', icon: '👋' });
      const c = await this.who(p).placeMenu(p, kind, opts);
      if (!c || c === 'leave') return;
      if (c === 'class') {
        const cid = await this.who(p).chooseClass(p);
        if (cid && this.changeClass(p, cid)) done.class = true;
      } else if (c === 'respawn') {
        p.respawnId = sp.id;
        this.log(`🚩 ${p.name} set the ${DATA.PLACES[sp.code].name} as their respawn point.`, p);
      } else if (c === 'merit' && !done.merit) {
        const cost = U.round(p.money * 0.1);
        p.money -= cost; p.merit++; done.merit = true;
        Sound.play('heal');
        this.log(`🙏 ${p.name} made merit (${p.merit}).`, p);
        this.track(p, 'merit');
        if (p.merit >= 3) this.unlock(p, 'templekid');
      }
    }
  },

  async horseTrack(p, sp) {
    if (p.money < 100) { await this.say(p, 'Horse-Racing Track', 'You need at least 100 G to place a bet.', '🏇'); return; }
    const bet = await this.who(p).horseBet(p);
    if (!bet) return;
    const amount = bet.pct >= 1 ? p.money : U.round(p.money * bet.pct);
    p.money -= amount;
    const winner = U.randInt(0, 5);
    if (!this.sim) await UI.horseRace(p, bet.horse, winner, amount);
    const horse = DATA.HORSES[bet.horse].name;
    if (winner === bet.horse) { p.money += amount * 5; Sound.play('coin'); this.log(`🏇 ${p.name} bet ${amount} G on ${horse} and WON ${amount * 5} G!`, p); }
    else this.log(`🏇 ${p.name} bet ${amount} G on ${horse} and lost.`, p);
    if (bet.pct >= 1) { p.wentAllIn = true; this.unlock(p, 'gambler'); }
    void sp;
  },

  /* ================================================================ minion */
  async spawnMinion() {
    const s = this.state;
    const zone = this.frontierZone();
    const cands = MapSys.list.filter(sp => sp.zone === zone && sp.type === 'e' && !s.players.some(p => p.spaceId === sp.id));
    if (!cands.length) return;
    const sp = U.pick(cands), st = DATA.minionStats(zone);
    s.minion = { zone, spaceId: sp.id, hp: st.hp, maxHp: st.hp, cd: { special: 0, specialDef: 0 } };
    this.log(`😈 A Demon Lord Minion (Lv ${st.lv}) appeared in ${DATA.ZONES[zone - 1].name}!`, 'minion');
    Sound.play('spawn');
    if (!this.sim) await UI.minionSpawn(sp.id, st);
  },
  /* End of day: roll 1 die and walk toward the nearest free hero. The minion never stops on a
   * building (spec §9): it halts on the last open space before one. */
  async minionMove() {
    const s = this.state, m = s.minion;
    if (!m || this.armyBattle('minion')) return;
    const B = MapSys.bfs(m.spaceId, id => this.isBlocking(id));
    const prey = p => !p.battleId && !p.down;
    const targets = s.players.filter(p => prey(p) && B.dist[p.spaceId] >= 1).sort((a, b) => B.dist[a.spaceId] - B.dist[b.spaceId]);
    if (!targets.length) return;
    const target = targets[0], path = B.path(target.spaceId);
    const roll = U.randInt(1, 6);
    let end = Math.min(roll, path.length - 1);
    for (let i = 1; i <= end; i++) {
      if (!this.isBuilding(path[i]) && s.players.some(p => prey(p) && p.spaceId === path[i])) { end = i; break; }
    }
    while (end > 0 && this.isBuilding(path[end])) end--;
    const walkPath = path.slice(0, end + 1);
    if (walkPath.length < 2) { this.log(`😈 The minion lurks near ${target.name}, unable to enter the building.`, 'minion'); return; }
    this.log(`😈 The minion rolls ${roll} and creeps toward ${target.name}.`, 'minion');
    if (!this.sim) await UI.minionWalk(walkPath);
    m.spaceId = walkPath[walkPath.length - 1];
    const victims = s.players.filter(p => prey(p) && p.spaceId === m.spaceId);
    if (victims.length) await Battle.ambush(victims.includes(target) ? target : victims[0]);
  },

  /* ================================================================ growth */
  expFrom(p, exp, lv) { return U.round(exp * U.clamp(1 + 0.1 * (lv - p.level), 0.5, 2)); },
  gainExp(p, amt) {
    if (p.level >= DATA.MAX_LEVEL || amt <= 0) return 0;
    p.exp += amt;
    let ups = 0;
    while (p.level < DATA.MAX_LEVEL && p.exp >= 10 * p.level) { p.exp -= 10 * p.level; this.levelUp(p); ups++; }
    if (p.level >= DATA.MAX_LEVEL) p.exp = 0;
    if (ups) { this.log(`⬆️ ${p.name} reached level ${p.level}! HP fully restored.`, p); this.track(p, 'level', ups); }
    return ups;
  },
  /* Spec §4: level-up grants stats + 2 free points and restores full HP. */
  levelUp(p) {
    p.level++;
    p.base.hp += 10;
    const add = g => { for (const k in g) p.base[k] += g[k]; };
    add(this.cls(p).levelUp);
    for (const m of p.mastered) add(DATA.CLASSES[m].mastery);
    p.freePts += 2;
    p.hp = this.maxHp(p);
  },
  applyPoint(p, stat) {
    if (p.freePts <= 0) return;
    p.freePts--;
    if (stat === 'hp') p.base.hp += 5; else p.base[stat] += 1;
    p.hp = Math.min(this.maxHp(p), stat === 'hp' ? p.hp + 5 : p.hp);
  },
  async allocatePoints(p) { if (p.freePts > 0) await this.who(p).allocatePoints(p); },
  gainJobExp(p, n) {
    const c = p.classId;
    if (p.mastered.includes(c)) return false;
    p.jobExp[c] = Math.min(10, (p.jobExp[c] || 0) + n);
    if (p.jobExp[c] < 10) return false;
    p.mastered.push(c);
    this.log(`🌟 ${p.name} mastered ${DATA.CLASSES[c].name}!`, p);
    if (DATA.CLASSES[c].next) this.unlock(p, DATA.CLASSES[c].next);
    return true;
  },
  unlock(p, cid) {
    if (p.unlocked.includes(cid)) return false;
    p.unlocked.push(cid);
    this.log(`🔓 ${p.name} unlocked the ${DATA.CLASSES[cid].name} class!`, p);
    if (!p.isBot && !this.sim) UI.toast(`🔓 New class unlocked: ${DATA.CLASSES[cid].name}! Change class at the Royal Castle or a Temple.`, 'good');
    return true;
  },
  /* Spec §5: class changes happen only while standing in the Royal Castle or a Temple. */
  canChangeClass(p) {
    const sp = MapSys.spaces[p.spaceId];
    if (sp.code !== 'L01' && sp.code !== 'L05') return { ok: false, reason: 'Change class at the Royal Castle or a Temple.' };
    if (this.cur() !== p) return { ok: false, reason: 'Only during your own turn.' };
    if (p.battleId) return { ok: false, reason: 'You cannot change class while locked in battle.' };
    return { ok: true };
  },
  changeClass(p, cid) {
    if (!p.unlocked.includes(cid) || p.classId === cid || !this.canChangeClass(p).ok) return false;
    p.classId = cid;
    p.hp = Math.min(p.hp, this.maxHp(p));
    this.log(`🔁 ${p.name} changed class to ${DATA.CLASSES[cid].name}.`, p);
    return true;
  },

  /* ================================================================ inventory & equipment */
  setEquip(p, slot, id) {
    const before = this.maxHp(p);
    p.equip[slot] = id;
    const after = this.maxHp(p);
    if (after > before) p.hp += after - before;
    p.hp = Math.min(p.hp, after);
  },
  async addItem(p, id) {
    const it = DATA.ITEMS[id];
    const list = p[it.tab];
    if (list.length < DATA.INV_SIZE) { list.push(id); return true; }
    const choice = await this.who(p).inventoryFull(p, id);
    if (choice === 'new' || choice == null) { this.log(`🗑️ ${p.name} left ${it.name} behind (bag full).`, p); return false; }
    this.log(`🗑️ ${p.name} discarded ${DATA.ITEMS[list[choice]].name} for ${it.name}.`, p);
    list[choice] = id;
    return true;
  },
  async addCharm(p, id) {
    const c = DATA.CHARMS[id];
    if (!p.equip.charm) { this.setEquip(p, 'charm', id); this.log(`📿 ${p.name} equipped ${c.name}.`, p); return true; }
    if (p.equip.charm === id) { this.log(`📿 ${p.name} already wears a ${c.name}.`, p); return false; }
    if (await this.who(p).charmChoice(p, id)) { this.setEquip(p, 'charm', id); this.log(`📿 ${p.name} swapped charms for ${c.name}.`, p); return true; }
    return false;
  },
  gainMoney(p, amt, fromBattle) {
    const c = p.equip.charm && DATA.CHARMS[p.equip.charm];
    if (fromBattle && c && c.moneyBonus) amt = U.round(amt * (1 + c.moneyBonus));
    p.money += amt;
    if (fromBattle) this.track(p, 'battleGold', amt);
    return amt;
  },

  /* Item/spellbook use: once per turn, before rolling. Never during a fight (spec §6, §8.2). */
  canUseItem(p, id) {
    const s = this.state, it = DATA.ITEMS[id];
    if (p.battleId) return { ok: false, reason: 'Items cannot be used during a fight.' };
    if (this.cur() !== p) return { ok: false, reason: 'Items can only be used on your own turn.' };
    if (s.phase !== 'preRoll') return { ok: false, reason: 'Items can only be used before rolling.' };
    if (p.itemUsed) return { ok: false, reason: 'You already used an item this turn.' };
    switch (it.fx) {
      case 'talisman': return { ok: false, reason: 'The talisman activates automatically when a spellbook targets you.' };
      case 'quest': return { ok: false, reason: 'Bring it to the Royal Castle.' };
      case 'heal': return p.hp >= this.maxHp(p) ? { ok: false, reason: 'Your HP is already full.' } : { ok: true };
      case 'dice': return p.buffs.dice ? { ok: false, reason: 'A dice bonus is already active.' } : { ok: true };
      case 'energy': return p.buffs.energy ? { ok: false, reason: 'Energy Drink is already active.' } : { ok: true };
      case 'home':
        if (s.head.holder === p.id) return { ok: false, reason: "Cannot warp while holding the Demon Lord's Head." };
        return p.spaceId === p.respawnId ? { ok: false, reason: 'You are already at your respawn point.' } : { ok: true };
      case 'pickpocket':
        return this.pickpocketTargets(p).length ? { ok: true } : { ok: false, reason: 'No other hero has items to steal.' };
      case 'trap':
        return this.trapSpaces(p).length ? { ok: true } : { ok: false, reason: 'No empty space within 6 spaces.' };
      case 'challenge':
        return this.challengeTargets(p).length ? { ok: true } : { ok: false, reason: 'No hero within 6 spaces who can fight (not in a building, battle, or resting).' };
    }
    return { ok: true };
  },
  pickpocketTargets(p) { return this.state.players.filter(o => o.id !== p.id && o.items.length); },
  trapSpaces(p) {
    const d = MapSys.distField(p.spaceId, id => this.isBlocking(id));
    return MapSys.list.filter(sp => sp.type === 'e' && d[sp.id] >= 1 && d[sp.id] <= 6 && !this.state.traps.some(t => t.space === sp.id)).map(sp => sp.id);
  },
  challengeTargets(p) {
    const d = MapSys.distField(p.spaceId, id => this.isBlocking(id));
    return this.state.players.filter(o => o.id !== p.id && this.canBeChallenged(o) && d[o.spaceId] <= 6);
  },
  talismanBlocks(target, caster, book) {
    const i = target.items.indexOf('I07');
    if (i < 0) return false;
    target.items.splice(i, 1);
    this.log(`🧿 ${target.name}'s Anti-Magic Talisman blocked ${caster.name}'s ${book}!`, target);
    Sound.play('block');
    return true;
  },
  async useItem(p, tab, idx) {
    const list = p[tab], id = list[idx];
    if (!id) return false;
    const chk = this.canUseItem(p, id);
    if (!chk.ok) { if (!p.isBot && !this.sim) UI.toast(chk.reason, 'bad'); return false; }
    const it = DATA.ITEMS[id], w = this.who(p);
    const consume = () => { list.splice(list.indexOf(id), 1); p.itemUsed = true; };
    switch (it.fx) {
      case 'heal': {
        const eater = this.cls(p).passive.id === 'eater';
        const h = U.round(this.maxHp(p) * it.heal * (eater ? 1.5 : 1));
        consume();
        p.hp = Math.min(this.maxHp(p), p.hp + h);
        if (eater) p.buffs.eater = true;
        Sound.play('heal');
        this.log(`${it.icon} ${p.name} used ${it.name}: +${h} HP${eater ? ' and feels mighty (AT +40%)!' : '.'}`, p);
        if (id === 'I01' && !p.usedLarb) { p.usedLarb = true; this.unlock(p, 'isan'); }
        break;
      }
      case 'dice': consume(); p.buffs.dice = it.dice; this.log(`${it.icon} ${p.name} used ${it.name}: +${it.dice} dice next roll.`, p); Sound.play('dice'); break;
      case 'energy': consume(); p.buffs.energy = true; this.log(`${it.icon} ${p.name} drank an Energy Drink (AT +20%).`, p); Sound.play('select'); break;
      case 'home': {
        consume();
        const from = p.spaceId;
        p.spaceId = p.respawnId;
        Sound.play('warp');
        this.log(`${it.icon} ${p.name} warped home to ${MapSys.spaceName(MapSys.spaces[p.spaceId], this.state)}.`, p);
        if (!this.sim) await UI.warp(p, from);
        break;
      }
      case 'pickpocket': {
        const tid = await w.pickTarget(p, this.pickpocketTargets(p), 'pickpocket');
        if (tid == null) return false;
        consume();
        const t = this.player(tid);
        if (this.talismanBlocks(t, p, it.name)) break;
        const k = U.randInt(0, t.items.length - 1), stolen = t.items.splice(k, 1)[0];
        this.log(`🧤 ${p.name} pickpocketed ${DATA.ITEMS[stolen].name} from ${t.name}!`, p);
        Sound.play('coin');
        await this.addItem(p, stolen);
        break;
      }
      case 'trap': {
        const sid = await w.pickSpace(p, this.trapSpaces(p), 'trap');
        if (sid == null) return false;
        consume();
        this.state.traps.push({ space: sid, owner: p.id });
        this.log(`🕳️ ${p.name} set a Monster Trap somewhere nearby…`, p);
        break;
      }
      case 'challenge': {
        const tid = await w.pickTarget(p, this.challengeTargets(p), 'challenge');
        if (tid == null) return false;
        consume();
        const t = this.player(tid);
        if (this.talismanBlocks(t, p, it.name)) break;
        this.log(`✉️ ${p.name} sent a Challenge Letter to ${t.name} and rushes to their space!`, p);
        p.spaceId = t.spaceId;
        await Battle.startDuel(p, t, {});
        p.turnOver = true;                   // the duel uses up the turn
        break;
      }
    }
    if (!this.sim) UI.refresh();
    return true;
  },
  /* Energy Drink / Isan Person buffs last for the current battle, or the next one. */
  /* ================================================================ shops */
  shopStock(kind, zone) {
    if (kind === 'item') return DATA.SHOP_ITEMS[zone].slice();
    if (kind === 'larb') return ['I01'];
    if (kind === 'equip') { const a = 2 * zone - 1, b = 2 * zone; return ['W' + a, 'S' + a, 'A' + a, 'W' + b, 'S' + b, 'A' + b]; }
    return ['SK' + zone, 'SD' + zone, 'MB0' + zone];
  },
  priceOf(id) { return (DATA.ITEMS[id] || DATA.GEAR[id] || DATA.SKILLS[id]).price; },
  sellPrice(id) { return U.round(this.priceOf(id) / 2); },
  canBuy(p, id) {
    const price = this.priceOf(id);
    if (DATA.EQUIP[id]) { if (p.equip[DATA.EQUIP[id].slot] === id) return { ok: false, reason: 'Already equipped.' }; }
    else if (DATA.SKILLS[id]) { if (p[DATA.SKILLS[id].kind] === id) return { ok: false, reason: 'Already learned.' }; }
    else if (p[DATA.ITEMS[id].tab].length >= DATA.INV_SIZE) return { ok: false, reason: `Your ${DATA.ITEMS[id].tab === 'items' ? 'Item' : 'Spellbook'} tab is full.` };
    if (p.money < price) return { ok: false, reason: `Not enough money (need ${U.fmt(price)} G).` };
    return { ok: true };
  },
  buy(p, id) {
    if (!this.canBuy(p, id).ok) return false;
    const price = this.priceOf(id);
    p.money -= price;
    if (DATA.EQUIP[id]) {
      const slot = DATA.EQUIP[id].slot, old = p.equip[slot];
      if (old) { const refund = this.sellPrice(old); p.money += refund; this.log(`💱 ${p.name} sold ${DATA.GEAR[old].name} for ${refund} G.`, p); }
      this.setEquip(p, slot, id);
    } else if (DATA.SKILLS[id]) {
      p[DATA.SKILLS[id].kind] = id;
    } else p[DATA.ITEMS[id].tab].push(id);
    const name = (DATA.ITEMS[id] || DATA.GEAR[id] || DATA.SKILLS[id]).name;
    this.log(`🛒 ${p.name} bought ${name} for ${U.fmt(price)} G.`, p);
    Sound.play('buy');
    return true;
  },
  sell(p, tab, idx) {
    const id = p[tab][idx];
    if (!id) return false;
    const v = this.sellPrice(id);
    p[tab].splice(idx, 1);
    p.money += v;
    this.log(`💱 ${p.name} sold ${DATA.ITEMS[id].name} for ${v} G.`, p);
    Sound.play('coin');
    return true;
  },

  /* ================================================================ defeat */
  /* HP hit 0: back to the respawn point with full HP, lose 10% money (20% to the minion's Sticky
   * Fingers), and skip the next DATA.DOWN_TURNS turns while resurrecting (spec §6). */
  knockOut(p, cause) {
    const s = this.state;
    const lost = U.round(p.money * (cause.minion ? 0.2 : 0.1));
    p.money -= lost;
    const at = p.spaceId;
    if (s.head.holder === p.id) {
      if (cause.by === 'hero') { s.head.holder = cause.pid; this.log(`💀 The Demon Lord's Head passes to ${this.player(cause.pid).name}!`, cause.pid); }
      else { s.head.holder = null; s.head.space = at; this.log(`💀 ${p.name} dropped the Demon Lord's Head!`, p); }
    }
    p.record.deaths++;
    p.spaceId = p.respawnId;
    p.hp = this.maxHp(p);
    p.down = DATA.DOWN_TURNS; p.downReason = 'ko';
    if (this.cur() === p && (s.phase === 'preRoll' || s.phase === 'acting' || s.phase === 'battle')) p.turnOver = true;
    p.buffs.energy = false; p.buffs.eater = false;
    this.log(`💫 ${p.name} was knocked out, lost ${lost} G, and will resurrect at ${MapSys.spaceName(MapSys.spaces[p.respawnId], s)} after ${U.plural(DATA.DOWN_TURNS, 'turn')}.`, p);
    return lost;
  },
  /* Gave up: stays on the space with HP unchanged, needs DATA.DOWN_TURNS turns to stand up (spec §6). */
  giveUp(p) {
    p.down = DATA.DOWN_TURNS; p.downReason = 'giveup';
    if (this.cur() === p) p.turnOver = true;
  },
};
