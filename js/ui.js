'use strict';
/* Sole Blessed — DOM user interface: screens, HUD, modals, input, and every human decision.
 * Human decision methods mirror Bot's (turnAction, chooseDestination, yesNo, shop, ...). */

const UI = (() => {
  const S = {
    scene: 'title', inGame: false, hud: 'none',
    turn: null,            // { p, resolve } while the human is in the pre-roll phase
    move: null,            // movement controller while choosing a destination
    pick: null,            // map space picker (trap placement)
    settings: Save.loadSettings(),
    pauseOpen: false,
  };
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ================================================================ DOM helpers */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(3)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const KEY_LABEL = { ENTER: 'Enter', ESCAPE: 'Esc', ' ': 'Space' };
  function kbd(key) { return h('kbd', null, KEY_LABEL[key.toUpperCase()] || key.toUpperCase()); }
  /* Every button: clickable/tappable, shows its shortcut, and explains itself when disabled. */
  function btn(label, key, onClick, o) {
    o = o || {};
    const b = h('button', { class: `btn ${o.cls || ''}`, type: 'button' }, key ? kbd(key) : null, h('span', { class: 'lbl', html: label }));
    b.dataset.key = key ? key.toUpperCase() : '';
    if (o.disabled) {
      b.classList.add('disabled'); b.setAttribute('aria-disabled', 'true');
      if (o.reason) { b.title = o.reason; if (o.showWhy) b.append(h('small', { class: 'why' }, o.reason)); }
    }
    b.addEventListener('click', e => {
      e.stopPropagation();
      Sound.unlock();
      if (b.classList.contains('disabled')) { if (o.reason) toast(o.reason, 'bad'); Sound.play('error'); return; }
      Sound.play('click');
      if (onClick) onClick(e);
    });
    return b;
  }
  function portraitImg(url, cls) { return h('img', { class: cls || 'portrait', src: url, alt: '' }); }
  function heroImg(p, size, cls) { return portraitImg(Sprites.heroPortrait(p, size || 96), cls); }
  function hpBar(hp, max, mini) {
    const pct = Math.max(0, Math.min(100, hp / max * 100));
    return h('div', { class: `hpbar${mini ? ' mini' : ''}` }, h('div', { class: `fill${pct < 25 ? ' low' : ''}`, style: `width:${pct}%` }), mini ? null : h('span', null, `${hp} / ${max}`));
  }
  const money = n => `${U.fmt(n)} G`;
  const spaceLabel = id => MapSys.spaceName(MapSys.spaces[id], Game.state);

  /* ================================================================ keyboard */
  const keyStack = [];               // [{fn, tag, modal}]
  function pushKeys(fn, tag, modal) { keyStack.push({ fn, tag, modal: !!modal }); }
  function popKeys(tag) { for (let i = keyStack.length - 1; i >= 0; i--) if (keyStack[i].tag === tag) { keyStack.splice(i, 1); return; } }
  function norm(e) { return e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase(); }
  document.addEventListener('keydown', e => {
    Sound.unlock();
    const k = norm(e);
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (typing && k !== 'ENTER' && k !== 'ESCAPE') return;
    if (e.repeat && (k === 'ENTER' || k === 'ESCAPE')) return;
    for (let i = keyStack.length - 1; i >= 0; i--) {
      const hnd = keyStack[i];
      if (hnd.fn(e, k)) { e.preventDefault(); return; }
      if (hnd.modal) return;
    }
    if (k === 'ESCAPE' && S.inGame && !S.pauseOpen) { e.preventDefault(); openPause(); }
  });

  /* ================================================================ toast / log */
  function toast(msg, kind) {
    const root = $('#toast-root');
    const t = h('div', { class: `toast ${kind || ''}` }, msg);
    root.append(t);
    while (root.children.length > 4) root.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2800);
    setTimeout(() => t.remove(), 3300);
  }
  /* New adventure-log entry: bump the unread badge on the Log button (or append to an open ledger). */
  let unread = 0, ledgerAppend = null;
  function logLine(entry) {
    if (ledgerAppend) { ledgerAppend(entry); return; }
    unread = Math.min(99, unread + 1);
    const b = $('#hud-side [data-key="L"]');
    if (!b) return;
    let badge = b.querySelector('.badge');
    if (!badge) { badge = h('i', { class: 'badge' }); b.append(badge); }
    badge.textContent = unread;
  }
  function ledgerRow(e) {
    const s = Game.state;
    let img;
    if (typeof e.who === 'number' && s.players[e.who]) img = Sprites.heroPortrait(s.players[e.who], 48);
    else if (e.who === 'minion') img = Sprites.portrait('minion', { color: '#6a1622' }, 48);
    else img = Sprites.portrait('npc', { npc: 'king', color: '#c9a36a' }, 48);
    return h('div', { class: 'lg-row' }, portraitImg(img, 'lg-av'), h('div', { class: 'lg-text' }, e.text), h('span', { class: 'lg-ico' }, e.icon || '•'));
  }
  /* Spec §3.1: clipboard ledger in the centre of the screen, newest first, grouped by day. */
  function openLedger() {
    const s = Game.state;
    if (!s) return;
    unread = 0;
    const badge = $('#hud-side [data-key="L"] .badge');
    if (badge) badge.remove();
    const paper = h('div', { class: 'lg-paper' });
    let lastDay = null;
    for (const e of s.log.slice().reverse()) {
      if (e.day !== lastDay) { lastDay = e.day; paper.append(h('div', { class: 'lg-day' }, `Day ${e.day}`)); }
      paper.append(ledgerRow(e));
    }
    if (!s.log.length) paper.append(h('p', { class: 'dim' }, 'Nothing has happened yet.'));
    const board = h('div', { class: 'clipboard' }, h('div', { class: 'clip' }), h('div', { class: 'lg-title' }, '📜 Adventure Log'), paper);
    ledgerAppend = e => {
      let head = paper.querySelector('.lg-day');
      if (!head || head.textContent !== `Day ${e.day}`) { head = h('div', { class: 'lg-day' }, `Day ${e.day}`); paper.prepend(head); }
      head.after(ledgerRow(e));
    };
    return modal({
      cls: 'ledger', body: board, buttons: [{ label: 'Close', key: 'Esc', value: null }],
      onKey: (e, k) => {
        if (k === 'W' || k === 'ARROWUP') { paper.scrollBy(0, -80); return true; }
        if (k === 'S' || k === 'ARROWDOWN') { paper.scrollBy(0, 80); return true; }
        if (k === 'L') return true;
        return false;
      },
      onClose: () => { ledgerAppend = null; },
    });
  }
  function openRequest() {
    const s = Game.state, r = s && s.request;
    if (!r) return;
    const rows = s.players.map(p => `<li>${U.esc(p.name)}: ${U.fmt(Math.min(r.progress[p.id] || 0, r.n))} / ${U.fmt(r.n)}${r.winner === p.id ? ' 👑' : ''}</li>`).join('');
    modal({ title: `👑 King's Request`, html: `<p class="rq-big">${r.icon} ${U.esc(r.text)}</p><p>Posted on day ${r.day}, ends after day ${r.ends}. The first hero to finish earns <b>+1 ⭐ and ${U.fmt(r.reward)} G</b>.</p>${r.winner != null ? `<p><b>Completed by ${U.esc(s.players[r.winner].name)}.</b> A new request arrives next week.</p>` : ''}<ul>${rows}</ul>`, buttons: [{ label: 'OK', key: 'Enter', value: true, cls: 'primary' }] });
  }

  /* ================================================================ modal system */
  let modalSeq = 0;
  /* opts: title, html | body(node|fn(box, close)), buttons [{label,key,value,disabled,reason,cls,onClick}],
   * closable (Esc), escValue, cls, onKey(e,k,close), ref (receives {close}). Returns Promise<value>. */
  function modal(o) {
    return new Promise(resolve => {
      const tag = 'modal' + (++modalSeq);
      const overlay = h('div', { class: `overlay ${o.clear ? 'clear' : ''}` });
      const box = h('div', { class: `modal ${o.cls || ''}`, role: 'dialog' });
      let closed = false;
      const close = v => {
        if (closed) return;
        closed = true;
        popKeys(tag);
        overlay.classList.add('out');
        setTimeout(() => overlay.remove(), 160);
        if (o.onClose) o.onClose(v);
        resolve(v);
      };
      if (o.ref) o.ref.close = close;
      if (o.title) box.append(h('div', { class: 'modal-title' }, h('span', { html: o.title }), o.closable !== false ? h('button', { class: 'x', type: 'button', onclick: () => close(o.escValue === undefined ? null : o.escValue), title: 'Close (Esc)' }, '✕') : null));
      const body = h('div', { class: 'modal-body' });
      if (o.html) body.innerHTML = o.html;
      if (o.body) { const r = typeof o.body === 'function' ? o.body(body, close) : o.body; if (r && r.nodeType) body.append(r); }
      box.append(body);
      const btns = h('div', { class: 'modal-btns' });
      (o.buttons || []).forEach(bd => {
        btns.append(btn(bd.label, bd.key, () => { if (bd.onClick) { const r = bd.onClick(close); if (r === false) return; } else close(bd.value); }, bd));
      });
      if (o.buttons && o.buttons.length) box.append(btns);
      overlay.append(box);
      $('#modal-root').append(overlay);
      let focus = -1;
      const focusables = () => [...box.querySelectorAll('.btn:not(.disabled), .pick:not(.disabled)')].filter(b => b.offsetParent !== null);
      const setFocus = i => {
        const f = focusables(); if (!f.length) return;
        focus = (i + f.length) % f.length;
        f.forEach((b, j) => b.classList.toggle('focus', j === focus));
        f[focus].scrollIntoView({ block: 'nearest' });
      };
      pushKeys((e, k) => {
        if (o.onKey && o.onKey(e, k, close)) return true;
        if (k === 'ESCAPE') { if (o.closable !== false) close(o.escValue === undefined ? null : o.escValue); return true; }
        const all = [...box.querySelectorAll('.btn, .pick')];
        const hit = all.find(b => b.dataset.key && b.dataset.key === k);
        if (hit) { hit.click(); return true; }
        if (['W', 'A', 'ARROWUP', 'ARROWLEFT'].includes(k)) { setFocus(focus < 0 ? 0 : focus - 1); Sound.play('select'); return true; }
        if (['S', 'D', 'ARROWDOWN', 'ARROWRIGHT', 'TAB'].includes(k)) { setFocus(focus + 1); Sound.play('select'); return true; }
        if (k === 'ENTER' || k === ' ') {
          const f = focusables();
          const target = focus >= 0 ? f[focus] : box.querySelector('.btn.primary:not(.disabled)') || f[0];
          if (target) target.click();
          return true;
        }
        return true;
      }, tag, true);
      if (o.auto > 0) setTimeout(() => close(o.autoValue), o.auto);
    });
  }
  function confirm(title, text, yes, no) {
    return modal({ title, html: `<p>${text}</p>`, escValue: false, buttons: [
      { label: yes || 'Confirm', key: 'Enter', value: true, cls: 'primary' },
      { label: no || 'Cancel', key: 'Esc', value: false },
    ] });
  }
  function choice(title, text, options, o) {
    return modal(Object.assign({ title, html: text ? `<p>${text}</p>` : '', buttons: options.map((op, i) => Object.assign({ key: op.key || String(i + 1) }, op)) }, o || {}));
  }
  function announce(o) {
    if (o.auto === undefined) o.auto = 0;
    return modal({
      title: `${o.icon ? o.icon + ' ' : ''}${U.esc(o.title)}`, cls: 'announce', clear: o.auto > 0,
      html: `<p>${U.esc(o.text)}</p>`, auto: o.auto,
      buttons: o.auto > 0 ? [] : [{ label: 'OK', key: 'Enter', value: true, cls: 'primary' }],
    });
  }

  /* ================================================================ scenes & screens */
  function setScene(sc) { S.scene = sc; document.body.dataset.scene = sc; }
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  }

  function buildTitle() {
    const scr = $('#screen-title');
    scr.innerHTML = '';
    const rec = Save.records();
    const found = ['good', 'secret', 'bad'].filter(k => rec.endings && rec.endings[k]).length;
    const text = h('p', { class: 'cinematic-text' });
    scr.append(h('div', { class: 'title-wrap' },
      h('h1', { class: 'logo' }, h('span', { class: 'l1' }, 'Sole'), h('span', { class: 'l2' }, 'Blessed')),
      h('div', { class: 'tagline' }, "A board-game RPG · The King's Blessing awaits"),
      h('div', { class: 'panel cinematic' }, text),
      h('div', { class: 'title-menu' },
        btn('Start Game', '1', () => openCreate(), { cls: 'primary big' }),
        btn('Load Game', '2', () => openSlots('load'), { cls: 'big' }),
        btn('Settings', '3', () => openSettings(), { cls: 'big' })),
      h('div', { class: 'records' }, rec.gamesPlayed ? `Endings discovered ${found}/3 · Games played ${rec.gamesPlayed} · Best ⭐ ${rec.bestStars}` : 'Tip: press the number keys or tap the buttons.')));
    typewriter(text, DATA.DIALOGUE.cinematic, 22);
    popKeys('title');
    pushKeys((e, k) => {
      if (!scr.classList.contains('show')) return false;
      const b = [...scr.querySelectorAll('.btn')].find(x => x.dataset.key === k);
      if (b) { b.click(); return true; }
      if (k === 'ENTER') { openCreate(); return true; }
      return false;
    }, 'title');
  }
  function typewriter(el, text, speed) {
    el.textContent = '';
    let i = 0;
    const id = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(id); }, speed);
    el.onclick = () => { clearInterval(id); el.textContent = text; };
  }
  function showTitle() {
    S.inGame = false;
    setHud('none');
    setScene('title');
    MapSys.setMode('full');
    buildTitle();
    showScreen('screen-title');
    $('#turn-label').classList.remove('show');
    Sound.music('title');
  }

  /* ---------------------------------------------------------------- character creation */
  function openCreate() {
    const scr = $('#screen-create');
    showScreen('screen-create');
    const st = { name: '', gender: null, classId: null, rules: Object.assign({}, DATA.RULES_DEFAULT) };
    const preview = h('div', { class: 'create-preview' });
    const name = h('input', { type: 'text', maxlength: '12', placeholder: 'Hero name (1–12)', autocomplete: 'off', spellcheck: 'false' });
    const begin = btn('Begin Journey', 'Enter', () => start(), { cls: 'primary big' });
    const why = h('div', { class: 'create-why' });
    const genders = h('div', { class: 'seg' });
    const cards = h('div', { class: 'class-cards' });
    const rules = h('div', { class: 'rules' });
    function refresh() {
      st.name = name.value.trim();
      genders.innerHTML = '';
      [['m', '♂ Male', 'M'], ['f', '♀ Female', 'F']].forEach(([g, label, key]) => {
        const b = btn(label, key, () => { st.gender = g; refresh(); }, { cls: st.gender === g ? 'on' : '' });
        genders.append(b);
      });
      cards.innerHTML = '';
      DATA.TIER1.forEach((cid, i) => {
        const c = DATA.CLASSES[cid];
        const card = h('div', { class: `class-card pick ${st.classId === cid ? 'on' : ''}`, tabindex: '0' },
          h('div', { class: 'cc-key' }, kbd(String(i + 1))),
          portraitImg(Sprites.portrait('hero', { classId: cid, gender: st.gender || 'm', color: DATA.PLAYER_COLORS[0] }, 96)),
          h('b', null, c.name),
          h('div', { class: 'cc-line' }, h('em', null, c.passive.name), ': ', c.passive.text),
          h('div', { class: 'cc-line' }, h('em', null, c.move.name), ` (CD ${c.move.cd}): ${c.move.text}`),
          h('div', { class: 'cc-line dim' }, 'Level-up: ' + Object.entries(c.levelUp).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ')));
        card.dataset.key = String(i + 1);
        card.onclick = () => { Sound.play('select'); st.classId = cid; refresh(); };
        cards.append(card);
      });
      rules.innerHTML = '';
      const days = h('div', { class: 'seg small' });
      DATA.DAY_OPTIONS.forEach((d, i) => days.append(btn(d ? `📅 ${d} days` : '♾️ Endless', i ? 'E' : 'T', () => { st.rules.days = d; refresh(); }, { cls: st.rules.days === d ? 'on' : '' })));
      rules.append(days, h('div', { class: 'rules-note' }, st.rules.days
        ? `The Demon Lord must fall and his head reach the Royal Castle within ${st.rules.days} days.`
        : "No time limit: the game ends when the Demon Lord's Head is delivered to the Royal Castle."));
      preview.innerHTML = '';
      if (st.classId) preview.append(portraitImg(Sprites.portrait('hero', { classId: st.classId, gender: st.gender || 'm', color: DATA.PLAYER_COLORS[0] }, 160), 'big-portrait'), h('div', { class: 'pv-name' }, st.name || '???'));
      const missing = [!st.name && 'a name', !st.gender && 'a gender', !st.classId && 'a class'].filter(Boolean);
      begin.classList.toggle('disabled', missing.length > 0);
      begin.title = missing.length ? `Choose ${missing.join(', ')} first.` : '';
      why.textContent = missing.length ? `Choose ${missing.join(', ')} to begin.` : 'Ready!';
    }
    name.addEventListener('input', refresh);
    async function start() {
      refresh();
      if (begin.classList.contains('disabled')) { toast(begin.title, 'bad'); Sound.play('error'); return; }
      popKeys('create');
      const state = Game.newState({ name: st.name, gender: st.gender, classId: st.classId }, st.rules);
      await briefBots(state);
      Game.start(state);
    }
    scr.innerHTML = '';
    scr.append(h('div', { class: 'create-wrap panel' },
      h('h2', null, 'Create Your Hero'),
      h('div', { class: 'create-grid' },
        h('div', { class: 'create-form' },
          h('label', null, 'Name'), h('div', { class: 'row' }, name, btn('🎲', null, () => { name.value = U.pick(DATA.BOT_NAMES); refresh(); }, { cls: 'small' })),
          h('label', null, 'Gender'), genders,
          h('label', null, 'Class'), cards,
          h('label', null, 'Game length'), rules),
        preview),
      h('div', { class: 'create-foot' }, why, btn('Back', 'Esc', () => { popKeys('create'); showTitle(); }), begin)));
    refresh();
    setTimeout(() => name.focus(), 50);
    popKeys('create');
    pushKeys((e, k) => {
      if (!scr.classList.contains('show')) return false;
      if (e.target === name) { if (k === 'ENTER') { name.blur(); refresh(); return true; } if (k === 'ESCAPE') { name.blur(); return true; } return false; }
      if (k === 'ESCAPE') { popKeys('create'); showTitle(); return true; }
      if (k === 'ENTER') { start(); return true; }
      if (k === 'M') { st.gender = 'm'; refresh(); return true; }
      if (k === 'F') { st.gender = 'f'; refresh(); return true; }
      if (k === 'T') { st.rules.days = DATA.DAY_OPTIONS[0]; refresh(); return true; }
      if (k === 'E') { st.rules.days = 0; refresh(); return true; }
      if (['1', '2', '3'].includes(k)) { st.classId = DATA.TIER1[Number(k) - 1]; Sound.play('select'); refresh(); return true; }
      if (k === 'A' || k === 'ARROWLEFT' || k === 'D' || k === 'ARROWRIGHT') {
        const i = DATA.TIER1.indexOf(st.classId), d = (k === 'A' || k === 'ARROWLEFT') ? -1 : 1;
        st.classId = DATA.TIER1[(i + d + 3) % 3]; Sound.play('select'); refresh(); return true;
      }
      return false;
    }, 'create');
  }
  async function briefBots(state) {
    const rows = state.players.slice(1).map(p => `<div class="rival">${`<img class="portrait" src="${Sprites.heroPortrait(p, 64)}">`}<div><b>${U.esc(p.name)}</b><br><small>${DATA.CLASSES[p.classId].name}</small></div></div>`).join('');
    await modal({ title: 'Your Rivals', html: `<p>Three other heroes answer the King's call:</p><div class="rivals">${rows}</div><p class="dim">Game length: ${state.rules.days ? state.rules.days + ' days' : 'Endless'}</p>`, buttons: [{ label: 'Let\'s go!', key: 'Enter', value: true, cls: 'primary' }], closable: false });
  }

  /* ---------------------------------------------------------------- settings / help / saves / pause */
  function openSettings() {
    const st = S.settings;
    const slider = (label, key) => {
      const out = h('output', null, Math.round(st[key] * 100) + '%');
      const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(st[key]) });
      input.oninput = () => { st[key] = Number(input.value); out.textContent = Math.round(st[key] * 100) + '%'; Sound.setVolumes(st.musicVolume, st.sfxVolume); Save.saveSettings(st); };
      input.onchange = () => Sound.play('coin');
      return h('div', { class: 'set-row' }, h('label', null, label), input, out);
    };
    const speed = h('div', { class: 'seg small' });
    const drawSpeed = () => {
      speed.innerHTML = '';
      DATA.SPEEDS.forEach(v => speed.append(btn(`${v}×`, null, () => { st.speed = v; Save.saveSettings(st); drawSpeed(); }, { cls: st.speed === v ? 'on' : '' })));
    };
    drawSpeed();
    return modal({
      title: '⚙️ Settings', cls: 'wide',
      body: h('div', { class: 'settings' },
        slider('🎵 Music', 'musicVolume'), slider('🔊 Sound effects', 'sfxVolume'),
        h('div', { class: 'set-row' }, h('label', null, '⏩ Game speed'), speed),
        h('h3', null, 'Controls'), keyTable(),
        h('h3', null, 'How to Play (summary)'), helpList(true)),
      buttons: [{ label: 'Close', key: 'Esc', value: true }],
    });
  }
  function keyTable() {
    return h('table', { class: 'keys' }, DATA.KEYS.map(([sit, keys]) => h('tr', null, h('th', null, sit), h('td', null, keys))));
  }
  function helpList(short) {
    return h('div', { class: 'help' }, DATA.HELP.slice(0, short ? 4 : 99).map(([t, d]) => h('div', { class: 'help-item' }, h('b', null, t), h('p', null, d))));
  }
  function openHelp() {
    return modal({ title: '❓ How to Play', cls: 'wide', body: h('div', null, helpList(false), h('h3', null, 'Controls'), keyTable()), buttons: [{ label: 'Close', key: 'Esc', value: true }] });
  }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return iso; } }
  function slotCard(meta, label) {
    if (!meta) return h('div', { class: 'slot-info empty' }, h('b', null, label), h('span', null, 'Empty'));
    return h('div', { class: 'slot-info' },
      portraitImg(Sprites.portrait('hero', { classId: meta.classId, gender: meta.gender, color: meta.color }, 64)),
      h('div', null, h('b', null, `${label} · ${U.esc(meta.name)}`),
        h('div', null, `${meta.className} · Lv ${meta.level}`),
        h('div', null, `Day ${meta.day} · ⭐ ${meta.stars}`),
        h('small', null, fmtDate(meta.savedAt))));
  }
  /* mode 'load' (from title: Load/Delete) or 'save' (from pause: overwrite confirm). */
  function openSlots(mode) {
    const ref = {};
    const build = (box) => {
      box.innerHTML = '';
      if (!Save.available()) box.append(h('p', { class: 'warn' }, '⚠️ Browser storage is unavailable (private mode?). Saves will be lost when the tab closes.'));
      const slots = Save.listSlots();
      slots.forEach(({ slot, meta, corrupt, outdated }) => {
        const bad = corrupt || outdated;
        const row = h('div', { class: 'slot' }, bad ? h('div', { class: 'slot-info empty' }, h('b', null, `Slot ${slot}`), h('span', null, outdated ? 'Saved by an older version (old map) — cannot be loaded' : 'Corrupted save')) : slotCard(meta, `Slot ${slot}`));
        const actions = h('div', { class: 'slot-actions' });
        if (mode === 'save') {
          actions.append(btn(meta ? 'Overwrite' : 'Save', String(slot), async () => {
            if (meta && !(await confirm('Overwrite save?', `Slot ${slot} already holds <b>${U.esc(meta.name)}</b> (Day ${meta.day}). Replace it?`, 'Overwrite'))) return;
            if (Save.saveSlot(slot, Game.state)) { toast(`💾 Saved to slot ${slot}.`, 'good'); Sound.play('coin'); build(box); }
            else toast('Save failed — storage is full or blocked.', 'bad');
          }, { cls: 'primary' }));
        } else {
          actions.append(btn('Load', String(slot), async () => {
            const st = Save.loadSlot(slot);
            if (!st) { toast('This save cannot be read.', 'bad'); return; }
            ref.close(true);
            Game.start(st);
          }, { disabled: !meta || bad, reason: outdated ? 'This save is from an older version of the game.' : corrupt ? 'This save is corrupted.' : 'This slot is empty.', cls: 'primary' }));
          actions.append(btn('Delete', null, async () => {
            if (await confirm('Delete save?', `Delete slot ${slot}${meta ? ` (<b>${U.esc(meta.name)}</b>, Day ${meta.day})` : ''}? This cannot be undone.`, 'Delete')) { Save.deleteSlot(slot); toast('Deleted.', 'good'); build(box); }
          }, { disabled: !meta && !bad, reason: 'This slot is empty.', cls: 'danger' }));
        }
        row.append(actions);
        box.append(row);
      });
      if (mode === 'load') {
        const am = Save.autosaveMeta();
        const row = h('div', { class: 'slot auto' }, slotCard(am, 'Autosave'));
        row.append(h('div', { class: 'slot-actions' }, btn('Load', '5', () => {
          const st = Save.loadAutosave();
          if (!st) return;
          ref.close(true); Game.start(st);
        }, { disabled: !am, reason: 'No autosave yet. The game autosaves at the start of each of your turns.', cls: 'primary' })));
        box.append(row);
      }
    };
    return modal({ title: mode === 'save' ? '💾 Save Game' : '📂 Load Game', cls: 'wide', ref, body: box => { const inner = h('div', { class: 'slots' }); build(inner); return inner; }, buttons: [{ label: 'Back', key: 'Esc', value: null }] });
  }
  async function openPause() {
    if (S.pauseOpen) return;
    S.pauseOpen = true;
    Game.paused = true;
    const canSave = Game.canSave();
    const res = await modal({
      title: '⏸ Paused', cls: 'pause',
      body: h('div', { class: 'pause-info' }, Game.state ? `Day ${Game.state.day} / ${Game.endless() ? '∞ (Endless)' : Game.maxDays()} · Speed ${Game.speed()}×` : ''),
      buttons: [
        { label: 'Resume', key: 'Esc', value: 'resume', cls: 'primary' },
        { label: 'Save', key: '1', value: 'save', disabled: !canSave, reason: 'You can save only on your own turn, before rolling.' },
        { label: 'Settings', key: '2', value: 'settings' },
        { label: 'How to Play', key: 'Z', value: 'help' },
        { label: 'Exit to Start Screen', key: '3', value: 'exit', cls: 'danger' },
      ],
      escValue: 'resume',
    });
    S.pauseOpen = false;
    if (res === 'save') { await openSlots('save'); return reopenPause(); }
    if (res === 'settings') { await openSettings(); return reopenPause(); }
    if (res === 'help') { await openHelp(); return reopenPause(); }
    if (res === 'exit') {
      if (await confirm('Exit to Start Screen?', 'Unsaved progress since your last save will be lost (an autosave exists from the start of your last turn).', 'Exit')) {
        Game.paused = false; exitToTitle(); return;
      }
      return reopenPause();
    }
    Game.paused = false;
  }
  function reopenPause() { S.pauseOpen = false; return openPause(); }
  function exitToTitle() {
    Game.stop();
    closeAllModals();
    endMove();
    BattleView.close();
    showTitle();
  }
  function closeAllModals() {
    $('#modal-root').innerHTML = '';
    const persistent = new Set(['hud', 'title']);
    for (let i = keyStack.length - 1; i >= 0; i--) if (!persistent.has(keyStack[i].tag)) keyStack.splice(i, 1);
    $('#dialogue').classList.remove('show');
    $('#dice-layer').classList.remove('show');
    S.pauseOpen = false;
  }

  /* ================================================================ HUD */
  function buildHud() {
    const hud = $('#hud');
    hud.innerHTML = '';
    hud.append(
      h('div', { id: 'hud-day', class: 'panel' }, h('div', { class: 'day-label' }), btn('⏸', 'Esc', () => openPause(), { cls: 'small pause-btn' })),
      h('div', { id: 'hud-active', class: 'panel', onclick: () => { const p = Game.cur(); if (p) openStatus(p); } }),
      h('div', { id: 'hud-side' },
        sideBtn('🎲', 'Move', 'Q', () => onQ()),
        sideBtn('🎒', 'Inventory', 'O', () => onO()),
        sideBtn('🎥', 'Free Camera', 'I', () => toggleFreeCam()),
        sideBtn('📋', 'Status', 'X', () => onX()),
        sideBtn('📜', 'Log', 'L', () => openLedger())),
      h('div', { id: 'hud-request', class: 'panel', onclick: () => openRequest() }),
      h('div', { id: 'hud-others' }),
      h('div', { id: 'hud-bl' }, btn('How to Play', 'Z', () => openHelp(), { cls: 'small' })),
      h('div', { id: 'hud-skip' }, 'Bot turn · ', kbd('Enter'), ' skip ahead'),
    );
  }
  function sideBtn(icon, label, key, fn) {
    const b = h('button', { class: 'side-btn', type: 'button', 'data-key': key }, h('span', { class: 'ico' }, icon), kbd(key), h('small', null, label));
    b.addEventListener('click', e => {
      e.stopPropagation(); Sound.unlock();
      if (b.classList.contains('disabled')) { toast(b.title || 'Not available now.', 'bad'); Sound.play('error'); return; }
      Sound.play('click'); fn();
    });
    return b;
  }
  function setHud(mode) {
    S.hud = mode;
    $('#hud').classList.toggle('show', mode === 'normal');
    $('#move-hud').classList.toggle('show', mode === 'move');
  }
  function refresh() {
    const s = Game.state;
    if (!s || !S.inGame) return;
    const cur = Game.cur();
    const dl = $('#hud-day .day-label');
    if (dl) dl.innerHTML = `<span class="dl-word">Day</span> <b>${s.day}</b> / ${Game.endless() ? '∞' : Game.maxDays()}`;
    const rq = $('#hud-request');
    if (rq) {
      const r = s.request;
      rq.classList.toggle('show', !!r);
      if (r) {
        const left = r.ends - s.day + 1, mine = r.progress[Game.human() ? Game.human().id : -1] || 0;
        rq.innerHTML = r.winner != null
          ? `<span class="rq-ico">👑</span><span><b>King's Request</b> done by ${U.esc(s.players[r.winner].name)}</span>`
          : `<span class="rq-ico">${r.icon}</span><span><b>King's Request:</b> ${U.esc(r.text)} <small>(${U.fmt(Math.min(mine, r.n))}/${U.fmt(r.n)} · ${left} day${left > 1 ? 's' : ''} left)</small></span>`;
      }
    }
    const act = $('#hud-active');
    if (act) {
      act.innerHTML = '';
      act.style.setProperty('--pc', cur.color);
      act.append(heroImg(cur, 80),
        h('div', { class: 'act-body' },
          h('div', { class: 'act-top' }, h('span', { class: 'lv' }, `Lv ${cur.level}`), h('b', null, cur.name)),
          h('div', { class: 'act-class' }, Game.cls(cur).name),
          h('div', { class: 'act-row' }, `Rank ${Game.rank(cur)} · ⭐ ${cur.stars} · 💰 ${money(cur.money)}`),
          h('div', { class: 'act-row stats' }, `AT ${Game.stat(cur, 'at')} · DF ${Game.stat(cur, 'df')} · SP ${Game.stat(cur, 'sp')}`),
          hpBar(cur.hp, Game.maxHp(cur))));
    }
    const others = $('#hud-others');
    if (others) {
      others.innerHTML = '';
      s.players.filter(p => p !== cur).forEach(p => {
        others.append(h('div', { class: 'other panel', style: `--pc:${p.color}`, onclick: () => openStatus(p) },
          heroImg(p, 56),
          h('div', null, h('div', { class: 'o-name' }, h('span', { class: 'lv' }, `Lv ${p.level}`), ` ${p.name}${p.isBot ? '' : ' (You)'}`),
            h('div', { class: 'o-row' }, `⭐ ${p.stars}${s.head.holder === p.id ? ' · 💀' : ''}${p.battleId ? ' · ⚔️' : ''}`),
            hpBar(p.hp, Game.maxHp(p), true))));
      });
    }
    $('#turn-label').textContent = `${cur.name}'s turn`;
    $('#turn-label').style.setProperty('--pc', cur.color);
    const human = !cur.isBot && S.turn;
    const reason = cur.isBot ? `Wait — it's ${cur.name}'s turn.` : 'Not available right now.';
    document.querySelectorAll('#hud-side .side-btn').forEach(b => {
      const k = b.dataset.key;
      if (k === 'L') { b.classList.remove('disabled'); b.title = ''; return; }    // reading the log is always allowed
      let off = !human;
      if (!cur.isBot && (k === 'I' || k === 'X')) off = false;   // looking around is fine on your own turn
      if (cur.isBot) off = true;                                  // spec: bot turn disables commands (except Pause)
      b.classList.toggle('disabled', off);
      b.title = off ? reason : '';
    });
    const q = $('#hud-side [data-key="Q"] small');
    if (q) q.textContent = 'Move';
    $('#hud-skip').classList.toggle('show', cur.isBot && S.hud === 'normal');
  }

  /* ---------------------------------------------------------------- human pre-roll */
  function turnStart(p) {
    S.inGame = true;
    MapSys.setMode('follow');
    MapSys.follow(null);
    refresh();
    $('#turn-label').classList.add('show');
    Sound.play('turn');
    banner(`${p.name}'s turn`, p.color);
    setHud('normal');
    refresh();
  }
  function banner(text, color, sub) {
    const b = $('#banner');
    b.innerHTML = '';
    b.append(h('div', { class: 'banner-text', style: color ? `--pc:${color}` : '' }, text, sub ? h('small', null, sub) : null));
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  function turnAction(p) {
    setHud('normal');
    return new Promise(resolve => {
      S.turn = { p, resolve };
      refresh();
      if (Game.joinableBattle(p)) toast('⚔️ A Demon Lord Army battle is raging here! Press Q to join or roll.', 'info');
    });
  }
  function endTurnAction(result) {
    const t = S.turn;
    if (!t) return;
    S.turn = null;
    refresh();
    t.resolve(result);
  }
  async function onQ() {
    const t = S.turn; if (!t) return;
    const p = t.p;
    if (p.turnOver || p.battleId) return endTurnAction({ type: 'end' });
    const jb = Game.joinableBattle(p);
    if (jb) {
      const d = Battle.enemyDef(jb);
      const r = await choice('⚔️ Battle in progress', `${jb.parts.map(id => Game.player(id).name).join(', ')} ${jb.parts.length > 1 ? 'are' : 'is'} fighting the <b>${d.name}</b> (${d.live.hp}/${d.live.maxHp} HP) on your space. Join instead of rolling? The team attacks first and gets +10% damage per extra ally.`, [
        { label: 'Join the battle', value: 'join', cls: 'primary' }, { label: 'Roll the dice', value: 'move' }, { label: 'Cancel', key: 'Esc', value: null },
      ]);
      if (!r || S.turn !== t) return;
      return endTurnAction({ type: r });
    }
    endTurnAction({ type: 'move' });
  }
  function onO() {
    const p = S.turn ? S.turn.p : null;
    if (p) openInventory(p, true);
  }
  function onX() {
    const s = Game.state; if (!s) return;
    openStatus(S.turn ? S.turn.p : Game.human());
  }
  function toggleFreeCam() {
    if (MapSys.cam.mode === 'free') { MapSys.setMode('follow'); toast('🎥 Camera follows the active hero.'); }
    else { MapSys.setMode('free'); toast('🎥 Free camera: W/A/S/D or drag to look around. I or Esc to return.'); }
  }
  // HUD keyboard (normal play)
  pushKeys((e, k) => {
    if (!S.inGame || S.hud !== 'normal') return false;
    const cur = Game.state && Game.cur();
    if (!cur) return false;
    if (k === 'L') { openLedger(); return true; }
    if (cur.isBot && k === 'ENTER' && !Game.skipping) { Game.skipping = true; toast('⏩ Skipping ahead…'); return true; }
    // The battle screen is forced: no inventory, status or ending the turn mid-fight (e.g. a Challenge Letter duel).
    if (BattleView.isOpen) return false;
    if (MapSys.cam.mode === 'free') {
      const d = 60;
      if (k === 'W' || k === 'ARROWUP') { MapSys.pan(0, -d); return true; }
      if (k === 'S' || k === 'ARROWDOWN') { MapSys.pan(0, d); return true; }
      if (k === 'A' || k === 'ARROWLEFT') { MapSys.pan(-d, 0); return true; }
      if (k === 'D' || k === 'ARROWRIGHT') { MapSys.pan(d, 0); return true; }
      if (k === 'ESCAPE' || k === 'I') { toggleFreeCam(); return true; }
    }
    if (cur.isBot || !S.turn) return false;
    const map = { Q: onQ, O: onO, I: toggleFreeCam, X: onX, Z: openHelp };
    if (map[k]) { Sound.play('click'); map[k](); return true; }
    return false;
  }, 'hud');

  /* ================================================================ dice */
  function dieFace(v) {
    const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v];
    return h('div', { class: 'die' }, Array.from({ length: 9 }, (_, i) => h('i', { class: pips.includes(i) ? 'on' : '' })));
  }
  function rollDice(p, n) {
    const layer = $('#dice-layer');
    const row = h('div', { class: 'dice-row' });
    const caption = h('div', { class: 'dice-caption' });
    const values = Array.from({ length: n }, () => U.randInt(1, 6));
    layer.innerHTML = '';
    layer.append(h('div', { class: 'dice-box' }, h('div', { class: 'dice-title' }, `${p.name} rolls ${n} ${n > 1 ? 'dice' : 'die'}`), row, caption));
    layer.classList.add('show');
    let spinning = true;
    const spin = setInterval(() => {
      row.innerHTML = '';
      for (let i = 0; i < n; i++) row.append(dieFace(U.randInt(1, 6)));
      Sound.play('dice');
    }, 80);
    return new Promise(resolve => {
      const stop = () => {
        if (!spinning) return;
        spinning = false;
        clearInterval(spin);
        popKeys('dice');
        row.innerHTML = '';
        values.forEach(v => row.append(dieFace(v)));
        row.classList.add('landed');
        const total = values.reduce((a, b) => a + b, 0);
        caption.innerHTML = `<b class="total">${total}</b>${n > 1 ? ` <small>(${values.join(' + ')})</small>` : ''}`;
        Sound.play('diceStop');
        setTimeout(() => { layer.classList.remove('show'); row.classList.remove('landed'); resolve(values); }, Math.max(250, 900 * Game.delayFactor()));
      };
      if (p.isBot) { setTimeout(stop, Math.max(80, 700 * Game.delayFactor())); return; }
      Game.needHuman();
      caption.append(btn('Stop!', 'Q', stop, { cls: 'primary' }), h('small', { class: 'dim' }, ' or Enter'));
      layer.onclick = stop;
      pushKeys((e, k) => { if (k === 'Q' || k === 'ENTER' || k === ' ') { stop(); return true; } return false; }, 'dice');
    });
  }

  /* ================================================================ movement */
  function walk(p, path) { return MapSys.walk('p' + p.id, path, 230 * Game.delayFactor()); }
  /* Spec §3.2–3.3: walk EXACTLY the rolled number of spaces. Arrows only offer steps that can still
   * finish exactly; goal flags mark every space the move can end on. */
  function chooseDestination(p, moves, total) {
    Game.needHuman();
    setHud('move');
    const start = p.spaceId, ends = moves.ends;
    const blk = id => Game.isBlocking(id);
    const blockingSet = new Set([...ends.keys()].filter(blk));
    const m = S.move = { p, start, path: [start], total, mode: 'manual', list: [], idx: 0, busy: false, live: moves };
    const s0 = MapSys.spaces[start];
    m.list = [...ends.keys()].sort((a, b) => {
      const A = MapSys.spaces[a], B = MapSys.spaces[b];
      return Math.atan2(A.y - s0.y, A.x - s0.x) - Math.atan2(B.y - s0.y, B.x - s0.x);
    });
    $('#move-hud').innerHTML = '';
    $('#move-hud').append(
      h('div', { id: 'move-cmds', class: 'panel' },
        btn('Free Camera', 'E', () => setMode(m.mode === 'free' ? 'manual' : 'free'), { cls: 'small' }),
        btn('Auto-Move', 'I', () => setMode(m.mode === 'auto' ? 'manual' : 'auto'), { cls: 'small' }),
        btn('Status', 'O', () => openStatus(p, true), { cls: 'small' }),
        btn('Full Map', 'N', () => setMode(m.mode === 'full' ? 'manual' : 'full'), { cls: 'small' })),
      h('div', { id: 'move-bl' }, h('div', { id: 'move-info', class: 'panel' }), h('div', { id: 'move-left', class: 'panel' })),
      h('div', { id: 'dpad' }, ['W', 'A', 'S', 'D'].map(k => h('button', { class: `dp dp-${k}`, type: 'button', onclick: e => { e.stopPropagation(); if (m.dir) m.dir(k); } }, { W: '▲', A: '◀', S: '▼', D: '▶' }[k]))));
    return new Promise(resolve => {
      function remaining() { return total - (m.path.length - 1); }
      function update() {
        const cur = m.path[m.path.length - 1];
        const L = $('#move-left');
        L.innerHTML = '';
        if (m.mode === 'auto') {
          const sel = m.list[m.idx], route = ends.get(sel);
          L.append(h('div', { class: 'big-num' }, `${m.idx + 1}/${m.list.length}`), h('div', null, 'destinations · A/D to pick'),
            btn('Go here', 'Enter', () => confirmAuto(), { cls: 'primary small' }), btn('Back', 'Esc', () => setMode('manual'), { cls: 'small' }));
          MapSys.setOverlay({ reach: new Set(ends.keys()), dests: new Set(ends.keys()), blocking: blockingSet, route, selected: sel, markers: true });
          MapSys.setMode('free'); MapSys.focus(MapSys.spaces[sel].x, MapSys.spaces[sel].y);
          info(sel);
        } else {
          m.live = MapSys.exactMoves(m.path, remaining(), blk);
          L.append(h('div', { class: 'big-num' }, String(remaining())), h('div', null, `step${remaining() === 1 ? '' : 's'} left`),
            h('small', { class: 'dim' }, m.path.length > 1 ? 'Walk every step · step back to undo' : 'You must walk every step'));
          const arrows = { from: cur };
          for (const k in MapSys.spaces[cur].dirs) { const n = MapSys.spaces[cur].dirs[k]; if (m.live.next.has(n)) arrows[k] = n; }
          const prev = m.path[m.path.length - 2];
          if (prev) for (const k in MapSys.spaces[cur].dirs) if (MapSys.spaces[cur].dirs[k] === prev) arrows[k] = prev;
          const dests = new Set(m.live.ends.keys());
          MapSys.setOverlay({ reach: dests, dests, blocking: blockingSet, arrows, markers: true, pathSet: new Set(m.path.slice(1)) });
          if (m.mode === 'manual') MapSys.setMode('follow');
          info(cur === start ? null : cur);
        }
        $('#move-cmds [data-key="I"] .lbl').textContent = m.mode === 'auto' ? 'Manual' : 'Auto-Move';
      }
      function info(id) {
        const I = $('#move-info');
        if (!id) { I.classList.remove('show'); return; }
        const sp = MapSys.spaces[id];
        const tags = [];
        const s = Game.state;
        s.players.forEach(o => { if (o.spaceId === id && o !== p) tags.push(`${o.name}${o.battleId ? ' ⚔️' : o.down ? ' 💤' : ''}`); });
        if (s.minion && s.minion.spaceId === id) tags.push('😈 Minion');
        if (s.head.space === id) tags.push("💀 Demon Lord's Head");
        if (s.battles.some(x => x.kind !== 'duel' && x.space === id)) tags.push('⚔️ Fight in progress — you must join');
        if (sp.type === 't' && s.chests[id] != null) tags.push('(opened)');
        I.innerHTML = `<b>${U.esc(MapSys.spaceName(sp, s))}</b>${sp.type === 'L' ? `<br><small>${DATA.PLACES[sp.code].text}</small>` : ''}${tags.length ? `<br><small>${U.esc(tags.join(' · '))}</small>` : ''}${Game.isBlocking(id) ? '<br><small class="red">Blocks the road — stepping here ends your move.</small>' : ''}`;
        I.classList.add('show');
      }
      function setMode(mode) {
        if (m.busy) return;
        if (mode === 'auto' && m.path.length > 1) { m.path = [start]; p.spaceId = start; }
        m.mode = mode;
        if (mode === 'free') { MapSys.setMode('free'); toast('🎥 Free camera: W/A/S/D or drag. Esc to return.'); return; }
        if (mode === 'full') { MapSys.setMode('full'); toast('🗺️ Full map. Esc to return.'); return; }
        update();
      }
      async function step(to) {
        m.busy = true;
        const from = m.path[m.path.length - 1];
        const back = m.path.length > 1 && m.path[m.path.length - 2] === to;
        if (back) m.path.pop(); else m.path.push(to);
        await MapSys.walk('p' + p.id, [from, to], 170 * Math.max(0.5, Game.delayFactor()));
        p.spaceId = to;
        m.busy = false;
        if (S.move !== m) return;
        if (!back && (remaining() === 0 || blk(to))) { finish(m.path.slice(), true); return; }
        update();
      }
      function dir(k) {
        if (S.move !== m || m.busy) return;
        if (m.mode === 'auto') { if (k === 'A' || k === 'D') { m.idx = (m.idx + (k === 'A' ? -1 : 1) + m.list.length) % m.list.length; Sound.play('select'); update(); } return; }
        if (m.mode === 'free') { const d = 60; MapSys.pan(k === 'A' ? -d : k === 'D' ? d : 0, k === 'W' ? -d : k === 'S' ? d : 0); return; }
        if (m.mode !== 'manual') return;
        const cur = m.path[m.path.length - 1];
        const n = MapSys.spaces[cur].dirs[k];
        if (!n) { Sound.play('error'); return; }
        if (n === m.path[m.path.length - 2]) { step(n); return; }
        if (m.path.includes(n)) { toast('You cannot pass the same space twice.', 'bad'); Sound.play('error'); return; }
        if (!m.live.next.has(n)) { toast(`That way cannot finish exactly ${total} step${total > 1 ? 's' : ''}.`, 'bad'); Sound.play('error'); return; }
        step(n);
      }
      m.dir = dir;
      function confirmAuto() {
        if (m.busy) return;
        finish(ends.get(m.list[m.idx]), false);
      }
      m.tap = id => {
        if (m.busy || !ends.has(id)) return;
        if (m.mode === 'auto' && m.list[m.idx] === id) { confirmAuto(); return; }
        if (m.path.length > 1) { m.path = [start]; p.spaceId = start; }
        m.mode = 'auto'; m.idx = m.list.indexOf(id); Sound.play('select'); update();
      };
      function finish(path, walked) {
        popKeys('move');
        endMove();
        if (!walked) p.spaceId = start;
        resolve({ target: path[path.length - 1], path, walked });
      }
      pushKeys((e, k) => {
        if (S.move !== m) return false;
        const alias = { ARROWUP: 'W', ARROWLEFT: 'A', ARROWDOWN: 'S', ARROWRIGHT: 'D' };
        const kk = alias[k] || k;
        if (['W', 'A', 'S', 'D'].includes(kk)) { dir(kk); return true; }
        if (k === 'ENTER') { if (m.mode === 'auto') confirmAuto(); else toast(`Keep walking: ${remaining()} step${remaining() === 1 ? '' : 's'} left (or press I for Auto-Move).`); return true; }
        if (k === 'ESCAPE') { if (m.mode !== 'manual') { setMode('manual'); return true; } return false; }
        if (k === 'I') { setMode(m.mode === 'auto' ? 'manual' : 'auto'); return true; }
        if (k === 'E') { setMode(m.mode === 'free' ? 'manual' : 'free'); return true; }
        if (k === 'N') { setMode(m.mode === 'full' ? 'manual' : 'full'); return true; }
        if (k === 'O') { openStatus(p, true); return true; }
        return false;
      }, 'move');
      update();
      toast(`🎲 Walk exactly ${total} space${total > 1 ? 's' : ''}! W/A/S/D step by step — 🚩 flags show where you can end — or press I for Auto-Move.`, 'info');
    });
  }
  function endMove() {
    S.move = null;
    popKeys('move');
    MapSys.setOverlay(null);
    MapSys.setMode('follow');
    if (S.inGame) setHud('normal');
    $('#move-hud').innerHTML = '';
  }
  /* Pick one of `cands` space ids on the map (trap placement). */
  function pickSpace(p, cands, purpose) {
    Game.needHuman();
    return new Promise(resolve => {
      let idx = 0;
      const set = new Set(cands);
      setHud('move');
      const hudEl = $('#move-hud');
      hudEl.innerHTML = '';
      const L = h('div', { id: 'move-left', class: 'panel' });
      hudEl.append(L);
      const upd = () => {
        const id = cands[idx];
        MapSys.setOverlay({ reach: set, selected: id, markers: true });
        MapSys.setMode('free'); MapSys.focus(MapSys.spaces[id].x, MapSys.spaces[id].y);
        L.innerHTML = '';
        L.append(h('div', null, purpose === 'trap' ? '🕳️ Place your Monster Trap' : 'Choose a space'), h('small', null, `${spaceLabel(id)} · A/D to cycle`),
          btn('Place here', 'Enter', () => done(id), { cls: 'primary small' }), btn('Cancel', 'Esc', () => done(null), { cls: 'small' }));
      };
      const done = id => { popKeys('pick'); S.pick = null; hudEl.innerHTML = ''; MapSys.setOverlay(null); MapSys.setMode('follow'); setHud('normal'); resolve(id); };
      S.pick = { tap: id => { if (set.has(id)) { if (cands[idx] === id) done(id); else { idx = cands.indexOf(id); upd(); } } } };
      pushKeys((e, k) => {
        if (k === 'A' || k === 'ARROWLEFT') { idx = (idx - 1 + cands.length) % cands.length; upd(); return true; }
        if (k === 'D' || k === 'ARROWRIGHT') { idx = (idx + 1) % cands.length; upd(); return true; }
        if (k === 'ENTER') { done(cands[idx]); return true; }
        if (k === 'ESCAPE') { done(null); return true; }
        return true;
      }, 'pick', true);
      upd();
    });
  }
  function onMapTap(id) {
    if (!id) return;
    if (S.pick) { S.pick.tap(id); return; }
    if (S.move && S.move.tap) { S.move.tap(id); return; }
  }

  /* ================================================================ status / class change */
  function statLine(p, k) {
    const base = p.base[k] + Game.equipBonus(p, k);
    const total = Game.stat(p, k);
    const mods = [];
    if (Game.equipBonus(p, k)) mods.push(`+${Game.equipBonus(p, k)} gear`);
    const boosted = total !== base;
    return h('div', { class: 'stat' }, h('span', { class: 'sk' }, k.toUpperCase()), h('b', { class: boosted ? 'green' : '' }, String(total)), h('small', null, boosted ? `(${base} × passive/charm)` : mods.join(' ')));
  }
  function moveRow(name, text, cd, icon) {
    return h('div', { class: 'move-row' }, h('span', null, icon || '•'), h('div', null, h('b', null, name), h('small', null, text)), h('span', { class: `cdb ${cd ? 'wait' : 'ready'}` }, cd ? `${cd}d` : 'Ready'));
  }
  function openStatus(p, readOnly) {
    const s = Game.state;
    const c = Game.cls(p);
    const need = 10 * p.level;
    const eq = slot => { const id = p.equip[slot]; if (!id) return h('div', { class: 'eq empty' }, h('span', null, { weapon: '🗡️', armor: '🛡️', charm: '📿' }[slot]), 'Empty'); const g = DATA.GEAR[id]; return h('div', { class: 'eq' }, h('span', null, g.icon), h('div', null, h('b', null, g.name), h('small', null, gearText(g)))); };
    const body = h('div', { class: 'status' },
      h('div', { class: 'st-head' }, heroImg(p, 120, 'portrait big'),
        h('div', null,
          h('h3', null, `${p.name}${p.isBot ? ' 🤖' : ''}`),
          h('div', null, `Lv ${p.level} ${c.name}`),
          h('div', null, `Rank ${Game.rank(p)} · ⭐ ${p.stars} · 💰 ${money(p.money)}`),
          h('div', { class: 'xp' }, h('div', { class: 'xpbar' }, h('i', { style: `width:${p.level >= DATA.MAX_LEVEL ? 100 : p.exp / need * 100}%` })), h('small', null, p.level >= DATA.MAX_LEVEL ? 'MAX LEVEL' : `EXP ${p.exp} / ${need}`)),
          hpBar(p.hp, Game.maxHp(p)),
          s.head.holder === p.id ? h('div', { class: 'red' }, "💀 Carrying the Demon Lord's Head!") : null,
          p.down ? h('div', { class: 'red' }, `${p.downReason === 'ko' ? '🪦 Resurrecting' : '😵 Standing up'}: skips ${p.down} more turn${p.down > 1 ? 's' : ''}`) : null)),
      h('div', { class: 'st-cols' },
        h('div', null, h('h4', null, 'Stats'), h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('span', { class: 'sk' }, 'HP'), h('b', null, String(Game.maxHp(p))), h('small', null, Game.equipBonus(p, 'hp') ? `+${Game.equipBonus(p, 'hp')} gear` : '')), statLine(p, 'at'), statLine(p, 'df'), statLine(p, 'sp')),
          h('h4', null, 'Equipment'), eq('weapon'), eq('armor'), eq('charm'),
          h('h4', null, 'Respawn point'), h('div', null, `🚩 ${spaceLabel(p.respawnId)}`)),
        h('div', null, h('h4', null, 'Moves'),
          h('div', { class: 'passive' }, h('b', null, `Passive — ${c.passive.name}`), h('small', null, c.passive.text)),
          moveRow(c.move.name, `Class move · ${c.move.text} · CD ${c.move.cd}`, p.cd.classMove, '🌟'),
          p.special ? moveRow(DATA.SKILLS[p.special].name, `Special · ${DATA.SKILLS[p.special].text} · CD ${DATA.SKILLS[p.special].cd}`, p.cd.special, DATA.SKILLS[p.special].icon) : moveRow('No Special move', 'Buy one at a Skillbook Shop', 0, '✨'),
          p.specialDef ? moveRow(DATA.SKILLS[p.specialDef].name, `Special Defense · ${DATA.SKILLS[p.specialDef].text} · CD ${DATA.SKILLS[p.specialDef].cd}`, p.cd.specialDef, DATA.SKILLS[p.specialDef].icon) : moveRow('No Special Defense', 'Buy one at a Skillbook Shop', 0, '🛡️'),
          h('h4', null, 'Job EXP & Mastery'),
          h('div', { class: 'jobs' }, p.unlocked.map(cid => h('div', { class: `job ${cid === p.classId ? 'cur' : ''}` }, h('span', null, DATA.CLASSES[cid].short), h('div', { class: 'xpbar small' }, h('i', { style: `width:${(p.jobExp[cid] || 0) * 10}%` })), h('small', null, p.mastered.includes(cid) ? '★ Mastered' : `${p.jobExp[cid] || 0}/10`)))),
          p.mastered.length ? h('small', { class: 'dim' }, `Mastery bonuses on level-up: ${p.mastered.map(m => DATA.CLASSES[m].short).join(', ')}`) : null,
          h('p', { class: 'hint' }, '🔁 Classes are changed at the Royal Castle or a Temple.'))));
    const buttons = [{ label: 'Close', key: 'Esc', value: null }];
    return modal({ title: `📋 Status${p.isBot || readOnly ? ' (read-only)' : ''}`, cls: 'wide', body, buttons });
  }
  function gearText(g) {
    if (g.slot === 'charm') return g.text;
    return ['hp', 'at', 'df', 'sp'].filter(k => g[k]).map(k => `${k.toUpperCase()}+${g[k]}`).join(' ');
  }
  /* Class change screen (Royal Castle / Temple). Resolves with the chosen class id, or null. */
  function chooseClass(p) {
    Game.needHuman();
    let sel = p.classId;
    const ref = {};
    const grid = h('div', { class: 'cls-grid' });
    const detail = h('div', { class: 'cls-detail' });
    const draw = () => {
      grid.innerHTML = '';
      DATA.CLASS_GRID.forEach((row, ri) => {
        const r = h('div', { class: `cls-row ${ri === 3 ? 'off' : ''}` });
        row.forEach((cid, ci) => {
          const c = DATA.CLASSES[cid], unlocked = p.unlocked.includes(cid), mastered = p.mastered.includes(cid);
          const card = h('div', { class: `cls-card pick ${cid === p.classId ? 'current' : ''} ${cid === sel ? 'on' : ''} ${unlocked ? '' : 'locked'}` },
            portraitImg(Sprites.portrait('hero', { classId: cid, gender: p.gender, color: p.color }, 64)),
            h('b', null, c.short), h('small', null, `Job ${p.jobExp[cid] || 0}/10`),
            mastered ? h('span', { class: 'star' }, '★') : null, unlocked ? null : h('span', { class: 'lock' }, '🔒'));
          card.onclick = () => { sel = cid; Sound.play('select'); draw(); };
          if (ci < row.length - 1 && ri < 3) r.append(card, h('span', { class: 'arrow' }, '→')); else r.append(card);
        });
        grid.append(r);
      });
      const c = DATA.CLASSES[sel], unlocked = p.unlocked.includes(sel);
      detail.innerHTML = '';
      detail.append(portraitImg(Sprites.portrait('hero', { classId: sel, gender: p.gender, color: p.color }, 120), 'portrait big'),
        h('h3', null, c.name), h('p', null, h('b', null, `${c.passive.name}: `), c.passive.text),
        h('p', null, h('b', null, `${c.move.name} (CD ${c.move.cd}): `), c.move.text),
        h('p', null, h('b', null, 'Level-up: '), Object.entries(c.levelUp).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' '), h('br'), h('b', null, 'Mastery bonus: '), Object.entries(c.mastery).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ')),
        h('p', { class: 'dim' }, unlocked ? (c.magic ? 'Magic class: uses SP for base damage.' : '') : `🔒 Unlock: ${c.unlockText}`),
        btn('Change to This Class', 'Enter', async () => {
          if (!(await confirm('Change class?', `Become a <b>${c.name}</b>? Your level and stats stay the same.`, 'Change'))) return;
          Sound.play('levelup'); toast(`🔁 You are now a ${c.name}!`, 'good'); ref.close(sel);
        }, { cls: 'primary', disabled: !unlocked || sel === p.classId || !Game.canChangeClass(p).ok, reason: !unlocked ? `Locked — ${c.unlockText}.` : sel === p.classId ? 'This is your current class.' : Game.canChangeClass(p).reason, showWhy: true }));
    };
    draw();
    const order = DATA.CLASS_GRID.flat();
    return modal({
      title: '🔁 Change Class', cls: 'wide', ref, body: h('div', { class: 'cls-wrap' }, grid, detail), escValue: null,
      buttons: [{ label: 'Back', key: 'Esc', value: null }],
      onKey: (e, k) => {
        const i = order.indexOf(sel);
        if (k === 'A' || k === 'W' || k === 'ARROWLEFT' || k === 'ARROWUP') { sel = order[(i - 1 + order.length) % order.length]; Sound.play('select'); draw(); return true; }
        if (k === 'D' || k === 'S' || k === 'ARROWRIGHT' || k === 'ARROWDOWN') { sel = order[(i + 1) % order.length]; Sound.play('select'); draw(); return true; }
        return false;
      },
    });
  }

  /* ================================================================ inventory */
  function openInventory(p, usable) {
    let tab = 'items', sel = 0;
    const ref = {};
    const wrap = h('div', { class: 'inv' });
    const draw = () => {
      wrap.innerHTML = '';
      const tabs = h('div', { class: 'tabs' },
        btn(`Items ${p.items.length}/6`, '1', () => { tab = 'items'; sel = 0; draw(); }, { cls: tab === 'items' ? 'on' : '' }),
        btn(`Spellbooks ${p.books.length}/6`, '2', () => { tab = 'books'; sel = 0; draw(); }, { cls: tab === 'books' ? 'on' : '' }));
      const list = p[tab];
      const grid = h('div', { class: 'inv-grid' });
      for (let i = 0; i < DATA.INV_SIZE; i++) {
        const id = list[i];
        const cell = h('div', { class: `slotc pick ${i === sel ? 'on' : ''} ${id ? '' : 'empty'}` }, id ? h('span', { class: 'ico' }, DATA.ITEMS[id].icon) : '', id ? h('small', null, DATA.ITEMS[id].name) : h('small', null, 'Empty'));
        cell.onclick = () => { sel = i; Sound.play('select'); draw(); };
        grid.append(cell);
      }
      const quest = h('div', { class: 'quest' }, h('b', null, 'Quest items: '), Game.state.head.holder === p.id ? "💀 Demon Lord's Head — deliver it to the Royal Castle!" : 'None');
      const id = list[sel];
      const det = h('div', { class: 'inv-detail' });
      if (id) {
        const it = DATA.ITEMS[id];
        const chk = usable ? Game.canUseItem(p, id) : { ok: false, reason: 'You can only use items on your turn, before rolling.' };
        det.append(h('div', { class: 'big-ico' }, it.icon), h('h3', null, it.name), h('p', null, it.text), h('small', { class: 'dim' }, `Sells for ${Game.sellPrice(id)} G`),
          btn('Use', 'U', async () => {
            ref.close(true);
            const ok = await Game.useItem(p, tab, sel);
            refresh();
            if (ok && p.turnOver && S.turn && S.turn.p === p) endTurnAction({ type: 'end' });
          }, { cls: 'primary', disabled: !chk.ok, reason: chk.reason, showWhy: true }),
          btn('Discard', 'X', async () => {
            if (!(await confirm('Discard item?', `Throw away <b>${it.name}</b>? It will be lost.`, 'Discard'))) return;
            list.splice(sel, 1); sel = Math.max(0, sel - 1); Game.log(`🗑️ ${p.name} discarded ${it.name}.`); draw(); refresh();
          }, { cls: 'danger', disabled: !usable, reason: 'Only during your own turn.' }));
      } else det.append(h('p', { class: 'dim' }, 'Select an item to see its details.'));
      wrap.append(tabs, h('div', { class: 'inv-main' }, h('div', null, grid, quest), det));
    };
    draw();
    return modal({
      title: `🎒 ${p.name}'s Inventory`, cls: 'wide', ref, body: wrap,
      buttons: [{ label: 'Close', key: 'Esc', value: null }],
      onKey: (e, k) => {
        const mv = { A: -1, ARROWLEFT: -1, D: 1, ARROWRIGHT: 1, W: -3, ARROWUP: -3, S: 3, ARROWDOWN: 3 }[k];
        if (mv) { sel = (sel + mv + 6) % 6; Sound.play('select'); draw(); return true; }
        if (k === 'O') { ref.close(null); return true; }
        if (k === 'ENTER') { const b = [...wrap.querySelectorAll('.btn')].find(x => x.dataset.key === 'U'); if (b) b.click(); return true; }
        return false;
      },
    });
  }

  /* ================================================================ shops & places */
  function compareGear(p, id) {
    const g = DATA.EQUIP[id], cur = p.equip[g.slot] ? DATA.GEAR[p.equip[g.slot]] : {};
    return ['hp', 'at', 'df', 'sp'].map(k => {
      const d = (g[k] || 0) - (cur[k] || 0);
      if (!d && !g[k]) return null;
      return h('div', { class: `cmp ${d > 0 ? 'up' : d < 0 ? 'down' : ''}` }, `${k.toUpperCase()} ${d > 0 ? '+' : ''}${d}`);
    }).filter(Boolean);
  }
  function shop(p, kind, zone) {
    Game.needHuman();
    const titles = { item: '🛒 Shop', equip: '⚒️ Equipment Shop', skill: '📚 Skillbook Shop', larb: '🥗 Larb Shop' };
    const stock = Game.shopStock(kind, zone);
    let mode = 'buy', sel = 0;
    const wrap = h('div', { class: 'shop' });
    const nameOf = id => (DATA.ITEMS[id] || DATA.GEAR[id] || DATA.SKILLS[id]).name;
    const iconOf = id => (DATA.ITEMS[id] || DATA.GEAR[id] || DATA.SKILLS[id]).icon;
    const sellList = () => p.items.map((id, i) => ({ id, tab: 'items', i })).concat(p.books.map((id, i) => ({ id, tab: 'books', i })));
    const draw = () => {
      wrap.innerHTML = '';
      const list = h('div', { class: 'shop-list' });
      const rows = mode === 'buy' ? stock.map(id => ({ id })) : sellList();
      if (!rows.length) list.append(h('p', { class: 'dim' }, 'You have nothing to sell.'));
      sel = Math.min(sel, Math.max(0, rows.length - 1));
      rows.forEach((r, i) => {
        const price = mode === 'buy' ? Game.priceOf(r.id) : Game.sellPrice(r.id);
        const row = h('div', { class: `shop-row pick ${i === sel ? 'on' : ''}` }, h('span', { class: 'ico' }, iconOf(r.id)), h('span', { class: 'nm' }, nameOf(r.id)),
          h('span', { class: `pr ${mode === 'buy' && price > p.money ? 'red' : ''}` }, `${price} G`));
        row.onclick = () => { sel = i; Sound.play('select'); draw(); };
        list.append(row);
      });
      const det = h('div', { class: 'shop-detail' });
      const r = rows[sel];
      if (r) {
        const id = r.id, item = DATA.ITEMS[id], gear = DATA.EQUIP[id], skill = DATA.SKILLS[id];
        det.append(h('div', { class: 'big-ico' }, iconOf(id)), h('h3', null, nameOf(id)));
        if (item) det.append(h('p', null, item.text));
        if (gear) {
          const cur = p.equip[gear.slot];
          det.append(h('p', null, `${gear.slot === 'weapon' ? 'Weapon' : 'Armor'} · ${gearText(gear)}`), h('div', { class: 'cmp-row' }, h('small', null, `vs ${cur ? DATA.GEAR[cur].name : 'nothing'}:`), compareGear(p, id)));
          if (cur) det.append(h('small', { class: 'dim' }, `Your ${DATA.GEAR[cur].name} will be sold for ${Game.sellPrice(cur)} G.`));
        }
        if (skill) {
          const cur = p[skill.kind];
          det.append(h('p', null, `${skill.kind === 'special' ? 'Special move' : 'Special Defense'} · ${skill.text} · CD ${skill.cd}`), h('small', { class: 'dim' }, cur ? `Replaces ${DATA.SKILLS[cur].name}.` : 'You have no move in this slot yet.'));
        }
        if (mode === 'buy') {
          const chk = Game.canBuy(p, id);
          det.append(btn(`Buy for ${Game.priceOf(id)} G`, 'B', async () => {
            if (!(await confirm('Buy?', `Buy <b>${nameOf(id)}</b> for ${Game.priceOf(id)} G?`, 'Buy'))) return;
            if (Game.buy(p, id)) { toast(`Bought ${nameOf(id)}!`, 'good'); refresh(); draw(); }
          }, { cls: 'primary', disabled: !chk.ok, reason: chk.reason, showWhy: true }));
        } else {
          det.append(btn(`Sell for ${Game.sellPrice(id)} G`, 'B', async () => {
            if (!(await confirm('Sell?', `Sell <b>${nameOf(id)}</b> for ${Game.sellPrice(id)} G?`, 'Sell'))) return;
            Game.sell(p, r.tab, r.i); refresh(); draw();
          }, { cls: 'primary' }));
        }
      }
      wrap.append(h('div', { class: 'tabs' }, btn('Buy', '1', () => { mode = 'buy'; sel = 0; draw(); }, { cls: mode === 'buy' ? 'on' : '' }), btn('Sell (half price)', '2', () => { mode = 'sell'; sel = 0; draw(); }, { cls: mode === 'sell' ? 'on' : '' }), h('span', { class: 'wallet' }, `💰 ${money(p.money)}`)),
        h('div', { class: 'shop-main' }, list, det));
    };
    draw();
    return modal({
      title: titles[kind], cls: 'wide', body: wrap,
      buttons: [{ label: 'Exit', key: 'Esc', value: null }],
      onKey: (e, k) => {
        const n = mode === 'buy' ? stock.length : sellList().length;
        if (!n) return false;
        if (k === 'W' || k === 'ARROWUP') { sel = (sel - 1 + n) % n; Sound.play('select'); draw(); return true; }
        if (k === 'S' || k === 'ARROWDOWN') { sel = (sel + 1) % n; Sound.play('select'); draw(); return true; }
        if (k === 'ENTER') { const b = [...wrap.querySelectorAll('.btn')].find(x => x.dataset.key === 'B'); if (b) b.click(); return true; }
        return false;
      },
    });
  }
  async function horseBet(p) {
    Game.needHuman();
    let pct = 0.1, horse = null;
    const ref = {};
    const wrap = h('div', { class: 'horses' });
    const draw = () => {
      wrap.innerHTML = '';
      wrap.append(h('p', null, `Bet on 1 of 6 horses. A correct pick pays 5×. You have ${money(p.money)}.`),
        h('div', { class: 'seg' }, [[0.1, '10%', '7'], [0.5, '50%', '8'], [1, 'ALL-IN', '9']].map(([v, l, k]) => btn(`${l} (${v >= 1 ? p.money : U.round(p.money * v)} G)`, k, () => { pct = v; draw(); }, { cls: pct === v ? 'on' : '' }))),
        h('div', { class: 'horse-list' }, DATA.HORSES.map((hs, i) => {
          const b = h('div', { class: `horse pick ${horse === i ? 'on' : ''}` }, kbd(String(i + 1)), h('span', { class: 'hc', style: `background:${hs.color}` }), hs.name);
          b.dataset.key = String(i + 1);
          b.onclick = () => { horse = i; Sound.play('select'); draw(); };
          return b;
        })),
        btn('Place Bet', 'Enter', async () => {
          if (horse == null) { toast('Pick a horse first.', 'bad'); return; }
          if (pct >= 1 && !(await confirm('Go ALL-IN?', `Bet all ${money(p.money)} on ${DATA.HORSES[horse].name}? (Going all-in unlocks the Gambler class, win or lose.)`, 'All-in!'))) return;
          ref.close({ pct, horse });
        }, { cls: 'primary', disabled: horse == null, reason: 'Pick a horse first.' }));
    };
    draw();
    return modal({ title: '🏇 Horse-Racing Track', cls: 'wide', ref, body: wrap, buttons: [{ label: 'Leave', key: 'Esc', value: null }] });
  }
  async function horseRace(p, pick, winner, amount) {
    if (p.isBot && Game.skipping) return;
    const cv = h('canvas', { class: 'race', width: '560', height: '260' });
    const res = h('div', { class: 'race-res' }, 'And they\'re off!');
    const ref = {};
    const pr = modal({ title: `🏇 ${p.name} bets ${amount} G on ${DATA.HORSES[pick].name}`, cls: 'wide', ref, body: h('div', null, cv, res), closable: false, buttons: [] });
    const c = cv.getContext('2d');
    const speeds = DATA.HORSES.map((_, i) => 0.8 + Math.random() * 0.4 + (i === winner ? 0.35 : 0));
    const pos = DATA.HORSES.map(() => 0);
    const t0 = performance.now(), len = 3200 * Math.max(0.35, Game.delayFactor());
    await new Promise(done => {
      const frame = () => {
        const k = Math.min(1, (performance.now() - t0) / len);
        c.fillStyle = '#6fbf4f'; c.fillRect(0, 0, 560, 260);
        for (let i = 0; i < 6; i++) {
          c.fillStyle = i % 2 ? '#c79a5a' : '#d4a868'; c.fillRect(0, 10 + i * 40, 560, 36);
          const wob = Math.sin(performance.now() / 90 + i) * 0.004;
          pos[i] = Math.min(1, k * speeds[i] / speeds[winner] + wob) * (i === winner ? 1 : 0.97);
          const x = 20 + pos[i] * 480;
          c.fillStyle = DATA.HORSES[i].color; c.fillRect(4, 18 + i * 40, 10, 20);
          c.save(); c.translate(x, 28 + i * 40); c.scale(-1, 1); Sprites.emoji(c, '🏇', 0, 0, 28); c.restore();   // face the finish line
          c.fillStyle = '#2b1a0e'; c.font = '700 11px system-ui'; c.fillText(DATA.HORSES[i].name + (i === pick ? ' ◀ your pick' : ''), 20, 44 + i * 40);
        }
        c.fillStyle = '#fff'; c.fillRect(510, 10, 6, 240);
        if (k < 1) requestAnimationFrame(frame); else done();
      };
      frame();
    });
    const win = pick === winner;
    res.innerHTML = win ? `🎉 <b>${DATA.HORSES[winner].name}</b> wins! ${U.esc(p.name)} collects ${money(amount * 5)}!` : `😢 <b>${DATA.HORSES[winner].name}</b> wins. ${U.esc(p.name)} loses ${money(amount)}.`;
    Sound.play(win ? 'win' : 'lose');
    await U.sleep(p.isBot ? 1200 * Game.delayFactor() : 1500);
    ref.close(true);
    await pr;
  }

  /* ================================================================ human decisions (mirror Bot) */
  function yesNo(p, key, info) {
    Game.needHuman();
    return modal({ title: info.title || 'Choose', html: `<p>${info.text}</p>`, escValue: false, buttons: [
      { label: 'Yes', key: 'Y', value: true, cls: 'primary' }, { label: 'No', key: 'N', value: false },
    ] }).then(v => !!v);
  }
  function chooseChallenge(p, others) {
    Game.needHuman();
    const opts = others.map((o, i) => ({ label: `Challenge ${U.esc(o.name)} <small>(Lv ${o.level}, HP ${o.hp}/${Game.maxHp(o)}, ⭐ ${o.stars})</small>`, key: String(i + 1), value: o.id, cls: 'primary' }));
    opts.push({ label: "Don't challenge", key: 'N', value: null });
    return choice('⚔️ Another hero is here!', 'Challenge them to a one-round duel? The winner steals money, equipment, or an item.' + (Game.state.dlDefeated ? ' After the Demon Lord\'s defeat, winning a duel also earns 1 ⭐.' : ''), opts, { escValue: null });
  }
  function battleCommand(p, b, role, self, foe, cmds) { return BattleView.choose(role, cmds, self); }
  /* Royal Castle / Temple menu (spec §5). Resolves with an option id. */
  async function placeMenu(p, kind, opts) {
    Game.needHuman();
    const title = kind === 'castle' ? '🏰 Royal Castle' : '🛕 Temple';
    const text = kind === 'castle' ? '"Welcome, hero. How may the crown help you?"' : 'Incense drifts through the quiet temple halls.';
    const keys = { class: 'C', respawn: 'R', merit: 'M', leave: 'Esc' };
    const c = await modal({ title, cls: 'place-menu', html: `<p>${text}</p><p class="dim">Respawn point: ${U.esc(spaceLabel(p.respawnId))} · Made merit ${p.merit}×</p>`, escValue: 'leave',
      buttons: opts.map(o => ({ label: `${o.icon} ${o.label}`, key: keys[o.id], value: o.id, disabled: o.disabled, reason: o.reason, showWhy: !!o.disabled && o.id !== 'leave', cls: o.id === 'leave' ? '' : 'primary' })) });
    if (c === 'merit') {
      const o = opts.find(x => x.id === 'merit');
      if (!(await confirm('Make merit?', `Donate <b>${U.fmt(o.cost)} G</b> (10% of your money) to the temple?`, 'Donate'))) return null;
    }
    return c;
  }
  /* Spec §6: walking into someone else's fight — choose whom to fight (no way out). */
  function fightChoice(p, b, heroes) {
    Game.needHuman();
    const d = Battle.enemyDef(b);
    const names = heroes.map(o => o.name).join(', ');
    const opts = [{ label: `⚔️ Fight the ${U.esc(d.name)} <small>(${d.live.hp}/${d.live.maxHp} HP)${heroes.length ? ` alongside ${U.esc(names)}` : ''}</small>`, key: '1', value: { type: 'join' }, cls: 'primary' }];
    heroes.forEach((o, i) => opts.push({ label: `🤺 Attack ${U.esc(o.name)} <small>(Lv ${o.level}, HP ${o.hp}/${Game.maxHp(o)})</small>`, key: String(i + 2), value: { type: 'duel', pid: o.id } }));
    const after = b.kind === 'monster' ? ' If you team up, the heroes still standing duel each other once the monster falls.' : '';
    return choice('⚔️ You walked into a fight!', `${heroes.length ? `${U.esc(names)} ${heroes.length > 1 ? 'are' : 'is'} fighting` : 'A battle rages against'} the <b>${U.esc(d.name)}</b> here. You can't walk away — pick your opponent. The winner of a duel takes over the fight.${after}`, opts, { closable: false });
  }
  async function restTurn(p) {
    const left = p.down;
    banner(p.downReason === 'ko' ? `🪦 ${p.name} is resurrecting…` : `😵 ${p.name} is standing up…`, p.color, left ? `${left} more turn${left > 1 ? 's' : ''} to go` : 'Back in action next turn!');
    await Game.wait(900);
  }
  async function requestPosted(req) {
    refresh();
    if (Game.skipping) return;
    Sound.play('turn');
    await announce({ title: "King's Request", icon: '👑', text: `${req.icon} ${req.text}. The first hero to finish within 7 days earns +1 ⭐ and ${U.fmt(req.reward)} G!`, auto: Game.cur().isBot ? 2600 * Game.delayFactor() : 0 });
  }
  function allocatePoints(p) {
    Game.needHuman();
    Sound.play('levelup');
    const alloc = { hp: 0, at: 0, df: 0, sp: 0 };
    const total = p.freePts;
    const wrap = h('div', { class: 'levelup' });
    const left = () => total - Object.values(alloc).reduce((a, b) => a + b, 0);
    let sel = 1;
    const keys = ['hp', 'at', 'df', 'sp'];
    const ref = {};
    const draw = () => {
      wrap.innerHTML = '';
      wrap.append(h('div', { class: 'lu-head' }, heroImg(p, 80), h('div', null, h('h3', null, `Level ${p.level}!`), h('p', null, `Assign ${total} free point${total > 1 ? 's' : ''}. 1 point = HP +5 or AT/DF/SP +1.`))),
        h('div', { class: 'lu-left' }, `Points left: `, h('b', null, String(left()))),
        h('div', { class: 'lu-rows' }, keys.map((k, i) => h('div', { class: `lu-row ${i === sel ? 'on' : ''}` },
          h('span', { class: 'sk' }, k.toUpperCase()), h('span', null, k === 'hp' ? `${Game.maxHp(p)} → ${Game.maxHp(p) + alloc.hp * 5}` : `${p.base[k]} → ${p.base[k] + alloc[k]}`),
          btn('−', null, () => { if (alloc[k] > 0) { alloc[k]--; draw(); } }, { cls: 'small', disabled: alloc[k] <= 0 }),
          h('b', null, String(alloc[k])),
          btn('+', null, () => { if (left() > 0) { alloc[k]++; draw(); } }, { cls: 'small', disabled: left() <= 0 })))),
        h('small', { class: 'dim' }, 'W/S select · A/D remove/add · Enter confirm'),
        btn('Confirm', 'Enter', () => {
          for (const k of keys) for (let i = 0; i < alloc[k]; i++) Game.applyPoint(p, k);
          ref.close(true); refresh();
        }, { cls: 'primary', disabled: left() > 0, reason: 'Assign all points first.' }));
    };
    draw();
    return modal({
      title: '⬆️ Level Up!', ref, body: wrap, closable: false, buttons: [],
      onKey: (e, k) => {
        if (k === 'W' || k === 'ARROWUP') { sel = (sel + 3) % 4; draw(); return true; }
        if (k === 'S' || k === 'ARROWDOWN') { sel = (sel + 1) % 4; draw(); return true; }
        if (k === 'D' || k === 'ARROWRIGHT') { if (left() > 0) { alloc[keys[sel]]++; Sound.play('select'); draw(); } return true; }
        if (k === 'A' || k === 'ARROWLEFT') { if (alloc[keys[sel]] > 0) { alloc[keys[sel]]--; draw(); } return true; }
        return false;
      },
    });
  }
  function inventoryFull(p, newId) {
    Game.needHuman();
    const it = DATA.ITEMS[newId], list = p[it.tab];
    const opts = list.map((id, i) => ({ label: `Discard ${DATA.ITEMS[id].icon} ${DATA.ITEMS[id].name}`, key: String(i + 1), value: i }));
    opts.push({ label: `Leave the new ${it.icon} ${it.name}`, key: 'N', value: 'new', cls: 'danger' });
    return choice('🎒 Bag full!', `You found <b>${it.icon} ${it.name}</b>, but your ${it.tab === 'items' ? 'Item' : 'Spellbook'} tab is full (6/6). Discard something?`, opts, { closable: false });
  }
  function charmChoice(p, newId) {
    Game.needHuman();
    const n = DATA.CHARMS[newId], o = DATA.CHARMS[p.equip.charm];
    return choice('📿 New charm', `You found <b>${n.icon} ${n.name}</b> (${n.text}). You already wear <b>${o.icon} ${o.name}</b> (${o.text}). Charms can't be sold.`, [
      { label: `Wear ${n.name}`, value: true, cls: 'primary' }, { label: `Keep ${o.name}`, key: 'N', value: false },
    ], { closable: false });
  }
  function stealChoice(W, L) {
    Game.needHuman();
    const opts = Battle.stealOptions(L).map((o, i) => {
      if (o.type === 'money') return { label: `💰 20% of their money (${o.amount} G)`, key: String(i + 1), value: o, cls: 'primary' };
      if (o.type === 'equip') return { label: `${DATA.GEAR[o.id].icon} ${DATA.GEAR[o.id].name} <small>(${gearText(DATA.GEAR[o.id])})</small>`, key: String(i + 1), value: o };
      return { label: `${DATA.ITEMS[o.id].icon} ${DATA.ITEMS[o.id].name}`, key: String(i + 1), value: o };
    }).slice(0, 9);
    return choice(`🏆 You beat ${U.esc(L.name)}!`, 'Choose one thing to take:', opts, { closable: false }).then(async c => {
      if (c && c.type === 'equip') {
        const g = DATA.GEAR[c.id];
        c.equip = await choice(`${g.icon} ${g.name}`, `Equip it now${W.equip[c.slot] ? ` (your ${DATA.GEAR[W.equip[c.slot]].name} ${DATA.EQUIP[W.equip[c.slot]] ? 'will be sold for half price' : 'will be discarded'})` : ''}, or throw it away?`, [
          { label: 'Equip it', value: true, cls: 'primary' }, { label: 'Discard it', key: 'N', value: false }], { closable: false });
      }
      return c;
    });
  }
  function pickTarget(p, cands, purpose) {
    Game.needHuman();
    const title = purpose === 'challenge' ? '✉️ Challenge Letter' : '🧤 Pickpocket';
    const text = purpose === 'challenge' ? 'Challenge which hero (within 6 spaces)?' : "Steal a random item from whose Item tab? (An Anti-Magic Talisman will block it.)";
    const opts = cands.map((o, i) => ({ label: `${U.esc(o.name)} <small>(Lv ${o.level}, HP ${o.hp}/${Game.maxHp(o)}, ⭐ ${o.stars}${purpose === 'pickpocket' ? `, ${o.items.length} items` : ''})</small>`, key: String(i + 1), value: o.id, cls: 'primary' }));
    opts.push({ label: 'Cancel', key: 'Esc', value: null });
    return choice(title, text, opts, { escValue: null });
  }

  /* ================================================================ dialogue */
  function speakerOf(line) {
    if (line.who === 'general') return { name: line.name, img: Sprites.portrait(line.portrait, { color: '#5b2a86' }, 96) };
    if (line.who === 'holder') {
      const s = Game.state, p = s && s.players[s.head.holder != null ? s.head.holder : 0];
      return { name: p ? p.name : 'Hero', img: p ? Sprites.heroPortrait(p, 96) : '' };
    }
    const sp = DATA.SPEAKERS[line.who] || DATA.SPEAKERS.narrator;
    const img = sp.portrait === 'demonlord' ? Sprites.portrait('demonlord', { color: '#2a0f3a', form: 3 }, 96) : Sprites.portrait('npc', { npc: sp.portrait, color: sp.portrait === 'darkvoice' ? '#1a0a20' : '#c9a36a' }, 96);
    return { name: sp.name, img };
  }
  function dialogue(lines, o) {
    o = o || {};
    const box = $('#dialogue');
    return new Promise(resolve => {
      let i = 0, typing = null, full = '', autoT = null;
      const pImg = $('#dlg-portrait'), nameEl = $('#dlg-name'), textEl = $('#dlg-text');
      const finish = () => { clearInterval(typing); clearTimeout(autoT); popKeys('dialogue'); box.classList.remove('show'); resolve(); };
      const show = () => {
        if (i >= lines.length) { finish(); return; }
        const L = lines[i], sp = speakerOf(L);
        pImg.src = sp.img; nameEl.textContent = sp.name;
        full = L.text; textEl.textContent = '';
        let n = 0;
        clearInterval(typing);
        typing = setInterval(() => { textEl.textContent = full.slice(0, ++n); if (n >= full.length) { clearInterval(typing); typing = null; } }, 18);
        Sound.play('page');
        clearTimeout(autoT);
        // Auto mode always moves on (even if the typewriter is still running on a long line).
        if (o.auto) autoT = setTimeout(() => { clearInterval(typing); typing = null; i++; show(); }, Math.max(1400, full.length * 35) * Math.max(0.4, Game.delayFactor()));
      };
      const next = () => {
        if (typing) { clearInterval(typing); typing = null; textEl.textContent = full; return; }
        i++; show();
      };
      box.onclick = e => { if (e.target.closest('.dlg-skip')) return; next(); };
      $('#dlg-skip').onclick = e => { e.stopPropagation(); finish(); };
      pushKeys((e, k) => {
        if (k === 'ENTER' || k === ' ') { next(); return true; }
        if (k === 'ESCAPE') { finish(); return true; }
        return true;
      }, 'dialogue', true);
      box.classList.add('show');
      show();
    });
  }

  /* ================================================================ misc game hooks */
  function enterGame() {
    closeAllModals();
    showScreen(null);
    S.inGame = true;
    buildHud();
    setScene('board');
    setHud('normal');
    MapSys.setMode('follow');
    unread = 0;
    Sound.music('board');
    refresh();
  }
  async function dayStart(day) {
    const left = Game.maxDays() - day + 1;
    banner(`☀️ Day ${day}`, '#f2a93b', left <= 5 ? `${left} day${left > 1 ? 's' : ''} left!` : null);
    refresh();
    await Game.wait(900);
  }
  async function minionSpawn(spaceId, st) {
    toast(`😈 A Demon Lord Minion (Lv ${st.lv}) appeared!`, 'bad');
    const sp = MapSys.spaces[spaceId];
    MapSys.setMode('free'); MapSys.focus(sp.x, sp.y);
    try { await Game.wait(1100); } finally { MapSys.setMode('follow'); }
  }
  async function minionWalk(path) {
    if (Game.skipping || path.length < 2) return;
    MapSys.setMode('follow');
    MapSys.follow(now => MapSys.minionPos(Game.state, now));
    try { await MapSys.walk('minion', path, 260 * Game.delayFactor()); await Game.wait(250); } finally { MapSys.follow(null); }
  }
  async function warp(p) { banner('✨ Warp!', p.color); await Game.wait(600); }
  function turnSummary(p, lines) {
    return modal({ title: `⏩ ${U.esc(p.name)}'s turn`, cls: 'summary', html: `<ul class="log-list">${lines.map(l => `<li>${U.esc(l)}</li>`).join('')}</ul>`, buttons: [{ label: 'OK', key: 'Enter', value: true, cls: 'primary' }] });
  }
  function fatal(e) {
    modal({ title: '⚠️ Something went wrong', html: `<p>The game hit an unexpected error and stopped.</p><pre class="err">${U.esc(e && e.stack ? e.stack : String(e))}</pre><p>Your autosave from the start of your last turn is still available under Load Game.</p>`, closable: false, buttons: [{ label: 'Back to Start Screen', key: 'Enter', value: true, cls: 'primary' }] }).then(() => exitToTitle());
  }
  async function ending(kind, ranking) {
    S.inGame = false;
    setHud('none');
    $('#turn-label').classList.remove('show');
    const D = DATA.DIALOGUE;
    if (kind === 'good') { Sound.music('good'); await dialogue([{ who: 'king', text: D.good }]); }
    else if (kind === 'bad') { Sound.music('sad'); await dialogue([{ who: 'darklord', text: D.bad }]); }
    else { Sound.music('sad'); await dialogue(D.secret.map(l => Object.assign({}, l))); }
    const titles = { good: '👑 Good Ending', bad: '🌑 Bad Ending', secret: '🕳️ Secret Ending' };
    const subs = { good: "The Demon Lord's Head was delivered. The kingdom is saved!", bad: 'The Demon Lord was never defeated. Darkness covers the land…', secret: "The head never reached the castle… and the Dark Lord found a new vessel." };
    const human = Game.human();
    const rows = ranking.map((p, i) => `<div class="rank-row ${p === human ? 'me' : ''}" style="--pc:${p.color}"><span class="medal">${['🥇', '🥈', '🥉', '4️⃣'][i]}</span><img class="portrait" src="${Sprites.heroPortrait(p, 64)}"><div class="rk-name"><b>${U.esc(p.name)}</b><small>${DATA.CLASSES[p.classId].name}</small></div><span>⭐ ${p.stars}</span><span>💰 ${U.fmt(p.money)}</span><span>Lv ${p.level}</span></div>`).join('');
    const scr = $('#screen-results');
    scr.innerHTML = '';
    scr.append(h('div', { class: 'results panel' },
      h('h2', null, titles[kind]), h('p', { class: 'dim' }, subs[kind]),
      h('div', { class: 'king-line' }, portraitImg(Sprites.portrait('npc', { npc: 'king', color: '#c9a36a' }, 72)), h('p', null, `“${D.results}”`)),
      h('div', { class: 'ranking', html: rows }),
      h('p', { class: 'winner' }, ranking[0] === human ? "🎉 You receive the King's Blessing!" : `${ranking[0].name} receives the King's Blessing.`),
      h('div', { class: 'share-row' },
        btn('📤 Share image', 'S', () => shareResults(kind, ranking), { cls: 'small' }),
        btn('📋 Copy text', 'C', () => copyResults(kind, ranking), { cls: 'small' })),
      btn('Back to Start Screen', 'Enter', () => { popKeys('results'); Game.stop(); showTitle(); }, { cls: 'primary big' })));
    showScreen('screen-results');
    Sound.play(ranking[0] === human ? 'win' : 'lose');
    pushKeys((e, k) => {
      if (k === 'ENTER') { popKeys('results'); Game.stop(); showTitle(); return true; }
      if (k === 'S') { shareResults(kind, ranking); return true; }
      if (k === 'C') { copyResults(kind, ranking); return true; }
      return true;
    }, 'results', true);
  }

  /* ---------------------------------------------------------------- sharing the final results */
  const ENDING_NAMES = { good: 'Good Ending', bad: 'Bad Ending', secret: 'Secret Ending' };
  function resultText(kind, ranking) {
    const s = Game.state, medals = ['🥇', '🥈', '🥉', '4️⃣'];
    return [`👑 Sole Blessed — ${ENDING_NAMES[kind] || kind} (Day ${s.day}${s.rules.days ? ` / ${s.rules.days}` : ', Endless'})`]
      .concat(ranking.map((p, i) => `${medals[i]} ${p.name}${p.isBot ? '' : ' (me)'} — ${DATA.CLASSES[p.classId].short} Lv ${p.level} · ⭐ ${p.stars} · 💰 ${U.fmt(p.money)}`))
      .concat([`${ranking[0].name} receives the King's Blessing! #SoleBlessed`]).join('\n');
  }
  function resultCanvas(kind, ranking) {
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1080;
    const c = cv.getContext('2d'), s = Game.state;
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, kind === 'good' ? '#ffe9a8' : kind === 'bad' ? '#3a2448' : '#2a1030'); g.addColorStop(1, kind === 'good' ? '#f6c75c' : '#12081a');
    c.fillStyle = g; c.fillRect(0, 0, 1080, 1080);
    const light = kind === 'good';
    Sprites.rr(c, 60, 60, 960, 960, 48); c.fillStyle = 'rgba(255,246,226,.96)'; c.fill(); c.lineWidth = 10; c.strokeStyle = '#e8a53a'; c.stroke();
    c.textAlign = 'center'; c.fillStyle = '#3b2412';
    c.font = '900 84px "Trebuchet MS", sans-serif'; c.fillText('Sole Blessed', 540, 180);
    c.font = '800 48px "Trebuchet MS", sans-serif'; c.fillStyle = kind === 'good' ? '#c0501a' : '#6a1f8a';
    c.fillText(`${kind === 'good' ? '👑' : kind === 'bad' ? '🌑' : '🕳️'} ${ENDING_NAMES[kind] || kind}`, 540, 260);
    c.font = '700 32px "Trebuchet MS", sans-serif'; c.fillStyle = '#6e4a2a';
    c.fillText(`Day ${s.day}${s.rules.days ? ` of ${s.rules.days}` : ' · Endless'}`, 540, 310);
    ranking.forEach((p, i) => {
      const y = 368 + i * 145;
      Sprites.rr(c, 120, y, 840, 130, 28); c.fillStyle = i === 0 ? '#fff1b8' : '#fffaf0'; c.fill(); c.lineWidth = 6; c.strokeStyle = p.color; c.stroke();
      c.save(); c.beginPath(); c.arc(230, y + 65, 52, 0, Math.PI * 2); c.fillStyle = U.shade(p.color, 0.5); c.fill(); c.clip();
      Sprites.drawHero(c, 226, y + 65 + 96, 2.4, { classId: p.classId, gender: p.gender, color: p.color, still: true, t: 0 });
      c.restore();
      c.textAlign = 'left'; c.fillStyle = '#3b2412';
      c.font = '900 40px "Trebuchet MS", sans-serif'; c.fillText(`${['🥇', '🥈', '🥉', '4.'][i]} ${p.name}`, 300, y + 58);
      c.font = '700 26px "Trebuchet MS", sans-serif'; c.fillStyle = '#6e4a2a'; c.fillText(`${DATA.CLASSES[p.classId].name} · Lv ${p.level}`, 300, y + 98);
      c.textAlign = 'right'; c.fillStyle = '#3b2412'; c.font = '900 38px "Trebuchet MS", sans-serif'; c.fillText(`⭐ ${p.stars}`, 930, y + 58);
      c.font = '700 26px "Trebuchet MS", sans-serif'; c.fillStyle = '#6e4a2a'; c.fillText(`💰 ${U.fmt(p.money)} G`, 930, y + 98);
    });
    c.textAlign = 'center'; c.fillStyle = '#3b2412'; c.font = '800 32px "Trebuchet MS", sans-serif';
    c.fillText(`${ranking[0].name} receives the King's Blessing!`, 540, 990);
    void light;
    return cv;
  }
  async function shareResults(kind, ranking) {
    const cv = resultCanvas(kind, ranking), text = resultText(kind, ranking);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    try {
      const file = new File([blob], 'sole-blessed-results.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sole Blessed', text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'sole-blessed-results.png';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('📥 Results image downloaded — share it anywhere!', 'good');
  }
  async function copyResults(kind, ranking) {
    const text = resultText(kind, ranking);
    try { await navigator.clipboard.writeText(text); toast('📋 Results copied to the clipboard.', 'good'); }
    catch (e) {
      const ta = h('textarea', null, text); document.body.append(ta); ta.select();
      try { document.execCommand('copy'); toast('📋 Results copied to the clipboard.', 'good'); } catch (e2) { toast('Copy failed — select the text manually.', 'bad'); }
      ta.remove();
    }
  }

  /* ================================================================ public API */
  return {
    get settings() { return S.settings; },
    get scene() { return S.scene; },
    h, btn, toast, modal, confirm, choice, announce, dialogue, pushKeys, popKeys, logLine,
    setScene, showTitle, enterGame, refresh, turnStart, turnAction, rollDice, walk, chooseDestination, pickSpace, onMapTap,
    openStatus, openInventory, openHelp, openPause, openSettings,
    yesNo, chooseChallenge, battleCommand, allocatePoints, inventoryFull, charmChoice, stealChoice, pickTarget,
    placeMenu, chooseClass, fightChoice, restTurn, requestPosted, openLedger,
    shop, horseBet, horseRace, dayStart, minionSpawn, minionWalk, warp, turnSummary, fatal, ending,
    isMoving: () => !!S.move,
    inGame: () => S.inGame,
  };
})();
