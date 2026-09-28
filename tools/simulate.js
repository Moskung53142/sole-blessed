#!/usr/bin/env node
/* Sole Blessed — headless balance/regression simulation.
 * Runs full 35-day games with 4 bots (no UI, no delays) and checks state invariants every turn.
 * Usage: node tools/simulate.js [games=20] [--days=35|45|60] [--pace=classic|brisk] [--verbose] */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
global.UI = {};                                   // never touched in sim mode
for (const f of ['util', 'data', 'save', 'audio', 'sprites', 'map', 'game', 'battle', 'bot']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: `js/${f}.js` });
}
/* global Game, DATA, MapSys */

const arg = name => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : null; };
const games = Number(process.argv[2]) || 20;
const verbose = process.argv.includes('--verbose');
const rules = { days: Number(arg('days')) || DATA.RULES_DEFAULT.days, pace: arg('pace') || DATA.RULES_DEFAULT.pace };
console.log(`Rules: ${rules.days} days, ${rules.pace} pace`);
Game.sim = true;

function check(s, where) {
  const fail = msg => { throw new Error(`Invariant failed (${where}, day ${s.day}): ${msg}`); };
  for (const p of s.players) {
    const max = Game.maxHp(p);
    if (!Number.isFinite(p.hp) || p.hp < 0 || p.hp > max) fail(`${p.name} hp ${p.hp}/${max}`);
    if (!Number.isFinite(p.money) || p.money < 0) fail(`${p.name} money ${p.money}`);
    if (p.items.length > DATA.INV_SIZE || p.books.length > DATA.INV_SIZE) fail(`${p.name} inventory overflow`);
    if (!MapSys.spaces[p.spaceId]) fail(`${p.name} on unknown space ${p.spaceId}`);
    if (p.battleId) {
      const b = s.battles.find(x => x.id === p.battleId);
      if (!b || !b.parts.includes(p.id)) fail(`${p.name} locked in missing battle ${p.battleId}`);
    }
    for (const k of ['at', 'df', 'sp']) if (!Number.isFinite(Game.stat(p, k))) fail(`${p.name} ${k} NaN`);
    if (p.level > DATA.MAX_LEVEL) fail('level overflow');
  }
  for (const b of s.battles) {
    if (!b.parts.length) fail(`empty battle ${b.id} left behind`);
    for (const id of b.parts) if (s.players[id].battleId !== b.id) fail(`battle ${b.id} lists ${id} who is not locked`);
  }
  if (s.head.holder != null && s.head.space) fail('head both held and dropped');
  if (s.minion && !MapSys.spaces[s.minion.spaceId]) fail('minion off-map');
  JSON.stringify(s);                              // must stay serialisable for localStorage
}

(async () => {
  const endings = {}, dlDay = [], genDays = { B01: [], B02: [], B03: [] }, curve = { 10: [], 20: [], 30: [] };
  let levels = [], stars = [], deaths = 0, turns = 0;
  const t0 = Date.now();
  for (let g = 0; g < games; g++) {
    const s = Game.newState(null, rules);
    const orig = Game.playTurn.bind(Game);
    const seen = {};
    Game.playTurn = async function () {
      await orig();
      turns++;
      check(Game.state, `after turn of ${Game.cur().name}`);
      for (const k of ['B01', 'B02', 'B03']) if (Game.state.army[k].defeated && !seen[k]) { seen[k] = 1; genDays[k].push(Game.state.day); }
      if (Game.state.dlDefeated && !seen.dl) { seen.dl = 1; dlDay.push(Game.state.day); }
      for (const d of [10, 20, 30]) if (Game.state.day === d && !seen['d' + d]) {
        seen['d' + d] = 1;
        curve[d].push(Math.max(...Game.state.players.map(p => p.level)));
      }
    };
    await Game.start(s);
    Game.playTurn = orig;
    endings[s.ending] = (endings[s.ending] || 0) + 1;
    for (const p of s.players) { levels.push(p.level); stars.push(p.stars); deaths += p.record.deaths; }
    if (verbose) {
      console.log(`Game ${g + 1}: ${s.ending} on day ${s.day} — ` + Game.ranking().map(p => `${p.name} Lv${p.level} ${p.stars}⭐ ${p.money}G ${DATA.CLASSES[p.classId].short}`).join(' | '));
    }
  }
  const avg = a => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—');
  console.log(`\n${games} games, ${turns} turns, ${((Date.now() - t0) / 1000).toFixed(1)}s — all invariants held.`);
  console.log('Endings:', endings);
  console.log(`General defeated on day — B01: ${avg(genDays.B01)} (${genDays.B01.length}/${games}), B02: ${avg(genDays.B02)} (${genDays.B02.length}/${games}), B03: ${avg(genDays.B03)} (${genDays.B03.length}/${games})`);
  console.log(`Demon Lord defeated: ${dlDay.length}/${games} games, avg day ${avg(dlDay)}`);
  console.log(`Top hero level on day 10: ${avg(curve[10])}, day 20: ${avg(curve[20])}, day 30: ${avg(curve[30])}`);
  console.log(`Final level avg ${avg(levels)} (max ${Math.max(...levels)}), stars avg ${avg(stars)}, KOs per hero per game ${(deaths / games / 4).toFixed(1)}`);
})().catch(e => { console.error(e); process.exit(1); });
