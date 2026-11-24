'use strict';
/* 소리 엔진: Web Audio 신스 악기·드럼·리버브, 재생 스케줄러, WAV 내보내기 */
(function (S) {
  const T = S.theory;

  /* 악기 설정. osc: 파형·배율·미세 조정(센트)·음량, filter: 필터와 엔벨로프, env: ADSR(초) */
  const PRESETS = {
    piano: {
      osc: [{ type: 'triangle', ratio: 1, gain: 0.7 }, { type: 'sine', ratio: 2, gain: 0.25 }, { type: 'sine', ratio: 3, gain: 0.08 }],
      filter: { type: 'lowpass', freq: 900, env: 4200, decay: 0.6, q: 0.7, key: 0.6 },
      env: { a: 0.003, d: 1.6, s: 0, r: 0.35 }, keyDecay: true, gain: 0.55,
    },
    epiano: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.9 }, { type: 'sine', ratio: 2, gain: 0.08 }],
      fm: { ratio: 1, index: 2.2, decay: 0.35 }, fm2: { ratio: 14, index: 0.6, decay: 0.05 },
      env: { a: 0.002, d: 1.8, s: 0.15, r: 0.4 }, keyDecay: true, gain: 0.5,
    },
    organ: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.5 }, { type: 'sine', ratio: 2, gain: 0.35 }, { type: 'sine', ratio: 3, gain: 0.2 }, { type: 'sine', ratio: 4, gain: 0.14 }, { type: 'sine', ratio: 0.5, gain: 0.25 }],
      env: { a: 0.012, d: 0.1, s: 1, r: 0.08 }, trem: { rate: 6, depth: 0.12 }, gain: 0.38,
    },
    pluck: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.45 }, { type: 'square', ratio: 1, detune: 6, gain: 0.2 }],
      filter: { type: 'lowpass', freq: 380, env: 5200, decay: 0.12, q: 1.4, key: 0.5 },
      env: { a: 0.002, d: 0.5, s: 0, r: 0.15 }, keyDecay: true, gain: 0.5,
    },
    strings: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -9, gain: 0.3 }, { type: 'sawtooth', ratio: 1, detune: 9, gain: 0.3 }, { type: 'sawtooth', ratio: 2, detune: 3, gain: 0.08 }],
      filter: { type: 'lowpass', freq: 2400, env: 600, decay: 0.8, q: 0.5, key: 0.3 },
      env: { a: 0.18, d: 0.4, s: 0.85, r: 0.45 }, vib: { rate: 5.2, depth: 9, delay: 0.25 }, gain: 0.42,
    },
    brass: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.5 }, { type: 'sawtooth', ratio: 1, detune: 7, gain: 0.3 }],
      filter: { type: 'lowpass', freq: 500, env: 2600, decay: 0.35, attack: 0.06, q: 1.2, key: 0.4 },
      env: { a: 0.04, d: 0.3, s: 0.75, r: 0.15 }, vib: { rate: 5, depth: 6, delay: 0.3 }, gain: 0.42,
    },
    pad: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -14, gain: 0.25 }, { type: 'sawtooth', ratio: 1, detune: 0, gain: 0.25 }, { type: 'sawtooth', ratio: 1, detune: 14, gain: 0.25 }, { type: 'triangle', ratio: 0.5, gain: 0.2 }],
      filter: { type: 'lowpass', freq: 900, env: 900, decay: 1.5, attack: 0.6, q: 0.8, key: 0.2 },
      env: { a: 0.45, d: 0.8, s: 0.8, r: 0.9 }, gain: 0.34,
    },
    lead: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -6, gain: 0.4 }, { type: 'square', ratio: 1, detune: 6, gain: 0.25 }, { type: 'sawtooth', ratio: 2, gain: 0.08 }],
      filter: { type: 'lowpass', freq: 1400, env: 2600, decay: 0.3, q: 3, key: 0.5 },
      env: { a: 0.008, d: 0.25, s: 0.7, r: 0.12 }, vib: { rate: 5.6, depth: 12, delay: 0.22 }, gain: 0.36,
    },
    bell: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.7 }, { type: 'sine', ratio: 2.76, gain: 0.12 }],
      fm: { ratio: 3.5, index: 3, decay: 0.9 },
      env: { a: 0.002, d: 2.4, s: 0, r: 0.6 }, keyDecay: true, gain: 0.45,
    },
    flute: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.8 }, { type: 'triangle', ratio: 2, gain: 0.06 }],
      noise: { gain: 0.06, freq: 2500 },
      env: { a: 0.06, d: 0.2, s: 0.85, r: 0.12 }, vib: { rate: 5, depth: 14, delay: 0.3 }, gain: 0.5,
    },
    bass: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.5 }, { type: 'sine', ratio: 1, gain: 0.55 }, { type: 'square', ratio: 0.5, gain: 0.12 }],
      filter: { type: 'lowpass', freq: 220, env: 1600, decay: 0.18, q: 4, key: 0.2 },
      env: { a: 0.004, d: 0.35, s: 0.7, r: 0.08 }, gain: 0.6,
    },
    sub808: {
      osc: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'triangle', ratio: 1, gain: 0.25 }],
      drop: { ratio: 2, time: 0.05 }, drive: 2.2,
      env: { a: 0.002, d: 1.3, s: 0.35, r: 0.2 }, gain: 0.7,
    },
  };

  function makeImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    let seed = 1234567;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = rnd() * Math.pow(1 - t, decay) * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
      }
    }
    return buf;
  }
  function makeNoise(ctx) {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 987654;
    for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
    return buf;
  }
  function driveCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }

  class Engine {
    constructor(ctx) {
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.85;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -12; this.comp.knee.value = 10; this.comp.ratio.value = 3.5;
      this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.master.connect(this.comp); this.comp.connect(ctx.destination);
      this.revIn = ctx.createGain();
      const pre = ctx.createBiquadFilter(); pre.type = 'highpass'; pre.frequency.value = 220;
      this.conv = ctx.createConvolver(); this.conv.buffer = makeImpulse(ctx, 2.4, 3.2);
      const revOut = ctx.createGain(); revOut.gain.value = 0.7;
      this.revIn.connect(pre); pre.connect(this.conv); this.conv.connect(revOut); revOut.connect(this.master);
      this.noise = makeNoise(ctx);
      this.curves = {};
      this.analyser = null;
    }
    curve(k) { return this.curves[k] || (this.curves[k] = driveCurve(k)); }
    analyse() {
      if (!this.analyser) { this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024; this.comp.connect(this.analyser); }
      return this.analyser;
    }
  }

  /* 한 번의 재생(또는 미리 듣기)에 쓰는 트랙별 믹서 줄 */
  class Session {
    constructor(engine) {
      this.e = engine; this.ctx = engine.ctx;
      this.out = this.ctx.createGain(); this.out.connect(engine.master);
      this.chains = new Map();
    }
    chain(tr) {
      let c = this.chains.get(tr.id);
      if (!c) {
        const ctx = this.ctx;
        c = { input: ctx.createGain(), vol: ctx.createGain(), pan: ctx.createStereoPanner ? ctx.createStereoPanner() : null, send: ctx.createGain() };
        c.input.connect(c.vol);
        if (c.pan) { c.vol.connect(c.pan); c.pan.connect(this.out); } else c.vol.connect(this.out);
        c.vol.connect(c.send); c.send.connect(this.e.revIn);
        this.chains.set(tr.id, c);
      }
      return c;
    }
    update(song) {
      const solo = song.tracks.some((t) => t.solo);
      const now = this.ctx.currentTime;
      for (const tr of song.tracks) {
        const c = this.chain(tr);
        const audible = !tr.mute && (!solo || tr.solo);
        c.vol.gain.setTargetAtTime(audible ? tr.vol * tr.vol : 0, now, 0.015);
        if (c.pan) c.pan.pan.setTargetAtTime(tr.pan, now, 0.015);
        c.send.gain.setTargetAtTime(tr.rev * 0.6, now, 0.015);
      }
      this.e.master.gain.setTargetAtTime(song.master, now, 0.015);
    }
    stop() {
      const now = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.setTargetAtTime(0, now, 0.02);
      const out = this.out;
      setTimeout(() => { try { out.disconnect(); } catch (e) { /* 이미 끊김 */ } }, 400);
    }
  }

  /* 신스 한 음. dur 뒤에 놓는다. release(at)를 부르면 그때 놓는다(건반 연주용). */
  function synthVoice(engine, dest, inst, t, pitch, dur, vel) {
    const ctx = engine.ctx;
    const P = PRESETS[inst] || PRESETS.piano;
    const f = T.freq(pitch);
    const out = ctx.createGain();
    const amp = ctx.createGain();
    const env = P.env;
    const keyScale = P.keyDecay ? Math.pow(2, -(pitch - 60) / 30) : 1;
    const dec = env.d * keyScale;
    const peak = P.gain * (0.25 + 0.75 * vel);
    const g = amp.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + env.a);
    g.setTargetAtTime(peak * env.s, t + env.a, dec / 4);
    let end = t + Math.max(dur, env.a + 0.01);
    g.setTargetAtTime(0, end, env.r / 4);
    let stopAt = end + env.r * 2 + 0.05;

    let node = amp;
    if (P.drive) {
      const ws = ctx.createWaveShaper(); ws.curve = engine.curve(P.drive);
      amp.connect(ws); node = ws;
    }
    node.connect(out); out.connect(dest);

    let target = amp;
    let filter = null;
    if (P.filter) {
      const F = P.filter;
      filter = ctx.createBiquadFilter(); filter.type = F.type; filter.Q.value = F.q || 0.7;
      const base = Math.min(18000, F.freq * Math.pow(f / 261.6, F.key || 0));
      const top = Math.min(18000, base + F.env * (0.4 + 0.6 * vel));
      filter.frequency.setValueAtTime(F.attack ? base : top, t);
      if (F.attack) filter.frequency.linearRampToValueAtTime(top, t + F.attack);
      filter.frequency.setTargetAtTime(base, t + (F.attack || 0), F.decay / 3);
      filter.connect(amp); target = filter;
    }
    const oscs = [];
    let fmOsc = null;
    const fms = [];
    for (const fmSpec of [P.fm, P.fm2]) {
      if (!fmSpec) continue;
      const m = ctx.createOscillator(); m.frequency.value = f * fmSpec.ratio;
      const mg = ctx.createGain();
      const idx = f * fmSpec.ratio * fmSpec.index * (0.4 + 0.6 * vel);
      mg.gain.setValueAtTime(idx, t);
      mg.gain.setTargetAtTime(idx * 0.08, t, fmSpec.decay / 3);
      m.connect(mg); fms.push(mg); oscs.push(m);
      fmOsc = m;
    }
    let vibGain = null;
    if (P.vib) {
      const l = ctx.createOscillator(); l.frequency.value = P.vib.rate;
      vibGain = ctx.createGain();
      vibGain.gain.setValueAtTime(0, t);
      vibGain.gain.linearRampToValueAtTime(P.vib.depth, t + P.vib.delay + 0.25);
      l.connect(vibGain); oscs.push(l);
    }
    for (const o of P.osc) {
      const osc = ctx.createOscillator(); osc.type = o.type;
      const of = f * o.ratio;
      if (P.drop) {
        osc.frequency.setValueAtTime(of * P.drop.ratio, t);
        osc.frequency.exponentialRampToValueAtTime(of, t + P.drop.time);
      } else osc.frequency.value = of;
      if (o.detune) osc.detune.value = o.detune;
      if (vibGain) vibGain.connect(osc.detune);
      for (const mg of fms) mg.connect(osc.frequency);
      const og = ctx.createGain(); og.gain.value = o.gain;
      osc.connect(og); og.connect(target);
      oscs.push(osc);
    }
    if (P.noise) {
      const n = ctx.createBufferSource(); n.buffer = engine.noise; n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = P.noise.freq; bp.Q.value = 0.8;
      const ng = ctx.createGain(); ng.gain.value = P.noise.gain;
      n.connect(bp); bp.connect(ng); ng.connect(target);
      oscs.push(n);
    }
    if (P.trem) {
      const l = ctx.createOscillator(); l.frequency.value = P.trem.rate;
      const lg = ctx.createGain(); lg.gain.value = P.trem.depth;
      l.connect(lg); lg.connect(out.gain); oscs.push(l);
    }
    for (const o of oscs) { o.start(t); o.stop(stopAt); }
    void fmOsc;
    return {
      release(at) {
        at = Math.max(at, ctx.currentTime);
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at);
        else { g.cancelScheduledValues(at); g.setValueAtTime(g.value, at); }
        g.setTargetAtTime(0, at, env.r / 4);
        const st = at + env.r * 2 + 0.05;
        for (const o of oscs) { try { o.stop(st); } catch (e) { /* 이미 멈춤 */ } }
      },
    };
  }

  /* 드럼 한 번 */
  function drumHit(engine, dest, kit, row, t, vel) {
    const ctx = engine.ctx;
    const v = 0.3 + 0.7 * vel;
    let out = ctx.createGain(); out.gain.value = 1;
    if (kit === 'lofi') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5;
      const ws = ctx.createWaveShaper(); ws.curve = engine.curve(1.6);
      out.connect(lp); lp.connect(ws); ws.connect(dest);
    } else out.connect(dest);
    const noise = (dur, type, fq, q, gain, decay, start = t) => {
      const n = ctx.createBufferSource(); n.buffer = engine.noise;
      n.playbackRate.value = 0.9 + ((row * 7919) % 20) / 100;
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = fq; flt.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * v, start);
      g.gain.setTargetAtTime(0, start + 0.002, decay / 3);
      n.connect(flt); flt.connect(g); g.connect(out);
      n.start(start); n.stop(start + dur);
      return g;
    };
    const tone = (type, f0, f1, sweep, gain, decay, dur) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * v, t + 0.002);
      g.gain.setTargetAtTime(0, t + 0.004, decay / 3);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur);
    };
    const id = S.song.DRUMS[row] ? S.song.DRUMS[row].id : 'kick';
    const is808 = kit === '808';
    switch (id) {
      case 'kick':
        if (is808) {
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.08);
          const g = ctx.createGain(); g.gain.setValueAtTime(1.1 * v, t); g.gain.setTargetAtTime(0, t + 0.05, 0.35);
          const ws = ctx.createWaveShaper(); ws.curve = engine.curve(1.8);
          o.connect(ws); ws.connect(g); g.connect(out); o.start(t); o.stop(t + 1.6);
        } else {
          tone('sine', 160, 46, 0.11, 1.15, 0.38, 0.6);
          noise(0.02, 'highpass', 2500, 0.7, 0.25, 0.008);
        }
        break;
      case 'snare':
        tone('triangle', is808 ? 240 : 200, 160, 0.06, 0.55, 0.09, 0.2);
        noise(0.3, 'highpass', is808 ? 1600 : 1100, 0.6, 0.75, is808 ? 0.16 : 0.2);
        break;
      case 'clap':
        for (const off of [0, 0.011, 0.023]) noise(0.03, 'bandpass', 1400, 0.9, 0.7, 0.012, t + off);
        noise(0.4, 'bandpass', 1300, 0.8, 0.6, 0.2, t + 0.03);
        break;
      case 'chh':
        noise(0.12, 'highpass', 7200, 0.8, 0.42, is808 ? 0.035 : 0.05);
        break;
      case 'ohh':
        noise(0.7, 'highpass', 6600, 0.7, 0.36, 0.38);
        break;
      case 'tomh':
        tone('sine', 230, 150, 0.12, 0.8, 0.28, 0.6);
        break;
      case 'toml':
        tone('sine', 140, 82, 0.15, 0.9, 0.38, 0.8);
        break;
      case 'crash':
        noise(2.2, 'highpass', 4200, 0.4, 0.45, 1.4);
        noise(1.2, 'bandpass', 8000, 1.2, 0.2, 0.7);
        break;
    }
  }

  function click(engine, t, accent) {
    const ctx = engine.ctx;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = accent ? 1760 : 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.13, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(engine.master); o.start(t); o.stop(t + 0.06);
  }

  /* 스윙: 8분음표 뒤 16분 자리(박 안 2번째 16분)를 늦춘다 */
  function swingTick(t, swing) {
    if (!swing) return t;
    const step = T.PPQ / 4;
    const r = t % (step * 2);
    if (r === step) return t + swing * step * 0.66;
    return t;
  }

  function playNote(engine, dest, tr, t, n, dur) {
    if (tr.type === 'drums') drumHit(engine, dest, tr.inst, n.p, t, n.v);
    else return synthVoice(engine, dest, tr.inst, t, n.p, dur, n.v);
    return null;
  }

  /* 재생기: 앞을 내다보며(lookahead) 음을 예약한다 */
  class Player {
    constructor(getEngine, getSong) {
      this.getEngine = getEngine; this.getSong = getSong;
      this.playing = false; this.session = null; this.timer = null;
      this.metronome = false; this.onStop = null; this.onNoteStart = null;
      this.pos = 0; // 멈춰 있을 때의 위치(틱)
    }
    spt(song) { return 60 / song.bpm / T.PPQ; }
    play(fromTick) {
      const eng = this.getEngine();
      const song = this.getSong();
      if (this.playing) this.stop(true);
      this.session = new Session(eng); this.session.update(song);
      this.playing = true;
      this.cursor = Math.max(0, fromTick == null ? this.pos : fromTick);
      if (song.loop.on && (this.cursor >= song.loop.end || this.cursor < song.loop.start)) this.cursor = song.loop.start;
      if (this.cursor >= T.BAR * song.bars) this.cursor = 0;
      this.cursorTime = eng.ctx.currentTime + 0.08;
      this.marks = [{ time: this.cursorTime, tick: this.cursor, spt: this.spt(song) }];
      this.endTime = null;
      this.tickFn();
      this.timer = setInterval(() => this.tickFn(), 25);
    }
    tickFn() {
      if (!this.playing) return;
      const eng = this.getEngine(), ctx = eng.ctx, song = this.getSong();
      if (this.endTime != null) {
        if (ctx.currentTime >= this.endTime) { this.pos = 0; this.stop(); if (this.onStop) this.onStop(true); }
        return;
      }
      const ahead = ctx.currentTime + 0.14;
      const songEnd = T.BAR * song.bars;
      let guard = 0;
      while (this.cursorTime < ahead && guard++ < 64) {
        const spt = this.spt(song);
        const loop = song.loop.on && song.loop.end > song.loop.start;
        const limit = loop ? Math.min(song.loop.end, songEnd) : songEnd;
        let end = Math.min(this.cursor + T.PPQ / 4, limit);
        if (end <= this.cursor) end = this.cursor + 1;
        this.schedule(song, eng, this.cursor, end, this.cursorTime, spt);
        this.cursorTime += (end - this.cursor) * spt;
        this.cursor = end;
        if (this.cursor >= limit) {
          if (loop) {
            this.cursor = song.loop.start;
            this.marks.push({ time: this.cursorTime, tick: this.cursor, spt });
          } else { this.endTime = this.cursorTime + 0.05; this.marks.push({ time: this.cursorTime, tick: this.cursor, spt }); break; }
        } else if (Math.abs(spt - this.marks[this.marks.length - 1].spt) > 1e-9) {
          this.marks.push({ time: this.cursorTime, tick: this.cursor, spt });
        }
      }
      if (this.marks.length > 64) this.marks.splice(0, this.marks.length - 32);
    }
    schedule(song, eng, from, to, time0, spt) {
      const solo = song.tracks.some((t) => t.solo);
      for (const tr of song.tracks) {
        if (tr.mute || (solo && !tr.solo)) continue;
        const dest = this.session.chain(tr).input;
        for (const n of tr.notes) {
          if (n.t < from || n.t >= to) continue;
          const st = swingTick(n.t, song.swing);
          const t = time0 + (st - from) * spt;
          const dur = n.d * spt;
          playNote(eng, dest, tr, t, n, dur);
          if (this.onNoteStart) this.onNoteStart(tr, n, t);
        }
      }
      if (this.metronome) {
        for (let b = Math.ceil(from / T.PPQ) * T.PPQ; b < to; b += T.PPQ) click(eng, time0 + (b - from) * spt, b % T.BAR === 0);
      }
    }
    /** 지금 들리는 위치(틱) */
    now() {
      if (!this.playing) return this.pos;
      const t = this.getEngine().ctx.currentTime;
      let m = this.marks[0];
      for (const k of this.marks) { if (k.time <= t) m = k; else break; }
      if (t < m.time) return m.tick;
      return m.tick + (t - m.time) / m.spt;
    }
    stop(keepPos) {
      if (!this.playing) return;
      const p = this.now();
      this.playing = false;
      clearInterval(this.timer); this.timer = null;
      if (this.session) this.session.stop();
      this.session = null;
      if (!keepPos) this.pos = Math.floor(p);
    }
    update() { if (this.session) this.session.update(this.getSong()); }
  }

  /* 곡을 오프라인으로 그려 오디오 버퍼로 만든다 */
  async function render(song, opts = {}) {
    const rate = 44100;
    const spt = 60 / song.bpm / T.PPQ;
    const from = opts.from || 0, to = opts.to || T.BAR * song.bars;
    const tail = 2.5;
    const len = Math.ceil(((to - from) * spt + tail) * rate);
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const ctx = new OAC(2, len, rate);
    const eng = new Engine(ctx);
    const ses = new Session(eng); ses.update(song);
    // 오프라인 문맥에서는 setTargetAtTime 이 바로 적용되도록 값도 넣는다
    const solo = song.tracks.some((t) => t.solo);
    eng.master.gain.value = song.master;
    for (const tr of song.tracks) {
      const c = ses.chain(tr);
      const audible = !tr.mute && (!solo || tr.solo);
      c.vol.gain.cancelScheduledValues(0); c.vol.gain.value = audible ? tr.vol * tr.vol : 0;
      if (c.pan) { c.pan.pan.cancelScheduledValues(0); c.pan.pan.value = tr.pan; }
      c.send.gain.cancelScheduledValues(0); c.send.gain.value = tr.rev * 0.6;
      if (!audible) continue;
      for (const n of tr.notes) {
        if (n.t < from || n.t >= to) continue;
        const t = 0.02 + (swingTick(n.t, song.swing) - from) * spt;
        playNote(eng, c.input, tr, t, n, Math.min(n.d, to - n.t) * spt);
      }
    }
    eng.master.gain.cancelScheduledValues(0); eng.master.gain.value = song.master;
    return ctx.startRendering();
  }

  function encodeWav(buf) {
    const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate;
    const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    w(36, 'data'); data.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let peak = 0;
    for (const c of chans) for (let i = 0; i < n; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a; }
    const norm = peak > 0.98 ? 0.98 / peak : 1; // 넘치면 줄여서 찢어지는 소리를 막는다
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i] * norm));
        data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
      }
    }
    return new Blob([data.buffer], { type: 'audio/wav' });
  }

  S.audio = { PRESETS, Engine, Session, Player, synthVoice, drumHit, playNote, render, encodeWav, swingTick };
})(globalThis.Studio = globalThis.Studio || {});
