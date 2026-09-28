'use strict';
/* Sole Blessed — all sound is synthesised with the Web Audio API (no audio files). */

const Sound = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  let musicVol = 0.5, sfxVol = 0.7;
  let track = null, trackName = null, step = 0, nextTime = 0, timer = null;

  const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(n) {
    const m = /^([A-G][#b]?)(\d)$/.exec(n);
    if (!m) return 0;
    const midi = 12 * (Number(m[2]) + 1) + SEMI[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function ensure() {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.35; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol * 0.6; sfxBus.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(bus, f, t, dur, type, vol, slideTo) {
    if (!f) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(bus, t, dur, vol, hp) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp || 1000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  /* ---------------------------------------------------------------- music
   * One token per 8th note: note name, '-' holds the previous note, '.' is a rest.
   * drums: k = kick, h = hat, s = snare. */
  const TRACKS = {
    title: { bpm: 84, leadType: 'triangle', bassType: 'sine',
      lead: 'E4 - G4 - C5 - - - B4 A4 - G4 - - E4 - F4 - A4 - D5 - - - C5 B4 - G4 - - - - E4 - G4 - C5 - E5 - D5 C5 - A4 - - G4 - F4 - E4 - D4 - E4 - C4 - - - - - - -',
      bass: 'C3 - - - G2 - - - A2 - - - E2 - - - F2 - - - D2 - - - G2 - - - G2 - - - C3 - - - E2 - - - F2 - - - C3 - - - D2 - - - G2 - - - C3 - - - C3 - - -',
      drums: '' },
    board: { bpm: 126, leadType: 'square', bassType: 'triangle',
      lead: 'C5 . A4 . F4 . A4 C5 D5 . C5 . A4 . . . Bb4 . G4 . E4 . G4 Bb4 C5 . A4 . F4 . . . A4 . C5 . F5 . E5 D5 C5 . A4 . G4 . . . F4 . G4 A4 Bb4 . G4 . F4 . - - . . . .',
      bass: 'F2 . C3 . F2 . C3 . Bb2 . F3 . Bb2 . F3 . C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . F2 . C3 . F2 . C3 . Bb2 . F3 . Bb2 . F3 . C3 . G3 . C3 . G3 . F2 . C3 . F2 . . .',
      drums: 'k . h . s . h . k . h . s . h h' },
    battle: { bpm: 156, leadType: 'square', bassType: 'sawtooth',
      lead: 'A4 . C5 . E5 . C5 . D5 . B4 . G4 . B4 . A4 . C5 . E5 . A5 . G5 . E5 . D5 . E5 . . . F5 . E5 . D5 . C5 . B4 . C5 . D5 . G4 . A4 . B4 . C5 . D5 . E5 . - . . .',
      bass: 'A2 A2 A3 A2 A2 A3 A2 A3 G2 G2 G3 G2 G2 G3 G2 G3 F2 F2 F3 F2 F2 F3 F2 F3 E2 E2 E3 E2 E2 E3 E2 E3',
      drums: 'k h s h k k s h' },
    boss: { bpm: 142, leadType: 'sawtooth', bassType: 'square',
      lead: 'D5 . . D5 C#5 . D5 . F5 . E5 . D5 . C#5 . Bb4 . . Bb4 A4 . Bb4 . D5 . C#5 . A4 . . . G4 . Bb4 . D5 . G5 . F5 . E5 . C#5 . A4 . D5 . - . C#5 . D5 . E5 . F5 . E5 . C#5 .',
      bass: 'D2 D2 D3 D2 D2 D3 D2 D3 Bb1 Bb1 Bb2 Bb1 A1 A1 A2 A1',
      drums: 'k . s . k k s .' },
    victory: { bpm: 132, loop: false, leadType: 'square', bassType: 'triangle',
      lead: 'C5 C5 C5 C5 - - Ab4 - Bb4 - C5 . Bb4 C5 - - - - - - . .',
      bass: 'C3 . . . . . Ab2 - Bb2 - C3 . . . . . . . . . . .', drums: '' },
    good: { bpm: 96, leadType: 'triangle', bassType: 'sine',
      lead: 'G4 - C5 - E5 - G5 - - - E5 - F5 - D5 - - - C5 - D5 - E5 - C5 - A4 - B4 - C5 - - - - - - -',
      bass: 'C3 - - - G2 - - - F2 - - - G2 - - - A2 - - - F2 - - - G2 - - - C3 - - - - - - -', drums: '' },
    sad: { bpm: 66, leadType: 'triangle', bassType: 'sine',
      lead: 'A4 - - - G4 - E4 - - - F4 - E4 - D4 - - - C4 - D4 - E4 - - - - - . . . .',
      bass: 'A2 - - - - - - - F2 - - - - - - - D2 - - - - - - - E2 - - - - - - -', drums: '' },
  };
  function parse(str) {
    const tok = str.trim().split(/\s+/), out = [];
    for (let i = 0; i < tok.length; i++) {
      const t = tok[i];
      if (t === '-' || t === '.' || !t) continue;
      let len = 1;
      while (tok[i + len] === '-') len++;
      out.push({ step: i, note: t, len });
    }
    return { length: tok.length, notes: out };
  }
  const parsed = {};
  function getTrack(name) {
    if (!parsed[name]) {
      const t = TRACKS[name];
      parsed[name] = { def: t, lead: parse(t.lead), bass: parse(t.bass), drums: t.drums ? t.drums.split(/\s+/) : [] };
    }
    return parsed[name];
  }

  function schedule() {
    if (!track || !ctx) return;
    const spb = 60 / track.def.bpm / 2;       // seconds per 8th
    const len = Math.max(track.lead.length, track.bass.length);
    while (nextTime < ctx.currentTime + 0.15) {
      const s = step % len;
      if (track.def.loop === false && step >= len) { track = null; return; }
      for (const n of track.lead.notes) if (n.step === s % track.lead.length) tone(musicBus, freq(n.note), nextTime, spb * n.len * 0.95, track.def.leadType, 0.16);
      for (const n of track.bass.notes) if (n.step === s % track.bass.length) tone(musicBus, freq(n.note), nextTime, spb * n.len * 0.9, track.def.bassType, 0.2);
      if (track.drums.length) {
        const d = track.drums[s % track.drums.length];
        if (d === 'k') tone(musicBus, 120, nextTime, 0.12, 'sine', 0.5, 40);
        else if (d === 'h') noise(musicBus, nextTime, 0.04, 0.12, 6000);
        else if (d === 's') noise(musicBus, nextTime, 0.12, 0.22, 1800);
      }
      nextTime += spb; step++;
    }
  }

  /* ---------------------------------------------------------------- sfx */
  const SFX = {
    click(t) { tone(sfxBus, 660, t, 0.05, 'square', 0.18); },
    select(t) { tone(sfxBus, 880, t, 0.05, 'square', 0.14); },
    error(t) { tone(sfxBus, 180, t, 0.18, 'square', 0.22, 120); },
    dice(t) { for (let i = 0; i < 4; i++) noise(sfxBus, t + i * 0.05, 0.04, 0.25, 2500); },
    diceStop(t) { tone(sfxBus, 520, t, 0.08, 'square', 0.25); tone(sfxBus, 780, t + 0.08, 0.14, 'square', 0.25); },
    step(t) { tone(sfxBus, 300, t, 0.06, 'triangle', 0.25, 420); },
    coin(t) { tone(sfxBus, 988, t, 0.07, 'square', 0.2); tone(sfxBus, 1319, t + 0.07, 0.2, 'square', 0.2); },
    buy(t) { SFX.coin(t); tone(sfxBus, 1568, t + 0.16, 0.2, 'square', 0.15); },
    hit(t) { noise(sfxBus, t, 0.15, 0.5, 600); tone(sfxBus, 160, t, 0.15, 'square', 0.3, 60); },
    crit(t) { noise(sfxBus, t, 0.25, 0.6, 400); tone(sfxBus, 220, t, 0.25, 'sawtooth', 0.35, 50); tone(sfxBus, 1200, t, 0.1, 'square', 0.2, 600); },
    miss(t) { tone(sfxBus, 700, t, 0.18, 'sine', 0.2, 250); },
    block(t) { tone(sfxBus, 420, t, 0.08, 'square', 0.3); noise(sfxBus, t, 0.08, 0.3, 3000); },
    heal(t) { [523, 659, 784, 1047].forEach((f, i) => tone(sfxBus, f, t + i * 0.07, 0.18, 'triangle', 0.2)); },
    magic(t) { tone(sfxBus, 400, t, 0.4, 'sawtooth', 0.18, 1600); noise(sfxBus, t, 0.35, 0.15, 3000); },
    levelup(t) { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(sfxBus, f, t + i * 0.08, 0.2, 'square', 0.18)); },
    win(t) { [523, 523, 523, 784].forEach((f, i) => tone(sfxBus, f, t + i * 0.12, i === 3 ? 0.5 : 0.1, 'square', 0.22)); },
    lose(t) { [392, 370, 349, 330].forEach((f, i) => tone(sfxBus, f, t + i * 0.2, 0.25, 'triangle', 0.25)); },
    chest(t) { tone(sfxBus, 200, t, 0.1, 'square', 0.2, 300); [659, 784, 988, 1319].forEach((f, i) => tone(sfxBus, f, t + 0.12 + i * 0.06, 0.2, 'triangle', 0.2)); },
    card(t) { noise(sfxBus, t, 0.08, 0.3, 4000); },
    star(t) { [1047, 1319, 1568, 2093].forEach((f, i) => tone(sfxBus, f, t + i * 0.06, 0.25, 'triangle', 0.18)); },
    turn(t) { tone(sfxBus, 587, t, 0.1, 'triangle', 0.2); tone(sfxBus, 880, t + 0.1, 0.18, 'triangle', 0.2); },
    spawn(t) { tone(sfxBus, 90, t, 0.6, 'sawtooth', 0.3, 45); noise(sfxBus, t, 0.5, 0.2, 400); },
    warp(t) { tone(sfxBus, 300, t, 0.5, 'sine', 0.25, 1500); },
    boss(t) { tone(sfxBus, 70, t, 1.2, 'sawtooth', 0.35, 35); tone(sfxBus, 105, t, 1.2, 'square', 0.2, 50); },
    page(t) { noise(sfxBus, t, 0.06, 0.15, 5000); },
  };

  return {
    /* Browsers only allow audio after a user gesture; call this from input handlers. */
    unlock() { if (ensure() && trackName && !track) this.music(trackName, true); },
    setVolumes(m, s) {
      musicVol = m; sfxVol = s;
      if (musicBus) musicBus.gain.value = m * 0.35;
      if (sfxBus) sfxBus.gain.value = s * 0.6;
    },
    play(name) {
      if (!ctx || sfxVol <= 0 || !SFX[name]) return;
      try { SFX[name](ctx.currentTime + 0.005); } catch (e) { /* audio must never break the game */ }
    },
    music(name, force) {
      if (name === trackName && track && !force) return;
      trackName = name;
      if (!ctx) return;                                        // will start on unlock()
      track = name ? getTrack(name) : null;
      step = 0; nextTime = ctx.currentTime + 0.08;
      if (!timer) timer = setInterval(schedule, 40);
    },
    stopMusic() { track = null; trackName = null; },
  };
})();
