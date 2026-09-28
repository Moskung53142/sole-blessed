'use strict';
/* Sole Blessed — bot heroes (spec §10). Implements the same decision methods as UI. */

const Bot = {
  async think() { await Game.wait(U.randInt(500, 1000)); },
  hpPct(p) { return p.hp / Game.maxHp(p); },
  blocking(id) { return Game.isBlocking(id); },
  spaceOf(code) { return MapSys.list.find(sp => sp.code === code).id; },
  openZone() { return Game.frontierZone(); },
  zoneForLevel(lv) { return lv >= 37 ? 4 : lv >= 24 ? 3 : lv >= 13 ? 2 : 1; },

  /* ================================================================ pre-roll */
  async turnAction(p) {
    await this.think();
    // No items during a fight, so top up before rolling toward a boss.
    if (p.hp < Game.maxHp(p) * (this.bossInReach(p) ? 0.75 : 0.4)) {
      const idx = this.healItem(p);
      if (idx >= 0) await Game.useItem(p, 'items', idx);
    }
    if (!p.itemUsed && U.chance(0.5)) await this.useSpellbook(p);
    if (p.turnOver || p.battleId || p.down) return { type: 'end' };
    const jb = Game.joinableBattle(p);
    if (jb && this.hpPct(p) > 0.5) return { type: 'join' };
    if (!p.itemUsed) {
      const goal = this.goal(p);
      const d = goal ? MapSys.graphDist(p.spaceId, goal, id => this.blocking(id)) : 0;
      const di = p.items.findIndex(id => id === 'I03' || id === 'I02');
      if (di >= 0 && d > 8 && this.hpPct(p) > 0.5) await Game.useItem(p, 'items', di);
    }
    return { type: 'move' };
  },
  /* An undefeated General / Demon Lord (or a co-op army fight) the bot would take on is within one roll. */
  bossInReach(p) {
    const s = Game.state, d = MapSys.distField(p.spaceId, x => this.blocking(x));
    const reach = id => d[id] != null && d[id] <= 6;
    return ['B01', 'B02', 'B03', 'B04'].some(k => !s.army[k].defeated && this.readyFor(p, k) && reach(this.spaceOf(k)))
      || s.battles.some(b => b.kind === 'army' && b.armyKey !== 'minion' && reach(b.space));
  },
  healItem(p) {
    const order = this.hpPct(p) < 0.25 ? ['I08', 'I05', 'I01', 'I04'] : ['I04', 'I01', 'I05', 'I08'];
    for (const id of order) { const i = p.items.indexOf(id); if (i >= 0) return i; }
    return -1;
  },
  topRival(p, cands) { return cands.slice().sort((a, b) => b.stars - a.stars || b.money - a.money)[0]; },
  async useSpellbook(p) {
    for (let i = 0; i < p.books.length && !p.itemUsed; i++) {
      const id = p.books[i];
      if (!Game.canUseItem(p, id).ok) continue;
      if (id === 'MB01') {
        if (this.hpPct(p) < 0.3 && MapSys.graphDist(p.spaceId, p.respawnId, x => this.blocking(x)) > 8) await Game.useItem(p, 'books', i);
      } else if (id === 'MB04') {
        if (Game.challengeTargets(p).some(o => o.hp < p.hp && o.level <= p.level + 1)) await Game.useItem(p, 'books', i);
      } else if (id === 'MB02' || id === 'MB03') await Game.useItem(p, 'books', i);
    }
  },

  /* ================================================================ class changes (Royal Castle / Temple only) */
  wantedClass(p) {
    const c = Game.cls(p);
    if (c.next && p.unlocked.includes(c.next)) return c.next;                       // promote immediately
    p.botMem.off = p.botMem.off || {};
    for (const cid of ['isan', 'gambler', 'templekid']) {
      if (!p.unlocked.includes(cid) || p.botMem.off[cid] || p.classId === cid) continue;
      p.botMem.off[cid] = true;
      if (U.chance(0.5)) return cid;                                                 // off-branch 50%
    }
    // A mastered tier-1 class whose tier-2 is also mastered: nothing to gain, try another branch.
    return null;
  },
  /* Castle/Temple menu: each option is considered once per visit (memory resets on "leave"). */
  async placeMenu(p, kind, opts) {
    await this.think();
    const ok = id => opts.find(o => o.id === id && !o.disabled);
    const mem = p.botMem.menu = p.botMem.menu || {};
    if (ok('class') && !mem.class) { mem.class = true; const cid = this.wantedClass(p); if (cid) { mem.cid = cid; return 'class'; } }
    if (ok('respawn') && !mem.respawn) {
      mem.respawn = true;
      if (MapSys.spaces[p.spaceId].zone > MapSys.spaces[p.respawnId].zone) return 'respawn';
    }
    if (ok('merit') && !mem.merit) { mem.merit = true; if (p.money >= 200 && U.chance(0.5)) return 'merit'; }
    p.botMem.menu = {};
    return 'leave';
  },
  async chooseClass(p) { return (p.botMem.menu && p.botMem.menu.cid) || null; },

  /* ================================================================ movement (exact steps) */
  goal(p) {
    const s = Game.state;
    if (s.head.holder === p.id) return '1-L01';
    if (s.dlDefeated) {
      if (s.head.space) return s.head.space;
      if (s.head.holder != null) return Game.player(s.head.holder).spaceId;
      return null;
    }
    for (const k of ['B01', 'B02', 'B03', 'B04']) if (!s.army[k].defeated) return this.spaceOf(k);
    return null;
  },
  /* Spec rule: level ≥ enemy − 1. Extension: when the story falls behind schedule, bots accept a
   * bigger level gap so the game can still reach the Demon Lord (schedule for a 140-day game). */
  SCHEDULE: { B01: 30, B02: 62, B03: 92, B04: 118 },
  readyFor(p, key) {
    const day = Game.state.day, lv = DATA.ARMY[key].lv;
    if (day >= this.SCHEDULE[key]) return p.level >= lv - 4;
    return p.level >= lv - 1;
  },
  wantsClassChange(p) { const c = Game.cls(p); return !!(c.next && p.unlocked.includes(c.next)); },
  async chooseDestination(p, moves, total) {
    await this.think();
    const s = Game.state, hp = this.hpPct(p), ends = moves.ends;
    const pick = id => ({ target: id, path: ends.get(id) });
    if (s.head.holder === p.id) return this.toward(p, ends, '1-L01');
    if (s.head.space && ends.has(s.head.space)) return pick(s.head.space);
    if (hp < 0.3 && p.money >= 80) {
      const havens = [...ends.keys()].filter(id => MapSys.spaces[id].code === 'L02' || (MapSys.spaces[id].code === 'L06' && p.money >= 100));
      if (havens.length) return pick(havens[0]);
      const all = MapSys.list.filter(sp => sp.code === 'L02' && sp.zone <= this.openZone()).map(sp => sp.id);
      const near = this.nearest(p, all);
      if (near && MapSys.graphDist(p.spaceId, near) <= 12) return this.toward(p, ends, near);
    }
    if (this.wantsClassChange(p)) {
      const hall = [...ends.keys()].find(id => MapSys.spaces[id].code === 'L01' || MapSys.spaces[id].code === 'L05');
      if (hall) return pick(hall);
    }
    if (s.minion && ends.has(s.minion.spaceId) && hp > 0.6 && p.level >= DATA.MINION.lv[s.minion.zone - 1] - 1) return pick(s.minion.spaceId);
    for (const k of ['B01', 'B02', 'B03', 'B04']) {
      const id = this.spaceOf(k);
      if (!s.army[k].defeated && ends.has(id) && this.readyFor(p, k) && hp > 0.45) return pick(id);
    }
    const coop = s.battles.find(b => b.kind === 'army' && b.armyKey !== 'minion' && ends.has(b.space));
    if (coop && hp > 0.5) return pick(coop.space);
    const shop = this.equipShop(p);
    if (shop) return this.toward(p, ends, shop);
    const goal = this.goal(p);
    const goalKey = goal && MapSys.spaces[goal].type === 'B' ? MapSys.spaces[goal].code : null;
    if (goal && (!goalKey || this.readyFor(p, goalKey))) return this.toward(p, ends, goal);
    return this.grind(p, ends, goal);
    void total;
  },
  nearest(p, ids) {
    let best = null, bd = Infinity;
    for (const id of ids) { const d = MapSys.graphDist(p.spaceId, id, x => this.blocking(x)); if (d < bd) { bd = d; best = id; } }
    return best;
  },
  /* Endpoints that are safe to finish on (no accidental boss fights, no weak-bot minion hugs). */
  okStop(p, id, target) {
    const s = Game.state;
    if (id === target) return true;
    if (this.blocking(id)) return false;
    if (s.minion && s.minion.spaceId === id && this.hpPct(p) <= 0.6) return false;
    return true;
  },
  toward(p, ends, target) {
    if (ends.has(target)) return { target, path: ends.get(target) };
    const dist = MapSys.distField(target, x => this.blocking(x));
    let best = null, bd = Infinity;
    for (const [id] of ends) {
      if (!this.okStop(p, id, target)) continue;
      const d = (id in dist ? dist[id] : 999) + (MapSys.spaces[id].type === 'e' ? -0.3 : 0) + Math.random() * 0.2;
      if (d < bd) { bd = d; best = id; }
    }
    if (!best) best = [...ends.keys()].find(id => this.okStop(p, id, target)) || [...ends.keys()][0];
    return { target: best, path: ends.get(best) };
  },
  /* Under-levelled: roam for fights and treasure in the best farming zone, drifting toward the goal. */
  grind(p, ends, goal) {
    const s = Game.state;
    const dist = goal ? MapSys.distField(goal, x => this.blocking(x)) : {};
    const home = Math.min(this.openZone(), this.zoneForLevel(p.level));
    let best = null, bs = -Infinity;
    for (const [id] of ends) {
      if (!this.okStop(p, id, null)) continue;
      const sp = MapSys.spaces[id];
      let score = Math.random() * 1.5;
      if (sp.type === 'e') score += sp.zone === home ? 5 : 3;
      if (sp.type === 't') score += s.chests[id] != null ? -1 : 2.5;
      if (sp.type === 'L') score += (sp.code === 'L03' || sp.code === 'L04') && p.money > 1000 ? 2 : sp.code === 'L07' ? 0.5 : 1;
      if (sp.zone > this.zoneForLevel(p.level)) score -= 3;
      if (goal && id in dist) score -= dist[id] * (sp.zone < home ? 0.5 : 0.12);
      if (score > bs) { bs = score; best = id; }
    }
    if (!best) best = [...ends.keys()][0];
    return { target: best, path: ends.get(best) };
  },
  weaponScore(p, id) { const e = DATA.EQUIP[id]; return Game.cls(p).magic ? (e.sp || 0) : (e.at || 0); },
  armorScore(id) { const e = DATA.EQUIP[id]; return e.df + e.hp / 5; },
  /* Best affordable upgrade per slot at this zone's Equipment Shop. */
  gearUpgrades(p, zone) {
    const out = [];
    for (const slot of ['weapon', 'armor']) {
      const cur = p.equip[slot];
      const score = id => (slot === 'weapon' ? this.weaponScore(p, id) : this.armorScore(id));
      const curScore = cur ? score(cur) : 0;
      const cands = Game.shopStock('equip', zone).filter(id => DATA.EQUIP[id].slot === slot && score(id) > curScore
        && Game.canBuy(p, id).ok && p.money - DATA.EQUIP[id].price + (cur ? Game.sellPrice(cur) : 0) >= 60);
      cands.sort((a, b) => score(b) - score(a));
      if (cands.length) out.push(cands[0]);
    }
    return out;
  },
  equipShop(p) {
    const cands = MapSys.list.filter(sp => sp.code === 'L03' && sp.zone <= this.openZone() && this.gearUpgrades(p, sp.zone).length);
    const id = this.nearest(p, cands.map(sp => sp.id));
    if (!id || MapSys.graphDist(p.spaceId, id, x => this.blocking(x)) > 12) return null;
    return id;
  },

  /* ================================================================ choices */
  async yesNo(p, key, info) {
    await this.think();
    const hp = this.hpPct(p);
    switch (key) {
      case 'join': return hp > 0.5;
      case 'doctor': return hp < 0.6 && p.money >= (info.cost || 0);
      case 'e04': return hp > 0.5 && U.chance(0.5);
    }
    return U.chance(0.5);
  },
  /* Walked into a fight: gang up on the monster, or ambush a badly hurt hero. */
  async fightChoice(p, b, heroes) {
    await this.think();
    const prey = heroes.filter(o => o.hp < Game.maxHp(o) * 0.35 && p.hp > o.hp * 1.5).sort((a, c) => a.hp - c.hp)[0];
    return prey ? { type: 'duel', pid: prey.id } : { type: 'join' };
  },
  async chooseChallenge(p, others) {
    await this.think();
    const weaker = others.filter(o => p.hp > o.hp * 1.2).sort((a, b) => a.hp - b.hp);
    return weaker.length ? weaker[0].id : null;
  },
  async battleCommand(p, b, role, self, foe, cmds) {
    await this.think();
    if (role === 'atk') {
      if (cmds.classMove.ok) return 'classMove';
      if (cmds.special.ok) return 'special';
      return U.chance(0.6) ? 'attack' : 'strike';
    }
    if (b.kind === 'army' && this.hpPct(p) < 0.15) return 'giveUp';
    if (b.kind === 'duel' && this.hpPct(p) < 0.12) return 'giveUp';
    const opts = [['defend', 50], ['counter', 30]];
    if (cmds.specialDef.ok) opts.push(['specialDef', 20]);
    return U.weighted(opts);
    void foe;
  },
  async allocatePoints(p) {
    const keys = Object.keys(Game.cls(p).levelUp);
    let i = 0;
    while (p.freePts > 0) Game.applyPoint(p, keys[i++ % keys.length]);
  },
  async inventoryFull(p, newId) {
    const tab = DATA.ITEMS[newId].tab, list = p[tab];
    let worst = 'new', wv = Game.priceOf(newId);
    list.forEach((id, i) => { const v = Game.priceOf(id); if (v < wv) { wv = v; worst = i; } });
    return worst;
  },
  charmValue(p, id) {
    const magic = Game.cls(p).magic;
    return { C01: magic ? 1 : 3, C02: 2.5, C03: magic ? 3 : 1, C04: 2, C05: 2.6 }[id];
  },
  async charmChoice(p, id) { return this.charmValue(p, id) > this.charmValue(p, p.equip.charm); },
  async stealChoice() { return { type: 'money' }; },
  async pickTarget(p, cands, purpose) {
    let list = cands;
    if (purpose === 'challenge') list = cands.filter(o => o.hp < p.hp);
    if (!list.length) return null;
    return this.topRival(p, list).id;
  },
  async pickSpace(p, cands) {
    const rivals = Game.state.players.filter(o => o.id !== p.id);
    const r = this.topRival(p, rivals);
    const dist = MapSys.distField(r.spaceId, x => this.blocking(x));
    return cands.slice().sort((a, b) => (dist[a] ?? 99) - (dist[b] ?? 99))[0];
  },
  async horseBet(p) {
    await this.think();
    if (!U.chance(0.5)) return null;
    return { pct: U.chance(0.7) ? 0.1 : 0.5, horse: U.randInt(0, 5) };
  },
  async shop(p, kind, zone) {
    await this.think();
    if (kind === 'equip') {
      for (let n = 0; n < 2; n++) {
        const ups = this.gearUpgrades(p, zone);
        if (!ups.length) break;
        const w = ups.find(id => DATA.EQUIP[id].slot === 'weapon') || ups[0];
        if (!Game.buy(p, w)) break;
      }
    } else if (kind === 'skill') {
      const sk = 'SK' + zone, sd = 'SD' + zone;
      const better = (cur, id) => !cur || DATA.SKILLS[cur].zone < DATA.SKILLS[id].zone;
      if (better(p.special, sk) && p.money - DATA.SKILLS[sk].price >= 150) Game.buy(p, sk);
      if (better(p.specialDef, sd) && p.money - DATA.SKILLS[sd].price >= 150) Game.buy(p, sd);
      const mb = 'MB0' + zone;
      if (U.chance(0.3) && p.money - DATA.ITEMS[mb].price >= 300) Game.buy(p, mb);
    } else if (kind === 'larb') {
      if ((!p.usedLarb && p.money >= 200) || (this.hpPct(p) < 0.6 && p.money >= 100)) Game.buy(p, 'I01');
    } else {
      const stock = Game.shopStock('item', zone);
      const bigHeal = stock.includes('I08') ? 'I08' : 'I05';
      const heals = p.items.filter(id => DATA.ITEMS[id].fx === 'heal').length;
      for (let i = heals; i < 3; i++) {
        const id = p.money >= DATA.ITEMS[bigHeal].price + 300 ? bigHeal : stock.includes('I04') ? 'I04' : 'I05';
        if (!Game.buy(p, id)) break;
      }
      if (!p.items.includes('I07') && p.money >= 800 && U.chance(0.4)) Game.buy(p, 'I07');
      if (!p.items.includes('I06') && p.money >= 700 && U.chance(0.4)) Game.buy(p, 'I06');
    }
  },
};
