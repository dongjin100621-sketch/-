'use strict';
/* 음악: 기기의 음악 파일 재생(IndexedDB에 보관), 셔플·반복, 시각화, 미니 플레이어, 집중 사운드(빗소리·파도·모닥불·백색소음) */
(function () {
  const A = App;
  const { esc, icon } = A;

  /* ---------- IndexedDB ---------- */
  const DB = (function () {
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open('haru-desk', 1);
          req.onupgradeneeded = () => { req.result.createObjectStore('tracks', { keyPath: 'id' }); };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (e) { reject(e); }
      });
      return dbp;
    }
    async function tx(mode, fn) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction('tracks', mode);
        const store = t.objectStore('tracks');
        const r = fn(store);
        t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
    }
    return {
      all: () => tx('readonly', s => s.getAll()),
      put: rec => tx('readwrite', s => s.put(rec)),
      del: id => tx('readwrite', s => s.delete(id)),
      clear: () => tx('readwrite', s => s.clear())
    };
  })();

  /* ---------- 플레이어 상태 ---------- */
  const saved = A.data.player || {};
  const P = {
    tracks: [],
    index: -1,
    shuffle: !!saved.shuffle,
    repeat: saved.repeat || 'all',
    volume: typeof saved.volume === 'number' ? saved.volume : 0.8,
    loaded: false,
    persistent: true
  };
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = P.volume;
  let objectUrl = null;
  let analyser = null, srcNode = null;

  function persistPrefs() {
    A.data.player = { shuffle: P.shuffle, repeat: P.repeat, volume: P.volume, order: P.tracks.map(t => t.id), last: P.tracks[P.index] ? P.tracks[P.index].id : null };
    A.save('player');
  }
  const changed = () => A.emit('music:change');

  async function loadTracks() {
    try {
      const recs = await DB.all();
      const order = (A.data.player && A.data.player.order) || [];
      recs.sort((a, b) => {
        const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
        return a.added - b.added;
      });
      P.tracks = recs;
      const last = A.data.player && A.data.player.last;
      const li = P.tracks.findIndex(t => t.id === last);
      if (li >= 0) { P.index = li; setSource(li); }
    } catch (e) {
      P.persistent = false;
    }
    P.loaded = true;
    changed();
  }

  function ensureGraph() {
    if (srcNode) return;
    const c = A.Sound.get();
    if (!c) return;
    try {
      srcNode = c.createMediaElementSource(audio);
      analyser = c.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      srcNode.connect(analyser);
      analyser.connect(c.destination);
    } catch (e) { srcNode = null; analyser = null; }
  }
  function setSource(i) {
    const t = P.tracks[i];
    if (!t) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(t.blob);
    audio.src = objectUrl;
    P.index = i;
    updateMediaSession();
  }
  function play(i) {
    if (!P.tracks.length) return;
    if (i != null && i !== P.index) setSource(i);
    else if (P.index < 0) setSource(0);
    ensureGraph();
    const c = A.Sound.get();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    audio.play().catch(err => {
      if (err && err.name === 'NotAllowedError') A.toast('재생 버튼을 한 번 더 눌러 주세요');
      else A.toast('이 파일은 재생할 수 없어요. 다른 형식(mp3, m4a)으로 시도해 보세요.');
    });
    persistPrefs();
    changed();
  }
  function pause() { audio.pause(); }
  function toggle() { if (audio.paused) play(); else pause(); }
  function pickNext(auto) {
    const n = P.tracks.length;
    if (!n) return -1;
    if (P.shuffle && n > 1) {
      let j;
      do { j = Math.floor(Math.random() * n); } while (j === P.index);
      return j;
    }
    if (P.index + 1 < n) return P.index + 1;
    return auto && P.repeat === 'off' ? -1 : 0;
  }
  function next(auto) {
    const j = pickNext(auto);
    if (j < 0) { audio.pause(); audio.currentTime = 0; changed(); return; }
    play(j);
  }
  function prev() {
    if (audio.currentTime > 3 || P.tracks.length < 2) { audio.currentTime = 0; return; }
    play((P.index - 1 + P.tracks.length) % P.tracks.length);
  }
  audio.addEventListener('ended', () => {
    if (P.repeat === 'one') { audio.currentTime = 0; play(); }
    else next(true);
  });
  ['play', 'pause'].forEach(ev => audio.addEventListener(ev, () => { changed(); updateMediaSession(); }));
  audio.addEventListener('loadedmetadata', () => {
    const t = P.tracks[P.index];
    if (t && isFinite(audio.duration) && !t.duration) {
      t.duration = audio.duration;
      if (P.persistent) DB.put(t).catch(() => {});
    }
    changed();
  });
  audio.addEventListener('error', () => {
    if (audio.src) A.toast('파일을 열지 못했어요. 지원하지 않는 형식일 수 있어요.');
  });

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const t = P.tracks[P.index];
    try {
      navigator.mediaSession.metadata = t ? new MediaMetadata({ title: t.name, artist: '하루 책상' }) : null;
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('previoustrack', prev);
    } catch (e) { /* 지원 안 함 */ }
  }

  async function addFiles(files) {
    const list = [...files].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i.test(f.name));
    if (!list.length) { A.toast('음악 파일(mp3, m4a, wav 등)을 골라 주세요'); return; }
    let memoryOnly = 0;
    for (const f of list) {
      const rec = { id: A.uid(), name: f.name.replace(/\.[^.]+$/, ''), type: f.type, size: f.size, blob: f, added: Date.now(), duration: 0 };
      if (P.persistent) {
        try { await DB.put(rec); } catch (e) { memoryOnly++; }
      } else memoryOnly++;
      P.tracks.push(rec);
    }
    persistPrefs();
    changed();
    A.toast(memoryOnly
      ? `${list.length}곡을 추가했어요. ${memoryOnly}곡은 저장 공간이 부족해 이번에만 재생돼요.`
      : `${list.length}곡을 추가했어요`);
    if (P.index < 0) setSource(0);
  }
  async function removeTrack(id) {
    const i = P.tracks.findIndex(t => t.id === id);
    if (i < 0) return;
    const wasCurrent = i === P.index;
    const wasPlaying = wasCurrent && !audio.paused;
    P.tracks.splice(i, 1);
    if (P.persistent) DB.del(id).catch(() => {});
    if (wasCurrent) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      P.index = -1;
      if (P.tracks.length) {
        const j = Math.min(i, P.tracks.length - 1);
        if (wasPlaying) play(j); else setSource(j);
      }
    } else if (i < P.index) P.index--;
    persistPrefs();
    changed();
  }
  async function clearAll() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    P.tracks = [];
    P.index = -1;
    try { await DB.clear(); } catch (e) { /* noop */ }
    persistPrefs();
    changed();
  }

  /* ---------- 샘플 곡 (브라우저에서 바로 만든 짧은 연주) ---------- */
  async function makeSample() {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) { A.toast('이 브라우저에서는 샘플 곡을 만들 수 없어요'); return; }
    const sr = 22050, bpm = 82, beat = 60 / bpm, bars = 16, len = bars * 4 * beat + 2;
    const ctx = new OAC(1, Math.ceil(sr * len), sr);
    const master = ctx.createGain(); master.gain.value = 0.55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    master.connect(lp); lp.connect(ctx.destination);
    const f = n => 440 * Math.pow(2, (n - 69) / 12);
    const note = (midi, t, d, type, g) => {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = type; o.frequency.value = f(midi);
      v.gain.setValueAtTime(0.0001, t);
      v.gain.exponentialRampToValueAtTime(g, t + 0.03);
      v.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(v); v.connect(master);
      o.start(t); o.stop(t + d + 0.05);
    };
    // Fmaj7 - Em7 - Dm7 - Cmaj7 진행
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
    const melody = [72, 69, 67, 69, 72, 74, 72, 69, 71, 67, 64, 67, 69, 71, 72, 67];
    const noise = ctx.createBuffer(1, sr * 0.2, sr);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 6);
    for (let bar = 0; bar < bars; bar++) {
      const t0 = 0.3 + bar * 4 * beat;
      const ch = chords[bar % 4];
      ch.forEach(n => note(n, t0, 4 * beat, 'triangle', 0.05));
      note(ch[0] - 12, t0, 2 * beat, 'sine', 0.22);
      note(ch[0] - 12, t0 + 2.5 * beat, 1.4 * beat, 'sine', 0.16);
      if (bar >= 2) {
        for (let k = 0; k < 4; k++) {
          const mi = melody[(bar * 4 + k) % melody.length] + (bar >= 10 ? 12 : 0);
          if ((bar + k) % 3 !== 2) note(mi, t0 + k * beat + (k % 2 ? beat * 0.5 : 0), beat * 0.9, 'sine', 0.08);
        }
      }
      for (let k = 0; k < 4; k++) {
        const tb = t0 + k * beat;
        if (k === 0 || k === 2) {
          const o = ctx.createOscillator(), v = ctx.createGain();
          o.frequency.setValueAtTime(110, tb); o.frequency.exponentialRampToValueAtTime(40, tb + 0.15);
          v.gain.setValueAtTime(0.5, tb); v.gain.exponentialRampToValueAtTime(0.0001, tb + 0.25);
          o.connect(v); v.connect(master); o.start(tb); o.stop(tb + 0.3);
        }
        [0, 0.5].forEach(off => {
          const s = ctx.createBufferSource(); s.buffer = noise;
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
          const v = ctx.createGain(); v.gain.value = off ? 0.05 : 0.09;
          s.connect(hp); hp.connect(v); v.connect(master); s.start(tb + off * beat);
        });
      }
    }
    const buf = await ctx.startRendering();
    const blob = encodeWav(buf);
    const file = new File([blob], '샘플 · 저녁 산책.wav', { type: 'audio/wav' });
    await addFiles([file]);
  }
  function encodeWav(buf) {
    const ch = buf.getChannelData(0), n = ch.length, sr = buf.sampleRate;
    const ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  /* ---------- 집중 사운드 ---------- */
  const Amb = (function () {
    const st = Object.assign({ rain: 0.6, wave: 0.6, fire: 0.6, white: 0.4 }, (A.data.ambient && A.data.ambient.vol) || {});
    const running = {};
    let bufs = null;
    function makeBuffers(c) {
      const len = c.sampleRate * 4;
      const mk = () => c.createBuffer(1, len, c.sampleRate);
      const white = mk(), pink = mk(), brown = mk();
      const w = white.getChannelData(0), p = pink.getChannelData(0), b = brown.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const x = Math.random() * 2 - 1;
        w[i] = x * 0.5;
        b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
        b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
        last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5;
      }
      return { white, pink, brown };
    }
    function loop(c, buf) { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; return s; }
    function filter(c, type, freq, q) { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f; }
    const SOUNDS = {
      rain: {
        label: '빗소리', icon: 'rain',
        build(c, out) {
          const s = loop(c, bufs.pink);
          const hp = filter(c, 'highpass', 400), lp = filter(c, 'lowpass', 7000);
          s.connect(hp); hp.connect(lp); lp.connect(out); s.start();
          const drops = setInterval(() => {
            if (Math.random() > 0.55) return;
            const d = c.createBufferSource(); d.buffer = bufs.white;
            const bp = filter(c, 'bandpass', 2500 + Math.random() * 3000, 8);
            const g = c.createGain(); const t = c.currentTime;
            g.gain.setValueAtTime(0.5 * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            d.connect(bp); bp.connect(g); g.connect(out); d.start(t, Math.random() * 3, 0.06);
          }, 45);
          return () => { s.stop(); clearInterval(drops); };
        }
      },
      wave: {
        label: '파도', icon: 'wave',
        build(c, out) {
          const s = loop(c, bufs.brown);
          const lp = filter(c, 'lowpass', 900);
          const g = c.createGain(); g.gain.value = 0.55;
          const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
          const depth = c.createGain(); depth.gain.value = 0.45;
          lfo.connect(depth); depth.connect(g.gain);
          s.connect(lp); lp.connect(g); g.connect(out); s.start(); lfo.start();
          return () => { s.stop(); lfo.stop(); };
        }
      },
      fire: {
        label: '모닥불', icon: 'habit',
        build(c, out) {
          const s = loop(c, bufs.brown);
          const lp = filter(c, 'lowpass', 500);
          const base = c.createGain(); base.gain.value = 0.7;
          s.connect(lp); lp.connect(base); base.connect(out); s.start();
          const crackle = setInterval(() => {
            if (Math.random() > 0.35) return;
            const n = 1 + Math.floor(Math.random() * 3);
            for (let k = 0; k < n; k++) {
              const d = c.createBufferSource(); d.buffer = bufs.white;
              const hp = filter(c, 'highpass', 1500 + Math.random() * 2500);
              const g = c.createGain(); const t = c.currentTime + k * 0.02 + Math.random() * 0.03;
              g.gain.setValueAtTime(0.25 + Math.random() * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.012 + Math.random() * 0.03);
              d.connect(hp); hp.connect(g); g.connect(out); d.start(t, Math.random() * 3, 0.05);
            }
          }, 70);
          return () => { s.stop(); clearInterval(crackle); };
        }
      },
      white: {
        label: '백색소음', icon: 'noise',
        build(c, out) {
          const s = loop(c, bufs.white);
          const lp = filter(c, 'lowpass', 9000);
          s.connect(lp); lp.connect(out); s.start();
          return () => s.stop();
        }
      }
    };
    function persist() { A.data.ambient = { vol: st }; A.save('ambient'); }
    function start(id) {
      const c = A.Sound.get();
      if (!c || running[id]) return;
      if (!bufs) bufs = makeBuffers(c);
      const out = c.createGain();
      out.gain.setValueAtTime(0.0001, c.currentTime);
      out.gain.exponentialRampToValueAtTime(Math.max(0.0001, st[id]), c.currentTime + 0.8);
      out.connect(c.destination);
      const stop = SOUNDS[id].build(c, out);
      running[id] = { out, stop };
      A.emit('music:change');
    }
    function stop(id) {
      const r = running[id];
      const c = A.Sound.get();
      if (!r || !c) return;
      delete running[id];
      r.out.gain.setTargetAtTime(0.0001, c.currentTime, 0.15);
      setTimeout(() => { try { r.stop(); r.out.disconnect(); } catch (e) { /* noop */ } }, 700);
      A.emit('music:change');
    }
    function setVol(id, v) {
      st[id] = v;
      const r = running[id];
      const c = A.Sound.get();
      if (r && c) r.out.gain.setTargetAtTime(Math.max(0.0001, v), c.currentTime, 0.05);
      persist();
    }
    return { SOUNDS, start, stop, setVol, vol: id => st[id], on: id => !!running[id], any: () => Object.keys(running).length > 0, stopAll: () => Object.keys(running).forEach(stop) };
  })();

  A.music = { P, audio, play, pause, toggle, next, prev, Amb, clearAll, DB };

  /* ---------- 미니 플레이어 ---------- */
  function drawMini() {
    const box = document.getElementById('mini');
    if (!box) return;
    const t = P.tracks[P.index];
    const show = (t && (!audio.paused || audio.currentTime > 0)) || Amb.any();
    if (!show || A.current() === 'music') { box.hidden = true; return; }
    box.hidden = false;
    const ambNames = Object.keys(Amb.SOUNDS).filter(Amb.on).map(id => Amb.SOUNDS[id].label);
    box.innerHTML = `
      <a class="mini-info" href="#music">
        ${icon('music', 20)}
        <span style="min-width:0;display:grid">
          <span class="mini-title ellipsis">${t && (!audio.paused || audio.currentTime > 0) ? esc(t.name) : '집중 사운드'}</span>
          <span class="mini-sub ellipsis">${ambNames.length ? esc(ambNames.join(' · ')) + ' 재생 중' : audio.paused ? '일시정지됨' : '재생 중'}</span>
        </span>
      </a>
      ${t && (!audio.paused || audio.currentTime > 0) ? `
        <button type="button" class="icon-btn" data-mini="toggle" aria-label="${audio.paused ? '재생' : '일시정지'}">${icon(audio.paused ? 'play' : 'pause', 20)}</button>
        <button type="button" class="icon-btn" data-mini="next" aria-label="다음 곡">${icon('next', 20)}</button>` : ''}
      ${ambNames.length ? `<button type="button" class="icon-btn" data-mini="amb-off" aria-label="집중 사운드 끄기">${icon('x', 18)}</button>` : ''}
      <span class="mini-prog"><i id="mini-prog"></i></span>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mini]');
    if (!b) return;
    const act = b.dataset.mini;
    if (act === 'toggle') toggle();
    else if (act === 'next') next();
    else if (act === 'amb-off') Amb.stopAll();
  });
  audio.addEventListener('timeupdate', () => {
    const bar = document.getElementById('mini-prog');
    if (bar && audio.duration) bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });
  A.on('music:change', drawMini);
  A.on('route', drawMini);

  /* ---------- 화면 ---------- */
  const fmtT = s => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${A.pad(Math.floor(s % 60))}` : '0:00');
  A.register({
    id: 'music', label: '음악', icon: 'music',
    render(el) {
      el.innerHTML = `
        <div class="page">
          <div class="page-head">
            <div><h1>음악</h1><p class="sub">내 기기의 음악 파일을 넣어 들어요. 파일은 이 브라우저 안에만 보관돼요.</p></div>
            <div class="head-actions">
              <label class="btn primary" for="mu-file">${icon('upload', 18)} 음악 파일 추가</label>
              <input type="file" id="mu-file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus" multiple hidden>
            </div>
          </div>
          <div class="player">
            <section class="panel now" id="mu-now"></section>
            <section class="panel" id="mu-list"></section>
          </div>
          <section class="panel">
            <div class="panel-head"><h2 class="panel-title">집중 사운드</h2><span class="faint" style="font-size:13px">여러 개를 섞어 켤 수 있어요</span></div>
            <div class="amb-grid" id="mu-amb"></div>
          </section>
        </div>`;
      const $ = s => el.querySelector(s);
      let raf = 0;

      function drawNow() {
        const t = P.tracks[P.index];
        const playing = !audio.paused;
        $('#mu-now').innerHTML = `
          <canvas class="viz" id="mu-viz" aria-hidden="true"></canvas>
          <div>
            <p class="now-title ellipsis">${t ? esc(t.name) : '재생할 곡을 골라 주세요'}</p>
            <p class="now-sub">${t ? `${P.index + 1} / ${P.tracks.length}곡` : P.loaded ? '오른쪽 목록에서 곡을 누르면 재생돼요' : '보관한 곡을 불러오는 중…'}</p>
          </div>
          <div class="seek">
            <input type="range" id="mu-seek" min="0" max="1000" value="${audio.duration ? Math.round(audio.currentTime / audio.duration * 1000) : 0}" aria-label="재생 위치" ${t ? '' : 'disabled'}>
            <div class="seek-times"><span id="mu-cur">${fmtT(audio.currentTime)}</span><span id="mu-dur">${fmtT(audio.duration)}</span></div>
          </div>
          <div class="transport">
            <button type="button" class="icon-btn ${P.shuffle ? 'on' : ''}" data-act="shuffle" aria-pressed="${P.shuffle}" aria-label="셔플" title="셔플">${icon('shuffle', 20)}</button>
            <button type="button" class="icon-btn" data-act="prev" aria-label="이전 곡" title="이전 곡">${icon('prev', 22)}</button>
            <button type="button" class="play" data-act="toggle" aria-label="${playing ? '일시정지' : '재생'}" ${P.tracks.length ? '' : 'disabled'}>${icon(playing ? 'pause' : 'play', 28)}</button>
            <button type="button" class="icon-btn" data-act="next" aria-label="다음 곡" title="다음 곡">${icon('next', 22)}</button>
            <button type="button" class="icon-btn ${P.repeat !== 'off' ? 'on' : ''} ${P.repeat === 'one' ? 'repeat-one' : ''}" data-act="repeat" aria-label="반복: ${{ off: '끔', all: '전체', one: '한 곡' }[P.repeat]}" title="반복: ${{ off: '끔', all: '전체', one: '한 곡' }[P.repeat]}">${icon('repeat', 20)}</button>
          </div>
          <div class="vol">${icon('volume', 18)}<input type="range" id="mu-vol" min="0" max="100" value="${Math.round(P.volume * 100)}" aria-label="음량"></div>`;
        startViz();
      }
      function drawList() {
        const box = $('#mu-list');
        if (!P.tracks.length) {
          box.innerHTML = `
            <div class="panel-head"><h2 class="panel-title">재생 목록</h2></div>
            <div class="empty">
              ${icon('music', 32)}
              <p>아직 곡이 없어요.<br><span class="faint">mp3, m4a, wav 같은 파일을 추가하거나, 이 화면으로 끌어다 놓으세요.</span></p>
              <div class="head-actions" style="justify-content:center">
                <label class="btn primary" for="mu-file">${icon('upload', 18)} 파일 고르기</label>
                <button type="button" class="btn" data-act="sample">${icon('sparkle', 18)} 샘플 곡 만들기</button>
              </div>
              ${P.persistent ? '' : '<p class="faint" style="font-size:13px">이 브라우저에서는 곡을 보관할 수 없어 새로고침하면 목록이 비워져요.</p>'}
            </div>`;
          return;
        }
        box.innerHTML = `
          <div class="panel-head"><h2 class="panel-title">재생 목록 · ${P.tracks.length}곡</h2><button type="button" class="btn sm ghost" data-act="clear">모두 빼기</button></div>
          <ul class="tracks">${P.tracks.map((t, i) => `
            <li class="track ${i === P.index ? 'cur' : ''}" data-play="${i}">
              <span class="track-idx">${i === P.index && !audio.paused ? icon('volume', 14) : i + 1}</span>
              <span class="track-name ellipsis">${esc(t.name)}</span>
              <span class="track-dur">${t.duration ? fmtT(t.duration) : ''}</span>
              <button type="button" class="icon-btn danger" data-remove="${t.id}" aria-label="${esc(t.name)} 빼기" title="목록에서 빼기">${icon('x', 16)}</button>
            </li>`).join('')}</ul>
          <div class="drop-hint" id="mu-drop">파일을 여기로 끌어다 놓아도 추가돼요</div>`;
      }
      function drawAmb() {
        $('#mu-amb').innerHTML = Object.entries(Amb.SOUNDS).map(([id, s]) => `
          <div class="amb ${Amb.on(id) ? 'on' : ''}">
            <div class="amb-top">
              <span class="amb-name">${icon(s.icon, 20)}${s.label}</span>
              <button type="button" class="switch" role="switch" aria-checked="${Amb.on(id)}" data-amb="${id}" aria-label="${s.label} 켜기"></button>
            </div>
            <input type="range" min="0" max="100" value="${Math.round(Amb.vol(id) * 100)}" data-amb-vol="${id}" aria-label="${s.label} 음량">
          </div>`).join('');
      }
      function startViz() {
        cancelAnimationFrame(raf);
        const cv = $('#mu-viz');
        if (!cv) return;
        const g = cv.getContext('2d');
        const css = getComputedStyle(document.documentElement);
        const color = css.getPropertyValue('--accent').trim() || '#D97757';
        const faint = css.getPropertyValue('--line').trim() || '#3A3936';
        const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
        const frame = () => {
          if (!cv.isConnected) return;
          const dpr = window.devicePixelRatio || 1;
          const w = cv.clientWidth, h = cv.clientHeight;
          if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, w, h);
          const bars = 48;
          const gap = 3;
          const bw = (w - gap * (bars - 1)) / bars;
          const live = analyser && !audio.paused;
          if (live) analyser.getByteFrequencyData(data);
          for (let i = 0; i < bars; i++) {
            const v = live ? data[Math.floor(i * (data.length * 0.75) / bars)] / 255 : 0;
            const bh = Math.max(3, v * (h - 16));
            g.fillStyle = live ? color : faint;
            g.globalAlpha = live ? 0.35 + v * 0.65 : 1;
            g.fillRect(i * (bw + gap), (h - bh) / 2, bw, bh);
          }
          g.globalAlpha = 1;
          if (live) raf = requestAnimationFrame(frame);
        };
        frame();
      }
      const draw = () => { drawNow(); drawList(); drawAmb(); };

      el.addEventListener('click', async e => {
        const rm = e.target.closest('[data-remove]');
        if (rm) { e.stopPropagation(); removeTrack(rm.dataset.remove); return; }
        const tr = e.target.closest('[data-play]');
        if (tr) { const i = Number(tr.dataset.play); if (i === P.index) toggle(); else play(i); return; }
        const amb = e.target.closest('[data-amb]');
        if (amb) { const id = amb.dataset.amb; Amb.on(id) ? Amb.stop(id) : Amb.start(id); return; }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'toggle') toggle();
        else if (act === 'next') next();
        else if (act === 'prev') prev();
        else if (act === 'shuffle') { P.shuffle = !P.shuffle; persistPrefs(); drawNow(); A.toast(P.shuffle ? '셔플을 켰어요' : '셔플을 껐어요'); }
        else if (act === 'repeat') {
          P.repeat = { off: 'all', all: 'one', one: 'off' }[P.repeat];
          persistPrefs(); drawNow();
          A.toast({ off: '반복을 껐어요', all: '전체 반복', one: '한 곡 반복' }[P.repeat]);
        } else if (act === 'sample') {
          b.disabled = true;
          b.textContent = '만드는 중…';
          try { await makeSample(); } catch (err) { A.toast('샘플 곡을 만들지 못했어요'); b.disabled = false; }
        } else if (act === 'clear') {
          const ok = await A.confirm(`재생 목록의 ${P.tracks.length}곡을 모두 뺄까요? 기기의 원본 파일은 지워지지 않아요.`, { title: '재생 목록 비우기', ok: '모두 빼기', danger: true });
          if (ok) clearAll();
        }
      });
      el.addEventListener('input', e => {
        if (e.target.id === 'mu-seek' && audio.duration) audio.currentTime = (Number(e.target.value) / 1000) * audio.duration;
        else if (e.target.id === 'mu-vol') { P.volume = Number(e.target.value) / 100; audio.volume = P.volume; persistPrefs(); }
        else if (e.target.dataset.ambVol) Amb.setVol(e.target.dataset.ambVol, Number(e.target.value) / 100);
      });
      el.addEventListener('change', e => {
        if (e.target.id === 'mu-file' && e.target.files.length) { addFiles(e.target.files); e.target.value = ''; }
      });
      // 끌어다 놓기
      let dragDepth = 0;
      el.addEventListener('dragenter', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); dragDepth++; const d = $('#mu-drop'); d && d.classList.add('over'); } });
      el.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
      el.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { const d = $('#mu-drop'); d && d.classList.remove('over'); } });
      el.addEventListener('drop', e => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault(); dragDepth = 0;
        const d = $('#mu-drop'); d && d.classList.remove('over');
        addFiles(e.dataTransfer.files);
      });

      const onTime = () => {
        const s = $('#mu-seek');
        if (s && audio.duration && document.activeElement !== s) s.value = Math.round(audio.currentTime / audio.duration * 1000);
        const c = $('#mu-cur'); if (c) c.textContent = fmtT(audio.currentTime);
        const d = $('#mu-dur'); if (d) d.textContent = fmtT(audio.duration);
      };
      audio.addEventListener('timeupdate', onTime);
      draw();
      const off = A.on('music:change', draw);
      return () => { off(); cancelAnimationFrame(raf); audio.removeEventListener('timeupdate', onTime); };
    }
  });

  loadTracks();
})();
