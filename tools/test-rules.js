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

function fresh(classId) {
  Game.state = Game.newState({ name: 'Tester', gender: 'f', classId: classId || 'slingshot' });
  return Game.state.players[0];
}
/* A monster battle against a Hungry Wolf (AT 6, DF 1) with the hero at the given stats. */
function wolfBattle(p) {
  const b = Battle.create('monster', p.spaceId, null, { key: 'wolf', mult: 1, e04: false, hp: 999, maxHp: 999, specialDay: 0 });
  Battle.addPart(b, p, 'hero');
  return b;
}

/* ---- map (spec §7) ---- */
const counts = {}; MapSys.list.forEach(s => { counts[s.zone] = (counts[s.zone] || 0) + 1; });
eq('zone space counts 21/24/21/25', counts, { 1: 21, 2: 24, 3: 21, 4: 25 });
eq('cross-zone link 1-B01—2-e01', MapSys.spaces['1-B01'].links.includes('2-e01'), true);
eq('B04 blocks the road to 4-L03', MapSys.reachable('4-e09', 6, id => id === '4-B04').has('4-L03'), false);
eq('can stop on a blocking space', MapSys.reachable('4-e09', 6, id => id === '4-B04').has('4-B04'), true);

/* ---- damage table (spec §6.2) ---- */
{
  const p = fresh('slingshot');              // AT 5 (Keen Eyes crit only on a successful 20% roll)
  const b = wolfBattle(p);
  const H = () => Battle.heroC(b, p), E = () => Battle.enemyC(b);
  const base = Math.max(1, 5 * 2 - 1);       // AT×2 − DF = 9
  withRandom(0.99, () => {
    let R = Battle.exchange(b, H(), E(), 'attack', 'defend'); eq('Attack vs Defend = ×0.5', R.toD, U.round(base * 0.5));
    R = Battle.exchange(b, H(), E(), 'attack', 'counter'); eq('Attack vs Counter = ×1.5', R.toD, U.round(base * 1.5));
    R = Battle.exchange(b, H(), E(), 'strike', 'defend'); eq('Strike vs Defend = ×2', R.toD, base * 2);
    p.hp = 30;
    R = Battle.exchange(b, H(), E(), 'strike', 'counter');
    eq('Strike vs Counter: defender takes 0', R.toD, 0);
    eq('Strike vs Counter: attacker takes defender base ×1.5', R.toA, U.round(Math.max(1, 6 * 2 - 3) * 1.5));
    p.hp = 30; p.cd.classMove = 0;
    R = Battle.exchange(b, H(), E(), 'classMove', 'defend');
    eq('Class move ignores Defend (Rubber Band Shot = Base×1.5 + SP)', R.toD, U.round(base * 1.5 + 5));
    eq('Class move sets its cooldown', p.cd.classMove, 2);
  });
}
/* ---- cooldowns count days, including the day used (CD 2 used on day 5 → available on day 7) ---- */
async function cooldownTest() {
  const p = fresh();
  Game.state.day = 5; p.cd.classMove = 2;
  await Game.endOfDay(); eq('CD after end of day 5', p.cd.classMove, 1);
  await Game.endOfDay(); eq('CD after end of day 6 (usable day 7)', p.cd.classMove, 0);
}
/* ---- magic classes use SP for base damage ---- */
{
  const p = fresh('shaman');                 // SP 5 ×1.2 (Novice Caster) = 6
  const b = wolfBattle(p);
  eq('Shaman SP includes passive', Game.stat(p, 'sp'), 6);
  eq('Magic base = SP×2 − DF', Battle.base(Battle.heroC(b, p), Battle.enemyC(b)), 6 * 2 - 1);
}
/* ---- passives on displayed stats ---- */
{
  eq('Commoner AT +20%', Game.stat(fresh('commoner'), 'at'), 6);
  const p = fresh('commoner'); p.classId = 'warlord';
  eq('Warlord AT +50% (7.5 rounds up)', Game.stat(p, 'at'), 8);
}
/* ---- EXP (spec §4) ---- */
{
  const p = fresh();
  eq('EXP multiplier 1 + 0.1×(enemy − player)', Game.expFrom(p, 25, 3), U.round(25 * 1.2));
  eq('EXP multiplier capped at 2', Game.expFrom(p, 100, 40), 200);
  p.level = 20;
  eq('EXP multiplier floored at 0.5', Game.expFrom(p, 100, 1), 50);
  const q = fresh('commoner');
  Game.gainExp(q, 10);
  eq('10 EXP reaches level 2', q.level, 2);
  eq('Level-up HP +10 base +10 class (Commoner)', Game.maxHp(q), 50);
  eq('Level-up grants 2 free points', q.freePts, 2);
  Game.gainExp(q, 25);
  eq('Excess EXP carries over', [q.level, q.exp], [3, 5]);
}
/* ---- Job EXP and mastery ---- */
{
  const p = fresh('commoner');
  for (let i = 0; i < 10; i++) Game.gainJobExp(p, 1);
  eq('10 Job EXP masters the class', p.mastered, ['commoner']);
  eq('Mastery unlocks Tier 2', p.unlocked.includes('warlord'), true);
}
/* ---- respawn penalty & head (spec §4) ---- */
{
  const p = fresh(); Game.state.phase = 'between';
  p.money = 1000; p.spaceId = '1-e03'; Game.state.head.holder = p.id;
  Game.knockOut(p, { by: 'enemy' });
  eq('KO loses 10% money', p.money, 900);
  eq('KO by enemy drops the head on the space', Game.state.head, { holder: null, space: '1-e03' });
  eq('KO respawns at respawn point', p.spaceId, '1-L01');
}
/* ---- rules presets ---- */
{
  Game.state = Game.newState(null, { days: 45, pace: 'brisk' });
  eq('Brisk EXP ×1.5', Game.expFrom(Game.state.players[0], 20, 1), 30);
  eq('Spec default is 35 days, classic', DATA.RULES_DEFAULT, { days: 35, pace: 'classic' });
}

cooldownTest().then(() => {
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
