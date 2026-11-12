'use strict';
/* 칩튠 음악과 효과음. 음원 파일 없이 Web Audio 로 그 자리에서 합성한다.
   악보: 한 칸은 8분음표, '-' 는 앞 음을 늘이고 '.' 는 쉼. '|' 는 마디 구분(무시). */

const Sound = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, songGain = null;
  let noiseBuf = null;
  const waves = {};
  const settings = { music: 0.55, sfx: 0.8 };
  let current = null, wanted = null, afterSong = null, step = 0, nextTime = 0, timer = null;

  const SONGS = {
    title: {
      bpm: 112,
      ch: [
        ['p25', 0.20, 'A4 - - - E5 - - - | D5 - C5 - B4 - G4 - | A4 - - - C5 - E5 - | D5 - - - - - . . | F5 - - - E5 - - - | D5 - C5 - B4 - G4 - | A4 - C5 - B4 - G#4 - | A4 - - - - - . .'],
        ['tri', 0.34, 'A2 . A3 . A2 . A3 . | G2 . G3 . G2 . G3 . | F2 . F3 . F2 . F3 . | E2 . E3 . E2 . E3 . | D2 . D3 . D2 . D3 . | G2 . G3 . G2 . G3 . | E2 . E3 . E2 . E3 . | A2 . A3 . A2 . E2 .'],
        ['p12', 0.06, 'A3 C4 E4 C4 A3 C4 E4 C4 | G3 B3 D4 B3 G3 B3 D4 B3 | F3 A3 C4 A3 F3 A3 C4 A3 | E3 G#3 B3 G#3 E3 G#3 B3 G#3 | D3 F3 A3 F3 D3 F3 A3 F3 | G3 B3 D4 B3 G3 B3 D4 B3 | E3 G#3 B3 G#3 E3 G#3 B3 G#3 | A3 C4 E4 C4 A3 C4 E4 A4']
      ],
      drums: 'k . h . s . h . | k . h . s . h h'
    },
    cave: {
      bpm: 84,
      ch: [
        ['p50', 0.10, 'D5 - - - - - A4 - | C5 - - - A4 - - - | . . F4 - G4 - A4 - | E4 - - - - - . . | D5 - - - - - A4 - | C5 - - - D5 - E5 - | F5 - E5 - D5 - C5 - | D5 - - - - - . .'],
        ['tri', 0.30, 'D2 - - - D3 - - - | C2 - - - C3 - - - | A#1 - - - A#2 - - - | A1 - - - A2 - - - | D2 - - - D3 - - - | C2 - - - C3 - - - | A#1 - - - A1 - - - | D2 - - - D3 - - -'],
        ['p12', 0.05, 'D4 F4 A4 F4 D4 F4 A4 F4 | C4 E4 G4 E4 C4 E4 G4 E4 | A#3 D4 F4 D4 A#3 D4 F4 D4 | A3 C#4 E4 C#4 A3 C#4 E4 C#4 | D4 F4 A4 F4 D4 F4 A4 F4 | C4 E4 G4 E4 C4 E4 G4 E4 | A#3 D4 F4 D4 A3 C#4 E4 C#4 | D4 F4 A4 D5 A4 F4 D4 F4']
      ],
      drums: 'k . . . h . . . | . . k . h . . .'
    },
    crypt: {
      bpm: 76,
      ch: [
        ['p25', 0.11, 'E5 - - - F5 - - - | E5 - - - B4 - - - | C5 - - - B4 - A4 - | B4 - - - - - - - | E5 - - - F5 - - - | G5 - - - F5 - E5 - | D5 - - - C5 - B4 - | E4 - - - - - - -'],
        ['tri', 0.30, 'E2 - - - E2 - - - | E2 - - - E2 - - - | A1 - - - A1 - - - | B1 - - - B1 - - - | C2 - - - C2 - - - | C2 - - - C2 - - - | D2 - - - B1 - - - | E2 - - - E2 - - -'],
        ['p12', 0.045, 'E4 G4 B4 G4 E4 G4 B4 G4 | F4 A4 C5 A4 F4 A4 C5 A4 | A3 C4 E4 C4 A3 C4 E4 C4 | B3 D#4 F#4 D#4 B3 D#4 F#4 D#4 | C4 E4 G4 E4 C4 E4 G4 E4 | C4 E4 G4 E4 C4 E4 G4 E4 | D4 F4 A4 F4 B3 D#4 F#4 D#4 | E4 G4 B4 G4 E4 G4 B4 E5']
      ],
      drums: 'k . . . . . . . | s . . . . . h .'
    },
    lava: {
      bpm: 132,
      ch: [
        ['p25', 0.16, 'C5 - - G4 - - C5 - | D#5 - D5 - C5 - A#4 - | G#4 - - - G4 - - - | G4 - - - - - - - | C5 - - G4 - - C5 - | D#5 - F5 - G5 - - - | G#5 - G5 - F5 - D#5 - | D5 - - - - - - -'],
        ['tri', 0.34, 'C2 C2 C3 C2 C2 C2 C3 C2 | A#1 A#1 A#2 A#1 A#1 A#1 A#2 A#1 | G#1 G#1 G#2 G#1 G#1 G#1 G#2 G#1 | G1 G1 G2 G1 G1 G1 G2 G1 | C2 C2 C3 C2 C2 C2 C3 C2 | D#2 D#2 D#3 D#2 D#2 D#2 D#3 D#2 | F2 F2 F3 F2 F2 F2 F3 F2 | G1 G1 G2 G1 G2 G2 B2 G2'],
        ['p12', 0.04, 'G4 C5 D#5 C5 G4 C5 D#5 C5 | F4 A#4 D5 A#4 F4 A#4 D5 A#4 | D#4 G#4 C5 G#4 D#4 G#4 C5 G#4 | D4 G4 B4 G4 D4 G4 B4 G4']
      ],
      drums: 'k . h k s . h . | k . h k s . h s'
    },
    boss: {
      bpm: 150,
      ch: [
        ['p25', 0.17, 'A4 - A4 - C5 - A4 - | D#5 - D5 - C5 - B4 - | A4 - A4 - C5 - E5 - | F5 - E5 - D#5 - D5 - | A4 - A4 - C5 - A4 - | D#5 - D5 - C5 - B4 - | C5 - B4 - A4 - G#4 - | A4 - - - E4 - G#4 -'],
        ['tri', 0.36, 'A1 A2 A1 A2 A1 A2 A1 A2 | F1 F2 F1 F2 F1 F2 F1 F2 | A1 A2 A1 A2 A1 A2 A1 A2 | D2 D3 D2 D3 D#2 D#3 E2 E3 | A1 A2 A1 A2 A1 A2 A1 A2 | F1 F2 F1 F2 F1 F2 F1 F2 | D2 D3 D2 D3 E2 E3 E2 E3 | A1 A2 A1 A2 E2 E3 E2 E3'],
        ['p12', 0.05, 'E5 A5 E5 A5 E5 A5 E5 A5 | F5 A5 F5 A5 F5 A5 F5 A5 | E5 A5 E5 A5 E5 A5 E5 A5 | D5 F5 A5 F5 E5 G#5 B5 G#5']
      ],
      drums: 'k h s h k k s h | k h s h k s s s'
    },
    victory: {
      bpm: 140, once: true,
      ch: [
        ['p25', 0.2, 'C5 - E5 - G5 - C6 - - - G5 - C6 - - - - - - - . .'],
        ['tri', 0.34, 'C3 - - - E3 - - - G3 - - - C3 - - - - - - - . .'],
        ['p12', 0.07, 'E4 G4 C5 E5 G4 C5 E5 G5 B4 D5 G5 B5 C5 E5 G5 C6 - - - - . .']
      ],
      drums: 'k . s . k . s . k k s . k . . . . . . . . .'
    },
    death: {
      bpm: 88, once: true,
      ch: [
        ['p25', 0.18, 'E5 - D5 - C5 - B4 - A4 - - - - - - - . .'],
        ['tri', 0.32, 'A2 - - - F2 - - - E2 - - - A1 - - - - - . .']
      ]
    }
  };

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freqOf = (tok) => {
    const m = tok.match(/^([A-G])(#?)(\d)$/);
    if (!m) return null;
    const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  };
  function parse(str) {
    const toks = str.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
    const ev = [];
    toks.forEach((t, i) => {
      const f = freqOf(t);
      if (!f) return;
      let len = 1;
      while (toks[i + len] === '-') len++;
      ev[i] = { f, len };
    });
    return { ev, n: toks.length };
  }
  for (const s of Object.values(SONGS)) {
    s.parsed = s.ch.map(([w, v, str]) => ({ w, v, ...parse(str) }));
    if (s.drums) s.dr = s.drums.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
    s.len = Math.max(...s.parsed.map(c => c.n), s.dr ? s.dr.length : 0);
  }

  function pulse(duty) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
    }
    return ac.createPeriodicWave(re, im);
  }

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(master);
      sfxBus = ac.createGain(); sfxBus.connect(comp);
      musicBus = ac.createGain(); musicBus.connect(comp);
      applyVolume();
      waves.p12 = pulse(0.125); waves.p25 = pulse(0.25); waves.p50 = pulse(0.5);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      timer = setInterval(tick, 40);
    }
    if (ac.state === 'suspended') ac.resume();
    if (wanted && current !== wanted) startSong(wanted);
  }
  function applyVolume() {
    if (!ac) return;
    sfxBus.gain.value = settings.sfx * 0.9;
    musicBus.gain.value = settings.music * 0.7;
  }

  /* ── 음악 ── */
  function play(id, after = null) {
    afterSong = after;
    wanted = id;
    if (!ac || ac.state !== 'running') return;
    if (current === id) return;
    startSong(id);
  }
  function startSong(id) {
    if (songGain) {
      const g = songGain;
      g.gain.setTargetAtTime(0, ac.currentTime, 0.12);
      setTimeout(() => g.disconnect(), 800);
    }
    current = id;
    if (!id) { songGain = null; return; }
    songGain = ac.createGain();
    songGain.connect(musicBus);
    step = 0;
    nextTime = ac.currentTime + 0.08;
  }
  function tick() {
    if (!ac || !current || ac.state !== 'running') return;
    const s = SONGS[current];
    const sd = 60 / s.bpm / 2;
    while (nextTime < ac.currentTime + 0.25) {
      for (const c of s.parsed) {
        const e = c.ev[step % c.n];
        if (e) note(c.w, e.f, nextTime, e.len * sd, c.v, songGain);
      }
      if (s.dr) drum(s.dr[step % s.dr.length], nextTime, songGain);
      nextTime += sd;
      step++;
      if (s.once && step >= s.len) {
        const after = afterSong;
        current = null;
        if (after) { afterSong = null; wanted = after; setTimeout(() => { if (wanted === after) play(after); }, (nextTime - ac.currentTime) * 1000); }
        break;
      }
    }
  }
  function note(w, f, t, dur, vol, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (w === 'tri') o.type = 'triangle'; else o.setPeriodicWave(waves[w]);
    o.frequency.value = f;
    const rel = Math.min(0.08, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.01, dur - rel));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, dest, filt = 'highpass', freq = 6000, q = 0.7, endFreq = null) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = filt; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
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

  /* ── 효과음 ── */
  function blip(w, f0, f1, dur, vol, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    if (w === 'tri' || w === 'sine' || w === 'sawtooth' || w === 'square') o.type = w === 'tri' ? 'triangle' : w;
    else o.setPeriodicWave(waves[w]);
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const arp = (w, notes, gap, dur, vol) => notes.forEach((n, i) => blip(w, freqOf(n), freqOf(n), dur, vol, i * gap));
  const lastAt = {};

  function sfx(name, opt = {}) {
    if (!ac || ac.state !== 'running' || settings.sfx <= 0) return;
    const now = ac.currentTime;
    if (lastAt[name] && now - lastAt[name] < 0.035) return;
    lastAt[name] = now;
    const t = now + (opt.delay || 0) / 1000;
    const d = (opt.delay || 0) / 1000;
    switch (name) {
      case 'swing': noise(t, 0.09, 0.18, sfxBus, 'bandpass', 2500, 1.2, 900); break;
      case 'hit': blip('p50', 220, 70, 0.12, 0.28, d); noise(t, 0.07, 0.2, sfxBus, 'lowpass', 2200); break;
      case 'crit': blip('p25', 520, 90, 0.18, 0.3, d); noise(t, 0.12, 0.3, sfxBus, 'lowpass', 3500); break;
      case 'squish': blip('sine', 300, 90, 0.14, 0.35, d); break;
      case 'bone': blip('p12', 900, 300, 0.06, 0.2, d); blip('p12', 600, 200, 0.06, 0.18, d + 0.05); break;
      case 'rock': noise(t, 0.16, 0.35, sfxBus, 'lowpass', 600); blip('tri', 90, 50, 0.15, 0.4, d); break;
      case 'hurt': blip('p50', 180, 55, 0.22, 0.32, d); noise(t, 0.12, 0.25, sfxBus, 'lowpass', 1200); break;
      case 'miss': noise(t, 0.12, 0.08, sfxBus, 'bandpass', 3500, 2, 1500); break;
      case 'kill': blip('p25', 400, 60, 0.25, 0.25, d); noise(t + 0.05, 0.2, 0.15, sfxBus, 'lowpass', 1500, 0.7, 200); break;
      case 'pickup': arp('p25', ['E6', 'A6'], 0.06, 0.08, 0.16); break;
      case 'gold': arp('p50', ['B5', 'E6'], 0.05, 0.12, 0.14); break;
      case 'drink': for (let k = 0; k < 4; k++) blip('sine', 300 + k * 90, 500 + k * 120, 0.07, 0.18, k * 0.06); break;
      case 'levelup': arp('p25', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.07, 0.14, 0.18); break;
      case 'door': noise(t, 0.12, 0.25, sfxBus, 'lowpass', 500); blip('sawtooth', 140, 220, 0.18, 0.06, d + 0.03); break;
      case 'chest': noise(t, 0.08, 0.2, sfxBus, 'lowpass', 900); arp('p25', ['G5', 'B5', 'D6', 'G6'], 0.06, 0.1, 0.15); break;
      case 'stairs': arp('tri', ['G5', 'E5', 'C5', 'G4', 'E4', 'C4'], 0.07, 0.12, 0.3); break;
      case 'fire': noise(t, 0.3, 0.3, sfxBus, 'lowpass', 3000, 0.8, 400); blip('sawtooth', 200, 80, 0.25, 0.08, d); break;
      case 'arrow': noise(t, 0.1, 0.15, sfxBus, 'highpass', 4000, 0.7, 9000); break;
      case 'bolt': noise(t, 0.25, 0.3, sfxBus, 'highpass', 1500); blip('square', 1200, 100, 0.2, 0.1, d); break;
      case 'boom': noise(t, 0.6, 0.45, sfxBus, 'lowpass', 1800, 0.7, 100); blip('tri', 80, 30, 0.5, 0.4, d); break;
      case 'heal': arp('sine', ['C6', 'E6', 'G6', 'C7'], 0.06, 0.18, 0.12); break;
      case 'whirl': noise(t, 0.25, 0.25, sfxBus, 'bandpass', 1200, 1, 4000); break;
      case 'trap': blip('square', 1400, 1400, 0.05, 0.12, d); blip('square', 1000, 1000, 0.05, 0.12, d + 0.07); break;
      case 'teleport': for (let k = 0; k < 6; k++) blip('sine', 400 + k * 200, 800 + k * 250, 0.08, 0.1, k * 0.04); break;
      case 'death': blip('p50', 400, 40, 1.2, 0.3, d); break;
      case 'roar': blip('sawtooth', 110, 55, 0.9, 0.22, d); noise(t, 0.8, 0.2, sfxBus, 'lowpass', 500); break;
      case 'summon': blip('sine', 600, 120, 0.5, 0.18, d); break;
      case 'wake': blip('p25', 700, 1000, 0.06, 0.1, d); break;
      case 'menu': blip('p25', 880, 880, 0.04, 0.08, d); break;
      case 'error': blip('square', 120, 100, 0.08, 0.12, d); blip('square', 120, 100, 0.08, 0.12, d + 0.1); break;
      case 'buy': arp('p25', ['A5', 'E6'], 0.05, 0.1, 0.14); break;
      case 'equip': noise(t, 0.08, 0.2, sfxBus, 'bandpass', 3000, 3); blip('p12', 600, 900, 0.08, 0.1, d + 0.03); break;
      case 'enchant': arp('p25', ['E5', 'G#5', 'B5', 'E6', 'G#6'], 0.05, 0.16, 0.14); break;
      case 'step': break;
    }
  }

  return {
    unlock, play, sfx,
    get settings() { return settings; },
    setVolume(k, v) { settings[k] = v; applyVolume(); if (k === 'music' && v > 0 && wanted && !current) play(wanted); },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    get ready() { return !!ac && ac.state === 'running'; }
  };
})();
