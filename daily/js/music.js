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

  /* ---------- 이퀄라이저 (31밴드 1/3 옥타브) ---------- */
  const EQ_FREQS = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];
  const EQ_Q = 4.32;      // 1/3 옥타브 폭
  const EQ_RANGE = 12;    // ±dB
  const r05 = v => Math.round(v * 2) / 2;
  const fmtF = f => (f >= 1000 ? `${+(f / 1000).toFixed(2)}k` : String(f));
  const fmtDb = v => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');
  function shape(pts) {
    return EQ_FREQS.map(f => {
      if (!pts.length) return 0;
      if (f <= pts[0][0]) return r05(pts[0][1]);
      for (let k = 1; k < pts.length; k++) {
        if (f <= pts[k][0]) {
          const [f0, g0] = pts[k - 1], [f1, g1] = pts[k];
          const t = (Math.log(f) - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
          return r05(g0 + (g1 - g0) * t);
        }
      }
      return r05(pts[pts.length - 1][1]);
    });
  }
  const EQ_PRESETS = {
    flat: { label: '플랫 (원음)', pts: [] },
    bass: { label: '저음 강조', pts: [[20, 6], [60, 6], [150, 3], [400, 0]] },
    treble: { label: '고음 강조', pts: [[2000, 0], [5000, 3], [10000, 6], [20000, 6]] },
    vocal: { label: '보컬 선명', pts: [[80, -3], [250, -1], [1000, 2], [3000, 4], [5000, 2], [10000, -1]] },
    pop: { label: '팝', pts: [[20, -1], [100, 2], [400, 3], [1000, 3], [3000, 1], [10000, -1]] },
    rock: { label: '록', pts: [[20, 4], [100, 4], [400, -2], [1000, -2], [3000, 2], [8000, 4], [16000, 4]] },
    jazz: { label: '재즈', pts: [[20, 3], [100, 3], [500, 0], [2000, -1], [5000, 1], [12000, 3]] },
    classical: { label: '클래식', pts: [[20, 2], [200, 2], [1000, 0], [5000, 0], [10000, 3], [20000, 4]] },
    electronic: { label: '일렉트로닉', pts: [[20, 6], [60, 5], [200, 0], [800, -2], [3000, 1], [8000, 4], [16000, 5]] },
    acoustic: { label: '어쿠스틱', pts: [[20, 2], [100, 3], [400, 1], [2000, 2], [5000, 3], [12000, 2]] },
    quiet: { label: '작게 들을 때', pts: [[20, 5], [100, 4], [400, 0], [1000, -1], [3000, 0], [8000, 3], [16000, 5]] },
    speech: { label: '말소리·팟캐스트', pts: [[20, -12], [80, -9], [150, -3], [300, 0], [1000, 2], [3000, 4], [6000, 1], [10000, -6], [20000, -12]] }
  };
  const E = Object.assign({ on: true, pre: 0, limiter: true, preset: 'flat', custom: [] }, A.data.eq || {});
  if (!Array.isArray(E.gains) || E.gains.length !== EQ_FREQS.length) E.gains = EQ_FREQS.map(() => 0);
  E.gains = E.gains.map(v => A.clamp(r05(Number(v) || 0), -EQ_RANGE, EQ_RANGE));
  E.pre = A.clamp(r05(Number(E.pre) || 0), -EQ_RANGE, EQ_RANGE);
  if (!Array.isArray(E.custom)) E.custom = [];
  const persistEq = A.debounce(() => { A.data.eq = E; A.save('eq'); }, 250);

  // 지정한 주파수에서 전체 이퀄라이저 곡선의 크기(dB). RBJ 피킹 필터 식을 그대로 쓴다.
  function eqResponse(freq, gains) {
    const fs = 48000, w = 2 * Math.PI * freq / fs, c1 = Math.cos(w), c2 = Math.cos(2 * w), s1 = Math.sin(w), s2 = Math.sin(2 * w);
    let db = 0;
    for (let i = 0; i < EQ_FREQS.length; i++) {
      const g = gains[i];
      if (!g) continue;
      const A_ = Math.pow(10, g / 40), w0 = 2 * Math.PI * EQ_FREQS[i] / fs, al = Math.sin(w0) / (2 * EQ_Q), cw = Math.cos(w0);
      const b0 = 1 + al * A_, b1 = -2 * cw, b2 = 1 - al * A_, a0 = 1 + al / A_, a1 = -2 * cw, a2 = 1 - al / A_;
      const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
      const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
      db += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
    }
    return db;
  }
  function eqPeak() {
    let m = 0;
    for (let k = 0; k <= 240; k++) m = Math.max(m, eqResponse(20 * Math.pow(1000, k / 240), E.gains));
    return m;
  }
  let eqNodes = null;
  function buildEq(c) {
    const pre = c.createGain();
    const filters = EQ_FREQS.map(f => {
      const n = c.createBiquadFilter();
      n.type = 'peaking'; n.frequency.value = f; n.Q.value = EQ_Q; n.gain.value = 0;
      return n;
    });
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -2; comp.knee.value = 0; comp.ratio.value = 20; comp.attack.value = 0.003; comp.release.value = 0.25;
    let last = pre;
    filters.forEach(n => { last.connect(n); last = n; });
    last.connect(comp);
    eqNodes = { pre, filters, comp, out: comp };
    applyEq(true);
    return eqNodes;
  }
  function applyEq(now) {
    if (!eqNodes) return;
    const c = A.Sound.get();
    const t = c ? c.currentTime : 0, tc = now ? 0.001 : 0.02;
    eqNodes.pre.gain.setTargetAtTime(Math.pow(10, (E.on ? E.pre : 0) / 20), t, tc);
    eqNodes.filters.forEach((n, i) => n.gain.setTargetAtTime(E.on ? E.gains[i] : 0, t, tc));
    eqNodes.comp.ratio.setTargetAtTime(E.limiter ? 20 : 1, t, tc);
    eqNodes.comp.threshold.setTargetAtTime(E.limiter ? -2 : 0, t, tc);
  }

  function ensureGraph() {
    if (srcNode) return;
    const c = A.Sound.get();
    if (!c) return;
    try {
      srcNode = c.createMediaElementSource(audio);
      analyser = c.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      const q = buildEq(c);
      srcNode.connect(q.pre);
      q.out.connect(analyser);
      analyser.connect(c.destination);
    } catch (e) { srcNode = null; analyser = null; eqNodes = null; }
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
          <section class="panel eq" id="mu-eq"></section>
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

      /* ----- 이퀄라이저 화면 ----- */
      const eqBox = $('#mu-eq');
      const eqBands = i => (i < 0 ? E.pre : E.gains[i]);
      eqBox.innerHTML = `
        <div class="panel-head">
          <h2 class="panel-title">이퀄라이저 · 31밴드</h2>
          <div class="eq-switches">
            <span class="eq-sw"><button type="button" class="switch" role="switch" id="eq-on" aria-checked="${E.on}" aria-label="이퀄라이저 켜기"></button><label for="eq-on">${'켜기'}</label></span>
            <span class="eq-sw"><button type="button" class="switch" role="switch" id="eq-lim" aria-checked="${E.limiter}" aria-label="소리 찢김 방지"></button><label for="eq-lim">소리 찢김 방지</label></span>
          </div>
        </div>
        <div class="eq-tools">
          <select class="input" id="eq-preset" aria-label="프리셋"></select>
          <button type="button" class="btn sm" data-eq="auto" title="가장 크게 올린 부분만큼 전체 음량을 낮춰 소리가 깨지지 않게 해요">자동 음량 보정</button>
          <button type="button" class="btn sm" data-eq="save">내 프리셋으로 저장</button>
          <button type="button" class="btn sm danger-text" data-eq="del" hidden>프리셋 삭제</button>
          <button type="button" class="btn sm ghost" data-eq="reset">모두 0으로</button>
        </div>
        <canvas class="eq-curve" id="eq-curve" aria-hidden="true"></canvas>
        <div class="eq-strip" id="eq-strip">
          ${[-1, ...EQ_FREQS.keys()].map(i => `
            <div class="eq-col ${i < 0 ? 'pre' : ''}" data-i="${i}" role="slider" tabindex="0" aria-orientation="vertical" aria-valuemin="${-EQ_RANGE}" aria-valuemax="${EQ_RANGE}" aria-label="${i < 0 ? '프리앰프(전체 음량)' : fmtF(EQ_FREQS[i]) + ' 헤르츠'}">
              <span class="eq-val"></span>
              <div class="eq-track"><div class="eq-fill"></div><div class="eq-thumb"></div></div>
              <span class="eq-f">${i < 0 ? '전체' : fmtF(EQ_FREQS[i])}</span>
            </div>`).join('')}
        </div>
        <p class="faint eq-hint">밴드 위를 끌어서 올리고 내려요. 가로로 쭉 끌면 곡선을 그릴 수 있어요. 두 번 누르면 0dB, 방향키는 0.5dB씩(Shift는 3dB씩) 움직여요. 음악 재생에만 적용돼요.</p>`;
      const strip = eqBox.querySelector('#eq-strip');
      const cols = [...strip.querySelectorAll('.eq-col')];
      const colOf = i => cols[i + 1];

      function syncBand(i) {
        const v = eqBands(i), col = colOf(i);
        const pct = (0.5 - v / (2 * EQ_RANGE)) * 100;
        const th = col.querySelector('.eq-thumb'), fl = col.querySelector('.eq-fill');
        th.style.top = pct + '%';
        fl.style.top = Math.min(pct, 50) + '%';
        fl.style.height = Math.abs(pct - 50) + '%';
        col.querySelector('.eq-val').textContent = fmtDb(v);
        col.setAttribute('aria-valuenow', v);
        col.setAttribute('aria-valuetext', `${v} 데시벨`);
        col.classList.toggle('boost', v > 0);
        col.classList.toggle('cut', v < 0);
      }
      function syncAll() {
        for (let i = -1; i < EQ_FREQS.length; i++) syncBand(i);
        eqBox.querySelector('#eq-on').setAttribute('aria-checked', E.on);
        eqBox.querySelector('#eq-lim').setAttribute('aria-checked', E.limiter);
        eqBox.classList.toggle('off', !E.on);
        drawPresetSelect();
        drawCurve();
      }
      function drawPresetSelect() {
        const sel = eqBox.querySelector('#eq-preset');
        sel.innerHTML = `${E.preset === 'custom' ? '<option value="custom" selected>직접 조정</option>' : ''}
          <optgroup label="기본 프리셋">${Object.entries(EQ_PRESETS).map(([k, v]) => `<option value="${k}" ${E.preset === k ? 'selected' : ''}>${v.label}</option>`).join('')}</optgroup>
          ${E.custom.length ? `<optgroup label="내 프리셋">${E.custom.map(c => `<option value="c:${c.id}" ${E.preset === 'c:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}`;
        eqBox.querySelector('[data-eq="del"]').hidden = !E.preset.startsWith('c:');
      }
      function setBand(i, v, keepPreset) {
        v = A.clamp(r05(v), -EQ_RANGE, EQ_RANGE);
        if (eqBands(i) === v) return;
        if (i < 0) E.pre = v; else E.gains[i] = v;
        if (!keepPreset && i >= 0 && E.preset !== 'custom') { E.preset = 'custom'; drawPresetSelect(); }
        syncBand(i);
        applyEq();
        drawCurve();
        persistEq();
      }
      function loadPreset(id) {
        if (id.startsWith('c:')) {
          const c = E.custom.find(x => 'c:' + x.id === id);
          if (!c) return;
          E.gains = c.gains.slice(); E.pre = c.pre || 0;
        } else if (EQ_PRESETS[id]) { E.gains = shape(EQ_PRESETS[id].pts); E.pre = 0; }
        else return;
        E.preset = id;
        applyEq(); syncAll(); persistEq();
      }

      // 끌어서 조절
      let drag = null;
      function pointAt(e) {
        if (!drag) return;
        const hit = drag.rects.find(c => e.clientX >= c.l && e.clientX < c.r);
        if (!hit) return;
        if (drag.pre !== (hit.i < 0)) return;
        const f = A.clamp((e.clientY - hit.t) / hit.h, 0, 1);
        setBand(hit.i, (0.5 - f) * 2 * EQ_RANGE);
      }
      strip.addEventListener('pointerdown', e => {
        const tr = e.target.closest('.eq-track');
        if (!tr) return;
        const rects = cols.map(c => { const a = c.getBoundingClientRect(), t = c.querySelector('.eq-track').getBoundingClientRect(); return { i: Number(c.dataset.i), l: a.left, r: a.right, t: t.top, h: t.height }; });
        drag = { rects, pre: tr.parentElement.dataset.i === '-1' };
        try { strip.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        if (e.pointerType === 'mouse') e.preventDefault();
        pointAt(e);
      });
      strip.addEventListener('pointermove', pointAt);
      const endDrag = () => { drag = null; };
      strip.addEventListener('pointerup', endDrag);
      strip.addEventListener('pointercancel', endDrag);
      strip.addEventListener('dblclick', e => {
        const col = e.target.closest('.eq-col');
        if (col) setBand(Number(col.dataset.i), 0);
      });
      strip.addEventListener('keydown', e => {
        const col = e.target.closest('.eq-col');
        if (!col) return;
        const i = Number(col.dataset.i), v = eqBands(i);
        const step = e.shiftKey ? 3 : 0.5;
        const key = e.key;
        let nv = null;
        if (key === 'ArrowUp' || key === 'ArrowRight') nv = v + step;
        else if (key === 'ArrowDown' || key === 'ArrowLeft') nv = v - step;
        else if (key === 'PageUp') nv = v + 3;
        else if (key === 'PageDown') nv = v - 3;
        else if (key === 'Home') nv = 0;
        if (nv == null) return;
        e.preventDefault();
        setBand(i, nv);
      });

      eqBox.addEventListener('click', async e => {
        const sw = e.target.closest('.switch');
        if (sw) {
          if (sw.id === 'eq-on') E.on = !E.on; else if (sw.id === 'eq-lim') E.limiter = !E.limiter; else return;
          applyEq(); syncAll(); persistEq();
          return;
        }
        const b = e.target.closest('[data-eq]');
        if (!b) return;
        const act = b.dataset.eq;
        if (act === 'reset') {
          E.gains = EQ_FREQS.map(() => 0); E.pre = 0; E.preset = 'flat';
          applyEq(); syncAll(); persistEq();
        } else if (act === 'auto') {
          const peak = eqPeak();
          E.pre = A.clamp(-Math.ceil(peak * 2) / 2, -EQ_RANGE, 0);
          applyEq(); syncAll(); persistEq();
          A.toast(peak > 0.2 ? `가장 크게 올린 부분이 +${peak.toFixed(1)}dB라서 전체 음량을 ${E.pre}dB 낮췄어요` : '올린 부분이 없어서 보정할 게 없어요');
        } else if (act === 'save') {
          A.modal({
            title: '내 프리셋으로 저장',
            body: '<label class="field"><span>이름</span><input class="input" id="eq-name" maxlength="20" placeholder="예: 이어폰용" autocomplete="off"></label>',
            actions: [{ label: '취소', kind: 'ghost' }, {
              label: '저장', kind: 'primary',
              onClick: api => {
                const name = api.el.querySelector('#eq-name').value.trim();
                if (!name) { A.toast('이름을 입력해 주세요'); return false; }
                const same = E.custom.find(c => c.name === name);
                const rec = same || { id: A.uid(), name };
                rec.gains = E.gains.slice(); rec.pre = E.pre;
                if (!same) E.custom.push(rec);
                E.preset = 'c:' + rec.id;
                syncAll(); persistEq();
                A.toast(`"${name}" 프리셋을 저장했어요`);
              }
            }],
            onMount(box) {
              const inp = box.querySelector('#eq-name');
              inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') box.querySelector('.modal-foot .btn.primary').click(); });
            }
          });
        } else if (act === 'del') {
          const c = E.custom.find(x => 'c:' + x.id === E.preset);
          if (!c) return;
          const ok = await A.confirm(`"${c.name}" 프리셋을 지울까요?`, { title: '프리셋 삭제', ok: '지우기', danger: true });
          if (!ok) return;
          E.custom = E.custom.filter(x => x !== c);
          E.preset = 'custom';
          syncAll(); persistEq();
        }
      });
      eqBox.addEventListener('change', e => { if (e.target.id === 'eq-preset') loadPreset(e.target.value); });

      // 주파수 응답 곡선 + 실시간 스펙트럼
      let eqRaf = 0, eqBuf = null;
      function drawCurve() {
        const cv = eqBox.querySelector('#eq-curve');
        if (!cv || !cv.isConnected) return;
        const g = cv.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth, h = cv.clientHeight;
        if (!w || !h) return;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        const css = getComputedStyle(document.documentElement);
        const accent = css.getPropertyValue('--accent').trim() || '#D97757';
        const line = css.getPropertyValue('--line').trim() || '#3A3936';
        const ink3 = css.getPropertyValue('--ink-3').trim() || '#7F7D76';
        const L = 34, R = 10, T = 10, B = 20, pw = w - L - R, ph = h - T - B, VIEW = 15;
        const X = f => L + (Math.log(f / 20) / Math.log(1000)) * pw;
        const Y = db => T + (0.5 - A.clamp(db, -VIEW, VIEW) / (2 * VIEW)) * ph;
        g.font = '10px "IBM Plex Mono", monospace';
        g.textBaseline = 'middle';
        g.lineWidth = 1;
        [-12, -6, 0, 6, 12].forEach(db => {
          g.strokeStyle = line; g.globalAlpha = db === 0 ? 1 : 0.55;
          g.beginPath(); g.moveTo(L, Math.round(Y(db)) + 0.5); g.lineTo(L + pw, Math.round(Y(db)) + 0.5); g.stroke();
          g.globalAlpha = 1; g.fillStyle = ink3; g.textAlign = 'right';
          g.fillText(db > 0 ? '+' + db : db < 0 ? '−' + Math.abs(db) : '0', L - 6, Y(db));
        });
        g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        [[20, '20'], [50, '50'], [100, '100'], [200, '200'], [500, '500'], [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k'], [20000, '20k']].forEach(([f, t]) => {
          g.strokeStyle = line; g.globalAlpha = 0.55;
          g.beginPath(); g.moveTo(Math.round(X(f)) + 0.5, T); g.lineTo(Math.round(X(f)) + 0.5, T + ph); g.stroke();
          g.globalAlpha = 1; g.fillStyle = ink3;
          g.fillText(t, A.clamp(X(f), L + 8, L + pw - 8), h - 5);
        });
        // 실시간 스펙트럼 (이퀄라이저를 지난 뒤의 소리)
        const live = analyser && !audio.paused;
        if (live) {
          if (!eqBuf || eqBuf.length !== analyser.frequencyBinCount) eqBuf = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(eqBuf);
          const sr = (A.Sound.get() || { sampleRate: 44100 }).sampleRate, hz = sr / analyser.fftSize;
          g.beginPath(); g.moveTo(L, T + ph);
          for (let x = 0; x <= pw; x += 2) {
            const f0 = 20 * Math.pow(1000, x / pw), f1 = 20 * Math.pow(1000, (x + 2) / pw);
            let a = Math.max(1, Math.floor(f0 / hz)), b = Math.max(a, Math.ceil(f1 / hz)), m = 0;
            for (let k = a; k <= b && k < eqBuf.length; k++) m = Math.max(m, eqBuf[k]);
            g.lineTo(L + x, T + ph - (m / 255) * ph * 0.92);
          }
          g.lineTo(L + pw, T + ph); g.closePath();
          g.fillStyle = ink3; g.globalAlpha = 0.28; g.fill(); g.globalAlpha = 1;
        }
        // 곡선
        const on = E.on;
        const pts = [];
        for (let x = 0; x <= pw; x += 2) pts.push([L + x, Y(on ? eqResponse(20 * Math.pow(1000, x / pw), E.gains) : 0)]);
        g.beginPath(); g.moveTo(pts[0][0], Y(0));
        pts.forEach(p => g.lineTo(p[0], p[1]));
        g.lineTo(pts[pts.length - 1][0], Y(0)); g.closePath();
        g.fillStyle = accent; g.globalAlpha = on ? 0.16 : 0.05; g.fill(); g.globalAlpha = 1;
        g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.strokeStyle = on ? accent : ink3; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
        if (on) {
          g.fillStyle = accent;
          EQ_FREQS.forEach((f, i) => {
            if (!E.gains[i]) return;
            g.beginPath(); g.arc(X(f), Y(eqResponse(f, E.gains)), 2.5, 0, Math.PI * 2); g.fill();
          });
        }
      }
      function kickEq() {
        cancelAnimationFrame(eqRaf);
        const loop = () => {
          if (!eqBox.isConnected) return;
          drawCurve();
          if (!audio.paused) eqRaf = requestAnimationFrame(loop);
        };
        loop();
      }
      const onResize = () => drawCurve();
      window.addEventListener('resize', onResize);
      syncAll();
      kickEq();
      draw();
      const off = A.on('music:change', () => { draw(); kickEq(); });
      return () => { off(); cancelAnimationFrame(raf); cancelAnimationFrame(eqRaf); window.removeEventListener('resize', onResize); audio.removeEventListener('timeupdate', onTime); };
    }
  });

  loadTracks();
})();
