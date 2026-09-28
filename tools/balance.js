#!/usr/bin/env node
/* Sole Blessed — enemy balance tool.
 * Builds reference bot heroes (3 class lines, bot point allocation, level-appropriate gear and skills)
 * with the real game code, simulates 1-on-1 fights and reports how each enemy plays.
 *   node tools/balance.js            report current DATA stats
 *   node tools/balance.js --tune     auto-tune HP/AT toward the targets and print a data.js block */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
global.UI = {};
for (const f of ['util', 'data', 'save', 'audio', 'sprites', 'map', 'game', 'battle', 'bot']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: `js/${f}.js` });
}
/* global Game, Battle, Bot, DATA, U */
Game.sim = true;
const TUNE = process.argv.includes('--tune');
const N = 300;

const LINES = [['commoner', 'warlord'], ['shaman', 'archmage'], ['slingshot', 'bowlord']];
function refHero(line, L) {
  Game.state = Game.newState({ name: 'Ref', gender: 'm', classId: line[0] });
  const p = Game.state.players[0];
  for (let lv = 2; lv <= L; lv++) {
    if (lv === 11) p.mastered.push(line[0]);
    if (lv === 14) p.classId = line[1];
    Game.levelUp(p); Bot.allocatePoints(p);
  }
  const magic = DATA.CLASSES[p.classId].magic;
  let tier = 0;
  for (let t = 1; t <= 8; t++) if (DATA.EQUIP['W' + t].minLv <= L - 1) tier = t;
  if (tier) { p.equip.weapon = (magic ? 'S' : 'W') + tier; p.equip.armor = 'A' + tier; }
  const z = Bot.zoneForLevel(L);
  p.special = 'SK' + z; p.specialDef = 'SD' + z;
  p.hp = Game.maxHp(p);
  return p;
}
const cmd = (c, role) => {
  const cm = Battle.commands(c, role);
  if (role === 'atk') return cm.classMove.ok ? 'classMove' : cm.special.ok ? 'special' : (U.chance(0.6) ? 'attack' : 'strike');
  return U.weighted([['defend', 50], ['counter', 30]].concat(cm.specialDef.ok ? [['specialDef', 20]] : []));
};
/* Fight to the finish (max 12 days, no healing between days). */
function fight(p, kind, key) {
  const s = Game.state;
  s.day = 1; p.hp = Game.maxHp(p); p.cd = { special: 0, specialDef: 0, classMove: 0 };
  let b;
  if (kind === 'monster') b = Battle.create('monster', '1-e01', null, { key, mult: 1, e04: false, hp: DATA.MONSTERS[key].hp, maxHp: DATA.MONSTERS[key].hp, specialDay: 0 });
  else if (key === 'minion') { s.minion = { zone: kind, spaceId: '1-e01', hp: DATA.MINION.hp[kind - 1], maxHp: DATA.MINION.hp[kind - 1], cd: { special: 0, specialDef: 0 } }; b = Battle.create('army', '1-e01', 'minion', null); }
  else { const a = DATA.ARMY[key]; s.army[key] = { hp: a.hp, maxHp: a.hp, cd: { special: 0, specialDef: 0 }, defeated: false }; b = Battle.create('army', '1-e01', key, null); }
  Battle.addPart(b, p, U.chance(0.5) ? 'hero' : 'enemy');
  let potions = 2;                                   // bots carry heals and drink one at day start below 40% HP
  for (let day = 1; day <= 12; day++) {
    s.day = day;
    if (day > 1 && potions && p.hp < Game.maxHp(p) * 0.4) { potions--; p.hp = Math.min(Game.maxHp(p), p.hp + U.round(Game.maxHp(p) * 0.5)); }
    for (let r = 0; r < 3; r++) {
      for (const side of b.first[p.id] === 'hero' ? ['H', 'E'] : ['E', 'H']) {
        const H = Battle.heroC(b, p), E = Battle.enemyC(b);
        const A = side === 'H' ? H : E, D = side === 'H' ? E : H;
        const R = Battle.exchange(b, A, D, side === 'H' ? cmd(H, 'atk') : Battle.enemyChoose(E, 'atk'), side === 'H' ? Battle.enemyChoose(E, 'def') : cmd(H, 'def'));
        R._A = A; Battle.luckyCheck(H, R);
        if (E.hp <= 0) return { win: true, days: day, loss: 1 - p.hp / Game.maxHp(p) };
        if (H.hp <= 0) return { win: false, days: day, loss: 1 };
      }
    }
    for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - 1);
    const live = Battle.enemyC(b).cd; if (live) for (const k in live) live[k] = Math.max(0, live[k] - 1);
    if (key === 'B02') { const a = s.army.B02; a.hp = Math.min(a.maxHp, a.hp + U.round(a.maxHp * 0.05)); }
  }
  return { win: false, days: 12, loss: 1 - p.hp / Game.maxHp(p), timeout: true };
}
function measure(kind, key, lv) {
  let wins = 0, day1 = 0, days = 0, loss = 0;
  for (let i = 0; i < N; i++) {
    const r = fight(refHero(LINES[i % 3], lv), kind, key);
    if (r.win) { wins++; days += r.days; loss += r.loss; if (r.days === 1) day1++; }
  }
  return { win: wins / N, day1: day1 / N, days: wins ? days / wins : 99, loss: wins ? loss / wins : 1 };
}
const pct = x => (x * 100).toFixed(0).padStart(3) + '%';

const TARGET = { monster: { days: 1.35, loss: 0.36, win: 0.9 }, minion: { days: 1.8, loss: 0.45, win: 0.85 }, general: { days: 2.5 }, lord: { days: 3.8 } };
/* Heroes meet each monster slightly under-levelled (where its tier starts), so tune for that level. */
const MEET = { slime: 1, wolf: 4, monkey: 8, kongkoi: 13, mushroom: 17, tiger: 20, scorpion: 25, mummy: 29, wyrm: 32, shadow: 37, deathknight: 41, golem: 45 };
/* Average damage stat (AT, or SP for mages) of the reference heroes at level L. */
function avgPower(L) {
  return LINES.reduce((sum, l) => { const p = refHero(l, L); return sum + (DATA.CLASSES[p.classId].magic ? Game.stat(p, 'sp') : Game.stat(p, 'at')); }, 0) / LINES.length;
}
const DF_K = { slime: 1, wolf: 0.8, monkey: 0.9, kongkoi: 0.9, mushroom: 1.1, tiger: 0.9, scorpion: 1.2, mummy: 1, wyrm: 1, shadow: 0.8, deathknight: 1.3, golem: 1.3, minion: 1, B01: 1.2, B02: 1.2, B03: 1.2, B04: 1.1 };
/* Average hero HP / DF at level L (for boss attack power). */
function avgHeroes(L) {
  let hp = 0, df = 0;
  for (const l of LINES) { const p = refHero(l, L); hp += Game.maxHp(p); df += Game.stat(p, 'df'); }
  return { hp: hp / LINES.length, df: df / LINES.length };
}
/* Monsters: tune HP (fight length) and AT/SP (damage taken). Bosses (fixAt): AT/SP come from a
 * formula (≈12% of a hero's HP per plain hit) and only HP is tuned toward the target length. */
function tuneOne(obj, kind, key, lv, target, idx, fixAt, atMul) {
  const get = f => (idx == null ? obj[f] : obj[f][idx]);
  const set = (f, v) => { if (idx == null) obj[f] = v; else obj[f][idx] = v; };
  set('df', Math.max(2, U.round(0.35 * avgPower(lv) * (DF_K[key] || 1))));
  if (fixAt) {
    const h = avgHeroes(lv), at = U.round((0.12 * h.hp + h.df) / 2 * (atMul || 1));
    set('at', at); set('sp', U.round(at * 1.05));
  }
  for (let it = 0; it < 9; it++) {
    const m = measure(kind, key, lv);
    const hpK = Math.pow(target.days / Math.max(0.5, m.days), 0.8);
    set('hp', Math.max(20, U.round(get('hp') * U.clamp(hpK, 0.6, 1.6))));
    if (fixAt) continue;
    const atK = Math.pow(target.loss / Math.max(0.05, m.loss), 0.7) * (m.win < target.win ? 0.85 : 1);
    set('at', Math.max(3, U.round(get('at') * U.clamp(atK, 0.7, 1.4))));
    set('sp', Math.max(3, U.round(get('sp') * U.clamp(atK, 0.7, 1.4))));
  }
}

const rows = [];
if (TUNE) {
  for (const k in DATA.MONSTERS) { const m = DATA.MONSTERS[k]; tuneOne(m, 'monster', k, MEET[k], TARGET.monster); }
  for (let z = 1; z <= 4; z++) tuneOne(DATA.MINION, z, 'minion', DATA.MINION.lv[z - 1] - 1, TARGET.minion, z - 1);
  for (const k of ['B01', 'B02', 'B03']) tuneOne(DATA.ARMY[k], 'army', k, DATA.ARMY[k].lv, TARGET.general, null, true, 1.0);
  tuneOne(DATA.ARMY.B04, 'army', 'B04', DATA.ARMY.B04.lv, TARGET.lord, null, true, 0.75);
}
console.log('Hero at the enemy\'s level, solo, fight to the finish (no healing):');
console.log('enemy'.padEnd(26), 'Lv', '   HP   AT   DF   SP ', ' win  1-day  days  HP lost');
for (const k in DATA.MONSTERS) { const m = DATA.MONSTERS[k], r = measure('monster', k, MEET[k]); rows.push([m.name + ' @' + MEET[k], m.lv, m, r]); }
for (let z = 1; z <= 4; z++) { const st = DATA.minionStats(z), r = measure(z, 'minion', st.lv - 1); rows.push([`Minion (Zone ${z}) @${st.lv - 1}`, st.lv, st, r]); }
for (const k of ['B01', 'B02', 'B03', 'B04']) { const a = DATA.ARMY[k], r = measure('army', k, a.lv); rows.push([a.name, a.lv, a, r]); }
for (const [name, lv, m, r] of rows) {
  console.log(name.padEnd(26), String(lv).padStart(2), [m.hp, m.at, m.df, m.sp].map(v => String(v).padStart(5)).join(''), ' ', pct(r.win), pct(r.day1), r.days.toFixed(2).padStart(5), pct(r.loss));
}
console.log('\nReference heroes (bot builds, zone gear):');
for (const L of [1, 6, 12, 18, 24, 30, 36, 43, 50]) {
  console.log(`Lv ${String(L).padStart(2)}: ` + LINES.map(l => { const p = refHero(l, L); return `${DATA.CLASSES[p.classId].short.padEnd(13)} HP ${String(Game.maxHp(p)).padStart(4)} AT ${String(Game.stat(p, 'at')).padStart(3)} DF ${String(Game.stat(p, 'df')).padStart(3)} SP ${String(Game.stat(p, 'sp')).padStart(3)}`; }).join(' | '));
}
if (TUNE) {
  console.log('\n/* tuned stats */');
  for (const k in DATA.MONSTERS) { const m = DATA.MONSTERS[k]; console.log(`${k}: hp ${m.hp}, at ${m.at}, df ${m.df}, sp ${m.sp}`); }
  console.log(`minion: hp ${JSON.stringify(DATA.MINION.hp)}, at ${JSON.stringify(DATA.MINION.at)}, df ${JSON.stringify(DATA.MINION.df)}, sp ${JSON.stringify(DATA.MINION.sp)}`);
  for (const k of ['B01', 'B02', 'B03', 'B04']) { const a = DATA.ARMY[k]; console.log(`${k}: hp ${a.hp}, at ${a.at}, df ${a.df}, sp ${a.sp}`); }
}
