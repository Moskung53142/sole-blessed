'use strict';
/* Sole Blessed — battle rules (Battle) and the battle scene + HUD (BattleView). Spec §6, §9. */

const CMD_INFO = {
  special: { key: 'W', label: 'Special', icon: '✨', role: 'atk' },
  strike: { key: 'A', label: 'Strike', icon: '💥', role: 'atk' },
  attack: { key: 'D', label: 'Attack', icon: '⚔️', role: 'atk' },
  classMove: { key: 'S', label: 'Class Move', icon: '🌟', role: 'atk' },
  specialDef: { key: 'W', label: 'Special Def.', icon: '🛡️', role: 'def' },
  counter: { key: 'A', label: 'Counter', icon: '↩️', role: 'def' },
  defend: { key: 'D', label: 'Defend', icon: '🧱', role: 'def' },
  giveUp: { key: 'S', label: 'Give Up', icon: '🏳️', role: 'def' },
};
const ROLE_CMDS = { atk: ['special', 'strike', 'attack', 'classMove'], def: ['specialDef', 'counter', 'defend', 'giveUp'] };

const Battle = {
  active: false,

  view() { return Game.sim ? SimView : BattleView; },

  /* ================================================================ battle objects (saved in state.battles)
   * kind 'monster' | 'army' | 'duel'. `reserve` counts duels that will hand the fight back (brawls). */
  create(kind, space, armyKey, enemy) {
    const s = Game.state;
    const b = { id: s.nextBattleId++, kind, space, armyKey: armyKey || null, enemy: enemy || null, parts: [], first: {}, mods: {}, reserve: 0 };
    s.battles.push(b);
    return b;
  },
  addPart(b, p, first) {
    b.parts.push(p.id);
    b.first[p.id] = first;
    b.mods[p.id] = { energy: p.buffs.energy, eater: p.buffs.eater, vines: false };
    p.buffs.energy = false; p.buffs.eater = false;
    p.battleId = b.id;
  },
  removePart(b, p) {
    b.parts = b.parts.filter(id => id !== p.id);
    delete b.first[p.id]; delete b.mods[p.id];
    if (p.battleId === b.id) p.battleId = null;
    if (!b.parts.length && !b.reserve) this.dispose(b);
  },
  dispose(b) {
    const s = Game.state;
    for (const id of b.parts) if (s.players[id].battleId === b.id) s.players[id].battleId = null;
    s.battles = s.battles.filter(x => x !== b);
  },

  /* Static definition merged with the live (saved) enemy record {hp, maxHp, cd?, specialDay?}. */
  enemyDef(b) {
    const s = Game.state;
    if (b.kind === 'monster') {
      const m = DATA.MONSTERS[b.enemy.key];
      return Object.assign({}, m, { at: U.round(m.at * b.enemy.mult), live: b.enemy, sprite: m.key, name: (b.enemy.e04 ? 'Fearsome ' : '') + m.name });
    }
    if (b.armyKey === 'minion') return Object.assign(DATA.minionStats(s.minion.zone), { live: s.minion, sprite: 'minion' });
    return Object.assign({}, DATA.ARMY[b.armyKey], { live: s.army[b.armyKey], sprite: Sprites.ARMY_SPRITE[b.armyKey] });
  },

  heroC(b, p) {
    const mods = (b && b.mods[p.id]) || {};
    const c = Game.cls(p);
    let atMul = 1;
    if (mods.energy) atMul *= 1.2;
    if (mods.eater) atMul *= 1.4;
    if (mods.vines) atMul *= 0.8;
    return {
      isHero: true, p, name: p.name, level: p.level,
      get hp() { return p.hp; }, set hp(v) { p.hp = v; },
      maxHp: Game.maxHp(p),
      at: U.round(Game.stat(p, 'at') * atMul), df: Game.stat(p, 'df'), sp: Game.stat(p, 'sp'),
      magic: c.magic, passive: c.passive.id, classMove: c.move,
      special: p.special ? DATA.SKILLS[p.special] : null,
      specialDef: p.specialDef ? DATA.SKILLS[p.specialDef] : null,
      cd: p.cd,
      coop: b && b.kind !== 'duel' ? Math.min(0.3, 0.1 * (b.parts.length - 1)) : 0,
      buffs: mods,
    };
  },
  enemyC(b) {
    const d = this.enemyDef(b), live = d.live;
    let at = d.at, df = d.df, form = 0;
    if (d.passive === 'threeForms') {
      const pct = live.hp / live.maxHp * 100;
      if (pct > 66) { df *= 1.5; form = 1; } else if (pct > 33) { at *= 1.3; form = 2; } else form = 3;
    }
    return {
      isHero: false, isMonster: b.kind === 'monster', name: d.name, level: d.lv, key: d.key, sprite: d.sprite,
      get hp() { return live.hp; }, set hp(v) { live.hp = v; },
      maxHp: live.maxHp, at: U.round(at), df: U.round(df), sp: d.sp,
      magic: false, passive: d.passive,
      special: d.special ? DATA.ENEMY_MOVES[d.special] : null,
      specialDef: d.specialDef ? DATA.ENEMY_MOVES[d.specialDef] : null,
      cd: live.cd, live, form, coop: 0,
    };
  },

  /* Which commands a combatant may pick, with a reason when not. */
  commands(c, role) {
    const s = Game.state, out = {};
    const cdCheck = v => (v > 0 ? { ok: false, reason: `On cooldown: ${v} more day${v > 1 ? 's' : ''}.`, cd: v } : { ok: true });
    if (role === 'atk') {
      if (!c.special) out.special = { ok: false, reason: c.isHero ? 'No Special move learned. Buy one at a Skillbook Shop.' : 'No special move.' };
      else if (c.isMonster) out.special = c.live.specialDay === s.day ? { ok: false, reason: 'Already used today.', cd: 1 } : { ok: true };
      else out.special = cdCheck(c.cd.special);
      out.strike = { ok: true };
      out.attack = { ok: true };
      out.classMove = c.isHero ? cdCheck(c.cd.classMove) : { ok: false, reason: 'No class move.' };
    } else {
      out.specialDef = !c.specialDef ? { ok: false, reason: c.isHero ? 'No Special Defense learned. Buy one at a Skillbook Shop.' : 'No special defense.' } : cdCheck(c.cd.specialDef);
      out.counter = { ok: true };
      out.defend = { ok: true };
      out.giveUp = c.isHero ? { ok: true } : { ok: false, reason: 'Monsters never give up.' };
    }
    return out;
  },
  enemyChoose(c, role) {
    const cm = this.commands(c, role);
    if (role === 'atk') {
      if (cm.special.ok && (!c.isMonster || U.chance(0.5))) return 'special';
      return U.chance(0.6) ? 'attack' : 'strike';
    }
    if (cm.specialDef.ok) return 'specialDef';
    return U.chance(0.5) ? 'defend' : 'counter';
  },
  async heroCmd(p, b, role, self, foe) {
    const cmds = this.commands(self, role);
    return Game.who(p).battleCommand(p, b, role, self, foe, cmds);
  },
  cmdName(c, cmd) {
    if (cmd === 'special') return c.special.name;
    if (cmd === 'classMove') return c.classMove.name;
    if (cmd === 'specialDef') return c.specialDef.name;
    return CMD_INFO[cmd].label;
  },

  /* ================================================================ damage (spec §6.2) */
  base(A, D) { return Math.max(1, (A.magic ? A.sp : A.at) * 2 - D.df); },
  moveHits(fx, A, D) {
    switch (fx.type) {
      case 'spMul': return [A.sp * fx.mul];
      case 'atMul': return [A.at * fx.mul];
      case 'atSpMul': return [(A.at + A.sp) * fx.mul];
      case 'baseMul': return [this.base(A, D) * fx.mul];
      case 'baseMulPlusSp': return [this.base(A, D) * fx.mul + A.sp];
      case 'furious': return [this.base(A, D) * fx.mul + fx.lost * (A.maxHp - A.hp)];
      case 'arrows': return Array.from({ length: fx.n }, () => (this.base(A, D) + A.sp) * fx.mul);
      case 'alms': return [0.5 * D.at + 0.5 * D.sp];
      case 'allIn': { const h = []; for (let i = 0; i < fx.tries && U.chance(0.5); i++) h.push(A.sp * fx.mul); return h; }
    }
    return [0];
  },
  hurt(C, n) { C.hp = Math.max(0, C.hp - n); },
  heal(C, n) { const before = C.hp; C.hp = Math.min(C.maxHp, C.hp + n); return C.hp - before; },

  /* Resolve one attack. A attacks with aCmd, D answers with dCmd. Mutates HP; returns a report. */
  exchange(b, A, D, aCmd, dCmd) {
    const s = Game.state;
    const R = { aCmd, dCmd, aName: this.cmdName(A, aCmd), dName: this.cmdName(D, dCmd), events: [], notes: [], toA: 0, toD: 0 };
    if (aCmd === 'special') { if (A.isMonster) A.live.specialDay = s.day; else A.cd.special = A.special.cd; }
    if (aCmd === 'classMove') A.cd.classMove = A.classMove.cd;
    if (dCmd === 'specialDef') D.cd.specialDef = D.specialDef.cd;
    if (dCmd === 'giveUp') { R.surrender = true; R.notes.push(`${D.name} gives up!`); return R; }

    const sd = dCmd === 'specialDef' ? D.specialDef.fx : null;
    if (sd && sd.type === 'heal') { const h = this.heal(D, U.round(D.sp * sd.mul)); R.events.push({ to: 'D', heal: h, tag: 'RECOVER' }); }
    const isMove = aCmd === 'special' || aCmd === 'classMove';
    const fx = isMove ? (aCmd === 'special' ? A.special.fx : A.classMove.fx) : null;
    const normal = aCmd === 'attack' || aCmd === 'strike';

    if (aCmd === 'strike' && dCmd === 'counter') {
      const dmg = U.round(this.base(D, A) * 1.5);
      this.hurt(A, dmg); R.toA += dmg;
      R.events.push({ to: 'A', dmg, tag: 'COUNTER!' });
      R.notes.push(`${D.name} read the Strike and countered for ${dmg}!`);
      R.countered = true;
      return R;
    }

    const hits = isMove ? this.moveHits(fx, A, D) : [this.base(A, D)];
    if (fx && fx.type === 'allIn') R.notes.push(hits.length ? `All-In hit ${hits.length} time${hits.length > 1 ? 's' : ''}!` : 'All-In busted!');
    const perHitPassive = normal || (fx && fx.type === 'arrows');
    let reflected = 0;
    for (const raw of hits) {
      let dmg = raw, tag = '';
      if (A.isHero) {
        const pa = A.passive;
        if (pa === 'hotheaded' && U.chance(0.2)) { dmg = 0; tag = 'MISS'; }
        else if (pa === 'crossEyed' && perHitPassive) {
          if (U.chance(0.1)) { dmg = 0; tag = 'MISS'; } else if (U.chance(0.3)) { dmg *= 2; tag = 'CRIT!'; }
        } else if (pa === 'keenEyes' && normal && U.chance(0.2)) { dmg *= 1.5; tag = 'CRIT!'; }
        if ((pa === 'beginner' || pa === 'novice') && dmg > 0 && U.chance(0.5)) { dmg *= 0.8; tag = tag || 'Wobbly…'; }
        if (A.coop) dmg *= 1 + A.coop;
      }
      if (!isMove && dmg > 0) {
        if (dCmd === 'defend') dmg *= aCmd === 'attack' ? 0.5 : 2;
        else if (dCmd === 'counter') dmg *= 1.5;
      }
      if (sd && dmg > 0) {
        if (sd.type === 'reduce') { if (sd.reflect) reflected += dmg * sd.reflect; dmg *= 1 - sd.v; }
        else if (sd.type === 'immune') { dmg = 0; tag = 'BLOCKED'; }
        else if (sd.type === 'mirror' && isMove) { reflected += dmg; dmg = 0; tag = 'REFLECT!'; }
      }
      if (!D.isHero && dmg > 0) {
        const dp = D.passive;
        if ((dp === 'stickyBody' || dp === 'thickHide' || dp === 'moltenBody') && aCmd === 'strike') dmg *= 0.7;
        if (dp === 'leapDodge' && aCmd === 'attack' && U.chance(0.2)) { dmg = 0; tag = 'DODGE'; }
        if (dp === 'shadowForm' && normal && U.chance(0.25)) { dmg = 0; tag = 'DODGE'; }
        if (dp === 'threeForms' && D.form === 3) reflected += dmg * 0.2;
      }
      if (!A.isHero && dmg > 0) {
        if ((A.passive === 'stinger' || A.passive === 'pounce') && U.chance(0.2)) { dmg *= 1.5; tag = A.passive === 'pounce' ? 'POUNCE!' : 'STING!'; }
        if (A.passive === 'poisonTail' && U.chance(0.2)) { dmg += 0.1 * D.maxHp; tag = 'POISON!'; }
      }
      dmg = U.round(dmg);
      this.hurt(D, dmg); R.toD += dmg;
      R.events.push({ to: 'D', dmg, tag: tag || (dmg === 0 ? 'NO DAMAGE' : '') });
      if (!A.isHero && A.passive === 'rapidBite' && normal && dmg > 0 && U.chance(0.2)) {
        this.hurt(D, dmg); R.toD += dmg;
        R.events.push({ to: 'D', dmg, tag: 'BITE AGAIN!' });
      }
    }
    if (fx && fx.drain && R.toD > 0) { const h = this.heal(A, U.round(R.toD * fx.drain)); if (h) R.events.push({ to: 'A', heal: h, tag: 'DRAIN' }); }
    if (fx && fx.debuffAt && D.isHero && b.mods[D.p.id]) { b.mods[D.p.id].vines = true; R.notes.push(`${D.name} is entangled: AT −20% for the rest of the battle!`); }
    if (reflected > 0) {
      const r = U.round(reflected);
      this.hurt(A, r); R.toA += r;
      R.events.push({ to: 'A', dmg: r, tag: 'REFLECTED' });
    }
    return R;
  },
  luckyCheck(C, R) {
    if (C.isHero && C.hp <= 0 && C.passive === 'lucky' && U.chance(0.5)) {
      C.hp = Math.max(1, U.round(C.maxHp * 0.2));
      R.notes.push(`🍀 ${C.name} got Lucky and revived with ${C.hp} HP!`);
      R.events.push({ to: C === R._A ? 'A' : 'D', heal: C.hp, tag: 'LUCKY!' });
    }
  },
  summary(A, D, R) {
    if (R.surrender) return `${D.name} gave up!`;
    const parts = [`${A.name}: ${R.aName} → ${D.name}: ${R.dName}.`];
    if (R.countered) parts.push(`Countered! ${A.name} takes ${R.toA}.`);
    else {
      parts.push(`${R.toD} damage to ${D.name}.`);
      if (R.toA) parts.push(`${R.toA} reflected to ${A.name}.`);
    }
    return parts.concat(R.notes).join(' ');
  },

  /* ================================================================ monster & Demon Lord Army flows */
  async startMonster(p, key, opts) {
    const m = DATA.MONSTERS[key], mult = opts.e04 ? DATA.E04_MULT : 1, hp = U.round(m.hp * mult);
    const b = this.create('monster', p.spaceId, null, { key, mult, e04: !!opts.e04, hp, maxHp: hp, specialDay: 0 });
    this.addPart(b, p, null);
    Game.log(`⚔️ ${p.name} encountered ${opts.e04 ? 'a fearsome' : 'a'} ${m.name} (Lv ${m.lv})!`, p);
    await this.session(b, p, {});
  },
  async startArmy(p, key) {
    const s = Game.state;
    await this.preBattleDialogue(p, key);
    const space = key === 'minion' ? s.minion.spaceId : p.spaceId;
    const b = this.create('army', space, key, null);
    this.addPart(b, p, null);
    Game.log(`⚔️ ${p.name} challenges the ${this.enemyDef(b).name}!`, p);
    await this.session(b, p, {});
  },
  async preBattleDialogue(p, key) {
    if (Game.sim || key === 'minion' || (p.isBot && Game.skipping)) return;
    const f = Game.state.flags, D = DATA.DIALOGUE;
    if (key === 'B04') {
      const lines = [];
      if (!f.castleIntro) { f.castleIntro = true; lines.push({ who: 'narrator', text: D.castleDecision }, { who: 'assistant', text: D.castleEnter }); }
      lines.push({ who: 'darklord', text: f.dlMet ? D.dlShort : D.dlFirst });
      f.dlMet = true;
      Sound.play('boss');
      await UI.dialogue(lines, { auto: p.isBot });
    } else {
      const first = !f.generalMet[key];
      f.generalMet[key] = true;
      await UI.dialogue([{ who: 'general', name: DATA.ARMY[key].name, portrait: Sprites.ARMY_SPRITE[key], text: first ? D.generalFirst : D.generalShort }], { auto: p.isBot });
    }
  },
  async join(p, b) {
    if (!b) return;
    this.addPart(b, p, 'hero');
    Game.log(`🤝 ${p.name} joined the fight against the ${this.enemyDef(b).name}!`, p);
    await this.session(b, p, {});
  },
  async continueFor(p) {
    const b = Game.battleOf(p);
    if (!b) { p.battleId = null; return; }
    if (b.kind === 'duel') { await this.duelSession(b, p); return; }
    Game.log(`⚔️ ${p.name} continues the battle against the ${this.enemyDef(b).name}.`, p);
    await this.session(b, p, {});
  },
  /* End-of-day minion ambush: 1 round, minion attacks first, no card game. */
  async ambush(p) {
    const s = Game.state;
    Game.log(`😈 The minion ambushes ${p.name}!`, 'minion');
    if (!p.isBot) Game.needHuman();
    const b = this.create('army', s.minion.spaceId, 'minion', null);
    this.addPart(b, p, 'enemy');
    await this.session(b, p, { rounds: 1, ambush: true });
  },

  sceneHero(p, b) {
    const H = this.heroC(b, p);
    return { name: p.name, level: p.level, hp: p.hp, maxHp: H.maxHp, at: H.at, df: H.df, sp: H.sp, isHuman: !p.isBot, color: p.color,
      draw: { type: 'hero', classId: p.classId, gender: p.gender, color: p.color }, pid: p.id };
  },
  sceneFor(b, p) {
    const E = this.enemyC(b), d = this.enemyDef(b);
    return {
      zone: MapSys.spaces[b.space].zone, boss: b.armyKey === 'B04', kind: b.kind,
      left: this.sceneHero(p, b),
      right: { name: d.name, level: d.lv, hp: E.hp, maxHp: E.maxHp, at: E.at, df: E.df, sp: E.sp, color: '#6a1622',
        draw: { type: 'monster', key: d.sprite, form: E.form, big: b.kind === 'army' && b.armyKey !== 'minion' }, info: this.enemyInfo(E, d) },
      allies: b.parts.filter(id => id !== p.id).map(id => this.sceneHero(Game.player(id), b)),
      leftCombatant: () => this.heroC(b, p), rightCombatant: () => this.enemyC(b),
    };
  },
  enemyInfo(E, d) {
    const lines = [];
    if (d.passive) lines.push(`<b>${DATA.PASSIVES[d.passive].name}</b> (passive): ${DATA.PASSIVES[d.passive].text}`);
    if (E.special) lines.push(`<b>${E.special.name}</b> (special${E.isMonster ? ', once per day' : `, CD ${E.special.cd}`}): ${E.special.text}`);
    if (E.specialDef) lines.push(`<b>${E.specialDef.name}</b> (special defense, CD ${E.specialDef.cd}): ${E.specialDef.text}`);
    if (!lines.length) lines.push('No special abilities.');
    const drops = d.drops ? d.drops : d.drop ? [d.drop] : [];
    if (drops.length) lines.push('Drops: ' + drops.map(x => `${(DATA.ITEMS[x.id] || DATA.CHARMS[x.id]).name} ${Math.round(x.chance * 100)}%`).join(', '));
    lines.push(`Rewards: ${d.exp} EXP · ${d.money} G${d.stars ? ` · ${d.stars} ⭐` : ''}`);
    return lines;
  },

  /* Up to `rounds` rounds for hero p against b's enemy, then resolve the outcome. */
  async session(b, p, opts) {
    const V = this.view();
    const mods = b.mods[p.id];
    if (p.buffs.energy) { mods.energy = true; p.buffs.energy = false; }
    if (p.buffs.eater) { mods.eater = true; p.buffs.eater = false; }
    this.active = true;
    try {
      const scene = () => this.sceneFor(b, p);
      await V.open(scene, { humanInvolved: !p.isBot });
      if (b.first[p.id] == null) b.first[p.id] = (await V.cards(!p.isBot)) ? 'hero' : 'enemy';
      const rounds = opts.rounds || DATA.ROUNDS_PER_DAY;
      let outcome = null;
      for (let r = 1; r <= rounds && !outcome; r++) {
        V.round(r, rounds);
        const order = b.first[p.id] === 'hero' ? ['L', 'R'] : ['R', 'L'];
        for (const side of order) {
          const H = this.heroC(b, p), E = this.enemyC(b);
          const A = side === 'L' ? H : E, D = side === 'L' ? E : H;
          V.roles(side);
          let aCmd, dCmd;
          if (side === 'L') { aCmd = await this.heroCmd(p, b, 'atk', H, E); dCmd = this.enemyChoose(E, 'def'); }
          else { aCmd = this.enemyChoose(E, 'atk'); dCmd = await this.heroCmd(p, b, 'def', H, E); }
          const R = this.exchange(b, A, D, aCmd, dCmd);
          R._A = A;
          this.luckyCheck(H, R);
          await V.reveal(side, R, this.summary(A, D, R));
          if (R.surrender) { outcome = 'surrender'; break; }
          if (E.hp <= 0) { if (H.hp <= 0) H.hp = 1; outcome = 'win'; break; }
          if (H.hp <= 0) { outcome = 'lose'; break; }
        }
      }
      await this.conclude(b, p, outcome, V);
    } finally {
      this.active = false;
      V.close();
    }
  },

  async conclude(b, p, outcome, V) {
    const d = this.enemyDef(b);
    if (outcome === 'win') return this.victory(b, p, V);
    if (outcome === 'lose' || outcome === 'surrender') {
      const minion = b.armyKey === 'minion';
      this.removePart(b, p);
      let lost;
      if (outcome === 'lose') lost = Game.knockOut(p, { by: 'enemy', minion });
      else {
        lost = U.round(p.money * (minion ? 0.2 : 0.1));
        p.money -= lost;
        Game.giveUp(p);
        Game.log(`🏳️ ${p.name} gave up against the ${d.name}, lost ${lost} G, and needs ${U.plural(DATA.DOWN_TURNS, 'turn')} to stand up.`, p);
      }
      Sound.play('lose');
      const lines = [`−${lost} G${minion ? ' (Sticky Fingers!)' : ''}`];
      if (outcome === 'lose') lines.push(`Resurrecting at ${MapSys.spaceName(MapSys.spaces[p.respawnId], Game.state)}: skip ${DATA.DOWN_TURNS === 1 ? 'your next turn' : `the next ${DATA.DOWN_TURNS} turns`}.`);
      else lines.push(`HP unchanged. You stay here and need ${U.plural(DATA.DOWN_TURNS, 'turn')} to stand up.`);
      if (b.kind === 'army' && d.live.hp > 0) lines.push(`The ${d.name} keeps its wounds (${d.live.hp}/${d.live.maxHp} HP).`);
      await V.result({ type: outcome, title: outcome === 'lose' ? 'Defeat…' : 'Surrendered', lines, p });
      return;
    }
    Game.log(`⏳ ${p.name}'s battle with the ${d.name} will continue tomorrow.`, p);
    await V.result({ type: 'continue', title: 'To be continued', lines: ['The battle will continue on the next day.', `${d.name}: ${d.live.hp}/${d.live.maxHp} HP`], p });
  },

  async victory(b, p, V) {
    const s = Game.state, d = this.enemyDef(b), isArmy = b.kind === 'army';
    const lines = [];
    const exp = Game.expFrom(p, d.exp, d.lv);
    const money = Game.gainMoney(p, d.money, true);
    const lvBefore = p.level;
    Game.gainExp(p, exp);
    const jobBefore = p.jobExp[p.classId] || 0;
    const mastered = Game.gainJobExp(p, isArmy ? 2 : 1);
    const stars = isArmy ? d.stars : b.enemy.e04 ? 1 : 0;
    p.stars += stars;
    if (isArmy) p.record.army++; else p.record.monsters++;
    if (!isArmy || b.armyKey === 'minion') Game.track(p, 'kill');
    if (!isArmy) Game.track(p, 'killKey', 1, b.enemy.key);
    if (b.armyKey === 'minion') Game.track(p, 'minion');
    lines.push(`+${exp} EXP${p.level > lvBefore ? ` — Level ${p.level}! HP fully restored` : ''}`);
    lines.push(`+${money} G`);
    lines.push(mastered ? `🌟 ${Game.cls(p).name} mastered!` : `Job EXP ${Math.min(10, p.jobExp[p.classId] || jobBefore)}/10`);
    if (stars) lines.push(`+${stars} ⭐`);
    const drops = [];
    if (isArmy) { for (const dr of d.drops) if (U.chance(dr.chance)) drops.push(dr.id); }
    else if (d.drop && U.chance(d.drop.chance)) drops.push(d.drop.id);
    for (const id of drops) lines.push(`Drop: ${(DATA.ITEMS[id] || DATA.CHARMS[id]).icon} ${(DATA.ITEMS[id] || DATA.CHARMS[id]).name}`);
    const others = b.parts.filter(id => id !== p.id).map(id => Game.player(id));
    for (const o of others) {
      const e = U.round(Game.expFrom(o, d.exp, d.lv) * 0.5), m = Game.gainMoney(o, U.round(d.money * 0.5), true);
      Game.gainExp(o, e); Game.gainJobExp(o, isArmy ? 2 : 1); o.record.army++;
      lines.push(`${o.name} (ally): +${e} EXP, +${m} G`);
    }
    Game.log(`🏆 ${p.name} defeated the ${d.name}!${stars ? ` +${stars} ⭐` : ''}`, p);
    Sound.play('win');
    await V.result({ type: 'win', title: 'Victory!', lines, p, pose: { side: 'L', p } });   // before the enemy leaves the world state
    if (isArmy) {
      if (b.armyKey === 'minion') { s.minion = null; s.minionNextDay = s.day + DATA.MINION_RESPAWN_DAYS; }
      else {
        s.army[b.armyKey].defeated = true;
        if (b.armyKey === 'B04') s.dlDefeated = true;
      }
    }
    for (const id of b.parts) Game.player(id).battleId = null;
    b.parts = []; b.reserve = 0;
    this.dispose(b);
    for (const id of drops) {
      if (id === 'IQ01') { s.head.holder = p.id; Game.log(`💀 ${p.name} claimed the Demon Lord's Head!`, p); }
      else if (DATA.CHARMS[id]) await Game.addCharm(p, id);
      else await Game.addItem(p, id);
    }
    await Game.allocatePoints(p);
    for (const o of others) await Game.allocatePoints(o);
    // Spec §6: after the monster falls, the heroes still in the fight turn on each other.
    const rival = !isArmy && others.find(o => !o.down);
    if (rival) {
      const duel = this.create('duel', b.space, null, null);
      duel.firstId = null; duel.resume = null;
      this.addPart(duel, p, null); this.addPart(duel, rival, null);
      Game.log(`🤺 The fight goes on! ${p.name} and ${rival.name} now face each other.`, p);
      if (!Game.sim) UI.toast(`🤺 The fight goes on: ${p.name} vs ${rival.name}!`, 'info');
    }
    if (isArmy && b.armyKey !== 'minion' && !Game.sim && !(p.isBot && Game.skipping)) {
      if (b.armyKey === 'B04') await UI.dialogue([{ who: 'narrator', text: DATA.DIALOGUE.dlDefeated }, { who: 'system', text: "From now on every hero rolls 2 dice, and defeating another hero earns 1 ⭐. Bring the Demon Lord's Head to the Royal Castle!" }], { auto: p.isBot });
      else await UI.dialogue([{ who: 'villager', text: DATA.DIALOGUE.villager }], { auto: p.isBot });
    }
  },

  /* ================================================================ hero duels (spec §6.3)
   * 3 rounds per turn; if nobody falls, the duel continues on each duelist's next turn until one is
   * knocked out or gives up. opts.from = a monster/army fight the target is pulled out of (brawl):
   * the winner goes back into that fight afterwards. */
  async startDuel(att, def, opts) {
    const b = this.create('duel', def.spaceId, null, null);
    b.firstId = null; b.resume = null;
    if (opts && opts.from) {
      const M = opts.from;
      M.reserve = (M.reserve || 0) + 1;
      this.removePart(M, def);
      b.resume = M.id;
    }
    this.addPart(b, att, null); this.addPart(b, def, null);
    Game.log(`🤺 ${att.name} challenges ${def.name} to a duel!`, att);
    if (!def.isBot) Game.needHuman();
    await this.duelSession(b, att);
  },
  async duelSession(b, p) {
    const V = this.view(), s = Game.state;
    const other = Game.player(b.parts.find(id => id !== p.id));
    const left = !other.isBot ? other : p, right = left === p ? other : p;
    for (const h of [p, other]) { const m = b.mods[h.id]; if (h.buffs.energy) { m.energy = true; h.buffs.energy = false; } if (h.buffs.eater) { m.eater = true; h.buffs.eater = false; } }
    this.active = true;
    let result = null;
    try {
      const scene = () => ({
        zone: MapSys.spaces[b.space].zone, kind: 'duel',
        left: this.sceneHero(left, b), right: this.sceneHero(right, b), allies: [],
        leftCombatant: () => this.heroC(b, left), rightCombatant: () => this.heroC(b, right),
      });
      await V.open(scene, { humanInvolved: !left.isBot, duel: true });
      if (b.firstId == null) b.firstId = (await V.cards(!left.isBot)) ? left.id : right.id;
      const first = Game.player(b.firstId), second = first === left ? right : left;
      for (let r = 1; r <= DATA.ROUNDS_PER_DAY && !result; r++) {
        V.round(r, DATA.ROUNDS_PER_DAY);
        for (const [A, D] of [[first, second], [second, first]]) {
          const AC = this.heroC(b, A), DC = this.heroC(b, D);
          V.roles(A === left ? 'L' : 'R');
          const [aCmd, dCmd] = await Promise.all([this.heroCmd(A, b, 'atk', AC, DC), this.heroCmd(D, b, 'def', DC, AC)]);
          const R = this.exchange(b, AC, DC, aCmd, dCmd);
          R._A = AC;
          this.luckyCheck(AC, R); this.luckyCheck(DC, R);
          await V.reveal(A === left ? 'L' : 'R', R, this.summary(AC, DC, R));
          if (R.surrender) { result = { W: A, L: D, died: false }; break; }
          if (DC.hp <= 0) { result = { W: A, L: D, died: true }; break; }
          if (AC.hp <= 0) { result = { W: D, L: A, died: true }; break; }
        }
      }
      if (!result) {
        Game.log(`🤺 ${left.name} and ${right.name} are still fighting. The duel goes on!`, p);
        await V.result({ type: 'continue', title: 'The duel goes on!', lines: ['Nobody fell in 3 rounds.', 'The duel continues on the next turn until someone is knocked out or gives up.'], p: left });
        return;
      }
      const { W, L, died } = result;
      W.record.heroesBeaten++;
      const lines = [];
      if (W.level < L.level) { const e = 40 * (L.level - W.level); Game.gainExp(W, e); lines.push(`${W.name}: +${e} EXP (beat a higher-level hero)`); }
      if (s.dlDefeated) { W.stars++; lines.push(`${W.name}: +1 ⭐`); }
      if (s.head.holder === L.id) { s.head.holder = W.id; lines.push(`💀 ${W.name} takes the Demon Lord's Head!`); Game.log(`💀 ${W.name} took the Demon Lord's Head from ${L.name}!`, W); }
      for (const id of b.parts.slice()) Game.player(id).battleId = null;
      b.parts = [];
      this.dispose(b);
      if (died) { const lost = Game.knockOut(L, { by: 'hero', pid: W.id }); lines.push(`${L.name} is knocked out (−${lost} G) and resurrects after ${U.plural(DATA.DOWN_TURNS, 'turn')}.`); }
      else { Game.giveUp(L); lines.push(`${L.name} gave up and needs ${U.plural(DATA.DOWN_TURNS, 'turn')} to stand up.`); Game.log(`🏳️ ${L.name} gave up the duel against ${W.name}.`, L); }
      Game.log(`🏆 ${W.name} won the duel against ${L.name}!`, W);
      Game.track(W, 'duelWin');
      Sound.play(!W.isBot || L.isBot ? 'win' : 'lose');
      await V.result({ type: 'hero', title: `${W.name} wins!`, lines, winner: W, pose: { side: W === left ? 'L' : 'R', p: W } });
    } finally {
      this.active = false;
      V.close();
    }
    if (result) await this.afterDuel(b, result);
  },
  async afterDuel(b, result) {
    const { W, L } = result;
    const choice = await Game.who(W).stealChoice(W, L);
    await this.applySteal(W, L, choice);
    await Game.allocatePoints(W);
    const M = b.resume != null && Game.state.battles.find(x => x.id === b.resume);
    if (M) {
      M.reserve = Math.max(0, (M.reserve || 1) - 1);
      if (!W.down && !W.battleId) {
        this.addPart(M, W, 'hero');
        Game.log(`⚔️ The fight goes on: ${W.name} now faces the ${this.enemyDef(M).name}!`, W);
      } else if (!M.parts.length && !M.reserve) this.dispose(M);
    }
  },
  stealOptions(L) {
    const out = [{ type: 'money', amount: U.round(L.money * 0.2) }];
    for (const slot of ['weapon', 'armor', 'charm']) if (L.equip[slot]) out.push({ type: 'equip', slot, id: L.equip[slot] });
    L.items.forEach((id, idx) => out.push({ type: 'item', tab: 'items', idx, id }));
    L.books.forEach((id, idx) => out.push({ type: 'item', tab: 'books', idx, id }));
    return out;
  },
  async applySteal(W, L, c) {
    if (!c || c.type === 'money') {
      const amt = U.round(L.money * 0.2);
      L.money -= amt; W.money += amt;
      Game.log(`💰 ${W.name} took ${amt} G from ${L.name}.`, W);
      Sound.play('coin');
    } else if (c.type === 'equip') {
      const id = L.equip[c.slot];
      Game.setEquip(L, c.slot, null);
      if (c.equip) {
        const old = W.equip[c.slot];
        if (old && DATA.EQUIP[old]) W.money += Game.sellPrice(old);
        Game.setEquip(W, c.slot, id);
        Game.log(`🗡️ ${W.name} took and equipped ${L.name}'s ${DATA.GEAR[id].name}.`, W);
      } else Game.log(`🗑️ ${W.name} took ${L.name}'s ${DATA.GEAR[id].name} and threw it away.`, W);
    } else {
      const id = L[c.tab][c.idx];
      if (!id) return;
      L[c.tab].splice(c.idx, 1);
      Game.log(`🎒 ${W.name} took ${DATA.ITEMS[id].name} from ${L.name}.`, W);
      await Game.addItem(W, id);
    }
    if (!Game.sim) UI.refresh();
  },
};

/* Headless stand-in for the battle scene (simulation mode). */
const SimView = {
  async open() {}, round() {}, roles() {},
  async cards() { return U.chance(0.5); },
  async reveal() {}, async result() {}, close() {},
};

/* ==================================================================== BattleView: canvas scene + DOM HUD */
const BattleView = (() => {
  let el = null, scene = null, isOpen = false, opts = {};
  const fx = { lunge: {}, flash: {}, shake: null, floaters: [], particles: [], label: {} };
  const now = () => performance.now();
  const dur = ms => ms * Game.delayFactor();

  function $(sel) { return el.querySelector(sel); }
  /* The scene is read live from game state; keep the last good copy in case the enemy is gone. */
  let lastScene = null;
  function getScene() {
    try { lastScene = scene(); } catch (e) { if (!lastScene) throw e; }
    return lastScene;
  }
  function build() {
    el = document.getElementById('battle-hud');
    el.innerHTML = `
      <div class="bh-top">
        <div class="bh-side L"><div class="bh-head"><div class="lv-badge"></div><div class="bh-name"></div></div><div class="hpbar"><div class="fill"></div><span></span></div></div>
        <div class="bh-vs"><div class="vs-star">VS</div><div class="bh-round"></div></div>
        <div class="bh-side R"><div class="bh-head"><div class="lv-badge"></div><div class="bh-name"></div></div><div class="hpbar"><div class="fill"></div><span></span></div></div>
      </div>
      <div class="bh-allies"></div>
      <div class="bh-stats"></div>
      <button class="btn small bh-info" data-key="Z"><kbd>Z</kbd> Info</button>
      <div class="bh-role L"></div><div class="bh-role R"></div>
      <div class="bh-label L"></div><div class="bh-label R"></div>
      <div class="bh-cmd L"></div><div class="bh-cmd R enemy"></div>
      <div class="bh-wait">Waiting for opponent…</div>
      <div class="bh-summary"></div>
      <div class="bh-cards"></div>
      <div class="bh-result"></div>`;
    $('.bh-info').onclick = () => showInfo();
  }
  function sideData(side) { return side === 'L' ? getScene().left : getScene().right; }
  function refreshBars() {
    if (!el || !scene) return;
    const S = getScene();
    for (const side of ['L', 'R']) {
      const d = side === 'L' ? S.left : S.right, box = $(`.bh-side.${side}`);
      box.querySelector('.lv-badge').textContent = d.level;
      box.querySelector('.bh-name').textContent = d.name;
      const pct = Math.max(0, d.hp / d.maxHp * 100);
      const f = box.querySelector('.fill');
      f.style.width = pct + '%';
      f.classList.toggle('low', pct < 25);
      box.querySelector('.hpbar span').textContent = `${d.hp} / ${d.maxHp}`;
    }
    const st = $('.bh-stats');
    st.innerHTML = ['at', 'df', 'sp'].map(k => {
      const a = S.left[k], b = S.right[k], m = Math.max(a, b, 1);
      return `<div class="st-row"><span>${a}</span><div class="st-bar L"><i style="width:${a / m * 100}%"></i></div><b>${k.toUpperCase()}</b><div class="st-bar R"><i style="width:${b / m * 100}%"></i></div><span>${b}</span></div>`;
    }).join('');
    $('.bh-allies').innerHTML = S.allies.map(a => `<div class="ally"><img src="${Sprites.portrait('hero', a.draw, 48)}"><div><div class="ally-name">${U.esc(a.name)}</div><div class="hpbar mini"><div class="fill${a.hp / a.maxHp < 0.25 ? ' low' : ''}" style="width:${a.hp / a.maxHp * 100}%"></div></div></div></div>`).join('');
  }
  function showInfo() {
    const S = getScene();
    const html = S.right.info
      ? `<p><b>Lv ${S.right.level} ${U.esc(S.right.name)}</b> — HP ${S.right.hp}/${S.right.maxHp} · AT ${S.right.at} · DF ${S.right.df} · SP ${S.right.sp}</p><ul class="info-list">${S.right.info.map(l => `<li>${l}</li>`).join('')}</ul>`
      : heroInfo(S.right);
    UI.modal({ title: 'Enemy Info', html, buttons: [{ label: 'Close', key: 'Enter', value: true }], closable: true });
  }
  function heroInfo(d) {
    const p = Game.player(d.pid), c = Game.cls(p);
    return `<p><b>Lv ${p.level} ${U.esc(p.name)}</b> — ${c.name}<br>HP ${p.hp}/${d.maxHp} · AT ${d.at} · DF ${d.df} · SP ${d.sp}</p>
      <ul class="info-list"><li><b>${c.passive.name}</b>: ${c.passive.text}</li><li><b>${c.move.name}</b> (CD ${c.move.cd}): ${c.move.text}</li>
      <li>Special: ${p.special ? DATA.SKILLS[p.special].name : '—'} · Special Defense: ${p.specialDef ? DATA.SKILLS[p.specialDef].name : '—'}</li></ul>`;
  }

  function diamond(container, role, cmds, combatant, enabled) {
    container.innerHTML = '';
    container.classList.toggle('active', !!enabled);
    for (const cmd of ROLE_CMDS[role]) {
      const info = CMD_INFO[cmd], st = cmds ? cmds[cmd] : { ok: false };
      const b = document.createElement('button');
      b.className = `dia dia-${info.key}`;
      const name = combatant && st.ok !== false && (cmd === 'special' || cmd === 'classMove' || cmd === 'specialDef')
        ? Battle.cmdName(combatant, cmd) : (cmd === 'special' && combatant && combatant.special ? combatant.special.name
          : cmd === 'classMove' && combatant && combatant.classMove ? combatant.classMove.name
            : cmd === 'specialDef' && combatant && combatant.specialDef ? combatant.specialDef.name : info.label);
      b.innerHTML = `<span><kbd>${info.key}</kbd><em>${info.icon}</em><small>${U.esc(name)}</small>${st.cd ? `<i class="cd">${st.cd}d</i>` : ''}</span>`;
      b.dataset.cmd = cmd;
      if (!enabled || !st.ok) { b.classList.add('off'); if (enabled && st.reason) b.title = st.reason; }
      container.appendChild(b);
    }
  }

  function spawnFloat(side, text, color, big) {
    const d = geom();
    const x = side === 'L' ? d.lx : d.rx;
    fx.floaters.push({ x: x + U.randInt(-20, 20), y: d.gy - d.hTop(side) - 10, text, color, big, start: now(), dur: Math.max(500, dur(1100)) });
  }
  function burst(side, color, n) {
    const d = geom(), x = side === 'L' ? d.lx : d.rx, y = d.gy - d.hTop(side) * 0.5;
    for (let i = 0; i < (n || 18); i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.7 + Math.random() * 0.4, age: 0, color, size: 3 + Math.random() * 5 });
    }
  }

  let W = 800, H = 600;
  function geom() {
    const s = Math.min(W, H * 1.6) / 1000;
    const S = scene ? getScene() : null;
    const heroScale = s * 3.1;
    const monH = S && S.right.draw.type === 'monster' ? (Sprites.MON_H[S.right.draw.key] || 70) : 64;
    const targetH = S && S.right.draw.big ? 300 : S && S.right.draw.key === 'minion' ? 190 : 220;
    const monScale = S && S.right.draw.type === 'monster' ? Math.min(s * targetH / monH, s * 4.5) : heroScale;
    return {
      lx: W * 0.28, rx: W * 0.72, gy: H * 0.74, heroScale, monScale, s,
      hTop: side => (side === 'L' || !S || S.right.draw.type !== 'monster' ? 64 * heroScale : monH * monScale),
    };
  }

  function drawBackground(c, S, t) {
    const z = S.zone, boss = S.boss;
    const sky = boss ? ['#1a0a14', '#4a1020'] : z === 1 ? ['#6ec3ff', '#c9ecff'] : z === 2 ? ['#1d4a2e', '#5f9a5a'] : z === 3 ? ['#ff9a4a', '#ffe0a0'] : ['#2a0f3a', '#8a2a3a'];
    let g = c.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const hz = H * 0.6;
    if (boss) {
      for (let i = 0; i < 6; i++) {
        const x = (i + 0.5) * W / 6;
        c.fillStyle = '#2a1a24'; c.fillRect(x - W * 0.025, 0, W * 0.05, hz);
        c.fillStyle = '#8e1328'; c.fillRect(x - W * 0.018, H * 0.08, W * 0.036, H * 0.22);
        Sprites.glow(c, x, H * 0.36, 30 + Math.sin(t * 8 + i) * 4, '#ff8a2a', 0.8);
      }
    } else if (z === 1) {
      c.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 4; i++) { const x = ((t * 12 + i * 300) % (W + 300)) - 150; Sprites.ell(c, x, H * (0.12 + i * 0.05), 60, 18); c.fill(); }
      // distant hazy castle on the horizon
      const cx = W * 0.5, cw = Math.min(W, H) * 0.16, ch = cw * 0.55;
      c.fillStyle = '#b9cfe0';
      c.fillRect(cx - cw / 2, hz - ch * 0.9, cw, ch * 0.9);
      [[-0.5, 1.35], [0, 1.7], [0.5, 1.35]].forEach(([o, k]) => {
        const tx = cx + o * cw, tw = cw * 0.2;
        c.fillRect(tx - tw / 2, hz - ch * k, tw, ch * k);
        Sprites.poly(c, [tx - tw * 0.7, hz - ch * k, tx, hz - ch * k - tw * 1.3, tx + tw * 0.7, hz - ch * k]); c.fill();
      });
      c.fillStyle = '#7fcf5a'; c.beginPath(); c.moveTo(0, hz); for (let x = 0; x <= W; x += 40) c.lineTo(x, hz - 30 - Math.sin(x * 0.01) * 25); c.lineTo(W, hz); c.fill();
    } else if (z === 2) {
      for (let i = 0; i < 9; i++) { const x = (i / 8) * W; c.fillStyle = i % 2 ? '#123a22' : '#18462a'; c.fillRect(x - 18, 0, 36, hz); Sprites.circ(c, x, H * 0.1, 90); c.fill(); }
      for (let i = 0; i < 14; i++) Sprites.glow(c, (i * 137 + Math.sin(t + i) * 30) % W, H * 0.2 + ((i * 71) % (H * 0.4)), 8, '#ffff8a', 0.5 + Math.sin(t * 3 + i) * 0.3);
    } else if (z === 3) {
      Sprites.glow(c, W * 0.75, H * 0.18, 90, '#fff2a0', 0.9);
      c.fillStyle = '#e2b86a'; Sprites.poly(c, [W * 0.12, hz, W * 0.24, hz - H * 0.22, W * 0.36, hz]); c.fill();
      c.fillStyle = '#d4a85a'; Sprites.poly(c, [W * 0.3, hz, W * 0.37, hz - H * 0.12, W * 0.44, hz]); c.fill();
      c.fillStyle = '#f0c882'; c.beginPath(); c.moveTo(0, hz); for (let x = 0; x <= W; x += 40) c.lineTo(x, hz - 18 - Math.sin(x * 0.008 + 1) * 16); c.lineTo(W, hz); c.fill();
    } else {
      c.fillStyle = '#1a0f22'; c.beginPath(); c.moveTo(0, hz);
      for (let x = 0; x <= W; x += 60) c.lineTo(x, hz - 40 - ((x * 7919) % 120)); c.lineTo(W, hz); c.fill();
      for (let i = 0; i < 16; i++) { const y = (H - ((t * 40 + i * 53) % H)); c.fillStyle = `rgba(255,${100 + i * 5},40,.7)`; c.fillRect((i * 131) % W, y, 3, 3); }
    }
    const ground = boss ? ['#3a1a24', '#1a0a10'] : z === 1 ? ['#6fbf4f', '#3f8a2f'] : z === 2 ? ['#3a6a32', '#1f3f1d'] : z === 3 ? ['#e8c27a', '#c99a50'] : ['#3a2a44', '#1a1020'];
    g = c.createLinearGradient(0, hz, 0, H);
    g.addColorStop(0, ground[0]); g.addColorStop(1, ground[1]);
    c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(W / 2 + i * 40, hz); c.lineTo(W / 2 + i * 260, H); c.stroke(); }
    if (boss) { c.fillStyle = '#6b0f14'; Sprites.poly(c, [W * 0.44, hz, W * 0.56, hz, W * 0.7, H, W * 0.3, H]); c.fill(); }
  }

  function drawFighter(c, d, x, y, scale, facing, side, t) {
    const T = now();
    let dx = 0;
    const L = fx.lunge[side];
    if (L) { const f = (T - L.start) / L.dur; if (f >= 1) delete fx.lunge[side]; else dx = Math.sin(f * Math.PI) * L.dist; }
    const F = fx.flash[side];
    let flash = false;
    if (F) { const f = (T - F.start) / F.dur; if (f >= 1) delete fx.flash[side]; else flash = Math.floor(f * 8) % 2 === 0; }
    const X = x + dx * (side === 'L' ? 1 : -1);
    const hurt = !!F;
    Sprites.shadow(c, X, y, 60 * scale / 3, 16 * scale / 3, 0.3);
    c.save();
    if (flash) c.globalAlpha = 0.45;
    const won = fx.victory && fx.victory.side === side;
    if (d.draw.type === 'hero') Sprites.drawHero(c, X, y, scale, Object.assign({ t, facing, pose: won ? 'victory' : L ? 'attack' : hurt ? 'hurt' : 'idle' }, d.draw));
    else Sprites.drawMonster(c, d.draw.key, X, y, scale, { t, facing: -facing, form: d.draw.form, hurt });
    c.restore();
  }

  function render(c, w, h, t, dt) {
    W = w; H = h;
    if (!scene) return;
    const S = getScene();
    c.save();
    if (fx.shake) { const f = (now() - fx.shake.start) / fx.shake.dur; if (f >= 1) fx.shake = null; else c.translate((Math.random() - 0.5) * fx.shake.amp * (1 - f), (Math.random() - 0.5) * fx.shake.amp * (1 - f)); }
    drawBackground(c, S, t);
    const g = geom();
    S.allies.forEach((a, i) => drawFighter(c, a, W * 0.1 + i * W * 0.07, g.gy - H * 0.1, g.heroScale * 0.7, 1, 'A' + i, t + i));
    drawFighter(c, S.left, g.lx, g.gy, g.heroScale, 1, 'L', t);
    drawFighter(c, S.right, g.rx, g.gy, S.right.draw.type === 'monster' ? g.monScale : g.heroScale, -1, 'R', t);
    for (const p of fx.particles) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt;
      c.globalAlpha = Math.max(0, 1 - p.age / p.life); c.fillStyle = p.color; c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
    fx.particles = fx.particles.filter(p => p.age < p.life);
    const T = now();
    fx.floaters = fx.floaters.filter(f => T - f.start < f.dur);
    for (const f of fx.floaters) {
      const k = (T - f.start) / f.dur;
      const bounce = Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * 36;
      c.font = `900 ${f.big ? 44 : 30}px system-ui,sans-serif`; c.textAlign = 'center';
      c.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
      c.lineWidth = 6; c.strokeStyle = '#2b1a0e'; c.strokeText(f.text, f.x, f.y - bounce - k * 30);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - bounce - k * 30);
      c.globalAlpha = 1;
    }
    c.restore();
  }

  function setLabel(side, text, cls) {
    const l = $(`.bh-label.${side}`);
    l.textContent = text || '';
    l.className = `bh-label ${side} ${text ? 'show' : ''} ${cls || ''}`;
  }

  return {
    render,
    get isOpen() { return isOpen; },
    async open(sceneFn, o) {
      scene = sceneFn; lastScene = null; opts = o || {}; isOpen = true;
      fx.floaters = []; fx.particles = []; fx.lunge = {}; fx.flash = {}; fx.victory = null;
      build();
      document.getElementById('toast-root').innerHTML = '';
      el.classList.add('show');
      $('.bh-summary').textContent = '';
      UI.setScene('battle');
      Sound.music(getScene().boss ? 'boss' : 'battle');
      const S = getScene();
      diamond($('.bh-cmd.L'), 'atk', null, null, false);
      diamond($('.bh-cmd.R'), 'def', null, null, false);
      $('.bh-cmd.L').classList.toggle('hidden', !S.left.isHuman);
      $('.bh-cmd.R').classList.toggle('hidden', !S.left.isHuman);
      refreshBars();
      await Game.wait(500);
    },
    round(r, max) { if (el) $('.bh-round').textContent = `Round ${r} / ${max}`; },
    roles(att) {
      if (!el) return;
      for (const side of ['L', 'R']) {
        const r = $(`.bh-role.${side}`);
        r.textContent = side === att ? 'Attacker' : 'Defender';
        r.className = `bh-role ${side} ${side === att ? 'atk' : 'def'}`;
      }
    },
    /* Face-down card game: returns true when the LEFT side attacks first. */
    async cards(humanPicks) {
      const box = $('.bh-cards');
      const goFirst = U.randInt(0, 1);
      box.innerHTML = `<div class="cards-title">${humanPicks ? 'Pick a card! <kbd>A</kbd>/<kbd>D</kbd> + <kbd>Enter</kbd>' : 'Drawing cards…'}</div>
        <div class="cards-row"><div class="card" data-i="0"><div class="back">?</div><div class="face"></div></div><div class="card" data-i="1"><div class="back">?</div><div class="face"></div></div></div>`;
      box.classList.add('show');
      Sound.play('card');
      const cards = [...box.querySelectorAll('.card')];
      let sel = 0;
      const mark = () => cards.forEach((c, i) => c.classList.toggle('sel', i === sel));
      let pick;
      if (humanPicks) {
        Game.needHuman();
        mark();
        pick = await new Promise(res => {
          cards.forEach((c, i) => { c.onclick = () => { sel = i; mark(); res(i); }; });
          UI.pushKeys(e => {
            if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { sel = 0; mark(); Sound.play('select'); return true; }
            if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { sel = 1; mark(); Sound.play('select'); return true; }
            if (e.key === 'Enter' || e.key === ' ') { res(sel); return true; }
            return false;
          }, 'cards');
        });
        UI.popKeys('cards');
      } else { await Game.wait(500); pick = U.randInt(0, 1); sel = pick; mark(); }
      cards.forEach((c, i) => {
        c.querySelector('.face').innerHTML = i === goFirst ? '<b>Go First</b><span>⚡</span>' : '<b>Go Second</b><span>🛡️</span>';
        c.classList.add('flip', i === goFirst ? 'gold' : 'plain');
      });
      Sound.play('diceStop');
      const leftFirst = pick === goFirst;
      const S = getScene();
      $('.bh-summary').textContent = `${leftFirst ? S.left.name : S.right.name} attacks first!`;
      await Game.wait(1100);
      box.classList.remove('show');
      return leftFirst;
    },
    /* Human command pick for `role` ('atk' | 'def'). The human is always on the left. */
    async choose(role, cmds, self) {
      Game.needHuman();
      const box = $('.bh-cmd.L');
      diamond(box, role, cmds, self, true);
      diamond($('.bh-cmd.R'), role === 'atk' ? 'def' : 'atk', null, null, false);
      $('.bh-cmd.R').classList.remove('hidden'); box.classList.remove('hidden');
      $('.bh-summary').textContent = role === 'atk' ? 'Your attack! Choose a command.' : 'Enemy attacks! Choose your defense.';
      const cmd = await new Promise(res => {
        const tryPick = c => {
          const st = cmds[c];
          if (!st.ok) { UI.toast(st.reason || 'Not available.', 'bad'); Sound.play('error'); return; }
          Sound.play('click'); res(c);
        };
        box.querySelectorAll('.dia').forEach(b => { b.onclick = () => tryPick(b.dataset.cmd); });
        UI.pushKeys(e => {
          const k = e.key.toUpperCase();
          const map = { W: 0, A: 1, D: 2, S: 3, ARROWUP: 0, ARROWLEFT: 1, ARROWRIGHT: 2, ARROWDOWN: 3 };
          if (k in map) { tryPick(ROLE_CMDS[role][map[k]]); return true; }
          if (k === 'Z') { showInfo(); return true; }
          return false;
        }, 'cmd');
      });
      UI.popKeys('cmd');
      diamond(box, role, cmds, self, false);
      box.querySelector(`[data-cmd="${cmd}"]`).classList.add('picked');
      $('.bh-wait').classList.add('show');
      await U.sleep(350);
      $('.bh-wait').classList.remove('show');
      return cmd;
    },
    async reveal(attSide, R, text) {
      const defSide = attSide === 'L' ? 'R' : 'L';
      setLabel(attSide, `${CMD_INFO[R.aCmd].icon} ${R.aName}`, 'atk');
      setLabel(defSide, `${CMD_INFO[R.dCmd].icon} ${R.dName}`, 'def');
      await Game.wait(650);
      const isMove = R.aCmd === 'special' || R.aCmd === 'classMove';
      if (R.surrender) { Sound.play('miss'); }
      else if (R.countered) {
        fx.lunge[attSide] = { start: now(), dur: dur(300), dist: W * 0.18 };
        await Game.wait(200);
        fx.lunge[defSide] = { start: now(), dur: dur(300), dist: W * 0.12 };
        await Game.wait(150);
      } else {
        fx.lunge[attSide] = { start: now(), dur: dur(360), dist: isMove ? W * 0.06 : W * 0.3 };
        if (isMove) { Sound.play('magic'); burst(attSide, '#bfefff', 14); }
        await Game.wait(isMove ? 350 : 180);
      }
      for (const ev of R.events) {
        const side = ev.to === 'A' ? attSide : defSide;
        if (ev.heal) { spawnFloat(side, `+${ev.heal}`, '#6dff8a'); Sound.play('heal'); burst(side, '#6dff8a', 10); }
        else {
          const crit = /CRIT|STING|POISON|REFLECT|COUNTER/.test(ev.tag);
          if (ev.dmg > 0) {
            fx.flash[side] = { start: now(), dur: dur(420) };
            fx.shake = { start: now(), dur: dur(crit ? 380 : 220), amp: crit ? 22 : 10 };
            burst(side, isMove ? '#ffd36a' : '#ffffff', crit ? 26 : 14);
            Sound.play(crit ? 'crit' : 'hit');
          } else Sound.play(ev.tag === 'BLOCKED' ? 'block' : 'miss');
          spawnFloat(side, ev.dmg > 0 ? String(ev.dmg) : (ev.tag || '0'), ev.dmg > 0 ? (side === 'L' ? '#ff6b5b' : '#fff2a8') : '#cfd8e0', crit);
          if (ev.tag && ev.dmg > 0) setTimeout(() => spawnFloat(side, ev.tag, '#ffd36a'), 120);
        }
        refreshBars();
        await Game.wait(320);
      }
      $('.bh-summary').textContent = text;
      refreshBars();
      await Game.wait(900);
      setLabel('L', ''); setLabel('R', '');
    },
    async result(info) {
      refreshBars();
      if (Game.skipping && !(info.p && !info.p.isBot)) return;
      let poseLine = '';
      if (info.pose) {
        // Per-class victory pose: the winner hops with their signature move and emoji burst.
        const w = info.pose.p, cls = w.classId;
        fx.victory = { side: info.pose.side };
        for (let i = 0; i < 6; i++) setTimeout(() => spawnFloat(info.pose.side, Sprites.VICTORY_FX[cls], '#fff'), i * dur(160));
        poseLine = `${w.name} ${DATA.CLASSES[cls].victory}`;
        await Game.wait(1300);
      }
      const box = $('.bh-result');
      const good = info.type === 'win' || (info.type === 'hero' && info.winner && !info.winner.isBot);
      box.innerHTML = `<div class="res-card ${good ? 'good' : info.type === 'continue' || info.type === 'draw' ? 'neutral' : 'bad'}">
        <h2>${U.esc(info.title)}</h2>${poseLine ? `<p class="pose-line">${U.esc(poseLine)}</p>` : ''}<ul>${info.lines.map(l => `<li>${U.esc(l)}</li>`).join('')}</ul>
        <button class="btn primary"><kbd>Enter</kbd> Continue</button></div>`;
      box.classList.add('show');
      const humanView = !!(scene && getScene().left.isHuman);
      await new Promise(res => {
        let done = false;
        const finish = () => { if (done) return; done = true; UI.popKeys('result'); res(); };
        box.querySelector('button').onclick = finish;
        UI.pushKeys(e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { finish(); return true; } return false; }, 'result');
        if (!humanView) Game.wait(1800).then(finish, finish);
      });
      box.classList.remove('show');
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      if (el) { el.classList.remove('show'); UI.popKeys('cmd'); UI.popKeys('cards'); UI.popKeys('result'); }
      scene = null;
      if (Game.state) { UI.setScene('board'); Sound.music('board'); UI.refresh(); }
    },
  };
})();
