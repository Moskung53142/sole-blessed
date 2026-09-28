'use strict';
/* Sole Blessed — small shared helpers (no game rules here). */

const U = {
  chance(p) { return Math.random() < p; },
  randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  /** pairs: [[value, weight], ...] */
  weighted(pairs) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = Math.random() * total;
    for (const [v, w] of pairs) { if ((r -= w) < 0) return v; }
    return pairs[pairs.length - 1][0];
  },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  /** Spec: decimals round to the nearest whole number, .5 rounds up. */
  round(x) { return Math.floor(x + 0.5); },
  lerp(a, b, t) { return a + (b - a) * t; },
  easeOut(t) { return 1 - Math.pow(1 - t, 3); },
  easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  fmt(n) { return Math.round(n).toLocaleString('en-US'); },
  /** "1 turn" / "2 turns" */
  plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; },
  clone(o) { return JSON.parse(JSON.stringify(o)); },
  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  /** Deterministic PRNG so map decoration is identical every load. */
  seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  /** Shade a #rrggbb colour: amt -1..1 (negative darkens). */
  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = v => amt < 0 ? Math.round(v * (1 + amt)) : Math.round(v + (255 - v) * amt);
    r = f(r); g = f(g); b = f(b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },
  rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },
};
