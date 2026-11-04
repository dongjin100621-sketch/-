/* 조국과 민족을 위하여 — 절차적 음악·효과음 (Web Audio, 외부 음원 없음) */
'use strict';

const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, wet, songGain = null;
  let song = null, songName = null, timer = null, nextTime = 0, step = 0;
  const vol = { music: 0.55, sfx: 0.8 };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); sfxBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master);
      wet = ctx.createConvolver(); wet.buffer = impulse(2.6);
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.35;
      wet.connect(wetGain); wetGain.connect(master);
      applyVolume();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
  }
  function applyVolume() {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(vol.music * 0.5, ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx * 0.6, ctx.currentTime, 0.05);
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ── 악기 ── */
  function env(g, t, a, peak, d, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
  }
  function pluck(dest, t, m, v = 0.25, dec = 1.2) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = mtof(m);
    o2.type = 'sine'; o2.frequency.value = mtof(m + 12);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    o.frequency.setValueAtTime(mtof(m) * 1.01, t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.05);
    env(g, t, 0.005, v, dec);
    g.connect(dest); g.connect(wet);
    o.start(t); o2.start(t); o.stop(t + dec + 0.1); o2.stop(t + dec + 0.1);
  }
  function pad(dest, t, notes, dur, v = 0.06, cutoff = 900) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + Math.min(1.2, dur * 0.4));
    g.gain.setValueAtTime(v, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g); g.connect(dest); g.connect(wet);
    for (const m of notes) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.8);
    }
  }
  function bass(dest, t, m, dur, v = 0.22) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = mtof(m);
    env(g, t, 0.01, v, dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.1);
  }
  function brass(dest, t, m, dur, v = 0.09) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(1800, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03);
    g.gain.setValueAtTime(v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest); g.connect(wet); o.start(t); o.stop(t + dur + 0.05);
  }
  function snare(dest, t, v = 0.18) {
    const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 1400;
    env(g, t, 0.002, v, 0.14);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.2);
  }
  function kick(dest, t, v = 0.5) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    env(g, t, 0.002, v, 0.25);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
  }
  function bell(dest, t, m, v = 0.08) {
    for (const [r, a, d] of [[1, 1, 2.5], [2.76, 0.4, 1.2], [5.4, 0.2, 0.6]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = mtof(m) * r;
      env(g, t, 0.003, v * a, d);
      o.connect(g); g.connect(dest); g.connect(wet); o.start(t); o.stop(t + d + 0.1);
    }
  }

  /* ── 곡 ── */
  function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
  const SONGS = {
    title: {
      bpm: 58, steps: 64, init() { this.r = seeded(7); },
      play(o, i, t, sd) {
        const prog = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]];
        const ch = prog[Math.floor(i / 16) % 4];
        if (i % 16 === 0) { pad(o, t, ch, sd * 16, 0.05, 800); bass(o, t, ch[0] - 12, sd * 15, 0.2); }
        if (i % 2 === 0 && this.r() < 0.7) { const sc = [69, 72, 74, 76, 79, 81]; pluck(o, t, sc[Math.floor(this.r() * sc.length)], 0.12, 2.2); }
        if (i % 32 === 0) bell(o, t, 81, 0.05);
      },
    },
    calm: {
      bpm: 72, steps: 32, init() { this.r = seeded(3); this.m = 3; },
      play(o, i, t, sd) {
        const prog = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
        const ch = prog[Math.floor(i / 8) % 4];
        if (i % 8 === 0) { pad(o, t, ch, sd * 8, 0.035, 700); bass(o, t, ch[0] - 12, sd * 7, 0.16); }
        const sc = [60, 62, 64, 67, 69, 72, 74, 76, 79];
        if (this.r() < 0.55) {
          this.m = Math.max(0, Math.min(sc.length - 1, this.m + Math.floor(this.r() * 5) - 2));
          pluck(o, t, sc[this.m], 0.13, 1.6);
        }
      },
    },
    tense: {
      bpm: 92, steps: 32, init() { this.r = seeded(11); },
      play(o, i, t, sd) {
        if (i % 32 === 0) { pad(o, t, [38, 45, 50], sd * 32, 0.05, 420); }
        if (i % 4 === 0) kick(o, t, i % 8 === 0 ? 0.35 : 0.18);
        if (i % 4 === 2) bass(o, t, 38, sd * 1.5, 0.12);
        if (this.r() < 0.12) pluck(o, t, [74, 75, 77, 81, 82][Math.floor(this.r() * 5)], 0.06, 1.5);
        if (i % 16 === 12) pluck(o, t, 63, 0.05, 2);
      },
    },
    march: {
      bpm: 108, steps: 32, init() {},
      play(o, i, t, sd) {
        const k = i % 16;
        if (k === 0 || k === 8) kick(o, t, 0.35);
        if ([4, 12, 14].includes(k)) snare(o, t, 0.12);
        if (k % 2 === 0) snare(o, t, 0.025);
        const root = [46, 46, 51, 53][Math.floor(i / 8) % 4];
        if (k % 4 === 0) bass(o, t, root - 12 + (k % 8 === 4 ? 7 : 0), sd * 3, 0.2);
        const mel = [70, -1, 70, 72, 74, -1, 70, -1, 75, -1, 74, 72, 70, -1, 67, -1, 70, -1, 70, 72, 74, -1, 77, -1, 75, 74, 72, -1, 70, -1, -1, -1];
        const n = mel[i % 32];
        if (n > 0) brass(o, t, n, sd * 1.8, 0.06);
      },
    },
    sad: {
      bpm: 54, steps: 32, init() { this.r = seeded(5); this.m = 6; },
      play(o, i, t, sd) {
        const prog = [[50, 53, 57], [46, 50, 53], [41, 45, 48], [45, 49, 52]];
        const ch = prog[Math.floor(i / 8) % 4];
        if (i % 8 === 0) { pad(o, t, ch.map((x) => x + 12), sd * 8, 0.04, 600); bass(o, t, ch[0] - 12, sd * 8, 0.15); }
        const sc = [62, 64, 65, 67, 69, 70, 72, 74];
        if (i % 2 === 0 && this.r() < 0.6) {
          this.m = Math.max(0, Math.min(sc.length - 1, this.m + (this.r() < 0.65 ? -1 : 1)));
          if (this.m === 0) this.m = 6;
          pluck(o, t, sc[this.m], 0.1, 2.6);
        }
      },
    },
  };

  function schedule() {
    if (!song || !ctx) return;
    const sd = 60 / song.bpm / 2;
    while (nextTime < ctx.currentTime + 0.25) {
      try { song.play(songGain, step % song.steps, nextTime, sd); } catch (e) { /* 무시 */ }
      nextTime += sd; step++;
    }
  }

  function play(name) {
    if (name === songName) return;
    songName = name;
    if (!ensure()) return;
    if (songGain) {
      const old = songGain;
      old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.35);
      setTimeout(() => old.disconnect(), 2500);
    }
    if (!name || !SONGS[name]) { song = null; return; }
    songGain = ctx.createGain();
    songGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    songGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    songGain.connect(musicBus);
    song = Object.create(SONGS[name]); song.init();
    step = 0; nextTime = ctx.currentTime + 0.1;
    if (!timer) timer = setInterval(schedule, 50);
  }

  /* ── 효과음 ── */
  function sfx(name) {
    if (!ensure()) return;
    const t = ctx.currentTime + 0.005, o = sfxBus;
    switch (name) {
      case 'blip': {
        const os = ctx.createOscillator(), g = ctx.createGain();
        os.type = 'square'; os.frequency.value = 880 + Math.random() * 120;
        env(g, t, 0.002, 0.03, 0.03); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.05);
        break;
      }
      case 'hover': pluck(o, t, 84, 0.04, 0.15); break;
      case 'select': pluck(o, t, 76, 0.12, 0.3); pluck(o, t + 0.07, 83, 0.12, 0.5); break;
      case 'up': [72, 76, 79].forEach((m, k) => pluck(o, t + k * 0.06, m, 0.09, 0.4)); break;
      case 'down': [67, 63, 60].forEach((m, k) => pluck(o, t + k * 0.07, m, 0.09, 0.5)); break;
      case 'page': {
        const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.setValueAtTime(800, t); f.frequency.linearRampToValueAtTime(3000, t + 0.25);
        env(g, t, 0.05, 0.08, 0.25); n.connect(f); f.connect(g); g.connect(o); n.start(t); n.stop(t + 0.4);
        break;
      }
      case 'stamp': kick(o, t, 0.6); snare(o, t, 0.05); break;
      case 'chime': bell(o, t, 84, 0.12); bell(o, t + 0.12, 88, 0.1); bell(o, t + 0.24, 91, 0.1); break;
      case 'gun': {
        const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
        env(g, t, 0.001, 0.9, 0.45); n.connect(f); f.connect(g); g.connect(o); g.connect(wet); n.start(t); n.stop(t + 0.6);
        kick(o, t, 0.9);
        break;
      }
      case 'hit': pluck(o, t, 79, 0.1, 0.2); kick(o, t, 0.2); break;
      case 'miss': {
        const os = ctx.createOscillator(), g = ctx.createGain();
        os.type = 'sawtooth'; os.frequency.setValueAtTime(220, t); os.frequency.exponentialRampToValueAtTime(90, t + 0.25);
        env(g, t, 0.005, 0.08, 0.25); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.3);
        break;
      }
      case 'coin': pluck(o, t, 88, 0.06, 0.2); pluck(o, t + 0.05, 93, 0.06, 0.3); break;
      case 'alarm': [0, 0.25, 0.5].forEach((d) => brass(o, t + d, 81, 0.18, 0.06)); break;
      default: break;
    }
  }

  return {
    unlock: ensure, play, sfx,
    setVolume(kind, v) { vol[kind] = v; applyVolume(); },
    getVolume: (kind) => vol[kind],
    current: () => songName,
  };
})();
