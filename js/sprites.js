'use strict';
/* Sole Blessed — procedural art. Everything is drawn with Canvas paths (plus a few emoji signs).
 * Convention: draw functions take (ctx, x, y, scale, opts) where (x, y) is the point on the ground
 * (feet / building base centre). Local units: a hero is ~64 units tall at scale 1. */

const Sprites = (() => {
  const OUT = '#2b1a0e';
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------ primitives */
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function fs(c, fill, stroke, lw) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke !== null) { c.strokeStyle = stroke || OUT; c.lineWidth = lw || 2; c.stroke(); }
  }
  function line(c, x1, y1, x2, y2, col, w) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  /* Thick limb with a dark outline, cartoon style. */
  function limb(c, x1, y1, x2, y2, col, w) { line(c, x1, y1, x2, y2, OUT, w + 3); line(c, x1, y1, x2, y2, col, w); }
  function emoji(c, ch, x, y, size) {
    c.save(); c.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, x, y); c.restore();
  }
  function shadow(c, x, y, rx, ry, a) { ell(c, x, y, rx, ry); c.fillStyle = `rgba(0,0,0,${a == null ? 0.28 : a})`; c.fill(); }
  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(col, a == null ? 0.8 : a)); g.addColorStop(1, U.rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }

  /* ------------------------------------------------------------ heroes */
  const LOOKS = {
    commoner: { body: '#9a6a3a', trim: '#6e4522', pants: '#5b4a3a', boots: '#4a3020' },
    warlord: { body: '#b8322c', trim: '#e3b341', pants: '#4a3a3a', boots: '#3a2a20' },
    shaman: { body: '#7a55b0', trim: '#c9a0ff', boots: '#3a2a40', robe: true },
    archmage: { body: '#27407e', trim: '#f2c94c', boots: '#1a2040', robe: true },
    slingshot: { body: '#3f9a4a', trim: '#f4f1e8', pants: '#6a5030', boots: '#4a3020' },
    bowlord: { body: '#2f5e3a', trim: '#a4c46a', pants: '#4a4030', boots: '#3a2a20' },
    isan: { body: '#2f4b8c', trim: '#d84a3a', pants: '#2f4b8c', boots: '#6b4a2a' },
    gambler: { body: '#5b2a86', trim: '#f2c94c', pants: '#2a2a36', boots: '#1a1a22' },
    templekid: { body: '#f08a24', trim: '#c95f10', boots: '#8a5a30', robe: true },
  };
  const SKIN = '#f5cda2';

  function weapon(c, kind, hx, hy, ang, t) {
    c.save(); c.translate(hx, hy); c.rotate(ang);
    switch (kind) {
      case 'woodSword':
        rr(c, -2, -24, 4.5, 22, 2); fs(c, '#d9b27a');
        rr(c, -5, -3, 10, 3, 1.5); fs(c, '#7a4a22'); break;
      case 'bigSword':
        poly(c, [-3.5, -2, -3.5, -30, 0, -35, 3.5, -30, 3.5, -2]); fs(c, '#d7dee6');
        line(c, 0, -5, 0, -30, '#9fb0c0', 1.2);
        rr(c, -7, -3, 14, 4, 2); fs(c, '#e3b341'); break;
      case 'crookedStaff':
        c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(-5, -10, 2, -20); c.quadraticCurveTo(7, -30, 0, -36);
        c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#8b5a2b'; c.lineWidth = 3; c.stroke();
        ell(c, 4, -37, 5, 2.6, -0.6); fs(c, '#5dbb4c'); break;
      case 'orbStaff':
        limb(c, 0, 8, 0, -32, '#6b4a2a', 3);
        glow(c, 0, -37, 12 + Math.sin(t * 4) * 2, '#7fd6ff', 0.7);
        circ(c, 0, -37, 5.5); fs(c, '#bfefff'); break;
      case 'slingshot':
        limb(c, 0, 4, 0, -8, '#8b5a2b', 2.5); limb(c, 0, -8, -5, -16, '#8b5a2b', 2.5); limb(c, 0, -8, 5, -16, '#8b5a2b', 2.5);
        c.beginPath(); c.moveTo(-5, -16); c.quadraticCurveTo(0, -10, 5, -16); c.strokeStyle = '#d33'; c.lineWidth = 1.5; c.stroke(); break;
      case 'bow':
        c.beginPath(); c.arc(-6, -8, 18, -1.2, 1.2); c.strokeStyle = OUT; c.lineWidth = 5; c.stroke();
        c.strokeStyle = '#8b5a2b'; c.lineWidth = 3; c.stroke();
        line(c, -6 + 18 * Math.cos(-1.2), -8 + 18 * Math.sin(-1.2), -6 + 18 * Math.cos(1.2), -8 + 18 * Math.sin(1.2), '#eee', 1); break;
      case 'basket':
        rr(c, -5, -6, 10, 11, 3); fs(c, '#d9a55a'); line(c, -5, -2, 5, -2, '#a67430', 1); line(c, -5, 1.5, 5, 1.5, '#a67430', 1); break;
      case 'dice':
        rr(c, -6, -7, 7, 7, 1.5); fs(c, '#fff'); rr(c, 1, -4, 7, 7, 1.5); fs(c, '#fff');
        circ(c, -2.5, -3.5, 1); fs(c, '#d33', null); circ(c, 4.5, -0.5, 1); fs(c, OUT, null); break;
      case 'bowl':
        c.beginPath(); c.arc(0, -2, 6.5, 0, Math.PI); c.closePath(); fs(c, '#222'); ell(c, 0, -2, 6.5, 1.8); fs(c, '#444'); break;
    }
    c.restore();
  }

  function drawHero(c, x, y, s, o) {
    const L = LOOKS[o.classId] || LOOKS.commoner;
    const t = o.t || 0, cls = o.classId;
    const hair = o.hair || (o.gender === 'f' ? '#6b3417' : '#3a2415');
    const victory = o.pose === 'victory';
    const bob = o.still ? 0 : victory ? -Math.abs(Math.sin(t * 7)) * 7 : Math.sin(t * 3.2) * 0.8;
    const lg = o.walk ? Math.sin(o.walk * TAU) * 3 : 0;
    const attack = o.pose === 'attack', hurt = o.pose === 'hurt';
    const wai = victory && cls === 'templekid';
    c.save();
    c.translate(x, y); c.scale(s * (o.facing || 1), s);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (hurt) c.rotate(-0.12);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const Y = v => v + bob;

    // scarf tail in the player colour
    c.beginPath(); c.moveTo(-5, Y(-32)); c.quadraticCurveTo(-19, Y(-28) + Math.sin(t * 5) * 2, -17, Y(-17));
    c.lineTo(-9, Y(-22)); c.closePath(); fs(c, o.color || '#e8553d');
    // long hair behind (female)
    if (o.gender === 'f' && cls !== 'templekid') {
      c.beginPath(); c.moveTo(-12, Y(-50)); c.quadraticCurveTo(-18, Y(-30), -11, Y(-25)); c.lineTo(11, Y(-25));
      c.quadraticCurveTo(18, Y(-32), 13, Y(-50)); c.closePath(); fs(c, hair);
    }
    // quiver
    if (cls === 'bowlord') { rr(c, -12, Y(-38), 6, 18, 2); fs(c, '#7a4a22'); line(c, -10, Y(-38), -12, Y(-44), '#e33', 2); line(c, -8, Y(-38), -8, Y(-45), '#fff', 2); }
    // legs / robe
    if (L.robe) {
      poly(c, [-13, Y(-2), 13, Y(-2), 9, Y(-32), -9, Y(-32)]); fs(c, L.body);
      ell(c, -5 + lg * 0.3, -1.5, 5, 2.6); fs(c, L.boots); ell(c, 6 - lg * 0.3, -1.5, 5, 2.6); fs(c, L.boots);
      if (cls === 'templekid') { c.beginPath(); c.moveTo(-9, Y(-31)); c.lineTo(11, Y(-6)); c.strokeStyle = L.trim; c.lineWidth = 3; c.stroke(); }
      if (cls === 'archmage') { emoji(c, '✦', -4, Y(-12), 7); emoji(c, '✦', 5, Y(-20), 6); }
    } else {
      [[-5, lg], [5, -lg]].forEach(([lx, off]) => {
        rr(c, lx - 3.5 + off * 0.3, Y(-16), 7, 13, 3); fs(c, L.pants);
        ell(c, lx + 1 + off * 0.5, -2, 5, 3); fs(c, L.boots);
      });
      c.beginPath(); c.moveTo(-10, Y(-14)); c.lineTo(10, Y(-14)); c.lineTo(8.5, Y(-32)); c.quadraticCurveTo(0, Y(-35), -8.5, Y(-32)); c.closePath(); fs(c, L.body);
      rr(c, -10, Y(-18), 20, 4, 1.5); fs(c, cls === 'isan' ? '#fff' : L.trim);
      if (cls === 'isan') for (let i = -9; i < 10; i += 4) { c.fillStyle = '#d84a3a'; c.fillRect(i, Y(-18), 2, 4); }
      if (cls === 'gambler') { circ(c, 0, Y(-27), 1.3); fs(c, '#f2c94c', null); circ(c, 0, Y(-22), 1.3); fs(c, '#f2c94c', null); }
      if (cls === 'slingshot') { poly(c, [-3, Y(-33), 3, Y(-33), 0, Y(-24)]); fs(c, L.trim); }
    }
    // shoulder pads
    if (cls === 'warlord') { circ(c, -9, Y(-31), 5); fs(c, '#aab4be'); circ(c, 9, Y(-31), 5); fs(c, '#aab4be'); }
    // back arm
    if (wai) { limb(c, -7, Y(-30), 1, Y(-34), L.body, 4.5); }
    else if (victory) { limb(c, -7, Y(-30), -14, Y(-48), L.body, 4.5); circ(c, -14, Y(-49), 3); fs(c, SKIN, OUT, 1.5); }
    else { limb(c, -7, Y(-30), -11, Y(-20), L.body, 4.5); circ(c, -11, Y(-19), 3); fs(c, SKIN, OUT, 1.5); }
    // scarf knot
    rr(c, -8, Y(-35), 16, 5, 2.5); fs(c, o.color || '#e8553d');
    // head
    circ(c, 1, Y(-44), 12.5); fs(c, cls === 'templekid' ? '#f0c79c' : SKIN);
    // face
    const ey = Y(-44);
    if (cls === 'gambler') {
      rr(c, -5, ey - 3.5, 7, 5, 2); fs(c, '#15151c', null); rr(c, 3.5, ey - 3.5, 7, 5, 2); fs(c, '#15151c', null);
      line(c, 2, ey - 2, 3.5, ey - 2, '#15151c', 1.5);
    } else if (cls === 'bowlord') {
      circ(c, -1.5, ey, 3.2); fs(c, '#fff', OUT, 1); circ(c, 6.5, ey, 3.2); fs(c, '#fff', OUT, 1);
      circ(c, 0.3, ey + 0.5, 1.6); fs(c, OUT, null); circ(c, 4.7, ey + 0.5, 1.6); fs(c, OUT, null);
    } else {
      ell(c, -1.5, ey, 1.7, 2.5); fs(c, OUT, null); ell(c, 6, ey, 1.7, 2.5); fs(c, OUT, null);
      circ(c, -1, ey - 1, 0.6); fs(c, '#fff', null); circ(c, 6.5, ey - 1, 0.6); fs(c, '#fff', null);
    }
    if (o.gender === 'f') { line(c, -3.5, ey - 3, -4.5, ey - 4, OUT, 1); line(c, 8, ey - 3, 9, ey - 4, OUT, 1); }
    ell(c, -5, ey + 4, 2.6, 1.5); c.fillStyle = 'rgba(255,120,120,.45)'; c.fill();
    ell(c, 9.5, ey + 4, 2.6, 1.5); c.fill();
    if (cls === 'warlord') { line(c, -4, ey - 5, 1, ey - 3, OUT, 1.8); line(c, 4, ey - 3, 9, ey - 5, OUT, 1.8); }
    if (cls === 'archmage' || hurt) { ell(c, 2.5, ey + 6, 2.4, 2.2); fs(c, '#7a2a2a', OUT, 1); }
    else { c.beginPath(); c.arc(2.5, ey + 4.5, 2.4, 0.2, Math.PI - 0.2); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(); }
    // hair & hats
    const hy = Y(-44);
    if (cls !== 'templekid') {
      if (o.gender === 'f') {
        c.beginPath(); c.moveTo(-12, hy + 2); c.quadraticCurveTo(-14, hy - 15, 1, hy - 14); c.quadraticCurveTo(16, hy - 15, 14, hy + 2);
        c.quadraticCurveTo(10, hy - 6, 4, hy - 7); c.quadraticCurveTo(-4, hy - 5, -12, hy + 2); c.closePath(); fs(c, hair);
      } else {
        poly(c, [-12, hy + 1, -13, hy - 8, -8, hy - 14, 1, hy - 15, 10, hy - 14, 14, hy - 7, 13.5, hy - 1, 10, hy - 6, 6, hy - 3, 2, hy - 7, -3, hy - 3, -8, hy - 6]); fs(c, hair);
        if (cls === 'warlord') { poly(c, [-6, hy - 14, -4, hy - 21, 0, hy - 15, 4, hy - 22, 7, hy - 14]); fs(c, hair); }
      }
    } else {
      c.beginPath(); c.arc(1, hy, 12.5, Math.PI * 1.05, TAU * 0.98); c.strokeStyle = 'rgba(80,90,110,.35)'; c.lineWidth = 3; c.stroke();
    }
    switch (cls) {
      case 'warlord': rr(c, -12, hy - 9, 26, 4, 2); fs(c, '#d2261f'); break;
      case 'shaman':
        c.beginPath(); c.moveTo(-15, hy - 7); c.lineTo(16, hy - 7); c.lineTo(5, hy - 14); c.quadraticCurveTo(2, hy - 30, 12, hy - 34); c.quadraticCurveTo(-4, hy - 30, -4, hy - 14); c.closePath(); fs(c, L.body);
        rr(c, -15, hy - 9, 31, 4, 2); fs(c, L.trim); break;
      case 'archmage':
        poly(c, [-15, hy - 7, 17, hy - 7, 4, hy - 38]); fs(c, L.body); rr(c, -15, hy - 9, 32, 4, 2); fs(c, L.trim);
        emoji(c, '☾', 3, hy - 20, 9); break;
      case 'slingshot':
        c.beginPath(); c.arc(1, hy - 6, 13, Math.PI, TAU); c.closePath(); fs(c, '#d8352b');
        rr(c, -18, hy - 8, 10, 4, 2); fs(c, '#b0261e'); break;
      case 'bowlord':
        c.beginPath(); c.arc(1, hy - 1, 15, Math.PI * 0.95, TAU * 1.02); c.lineTo(15, hy + 8); c.lineTo(12, hy); c.arc(1, hy, 12, 0, Math.PI, true); c.lineTo(-13, hy + 8); c.closePath(); fs(c, L.body); break;
      case 'isan':
        poly(c, [-22, hy - 8, 24, hy - 8, 1, hy - 24]); fs(c, '#e2c27a');
        line(c, -12, hy - 11, 14, hy - 11, '#b8964a', 1.2); line(c, -5, hy - 16, 7, hy - 16, '#b8964a', 1.2); break;
      case 'gambler':
        rr(c, -16, hy - 11, 34, 4, 2); fs(c, '#15151c'); rr(c, -9, hy - 22, 20, 12, 4); fs(c, '#15151c'); rr(c, -9, hy - 14, 20, 3, 1); fs(c, '#d2261f', null); break;
    }
    // front arm + weapon
    const hx = wai ? 3 : victory ? 15 : attack ? 16 : 12, hyy = wai ? Y(-34) : victory ? Y(-50) : attack ? Y(-30) : Y(-21);
    const W = { commoner: 'woodSword', warlord: 'bigSword', shaman: 'crookedStaff', archmage: 'orbStaff', slingshot: 'slingshot', bowlord: 'bow', isan: 'basket', gambler: 'dice', templekid: 'bowl' }[cls];
    const ang = victory ? -0.25 + Math.sin(t * 7) * 0.15 : attack ? 1.1 : (W === 'bigSword' ? -0.5 : W === 'woodSword' ? 0.15 : 0);
    if (W !== 'bow' && !wai) weapon(c, W, hx, hyy, ang, t);
    limb(c, 7, Y(-30), hx, hyy, L.body, 4.5); circ(c, hx, hyy, 3); fs(c, SKIN, OUT, 1.5);
    if (wai) { circ(c, 1, Y(-35), 3); fs(c, SKIN, OUT, 1.5); }
    if (W === 'bow') weapon(c, W, hx + 2, hyy - 4, victory ? -0.9 : attack ? 0.4 : 0, t);
    c.restore();
  }

  /* ------------------------------------------------------------ monsters
   * Each: fn(c, t, o) drawn at origin (feet), facing LEFT. */
  const MON = {};
  MON.slime = (c, t) => {
    const k = Math.sin(t * 4) * 0.06;
    c.save(); c.scale(1 + k, 1 - k);
    ell(c, 0, -1, 26, 5); fs(c, '#5a9a3a');                           // banana leaf
    c.beginPath(); c.moveTo(-22, 0); c.bezierCurveTo(-27, -20, -14, -38, 0, -38); c.bezierCurveTo(14, -38, 27, -20, 22, 0); c.closePath();
    const g = c.createLinearGradient(0, -38, 0, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e5ddc6'); fs(c, g);
    const r = U.seeded(7);
    for (let i = 0; i < 14; i++) { ell(c, -16 + r() * 32, -30 + r() * 26, 2.4, 1.2, r() * 3); fs(c, '#efe8d4', 'rgba(150,130,90,.5)', 0.6); }
    ell(c, -8, -18, 3, 4.2); fs(c, OUT, null); ell(c, 5, -18, 3, 4.2); fs(c, OUT, null);
    circ(c, -7, -19.5, 1.1); fs(c, '#fff', null); circ(c, 6, -19.5, 1.1); fs(c, '#fff', null);
    c.beginPath(); c.moveTo(-4, -11); c.quadraticCurveTo(-2.5, -8, -1, -11); c.quadraticCurveTo(0.5, -8, 2, -11); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
    ell(c, 12, -28, 4, 2.5, -0.6); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
    c.restore();
  };
  MON.wolf = (c, t) => {
    const b = Math.sin(t * 6) * 1.5;
    c.beginPath(); c.moveTo(22, -24); c.quadraticCurveTo(40, -34 + b, 36, -46 + b); c.quadraticCurveTo(30, -30, 18, -20); c.closePath(); fs(c, '#7d838e');
    [[-14, 0], [-6, 0], [10, 0], [18, 0]].forEach(([lx], i) => { rr(c, lx - 3, -18, 6, 18 + (i % 2 ? b * 0.5 : -b * 0.5), 2.5); fs(c, '#6f757f'); });
    ell(c, 2, -24, 25, 12); fs(c, '#8b919c');
    ell(c, 2, -18, 18, 5); c.fillStyle = '#b8bec8'; c.fill();
    circ(c, -22, -34, 11); fs(c, '#8b919c');
    ell(c, -33, -29, 9, 5.5); fs(c, '#a2a8b2');
    circ(c, -40, -31, 2.4); fs(c, OUT, null);
    poly(c, [-24, -42, -20, -54, -15, -41]); fs(c, '#7d838e'); poly(c, [-17, -41, -11, -51, -10, -38]); fs(c, '#7d838e');
    ell(c, -25, -36, 2.4, 2); fs(c, '#ffd23a', OUT, 1); circ(c, -25.5, -36, 1); fs(c, OUT, null);
    poly(c, [-38, -25, -36, -21, -34, -25]); fs(c, '#fff', OUT, 0.8); poly(c, [-32, -25, -30, -21, -28, -25]); fs(c, '#fff', OUT, 0.8);
    ell(c, -33, -19 + Math.abs(Math.sin(t * 2)) * 4, 1.4, 2.4); c.fillStyle = '#9fd6ff'; c.fill();
  };
  MON.kongkoi = (c, t) => {
    const hop = Math.abs(Math.sin(t * 3.2)) * 9;
    shadow(c, 0, 0, 14, 4, 0.2);
    c.save(); c.translate(0, -hop);
    rr(c, -2.5, -18, 5, 18, 2); fs(c, '#d6e2de');
    c.beginPath(); c.moveTo(-15, -16); for (let i = 0; i <= 6; i++) c.lineTo(-15 + i * 5, -16 + (i % 2 ? 5 : 0)); c.lineTo(11, -50); c.lineTo(-11, -50); c.closePath(); fs(c, '#eef2f4');
    limb(c, -10, -46, -16, -24, '#d6e2de', 3.5); limb(c, 10, -46, 14, -26, '#d6e2de', 3.5);
    c.beginPath(); c.moveTo(-14, -52); c.quadraticCurveTo(-18, -34, -12, -28); c.lineTo(12, -28); c.quadraticCurveTo(18, -36, 14, -52); c.closePath(); fs(c, '#141418');
    circ(c, 0, -58, 11.5); fs(c, '#d8e4e0');
    c.beginPath(); c.arc(0, -58, 12.5, Math.PI * 1.02, TAU * 0.98); c.lineTo(9, -52); c.lineTo(4, -60); c.lineTo(-3, -55); c.lineTo(-10, -50); c.closePath(); fs(c, '#141418');
    glow(c, -4, -54, 5, '#ff2a2a', 0.8); circ(c, -4, -54, 1.6); fs(c, '#ff4040', null);
    ell(c, -2, -49, 2.5, 3); fs(c, '#300', null);
    c.restore();
  };
  MON.mushroom = (c, t) => {
    const w = Math.sin(t * 5) * 2;
    rr(c, -9, -8 + w * 0.2, 6, 8, 2); fs(c, '#caa0d8'); rr(c, 3, -8 - w * 0.2, 6, 8, 2); fs(c, '#caa0d8');
    rr(c, -12, -34, 24, 28, 9); fs(c, '#f2e6d8');
    ell(c, -4, -22, 2, 3); fs(c, OUT, null); ell(c, 5, -22, 2, 3); fs(c, OUT, null);
    c.beginPath(); c.arc(0.5, -15, 3, 0, Math.PI); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke();
    limb(c, -11, -24, -19, -16 + w, '#f2e6d8', 3); limb(c, 11, -24, 19, -18 - w, '#f2e6d8', 3);
    c.beginPath(); c.moveTo(-30, -34); c.quadraticCurveTo(-28, -64, 0, -64); c.quadraticCurveTo(28, -64, 30, -34); c.quadraticCurveTo(0, -40, -30, -34); c.closePath(); fs(c, '#8b3fb0');
    [[-16, -46, 5], [0, -56, 4], [14, -44, 5.5], [-2, -43, 3]].forEach(([sx, sy, r]) => { circ(c, sx, sy, r); fs(c, '#f4e9ff', null); });
    for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * 1.6; circ(c, Math.cos(a) * 26, -60 - ((t * 20 + i * 15) % 30), 1.8); c.fillStyle = 'rgba(190,120,230,.7)'; c.fill(); }
  };
  MON.scorpion = (c, t, o) => {
    const k = (o && o.scale) || 1, b = Math.sin(t * 4) * 2;
    const body = (o && o.color) || '#d4a24c', dark = U.shade(body, -0.25);
    for (let i = 0; i < 4; i++) { const lx = -10 + i * 9; limb(c, lx, -12, lx - 6, 0, dark, 2.5); limb(c, lx + 2, -12, lx + 8, 0, dark, 2.5); }
    ell(c, 4, -14, 24, 10); fs(c, body);
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(4 + (i - 1.5) * 10, -14, 10, -1.2, 1.2); c.strokeStyle = dark; c.lineWidth = 1.2; c.stroke(); }
    const seg = [[26, -18], [36, -28], [40, -42], [34, -54], [22, -58 + b]];
    for (let i = 0; i < seg.length; i++) { circ(c, seg[i][0], seg[i][1], 6.5 - i * 0.6); fs(c, body); }
    poly(c, [18, -60 + b, 10, -55 + b, 19, -52 + b]); fs(c, '#6b1d1d');
    limb(c, -16, -14, -28, -18, body, 4); limb(c, -28, -18, -34, -26, body, 4);
    c.beginPath(); c.moveTo(-34, -26); c.arc(-38, -30, 7, 0.3, 5.2); c.closePath(); fs(c, body);
    circ(c, -16, -20, 2); fs(c, OUT, null); circ(c, -11, -21, 2); fs(c, OUT, null);
    void k;
  };
  MON.mummy = (c, t) => {
    const b = Math.sin(t * 3) * 1;
    rr(c, -8, -18, 7, 18, 3); fs(c, '#e6dcc2'); rr(c, 1, -18, 7, 18, 3); fs(c, '#e6dcc2');
    rr(c, -12, -44 + b, 24, 28, 6); fs(c, '#efe5cc');
    for (let i = 0; i < 6; i++) line(c, -12, -40 + i * 4.5 + b, 12, -42 + i * 4.5 + b, '#c9bb96', 1.2);
    limb(c, -11, -40 + b, -24, -34 + b, '#efe5cc', 5); limb(c, 11, -40 + b, 24, -36 + b, '#efe5cc', 5);
    circ(c, 0, -54 + b, 11); fs(c, '#efe5cc');
    for (let i = 0; i < 4; i++) line(c, -10, -60 + i * 4 + b, 10, -58 + i * 4 + b, '#c9bb96', 1.2);
    rr(c, -10, -58 + b, 9, 5, 2); fs(c, '#111', null); rr(c, 1, -58 + b, 9, 5, 2); fs(c, '#111', null);
    line(c, -1, -56 + b, 1, -56 + b, '#111', 1.5);
    c.beginPath(); c.arc(0, -55 + b, 13, Math.PI * 1.05, TAU * 0.95); c.strokeStyle = '#d33'; c.lineWidth = 2.5; c.stroke();
    rr(c, -15, -58 + b, 5, 8, 2); fs(c, '#d33'); rr(c, 10, -58 + b, 5, 8, 2); fs(c, '#d33');
    emoji(c, '♪', -20 + Math.sin(t * 2) * 3, -70 - (t * 10 % 10), 10);
  };
  MON.shadow = (c, t) => {
    glow(c, 0, -40, 44, '#4b1f6b', 0.55);
    c.beginPath(); c.moveTo(-20, 0);
    for (let i = 0; i <= 8; i++) c.lineTo(-20 + i * 5, -Math.abs(Math.sin(t * 4 + i)) * 6);
    c.quadraticCurveTo(26, -40, 14, -62); c.quadraticCurveTo(0, -78, -14, -62); c.quadraticCurveTo(-26, -40, -20, 0); c.closePath();
    const g = c.createLinearGradient(0, -78, 0, 0); g.addColorStop(0, '#1b1026'); g.addColorStop(1, 'rgba(27,16,38,.4)'); fs(c, g, 'rgba(120,60,160,.6)');
    poly(c, [-12, -64, -18, -80, -6, -68]); fs(c, '#1b1026', 'rgba(120,60,160,.6)'); poly(c, [12, -64, 18, -80, 6, -68]); fs(c, '#1b1026', 'rgba(120,60,160,.6)');
    glow(c, -6, -58, 7, '#ff2d2d', 0.9); glow(c, 6, -58, 7, '#ff2d2d', 0.9);
    ell(c, -6, -58, 3, 1.8); fs(c, '#ffdcdc', null); ell(c, 6, -58, 3, 1.8); fs(c, '#ffdcdc', null);
    c.beginPath(); c.moveTo(-8, -48); c.quadraticCurveTo(0, -42, 8, -48); c.strokeStyle = '#ff5a5a'; c.lineWidth = 1.5; c.stroke();
  };
  MON.deathknight = (c, t) => {
    const b = Math.sin(t * 2.5);
    c.beginPath(); c.moveTo(-10, -52); c.lineTo(-20, -4); c.lineTo(-12, -8); c.lineTo(-6, -2); c.lineTo(0, -8); c.lineTo(4, -48); c.closePath(); fs(c, '#3a1020');
    rr(c, -9, -20, 7, 20, 2); fs(c, '#2a2d36'); rr(c, 2, -20, 7, 20, 2); fs(c, '#2a2d36');
    rr(c, -13, -50, 26, 32, 5); fs(c, '#2f3340');
    line(c, -10, -36, 10, -36, '#5a6070', 2);
    circ(c, -12, -48, 6); fs(c, '#434857'); circ(c, 12, -48, 6); fs(c, '#434857');
    c.save(); c.translate(-18, -30); c.rotate(-0.4 + b * 0.05);
    glow(c, 0, -20, 22, '#4cc3ff', 0.35);
    poly(c, [-3, 0, -3, -44, 0, -50, 3, -44, 3, 0]); fs(c, '#a9dcff');
    rr(c, -8, -2, 16, 4, 2); fs(c, '#434857'); c.restore();
    limb(c, -10, -44, -18, -30, '#2f3340', 5);
    circ(c, 0, -60, 11); fs(c, '#e8e6de');
    poly(c, [-12, -64, -18, -76, -8, -68]); fs(c, '#2f3340'); poly(c, [12, -64, 18, -76, 8, -68]); fs(c, '#2f3340');
    c.beginPath(); c.arc(0, -61, 12, Math.PI, TAU); c.lineTo(12, -58); c.lineTo(-12, -58); c.closePath(); fs(c, '#2f3340');
    circ(c, -4, -58, 3); fs(c, '#111', null); circ(c, 4, -58, 3); fs(c, '#111', null);
    glow(c, -4, -58, 5, '#4cc3ff', 0.9); glow(c, 4, -58, 5, '#4cc3ff', 0.9);
    for (let i = -2; i <= 2; i++) line(c, i * 2.5, -52, i * 2.5, -49, '#444', 1.2);
  };
  MON.minion = (c, t) => {
    const f = Math.sin(t * 10) * 0.35;
    c.save(); c.translate(-10, -30); c.rotate(-0.4 - f);
    poly(c, [0, 0, -20, -12, -16, -2, -22, 2, -12, 6]); fs(c, '#6a1622'); c.restore();
    c.save(); c.translate(10, -30); c.rotate(0.4 + f);
    poly(c, [0, 0, 20, -12, 16, -2, 22, 2, 12, 6]); fs(c, '#6a1622'); c.restore();
    c.beginPath(); c.moveTo(8, -8); c.quadraticCurveTo(26, -6, 24, -20); c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = '#c62b3b'; c.lineWidth = 2; c.stroke();
    poly(c, [24, -20, 20, -25, 28, -24]); fs(c, '#c62b3b');
    rr(c, -7, -10, 5, 10, 2); fs(c, '#a81f2d'); rr(c, 2, -10, 5, 10, 2); fs(c, '#a81f2d');
    ell(c, 0, -24, 14, 16); fs(c, '#d8323f');
    poly(c, [-9, -36, -14, -48, -4, -39]); fs(c, '#f2e6d0'); poly(c, [9, -36, 14, -48, 4, -39]); fs(c, '#f2e6d0');
    ell(c, -5, -27, 3, 3.6); fs(c, '#ffe45c', OUT, 1); ell(c, 5, -27, 3, 3.6); fs(c, '#ffe45c', OUT, 1);
    circ(c, -5.5, -27, 1.3); fs(c, OUT, null); circ(c, 4.5, -27, 1.3); fs(c, OUT, null);
    c.beginPath(); c.moveTo(-6, -18); c.quadraticCurveTo(0, -13, 6, -18); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    poly(c, [-3, -17, -1.5, -14, 0, -17]); fs(c, '#fff', null);
    ell(c, -16, -12, 8, 9); fs(c, '#c8a060'); line(c, -20, -20, -12, -20, '#8a6a30', 2); emoji(c, '💰', -16, -11, 9);
  };
  MON.ironfang = (c, t) => {
    const b = Math.sin(t * 2.4) * 1;
    rr(c, -13, -24, 10, 24, 3); fs(c, '#4b3a2e'); rr(c, 3, -24, 10, 24, 3); fs(c, '#4b3a2e');
    rr(c, -20, -64 + b, 40, 44, 10); fs(c, '#7b818c');
    line(c, -18, -48 + b, 18, -48 + b, '#5a606b', 3); circ(c, 0, -40 + b, 4); fs(c, '#c9a14a');
    circ(c, -20, -60 + b, 9); fs(c, '#9aa2ae'); circ(c, 20, -60 + b, 9); fs(c, '#9aa2ae');
    ell(c, 0, -78 + b, 17, 15); fs(c, '#7a4a2a');
    ell(c, -13, -72 + b, 9, 7); fs(c, '#e8a09a');
    circ(c, -16, -72 + b, 1.6); fs(c, OUT, null); circ(c, -11, -72 + b, 1.6); fs(c, OUT, null);
    poly(c, [-9, -66 + b, -14, -80 + b, -6, -69 + b]); fs(c, '#fff'); poly(c, [-2, -66 + b, 2, -80 + b, 3, -68 + b]); fs(c, '#fff');
    poly(c, [0, -90 + b, 6, -100 + b, 10, -88 + b]); fs(c, '#6a3a1e'); poly(c, [-10, -90 + b, -12, -101 + b, -3, -92 + b]); fs(c, '#6a3a1e');
    ell(c, -3, -84 + b, 3, 2.4); fs(c, '#ffd23a', OUT, 1); circ(c, -3.5, -84 + b, 1.2); fs(c, OUT, null);
    circ(c, -28, -42 + b, 16); fs(c, '#6d737e'); circ(c, -28, -42 + b, 10); fs(c, '#8d94a0');
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; poly(c, [-28 + Math.cos(a) * 16, -42 + b + Math.sin(a) * 16, -28 + Math.cos(a + 0.2) * 22, -42 + b + Math.sin(a + 0.2) * 22, -28 + Math.cos(a + 0.4) * 16, -42 + b + Math.sin(a + 0.4) * 16]); fs(c, '#aab'); }
  };
  MON.dryad = (c, t) => {
    const sw = Math.sin(t * 1.8) * 3;
    c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(-8, -10, -10, -50); c.lineTo(10, -50); c.quadraticCurveTo(8, -10, 22, 0); c.closePath(); fs(c, '#4a3322');
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 5, -8); c.quadraticCurveTo(i * 8, -30, i * 3, -48); c.strokeStyle = '#2f1f14'; c.lineWidth = 1.5; c.stroke(); }
    c.beginPath(); c.moveTo(-10, -44); c.quadraticCurveTo(-30, -44 + sw, -36, -28); c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#3d7a3a'; c.lineWidth = 4; c.stroke();
    c.beginPath(); c.moveTo(10, -44); c.quadraticCurveTo(28, -50 - sw, 34, -30); c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#3d7a3a'; c.lineWidth = 4; c.stroke();
    ell(c, 0, -62, 12, 14); fs(c, '#6d5a3e');
    for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; const r = 22 + (i % 2) * 5; ell(c, Math.cos(a) * r * 0.9, -66 + Math.sin(a) * r * 0.8 + sw * 0.2, 9, 6, a); fs(c, i % 2 ? '#2d5a36' : '#5b2a6b'); }
    glow(c, -4, -63, 6, '#8cff6a', 0.9); glow(c, 5, -63, 6, '#8cff6a', 0.9);
    ell(c, -4, -63, 2.4, 1.6); fs(c, '#eaffd8', null); ell(c, 5, -63, 2.4, 1.6); fs(c, '#eaffd8', null);
    c.beginPath(); c.moveTo(-4, -55); c.quadraticCurveTo(0.5, -52, 5, -55); c.strokeStyle = '#1a1208'; c.lineWidth = 1.5; c.stroke();
  };
  MON.sandgeneral = (c, t) => {
    MON.scorpion(c, t, { color: '#b9863a' });
    const b = Math.sin(t * 2.2);
    rr(c, -14, -52 + b, 22, 34, 7); fs(c, '#c9a45a');
    line(c, -12, -40 + b, 6, -40 + b, '#8a6a2a', 2);
    circ(c, -3, -62 + b, 10); fs(c, '#d9a878');
    c.beginPath(); c.arc(-3, -64 + b, 11.5, Math.PI, TAU); c.lineTo(8, -60 + b); c.lineTo(-14, -60 + b); c.closePath(); fs(c, '#b8862e');
    poly(c, [-3, -76 + b, 0, -86 + b, 3, -76 + b]); fs(c, '#d2261f');
    ell(c, -7, -61 + b, 1.6, 2.2); fs(c, OUT, null); ell(c, -1, -61 + b, 1.6, 2.2); fs(c, OUT, null);
    c.save(); c.translate(-20, -44 + b); c.rotate(-0.25);
    limb(c, 0, 26, 0, -40, '#6b4a2a', 3); poly(c, [-4, -40, 0, -52, 4, -40]); fs(c, '#d7dee6'); c.restore();
    limb(c, -12, -46 + b, -20, -40 + b, '#c9a45a', 5);
  };
  MON.monkey = (c, t) => {
    const b = Math.abs(Math.sin(t * 5)) * 3;
    c.beginPath(); c.moveTo(8, -14 - b); c.bezierCurveTo(30, -8, 32, -40, 18, -40); c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#8a5a30'; c.lineWidth = 3; c.stroke();
    rr(c, -9, -12 - b, 7, 12, 3); fs(c, '#7a4a22'); rr(c, 3, -12 - b, 7, 12, 3); fs(c, '#7a4a22');
    ell(c, 0, -22 - b, 12, 13); fs(c, '#8a5a30');
    ell(c, -2, -20 - b, 7, 8); fs(c, '#e8c49a', null);
    circ(c, -14, -44 - b, 5); fs(c, '#e8c49a'); circ(c, 10, -44 - b, 5); fs(c, '#e8c49a');
    circ(c, -2, -42 - b, 12); fs(c, '#8a5a30');
    ell(c, -4, -39 - b, 8, 7); fs(c, '#f0d2a8');
    circ(c, -7, -43 - b, 1.8); fs(c, OUT, null); circ(c, -1, -43 - b, 1.8); fs(c, OUT, null);
    c.beginPath(); c.arc(-4, -37 - b, 3, 0.1, Math.PI - 0.1); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke();
    limb(c, 8, -28 - b, 14, -18 - b, '#8a5a30', 4);
    limb(c, -8, -28 - b, -18, -40 - b, '#8a5a30', 4);
    circ(c, -20, -47 - b, 7); fs(c, '#6b4a22'); circ(c, -22, -49 - b, 1.3); fs(c, '#3a2412', null); circ(c, -18, -49 - b, 1.3); fs(c, '#3a2412', null);
  };
  MON.tiger = (c, t) => {
    const b = Math.sin(t * 5) * 1.5;
    c.beginPath(); c.moveTo(26, -28); c.quadraticCurveTo(48, -32 + b, 44, -50 + b); c.strokeStyle = OUT; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#f08a24'; c.lineWidth = 4.5; c.stroke();
    [[-16, 0], [-6, 1], [12, 0], [22, 1]].forEach(([lx, k]) => { rr(c, lx - 3.5, -20, 7, 20 + (k ? b * 0.5 : -b * 0.5), 3); fs(c, '#e07a1a'); });
    ell(c, 4, -27, 29, 14); fs(c, '#f08a24');
    ell(c, 4, -18, 20, 5); c.fillStyle = '#fff4e0'; c.fill();
    for (let i = -14; i <= 24; i += 8) { c.beginPath(); c.moveTo(i, -40); c.quadraticCurveTo(i + 4, -30, i, -22); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke(); }
    circ(c, -24, -36, 13); fs(c, '#f08a24');
    c.beginPath(); c.arc(-30, -47, 5, Math.PI, TAU); c.closePath(); fs(c, '#f08a24'); c.beginPath(); c.arc(-17, -47, 5, Math.PI, TAU); c.closePath(); fs(c, '#f08a24');
    ell(c, -33, -31, 9, 6.5); fs(c, '#fff4e0');
    poly(c, [-40, -34, -36, -34, -38, -31]); fs(c, '#3a2412', null);
    ell(c, -28, -39, 2.6, 2.2); fs(c, '#b9e04a', OUT, 1); circ(c, -28.5, -39, 1); fs(c, OUT, null);
    line(c, -22, -46, -20, -40, OUT, 2); line(c, -16, -44, -16, -38, OUT, 2);
    poly(c, [-38, -27, -36, -23, -34, -27]); fs(c, '#fff', OUT, 0.8);
  };
  MON.wyrm = (c, t) => {
    const sway = Math.sin(t * 2) * 6;
    ell(c, 0, -2, 34, 9); fs(c, '#d9b066');
    for (let i = 0; i < 6; i++) {
      const k = i / 5, x = sway * k * k - 14 * k, y = -10 - i * 13;
      circ(c, x, y, 16 - i * 1.3); fs(c, i % 2 ? '#b88a4a' : '#c89a5a');
    }
    const hx = sway - 22, hy = -84;
    circ(c, hx, hy, 15); fs(c, '#a0763a');
    ell(c, hx - 9, hy + 3, 7, 10); fs(c, '#5a1a1a');
    for (let i = 0; i < 4; i++) { poly(c, [hx - 13 + i * 3, hy - 5 + i * 5, hx - 9 + i * 3, hy - 3 + i * 5, hx - 12 + i * 3, hy - 1 + i * 5]); fs(c, '#fff', null); }
    circ(c, hx + 2, hy - 7, 2.4); fs(c, '#ff3b2f', OUT, 1); circ(c, hx + 8, hy - 5, 2); fs(c, '#ff3b2f', OUT, 1);
    for (let i = 0; i < 3; i++) { const p = (t * 0.7 + i / 3) % 1; circ(c, -20 + i * 18, -4 - p * 16, 2 + p * 2); c.fillStyle = `rgba(217,176,102,${1 - p})`; c.fill(); }
  };
  MON.golem = (c, t) => {
    const b = Math.sin(t * 2) * 1, pulse = 0.6 + Math.sin(t * 4) * 0.3;
    rr(c, -18, -26, 14, 26, 3); fs(c, '#3a2a2e'); rr(c, 4, -26, 14, 26, 3); fs(c, '#3a2a2e');
    poly(c, [-26, -24 + b, -30, -62 + b, -14, -80 + b, 14, -82 + b, 30, -62 + b, 26, -24 + b]); fs(c, '#4a3a3e');
    glow(c, 0, -50 + b, 30, '#ff7a2a', 0.35 * pulse);
    c.beginPath(); c.moveTo(-18, -70 + b); c.lineTo(-6, -58 + b); c.lineTo(-12, -44 + b); c.lineTo(2, -32 + b); c.moveTo(10, -74 + b); c.lineTo(4, -60 + b); c.lineTo(16, -48 + b);
    c.strokeStyle = `rgba(255,140,40,${pulse})`; c.lineWidth = 3; c.stroke();
    circ(c, -34, -42 + b, 11); fs(c, '#4a3a3e'); circ(c, 32, -46 + b, 11); fs(c, '#4a3a3e');
    line(c, -38, -44 + b, -30, -40 + b, '#ff8a2a', 2); line(c, 28, -48 + b, 36, -44 + b, '#ff8a2a', 2);
    rr(c, -11, -98 + b, 22, 18, 6); fs(c, '#3a2a2e');
    glow(c, -4, -90 + b, 6, '#ffb03a', 1); glow(c, 5, -90 + b, 6, '#ffb03a', 1);
    ell(c, -4, -90 + b, 2.6, 1.8); fs(c, '#fff2a0', null); ell(c, 5, -90 + b, 2.6, 1.8); fs(c, '#fff2a0', null);
    for (let i = 0; i < 2; i++) { const p = (t * 0.5 + i / 2) % 1; circ(c, -20 + i * 38, -30 + p * 28, 2.5); c.fillStyle = `rgba(255,120,40,${1 - p})`; c.fill(); }
  };
  MON.demonlord = (c, t, o) => {
    const form = (o && o.form) || 1;
    const cape = form === 1 ? '#4b2378' : form === 2 ? '#8e1328' : '#16060a';
    const aura = form === 1 ? '#9b5bff' : form === 2 ? '#ff3b3b' : '#ff1a1a';
    const b = Math.sin(t * 2) * 1.5;
    glow(c, 0, -60, 80 + Math.sin(t * 3) * 6, aura, form === 3 ? 0.55 : 0.35);
    c.beginPath(); c.moveTo(-18, -94 + b); c.quadraticCurveTo(-50, -40, -44, 0); c.lineTo(44, 0); c.quadraticCurveTo(50, -40, 18, -94 + b); c.closePath(); fs(c, cape);
    rr(c, -16, -30, 12, 30, 4); fs(c, '#221a2a'); rr(c, 4, -30, 12, 30, 4); fs(c, '#221a2a');
    rr(c, -24, -94 + b, 48, 66, 12); fs(c, '#2b2236');
    poly(c, [-24, -94 + b, 0, -60 + b, 24, -94 + b, 24, -80 + b, 0, -48 + b, -24, -80 + b]); fs(c, '#433554');
    circ(c, 0, -62 + b, 6); fs(c, aura, null);
    circ(c, -26, -90 + b, 10); fs(c, '#433554'); circ(c, 26, -90 + b, 10); fs(c, '#433554');
    poly(c, [-30, -96 + b, -38, -110 + b, -22, -99 + b]); fs(c, '#6a5a7a'); poly(c, [30, -96 + b, 38, -110 + b, 22, -99 + b]); fs(c, '#6a5a7a');
    limb(c, -26, -84 + b, -40, -50 + b, '#2b2236', 8); limb(c, 26, -84 + b, 40, -52 + b, '#2b2236', 8);
    for (let i = -1; i <= 1; i++) { poly(c, [-40 + i * 3, -48 + b, -43 + i * 4, -38 + b, -38 + i * 3, -46 + b]); fs(c, '#ddd'); }
    circ(c, 0, -110 + b, 15); fs(c, '#6b5a78');
    c.beginPath(); c.moveTo(-10, -120 + b); c.quadraticCurveTo(-30, -130 + b, -26, -150 + b); c.quadraticCurveTo(-20, -134 + b, -4, -124 + b); c.closePath(); fs(c, '#e9e0cc');
    c.beginPath(); c.moveTo(10, -120 + b); c.quadraticCurveTo(30, -130 + b, 26, -150 + b); c.quadraticCurveTo(20, -134 + b, 4, -124 + b); c.closePath(); fs(c, '#e9e0cc');
    poly(c, [-10, -123 + b, -6, -132 + b, 0, -125 + b, 6, -132 + b, 10, -123 + b]); fs(c, '#f2c94c');
    glow(c, -6, -110 + b, 7, aura, 1); glow(c, 6, -110 + b, 7, aura, 1);
    poly(c, [-10, -112 + b, -2, -109 + b, -9, -107 + b]); fs(c, '#fff', null); poly(c, [10, -112 + b, 2, -109 + b, 9, -107 + b]); fs(c, '#fff', null);
    c.beginPath(); c.moveTo(-7, -101 + b); c.lineTo(7, -101 + b); c.strokeStyle = '#1a0a10'; c.lineWidth = 2; c.stroke();
    poly(c, [-5, -101 + b, -4, -97 + b, -3, -101 + b]); fs(c, '#fff', null); poly(c, [3, -101 + b, 4, -97 + b, 5, -101 + b]); fs(c, '#fff', null);
  };
  const MON_H = { slime: 40, wolf: 56, monkey: 60, kongkoi: 74, mushroom: 66, tiger: 62, scorpion: 60, mummy: 72, wyrm: 104, shadow: 82, deathknight: 80, golem: 104, minion: 50, ironfang: 102, dryad: 92, sandgeneral: 90, demonlord: 150 };
  /* Emoji bursts that go with each class's victory pose. */
  const VICTORY_FX = { commoner: '✨', warlord: '💢', shaman: '🔥', archmage: '💬', slingshot: '⭐', bowlord: '🏹', isan: '🍙', gambler: '🪙', templekid: '🙏' };
  const ARMY_SPRITE = { minion: 'minion', B01: 'ironfang', B02: 'dryad', B03: 'sandgeneral', B04: 'demonlord' };

  function drawMonster(c, key, x, y, s, o) {
    o = o || {};
    const fn = MON[key]; if (!fn) return;
    c.save(); c.translate(x, y); c.scale(s * (o.facing || 1), s);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (o.hurt) c.rotate(0.1);
    fn(c, o.t || 0, o);
    c.restore();
  }

  /* ------------------------------------------------------------ NPC portraits */
  function drawNPC(c, kind, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    if (kind === 'scroll') {
      rr(c, -22, -60, 44, 50, 4); fs(c, '#f4e3b5'); ell(c, 0, -60, 24, 5); fs(c, '#d9c08a'); ell(c, 0, -10, 24, 5); fs(c, '#d9c08a');
      for (let i = 0; i < 4; i++) line(c, -14, -48 + i * 9, 14, -48 + i * 9, '#b39766', 2);
      c.restore(); return;
    }
    if (kind === 'darkvoice') {
      glow(c, 0, -40, 50, '#7a1f9b', 0.6);
      circ(c, 0, -44, 20); fs(c, '#0d0610', null);
      glow(c, -7, -46, 8, '#ff2d2d', 1); glow(c, 7, -46, 8, '#ff2d2d', 1);
      c.restore(); return;
    }
    const look = {
      king: { robe: '#b3262e', trim: '#f3ead8', skin: SKIN, hair: '#eeeeee' },
      assistant: { robe: '#2f7a4a', trim: '#f2c94c', skin: SKIN, hair: '#5a3418' },
      villager: { robe: '#8a6a3a', trim: '#e2c27a', skin: '#e8b88a', hair: '#2a1a10' },
    }[kind] || { robe: '#777', trim: '#aaa', skin: SKIN, hair: '#333' };
    c.beginPath(); c.moveTo(-22, 0); c.lineTo(22, 0); c.lineTo(15, -32); c.quadraticCurveTo(0, -38, -15, -32); c.closePath(); fs(c, look.robe);
    if (kind === 'king') { rr(c, -18, -36, 36, 7, 3); fs(c, look.trim); }
    circ(c, 0, -48, 14); fs(c, look.skin);
    ell(c, -4.5, -49, 1.8, 2.5); fs(c, OUT, null); ell(c, 4.5, -49, 1.8, 2.5); fs(c, OUT, null);
    if (kind === 'king') {
      c.beginPath(); c.moveTo(-13, -45); c.quadraticCurveTo(-14, -26, 0, -22); c.quadraticCurveTo(14, -26, 13, -45); c.quadraticCurveTo(0, -38, -13, -45); c.closePath(); fs(c, look.hair);
      poly(c, [-13, -58, -13, -70, -7, -63, 0, -73, 7, -63, 13, -70, 13, -58]); fs(c, '#f2c94c');
      circ(c, 0, -65, 2); fs(c, '#d33', null);
      line(c, -6, -54, -2, -53, OUT, 1.5); line(c, 2, -53, 6, -54, OUT, 1.5);
    } else if (kind === 'assistant') {
      circ(c, -4.5, -49, 4); fs(c, null, OUT, 1.3); circ(c, 4.5, -49, 4); fs(c, null, OUT, 1.3); line(c, -0.5, -49, 0.5, -49, OUT, 1.3);
      c.beginPath(); c.arc(0, -52, 14.5, Math.PI, TAU); c.closePath(); fs(c, look.hair);
      poly(c, [-12, -60, 14, -60, 20, -70, -6, -68]); fs(c, '#2f7a4a');
      c.beginPath(); c.arc(0, -42, 3, 0.2, Math.PI - 0.2); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke();
      rr(c, 12, -30, 8, 20, 3); fs(c, '#f4e3b5');
    } else {
      poly(c, [-24, -55, 24, -55, 0, -72]); fs(c, '#e2c27a');
      c.beginPath(); c.arc(0, -42, 3.5, 0.2, Math.PI - 0.2); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke();
    }
    c.restore();
    void t;
  }

  /* ------------------------------------------------------------ buildings (anchored on tile centre) */
  function drawBuilding(c, code, x, y, s, t, o) {
    o = o || {};
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    switch (code) {
      case 'L01': { // Royal Castle
        rr(c, -34, -44, 68, 42, 3); fs(c, '#ece5d4');
        for (let i = -32; i < 32; i += 10) { rr(c, i, -50, 6, 7, 1); fs(c, '#ece5d4'); }
        c.beginPath(); c.moveTo(-9, -2); c.lineTo(-9, -18); c.arc(0, -18, 9, Math.PI, 0); c.lineTo(9, -2); c.closePath(); fs(c, '#5a3a22');
        [[-40, 16], [24, 16]].forEach(([tx, w]) => {
          rr(c, tx, -66, w, 64, 2); fs(c, '#f4eee0');
          poly(c, [tx - 4, -66, tx + w / 2, -90, tx + w + 4, -66]); fs(c, '#e8912c');
          rr(c, tx + 5, -52, 6, 9, 3); fs(c, '#3a2a55');
        });
        rr(c, -14, -76, 28, 34, 2); fs(c, '#f4eee0');
        poly(c, [-18, -76, 0, -102, 18, -76]); fs(c, '#f2a93b');
        rr(c, -4, -68, 8, 11, 4); fs(c, '#3a2a55');
        line(c, 0, -102, 0, -118, OUT, 2);
        c.beginPath(); c.moveTo(0, -118); c.quadraticCurveTo(10, -115 + Math.sin(t * 4) * 2, 16, -116); c.lineTo(16, -108); c.quadraticCurveTo(8, -108 + Math.sin(t * 4) * 2, 0, -110); c.closePath(); fs(c, '#f2c94c');
        break;
      }
      case 'L02': { // Shop
        rr(c, -28, -40, 56, 38, 3); fs(c, '#fbeccf');
        poly(c, [-35, -40, 0, -64, 35, -40]); fs(c, '#d2452f');
        for (let i = 0; i < 6; i++) { poly(c, [-30 + i * 10, -28, -20 + i * 10, -28, -20 + i * 10, -20, -30 + i * 10, -22]); fs(c, i % 2 ? '#fff' : '#e0453a', OUT, 1.2); }
        rr(c, -7, -18, 14, 16, 2); fs(c, '#7a4a22');
        rr(c, 12, -18, 12, 9, 2); fs(c, '#9fd6ff');
        emoji(c, '💰', 0, -48, 14); break;
      }
      case 'L03': { // Equipment Shop
        rr(c, 14, -70, 10, 26, 2); fs(c, '#6b6b72');
        for (let i = 0; i < 3; i++) { const p = ((t * 0.4 + i / 3) % 1); circ(c, 19 + Math.sin(p * 6) * 3, -74 - p * 30, 4 + p * 5); c.fillStyle = `rgba(200,200,210,${0.6 * (1 - p)})`; c.fill(); }
        rr(c, -30, -42, 60, 40, 3); fs(c, '#9a9aa5');
        for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { rr(c, -28 + i * 15 + (r % 2) * 6, -40 + r * 12, 12, 10, 2); fs(c, null, '#7a7a85', 1); }
        poly(c, [-36, -42, 0, -62, 36, -42]); fs(c, '#4a4a55');
        rr(c, -8, -20, 16, 18, 2); fs(c, '#3a2a1a');
        glow(c, 0, -10, 12, '#ff9a3a', 0.6);
        rr(c, -22, -34, 14, 12, 2); fs(c, '#e8d2a0'); emoji(c, '⚒️', -15, -28, 10); break;
      }
      case 'L04': { // Skillbook Shop
        rr(c, -18, -70, 36, 68, 8); fs(c, '#7d5ab8');
        for (let i = 0; i < 3; i++) { rr(c, -6, -60 + i * 18, 12, 10, 5); fs(c, '#ffe9a8'); }
        poly(c, [-24, -70, 0, -106, 24, -70]); fs(c, '#2e4f9e');
        emoji(c, '★', 0, -110 + Math.sin(t * 3) * 2, 14);
        rr(c, 14, -40, 20, 16, 3); fs(c, '#f4e3b5'); emoji(c, '📚', 24, -32, 11); break;
      }
      case 'L05': { // Temple (Thai wat)
        rr(c, 10, -96, 8, 50, 3); fs(c, '#f2c94c');
        poly(c, [8, -96, 14, -122, 20, -96]); fs(c, '#f2c94c');
        rr(c, -38, -12, 76, 10, 2); fs(c, '#f4f0e6');
        rr(c, -30, -40, 60, 30, 2); fs(c, '#fbf7ee');
        for (let i = -22; i <= 22; i += 11) { rr(c, i - 2.5, -38, 5, 26, 1); fs(c, '#e8b04a', null); }
        poly(c, [-40, -40, 0, -62, 40, -40]); fs(c, '#c0392b');
        poly(c, [-40, -40, -46, -46, -40, -44]); fs(c, '#f2c94c');
        poly(c, [40, -40, 46, -46, 40, -44]); fs(c, '#f2c94c');
        poly(c, [-28, -54, 0, -76, 28, -54]); fs(c, '#d9542f');
        c.beginPath(); c.moveTo(0, -76); c.quadraticCurveTo(3, -86, 8, -84); c.strokeStyle = '#f2c94c'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.moveTo(-40, -40); c.lineTo(0, -62); c.lineTo(40, -40); c.strokeStyle = '#f2c94c'; c.lineWidth = 2; c.stroke();
        rr(c, -6, -28, 12, 16, 5); fs(c, '#8a3a1a'); break;
      }
      case 'L06': { // Larb Shop
        limb(c, -26, -2, -26, -44, '#8b5a2b', 3); limb(c, 26, -2, 26, -44, '#8b5a2b', 3);
        poly(c, [-36, -40, 0, -62, 36, -40, 30, -36, -30, -36]); fs(c, '#d9b566');
        for (let i = -28; i <= 28; i += 7) line(c, i, -38, i * 0.6, -58, '#b8964a', 1);
        rr(c, -28, -22, 56, 20, 3); fs(c, '#a0703a');
        ell(c, -8, -24, 12, 4); fs(c, '#333'); rr(c, -18, -30, 20, 7, 3); fs(c, '#444');
        for (let i = 0; i < 3; i++) { const p = (t * 0.6 + i / 3) % 1; circ(c, -8 + Math.sin(p * 7 + i) * 4, -36 - p * 22, 3 + p * 4); c.fillStyle = `rgba(255,255,255,${0.7 * (1 - p)})`; c.fill(); }
        ell(c, 14, -26, 9, 4); fs(c, '#5a9a3a'); circ(c, 12, -28, 2); fs(c, '#d33', null);
        rr(c, -14, -56, 28, 12, 3); fs(c, '#fff4d6'); emoji(c, '🥗', 0, -50, 9); break;
      }
      case 'L07': { // Horse-racing track
        ell(c, 0, -6, 44, 18); fs(c, '#6fbf4f'); ell(c, 0, -6, 38, 14); fs(c, '#c79a5a'); ell(c, 0, -6, 26, 8); fs(c, '#7fd05a');
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; line(c, Math.cos(a) * 44, -6 + Math.sin(a) * 18, Math.cos(a) * 44, -12 + Math.sin(a) * 18, '#fff', 1.5); }
        rr(c, -20, -40, 40, 18, 2); fs(c, '#e9e2d0'); poly(c, [-24, -40, 24, -40, 20, -50, -20, -50]); fs(c, '#2f6fd6');
        for (let i = -12; i <= 12; i += 12) { line(c, i, -50, i, -62, OUT, 1.5); poly(c, [i, -62, i + 8, -59 + Math.sin(t * 5 + i) * 1.5, i, -56]); fs(c, i ? '#e0453a' : '#f2c94c', null); }
        const a = t * 1.3;
        c.save(); c.translate(Math.cos(a) * 32, -12 + Math.sin(a) * 11); c.scale(Math.sin(a) > 0 ? 1 : -1, 1); emoji(c, '🏇', 0, 0, 13); c.restore(); break;
      }
      case 'B04': { // Demon Lord's Castle
        const ruined = o.ruined;
        const stone = ruined ? '#55505a' : '#211d27';
        if (!ruined) glow(c, 0, -40, 60, '#d62828', 0.3 + Math.sin(t * 2) * 0.08);
        rr(c, -36, -48, 72, 46, 3); fs(c, stone);
        [[-44, 18, ruined ? 60 : 84], [26, 18, ruined ? 50 : 84], [-12, 24, ruined ? 64 : 110]].forEach(([tx, w, h]) => {
          rr(c, tx, -h, w, h - 2, 2); fs(c, stone);
          if (!ruined) { poly(c, [tx - 4, -h, tx + w / 2, -h - 26, tx + w + 4, -h]); fs(c, '#3a1030'); }
          else poly(c, [tx, -h, tx + w * 0.3, -h - 6, tx + w * 0.6, -h + 2, tx + w, -h - 4, tx + w, -h + 4, tx, -h + 4]), fs(c, stone);
          if (!ruined) { rr(c, tx + w / 2 - 3, -h + 14, 6, 10, 3); fs(c, '#ff3b2f', null); }
        });
        c.beginPath(); c.moveTo(-10, -2); c.lineTo(-10, -22); c.arc(0, -22, 10, Math.PI, 0); c.lineTo(10, -2); c.closePath(); fs(c, ruined ? '#3a3540' : '#6b0f14');
        if (!ruined) { line(c, 0, -110, 0, -134, OUT, 2); poly(c, [0, -134, 14, -130 + Math.sin(t * 4) * 2, 0, -124]); fs(c, '#7a1f9b'); }
        break;
      }
    }
    c.restore();
  }

  /* ------------------------------------------------------------ small props */
  function drawChest(c, x, y, s, open, t) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round';
    shadow(c, 0, 0, 18, 5, 0.25);
    rr(c, -16, -18, 32, 17, 3); fs(c, '#9a5a24');
    rr(c, -16, -12, 32, 3, 1); fs(c, '#f2c94c', null);
    if (open) {
      poly(c, [-16, -18, 16, -18, 13, -34, -13, -34]); fs(c, '#7a4418');
      rr(c, -13, -20, 26, 4, 1); fs(c, '#3a200c', null);
    } else {
      c.beginPath(); c.moveTo(-16, -18); c.quadraticCurveTo(0, -32, 16, -18); c.closePath(); fs(c, '#b86a2c');
      rr(c, -3, -20, 6, 7, 1.5); fs(c, '#f2c94c');
      const sp = (Math.sin(t * 3) + 1) / 2;
      emoji(c, '✦', 12, -30 - sp * 3, 8 + sp * 3);
    }
    c.restore();
  }
  function drawFlag(c, x, y, s, color, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    line(c, 0, 0, 0, -38, '#5a3a22', 2.5);
    c.beginPath(); c.moveTo(0, -38); c.quadraticCurveTo(10, -36 + Math.sin(t * 5) * 2, 18, -35); c.lineTo(18, -24);
    c.quadraticCurveTo(9, -25 + Math.sin(t * 5 + 1) * 2, 0, -27); c.closePath(); fs(c, color, OUT, 1.5);
    circ(c, 0, -39, 2); fs(c, '#f2c94c', null);
    c.restore();
  }

  /* ------------------------------------------------------------ decorations */
  const DECOR = {
    tree(c, v) { rr(c, -3, -16, 6, 16, 2); fs(c, '#7a4a22'); circ(c, 0, -26, 14); fs(c, v > 0.5 ? '#4caf50' : '#5cbf5a'); circ(c, -6, -30, 5); c.fillStyle = 'rgba(255,255,255,.15)'; c.fill(); },
    bush(c, v) { circ(c, -6, -6, 7); fs(c, '#4da84f'); circ(c, 5, -7, 8); fs(c, '#58b85a'); if (v > 0.6) { circ(c, 3, -10, 1.6); fs(c, '#e34', null); } },
    flowers(c, v) { for (let i = 0; i < 4; i++) { circ(c, -8 + i * 5, -2 - (i % 2) * 3, 2.2); fs(c, ['#ff7ab3', '#fff27a', '#ffffff', '#ff9a3a'][Math.floor(v * 4 + i) % 4], null); } },
    house(c, v) { rr(c, -12, -16, 24, 15, 2); fs(c, '#f6ecd6'); poly(c, [-15, -16, 0, -28, 15, -16]); fs(c, v > 0.5 ? '#c9492f' : '#3f6fb5'); rr(c, -3, -9, 6, 8, 1); fs(c, '#7a4a22'); },
    paddy(c) { c.save(); c.scale(1, 0.55); rr(c, -22, -16, 44, 32, 4); fs(c, '#8fd06a', '#6aa84a', 1.5); for (let i = -14; i <= 14; i += 7) line(c, i, -12, i, 12, '#5f9a44', 1.2); c.restore(); },
    pine(c, v) { rr(c, -2.5, -10, 5, 10, 2); fs(c, '#5a3a22'); for (let i = 0; i < 3; i++) { poly(c, [-14 + i * 3, -8 - i * 11, 0, -26 - i * 11, 14 - i * 3, -8 - i * 11]); fs(c, v > 0.5 ? '#1f6b3a' : '#26773f'); } },
    bigtree(c) { rr(c, -5, -24, 10, 24, 3); fs(c, '#5a3a22'); circ(c, -10, -34, 13); fs(c, '#2c7a3a'); circ(c, 10, -34, 13); fs(c, '#2c7a3a'); circ(c, 0, -44, 15); fs(c, '#338a44'); },
    fern(c) { for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(i * 5, -10, i * 9, -8); c.strokeStyle = '#3f9a4a'; c.lineWidth = 3; c.stroke(); } },
    toadstool(c, v) { rr(c, -2, -8, 4, 8, 2); fs(c, '#f2e6d8'); c.beginPath(); c.arc(0, -8, 7, Math.PI, TAU); c.closePath(); fs(c, v > 0.5 ? '#d8323f' : '#8b3fb0'); circ(c, -2, -11, 1.3); fs(c, '#fff', null); },
    cactus(c, v) { rr(c, -4, -30, 8, 30, 4); fs(c, '#4f9a4a'); if (v > 0.3) { rr(c, -12, -22, 6, 12, 3); fs(c, '#4f9a4a'); } if (v > 0.6) { rr(c, 6, -26, 6, 12, 3); fs(c, '#4f9a4a'); } },
    rock(c, v) { poly(c, [-12, 0, -9, -9, -2, -13, 8, -10, 12, 0]); fs(c, v > 0.5 ? '#a88f6a' : '#9a9a9a'); },
    dune(c) { c.save(); c.scale(1, 0.4); c.beginPath(); c.moveTo(-30, 0); c.quadraticCurveTo(0, -30, 30, 0); c.closePath(); fs(c, '#e8c27a', '#c9a060', 1.5); c.restore(); },
    palm(c) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6, -18, 2, -36); c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#a0703a'; c.lineWidth = 4; c.stroke(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.7; c.beginPath(); c.moveTo(2, -36); c.quadraticCurveTo(2 + Math.cos(a) * 12, -44 + Math.sin(a) * 6, 2 + Math.cos(a) * 20, -36 + Math.sin(a) * 4 + 8); c.strokeStyle = '#3f9a4a'; c.lineWidth = 4; c.stroke(); } },
    skull(c) { circ(c, 0, -5, 5); fs(c, '#efe8d8'); circ(c, -2, -5, 1.2); fs(c, OUT, null); circ(c, 2, -5, 1.2); fs(c, OUT, null); },
    pyramid(c) { poly(c, [-40, 0, 0, -50, 40, 0]); fs(c, '#e2b86a'); poly(c, [0, -50, 40, 0, 10, 0]); c.fillStyle = 'rgba(0,0,0,.15)'; c.fill(); },
    deadtree(c) { c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -26); c.moveTo(0, -14); c.lineTo(-9, -24); c.moveTo(0, -20); c.lineTo(8, -30); c.moveTo(-9, -24); c.lineTo(-12, -30); c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#4a3a3e'; c.lineWidth = 3; c.stroke(); },
    spike(c, v) { poly(c, [-10, 0, -4, -24 - v * 10, 0, -6, 4, -18, 10, 0]); fs(c, '#3a2f45'); },
    lava(c, v) { c.save(); c.scale(1, 0.45); ell(c, 0, 0, 20, 14); fs(c, '#2a1a1e', null); ell(c, 0, 0, 15, 10); c.fillStyle = v > 0.5 ? '#ff5a1f' : '#ff7a2a'; c.fill(); ell(c, -3, -2, 6, 3); c.fillStyle = '#ffd05a'; c.fill(); c.restore(); },
    crystal(c) { poly(c, [-5, 0, -7, -12, -2, -22, 3, -12, 2, 0]); fs(c, '#9b5bff'); poly(c, [2, 0, 4, -10, 9, -14, 8, 0]); fs(c, '#7a3fdc'); },
    bones(c) { line(c, -8, -2, 8, -5, '#efe8d8', 3); circ(c, -8, -2, 2); fs(c, '#efe8d8', null); circ(c, 8, -5, 2); fs(c, '#efe8d8', null); },
  };
  function drawDecor(c, kind, x, y, s, v) {
    const fn = DECOR[kind]; if (!fn) return;
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    fn(c, v || 0);
    c.restore();
  }
  const FLAT_DECOR = new Set(['paddy', 'dune', 'lava', 'flowers', 'fern']);

  /* ------------------------------------------------------------ DOM portraits (cached data URLs) */
  const cache = new Map();
  function makeCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv;
  }
  function portrait(kind, o, size) {
    size = size || 96;
    o = o || {};
    const key = [kind, o.classId, o.gender, o.color, o.form, size].join('|');
    if (cache.has(key)) return cache.get(key);
    const cv = makeCanvas(size, size); if (!cv) return '';
    const c = cv.getContext('2d');
    const bg = o.color || (kind === 'hero' ? '#e8553d' : '#6a4a8a');
    const g = c.createRadialGradient(size / 2, size * 0.4, 2, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, U.shade(bg, 0.55)); g.addColorStop(1, U.shade(bg, -0.1));
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    if (kind === 'hero') {
      const sc = size / 44;
      drawHero(c, size / 2 - sc, size / 2 + 40 * sc, sc, Object.assign({ still: true }, o));
    } else if (kind === 'npc') {
      const sc = size / 70;
      drawNPC(c, o.npc, size / 2, size * 0.98 + (o.npc === 'scroll' || o.npc === 'darkvoice' ? -size * 0.05 : 12 * sc), sc * (o.npc === 'scroll' ? 1.2 : 1.4), 0);
    } else {
      const h = MON_H[kind] || 70;
      const sc = size / (h * 0.8);
      const ox = kind === 'wolf' || kind === 'scorpion' || kind === 'tiger' ? size * 0.1 : 0;
      drawMonster(c, kind, size / 2 + ox, size * 0.98 + (h > 90 ? h * 0.18 * sc : 0), sc, { t: 0, form: o.form });
    }
    const url = cv.toDataURL();
    cache.set(key, url);
    return url;
  }
  function heroPortrait(p, size) { return portrait('hero', { classId: p.classId, gender: p.gender, color: p.color }, size); }

  return {
    drawHero, drawMonster, drawNPC, drawBuilding, drawChest, drawFlag, drawDecor, shadow, glow, emoji,
    rr, circ, ell, poly, fs, line,
    portrait, heroPortrait, MON_H, ARMY_SPRITE, FLAT_DECOR, OUT, VICTORY_FX,
  };
})();
