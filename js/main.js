'use strict';
/* Sole Blessed — bootstrap: canvas sizing, the render loop, and pointer input on the board. */

(() => {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  MapSys.initScenery();
  const preview = Game.newState(null);          // bot-only state, only used to draw the title backdrop

  let last = performance.now(), t = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try {
      if (UI.scene === 'battle' && BattleView.isOpen) BattleView.render(ctx, W, H, t, dt);
      else if (Game.state && UI.inGame()) MapSys.render(ctx, W, H, t, dt, Game.state);
      else MapSys.render(ctx, W, H, t, dt, preview);
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---- pointer: drag pans (free camera), tap picks a space, wheel / pinch zooms ---- */
  const pts = new Map();
  let drag = null, pinch = null;
  const boardActive = () => UI.inGame() && UI.scene === 'board';
  canvas.addEventListener('pointerdown', e => {
    Sound.unlock();
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, moved: false };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (boardActive()) MapSys.zoomBy(d / pinch);
      pinch = d;
      return;
    }
    if (!drag || !boardActive()) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      drag.moved = true;
      if (MapSys.cam.mode === 'follow') MapSys.setMode('free');
    }
    if (drag.moved) MapSys.pan(prev.x - e.clientX, prev.y - e.clientY);
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (drag && !drag.moved && boardActive()) UI.onMapTap(MapSys.pick(e.clientX, e.clientY));
    if (!pts.size) drag = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
  canvas.addEventListener('wheel', e => {
    if (!boardActive()) return;
    e.preventDefault();
    MapSys.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  /* Keep the page from scrolling/zooming on mobile while playing. */
  document.addEventListener('gesturestart', e => e.preventDefault());

  Sound.setVolumes(UI.settings.musicVolume, UI.settings.sfxVolume);
  UI.showTitle();
})();
