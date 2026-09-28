'use strict';
/* Sole Blessed — localStorage persistence. Schema: docs/localstorage_schema.md */

const Save = (() => {
  const PREFIX = 'soleblessed:v1:';
  const K = {
    settings: PREFIX + 'settings',
    slot: n => PREFIX + 'slot:' + n,
    autosave: PREFIX + 'autosave',
    records: PREFIX + 'records',
  };
  const SLOTS = 4;
  const DEFAULT_SETTINGS = { schema: 1, musicVolume: 0.5, sfxVolume: 0.7, botSpeed: 2, showTips: true };
  const DEFAULT_RECORDS = { schema: 1, gamesPlayed: 0, wins: 0, bestStars: 0, endings: { good: false, bad: false, secret: false }, history: [] };

  let memory = {};                      // fallback when localStorage is blocked (private mode etc.)
  let usable = null;

  function storageOk() {
    if (usable !== null) return usable;
    try {
      const k = PREFIX + '__probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      usable = true;
    } catch (e) { usable = false; }
    return usable;
  }
  function read(key) {
    try {
      const raw = storageOk() ? localStorage.getItem(key) : memory[key];
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function write(key, value) {
    const raw = JSON.stringify(value);
    try {
      if (storageOk()) localStorage.setItem(key, raw); else memory[key] = raw;
      return true;
    } catch (e) { return false; }      // quota exceeded
  }
  function remove(key) {
    try { if (storageOk()) localStorage.removeItem(key); else delete memory[key]; } catch (e) { /* ignore */ }
  }

  function makeMeta(state, slot) {
    const p = state.players.find(pl => !pl.isBot) || state.players[0];
    return {
      slot, savedAt: new Date().toISOString(),
      name: p.name, classId: p.classId, className: DATA.CLASSES[p.classId].name,
      level: p.level, day: state.day, stars: p.stars, gender: p.gender, color: p.color,
    };
  }

  /* Structural check so a corrupted/foreign value never crashes the game. */
  function validState(s) {
    return s && typeof s === 'object' && s.schema === DATA.SAVE_SCHEMA && Array.isArray(s.players) &&
      s.players.length === DATA.NUM_PLAYERS && typeof s.day === 'number' && typeof s.turn === 'number' &&
      s.army && s.head && Array.isArray(s.battles);
  }
  function migrate(record) {
    // v1 is the first schema; future versions upgrade `record.state` here before validation.
    if (record.state && !record.state.rules) record.state.rules = Object.assign({}, DATA.RULES_DEFAULT);
    return record;
  }
  function unpack(record) {
    if (!record || !record.state) return null;
    record = migrate(record);
    return validState(record.state) ? record.state : null;
  }

  return {
    SLOTS,
    available: storageOk,

    loadSettings() { return Object.assign({}, DEFAULT_SETTINGS, read(K.settings) || {}); },
    saveSettings(s) { return write(K.settings, Object.assign({}, DEFAULT_SETTINGS, s, { schema: 1 })); },

    listSlots() {
      const out = [];
      for (let i = 1; i <= SLOTS; i++) {
        const rec = read(K.slot(i));
        out.push({ slot: i, meta: rec && rec.meta ? rec.meta : null, corrupt: !!rec && !unpack(U.clone(rec)) });
      }
      return out;
    },
    saveSlot(slot, state) { return write(K.slot(slot), { schema: DATA.SAVE_SCHEMA, meta: makeMeta(state, slot), state }); },
    loadSlot(slot) { return unpack(read(K.slot(slot))); },
    deleteSlot(slot) { remove(K.slot(slot)); },

    autosave(state) { return write(K.autosave, { schema: DATA.SAVE_SCHEMA, meta: makeMeta(state, 'auto'), state }); },
    autosaveMeta() { const r = read(K.autosave); return r && unpack(U.clone(r)) ? r.meta : null; },
    loadAutosave() { return unpack(read(K.autosave)); },
    clearAutosave() { remove(K.autosave); },

    records() { return Object.assign({}, DEFAULT_RECORDS, read(K.records) || {}); },
    recordGame(ending, ranking, humanId) {
      const r = this.records();
      const me = ranking.find(p => p.id === humanId);
      const rank = ranking.indexOf(me) + 1;
      r.gamesPlayed++;
      if (rank === 1 && ending === 'good') r.wins++;
      r.bestStars = Math.max(r.bestStars, me ? me.stars : 0);
      r.endings = Object.assign({}, DEFAULT_RECORDS.endings, r.endings, { [ending]: true });
      r.history = [{ date: new Date().toISOString(), ending, rank, stars: me ? me.stars : 0, winner: ranking[0].name }]
        .concat(r.history || []).slice(0, 10);
      write(K.records, r);
      return r;
    },
  };
})();
