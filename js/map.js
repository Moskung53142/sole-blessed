'use strict';
/* Sole Blessed — board map: graph built from the spec layouts, pathfinding, 2.5D rendering, camera. */

const MapSys = (() => {
  const CELL = DATA.CELL;
  const TILT = 0.6;          // vertical squash of the ground plane (the 2.5D angle)
  const HALF = 40;           // half tile size (world units)
  const TILE_H = 10;         // tile slab thickness
  const CLIFF = 30;          // island cliff height
  const spaces = {};
  const list = [];
  const edges = [];          // {a, b, pts:[[x,y]...], bridge}

  /* ================================================================ graph */
  function link(a, b) {
    if (!spaces[a] || !spaces[b]) throw new Error(`Bad map link ${a}–${b}`);
    if (spaces[a].links.includes(b)) return;
    spaces[a].links.push(b); spaces[b].links.push(a);
    const key = `${a}|${b}`, rkey = `${b}|${a}`;
    let wp = DATA.LINK_WAYPOINTS[key] || (DATA.LINK_WAYPOINTS[rkey] ? DATA.LINK_WAYPOINTS[rkey].slice().reverse() : null);
    const pts = [[spaces[a].x, spaces[a].y]].concat((wp || []).map(([c, r]) => [c * CELL, r * CELL]), [[spaces[b].x, spaces[b].y]]);
    const bridge = spaces[a].zone !== spaces[b].zone && Math.hypot(spaces[a].col - spaces[b].col, spaces[a].row - spaces[b].row) > 2;
    edges.push({ a, b, pts, bridge, zone: spaces[a].zone });
  }
  function build() {
    const pending = [];
    for (const z of DATA.ZONES) {
      const L = z.layout;
      for (let li = 0; li < L.length; li += 2) {
        const line = L[li], row = li / 2;
        for (let c = 0; c * 5 < line.length; c++) {
          const code = line.substr(c * 5, 3);
          if (!/^[etBL]\d\d$/.test(code)) continue;
          const id = `${z.id}-${code}`, col = c + z.offset[0], r = row + z.offset[1];
          spaces[id] = { id, code, zone: z.id, type: code[0], col, row: r, x: col * CELL, y: r * CELL, links: [] };
          list.push(spaces[id]);
          if (line.substr(c * 5 + 3, 2) === '──') pending.push([id, `${z.id}-${line.substr(c * 5 + 5, 3)}`]);
        }
      }
      for (let li = 1; li < L.length; li += 2) {
        const line = L[li];
        for (let i = 0; i < line.length; i++) {
          if (line[i] !== '│') continue;
          pending.push([`${z.id}-${L[li - 1].substr(i, 3)}`, `${z.id}-${L[li + 1].substr(i, 3)}`]);
        }
      }
    }
    for (const [a, b] of pending.concat(DATA.CROSS_LINKS, DATA.EXTRA_LINKS)) link(a, b);
    for (const sp of list) sp.dirs = computeDirs(sp);
  }

  /* Map each neighbour to one of W/A/S/D by screen direction (unique per space). */
  function computeDirs(sp) {
    const V = { W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
    const cands = [];
    for (const nid of sp.links) {
      const e = edges.find(ed => (ed.a === sp.id && ed.b === nid) || (ed.b === sp.id && ed.a === nid));
      const pts = e.a === sp.id ? e.pts : e.pts.slice().reverse();
      let dx = pts[1][0] - pts[0][0], dy = pts[1][1] - pts[0][1];
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      for (const k in V) cands.push({ nid, k, score: dx * V[k][0] + dy * V[k][1] });
    }
    cands.sort((a, b) => b.score - a.score);
    const out = {}, used = new Set();
    for (const c of cands) { if (out[c.k] || used.has(c.nid)) continue; out[c.k] = c.nid; used.add(c.nid); }
    return out;
  }

  /* Reachable stops for a roll: shortest simple route to every space within `steps`.
   * Blocking spaces may be stopped on but not passed through. Returns Map id -> [start..id]. */
  function reachable(start, steps, isBlocking) {
    const dist = { [start]: 0 }, prev = { [start]: null }, q = [start], out = new Map();
    while (q.length) {
      const cur = q.shift();
      if (dist[cur] >= steps) continue;
      if (cur !== start && isBlocking(cur)) continue;
      for (const n of spaces[cur].links) if (!(n in dist)) { dist[n] = dist[cur] + 1; prev[n] = cur; q.push(n); }
    }
    for (const id in dist) if (id !== start) out.set(id, pathOf(prev, id));
    return out;
  }
  function pathOf(prev, id) { const p = []; for (let c = id; c != null; c = prev[c]) p.unshift(c); return p; }

  /* Distance field to `target` for hero travel (blocking spaces cannot be passed, except the target itself). */
  function distField(target, isBlocking) {
    const dist = { [target]: 0 }, q = [target];
    while (q.length) {
      const cur = q.shift();
      if (cur !== target && isBlocking(cur)) continue;
      for (const n of spaces[cur].links) if (!(n in dist)) { dist[n] = dist[cur] + 1; q.push(n); }
    }
    return dist;
  }
  /* BFS where `avoid(id)` spaces are never entered (used by the minion). */
  function bfs(start, avoid) {
    const dist = { [start]: 0 }, prev = { [start]: null }, q = [start];
    while (q.length) {
      const cur = q.shift();
      for (const n of spaces[cur].links) {
        if (n in dist || (avoid && avoid(n))) continue;
        dist[n] = dist[cur] + 1; prev[n] = cur; q.push(n);
      }
    }
    return { dist, prev, path: id => (id in dist ? pathOf(prev, id) : null) };
  }
  function graphDist(a, b, isBlocking) { const d = distField(b, isBlocking || (() => false)); return a in d ? d[a] : Infinity; }

  function spaceName(sp, state) {
    if (sp.type === 'L') return DATA.PLACES[sp.code].name;
    if (sp.type === 'B') {
      const cleared = state && state.army[sp.code] && state.army[sp.code].defeated;
      if (sp.code === 'B04') return cleared ? "Castle Ruins (Empty Space)" : DATA.TYPE_INFO.B04.name;
      return cleared ? 'Empty Space (cleared)' : DATA.ARMY[sp.code].name;
    }
    return DATA.TYPE_INFO[sp.type].name;
  }

  /* ================================================================ scenery (deterministic) */
  const land = { 1: [], 2: [], 3: [], 4: [] };   // circles [x, y, r]
  const decor = [];                            // {x, y, kind, v, zone, flat}
  const zoneCenter = {};
  const ZCOL = {
    1: { top: '#7fcf5a', cliff: '#8a5a33', dark: '#5fae43' },
    2: { top: '#3f9a52', cliff: '#5a3d26', dark: '#2f7f40' },
    3: { top: '#ecc97c', cliff: '#b98a4a', dark: '#dcb466' },
    4: { top: '#5a4a63', cliff: '#2e2233', dark: '#4a3b52' },
  };
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = U.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function buildScenery() {
    for (const z of DATA.ZONES) {
      const nodes = list.filter(s => s.zone === z.id);
      const minC = Math.min(...nodes.map(n => n.col)), maxC = Math.max(...nodes.map(n => n.col));
      const minR = Math.min(...nodes.map(n => n.row)), maxR = Math.max(...nodes.map(n => n.row));
      zoneCenter[z.id] = [(minC + maxC) / 2 * CELL, (minR + maxR) / 2 * CELL];
      for (const n of nodes) land[z.id].push([n.x, n.y, 100]);
      for (let c = minC; c <= maxC; c += 0.5) for (let r = minR; r <= maxR; r += 0.5) {
        const near = nodes.some(n => Math.hypot(n.col - c, n.row - r) <= 1.15);
        if (near) land[z.id].push([c * CELL, r * CELL, 78]);
      }
    }
    for (const e of edges) {
      if (e.bridge) continue;
      const zone = e.zone;
      for (let i = 0; i < e.pts.length - 1; i++) {
        const [ax, ay] = e.pts[i], [bx, by] = e.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d <= len; d += 40) land[zone].push([ax + (bx - ax) * d / len, ay + (by - ay) * d / len, 70]);
      }
    }
    const KINDS = {
      1: [['tree', 5], ['bush', 3], ['flowers', 3], ['house', 2], ['paddy', 2], ['rock', 1]],
      2: [['pine', 5], ['bigtree', 4], ['fern', 3], ['toadstool', 2], ['bush', 1]],
      3: [['cactus', 4], ['rock', 3], ['dune', 3], ['palm', 1], ['skull', 1]],
      4: [['deadtree', 4], ['spike', 4], ['lava', 2], ['crystal', 2], ['bones', 2]],
    };
    const rnd = U.seeded(20260928);
    for (const z of DATA.ZONES) {
      const circles = land[z.id];
      let placed = 0, tries = 0;
      while (placed < 95 && tries < 2500) {
        tries++;
        const c = circles[Math.floor(rnd() * circles.length)];
        const a = rnd() * Math.PI * 2, d = rnd() * c[2] * 0.95;
        const x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(a) * d;
        if (list.some(s => Math.hypot(s.x - x, s.y - y) < 60)) continue;
        if (edges.some(e => { for (let i = 0; i < e.pts.length - 1; i++) if (segDist(x, y, e.pts[i][0], e.pts[i][1], e.pts[i + 1][0], e.pts[i + 1][1]) < 30) return true; return false; })) continue;
        if (decor.some(o => Math.hypot(o.x - x, o.y - y) < 24)) continue;
        const kinds = KINDS[z.id];
        let roll = rnd() * kinds.reduce((s, k) => s + k[1], 0), kind = kinds[0][0];
        for (const [k, w] of kinds) { if ((roll -= w) < 0) { kind = k; break; } }
        decor.push({ x, y, kind, v: rnd(), zone: z.id, flat: Sprites.FLAT_DECOR.has(kind) });
        placed++;
      }
    }
    // A landmark pyramid in the desert (placed clear of spaces and roads).
    decor.push({ x: 16.6 * CELL, y: 2.45 * CELL, kind: 'pyramid', v: 0.5, zone: 3, flat: false, scale: 1.1 });
  }

  /* ================================================================ camera & projection */
  const cam = { x: 3 * CELL, y: 9 * CELL, zoom: 1, tx: 3 * CELL, ty: 9 * CELL, tz: 1, mode: 'follow', baseZoom: 1 };
  let W = 800, H = 600;
  function sx(x) { return (x - cam.x) * cam.zoom + W / 2; }
  function sy(y, z) { return ((y - cam.y) * TILT - (z || 0)) * cam.zoom + H / 2; }
  function toWorld(px, py, z) { return { x: (px - W / 2) / cam.zoom + cam.x, y: ((py - H / 2) / cam.zoom + (z || 0)) / TILT + cam.y }; }
  function bounds() {
    const xs = list.map(s => s.x), ys = list.map(s => s.y);
    return { x0: Math.min(...xs) - 140, x1: Math.max(...xs) + 140, y0: Math.min(...ys) - 160, y1: Math.max(...ys) + 160 };
  }
  function fitZoom() {
    const b = bounds();
    return Math.min(W / (b.x1 - b.x0), H / ((b.y1 - b.y0) * TILT + 80)) * 0.96;
  }
  function setViewport(w, h) {
    W = w; H = h;
    cam.baseZoom = U.clamp(Math.min(w / 960, h / 620), 0.5, 1.5);
    if (cam.mode === 'full') cam.tz = fitZoom(); else cam.tz = cam.baseZoom;
  }
  function setMode(mode) {
    cam.mode = mode;
    if (mode === 'full') { const b = bounds(); cam.tx = (b.x0 + b.x1) / 2; cam.ty = (b.y0 + b.y1) / 2; cam.tz = fitZoom(); }
    else cam.tz = cam.baseZoom;
  }
  function focus(x, y, instant) {
    cam.tx = x; cam.ty = y;
    if (instant) { cam.x = x; cam.y = y; cam.zoom = cam.tz; }
  }
  function pan(dx, dy) { cam.tx += dx / cam.zoom; cam.ty += dy / cam.zoom / TILT; clampCam(); }
  function clampCam() { const b = bounds(); cam.tx = U.clamp(cam.tx, b.x0, b.x1); cam.ty = U.clamp(cam.ty, b.y0, b.y1); }
  function zoomBy(f) { cam.tz = U.clamp(cam.tz * f, 0.3, 2.4); }
  function updateCam(dt) {
    const k = 1 - Math.pow(0.001, dt);
    cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.zoom += (cam.tz - cam.zoom) * k;
  }

  /* ================================================================ walking animation */
  const walks = {};          // key ('p0'..'p3', 'minion') -> {pts, start, stepMs}
  function walk(key, path, stepMs) {
    if (!path || path.length < 2 || stepMs <= 0) return Promise.resolve();
    const pts = path.map(id => [spaces[id].x, spaces[id].y]);
    walks[key] = { pts, start: performance.now(), stepMs };
    for (let i = 1; i < path.length; i++) setTimeout(() => Sound.play('step'), i * stepMs - stepMs * 0.2);
    return new Promise(res => setTimeout(() => { delete walks[key]; res(); }, stepMs * (path.length - 1) + 30));
  }
  function walkPos(key, now) {
    const w = walks[key]; if (!w) return null;
    const f = (now - w.start) / w.stepMs, i = Math.min(Math.floor(f), w.pts.length - 2), fr = U.clamp(f - i, 0, 1);
    const a = w.pts[i], b = w.pts[i + 1];
    return { x: U.lerp(a[0], b[0], fr), y: U.lerp(a[1], b[1], fr), z: Math.sin(fr * Math.PI) * 16, dir: Math.sign(b[0] - a[0]) || 0, walk: f };
  }
  /* Offsets so up to 4 heroes (+ minion) share one tile readably. */
  const SLOTS = [[-17, -12], [17, -12], [-17, 14], [17, 14]];
  function actorSpot(state, p) {
    const here = state.players.filter(o => o.spaceId === p.spaceId);
    const extra = (state.minion && state.minion.spaceId === p.spaceId) || spaces[p.spaceId].type === 'L' || spaces[p.spaceId].type === 'B' || spaces[p.spaceId].type === 't';
    const sp = spaces[p.spaceId];
    if (here.length === 1 && !extra) return { x: sp.x, y: sp.y + 4 };
    const i = here.indexOf(p);
    const o = extra ? [[-24, 18], [24, 18], [-8, 26], [8, 30]][i] : SLOTS[i];
    return { x: sp.x + o[0], y: sp.y + o[1] };
  }
  function actorPos(state, p, now) {
    return walkPos('p' + p.id, now || performance.now()) || Object.assign({ z: 0 }, actorSpot(state, p));
  }

  /* ================================================================ rendering */
  const overlay = { reach: null, blocking: null, route: null, selected: null, arrows: null, markers: false, pathSet: null };
  function setOverlay(o) { Object.assign(overlay, { reach: null, blocking: null, route: null, selected: null, arrows: null, markers: false, pathSet: null }, o || {}); }

  function drawSea(c, t) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a8fd0'); g.addColorStop(1, '#1d6fb0');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = Math.max(1, 2 * cam.zoom);
    const step = 70, y0 = Math.floor((cam.y - H / cam.zoom / TILT) / step) * step;
    const y1 = cam.y + H / cam.zoom / TILT;
    for (let wy = y0; wy < y1; wy += step) {
      const row = Math.round(wy / step);
      for (let wx = Math.floor((cam.x - W / cam.zoom) / 160) * 160 + (row % 2) * 80; wx < cam.x + W / cam.zoom; wx += 160) {
        const ox = Math.sin(t * 0.8 + row) * 12;
        const X = sx(wx + ox), Y = sy(wy + Math.sin(t + wx * 0.01) * 4);
        c.beginPath(); c.moveTo(X, Y); c.quadraticCurveTo(X + 12 * cam.zoom, Y - 5 * cam.zoom, X + 24 * cam.zoom, Y); c.stroke();
      }
    }
  }
  function landPath(c, circles, grow, dz) {
    c.beginPath();
    for (const [x, y, r] of circles) {
      const R = (r + grow) * cam.zoom;
      const X = sx(x), Y = sy(y) + dz * cam.zoom;
      if (X + R < 0 || X - R > W || Y + R < -40 || Y - R * TILT > H + 60) continue;
      c.moveTo(X + R, Y); c.ellipse(X, Y, R, R * TILT, 0, 0, Math.PI * 2);
    }
  }
  function drawLand(c, t) {
    for (const z of [1, 2, 3, 4]) { landPath(c, land[z], 16, 8); c.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(t * 1.5) * 0.06})`; c.fill(); }
    for (const z of [1, 2, 3, 4]) { landPath(c, land[z], 0, CLIFF); c.fillStyle = ZCOL[z].cliff; c.fill(); }
    for (const z of [1, 2, 3, 4]) {
      landPath(c, land[z], 0, 0); c.fillStyle = ZCOL[z].top; c.fill();
      landPath(c, land[z], -14, 4); c.fillStyle = ZCOL[z].dark; c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1;
    }
  }
  function drawRoads(c) {
    for (const e of edges) {
      const pts = e.pts.map(([x, y]) => [sx(x), sy(y)]);
      const draw = (col, w, dash) => {
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
        c.strokeStyle = col; c.lineWidth = w * cam.zoom; c.setLineDash(dash ? dash.map(d => d * cam.zoom) : []); c.stroke();
      };
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (e.bridge) {
        draw('#4a2e14', 30); draw('#a0703a', 24); draw('#7a4e22', 24, [3, 9]);
      } else {
        const dark = e.zone === 4 ? '#2a2030' : e.zone === 3 ? '#b58a4a' : '#8a6a3a';
        const light = e.zone === 4 ? '#6a5a70' : e.zone === 3 ? '#f4dca0' : '#e6cc8e';
        draw(dark, 28); draw(light, 21);
      }
      c.setLineDash([]);
    }
  }
  function tileTop(c, sp, color, border, bw) {
    const X = sx(sp.x), Y = sy(sp.y, TILE_H);
    c.save(); c.translate(X, Y); c.scale(cam.zoom, cam.zoom * TILT);
    Sprites.rr(c, -HALF, -HALF, HALF * 2, HALF * 2, 14);
    c.fillStyle = color; c.fill();
    if (border) { c.strokeStyle = border; c.lineWidth = bw || 4; c.stroke(); }
    c.restore();
  }
  function tileColor(sp, state) {
    if (sp.type === 'B' && state.army[sp.code].defeated) return DATA.TYPE_INFO.e;
    if (sp.code === 'B04') return DATA.TYPE_INFO.B04;
    return DATA.TYPE_INFO[sp.type];
  }
  function drawTiles(c, state, t) {
    const sorted = list.slice().sort((a, b) => a.y - b.y);
    for (const sp of sorted) {
      const X = sx(sp.x), Y = sy(sp.y);
      if (X < -120 || X > W + 120 || Y < -120 || Y > H + 120) continue;
      const info = tileColor(sp, state);
      // slab side
      c.save(); c.translate(X, Y); c.scale(cam.zoom, cam.zoom * TILT);
      Sprites.rr(c, -HALF, -HALF + 2, HALF * 2, HALF * 2, 14); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill();
      c.restore();
      c.save(); c.translate(X, Y - 2 * cam.zoom); c.scale(cam.zoom, cam.zoom * TILT);
      Sprites.rr(c, -HALF, -HALF, HALF * 2, HALF * 2, 14); c.fillStyle = info.side; c.fill();
      c.restore();
      tileTop(c, sp, info.color, info.border || U.shade(info.color, -0.35), info.border ? 6 : 3);
      // inner rim + glyph
      c.save(); c.translate(X, sy(sp.y, TILE_H)); c.scale(cam.zoom, cam.zoom * TILT);
      Sprites.rr(c, -HALF + 7, -HALF + 7, HALF * 2 - 14, HALF * 2 - 14, 10); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2.5; c.stroke();
      c.restore();
      if (sp.type === 'e' || (sp.type === 'B' && state.army[sp.code].defeated && sp.code !== 'B04')) {
        c.save(); c.globalAlpha = 0.35; Sprites.emoji(c, '✦', X, sy(sp.y, TILE_H), 20 * cam.zoom); c.restore();
      }
      // overlays
      const ov = overlay;
      let hl = null;
      if (ov.reach && ov.reach.has(sp.id)) hl = ov.blocking && ov.blocking.has(sp.id) ? '#ff3030' : '#ffffff';
      if (hl) {
        const a = 0.2 + 0.3 * (Math.sin(t * 7) + 1) / 2;
        c.save(); c.globalAlpha = a; tileTop(c, sp, hl, null); c.restore();
        tileTop(c, sp, 'rgba(0,0,0,0)', hl === '#ff3030' ? '#ff3030' : `rgba(255,255,255,${0.5 + a})`, 5);
      }
      if (ov.pathSet && ov.pathSet.has(sp.id)) { c.save(); c.globalAlpha = 0.35; tileTop(c, sp, '#3aa0ff', null); c.restore(); }
      const cur = state.players[state.turn];
      if (cur && cur.spaceId === sp.id && !ov.reach) tileTop(c, sp, 'rgba(0,0,0,0)', cur.color, 5 + Math.sin(t * 4) * 1.5);   // current player's space
      if (ov.selected === sp.id) tileTop(c, sp, 'rgba(0,0,0,0)', '#fff', 7);
    }
  }
  function drawRoute(c, t) {
    const r = overlay.route; if (!r || r.length < 2) return;
    c.save(); c.setLineDash([8 * cam.zoom, 8 * cam.zoom]); c.lineDashOffset = -t * 30;
    c.strokeStyle = '#ffffff'; c.lineWidth = 5 * cam.zoom; c.lineCap = 'round';
    c.beginPath();
    r.forEach((id, i) => { const X = sx(spaces[id].x), Y = sy(spaces[id].y, TILE_H); i ? c.lineTo(X, Y) : c.moveTo(X, Y); });
    c.stroke(); c.restore();
  }

  function drawObjects(c, state, t, now) {
    const objs = [];
    const z = cam.zoom;
    const vis = (x, y) => { const X = sx(x), Y = sy(y); return X > -160 && X < W + 160 && Y > -220 && Y < H + 160; };
    for (const d of decor) {
      if (d.flat || !vis(d.x, d.y)) continue;
      objs.push({ y: d.y, draw: () => Sprites.drawDecor(c, d.kind, sx(d.x), sy(d.y), z * 1.3 * (d.scale || 1), d.v) });
    }
    for (const sp of list) {
      if (!vis(sp.x, sp.y)) continue;
      const X = sx(sp.x), Y = sy(sp.y, TILE_H);
      if (sp.type === 'L') objs.push({ y: sp.y - 5, draw: () => Sprites.drawBuilding(c, sp.code, X, Y + 8 * z, z * 0.95, t) });
      else if (sp.code === 'B04') objs.push({ y: sp.y - 5, draw: () => Sprites.drawBuilding(c, 'B04', X, Y + 8 * z, z * 0.9, t, { ruined: state.army.B04.defeated }) });
      else if (sp.type === 'B' && !state.army[sp.code].defeated) {
        objs.push({ y: sp.y - 5, draw: () => { Sprites.shadow(c, X, Y, 24 * z, 8 * z); Sprites.drawMonster(c, Sprites.ARMY_SPRITE[sp.code], X, Y, z * 0.62, { t }); } });
      } else if (sp.type === 't') {
        const opened = state.chests[sp.id] != null && state.day < state.chests[sp.id] + 3;
        objs.push({ y: sp.y - 5, draw: () => Sprites.drawChest(c, X, Y, z * 0.9, opened, t) });
      }
    }
    // respawn flags (skip the Royal Castle building centre by offsetting)
    state.players.forEach((p, i) => {
      const sp = spaces[p.respawnId]; if (!vis(sp.x, sp.y)) return;
      objs.push({ y: sp.y - 30, draw: () => Sprites.drawFlag(c, sx(sp.x - 34 + i * 10), sy(sp.y - 30, TILE_H), z * 0.8, p.color, t + i) });
    });
    if (state.head.space) {
      const sp = spaces[state.head.space];
      objs.push({ y: sp.y + 1, draw: () => { Sprites.glow(c, sx(sp.x), sy(sp.y, TILE_H + 20), 26 * z, '#d62828', 0.6); Sprites.emoji(c, '💀', sx(sp.x), sy(sp.y, TILE_H + 22 + Math.sin(t * 3) * 4), 26 * z); } });
    }
    const human = state.players.find(p => !p.isBot);
    for (const tr of state.traps) {
      if (!human || tr.owner !== human.id) continue;
      const sp = spaces[tr.space];
      objs.push({ y: sp.y - 20, draw: () => Sprites.emoji(c, '🕳️', sx(sp.x + 26), sy(sp.y - 20, TILE_H + 4), 16 * z) });
    }
    if (state.minion) {
      const m = state.minion;
      const wp = walkPos('minion', now);
      const sp = spaces[m.spaceId];
      const pos = wp || { x: sp.x + 24, y: sp.y - 10, z: 0 };
      objs.push({ y: pos.y, draw: () => { Sprites.shadow(c, sx(pos.x), sy(pos.y, TILE_H), 14 * z, 5 * z); Sprites.drawMonster(c, 'minion', sx(pos.x), sy(pos.y, TILE_H + pos.z + 4 + Math.sin(t * 3) * 3), z * 0.75, { t }); } });
    }
    const cur = state.players[state.turn];
    for (const p of state.players) {
      const pos = actorPos(state, p, now);
      objs.push({ y: pos.y + 0.5, draw: () => {
        const X = sx(pos.x), Y = sy(pos.y, TILE_H);
        Sprites.shadow(c, X, Y, 15 * z, 5 * z);
        Sprites.drawHero(c, X, sy(pos.y, TILE_H + pos.z), z * 0.8, { classId: p.classId, gender: p.gender, color: p.color, t: t + p.id, walk: pos.walk, facing: pos.dir < 0 ? -1 : 1 });
        if (p.battleId) Sprites.emoji(c, '⚔️', X + 14 * z, sy(pos.y, TILE_H + 62), 16 * z);
        if (state.head.holder === p.id) Sprites.emoji(c, '💀', X - 14 * z, sy(pos.y, TILE_H + 62 + Math.sin(t * 4) * 2), 15 * z);
        if (p === cur) {
          const bob = Math.sin(t * 5) * 4;
          Sprites.poly(c, [X - 8 * z, sy(pos.y, TILE_H + 76 + bob), X + 8 * z, sy(pos.y, TILE_H + 76 + bob), X, sy(pos.y, TILE_H + 64 + bob)]);
          Sprites.fs(c, p.color, '#fff', 2);
        }
      } });
    }
    objs.sort((a, b) => a.y - b.y);
    for (const o of objs) o.draw();
  }
  function drawFlatDecor(c) {
    for (const d of decor) {
      if (!d.flat) continue;
      const X = sx(d.x), Y = sy(d.y);
      if (X < -60 || X > W + 60 || Y < -60 || Y > H + 60) continue;
      Sprites.drawDecor(c, d.kind, X, Y, cam.zoom * 1.3, d.v);
    }
  }
  function drawArrows(c, state, t) {
    if (!overlay.arrows) return;
    for (const k in overlay.arrows) {
      const a = spaces[overlay.arrows.from], b = spaces[overlay.arrows[k]];
      if (k === 'from' || !b) continue;
      const mx = U.lerp(a.x, b.x, 0.5), my = U.lerp(a.y, b.y, 0.5);
      const X = sx(mx), Y = sy(my, TILE_H + 6 + Math.sin(t * 6) * 3);
      const ang = Math.atan2((b.y - a.y) * TILT, b.x - a.x);
      c.save(); c.translate(X, Y); c.rotate(ang); c.scale(cam.zoom, cam.zoom);
      Sprites.poly(c, [-10, -9, 8, 0, -10, 9, -5, 0]); Sprites.fs(c, '#fff4d6', '#8a4b12', 2.5);
      c.restore();
      c.save(); c.font = `800 ${Math.round(13 * cam.zoom)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#2b1a0e'; Sprites.rr(c, X - 9 * cam.zoom, Y - 26 * cam.zoom, 18 * cam.zoom, 16 * cam.zoom, 4 * cam.zoom); c.fill();
      c.fillStyle = '#fff'; c.fillText(k, X, Y - 18 * cam.zoom); c.restore();
    }
  }
  /* Auto-Move / picker selection: bouncing arrow + space-type label above the chosen space. */
  function drawSelection(c, state, t) {
    const id = overlay.selected; if (!id) return;
    const sp = spaces[id], z = Math.max(cam.zoom, 0.6);
    const X = sx(sp.x), Y = sy(sp.y, TILE_H + (sp.type === 'L' || sp.code === 'B04' ? 88 : 52) + Math.abs(Math.sin(t * 5)) * 12);
    c.save();
    Sprites.poly(c, [X - 16 * z, Y, X + 16 * z, Y, X, Y + 22 * z]);
    Sprites.fs(c, '#ffd36a', '#8a4b12', 3);
    const label = MapSys.spaceName(sp, state);
    c.font = `800 ${Math.round(14 * z)}px system-ui,sans-serif`;
    const w = c.measureText(label).width + 20 * z;
    Sprites.rr(c, X - w / 2, Y - 34 * z, w, 26 * z, 10 * z);
    Sprites.fs(c, '#fff6e2', '#e8a53a', 3);
    c.fillStyle = '#3b2412'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, X, Y - 21 * z);
    c.restore();
  }
  function drawMarkers(c, state, t) {
    if (!overlay.markers && cam.mode !== 'full') return;
    const z = Math.max(cam.zoom, 0.55) * 0.8;
    const pin = (x, y, label, col) => {
      const X = sx(x), Y = sy(y, TILE_H + 100 + Math.sin(t * 4 + x) * 3);
      c.save(); c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.arc(X, Y, 11 * z, 0, Math.PI * 2); c.fill(); c.stroke();
      Sprites.poly(c, [X - 4 * z, Y + 9 * z, X + 4 * z, Y + 9 * z, X, Y + 17 * z]); c.fill();
      Sprites.emoji(c, label, X, Y + 1, 12 * z); c.restore();
    };
    state.players.forEach(p => { const sp = spaces[p.spaceId]; pin(sp.x + (p.id - 1.5) * 16, sp.y, ['①', '②', '③', '④'][p.id], p.color); });
    if (state.minion) { const sp = spaces[state.minion.spaceId]; pin(sp.x, sp.y - 30, '😈', '#6a1622'); }
    if (state.head.space) { const sp = spaces[state.head.space]; pin(sp.x, sp.y - 30, '💀', '#222'); }
    if (cam.mode === 'full') {
      for (const k of ['B01', 'B02', 'B03', 'B04']) if (!state.army[k].defeated) { const sp = list.find(s => s.code === k); pin(sp.x, sp.y - 20, k === 'B04' ? '👑' : '☠️', '#5b2a86'); }
    }
  }
  function drawZoneNames(c) {
    if (cam.mode !== 'full') return;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const z of DATA.ZONES) {
      const [x, y] = zoneCenter[z.id];
      const X = sx(x), Y = sy(y + (z.id === 1 ? 90 : z.id === 4 ? 100 : -40), 40);
      c.font = `900 ${Math.round(Math.max(14, 30 * cam.zoom))}px system-ui,sans-serif`;
      c.lineWidth = 6; c.strokeStyle = 'rgba(43,26,14,.85)'; c.strokeText(`${z.id}. ${z.name}`, X, Y);
      c.fillStyle = '#fff4d6'; c.fillText(`${z.id}. ${z.name}`, X, Y);
      c.font = `700 ${Math.round(Math.max(10, 18 * cam.zoom))}px system-ui,sans-serif`;
      c.strokeText(`Lv ${z.levels}`, X, Y + 28 * Math.max(cam.zoom, 0.6)); c.fillStyle = '#ffd36a'; c.fillText(`Lv ${z.levels}`, X, Y + 28 * Math.max(cam.zoom, 0.6));
    }
    c.restore();
  }

  function render(c, w, h, t, dt, state) {
    if (w !== W || h !== H) setViewport(w, h);
    if (cam.mode === 'follow' && state) {
      const p = state.players[state.turn];
      const pos = actorPos(state, p);
      cam.tx = pos.x; cam.ty = pos.y;
      const f = typeof followTarget === 'function' ? followTarget(performance.now()) : followTarget;
      if (f) { cam.tx = f.x; cam.ty = f.y; }
    }
    updateCam(dt);
    const now = performance.now();
    drawSea(c, t);
    drawLand(c, t);
    drawFlatDecor(c);
    drawRoads(c);
    if (state) {
      drawTiles(c, state, t);
      drawRoute(c, t);
      drawObjects(c, state, t, now);
      drawArrows(c, state, t);
      drawMarkers(c, state, t);
      drawSelection(c, state, t);
    }
    drawZoneNames(c);
  }
  let followTarget = null;          // null | {x, y} | (now) => {x, y}
  function follow(target) { followTarget = target; }
  function minionPos(state, now) {
    if (!state.minion) return null;
    const sp = spaces[state.minion.spaceId];
    return walkPos('minion', now) || { x: sp.x, y: sp.y };
  }

  function pick(px, py) {
    const w = toWorld(px, py, TILE_H);
    let best = null, bd = 60;
    for (const sp of list) { const d = Math.hypot(sp.x - w.x, sp.y - w.y); if (d < bd) { bd = d; best = sp.id; } }
    return best;
  }
  function screenPos(id, z) { const sp = spaces[id]; return { x: sx(sp.x), y: sy(sp.y, z || TILE_H) }; }

  build();

  return {
    spaces, list, edges, CELL, TILT,
    reachable, distField, bfs, graphDist, spaceName,
    initScenery() { if (!decor.length) buildScenery(); },
    render, setViewport, setMode, focus, follow, pan, zoomBy, pick, screenPos, walk, actorPos, minionPos,
    setOverlay, overlay, cam,
    byCode(zone, code) { return spaces[`${zone}-${code}`]; },
  };
})();
