'use strict';
/* Sole Blessed — core rules and the async turn loop.
 * Decisions go through Game.who(p): Bot for bots, UI for the human (same method names).
 * All state lives in Game.state (plain JSON, saved as-is to localStorage). */

const ABORT = { abort: true };

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
  equipBonus(p, stat) {
    let v = 0;
    for (const slot of ['weapon', 'armor', 'charm']) { const id = p.equip[slot]; if (id) v += DATA.GEAR[id][stat] || 0; }
    return v;
  },
  passiveMul(p, stat) {
    const id = this.cls(p).passive.id;
    if (stat === 'at' && id === 'beginner') return 1.2;
    if (stat === 'at' && id === 'hotheaded') return 1.5;
    if (stat === 'sp' && id === 'novice') return 1.2;
    return 1;
  },
  maxHp(p) { return p.base.hp + this.equipBonus(p, 'hp'); },
  stat(p, s) {
    if (s === 'hp') return this.maxHp(p);
    return U.round((p.base[s] + this.equipBonus(p, s)) * this.passiveMul(p, s));
  },
  /* Stars, then money, then level (spec §2). */
  ranking() {
    return this.state.players.slice().sort((a, b) => b.stars - a.stars || b.money - a.money || b.level - a.level || a.id - b.id);
  },
  rank(p) { return this.ranking().indexOf(p) + 1; },
  diceCount(p) { return (this.state.dlDefeated ? 2 : 1) + (p.buffs.dice || 0); },
  maxDays() { return this.state.rules.days; },
  pace() { return DATA.PACES[this.state.rules.pace] || DATA.PACES.classic; },
  battleOf(p) { return this.state.battles.find(b => b.id === p.battleId) || null; },
  armyBattle(key) { return this.state.battles.find(b => b.kind === 'army' && b.armyKey === key) || null; },
  joinableBattle(p) {
    if (p.battleId) return null;
    return this.state.battles.find(b => b.kind === 'army' && b.space === p.spaceId && b.parts.length && !b.parts.includes(p.id)) || null;
  },
  canSave() {
    const s = this.state;
    return !!s && !s.over && !this.cur().isBot && s.phase === 'preRoll' && !Battle.active;
  },

  /* ================================================================ timing / flow control */
  delayFactor() {
    if (this.sim || this.skipping) return 0;
    const c = this.state && this.cur();
    return c && c.isBot ? 1 / (UI.settings ? UI.settings.botSpeed || 2 : 2) : 1;
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
  log(text) {
    const s = this.state;
    s.log.push({ day: s.day, text });
    if (s.log.length > 80) s.log.shift();
    this.turnLog.push(text);
    if (!this.sim) UI.logLine(text);
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
      record: { monsters: 0, heroesBeaten: 0, army: 0, treasures: 0, deaths: 0 },
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
        this.log('☀️ Day 1 begins. The journey starts at the Royal Castle!');
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
    if (!this.sim) { UI.turnStart(p); if (!p.isBot) Save.autosave(s); }
    await this.wait(p.isBot ? 600 : 250);
    const action = await this.who(p).turnAction(p);
    s.phase = 'acting';
    if (s.over) return;
    if (action.type === 'end' || p.turnOver) { /* turn consumed (e.g. knocked out in a Challenge Letter duel) */ }
    else if (p.battleId) await Battle.continueFor(p);
    else if (action.type === 'join') await Battle.join(p, this.joinableBattle(p));
    else await this.moveTurn(p);
    if (s.over) return;
    await this.endTurn(p);
    if (p.isBot && this.skipping && !this.sim) { this.skipping = false; await UI.turnSummary(p, this.turnLog); }
    this.skipping = false;
  },

  async moveTurn(p) {
    const n = this.diceCount(p);
    const rolls = this.sim ? Array.from({ length: n }, () => U.randInt(1, 6)) : await UI.rollDice(p, n);
    p.buffs.dice = 0;
    const total = rolls.reduce((a, b) => a + b, 0);
    this.log(`🎲 ${p.name} rolled ${total}${rolls.length > 1 ? ` (${rolls.join('+')})` : ''}.`);
    const reach = MapSys.reachable(p.spaceId, total, id => this.isBlocking(id));
    if (!reach.size) { this.log(`${p.name} has nowhere to go.`); return; }
    const choice = await this.who(p).chooseDestination(p, reach, total);
    if (!choice.walked && !this.sim) await UI.walk(p, choice.path);
    p.spaceId = choice.target;
    if (!this.sim) UI.refresh();
    await this.resolveLanding(p);
  },

  async endTurn(p) {
    if (this.cls(p).passive.id === 'looseTongue' && U.chance(0.5)) {
      const k = p.cd.classMove > 0 ? 'classMove' : p.cd.special > 0 ? 'special' : null;
      if (k) { p.cd[k]--; this.log(`🗣️ ${p.name}'s Loose Tongue shortens a cooldown by 1 day.`); }
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
    if (s.day > this.maxDays()) { s.day = this.maxDays(); this.timeUp(); return; }
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
    this.log(`☀️ Day ${s.day} begins.`);
    if (!this.sim) await UI.dayStart(s.day);
    const regen = this.pace().regen;
    if (regen) for (const p of s.players) p.hp = Math.min(this.maxHp(p), p.hp + U.round(this.maxHp(p) * regen));
    for (const p of s.players) {
      if (this.cls(p).passive.id === 'blessed' && p.hp < this.maxHp(p)) {
        const h = U.round(this.maxHp(p) * 0.1);
        p.hp = Math.min(this.maxHp(p), p.hp + h);
        this.log(`🙏 ${p.name}'s Blessed Merit restores ${h} HP.`);
      }
    }
    const dry = s.army.B02;
    if (!dry.defeated && dry.hp < dry.maxHp) dry.hp = Math.min(dry.maxHp, dry.hp + U.round(dry.maxHp * 0.05));
    for (const id in s.chests) if (s.day >= s.chests[id] + 3) delete s.chests[id];
    if (!s.minion && s.day >= s.minionNextDay) await this.spawnMinion();
    if (!this.sim) UI.refresh();
  },

  timeUp() {
    const s = this.state;
    s.over = true;
    s.ending = s.dlDefeated ? 'secret' : 'bad';
    const n = this.maxDays();
    this.log(s.ending === 'bad' ? `🌑 ${n} days have passed. The Demon Lord was never defeated…` : `🌑 ${n} days have passed and the Demon Lord's Head never reached the castle…`);
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

  /* ================================================================ landing */
  async resolveLanding(p) {
    const s = this.state, sid = p.spaceId, sp = MapSys.spaces[sid];
    if (s.head.space === sid) {
      s.head.space = null; s.head.holder = p.id;
      this.log(`💀 ${p.name} picked up the Demon Lord's Head!`);
      Sound.play('star');
      await this.say(p, "Demon Lord's Head", `${p.name} picked up the Demon Lord's Head! Bring it to the Royal Castle.`, '💀');
    }
    if (s.minion && s.minion.spaceId === sid) {
      const b = this.armyBattle('minion');
      if (b) await Battle.join(p, b); else await Battle.startArmy(p, 'minion');
      return;
    }
    const ab = this.joinableBattle(p);
    if (ab) {
      const d = Battle.enemyDef(ab);
      const names = ab.parts.map(id => this.player(id).name).join(', ');
      if (await this.who(p).yesNo(p, 'join', { title: 'Battle in progress!', text: `${names} ${ab.parts.length > 1 ? 'are' : 'is'} fighting the ${d.name} here. Join the battle? (team attacks first, +10% damage per extra ally)`, battle: ab })) {
        await Battle.join(p, ab);
      }
      return;
    }
    const others = s.players.filter(o => o.id !== p.id && o.spaceId === sid && !o.battleId);
    if (others.length) {
      const tid = await this.who(p).chooseChallenge(p, others);
      if (tid != null) { await Battle.heroBattle(p, this.player(tid)); return; }
    }
    const ti = s.traps.findIndex(t => t.space === sid && t.owner !== p.id);
    if (ti >= 0) {
      const trap = s.traps.splice(ti, 1)[0];
      const zone = Math.min(4, sp.zone + 1);
      this.log(`🕳️ ${p.name} stepped into ${this.player(trap.owner).name}'s Monster Trap!`);
      await this.say(p, 'Monster Trap!', `A trap set by ${this.player(trap.owner).name} springs! A monster from Zone ${zone} attacks!`, '🕳️');
      await Battle.startMonster(p, U.pick(DATA.ZONE_MONSTERS[zone]), {});
      return;
    }
    await this.spaceEffect(p, sp);
  },

  async spaceEffect(p, sp) {
    const s = this.state;
    if (sp.type === 'B' && !s.army[sp.code].defeated) { await Battle.startArmy(p, sp.code); return; }
    if (sp.type === 'e' || sp.type === 'B') return this.emptySpace(p, sp);
    if (sp.type === 't') return this.treasure(p, sp);
    if (sp.type === 'L') return this.place(p, sp);
  },

  async emptySpace(p, sp) {
    if (U.chance(0.7)) {
      const key = U.pick(DATA.ZONE_MONSTERS[sp.zone]);
      await Battle.startMonster(p, key, {});
    } else await this.randomEvent(p, sp);
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
      this.log(`🏋️ ${p.name} trained: ${label}.`);
      Sound.play(up ? 'levelup' : 'error');
      await this.say(p, ev.name, up ? `Great workout! ${label}.` : `Pulled a muscle… ${label}.`, ev.icon);
    } else if (key === 'E02') {
      const cost = U.round(p.money * 0.1), max = this.maxHp(p);
      const yes = await w.yesNo(p, 'doctor', { title: `${ev.icon} ${ev.name}`, text: `A kind doctor offers to restore your HP (${p.hp}/${max}) to full for ${cost} G (10% of your money).`, cost });
      if (yes) { p.money -= cost; p.hp = max; Sound.play('heal'); this.log(`🩺 ${p.name} paid ${cost} G and was fully healed.`); }
      else this.log(`🩺 ${p.name} politely declined the doctor.`);
    } else if (key === 'E03') {
      const amt = 50 * sp.zone;
      p.money += amt; Sound.play('coin');
      this.log(`💰 ${p.name} found ${amt} G on the road.`);
      await this.say(p, ev.name, `You found ${amt} G on the road!`, ev.icon);
    } else {
      const mk = DATA.ZONE_MONSTERS[sp.zone].slice().sort((a, b) => DATA.MONSTERS[b].lv - DATA.MONSTERS[a].lv)[0];
      const m = DATA.MONSTERS[mk];
      const yes = await w.yesNo(p, 'e04', { title: `${ev.icon} ${ev.name}`, text: `Townspeople beg for help against a fearsome ${m.name} (Lv ${m.lv}, HP & AT ×1.3). Win to earn 1 extra ⭐!`, monster: mk });
      if (yes) { this.log(`🙏 ${p.name} agreed to help the townspeople!`); await Battle.startMonster(p, mk, { e04: true }); }
      else this.log(`🙏 ${p.name} turned the townspeople away.`);
    }
  },

  async treasure(p, sp) {
    const s = this.state;
    if (s.chests[sp.id] != null && s.day < s.chests[sp.id] + 3) {
      this.log(`📦 ${p.name} found an empty chest.`);
      await this.say(p, 'Empty Chest', 'This chest was opened recently. It refills 3 days after being opened.', '📦');
      return;
    }
    s.chests[sp.id] = s.day;
    p.record.treasures++;
    Sound.play('chest');
    const r = Math.random();
    if (r < 0.5 || r >= 0.9) {
      const isCharm = r >= 0.9;
      const id = isCharm ? U.pick(Object.keys(DATA.CHARMS)) : U.weighted(DATA.TREASURE_ITEMS);
      const it = isCharm ? DATA.CHARMS[id] : DATA.ITEMS[id];
      this.log(`🎁 ${p.name} found ${it.icon} ${it.name}!`);
      await this.say(p, 'Treasure!', `You found ${it.icon} ${it.name}!`, '🎁');
      if (isCharm) await this.addCharm(p, id); else await this.addItem(p, id);
    } else if (r < 0.7) {
      const books = Object.keys(DATA.ITEMS).filter(k => DATA.ITEMS[k].tab === 'books' && DATA.ITEMS[k].zone <= sp.zone);
      const id = U.pick(books), it = DATA.ITEMS[id];
      this.log(`🎁 ${p.name} found the spellbook ${it.icon} ${it.name}!`);
      await this.say(p, 'Treasure!', `You found the spellbook ${it.icon} ${it.name}!`, '🎁');
      await this.addItem(p, id);
    } else {
      const amt = 100 * sp.zone;
      p.money += amt; Sound.play('coin');
      this.log(`🎁 ${p.name} found ${amt} G in a chest!`);
      await this.say(p, 'Treasure!', `The chest is full of gold: +${amt} G!`, '💰');
    }
  },

  async place(p, sp) {
    switch (sp.code) {
      case 'L01': return this.royalCastle(p, sp);
      case 'L02': return this.who(p).shop(p, 'item', sp.zone);
      case 'L03': return this.who(p).shop(p, 'equip', sp.zone);
      case 'L04': return this.who(p).shop(p, 'skill', sp.zone);
      case 'L05': return this.temple(p, sp);
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
      this.log(`👑 ${p.name} delivered the Demon Lord's Head to the King! +5 ⭐`);
      if (!this.sim) await UI.announce({ title: "The Head is Delivered!", text: `${p.name} presents the Demon Lord's Head to the King. +5 ⭐`, icon: '👑', auto: 0 });
      return;
    }
    if (p.respawnId !== sp.id) {
      if (await this.who(p).yesNo(p, 'respawn', { title: '🏰 Royal Castle', text: 'Set the Royal Castle as your respawn point?' })) {
        p.respawnId = sp.id; this.log(`🚩 ${p.name} set the Royal Castle as their respawn point.`);
      }
    } else await this.say(p, 'Royal Castle', 'The King nods at you. "Keep fighting, hero!"', '🏰');
  },

  async temple(p, sp) {
    const w = this.who(p);
    if (p.respawnId !== sp.id && await w.yesNo(p, 'respawn', { title: '🛕 Temple', text: 'Set this temple as your respawn point?' })) {
      p.respawnId = sp.id; this.log(`🚩 ${p.name} set a temple as their respawn point.`);
    }
    const cost = U.round(p.money * 0.1);
    if (cost > 0 && await w.yesNo(p, 'donate', { title: '🛕 Make Merit', text: `Donate ${cost} G (10% of your money) to make merit? (Made merit ${p.merit} time${p.merit === 1 ? '' : 's'} so far)`, cost })) {
      p.money -= cost; p.merit++;
      Sound.play('heal');
      this.log(`🙏 ${p.name} made merit (${p.merit}).`);
      if (p.merit >= 3) this.unlock(p, 'templekid');
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
    if (winner === bet.horse) { p.money += amount * 5; Sound.play('coin'); this.log(`🏇 ${p.name} bet ${amount} G on ${horse} and WON ${amount * 5} G!`); }
    else this.log(`🏇 ${p.name} bet ${amount} G on ${horse} and lost.`);
    if (bet.pct >= 1) { p.wentAllIn = true; this.unlock(p, 'gambler'); }
    void sp;
  },

  /* ================================================================ minion */
  async spawnMinion() {
    const s = this.state;
    const cleared = ['B01', 'B02', 'B03'].filter(k => s.army[k].defeated).length;
    const zone = Math.min(4, cleared + 1);
    const cands = MapSys.list.filter(sp => sp.zone === zone && sp.type === 'e' && !s.players.some(p => p.spaceId === sp.id));
    if (!cands.length) return;
    const sp = U.pick(cands), st = DATA.minionStats(zone);
    s.minion = { zone, spaceId: sp.id, hp: st.hp, maxHp: st.hp, cd: { special: 0, specialDef: 0 } };
    this.log(`😈 A Demon Lord Minion (Lv ${st.lv}) appeared in ${DATA.ZONES[zone - 1].name}!`);
    Sound.play('spawn');
    if (!this.sim) await UI.minionSpawn(sp.id, st);
  },

  async minionMove() {
    const s = this.state, m = s.minion;
    if (!m || this.armyBattle('minion')) return;
    const B = MapSys.bfs(m.spaceId, id => this.isBlocking(id));
    const targets = s.players.filter(p => !p.battleId && B.dist[p.spaceId] >= 1).sort((a, b) => B.dist[a.spaceId] - B.dist[b.spaceId]);
    if (!targets.length) return;
    const target = targets[0], path = B.path(target.spaceId);
    const roll = U.randInt(1, 6);
    let end = Math.min(roll, path.length - 1);
    for (let i = 1; i <= end; i++) if (s.players.some(p => !p.battleId && p.spaceId === path[i])) { end = i; break; }
    const walkPath = path.slice(0, end + 1);
    this.log(`😈 The minion rolls ${roll} and creeps toward ${target.name}.`);
    if (!this.sim) await UI.minionWalk(walkPath);
    m.spaceId = walkPath[walkPath.length - 1];
    const victims = s.players.filter(p => !p.battleId && p.spaceId === m.spaceId);
    if (victims.length) await Battle.ambush(victims.includes(target) ? target : victims[0]);
  },

  /* ================================================================ growth */
  expFrom(p, exp, lv) { return U.round(exp * U.clamp(1 + 0.1 * (lv - p.level), 0.5, 2) * this.pace().expMul); },
  gainExp(p, amt) {
    if (p.level >= DATA.MAX_LEVEL || amt <= 0) return 0;
    p.exp += amt;
    let ups = 0;
    while (p.level < DATA.MAX_LEVEL && p.exp >= 10 * p.level) { p.exp -= 10 * p.level; this.levelUp(p); ups++; }
    if (p.level >= DATA.MAX_LEVEL) p.exp = 0;
    if (ups) this.log(`⬆️ ${p.name} reached level ${p.level}!`);
    return ups;
  },
  levelUp(p) {
    const before = this.maxHp(p);
    p.level++;
    p.base.hp += 10;
    const add = g => { for (const k in g) p.base[k] += g[k]; };
    add(this.cls(p).levelUp);
    for (const m of p.mastered) add(DATA.CLASSES[m].mastery);
    p.freePts += 2;
    p.hp = Math.min(this.maxHp(p), p.hp + (this.maxHp(p) - before));
  },
  applyPoint(p, stat) {
    if (p.freePts <= 0) return;
    p.freePts--;
    if (stat === 'hp') { p.base.hp += 5; p.hp += 5; } else p.base[stat] += 1;
  },
  async allocatePoints(p) { if (p.freePts > 0) await this.who(p).allocatePoints(p); },
  gainJobExp(p, n) {
    const c = p.classId;
    if (p.mastered.includes(c)) return false;
    p.jobExp[c] = Math.min(10, (p.jobExp[c] || 0) + n);
    if (p.jobExp[c] < 10) return false;
    p.mastered.push(c);
    this.log(`🌟 ${p.name} mastered ${DATA.CLASSES[c].name}!`);
    if (DATA.CLASSES[c].next) this.unlock(p, DATA.CLASSES[c].next);
    return true;
  },
  unlock(p, cid) {
    if (p.unlocked.includes(cid)) return false;
    p.unlocked.push(cid);
    this.log(`🔓 ${p.name} unlocked the ${DATA.CLASSES[cid].name} class!`);
    if (!p.isBot && !this.sim) UI.toast(`🔓 New class unlocked: ${DATA.CLASSES[cid].name}! Change class from the Status screen.`, 'good');
    return true;
  },
  canChangeClass(p) {
    const s = this.state;
    if (this.cur() !== p) return { ok: false, reason: 'You can only change class during your own turn.' };
    if (s.phase !== 'preRoll') return { ok: false, reason: 'You can only change class before rolling the dice.' };
    if (p.battleId) return { ok: false, reason: 'You cannot change class while locked in battle.' };
    return { ok: true };
  },
  changeClass(p, cid) {
    if (!p.unlocked.includes(cid) || p.classId === cid || !this.canChangeClass(p).ok) return false;
    p.classId = cid;
    p.hp = Math.min(p.hp, this.maxHp(p));
    this.log(`🔁 ${p.name} changed class to ${DATA.CLASSES[cid].name}.`);
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
    if (choice === 'new' || choice == null) { this.log(`🗑️ ${p.name} left ${it.name} behind (bag full).`); return false; }
    this.log(`🗑️ ${p.name} discarded ${DATA.ITEMS[list[choice]].name} for ${it.name}.`);
    list[choice] = id;
    return true;
  },
  async addCharm(p, id) {
    const c = DATA.CHARMS[id];
    if (!p.equip.charm) { this.setEquip(p, 'charm', id); this.log(`📿 ${p.name} equipped ${c.name}.`); return true; }
    if (p.equip.charm === id) { this.log(`📿 ${p.name} already wears a ${c.name}.`); return false; }
    if (await this.who(p).charmChoice(p, id)) { this.setEquip(p, 'charm', id); this.log(`📿 ${p.name} swapped charms for ${c.name}.`); return true; }
    return false;
  },
  gainMoney(p, amt, fromBattle) {
    if (fromBattle && p.equip.charm === 'C04') amt = U.round(amt * 1.2);
    p.money += amt;
    return amt;
  },

  /* Item/spellbook use: once per turn, before rolling or before continuing a battle. */
  canUseItem(p, id) {
    const s = this.state, it = DATA.ITEMS[id];
    if (this.cur() !== p || s.phase !== 'preRoll') return { ok: false, reason: 'Items can only be used on your turn, before rolling.' };
    if (p.itemUsed) return { ok: false, reason: 'You already used an item this turn.' };
    switch (it.fx) {
      case 'talisman': return { ok: false, reason: 'The talisman activates automatically when a spellbook targets you.' };
      case 'quest': return { ok: false, reason: 'Bring it to the Royal Castle.' };
      case 'heal': return p.hp >= this.maxHp(p) ? { ok: false, reason: 'Your HP is already full.' } : { ok: true };
      case 'dice':
        if (p.battleId) return { ok: false, reason: 'You will not roll this turn (locked in battle).' };
        return p.buffs.dice ? { ok: false, reason: 'A dice bonus is already active.' } : { ok: true };
      case 'energy': return p.buffs.energy ? { ok: false, reason: 'Energy Drink is already active.' } : { ok: true };
      case 'home':
        if (s.head.holder === p.id) return { ok: false, reason: "Cannot warp while holding the Demon Lord's Head." };
        if (p.battleId) return { ok: false, reason: 'Cannot warp while locked in battle.' };
        return p.spaceId === p.respawnId ? { ok: false, reason: 'You are already at your respawn point.' } : { ok: true };
      case 'pickpocket':
        return this.pickpocketTargets(p).length ? { ok: true } : { ok: false, reason: 'No other hero has items to steal.' };
      case 'trap':
        if (p.battleId) return { ok: false, reason: 'Not while locked in battle.' };
        return this.trapSpaces(p).length ? { ok: true } : { ok: false, reason: 'No empty space within 6 spaces.' };
      case 'challenge':
        if (p.battleId) return { ok: false, reason: 'Not while locked in battle.' };
        return this.challengeTargets(p).length ? { ok: true } : { ok: false, reason: 'No hero within 6 spaces (who is not locked in battle).' };
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
    return this.state.players.filter(o => o.id !== p.id && !o.battleId && d[o.spaceId] <= 6);
  },
  talismanBlocks(target, caster, book) {
    const i = target.items.indexOf('I07');
    if (i < 0) return false;
    target.items.splice(i, 1);
    this.log(`🧿 ${target.name}'s Anti-Magic Talisman blocked ${caster.name}'s ${book}!`);
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
        this.log(`${it.icon} ${p.name} used ${it.name}: +${h} HP${eater ? ' and feels mighty (AT +40% next battle)!' : '.'}`);
        if (id === 'I01' && !p.usedLarb) { p.usedLarb = true; this.unlock(p, 'isan'); }
        break;
      }
      case 'dice': consume(); p.buffs.dice = it.dice; this.log(`${it.icon} ${p.name} used ${it.name}: +${it.dice} dice next roll.`); Sound.play('dice'); break;
      case 'energy': consume(); p.buffs.energy = true; this.log(`${it.icon} ${p.name} drank an Energy Drink (AT +20% next battle).`); Sound.play('select'); break;
      case 'home': {
        consume();
        const from = p.spaceId;
        p.spaceId = p.respawnId;
        Sound.play('warp');
        this.log(`${it.icon} ${p.name} warped home to ${MapSys.spaceName(MapSys.spaces[p.spaceId], this.state)}.`);
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
        this.log(`🧤 ${p.name} pickpocketed ${DATA.ITEMS[stolen].name} from ${t.name}!`);
        Sound.play('coin');
        await this.addItem(p, stolen);
        break;
      }
      case 'trap': {
        const sid = await w.pickSpace(p, this.trapSpaces(p), 'trap');
        if (sid == null) return false;
        consume();
        this.state.traps.push({ space: sid, owner: p.id });
        this.log(`🕳️ ${p.name} set a Monster Trap somewhere nearby…`);
        break;
      }
      case 'challenge': {
        const tid = await w.pickTarget(p, this.challengeTargets(p), 'challenge');
        if (tid == null) return false;
        consume();
        const t = this.player(tid);
        if (this.talismanBlocks(t, p, it.name)) break;
        this.log(`✉️ ${p.name} sent a Challenge Letter to ${t.name}!`);
        await Battle.heroBattle(p, t);
        break;
      }
    }
    if (!this.sim) UI.refresh();
    return true;
  },

  /* ================================================================ shops */
  shopStock(kind, zone) {
    if (kind === 'item') return DATA.SHOP_ITEMS.slice();
    if (kind === 'larb') return ['I01'];
    if (kind === 'equip') return ['W' + zone, 'S' + zone, 'A' + zone];
    return ['SK' + zone, 'SD' + zone, 'MB0' + zone];
  },
  priceOf(id) { return (DATA.ITEMS[id] || DATA.GEAR[id] || DATA.SKILLS[id]).price; },
  sellPrice(id) { return U.round(this.priceOf(id) / 2); },
  canBuy(p, id) {
    const price = this.priceOf(id);
    if (DATA.EQUIP[id]) { if (p.equip[DATA.EQUIP[id].slot] === id) return { ok: false, reason: 'Already equipped.' }; }
    else if (DATA.SKILLS[id]) { if (p[DATA.SKILLS[id].kind] === id) return { ok: false, reason: 'Already learned.' }; }
    else if (p[DATA.ITEMS[id].tab].length >= DATA.INV_SIZE) return { ok: false, reason: `Your ${DATA.ITEMS[id].tab === 'items' ? 'Item' : 'Spellbook'} tab is full.` };
    if (p.money < price) return { ok: false, reason: `Not enough money (need ${price} G).` };
    return { ok: true };
  },
  buy(p, id) {
    if (!this.canBuy(p, id).ok) return false;
    const price = this.priceOf(id);
    p.money -= price;
    if (DATA.EQUIP[id]) {
      const slot = DATA.EQUIP[id].slot, old = p.equip[slot];
      if (old) { const refund = this.sellPrice(old); p.money += refund; this.log(`💱 ${p.name} sold ${DATA.GEAR[old].name} for ${refund} G.`); }
      this.setEquip(p, slot, id);
    } else if (DATA.SKILLS[id]) {
      p[DATA.SKILLS[id].kind] = id;
    } else p[DATA.ITEMS[id].tab].push(id);
    const name = (DATA.ITEMS[id] || DATA.GEAR[id] || DATA.SKILLS[id]).name;
    this.log(`🛒 ${p.name} bought ${name} for ${price} G.`);
    Sound.play('buy');
    return true;
  },
  sell(p, tab, idx) {
    const id = p[tab][idx];
    if (!id) return false;
    const v = this.sellPrice(id);
    p[tab].splice(idx, 1);
    p.money += v;
    this.log(`💱 ${p.name} sold ${DATA.ITEMS[id].name} for ${v} G.`);
    Sound.play('coin');
    return true;
  },

  /* ================================================================ defeat */
  /* HP hit 0: respawn with full HP, lose 10% money (20% to the minion's Sticky Fingers). */
  knockOut(p, cause) {
    const s = this.state;
    const lost = U.round(p.money * (cause.minion ? 0.2 : 0.1));
    p.money -= lost;
    const at = p.spaceId;
    if (s.head.holder === p.id) {
      if (cause.by === 'hero') { s.head.holder = cause.pid; this.log(`💀 The Demon Lord's Head passes to ${this.player(cause.pid).name}!`); }
      else { s.head.holder = null; s.head.space = at; this.log(`💀 ${p.name} dropped the Demon Lord's Head!`); }
    }
    p.record.deaths++;
    p.spaceId = p.respawnId;
    p.hp = this.maxHp(p);
    if (this.cur() === p && (s.phase === 'preRoll' || s.phase === 'acting')) p.turnOver = true;
    p.buffs.energy = false; p.buffs.eater = false;
    this.log(`💫 ${p.name} was knocked out, lost ${lost} G, and returned to ${MapSys.spaceName(MapSys.spaces[p.respawnId], s)}.`);
    return lost;
  },
};
