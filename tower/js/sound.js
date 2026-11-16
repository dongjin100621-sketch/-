'use strict';
/* 음악과 효과음. 음원 파일 없이 Web Audio 로 합성한다.
   (재생 엔진은 같은 저장소의 「심연의 불씨」·「여명의 종」 sound.js 를 바탕으로 했고, 곡은 모두 새로 썼다.)
   악보: 한 칸은 8분음표, '-' 는 앞 음을 늘이고 '.' 는 쉼. '|' 는 마디 구분(무시). */

const SND = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, songGain = null, comp = null, noiseBuf = null;
  const waves = {};
  const settings = { music: 0.55, sfx: 0.8 };
  let current = null, wanted = null, step = 0, nextTime = 0, timer = null;

  const SONGS = {
    title: { bpm: 92, ch: [
      ['p25', 0.13, 'G4 - - - D5 - - - | C5 - B4 - A4 - - - | B4 - - - G5 - - - | F#5 - E5 - D5 - - - | E5 - - - D5 - C5 - | B4 - - - A4 - G4 - | A4 - - - B4 - C5 - | D5 - - - - - . .'],
      ['tri', 0.28, 'G2 - - - D3 - - - | A2 - - - E3 - - - | E2 - - - B2 - - - | D2 - - - A2 - - - | C3 - - - G2 - - - | G2 - - - E2 - - - | C2 - - - D2 - - - | G2 - - - D3 - - -'],
      ['p12', 0.04, 'B3 D4 G4 D4 B3 D4 G4 D4 | C4 E4 A4 E4 C4 E4 A4 E4 | B3 E4 G4 E4 B3 E4 G4 E4 | A3 D4 F#4 D4 A3 D4 F#4 D4 | C4 E4 G4 E4 C4 E4 G4 E4 | B3 D4 G4 D4 C4 E4 G4 E4 | A3 C4 E4 C4 B3 D4 F#4 D4 | B3 D4 G4 D4 B3 D4 G4 .']
    ] },
    t1: { bpm: 120, ch: [
      ['p25', 0.13, 'E5 - G5 - A5 - G5 E5 | D5 - - - C5 - D5 - | E5 - G5 - C6 - B5 A5 | G5 - - - - - . . | A5 - G5 - E5 - D5 - | C5 - D5 - E5 - G5 - | A5 - G5 - E5 - D5 C5 | D5 - - - - - . .'],
      ['tri', 0.3, 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | E2 . B2 . E2 . B2 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | F2 . C3 . G2 . D3 . | G2 . D3 . G2 . B2 .'],
      ['p12', 0.04, 'E4 G4 C5 G4 E4 G4 C5 G4 | D4 G4 B4 G4 D4 G4 B4 G4 | C4 E4 A4 E4 C4 E4 A4 E4 | B3 E4 G4 E4 B3 E4 G4 E4 | A3 C4 F4 C4 A3 C4 F4 C4 | G3 C4 E4 C4 G3 C4 E4 C4 | A3 C4 F4 C4 B3 D4 G4 D4 | B3 D4 G4 D4 B3 D4 G4 D4']
    ], drums: 'k . h . s . h . | k . h k s . h .' },
    t2: { bpm: 108, ch: [
      ['p25', 0.13, 'D5 - D#5 - F#5 - - - | G5 - F#5 - D#5 - D5 - | C5 - D5 - D#5 - D5 - | C5 - A#4 - A4 - - - | D5 - D#5 - F#5 - G5 - | A5 - A#5 - A5 - G5 - | F#5 - D#5 - D5 - C5 - | D5 - - - - - . .'],
      ['tri', 0.3, 'D3 . A3 . D3 . A3 . | D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . | A#2 . F3 . A2 . E3 . | D3 . A3 . D3 . A3 . | D#3 . A#3 . D#3 . A#3 . | C3 . G3 . A2 . E3 . | D3 . A3 . D3 . . .'],
      ['p12', 0.04, 'A4 D5 F#5 D5 A4 D5 F#5 D5 | A4 D5 G5 D5 A4 D5 F#5 D5 | G4 C5 D#5 C5 G4 C5 D#5 C5 | F4 A#4 D5 A#4 E4 A4 C#5 A4']
    ], drums: 'k . . h k . s . | k . . h k . s h' },
    t3: { bpm: 126, ch: [
      ['p50', 0.1, 'E5 - - B4 - - | C5 - - A4 - - | D5 - - B4 - G4 | A4 - - - - - | E5 - - G5 - - | F5 - - D5 - - | E5 - - C5 - B4 | A4 - - - - -'],
      ['tri', 0.28, 'A2 - - E3 - - | F2 - - C3 - - | G2 - - D3 - - | A2 - - E3 - - | C3 - - G3 - - | D3 - - A3 - - | E2 - - B2 - - | A2 - - E3 - -'],
      ['p12', 0.04, '. A4 C5 . A4 C5 | . A4 C5 . F4 A4 | . G4 B4 . G4 D5 | . A4 C5 . E5 C5 | . C5 E5 . G4 C5 | . D5 F5 . A4 D5 | . B4 E5 . G#4 B4 | . A4 C5 . E4 A4']
    ], drums: 'k . . h . . | s . . h . h' },
    t4: { bpm: 140, ch: [
      ['p25', 0.13, 'E5 - E5 - G5 - E5 - | D5 - - - B4 - - - | C5 - C5 - E5 - C5 - | B4 - - - - - . . | E5 - E5 - G5 - A5 - | B5 - A5 - G5 - F#5 - | G5 - F#5 - E5 - D5 - | E5 - - - - - . .'],
      ['tri', 0.32, 'E2 E2 E3 E2 E2 E2 E3 E2 | B1 B1 B2 B1 B1 B1 B2 B1 | C2 C2 C3 C2 C2 C2 C3 C2 | B1 B1 B2 B1 D2 D2 D3 D2 | E2 E2 E3 E2 E2 E2 E3 E2 | G2 G2 G3 G2 A2 A2 A3 A2 | C2 C2 C3 C2 D2 D2 D3 D2 | E2 E2 E3 E2 B1 B1 B2 B1'],
      ['p12', 0.04, 'E4 G4 B4 G4 E4 G4 B4 G4 | D4 F#4 B4 F#4 D4 F#4 B4 F#4 | C4 E4 G4 E4 C4 E4 G4 E4 | B3 D#4 F#4 D#4 B3 D#4 F#4 D#4']
    ], drums: 'k . s . k k s . | k . s k k . s s' },
    t5: { bpm: 100, ch: [
      ['p50', 0.1, 'B4 - - - F#5 - - - | E5 - D5 - C#5 - - - | D5 - - - A5 - - - | G5 - F#5 - E5 - - - | B4 - - - F#5 - - - | G5 - A5 - B5 - - - | A#5 - - - F#5 - - - | B5 - - - - - . .'],
      ['tri', 0.28, 'B1 - - - B2 - - - | G1 - - - G2 - - - | D2 - - - D3 - - - | E2 - - - E3 - - - | B1 - - - B2 - - - | G1 - - - A1 - - - | F#1 - - - F#2 - - - | B1 - - - B2 - - -'],
      ['p12', 0.04, 'B3 D4 F#4 B4 F#4 D4 B3 D4 | G3 B3 D4 G4 D4 B3 G3 B3 | D4 F#4 A4 D5 A4 F#4 D4 F#4 | E4 G4 B4 E5 B4 G4 E4 G4 | B3 D4 F#4 B4 F#4 D4 B3 D4 | G3 B3 D4 G4 A3 C#4 E4 A4 | F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 | B3 D4 F#4 B4 F#4 D4 B3 D4']
    ], drums: 'k . . . h . . . | s . . . h . h .' },
    mid: { bpm: 156, ch: [
      ['p25', 0.15, 'A4 - E5 - A5 - G5 E5 | F5 - E5 - D5 - E5 - | C5 - D5 - E5 - A5 - | G#5 - - - E5 - - - | A5 - G5 - F5 - E5 - | D5 - E5 - F5 - G5 - | E5 - D5 - C5 - B4 - | A4 - - - E4 - G#4 -'],
      ['tri', 0.34, 'A2 A3 A2 A3 A2 A3 A2 A3 | D2 D3 D2 D3 D2 D3 D2 D3 | F2 F3 F2 F3 F2 F3 F2 F3 | E2 E3 E2 E3 E2 E3 E2 E3 | F2 F3 F2 F3 C2 C3 C2 C3 | D2 D3 D2 D3 G2 G3 G2 G3 | A2 A3 A2 A3 E2 E3 E2 E3 | A2 A3 A2 A3 E2 E3 E2 E3'],
      ['p12', 0.05, 'E4 A4 C5 A4 E4 A4 C5 A4 | D4 F4 A4 F4 D4 F4 A4 F4 | C4 F4 A4 F4 C4 F4 A4 F4 | E4 G#4 B4 G#4 E4 G#4 B4 G#4']
    ], drums: 'k . h k s . h . | k k h . s . h s' },
    boss: { bpm: 164, ch: [
      ['p25', 0.16, 'D5 - F5 - A5 - D6 - | C6 - A#5 - A5 - G5 - | F5 - G5 - A5 - F5 - | E5 - - - C#5 - - - | D5 - F5 - A5 - D6 - | E6 - D6 - C6 - A#5 - | A5 - G5 - F5 - E5 - | D5 - - - A4 - C#5 -'],
      ['tri', 0.36, 'D2 D3 D2 D3 D2 D3 D2 D3 | A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 | F2 F3 F2 F3 F2 F3 F2 F3 | A1 A2 A1 A2 A1 A2 A1 A2 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 A#1 A#2 A#1 A#2 | G1 G2 G1 G2 A1 A2 A1 A2 | D2 D3 D2 D3 A1 A2 C#2 C#3'],
      ['p12', 0.05, 'A4 D5 F5 D5 A4 D5 F5 D5 | A#4 D5 F5 D5 A#4 D5 F5 D5 | A4 C5 F5 C5 A4 C5 F5 C5 | A4 C#5 E5 C#5 A4 C#5 E5 C#5']
    ], drums: 'k h s h k k s h | k h s h k s s s' },
    final: { bpm: 176, ch: [
      ['p25', 0.16, 'E5 - - - B5 - - - | C6 - B5 - A5 - G5 - | F#5 - - - B5 - - - | A5 - G5 - F#5 - E5 - | D5 - - - A5 - - - | G5 - F#5 - E5 - D5 - | C5 - D5 - E5 - F#5 - | G5 - F#5 - D#5 - B4 -'],
      ['p50', 0.06, 'B4 - - - E5 - - - | E5 - - - C5 - - - | B4 - - - D#5 - - - | D#5 - - - B4 - - - | A4 - - - D5 - - - | D5 - - - B4 - - - | A4 - - - C5 - - - | B4 - - - F#4 - - -'],
      ['tri', 0.36, 'E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | B1 B2 B1 B2 B1 B2 B1 B2 | B1 B2 B1 B2 B1 B2 B1 B2 | D2 D3 D2 D3 D2 D3 D2 D3 | G1 G2 G1 G2 G1 G2 G1 G2 | A1 A2 A1 A2 A1 A2 A1 A2 | B1 B2 B1 B2 B1 B2 B1 B2'],
      ['p12', 0.04, 'G4 B4 E5 B4 G4 B4 E5 B4 | G4 C5 E5 C5 G4 C5 E5 C5 | F#4 B4 D#5 B4 F#4 B4 D#5 B4 | F#4 B4 D#5 B4 F#4 B4 D#5 B4 | F#4 A4 D5 A4 F#4 A4 D5 A4 | G4 B4 D5 B4 G4 B4 D5 B4 | E4 A4 C5 A4 E4 A4 C5 A4 | F#4 B4 D#5 B4 F#4 B4 D#5 B4']
    ], drums: 'k h s h k h s k | k h s h k k s s' },
    gameover: { bpm: 78, once: true, ch: [
      ['p25', 0.15, 'A4 - G4 - F4 - E4 - D4 - - - E4 - - - A3 - - - - - - - . .'],
      ['tri', 0.3, 'A2 - - - F2 - - - D2 - - - E2 - - - A1 - - - - - - - . .']
    ] },
    ending: { bpm: 88, ch: [
      ['p25', 0.13, 'G4 - C5 - E5 - G5 - | F5 - E5 - D5 - - - | E5 - D5 - C5 - A4 - | G4 - - - - - . . | A4 - C5 - F5 - A5 - | G5 - F5 - E5 - D5 - | C5 - D5 - E5 - D5 - | C5 - - - - - . .'],
      ['tri', 0.28, 'C3 - G3 - C3 - G3 - | G2 - D3 - G2 - D3 - | A2 - E3 - F2 - C3 - | C3 - G3 - G2 - D3 - | F2 - C3 - F2 - C3 - | C3 - G3 - G2 - D3 - | F2 - C3 - G2 - D3 - | C3 - G3 - C4 - - -'],
      ['p12', 0.04, 'E4 G4 C5 G4 E4 G4 C5 G4 | D4 G4 B4 G4 D4 G4 B4 G4 | C4 E4 A4 E4 A3 C4 F4 C4 | E4 G4 C5 G4 D4 G4 B4 G4 | C4 F4 A4 F4 C4 F4 A4 F4 | E4 G4 C5 G4 D4 G4 B4 G4 | C4 F4 A4 F4 D4 G4 B4 G4 | E4 G4 C5 G4 E4 G4 C5 .']
    ] }
  };

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freqOf = (tok) => {
    const m = tok.match(/^([A-G])(#?)(\d)$/);
    if (!m) return null;
    return 440 * Math.pow(2, (12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] ? 1 : 0) - 69) / 12);
  };
  function parse(str) {
    const toks = str.replace(/\|/g, ' ').split(/\s+/).filter(Boolean), ev = [];
    toks.forEach((t, i) => { const f = freqOf(t); if (!f) return; let len = 1; while (toks[i + len] === '-') len++; ev[i] = { f, len }; });
    return { ev, n: toks.length };
  }
  for (const s of Object.values(SONGS)) {
    s.parsed = s.ch.map(([w, v, str]) => ({ w, v, ...parse(str) }));
    if (s.drums) s.dr = s.drums.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
    s.len = Math.max(...s.parsed.map(c => c.n), s.dr ? s.dr.length : 0);
  }
  function pulse(duty) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI); im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI); }
    return ac.createPeriodicWave(re, im);
  }
  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
      sfxBus = ac.createGain(); sfxBus.connect(comp);
      musicBus = ac.createGain(); musicBus.connect(comp);
      applyVolume();
      waves.p12 = pulse(0.125); waves.p25 = pulse(0.25); waves.p50 = pulse(0.5);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      timer = setInterval(tick, 40);
      document.body.classList.add('audio-on');
    }
    if (ac.state === 'suspended') ac.resume();
    if (wanted && current !== wanted) startSong(wanted);
  }
  function applyVolume() { if (!ac) return; sfxBus.gain.value = settings.sfx * 0.85; musicBus.gain.value = settings.music * 0.7; }
  function play(id) {
    wanted = id;
    if (!ac || ac.state !== 'running') return;
    if (current === id) return;
    startSong(id);
  }
  function startSong(id) {
    if (songGain) { const g = songGain; g.gain.setTargetAtTime(0, ac.currentTime, 0.12); setTimeout(() => g.disconnect(), 800); }
    current = id;
    if (!id || !SONGS[id]) { songGain = null; current = null; return; }
    songGain = ac.createGain(); songGain.connect(musicBus);
    step = 0; nextTime = ac.currentTime + 0.08;
  }
  function tick() {
    if (!ac || !current || ac.state !== 'running') return;
    const s = SONGS[current], sd = 60 / s.bpm / 2;
    while (nextTime < ac.currentTime + 0.25) {
      for (const c of s.parsed) { const e = c.ev[step % c.n]; if (e) note(c.w, e.f, nextTime, e.len * sd, c.v, songGain); }
      if (s.dr) drum(s.dr[step % s.dr.length], nextTime, songGain);
      nextTime += sd; step++;
      if (s.once && step >= s.len) { current = null; break; }
    }
  }
  function note(w, f, t, dur, vol, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (w === 'tri') o.type = 'triangle'; else o.setPeriodicWave(waves[w]);
    o.frequency.value = f;
    const rel = Math.min(0.08, dur * 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.01, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, dest, filt = 'highpass', freq = 6000, q = 0.7, endFreq = null) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = filt; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function drum(k, t, dest) {
    if (k === 'k') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.16);
    } else if (k === 's') noise(t, 0.12, 0.22, dest, 'bandpass', 1800, 0.8);
    else if (k === 'h') noise(t, 0.04, 0.09, dest, 'highpass', 7000);
  }
  function blip(w, f0, f1, dur, vol, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    if (['tri', 'sine', 'sawtooth', 'square'].includes(w)) o.type = w === 'tri' ? 'triangle' : w; else o.setPeriodicWave(waves[w]);
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  const arp = (w, notes, gap, dur, vol, delay = 0) => notes.forEach((n, i) => blip(w, freqOf(n), freqOf(n), dur, vol, delay + i * gap));
  const lastAt = {};
  const MIN = { hit: 0.045, coin: 0.04, eshoot: 0.07, kill: 0.05, crit: 0.05 };
  function sfx(name, opt = {}) {
    if (!ac || ac.state !== 'running' || settings.sfx <= 0) return;
    const now = ac.currentTime;
    if (lastAt[name] && now - lastAt[name] < (MIN[name] || 0.03)) return;
    lastAt[name] = now;
    const d = (opt.delay || 0) / 1000, t = now + d;
    switch (name) {
      case 'slash': noise(t, 0.08, 0.16, sfxBus, 'bandpass', 2800, 1.2, 900); break;
      case 'slash2': noise(t, 0.13, 0.22, sfxBus, 'bandpass', 2200, 1, 600); blip('p25', 400, 200, 0.08, 0.06, d); break;
      case 'shoot': noise(t, 0.05, 0.1, sfxBus, 'highpass', 3000); blip('p12', 900, 500, 0.05, 0.05, d); break;
      case 'magic': blip('sine', 700, 1100, 0.08, 0.07, d); blip('p12', 1400, 900, 0.06, 0.03, d); break;
      case 'spin': noise(t, 0.5, 0.2, sfxBus, 'bandpass', 1500, 1, 3500); break;
      case 'volley': for (let k = 0; k < 5; k++) noise(t + k * 0.03, 0.05, 0.1, sfxBus, 'highpass', 3000); break;
      case 'cast': for (let k = 0; k < 4; k++) blip('sine', 500 + k * 160, 900 + k * 200, 0.12, 0.08, d + k * 0.04); break;
      case 'meteor': blip('sawtooth', 160, 40, 0.5, 0.25, d); noise(t, 0.6, 0.35, sfxBus, 'lowpass', 1800, 0.7, 200); break;
      case 'dash': noise(t, 0.12, 0.13, sfxBus, 'bandpass', 1200, 1, 3000); break;
      case 'warp': blip('sine', 900, 200, 0.5, 0.1, d); break;
      case 'fall': blip('p25', 600, 80, 0.5, 0.15, d); break;
      case 'hit': blip('p50', 240, 80, 0.08, 0.16, d); noise(t, 0.05, 0.12, sfxBus, 'lowpass', 2400); break;
      case 'crit': blip('p25', 620, 110, 0.14, 0.2, d); noise(t, 0.1, 0.2, sfxBus, 'lowpass', 3800); break;
      case 'kill': blip('p25', 420, 60, 0.2, 0.15, d); noise(t + 0.03, 0.15, 0.12, sfxBus, 'lowpass', 1500, 0.7, 200); break;
      case 'hurt': blip('p50', 200, 55, 0.22, 0.3, d); noise(t, 0.1, 0.25, sfxBus, 'lowpass', 1200); break;
      case 'block': noise(t, 0.08, 0.2, sfxBus, 'bandpass', 3000, 3); blip('tri', 900, 1300, 0.1, 0.12, d); break;
      case 'revive': arp('sine', ['G5', 'C6', 'E6', 'G6', 'C7'], 0.06, 0.25, 0.14, d); break;
      case 'zap': noise(t, 0.12, 0.18, sfxBus, 'highpass', 4000, 1, 9000); blip('square', 1200, 300, 0.1, 0.05, d); break;
      case 'boom': blip('sine', 140, 35, 0.35, 0.35, d); noise(t, 0.35, 0.3, sfxBus, 'lowpass', 1400, 0.7, 150); break;
      case 'eshoot': blip('p25', 520, 300, 0.06, 0.05, d); break;
      case 'charge': blip('sawtooth', 90, 300, 0.7, 0.08, d); noise(t, 0.7, 0.07, sfxBus, 'lowpass', 400, 1, 2400); break;
      case 'thud': blip('sine', 110, 40, 0.25, 0.3, d); noise(t, 0.2, 0.2, sfxBus, 'lowpass', 600); break;
      case 'growl': blip('sawtooth', 160, 90, 0.2, 0.08, d); break;
      case 'screech': blip('square', 1600, 2400, 0.15, 0.04, d); break;
      case 'fuse': for (let k = 0; k < 4; k++) blip('square', 1400, 1400, 0.03, 0.05, d + k * 0.15); noise(t, 0.6, 0.06, sfxBus, 'highpass', 5000); break;
      case 'blink': blip('sine', 1200, 300, 0.2, 0.08, d); noise(t, 0.15, 0.08, sfxBus, 'bandpass', 2000, 2); break;
      case 'coin': blip('p25', 1320, 1320, 0.04, 0.06, d); blip('p25', 1760, 1760, 0.06, 0.06, d + 0.04); break;
      case 'heal': arp('sine', ['C6', 'E6', 'G6', 'C7'], 0.05, 0.16, 0.1, d); break;
      case 'wave': arp('p25', ['A4', 'E5', 'A5'], 0.06, 0.1, 0.1, d); break;
      case 'clear': arp('p25', ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.07, 0.14, 0.14, d); break;
      case 'portal': arp('sine', ['G5', 'D6', 'G6', 'B6', 'D7'], 0.05, 0.3, 0.1, d); noise(t, 0.4, 0.1, sfxBus, 'highpass', 4000, 1, 9000); break;
      case 'roar': blip('sawtooth', 120, 55, 0.9, 0.2, d); noise(t, 0.8, 0.2, sfxBus, 'lowpass', 500); break;
      case 'bossdie': blip('sawtooth', 200, 30, 1.6, 0.25, d); noise(t, 1.6, 0.35, sfxBus, 'lowpass', 2000, 0.7, 100); arp('p25', ['C6', 'G5', 'E5', 'C5', 'G4'], 0.1, 0.3, 0.12, d + 0.3); break;
      case 'die': blip('p50', 400, 50, 1.2, 0.25, d); noise(t, 0.6, 0.2, sfxBus, 'lowpass', 1200, 0.7, 100); break;
      case 'summon': blip('sine', 600, 120, 0.5, 0.15, d); break;
      case 'jump': blip('p25', 200, 700, 0.3, 0.1, d); break;
      case 'rumble': noise(t, 0.7, 0.25, sfxBus, 'lowpass', 300); break;
      case 'dig': noise(t, 0.4, 0.2, sfxBus, 'bandpass', 600, 1, 200); break;
      case 'throw': noise(t, 0.2, 0.15, sfxBus, 'bandpass', 800, 1, 2400); break;
      case 'swoosh': noise(t, 0.2, 0.1, sfxBus, 'bandpass', 900, 1, 2600); break;
      case 'wing': for (let k = 0; k < 3; k++) noise(t + k * 0.18, 0.15, 0.18, sfxBus, 'lowpass', 600, 1, 200); break;
      case 'hole': blip('sine', 300, 40, 1.4, 0.25, d); noise(t, 1.4, 0.15, sfxBus, 'lowpass', 900, 1, 100); break;
      case 'ice': noise(t, 0.25, 0.18, sfxBus, 'highpass', 5000, 1, 8000); blip('tri', 1800, 1200, 0.15, 0.06, d); break;
      case 'menu': blip('p25', 880, 880, 0.035, 0.07, d); break;
      case 'ok': blip('p25', 988, 1318, 0.06, 0.09, d); break;
      case 'cancel': blip('p25', 660, 440, 0.06, 0.08, d); break;
      case 'buy': arp('p25', ['A5', 'E6'], 0.05, 0.1, 0.13, d); break;
      case 'pick': arp('p25', ['E5', 'A5', 'C#6', 'E6'], 0.05, 0.12, 0.13, d); break;
      case 'legend': arp('p25', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.05, 0.2, 0.14, d); break;
      case 'reroll': for (let k = 0; k < 4; k++) blip('p12', 600 + k * 150, 600 + k * 150, 0.04, 0.07, d + k * 0.04); break;
      case 'error': blip('square', 120, 100, 0.08, 0.1, d); blip('square', 120, 100, 0.08, 0.1, d + 0.1); break;
    }
  }
  return {
    unlock, play, sfx,
    get settings() { return settings; },
    setVolume(k, v) { settings[k] = v; applyVolume(); },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    get ready() { return !!ac && ac.state === 'running'; }
  };
})();
