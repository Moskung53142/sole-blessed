#!/usr/bin/env node
/* Sole Blessed — rule checks against docs/project_spec.md. Usage: node tools/test-rules.js */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
global.UI = {};
for (const f of ['util', 'data', 'save', 'audio', 'sprites', 'map', 'game', 'battle', 'bot']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: `js/${f}.js` });
}
/* global Game, Battle, DATA, MapSys, U */
Game.sim = true;

let passed = 0, failed = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { passed++; return; }
  failed++; console.log(`✗ ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
/* Deterministic randomness: every chance() fails unless forced. */
function withRandom(value, fn) { const r = Math.random; Math.random = () => value; try { return fn(); } finally { Math.random = r; } }
function fresh(classId, rules) {
  Game.state = Game.newState({ name: 'Tester', gender: 'f', classId: classId || 'slingshot' }, rules);
  return Game.state.players[0];
}
function wolfBattle(p) {
  const b = Battle.create('monster', p.spaceId, null, { key: 'wolf', mult: 1, e04: false, hp: 9999, maxHp: 9999, specialDay: 0 });
  Battle.addPart(b, p, 'hero');
  return b;
}

(async () => {
  /* ---- map (spec §7) ---- */
  const counts = {}; MapSys.list.forEach(s => { counts[s.zone] = (counts[s.zone] || 0) + 1; });
  eq('zone space counts 48/60/78/65', counts, { 1: 48, 2: 60, 3: 78, 4: 65 });
  eq('cross-zone link 1-B01—2-e01', MapSys.spaces['1-B01'].links.includes('2-e01'), true);
  eq('cross-zone link 3-B03—4-e01', MapSys.spaces['3-B03'].links.includes('4-e01'), true);
  eq('whole map connected', Object.keys(MapSys.bfs('1-L01').dist).length, MapSys.list.length);

  /* ---- exact-step movement (spec §3.2) ---- */
  fresh();
  const blk = id => Game.isBlocking(id);
  const mv = MapSys.exactMoves(['1-L01'], 4, blk);
  eq('every route is exactly the roll', [...mv.ends.values()].every(r => r.length === 5 || blk(r[r.length - 1])), true);
  eq('routes never revisit a space', [...mv.ends.values()].every(r => new Set(r).size === r.length), true);
  eq('start space is never a destination', mv.ends.has('1-L01'), false);
  const toBoss = MapSys.exactMoves(['1-e34'], 5, blk);
  eq('stepping onto a General stops the move early', toBoss.ends.has('1-B01') && toBoss.ends.get('1-B01').length, 2);

  /* ---- damage table (spec §6.2) ---- */
  {
    const p = fresh('slingshot');                            // AT 5
    const b = wolfBattle(p);
    const H = () => Battle.heroC(b, p), E = () => Battle.enemyC(b);
    const base = Math.max(1, 5 * 2 - DATA.MONSTERS.wolf.df);
    withRandom(0.99, () => {
      let R = Battle.exchange(b, H(), E(), 'attack', 'defend'); eq('Attack vs Defend = ×0.5', R.toD, U.round(base * 0.5));
      R = Battle.exchange(b, H(), E(), 'attack', 'counter'); eq('Attack vs Counter = ×1.5', R.toD, U.round(base * 1.5));
      R = Battle.exchange(b, H(), E(), 'strike', 'defend'); eq('Strike vs Defend = ×2', R.toD, base * 2);
      p.hp = 30;
      R = Battle.exchange(b, H(), E(), 'strike', 'counter');
      eq('Strike vs Counter: defender takes 0', R.toD, 0);
      eq('Strike vs Counter: attacker takes defender base ×1.5', R.toA, U.round(Math.max(1, DATA.MONSTERS.wolf.at * 2 - 3) * 1.5));
      p.hp = 30; p.cd.classMove = 0;
      R = Battle.exchange(b, H(), E(), 'classMove', 'defend');
      eq('Class move ignores Defend (Rubber Band Shot = Base×1.5 + SP)', R.toD, U.round(base * 1.5 + 5));
      eq('Class move sets its cooldown', p.cd.classMove, 2);
    });
  }
  /* ---- cooldowns count days, including the day used ---- */
  {
    const p = fresh();
    Game.state.day = 5; p.cd.classMove = 2;
    await Game.endOfDay(); eq('CD after end of day 5', p.cd.classMove, 1);
    await Game.endOfDay(); eq('CD after end of day 6 (usable day 7)', p.cd.classMove, 0);
  }
  /* ---- magic classes use SP ---- */
  {
    const p = fresh('shaman');
    const b = wolfBattle(p);
    eq('Shaman SP includes passive', Game.stat(p, 'sp'), 6);
    eq('Magic base = SP×2 − DF', Battle.base(Battle.heroC(b, p), Battle.enemyC(b)), 6 * 2 - DATA.MONSTERS.wolf.df);
  }
  /* ---- stats: passives and percentage charms ---- */
  {
    eq('Commoner AT +20%', Game.stat(fresh('commoner'), 'at'), 6);
    const p = fresh('commoner'); p.classId = 'warlord';
    eq('Warlord AT +50% (7.5 rounds up)', Game.stat(p, 'at'), 8);
    const q = fresh('slingshot'); q.base.at = 40; q.equip.charm = 'C01';
    eq('Boar Fang charm: AT +10%', Game.stat(q, 'at'), 44);
  }
  /* ---- EXP & level-ups (spec §4) ---- */
  {
    const p = fresh();
    eq('EXP multiplier 1 + 0.1×(enemy − player)', Game.expFrom(p, 25, 3), U.round(25 * 1.2));
    eq('EXP multiplier capped at 2', Game.expFrom(p, 100, 40), 200);
    p.level = 20;
    eq('EXP multiplier floored at 0.5', Game.expFrom(p, 100, 1), 50);
    const q = fresh('commoner');
    q.hp = 3;
    Game.gainExp(q, 10);
    eq('10 EXP reaches level 2', q.level, 2);
    eq('Level-up HP +10 base +10 class (Commoner)', Game.maxHp(q), 50);
    eq('Level-up restores full HP', q.hp, 50);
    eq('Level-up grants 2 free points', q.freePts, 2);
    Game.gainExp(q, 25);
    eq('Excess EXP carries over', [q.level, q.exp], [3, 5]);
    Game.gainExp(q, 1e7);
    eq('Max level 50', q.level, 50);
  }
  /* ---- mastery ---- */
  {
    const p = fresh('commoner');
    for (let i = 0; i < 10; i++) Game.gainJobExp(p, 1);
    eq('10 Job EXP masters the class', p.mastered, ['commoner']);
    eq('Mastery unlocks Tier 2', p.unlocked.includes('warlord'), true);
    p.spaceId = '1-e03';
    eq('Class change is refused outside castle/temple', Game.changeClass(p, 'warlord'), false);
    p.spaceId = '1-L01';
    eq('Class change works at the Royal Castle', Game.changeClass(p, 'warlord'), true);
  }
  /* ---- KO & give up: 2 turns down (spec §6) ---- */
  {
    const p = fresh(); Game.state.phase = 'between';
    p.money = 1000; p.spaceId = '1-e03'; Game.state.head.holder = p.id;
    Game.knockOut(p, { by: 'enemy' });
    eq('KO loses 10% money', p.money, 900);
    eq('KO by enemy drops the head on the space', Game.state.head, { holder: null, space: '1-e03' });
    eq('KO respawns at respawn point', p.spaceId, '1-L01');
    eq('KO rests for 2 turns', [p.down, p.downReason], [2, 'ko']);
    await Game.playTurn(); eq('rest turn 1 is skipped', p.down, 1);
    await Game.playTurn(); eq('rest turn 2 is skipped', p.down, 0);
    const q = fresh(); Game.giveUp(q);
    eq('Give up rests for 2 turns', [q.down, q.downReason], [2, 'giveup']);
    eq('Resting heroes cannot be challenged', Game.canBeChallenged(q), false);
  }
  /* ---- no fights inside buildings; minion never stops on a building (spec §6, §9) ---- */
  {
    const s = fresh().constructor && Game.state;
    const p = s.players[0];
    p.spaceId = '1-L02';
    eq('Heroes in a building cannot be challenged', Game.canBeChallenged(p), false);
    s.players.forEach(o => { if (o !== p) o.spaceId = '4-e53'; });
    s.minion = { zone: 1, spaceId: '1-e03', hp: 10, maxHp: 10, cd: { special: 0, specialDef: 0 } };
    p.spaceId = '1-L01';
    for (let i = 0; i < 20; i++) await Game.minionMove();
    eq('Minion never ends on a building', MapSys.spaces[s.minion.spaceId].type !== 'L', true);
  }
  /* ---- duels persist until KO / give up (spec §6.3) ---- */
  {
    const s = fresh('commoner').constructor && Game.state;
    const [a, b] = s.players;
    for (const h of [a, b]) { h.isBot = true; h.base.hp = 5000; h.hp = 5000; h.spaceId = '1-e05'; }
    await Battle.startDuel(a, b, {});
    const duel = s.battles.find(x => x.kind === 'duel');
    eq('Unfinished duel stays open', !!duel && duel.parts.length, 2);
    eq('Both duelists are locked', a.battleId === duel.id && b.battleId === duel.id, true);
  }
  /* ---- rules ---- */
  {
    fresh();
    eq('Default game length is 140 days', Game.maxDays(), 140);
    fresh(null, { days: 0 });
    eq('Endless mode', Game.endless(), true);
  }
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
