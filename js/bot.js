'use strict';
/* Sole Blessed — bot heroes (spec §10). Implements the same decision methods as UI. */

const Bot = {
  async think() { await Game.wait(U.randInt(500, 1000)); },
  hpPct(p) { return p.hp / Game.maxHp(p); },
  blocking(id) { return Game.isBlocking(id); },
  spaceOf(code) { return MapSys.list.find(sp => sp.code === code).id; },
  /* Highest zone the hero can walk into (zone z opens once General z−1 falls). */
  openZone() { const a = Game.state.army; return a.B01.defeated ? a.B02.defeated ? a.B03.defeated ? 4 : 3 : 2 : 1; },

  /* ================================================================ pre-roll */
  async turnAction(p) {
    await this.think();
    this.considerClass(p);
    const max = Game.maxHp(p);
    if (p.hp < max * 0.4) {
      const idx = this.healItem(p);
      if (idx >= 0) await Game.useItem(p, 'items', idx);
    }
    if (!p.itemUsed && U.chance(0.5)) await this.useSpellbook(p);
    if (p.turnOver) return { type: 'end' };
    if (p.battleId) {
      if (!p.itemUsed && !p.buffs.energy && p.items.includes('I06')) await Game.useItem(p, 'items', p.items.indexOf('I06'));
      return { type: 'battle' };
    }
    const jb = Game.joinableBattle(p);
    if (jb && this.hpPct(p) > 0.5) return { type: 'join' };
    if (!p.itemUsed) {
      const goal = this.goal(p);
      const d = goal ? MapSys.graphDist(p.spaceId, goal, id => this.blocking(id)) : 0;
      const di = p.items.findIndex(id => id === 'I03' || id === 'I02');
      if (di >= 0 && d > 6 && this.hpPct(p) > 0.5) await Game.useItem(p, 'items', di);
    }
    return { type: 'move' };
  },
  considerClass(p) {
    const c = Game.cls(p);
    if (c.next && p.unlocked.includes(c.next)) { Game.changeClass(p, c.next); return; }
    p.botMem.off = p.botMem.off || {};
    for (const cid of ['isan', 'gambler', 'templekid']) {
      if (!p.unlocked.includes(cid) || p.botMem.off[cid] || p.classId === cid) continue;
      p.botMem.off[cid] = true;
      if (U.chance(0.5)) { Game.changeClass(p, cid); return; }
    }
  },
  healItem(p) {
    const order = this.hpPct(p) < 0.25 ? ['I05', 'I01', 'I04'] : ['I04', 'I01', 'I05'];
    for (const id of order) { const i = p.items.indexOf(id); if (i >= 0) return i; }
    return -1;
  },
  topRival(p, cands) {
    return cands.slice().sort((a, b) => b.stars - a.stars || b.money - a.money)[0];
  },
  async useSpellbook(p) {
    const s = Game.state;
    for (let i = 0; i < p.books.length && !p.itemUsed; i++) {
      const id = p.books[i];
      if (!Game.canUseItem(p, id).ok) continue;
      if (id === 'MB01') {
        if (this.hpPct(p) < 0.3 && MapSys.graphDist(p.spaceId, p.respawnId, x => this.blocking(x)) > 6) await Game.useItem(p, 'books', i);
      } else if (id === 'MB04') {
        const t = Game.challengeTargets(p).filter(o => o.hp < p.hp && o.level <= p.level + 1);
        if (t.length) await Game.useItem(p, 'books', i);
      } else if (id === 'MB02' || id === 'MB03') {
        await Game.useItem(p, 'books', i);
      }
      void s;
    }
  },

  /* ================================================================ movement */
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
  /* Spec rule: level ≥ enemy − 1. Extension: when the story falls behind schedule, bots accept
   * a bigger level gap so the 35-day game can still reach the Demon Lord. */
  SCHEDULE: { B01: 9, B02: 17, B03: 24, B04: 29 },
  readyFor(p, key) {
    const day = Game.state.day, lv = DATA.ARMY[key].lv, k = Game.maxDays() / 35;
    if (key === 'B04' && day >= 31 * k) return true;
    if (day >= this.SCHEDULE[key] * k) return p.level >= lv - 4;
    return p.level >= lv - 1;
  },
  async chooseDestination(p, reach, total) {
    await this.think();
    const s = Game.state, hp = this.hpPct(p);
    const pick = id => ({ target: id, path: reach.get(id) });
    if (s.head.holder === p.id) return this.toward(p, reach, '1-L01');
    if (s.head.space && reach.has(s.head.space)) return pick(s.head.space);
    /* Temples don't heal, so a broke bot heading "home" would loop forever; only retreat when a
     * shop can actually sell it a heal. (A KO also restores full HP, so broke bots keep fighting.) */
    if (hp < 0.3 && p.money >= 80) {
      const havens = MapSys.list.filter(sp => (sp.code === 'L02' || (sp.code === 'L06' && p.money >= 100)) && sp.zone <= this.openZone()).map(sp => sp.id);
      const near = this.nearest(p, havens);
      if (near) return this.toward(p, reach, near);
    }
    if (s.minion && reach.has(s.minion.spaceId) && hp > 0.6 && p.level >= DATA.MINION.lv[s.minion.zone - 1] - 1) return pick(s.minion.spaceId);
    for (const k of ['B01', 'B02', 'B03', 'B04']) {
      const id = this.spaceOf(k);
      if (!s.army[k].defeated && reach.has(id) && this.readyFor(p, k) && hp > 0.45) return pick(id);
    }
    // Co-op: an ally is already fighting the Demon Lord Army within range → go join (spec: join at HP > 50%).
    const coop = s.battles.find(b => b.kind === 'army' && b.armyKey !== 'minion' && reach.has(b.space));
    if (coop && hp > 0.5) return pick(coop.space);
    const shop = this.equipShop(p);
    if (shop) return this.toward(p, reach, shop);
    const goal = this.goal(p);
    const goalKey = goal && MapSys.spaces[goal].type === 'B' ? MapSys.spaces[goal].code : null;
    if (goal && (!goalKey || this.readyFor(p, goalKey))) return this.toward(p, reach, goal);
    return this.grind(p, reach, goal);
    void total;
  },
  nearest(p, ids) {
    let best = null, bd = Infinity;
    for (const id of ids) { const d = MapSys.graphDist(p.spaceId, id, x => this.blocking(x)); if (d < bd) { bd = d; best = id; } }
    return best;
  },
  /* Stops that are safe for a bot to end on (no accidental boss fights). */
  okStop(p, id, target) {
    const s = Game.state;
    if (id === target) return true;
    if (this.blocking(id)) return false;
    if (s.minion && s.minion.spaceId === id && this.hpPct(p) <= 0.6) return false;
    return true;
  },
  toward(p, reach, target) {
    if (reach.has(target)) return { target, path: reach.get(target) };
    const dist = MapSys.distField(target, x => this.blocking(x));
    let best = null, bd = Infinity;
    for (const [id] of reach) {
      if (!this.okStop(p, id, target)) continue;
      const d = (id in dist ? dist[id] : 999) + (MapSys.spaces[id].type === 'e' ? -0.3 : 0) + Math.random() * 0.2;
      if (d < bd) { bd = d; best = id; }
    }
    if (!best) best = [...reach.keys()].find(id => this.okStop(p, id, target)) || [...reach.keys()][0];
    return { target: best, path: reach.get(best) };
  },
  /* Under-levelled: roam for fights and treasure, drifting toward the goal. */
  grind(p, reach, goal) {
    const s = Game.state;
    const dist = goal ? MapSys.distField(goal, x => this.blocking(x)) : {};
    const home = Math.min(this.openZone(), this.zoneForLevel(p.level));   // best zone to farm right now
    let best = null, bs = -Infinity;
    for (const [id] of reach) {
      if (!this.okStop(p, id, null)) continue;
      const sp = MapSys.spaces[id];
      let score = Math.random() * 1.5;
      if (sp.type === 'e') score += sp.zone === home ? 5 : 3;               // under-levelled: EXP first
      if (sp.type === 't') score += s.chests[id] != null ? -1 : 2.5;
      if (sp.type === 'L') score += (sp.code === 'L03' || sp.code === 'L04') && p.money > 400 ? 2 : sp.code === 'L07' ? 0.5 : 1;
      if (sp.zone > this.zoneForLevel(p.level)) score -= 3;
      if (goal && id in dist) score -= dist[id] * (sp.zone < home ? 0.5 : 0.15);
      if (score > bs) { bs = score; best = id; }
    }
    if (!best) best = [...reach.keys()][0];
    return { target: best, path: reach.get(best) };
  },
  zoneForLevel(lv) { return lv >= 19 ? 4 : lv >= 12 ? 3 : lv >= 6 ? 2 : 1; },
  weaponScore(p, id) { const e = DATA.EQUIP[id]; return Game.cls(p).magic ? (e.sp || 0) : (e.at || 0); },
  gearUpgrades(p, zone) {
    const out = [];
    for (const id of Game.shopStock('equip', zone)) {
      const e = DATA.EQUIP[id], cur = p.equip[e.slot];
      const better = e.slot === 'weapon' ? this.weaponScore(p, id) > (cur ? this.weaponScore(p, cur) : 0)
        : (e.df + e.hp / 5) > (cur ? DATA.EQUIP[cur].df + DATA.EQUIP[cur].hp / 5 : 0);
      if (better && Game.canBuy(p, id).ok && p.money - e.price + (cur ? Game.sellPrice(cur) : 0) >= 60) out.push(id);
    }
    return out;
  },
  equipShop(p) {
    const cands = MapSys.list.filter(sp => sp.code === 'L03' && sp.zone <= this.openZone() && this.gearUpgrades(p, sp.zone).length);
    const id = this.nearest(p, cands.map(sp => sp.id));
    if (!id || MapSys.graphDist(p.spaceId, id, x => this.blocking(x)) > 10) return null;
    return id;
  },

  /* ================================================================ choices */
  async yesNo(p, key, info) {
    await this.think();
    const hp = this.hpPct(p);
    switch (key) {
      case 'join': return hp > 0.5;
      case 'doctor': return hp < 0.6 && p.money >= (info.cost || 0);
      case 'e04': return hp > 0.4 && U.chance(0.5);
      case 'respawn': {
        const here = MapSys.spaces[p.spaceId].zone, cur = MapSys.spaces[p.respawnId].zone;
        return here > cur || (here === cur && U.chance(0.3));
      }
      case 'donate': return p.money >= 200 && U.chance(0.5);
    }
    return U.chance(0.5);
  },
  async chooseChallenge(p, others) {
    await this.think();
    const weaker = others.filter(o => p.hp > o.hp).sort((a, b) => a.hp - b.hp);
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
    return { C01: magic ? 1 : 3, C02: 2.5, C03: magic ? 3 : 1, C04: 2 }[id];
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
      let ups;
      while ((ups = this.gearUpgrades(p, zone)).length) {
        const w = ups.find(id => DATA.EQUIP[id].slot === 'weapon') || ups[0];
        if (!Game.buy(p, w)) break;
      }
    } else if (kind === 'skill') {
      const sk = 'SK' + zone, sd = 'SD' + zone;
      const better = (cur, id) => !cur || DATA.SKILLS[cur].zone < DATA.SKILLS[id].zone;
      if (better(p.special, sk) && p.money - DATA.SKILLS[sk].price >= 100) Game.buy(p, sk);
      if (better(p.specialDef, sd) && p.money - DATA.SKILLS[sd].price >= 100) Game.buy(p, sd);
      const mb = 'MB0' + zone;
      if (U.chance(0.3) && p.money - DATA.ITEMS[mb].price >= 200) Game.buy(p, mb);
    } else if (kind === 'larb') {
      if ((!p.usedLarb && p.money >= 200) || (this.hpPct(p) < 0.6 && p.money >= 100)) Game.buy(p, 'I01');
    } else {
      const heals = p.items.filter(id => DATA.ITEMS[id].fx === 'heal').length;
      if (this.hpPct(p) < 0.6) {
        for (let i = heals; i < 2; i++) Game.buy(p, p.money >= 400 ? 'I05' : 'I04');
      }
      if (heals < 2 && p.money >= 300) Game.buy(p, zone >= 3 ? 'I05' : 'I04');
      if (heals < 1 && p.money >= 300) Game.buy(p, 'I04');
      if (!p.items.includes('I07') && p.money >= 600 && U.chance(0.4)) Game.buy(p, 'I07');
      if (!p.items.includes('I06') && p.money >= 500 && U.chance(0.4)) Game.buy(p, 'I06');
    }
  },
};
