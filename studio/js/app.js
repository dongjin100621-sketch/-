'use strict';
/* 소리 공방: 화면과 기능을 잇는다 */
(function (S) {
  const T = S.theory, SG = S.song, A = S.audio, CP = S.compose;
  const { PPQ, BAR } = T;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 아이콘(선 그림) */
  const ICONS = {
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
    home: '<path d="M6 5v14M19 5l-9 7 9 7z"/>',
    rec: '<circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none"/>',
    loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    metro: '<path d="M9 3h6l4 18H5z"/><path d="M12 15l5-9"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    select: '<path d="M5 3l14 7-6 2-2 6z"/>',
    erase: '<path d="M7 20h12"/><path d="M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H8z"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3.5 15a1.6 1.6 0 0 1 2.6-1.8L8 15"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    zoomin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6M11 8v6"/>',
    zoomout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  function paintIcons(root = document) {
    root.querySelectorAll('[data-i]').forEach((el) => {
      const label = el.classList.contains('btn') ? el.textContent.trim() : '';
      el.innerHTML = icon(el.dataset.i) + (label ? `<span>${esc(label)}</span>` : '');
      if (!el.getAttribute('aria-label') && el.title) el.setAttribute('aria-label', el.title.split(' (')[0]);
    });
  }

  const SNAPS = [
    { id: '1/1', name: '1마디', t: BAR }, { id: '1/2', name: '2분', t: PPQ * 2 }, { id: '1/4', name: '4분', t: PPQ },
    { id: '1/8', name: '8분', t: PPQ / 2 }, { id: '1/16', name: '16분', t: PPQ / 4 }, { id: '1/32', name: '32분', t: PPQ / 8 },
    { id: '1/8T', name: '8분 셋잇단', t: PPQ / 3 }, { id: '1/16T', name: '16분 셋잇단', t: PPQ / 6 }, { id: 'off', name: '끄기', t: 1 },
  ];
  // 컴퓨터 키보드 → 반음 (e.code 를 써서 한글 자판에서도 같은 자리)
  const TYPE_KEYS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17 };
  const KEY_LABEL = Object.fromEntries(Object.entries(TYPE_KEYS).map(([k, v]) => [v, k === 'Semicolon' ? ';' : k === 'Quote' ? "'" : k.slice(3)]));
  const DRUM_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'];
  const keyCap = (c) => (c === 'Semicolon' ? ';' : c === 'Quote' ? "'" : c.slice(3));

  const prefs = SG.store.get('studio.prefs', {});
  const app = {
    song: null, trackId: null, libId: null,
    tool: 'pen', snap: prefs.snap || '1/16', lastLen: PPQ / 2, lastVel: 0.8,
    ui: Object.assign({ showVel: false, ghost: true, chordTones: true, scaleLock: false, follow: true, quantRec: true, typing: true, kbd: true }, prefs.ui || {}),
    octave: prefs.octave || 4,
    held: new Set(), live: new Map(),
    history: new SG.History(),
    ctx: null, engine: null, preview: null, clipboard: null,
    record: false, stepHeld: 0,
    get track() { return this.song && (this.song.tracks.find((t) => t.id === this.trackId) || this.song.tracks[0]); },
    snapTicks() { return (SNAPS.find((s) => s.id === this.snap) || SNAPS[4]).t; },
  };
  S.app = app;

  /* ---------- 소리 ---------- */
  function audio() {
    if (!app.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      app.ctx = new AC({ latencyHint: 'interactive' });
      app.engine = new A.Engine(app.ctx);
      app.engine.master.gain.value = app.song.master;
    }
    if (app.ctx.state === 'suspended') app.ctx.resume();
    return app.engine;
  }
  function previewSession() {
    const eng = audio();
    if (!app.preview) app.preview = new A.Session(eng);
    // 미리 듣기는 음소거·솔로와 상관없이 그 트랙 소리로 들린다
    const tr = app.track;
    const c = app.preview.chain(tr);
    const now = app.ctx.currentTime;
    c.vol.gain.setTargetAtTime(tr.vol * tr.vol, now, 0.01);
    if (c.pan) c.pan.pan.setTargetAtTime(tr.pan, now, 0.01);
    c.send.gain.setTargetAtTime(tr.rev * 0.6, now, 0.01);
    eng.master.gain.setTargetAtTime(app.song.master, now, 0.01);
    return c.input;
  }
  app.previewNote = (p, v = 0.8, tr = app.track) => {
    if (!tr) return;
    const dest = previewSession();
    const t = app.ctx.currentTime + 0.01;
    if (tr.type === 'drums') A.drumHit(app.engine, dest, tr.inst, p, t, v);
    else A.synthVoice(app.engine, dest, tr.inst, t, p, 0.32, v);
  };
  function previewChord(ch) {
    if (!ch) return;
    const tr = app.track;
    const dest = previewSession();
    const inst = tr.type === 'drums' ? 'piano' : tr.inst;
    const t = app.ctx.currentTime + 0.01;
    for (const p of CP.voice(ch, null)) A.synthVoice(app.engine, dest, inst, t, p, 0.9, 0.6);
  }

  const player = new A.Player(() => audio(), () => app.song);
  app.player = player;
  player.onStop = () => { renderTransport(); roll.requestDraw(); };

  /* 실시간 연주 */
  app.liveOn = (p, v = 0.8) => {
    const tr = app.track; if (!tr) return;
    if (app.live.has(p)) app.liveOff(p);
    const dest = previewSession();
    const t = app.ctx.currentTime + 0.005;
    let voice = null;
    if (tr.type === 'drums') A.drumHit(app.engine, dest, tr.inst, p, t, v);
    else voice = A.synthVoice(app.engine, dest, tr.inst, t, p, 60, v);
    const rec = app.record ? (player.playing ? { tick: player.now() } : { step: true }) : null;
    app.live.set(p, { voice, v, rec, track: tr });
    app.held.add(p);
    if (rec && rec.step) {
      // 멈춘 채 녹음: 지금 위치에 한 칸짜리 음을 넣는다(함께 누른 음은 화음)
      const len = tr.type === 'drums' ? app.snapTicks() : Math.max(app.snapTicks(), 1);
      tr.notes.push({ t: Math.round(player.pos), d: len, p, v });
      app.stepHeld++;
      roll.requestDraw();
    }
    markKeys();
  };
  app.liveOff = (p) => {
    const L = app.live.get(p); if (!L) return;
    app.live.delete(p); app.held.delete(p);
    if (L.voice) L.voice.release(app.ctx.currentTime);
    if (L.rec && L.rec.step) {
      app.stepHeld = Math.max(0, app.stepHeld - 1);
      if (!app.stepHeld) {
        player.pos += app.snapTicks();
        sortNotes(L.track); app.commit('한 칸 입력', true);
        scrollToPos();
      }
    } else if (L.rec && player.playing) {
      const s = app.song;
      let st = L.rec.tick, en = player.now();
      if (en < st) en = s.loop.on ? s.loop.end : st + app.snapTicks(); // 반복 구간을 넘어간 경우
      let d = en - st;
      if (app.ui.quantRec) {
        const q = app.snapTicks();
        st = Math.round(st / q) * q;
        d = Math.max(q, Math.round(d / q) * q);
      }
      if (L.track.type === 'drums') d = app.snapTicks();
      L.track.notes.push({ t: Math.max(0, Math.round(st)), d: Math.max(1, Math.round(d)), p, v: L.v });
      sortNotes(L.track); app.commit('녹음', true);
    }
    markKeys();
    roll.requestDraw();
  };
  function allLiveOff() { for (const p of [...app.live.keys()]) app.liveOff(p); }
  function sortNotes(tr) { tr.notes.sort((a, b) => a.t - b.t || a.p - b.p); }

  /* ---------- 저장·되돌리기 ---------- */
  let saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      SG.store.set('studio.current', { id: app.libId, song: app.song });
      if (app.libId && hasContent(app.song)) SG.library.save(app.libId, app.song);
    }, 350);
  }
  const hasContent = (s) => s.tracks.some((t) => t.notes.length) || s.chords.some(Boolean);
  function savePrefs() { SG.store.set('studio.prefs', { ui: app.ui, snap: app.snap, octave: app.octave, theme: prefs.theme || '' }); }

  /** 바뀐 내용을 되돌리기 기록에 남기고 화면을 고친다 */
  app.commit = (label, quiet) => {
    if (!app.history.push(app.song)) { roll.requestDraw(); return; }
    app.lastLabel = label;
    autosave();
    player.update();
    renderUndo(); renderTracks(); roll.requestDraw();
    void quiet;
  };
  /** 마지막 기록 상태로 되돌린다(취소된 동작) */
  app.revert = () => {
    if (app.history.cur) setSong(JSON.parse(app.history.cur), { keepHistory: true });
  };
  function undo() {
    const s = app.history.undo(); if (!s) return toast('더 되돌릴 것이 없어요');
    setSong(s, { keepHistory: true }); autosave(); toast('되돌림');
  }
  function redo() {
    const s = app.history.redo(); if (!s) return;
    setSong(s, { keepHistory: true }); autosave(); toast('다시 함');
  }

  function setSong(song, opt = {}) {
    const keepTrack = app.trackId;
    app.song = SG.normalize(song);
    if (!app.song.tracks.some((t) => t.id === keepTrack)) app.trackId = app.song.tracks[0].id;
    if (!opt.keepHistory) app.history.reset(app.song);
    roll.sel.clear();
    if (app.engine) app.engine.master.gain.value = app.song.master;
    player.update();
    renderAll();
  }
  function loadNewSong(song, id) {
    player.stop(); player.pos = 0;
    app.libId = id || ('s' + Date.now().toString(36));
    app.trackId = null;
    setSong(song);
    roll.sx = 0; roll.fitTrack();
    autosave();
  }

  /* ---------- 화면 ---------- */
  const roll = new S.Roll($('roll'), app);
  app.roll = roll;

  function renderAll() {
    renderHeader(); renderTracks(); renderTransport(); renderUndo(); renderToolbar(); renderKeyboard(); roll.requestDraw();
  }
  function renderHeader() {
    const s = app.song;
    if (document.activeElement !== $('title')) $('title').value = s.title;
    if (document.activeElement !== $('bpm')) $('bpm').value = s.bpm;
    if (document.activeElement !== $('bars')) $('bars').value = s.bars;
    $('key').innerHTML = T.NOTE_NAMES.map((n, i) => `<option value="${i}">${T.keyName(i, s.scale)}${T.keyName(i, s.scale) !== n ? '' : ''}</option>`).join('');
    $('key').value = s.key;
    $('scale').value = s.scale;
    document.title = (s.title ? s.title + ' · ' : '') + '소리 공방';
  }
  function renderTransport() {
    const b = $('btnPlay');
    b.dataset.i = player.playing ? 'pause' : 'play'; b.innerHTML = icon(b.dataset.i);
    b.setAttribute('aria-label', player.playing ? '멈춤' : '재생');
    $('btnLoop').setAttribute('aria-pressed', String(app.song.loop.on));
    $('btnMetro').setAttribute('aria-pressed', String(player.metronome));
    $('btnRec').setAttribute('aria-pressed', String(app.record));
    renderPos();
  }
  function renderUndo() {
    $('btnUndo').disabled = !app.history.canUndo;
    $('btnRedo').disabled = !app.history.canRedo;
  }
  function fmtPos(tick) {
    const bar = Math.floor(tick / BAR) + 1, beat = Math.floor((tick % BAR) / PPQ) + 1;
    return bar + '.' + beat;
  }
  function fmtTime(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ':' + String(s).padStart(2, '0'); }
  let lastPos = '';
  function renderPos() {
    const t = player.now();
    const txt = `<b>${fmtPos(t)}</b><small>${fmtTime(t * 60 / app.song.bpm / PPQ)} / ${fmtTime(app.song.bars * BAR * 60 / app.song.bpm / PPQ)}</small>`;
    if (txt !== lastPos) { $('pos').innerHTML = txt; lastPos = txt; }
  }

  function trackMeta(tr) {
    const inst = tr.type === 'drums' ? SG.KITS[tr.inst] : (SG.INSTRUMENTS[tr.inst] || {}).name;
    return `${inst} · 음표 ${tr.notes.length}`;
  }
  function renderTracks() {
    const ul = $('trackList');
    const s = app.song;
    const solo = s.tracks.some((t) => t.solo);
    ul.innerHTML = s.tracks.map((tr) => `
      <li class="trk${tr.id === app.track.id ? ' on' : ''}${tr.mute || (solo && !tr.solo) ? ' muted-t' : ''}" data-id="${tr.id}">
        <span class="sw" style="background:${tr.color}"></span>
        <span class="nm">${esc(tr.name)}</span>
        <span class="btns">
          <button class="m" data-a="mute" aria-pressed="${tr.mute}" title="소리 끄기(뮤트)">M</button>
          <button class="s" data-a="solo" aria-pressed="${tr.solo}" title="이 트랙만 듣기(솔로)">S</button>
          <button class="g" data-a="edit" title="트랙 설정">${icon('gear')}</button>
        </span>
        <span class="meta">${esc(trackMeta(tr))}</span>
        <input type="range" min="0" max="1.2" step="0.01" value="${tr.vol}" data-a="vol" aria-label="${esc(tr.name)} 음량">
      </li>`).join('');
  }
  function selectTrack(id) {
    if (app.trackId === id) return;
    allLiveOff();
    const was = app.track && app.track.type;
    app.trackId = id; roll.sel.clear();
    renderTracks(); renderKeyboard(); onSelection();
    if (was !== app.track.type) roll.fitTrack(); else roll.requestDraw();
  }

  function renderToolbar() {
    document.querySelectorAll('.tool').forEach((b) => { b.classList.toggle('on', b.dataset.tool === app.tool); b.setAttribute('aria-pressed', String(b.dataset.tool === app.tool)); });
    $('snap').value = app.snap;
    document.querySelectorAll('#popView [data-ui]').forEach((c) => { c.checked = !!app.ui[c.dataset.ui]; });
    $('typing').checked = app.ui.typing;
    onSelection();
  }
  function onSelection() {
    const n = roll.sel.size;
    if (!n) { $('selInfo').textContent = app.track ? `${app.track.name} · ${app.track.type === 'drums' ? '드럼' : '음 ' + app.track.notes.length + '개'}` : ''; return; }
    const arr = [...roll.sel];
    const v = Math.round(arr.reduce((a, x) => a + x.v, 0) / n * 100);
    const one = n === 1 && app.track.type !== 'drums' ? ` · ${T.noteName(arr[0].p)} ${fmtPos(arr[0].t)}` : '';
    $('selInfo').textContent = `${n}개 선택${one} · 세기 ${v}%`;
  }
  app.onSelection = onSelection;

  /* ---------- 아래 건반 ---------- */
  function renderKeyboard() {
    const wrap = $('kbdWrap'), kb = $('kbd'), tr = app.track;
    wrap.classList.toggle('collapsed', !app.ui.kbd);
    $('kbdToggle').textContent = app.ui.kbd ? '건반 숨기기' : '건반 보이기';
    const drum = tr && tr.type === 'drums';
    $('octLabel').textContent = drum ? '드럼' : 'C' + app.octave;
    $('octDown').disabled = drum; $('octUp').disabled = drum;
    $('kbdHint').textContent = app.ui.typing ? (drum ? "A S D F G H J K L ; ' 로 드럼" : 'A~; 흰건반 · W E T Y U O P 검은건반 · Z/X 옥타브') : '';
    if (!app.ui.kbd) { kb.innerHTML = ''; return; }
    if (drum) {
      kb.innerHTML = `<div class="pads" style="grid-template-columns:repeat(${SG.DRUMS.length},minmax(0,1fr))">` + SG.DRUMS.map((d, i) => `<div class="pad" data-p="${i}">${d.name}${app.ui.typing && DRUM_KEYS[i] ? `<small>${keyCap(DRUM_KEYS[i])}</small>` : ''}</div>`).join('') + '</div>';
    } else {
      const width = kb.clientWidth || window.innerWidth - 20;
      const whites = Math.max(8, Math.min(36, Math.floor(width / (width < 600 ? 34 : 40))));
      const base = app.octave * 12 + 12; // C(octave)
      const keys = [];
      let wi = 0, p = base;
      while (wi < whites) {
        const black = [1, 3, 6, 8, 10].includes(p % 12);
        keys.push({ p, black, wi });
        if (!black) wi++;
        p++;
      }
      const ww = 100 / whites;
      const s = app.song;
      kb.innerHTML = keys.map((k) => {
        const rel = k.p - base;
        const lab = app.ui.typing && KEY_LABEL[rel] ? `<small>${KEY_LABEL[rel]}</small>` : '';
        const inS = T.inScale(k.p, s.key, s.scale) && s.scale !== 'chromatic' ? ' inscale' : '';
        const name = k.p % 12 === 0 ? T.noteName(k.p) : '';
        return k.black
          ? `<div class="bk${inS}" data-p="${k.p}" style="left:calc(${k.wi * ww}% - ${ww * 0.3}%);width:${ww * 0.6}%">${lab}</div>`
          : `<div class="wk${inS}" data-p="${k.p}">${lab}${name}</div>`;
      }).join('');
    }
    markKeys();
  }
  function markKeys() {
    $('kbd').querySelectorAll('[data-p]').forEach((el) => el.classList.toggle('down', app.held.has(+el.dataset.p)));
  }
  (function bindKeyboard() {
    const kb = $('kbd');
    const ptr = new Map();
    const keyAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('[data-p]') && kb.contains(el) ? +el.closest('[data-p]').dataset.p : null; };
    kb.addEventListener('pointerdown', (e) => {
      const p = keyAt(e.clientX, e.clientY); if (p == null) return;
      e.preventDefault(); kb.setPointerCapture(e.pointerId);
      const el = e.target.closest('[data-p]');
      const rect = el.getBoundingClientRect();
      const v = Math.max(0.35, Math.min(1, 0.45 + 0.55 * (e.clientY - rect.top) / rect.height));
      ptr.set(e.pointerId, p); app.liveOn(p, v);
    });
    kb.addEventListener('pointermove', (e) => {
      if (!ptr.has(e.pointerId)) return;
      const p = keyAt(e.clientX, e.clientY);
      const old = ptr.get(e.pointerId);
      if (p != null && p !== old && app.track.type !== 'drums') { app.liveOff(old); app.liveOn(p, 0.75); ptr.set(e.pointerId, p); }
    });
    const end = (e) => { if (!ptr.has(e.pointerId)) return; app.liveOff(ptr.get(e.pointerId)); ptr.delete(e.pointerId); };
    kb.addEventListener('pointerup', end); kb.addEventListener('pointercancel', end);
    let rw = 0;
    new ResizeObserver(() => { const w = kb.clientWidth; if (Math.abs(w - rw) > 30) { rw = w; renderKeyboard(); } }).observe(kb);
  })();

  /* ---------- 재생 조작 ---------- */
  function togglePlay() {
    audio();
    if (player.playing) { player.stop(); allLiveOff(); }
    else player.play();
    renderTransport(); roll.requestDraw();
  }
  app.seek = (tick) => {
    if (player.playing) player.play(tick); else player.pos = tick;
    renderPos(); roll.requestDraw();
  };
  app.setLoop = (start, end) => {
    app.song.loop = { on: true, start, end: Math.min(end, Math.max(end, start + BAR)) };
    if (!player.playing) player.pos = start;
    app.commit('반복 구간'); renderTransport();
  };
  function scrollToPos() {
    const x = roll.tx(player.pos);
    if (x > roll.w - 60 || x < 70) { roll.sx = Math.max(0, player.pos * roll.ppt - roll.gridW * 0.3); roll.requestDraw(); }
  }

  /* 레벨 미터 */
  (function meterLoop() {
    const cv = $('meter'), g = cv.getContext('2d');
    let buf = null, peak = 0;
    const frame = () => {
      if (player.playing) renderPos();
      if (app.engine && cv.offsetParent) {
        const an = app.engine.analyse();
        if (!buf) buf = new Float32Array(an.fftSize);
        an.getFloatTimeDomainData(buf);
        let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
        peak = Math.max(m, peak * 0.94);
        const W = cv.width, H = cv.height;
        g.clearRect(0, 0, W, H);
        const freq = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(freq);
        const bars = 36, bw = W / bars;
        const col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f2b155';
        g.fillStyle = col;
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor(Math.pow(i / bars, 2) * freq.length * 0.6) + 1;
          const h = (freq[idx] / 255) * (H - 8);
          g.globalAlpha = 0.35 + 0.65 * (i / bars);
          g.fillRect(i * bw + 1, H - 4 - h, bw - 2, h);
        }
        g.globalAlpha = 1;
        g.fillStyle = peak > 0.97 ? '#ef4b5f' : col;
        g.fillRect(0, H - 3, W * Math.min(1, peak), 3);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })();

  /* ---------- 편집 명령 ---------- */
  const selOrAll = () => roll.sel.size ? [...roll.sel] : app.track.notes.slice();
  const cmds = {
    selectAll() { roll.sel = new Set(app.track.notes); onSelection(); roll.requestDraw(); },
    copy() {
      const ns = [...roll.sel]; if (!ns.length) return toast('먼저 음표를 고르세요');
      const t0 = Math.min(...ns.map((n) => n.t));
      app.clipboard = { drum: app.track.type === 'drums', notes: ns.map((n) => ({ ...n, t: n.t - t0 })), span: Math.max(...ns.map((n) => n.t + n.d)) - t0 };
      toast(`${ns.length}개 복사`);
    },
    cut() { if (!roll.sel.size) return; cmds.copy(); cmds.delete(); },
    paste() {
      const cb = app.clipboard; if (!cb) return toast('복사한 음표가 없어요');
      if (cb.drum !== (app.track.type === 'drums')) return toast(cb.drum ? '드럼 음표는 드럼 트랙에 붙여 넣을 수 있어요' : '악기 음표는 악기 트랙에 붙여 넣을 수 있어요');
      const at = Math.floor(player.now() / app.snapTicks()) * app.snapTicks();
      const add = cb.notes.map((n) => ({ ...n, t: n.t + at }));
      app.track.notes.push(...add); sortNotes(app.track);
      roll.sel = new Set(add);
      player.pos = at + Math.ceil(cb.span / app.snapTicks()) * app.snapTicks();
      app.commit('붙여넣기'); onSelection();
    },
    duplicate() {
      const ns = [...roll.sel]; if (!ns.length) return toast('먼저 음표를 고르세요');
      const t0 = Math.min(...ns.map((n) => n.t)), t1 = Math.max(...ns.map((n) => n.t + n.d));
      const unit = (t1 - t0) >= BAR / 2 ? BAR : PPQ;
      const span = Math.ceil((t1 - t0) / unit) * unit || unit;
      const add = ns.map((n) => ({ ...n, t: n.t + span }));
      app.track.notes.push(...add); sortNotes(app.track);
      roll.sel = new Set(add); growBars(Math.max(...add.map((n) => n.t + n.d)));
      app.commit('복제'); onSelection();
    },
    delete() { if (!roll.sel.size) return; roll.removeNotes([...roll.sel]); app.commit('지우기'); },
    quantize() {
      const q = app.snapTicks();
      for (const n of selOrAll()) { n.t = Math.round(n.t / q) * q; if (app.track.type !== 'drums') n.d = Math.max(q, Math.round(n.d / q) * q); }
      sortNotes(app.track); app.commit('퀀타이즈'); toast('격자에 맞췄어요');
    },
    toScale() {
      if (app.track.type === 'drums') return;
      let c = 0; for (const n of selOrAll()) { const p = T.snapToScale(n.p, app.song.key, app.song.scale); if (p !== n.p) { n.p = p; c++; } }
      app.commit('음계로'); toast(c ? `${c}개를 음계 안으로 옮겼어요` : '모두 음계 안에 있어요');
    },
    octUp() { transpose(12); }, octDown() { transpose(-12); },
    legato() {
      if (app.track.type === 'drums') return;
      const ns = selOrAll().sort((a, b) => a.t - b.t);
      const starts = [...new Set(ns.map((n) => n.t))].sort((a, b) => a - b);
      for (const n of ns) { const nx = starts.find((t) => t > n.t); if (nx != null) n.d = nx - n.t; }
      app.commit('레가토');
    },
    humanize() {
      const r = CP.rng(Date.now());
      for (const n of selOrAll()) {
        n.v = Math.max(0.1, Math.min(1, n.v + (r() - 0.5) * 0.2));
        if (n.t > 0) n.t = Math.max(0, n.t + Math.round((r() - 0.5) * 4));
      }
      sortNotes(app.track); app.commit('사람 손맛'); toast('세기와 박자를 살짝 흔들었어요');
    },
    dupLoop() {
      const s = app.song;
      if (!s.loop.on) return toast('먼저 마디 자를 끌어 반복 구간을 정하세요');
      const a = s.loop.start, b = s.loop.end, len = b - a;
      for (const tr of s.tracks) {
        tr.notes = tr.notes.filter((n) => n.t < b || n.t >= b + len);
        const add = tr.notes.filter((n) => n.t >= a && n.t < b).map((n) => ({ ...n, t: n.t + len }));
        tr.notes.push(...add); sortNotes(tr);
      }
      growBars(b + len);
      for (let i = 0; i < len / BAR; i++) s.chords[b / BAR + i] = s.chords[a / BAR + i] ? { ...s.chords[a / BAR + i] } : s.chords[b / BAR + i];
      s.loop = { on: true, start: b, end: b + len };
      app.commit('구간 복제'); renderHeader(); toast('구간을 뒤에 복제했어요');
    },
    clearLoop() {
      const s = app.song;
      if (!s.loop.on) return toast('먼저 반복 구간을 정하세요');
      for (const tr of s.tracks) tr.notes = tr.notes.filter((n) => n.t < s.loop.start || n.t >= s.loop.end);
      roll.sel.clear(); app.commit('구간 비우기');
    },
    clearTrack() {
      if (!app.track.notes.length) return;
      if (!confirm(`「${app.track.name}」의 음표 ${app.track.notes.length}개를 모두 지울까요? (되돌리기 가능)`)) return;
      app.track.notes = []; roll.sel.clear(); app.commit('트랙 비우기');
    },
    zoomYIn() { roll.zoomY(1.2); }, zoomYOut() { roll.zoomY(1 / 1.2); }, fit() { roll.fitTrack(); },
  };
  function transpose(dp) {
    const ns = roll.sel.size ? [...roll.sel] : null; if (!ns) return toast('먼저 음표를 고르세요');
    if (app.track.type === 'drums') {
      if (ns.some((n) => n.p + Math.sign(dp) < 0 || n.p + Math.sign(dp) >= SG.DRUMS.length)) return;
      ns.forEach((n) => { n.p += Math.sign(dp); });
    } else {
      if (ns.some((n) => n.p + dp < 0 || n.p + dp > 127)) return;
      ns.forEach((n) => { n.p += dp; });
      app.previewNote(ns[0].p, ns[0].v);
    }
    app.commit('음 높이'); onSelection();
  }
  function nudge(dt) {
    const ns = [...roll.sel]; if (!ns.length) return;
    if (ns.some((n) => n.t + dt < 0)) return;
    ns.forEach((n) => { n.t += dt; }); sortNotes(app.track); app.commit('옮기기'); onSelection();
  }
  function growBars(endTick) {
    const need = Math.ceil(endTick / BAR);
    if (need > app.song.bars) { app.song.bars = Math.min(256, need); SG.resizeChords(app.song); renderHeader(); }
  }

  /* ---------- 떠 있는 메뉴 ---------- */
  let openPop = null;
  function showPop(id, x, y, anchor) {
    hidePop();
    const el = $(id); el.hidden = false; openPop = el;
    const r = el.getBoundingClientRect();
    if (anchor) { const a = anchor.getBoundingClientRect(); x = a.left; y = a.bottom + 4; }
    el.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  }
  function hidePop() { if (openPop) { openPop.hidden = true; openPop = null; } }
  document.addEventListener('pointerdown', (e) => { if (openPop && !openPop.contains(e.target) && !e.target.closest('#btnEdit,#btnView')) hidePop(); }, true);
  $('btnEdit').onclick = (e) => (openPop && openPop.id === 'popEdit' ? hidePop() : showPop('popEdit', 0, 0, e.currentTarget));
  $('btnView').onclick = (e) => (openPop && openPop.id === 'popView' ? hidePop() : (renderToolbar(), showPop('popView', 0, 0, e.currentTarget)));
  $('popEdit').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return; hidePop(); cmds[b.dataset.act](); });
  $('popView').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (!b) return; cmds[b.dataset.act](); });
  $('popView').addEventListener('change', (e) => {
    const c = e.target.closest('[data-ui]'); if (!c) return;
    app.ui[c.dataset.ui] = c.checked; savePrefs(); roll.resize(); roll.requestDraw();
  });

  /* 코드 고르기 */
  let chordBar = 0;
  app.openChordPicker = (bar, x, y) => {
    const s = app.song;
    if (bar < 0 || bar >= s.bars) return;
    chordBar = bar;
    const flats = T.prefersFlats(s.key, s.scale);
    $('chordTitle').textContent = `${bar + 1}마디 코드`;
    const cur = s.chords[bar];
    const opts = [];
    for (let d = 0; d < 7; d++) opts.push(T.diatonic(s.key, s.scale, d, false));
    for (let d = 0; d < 7; d++) opts.push(T.diatonic(s.key, s.scale, d, true));
    opts.push({ root: T.mod12(s.key + 7), q: '7' }, { root: T.mod12(s.key + 5), q: 'm' }); // V7, iv(빌린 화음)
    const same = (a, b) => a && b && a.root === b.root && a.q === b.q;
    $('chordDiatonic').innerHTML = opts.map((c, i) => `<button data-i="${i}" class="${same(c, cur) ? 'on' : ''}">${esc(T.chordName(c, flats))}<small>${esc(T.roman(c, s.key, s.scale) || '빌림')}</small></button>`).join('');
    $('chordDiatonic').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; setChord(opts[+b.dataset.i]); };
    $('chordRoot').innerHTML = (flats ? T.FLAT_NAMES : T.NOTE_NAMES).map((n, i) => `<option value="${i}">${n}</option>`).join('');
    $('chordQual').innerHTML = Object.entries(T.QUALITIES).map(([q, d]) => `<option value="${q}">${d.label || '장3화음'}</option>`).join('');
    $('chordRoot').value = cur ? cur.root : s.key; $('chordQual').value = cur ? cur.q : '';
    showPop('popChord', x - 40, y + 12);
  };
  function setChord(ch) {
    const s = app.song;
    s.chords[chordBar] = ch ? { root: ch.root, q: ch.q } : null;
    if (ch) { audio(); previewChord(ch); }
    app.commit('코드');
    if (ch && $('chordAdvance').checked && chordBar + 1 < s.bars) {
      const r = $('popChord').getBoundingClientRect();
      app.openChordPicker(chordBar + 1, r.left + 40, r.top - 12);
    } else hidePop();
  }
  $('chordApply').onclick = () => setChord({ root: +$('chordRoot').value, q: $('chordQual').value });
  $('chordClear').onclick = () => setChord(null);
  $('chordPlay').onclick = () => { audio(); previewChord({ root: +$('chordRoot').value, q: $('chordQual').value }); };

  /* ---------- 트랙 ---------- */
  $('trackList').addEventListener('click', (e) => {
    const li = e.target.closest('.trk'); if (!li) return;
    const tr = app.song.tracks.find((t) => t.id === li.dataset.id); if (!tr) return;
    const a = e.target.closest('[data-a]');
    if (a && a.dataset.a === 'mute') { tr.mute = !tr.mute; app.commit('뮤트'); return; }
    if (a && a.dataset.a === 'solo') { tr.solo = !tr.solo; app.commit('솔로'); return; }
    if (a && a.dataset.a === 'vol') return;
    selectTrack(tr.id);
    if (a && a.dataset.a === 'edit') openTrackDlg();
  });
  $('trackList').addEventListener('dblclick', (e) => { if (e.target.closest('.trk') && !e.target.closest('[data-a]')) openTrackDlg(); });
  $('trackList').addEventListener('input', (e) => {
    if (e.target.dataset.a !== 'vol') return;
    const tr = app.song.tracks.find((t) => t.id === e.target.closest('.trk').dataset.id);
    tr.vol = +e.target.value; player.update();
  });
  $('trackList').addEventListener('change', (e) => { if (e.target.dataset.a === 'vol') app.commit('음량'); });
  function addTrack(type) {
    const s = app.song;
    if (s.tracks.length >= 32) return toast('트랙은 32개까지 만들 수 있어요');
    const used = new Set(s.tracks.map((t) => t.color));
    const color = SG.COLORS.find((c) => !used.has(c)) || SG.COLORS[s.tracks.length % SG.COLORS.length];
    const n = s.tracks.filter((t) => t.type === type).length + 1;
    const tr = SG.makeTrack(type, { color, name: type === 'drums' ? (n > 1 ? '드럼 ' + n : '드럼') : '악기 ' + n });
    s.tracks.push(tr);
    app.trackId = tr.id; roll.sel.clear();
    app.commit('트랙 추가'); renderKeyboard(); roll.fitTrack(); onSelection();
    openTrackDlg();
  }
  $('addSynth').onclick = () => addTrack('synth');
  $('addDrum').onclick = () => addTrack('drums');

  function openTrackDlg() {
    const tr = app.track, d = $('dlgTrack');
    $('tName').value = tr.name;
    $('tInstLabel').textContent = tr.type === 'drums' ? '드럼 킷' : '악기';
    $('tInst').innerHTML = tr.type === 'drums'
      ? Object.entries(SG.KITS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')
      : SG.instrumentOptions(esc);
    $('tInst').value = tr.inst;
    $('tVol').value = tr.vol; $('tPan').value = tr.pan; $('tRev').value = tr.rev;
    trackOutputs();
    $('tColors').innerHTML = SG.COLORS.map((c) => `<button type="button" data-c="${c}" class="${c === tr.color ? 'on' : ''}" style="background:${c}" aria-label="색 ${c}"></button>`).join('');
    if (!d.open) d.showModal();
  }
  function trackOutputs() {
    const tr = app.track;
    $('tVolO').textContent = Math.round(tr.vol * 100) + '%';
    $('tPanO').textContent = Math.abs(tr.pan) < 0.03 ? '가운데' : (tr.pan < 0 ? '왼쪽 ' : '오른쪽 ') + Math.round(Math.abs(tr.pan) * 100);
    $('tRevO').textContent = Math.round(tr.rev * 100) + '%';
  }
  $('tName').oninput = () => { app.track.name = $('tName').value.slice(0, 40) || '트랙'; renderTracks(); };
  $('tName').onchange = () => app.commit('이름');
  $('tInst').onchange = () => { app.track.inst = $('tInst').value; app.commit('악기'); app.previewNote(app.track.type === 'drums' ? 0 : 60); };
  for (const [id, k] of [['tVol', 'vol'], ['tPan', 'pan'], ['tRev', 'rev']]) {
    $(id).oninput = () => { app.track[k] = +$(id).value; trackOutputs(); player.update(); };
    $(id).onchange = () => app.commit('믹서');
  }
  $('tColors').onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; app.track.color = b.dataset.c; app.commit('색'); openTrackDlg(); };
  $('tUp').onclick = () => moveTrack(-1);
  $('tDown').onclick = () => moveTrack(1);
  function moveTrack(dir) {
    const ts = app.song.tracks, i = ts.indexOf(app.track), j = i + dir;
    if (j < 0 || j >= ts.length) return;
    [ts[i], ts[j]] = [ts[j], ts[i]]; app.commit('순서');
  }
  $('tDup').onclick = () => {
    const tr = app.track, s = app.song;
    if (s.tracks.length >= 32) return;
    const c = SG.clone(tr); c.id = SG.newId(); c.name = (tr.name + ' 복사').slice(0, 40); c.role = ''; c.solo = false;
    s.tracks.splice(s.tracks.indexOf(tr) + 1, 0, c); app.trackId = c.id;
    app.commit('트랙 복제'); openTrackDlg();
  };
  $('tDel').onclick = () => {
    const s = app.song;
    if (s.tracks.length <= 1) return toast('트랙이 하나뿐이라 지울 수 없어요');
    const tr = app.track;
    if (tr.notes.length && !confirm(`「${tr.name}」 트랙을 지울까요? (되돌리기 가능)`)) return;
    const i = s.tracks.indexOf(tr);
    s.tracks.splice(i, 1);
    app.trackId = s.tracks[Math.max(0, i - 1)].id; roll.sel.clear();
    $('dlgTrack').close(); app.commit('트랙 지우기'); renderKeyboard(); roll.fitTrack();
  };

  /* ---------- 곡 설정(위 막대) ---------- */
  $('scale').innerHTML = Object.entries(T.SCALES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  $('snap').innerHTML = SNAPS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  $('title').onchange = () => { app.song.title = $('title').value.trim().slice(0, 80) || '제목 없음'; app.commit('제목'); renderHeader(); };
  $('title').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  $('bpm').onchange = () => { app.song.bpm = Math.max(30, Math.min(300, Math.round(+$('bpm').value || 110))); app.commit('템포'); renderHeader(); renderPos(); };
  $('bars').onchange = () => {
    const n = Math.max(1, Math.min(256, Math.round(+$('bars').value || 8)));
    app.song.bars = n; SG.resizeChords(app.song);
    if (app.song.loop.end > n * BAR) app.song.loop = { on: app.song.loop.on && n * BAR > app.song.loop.start, start: Math.min(app.song.loop.start, (n - 1) * BAR), end: Math.min(app.song.loop.end, n * BAR) };
    app.commit('마디 수'); renderHeader(); renderTransport();
  };
  $('key').onchange = () => { app.song.key = +$('key').value; app.commit('조'); renderHeader(); renderKeyboard(); };
  $('scale').onchange = () => { app.song.scale = $('scale').value; app.commit('음계'); renderHeader(); renderKeyboard(); };
  $('snap').onchange = () => { app.snap = $('snap').value; savePrefs(); roll.requestDraw(); };
  document.querySelectorAll('.tool').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });
  function setTool(t) { app.tool = t; renderToolbar(); roll.requestDraw(); }

  $('btnPlay').onclick = togglePlay;
  $('btnHome').onclick = () => { app.seek(app.song.loop.on && player.now() > app.song.loop.start ? app.song.loop.start : 0); roll.sx = Math.max(0, player.pos * roll.ppt - 20); roll.requestDraw(); };
  $('btnLoop').onclick = () => {
    const s = app.song;
    if (!s.loop.on && (s.loop.end > s.bars * BAR || s.loop.start >= s.bars * BAR)) s.loop = { on: false, start: 0, end: Math.min(s.bars, 4) * BAR };
    s.loop.on = !s.loop.on; app.commit('반복'); renderTransport();
    if (s.loop.on) toast(`${s.loop.start / BAR + 1}~${s.loop.end / BAR}마디 반복 · 마디 자를 끌어 바꿀 수 있어요`);
  };
  $('btnMetro').onclick = () => { player.metronome = !player.metronome; renderTransport(); };
  $('btnRec').onclick = () => {
    app.record = !app.record; renderTransport();
    if (app.record) toast(player.playing ? '녹음 중: 건반을 연주하세요' : '한 칸 입력: 건반을 누를 때마다 격자 한 칸씩 들어가요. 재생하면 실시간 녹음');
  };
  $('btnUndo').onclick = undo; $('btnRedo').onclick = redo;
  $('zoomIn').onclick = () => roll.zoomX(1.25);
  $('zoomOut').onclick = () => roll.zoomX(0.8);
  $('octDown').onclick = () => setOctave(app.octave - 1);
  $('octUp').onclick = () => setOctave(app.octave + 1);
  function setOctave(o) { allLiveOff(); app.octave = Math.max(1, Math.min(7, o)); savePrefs(); renderKeyboard(); }
  $('typing').onchange = () => { app.ui.typing = $('typing').checked; savePrefs(); renderKeyboard(); };
  $('kbdToggle').onclick = () => { app.ui.kbd = !app.ui.kbd; savePrefs(); renderKeyboard(); };

  /* ---------- 자동 작곡 ---------- */
  const instOpts = SG.instrumentOptions(esc);
  $('cGenre').innerHTML = Object.entries(CP.GENRES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  $('cComp').innerHTML = Object.entries(CP.COMP_STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('cBass').innerHTML = Object.entries(CP.BASS_STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('cDrums').innerHTML = Object.entries(CP.DRUM_STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('cMelInst').innerHTML = instOpts; $('cChordInst').innerHTML = instOpts; $('cBassInst').innerHTML = instOpts;
  function fillGenre() {
    const g = CP.GENRES[$('cGenre').value];
    $('cProg').value = g.prog;
    $('cBpm').value = g.bpm; $('cSwing').value = g.swing; $('cComp').value = g.comp; $('cBass').value = g.bass;
    $('cDrums').value = g.drums; $('cDensity').value = g.density; $('cMelInst').value = g.melInst; $('cChordInst').value = g.chordInst; $('cBassInst').value = g.bassInst;
  }
  $('cGenre').onchange = fillGenre;
  $('btnCompose').onclick = () => {
    const s = app.song;
    const hasLane = s.chords.some(Boolean);
    $('cProg').innerHTML = (hasLane ? '<option value="lane">코드 줄 그대로 쓰기</option>' : '') +
      T.PROGRESSIONS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
    if (!$('cGenre').value) $('cGenre').value = 'pop';
    fillGenre();
    if (hasLane) $('cProg').value = 'lane';
    $('cBpm').value = s.bpm;
    if (!$('cSeed').value) $('cSeed').value = 1 + Math.floor(Math.random() * 99999);
    $('dlgCompose').showModal();
  };
  $('cDice').onclick = () => { $('cSeed').value = 1 + Math.floor(Math.random() * 99999); };
  $('cGo').onclick = () => {
    const s = app.song;
    const parts = { melody: $('pMelody').checked, chords: $('pChords').checked, bass: $('pBass').checked, drums: $('pDrums').checked };
    if (!Object.values(parts).some(Boolean)) return toast('만들 부분을 하나 이상 고르세요');
    const g = CP.GENRES[$('cGenre').value];
    CP.generate(s, {
      genre: $('cGenre').value, prog: $('cProg').value, comp: $('cComp').value, bass: $('cBass').value, drums: $('cDrums').value,
      density: +$('cDensity').value, melInst: $('cMelInst').value, chordInst: $('cChordInst').value, bassInst: $('cBassInst').value, kit: g.kit,
      seed: Math.max(1, Math.round(+$('cSeed').value || 1)), bpm: Math.max(30, Math.min(300, Math.round(+$('cBpm').value || s.bpm))),
      swing: +$('cSwing').value, parts,
    });
    if (!s.title || s.title === '새 곡') s.title = `${g.name} 스케치 #${$('cSeed').value}`;
    const mel = s.tracks.find((t) => t.role === 'melody');
    app.trackId = (mel || s.tracks[0]).id;
    roll.sel.clear();
    app.commit('자동 작곡');
    renderAll(); roll.fitTrack();
    $('dlgCompose').close();
    $('cSeed').value = 1 + Math.floor(Math.random() * 99999); // 다음에 열면 새 곡
    player.stop(); player.pos = 0; audio(); player.play(0); renderTransport();
    toast('새 곡을 만들었어요. 음표를 고쳐 나만의 곡으로 다듬어 보세요');
  };

  /* ---------- 파일·설정 ---------- */
  $('btnMenu').onclick = () => {
    $('mMaster').value = app.song.master; $('mSwing').value = app.song.swing; $('mTheme').value = prefs.theme || '';
    menuOutputs(); $('dlgMenu').showModal();
  };
  function menuOutputs() {
    $('mMasterO').textContent = Math.round(app.song.master * 100) + '%';
    $('mSwingO').textContent = app.song.swing ? Math.round(app.song.swing * 100) + '%' : '없음';
  }
  $('mMaster').oninput = () => { app.song.master = +$('mMaster').value; menuOutputs(); player.update(); if (app.engine) app.engine.master.gain.value = app.song.master; };
  $('mMaster').onchange = () => app.commit('전체 음량');
  $('mSwing').oninput = () => { app.song.swing = +$('mSwing').value; menuOutputs(); };
  $('mSwing').onchange = () => app.commit('스윙');
  $('mTheme').onchange = () => { prefs.theme = $('mTheme').value; applyTheme(); savePrefs(); };
  function applyTheme() {
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme; else delete document.documentElement.dataset.theme;
    roll.readColors();
  }
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => roll.readColors());

  const fname = (ext) => (app.song.title || '곡').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) + '.' + ext;
  async function saveFile(blob, name) {
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare) {
      try {
        const file = new File([blob], name, { type: blob.type });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast(name + ' 저장');
  }
  function busy(on, text) { $('busy').hidden = !on; if (text) $('busyText').textContent = text; }

  const menuActs = {
    new() {
      if (hasContent(app.song) && !confirm('새 곡을 시작할까요? 지금 곡은 「내 곡」에 남아 있어요.')) return;
      loadNewSong(SG.newSong()); $('dlgMenu').close(); toast('새 곡');
    },
    library() { renderLibrary(); $('dlgLib').showModal(); },
    open() { $('fileIn').click(); },
    saveJson() { saveFile(new Blob([JSON.stringify(app.song, null, 1)], { type: 'application/json' }), fname('json')); },
    exportMidi() { saveFile(new Blob([S.midi.exportMidi(app.song)], { type: 'audio/midi' }), fname('mid')); },
    async exportWav(loopOnly) {
      const s = app.song;
      if (!s.tracks.some((t) => t.notes.length)) return toast('음표가 없어요');
      if (loopOnly === true && !s.loop.on) return toast('반복 구간이 꺼져 있어요');
      busy(true, '오디오로 만드는 중…');
      try {
        const buf = await A.render(s, loopOnly === true ? { from: s.loop.start, to: s.loop.end } : {});
        await saveFile(A.encodeWav(buf), fname('wav'));
      } catch (e) { console.error(e); toast('오디오를 만들지 못했어요: ' + e.message); }
      busy(false);
    },
    exportWavLoop() { return menuActs.exportWav(true); },
    async midiIn() {
      if (!navigator.requestMIDIAccess) return toast('이 브라우저는 MIDI 건반을 지원하지 않아요(크롬·엣지에서 가능)');
      try {
        const acc = await navigator.requestMIDIAccess();
        const hook = () => {
          let n = 0;
          acc.inputs.forEach((inp) => { n++; inp.onmidimessage = onMidi; });
          toast(n ? `MIDI 건반 ${n}개 연결됨` : 'MIDI 건반을 찾지 못했어요. 꽂은 뒤 다시 눌러 보세요');
        };
        acc.onstatechange = () => acc.inputs.forEach((inp) => { inp.onmidimessage = onMidi; });
        hook();
      } catch (e) { toast('MIDI 연결을 허락하지 않았어요'); }
    },
    help() { $('dlgHelp').showModal(); },
  };
  function onMidi(ev) {
    const [st, a, b] = ev.data; const k = st & 0xf0;
    let p = a;
    if (app.track.type === 'drums') {
      const map = { 36: 0, 35: 0, 38: 1, 40: 1, 39: 2, 42: 3, 44: 3, 46: 4, 48: 5, 50: 5, 47: 5, 45: 6, 43: 6, 41: 6, 49: 7, 57: 7, 51: 8, 59: 8, 54: 9, 70: 10, 69: 10 };
      p = map[a] != null ? map[a] : (a % 12) % SG.DRUMS.length;
    }
    if (k === 0x90 && b > 0) app.liveOn(p, b / 127);
    else if (k === 0x80 || (k === 0x90 && b === 0)) app.liveOff(p);
  }
  document.querySelector('#dlgMenu .menu-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    menuActs[b.dataset.act]();
  });
  $('fileIn').onchange = async () => {
    const f = $('fileIn').files[0]; $('fileIn').value = '';
    if (!f) return;
    try {
      let song;
      if (/\.midi?$/i.test(f.name)) { song = S.midi.importMidi(new Uint8Array(await f.arrayBuffer())); if (song.title === '불러온 곡') song.title = f.name.replace(/\.midi?$/i, ''); }
      else song = JSON.parse(await f.text());
      loadNewSong(song); $('dlgMenu').close(); toast(`「${app.song.title}」을(를) 열었어요`);
    } catch (e) { console.error(e); toast('열 수 없는 파일이에요: ' + e.message); }
  };
  function renderLibrary() {
    const list = SG.library.list();
    const ul = $('libList');
    if (!list.length) { ul.innerHTML = '<li class="muted">아직 저장된 곡이 없어요. 음표를 넣으면 자동으로 저장됩니다.</li>'; return; }
    ul.innerHTML = list.map((e) => `<li class="${e.id === app.libId ? 'cur' : ''}" data-id="${e.id}"><span class="t"><b>${esc(e.title || '제목 없음')}</b><small>${new Date(e.updated).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })} · ${e.bars || '?'}마디</small></span>
      <button type="button" class="mini" data-a="open">열기</button><button type="button" class="mini danger" data-a="del">지우기</button></li>`).join('');
  }
  $('libList').onclick = (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('li').dataset.id;
    if (b.dataset.a === 'open') {
      const s = SG.library.load(id); if (!s) return;
      loadNewSong(s, id); $('dlgLib').close(); $('dlgMenu').close(); toast(`「${s.title}」`);
    } else if (confirm('이 곡을 지울까요? 되돌릴 수 없어요.')) {
      SG.library.remove(id);
      if (id === app.libId) app.libId = 's' + Date.now().toString(36);
      renderLibrary();
    }
  };

  /* ---------- 키보드 ---------- */
  const typing = (el) => el && (el.tagName === 'INPUT' && !['range', 'checkbox'].includes(el.type) || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  document.addEventListener('keydown', (e) => {
    if (typing(e.target)) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod) {
      const c = e.code;
      if (c === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (c === 'KeyY') { e.preventDefault(); redo(); return; }
      if (c === 'KeyA') { e.preventDefault(); cmds.selectAll(); return; }
      if (c === 'KeyC') { e.preventDefault(); cmds.copy(); return; }
      if (c === 'KeyX') { e.preventDefault(); cmds.cut(); return; }
      if (c === 'KeyV') { e.preventDefault(); cmds.paste(); return; }
      if (c === 'KeyD') { e.preventDefault(); cmds.duplicate(); return; }
      if (c === 'KeyS') { e.preventDefault(); autosave(); toast('이 브라우저에 저장했어요'); return; }
      return;
    }
    if (e.altKey) return;
    if (k === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) togglePlay(); return; }
    if (k === 'Home') { e.preventDefault(); $('btnHome').click(); return; }
    if (k === 'Escape') { hidePop(); roll.sel.clear(); onSelection(); roll.requestDraw(); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); cmds.delete(); return; }
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      if (!roll.sel.size) { roll.sy += (k === 'ArrowUp' ? -1 : 1) * roll.rh * 3; roll.clampScroll(); roll.requestDraw(); return; }
      transpose((k === 'ArrowUp' ? 1 : -1) * (e.shiftKey && app.track.type !== 'drums' ? 12 : 1)); return;
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const dt = (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? BAR : app.snapTicks());
      if (!roll.sel.size) { app.seek(Math.max(0, Math.round(player.now() / app.snapTicks()) * app.snapTicks() + dt)); scrollToPos(); return; }
      nudge(dt); return;
    }
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) { setTool(['pen', 'select', 'erase', 'hand'][+e.code.slice(5) - 1]); return; }
    if (!app.ui.typing || e.repeat) { if (e.repeat && keyNote(e) != null) e.preventDefault(); return; }
    if (e.code === 'KeyZ') { setOctave(app.octave - 1); toast('옥타브 ' + app.octave); return; }
    if (e.code === 'KeyX') { setOctave(app.octave + 1); toast('옥타브 ' + app.octave); return; }
    const p = keyNote(e);
    if (p != null) { e.preventDefault(); downKeys.set(e.code, p); app.liveOn(p, 0.8); }
  });
  const downKeys = new Map();
  function keyNote(e) {
    if (app.track.type === 'drums') { const i = DRUM_KEYS.indexOf(e.code); return i < 0 ? null : i; }
    const s = TYPE_KEYS[e.code]; if (s == null) return null;
    return Math.min(127, app.octave * 12 + 12 + s);
  }
  document.addEventListener('keyup', (e) => {
    if (downKeys.has(e.code)) { app.liveOff(downKeys.get(e.code)); downKeys.delete(e.code); }
  });
  window.addEventListener('blur', () => { downKeys.clear(); allLiveOff(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { downKeys.clear(); allLiveOff(); } });

  /* ---------- 알림 ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  app.toast = toast;

  /* ---------- 시작 ---------- */
  paintIcons();
  applyTheme();
  // 대화 상자를 바깥 눌러 닫기
  document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  // 첫 화면을 누르면 소리를 깨운다(브라우저 정책)
  const wake = () => { audio(); window.removeEventListener('pointerdown', wake, true); window.removeEventListener('keydown', wake, true); };
  window.addEventListener('pointerdown', wake, true); window.addEventListener('keydown', wake, true);

  const saved = SG.store.get('studio.current', null);
  if (saved && saved.song) {
    app.libId = saved.id || ('s' + Date.now().toString(36));
    setSong(saved.song);
  } else {
    // 처음 열면 들어 볼 수 있는 예시 곡을 만든다
    const s = SG.newSong();
    s.title = '첫 곡: 팝 스케치';
    CP.generate(s, { genre: 'pop', seed: 2026 });
    app.libId = 's' + Date.now().toString(36);
    app.trackId = (s.tracks.find((t) => t.role === 'melody') || s.tracks[0]).id;
    setSong(s);
    setTimeout(() => toast('▶ 를 눌러 예시 곡을 들어 보세요. 「자동 작곡」으로 새 곡도 만들 수 있어요'), 600);
  }
  roll.fitTrack();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})(globalThis.Studio = globalThis.Studio || {});
