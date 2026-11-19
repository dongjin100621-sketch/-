'use strict';
/* 효과음과 배경음 — WebAudio로 즉석 합성(파일 없음) */
const SND = {
  ac: null, master: null, sfxG: null, bgmG: null, on: true, bgmOn: true, cur: null, step: 0, next: 0, timer: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ac.destination);
    this.sfxG = this.ac.createGain(); this.sfxG.gain.value = 0.55; this.sfxG.connect(this.master);
    this.bgmG = this.ac.createGain(); this.bgmG.gain.value = 0.22; this.bgmG.connect(this.master);
    const len = this.ac.sampleRate * 0.5; this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this.tick(), 50);
  },
  setOpts(sfx, bgm) { this.on = sfx; this.bgmOn = bgm; if (this.bgmG) this.bgmG.gain.value = bgm ? 0.22 : 0; },
  tone(f, dur, type = 'square', vol = 0.3, slide = 0, out) {
    if (!this.ac || !this.on && !out) return;
    const t = this.ac.currentTime, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out || this.sfxG); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, hp = 800, out, when = 0) {
    if (!this.ac || !this.on && !out) return;
    const t = this.ac.currentTime + when, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || this.sfxG); s.start(t); s.stop(t + dur + 0.02);
  },
  play(k) {
    if (!this.ac || !this.on) return;
    switch (k) {
      case 'slash': this.noise(0.12, 0.35, 2500); this.tone(900, 0.08, 'sawtooth', 0.08, -600); break;
      case 'shot': this.noise(0.08, 0.4, 1200); this.tone(220, 0.08, 'square', 0.15, -150); break;
      case 'heavy': this.noise(0.25, 0.5, 300); this.tone(110, 0.25, 'sawtooth', 0.3, -70); break;
      case 'hit': this.tone(180, 0.07, 'square', 0.18, -100); this.noise(0.05, 0.2, 3000); break;
      case 'crit': this.tone(1200, 0.12, 'square', 0.15, 600); this.noise(0.08, 0.3, 4000); break;
      case 'hurt': this.tone(140, 0.2, 'sawtooth', 0.3, -80); break;
      case 'jump': this.tone(300, 0.12, 'square', 0.12, 300); break;
      case 'dash': this.noise(0.18, 0.3, 1800); this.tone(500, 0.15, 'sine', 0.1, 700); break;
      case 'boom': this.noise(0.6, 0.6, 120); this.tone(80, 0.5, 'sawtooth', 0.35, -50); break;
      case 'skill': this.tone(440, 0.25, 'sawtooth', 0.15, 880); this.tone(660, 0.3, 'square', 0.08, 660); break;
      case 'ult': [0, 0.08, 0.16].forEach((w, i) => setTimeout(() => this.tone(330 * (i + 1), 0.4, 'sawtooth', 0.14, 300), w * 1000)); this.noise(0.8, 0.3, 500); break;
      case 'hack': this.tone(1400, 0.05, 'square', 0.1); setTimeout(() => this.tone(1800, 0.05, 'square', 0.1), 60); setTimeout(() => this.tone(1000, 0.15, 'square', 0.1, -500), 120); break;
      case 'coin': this.tone(1320, 0.07, 'square', 0.08); setTimeout(() => this.tone(1760, 0.1, 'square', 0.08), 70); break;
      case 'item': this.tone(880, 0.1, 'triangle', 0.15); setTimeout(() => this.tone(1320, 0.15, 'triangle', 0.15), 90); break;
      case 'heal': [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'triangle', 0.12), i * 70)); break;
      case 'level': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'square', 0.12), i * 90)); break;
      case 'quest': [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.14), i * 110)); break;
      case 'ui': this.tone(1000, 0.04, 'square', 0.06); break;
      case 'talk': this.tone(700 + Math.random() * 200, 0.03, 'square', 0.03); break;
      case 'heart': this.tone(880, 0.15, 'sine', 0.2); setTimeout(() => this.tone(1175, 0.3, 'sine', 0.2), 120); break;
      case 'deny': this.tone(200, 0.15, 'square', 0.12, -60); break;
      case 'warn': this.tone(600, 0.1, 'square', 0.12); setTimeout(() => this.tone(600, 0.1, 'square', 0.12), 160); break;
      case 'die': this.tone(400, 0.8, 'sawtooth', 0.25, -360); break;
    }
  },
  /* 배경음: 지역 분위기별 신스웨이브 루프 */
  SONGS: {
    calm:   { bpm: 84,  root: 57, prog: [0, -4, -7, -2], arp: [0, 7, 12, 15, 12, 7], bass: 'triangle', lead: 'sine', drums: 0.5 },
    city:   { bpm: 100, root: 52, prog: [0, -3, 5, 3], arp: [0, 3, 7, 10, 12, 10, 7, 3], bass: 'sawtooth', lead: 'square', drums: 1 },
    fight:  { bpm: 128, root: 50, prog: [0, 0, -2, -4], arp: [0, 12, 7, 12, 3, 12, 7, 15], bass: 'sawtooth', lead: 'sawtooth', drums: 1.3 },
    boss:   { bpm: 140, root: 45, prog: [0, 1, 0, -2], arp: [0, 3, 6, 12, 6, 3, 0, 15], bass: 'sawtooth', lead: 'square', drums: 1.6 },
    sacred: { bpm: 72,  root: 50, prog: [0, 5, 3, -2], arp: [0, 7, 14, 19, 14, 7], bass: 'triangle', lead: 'triangle', drums: 0.4 },
  },
  music(name) {
    if (this.cur === name) return;
    this.cur = name; this.step = 0; if (this.ac) this.next = this.ac.currentTime + 0.1;
  },
  tick() {
    if (!this.ac || !this.cur || !this.bgmOn) return;
    const S = this.SONGS[this.cur]; const spb = 60 / S.bpm / 2; // 8분음표
    while (this.next < this.ac.currentTime + 0.2) {
      const t = this.next, st = this.step, bar = Math.floor(st / 16) % S.prog.length, root = S.root + S.prog[bar];
      const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
      const note = (n, dur, type, vol, when) => { const o = this.ac.createOscillator(), g = this.ac.createGain(); o.type = type; o.frequency.value = hz(n); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, when + dur); o.connect(g); g.connect(this.bgmG); o.start(when); o.stop(when + dur + 0.05); };
      if (st % 2 === 0) note(root - 12, spb * 1.8, S.bass, 0.32, t);
      note(root + 12 + S.arp[st % S.arp.length], spb * 0.9, S.lead, 0.07, t);
      if (st % 16 === 0) { note(root + 24, spb * 8, 'triangle', 0.05, t); note(root + 31, spb * 8, 'triangle', 0.035, t); }
      if (S.drums) {
        const kick = (when) => { const o = this.ac.createOscillator(), g = this.ac.createGain(); o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(40, when + 0.15); g.gain.setValueAtTime(0.6 * S.drums, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.2); o.connect(g); g.connect(this.bgmG); o.start(when); o.stop(when + 0.25); };
        if (st % 4 === 0) kick(t);
        if (st % 8 === 4) this.noise(0.15, 0.25 * S.drums, 1500, this.bgmG, t - this.ac.currentTime);
        if (S.drums > 0.9 && st % 2 === 1) this.noise(0.04, 0.08 * S.drums, 7000, this.bgmG, t - this.ac.currentTime);
      }
      this.next += spb; this.step++;
    }
  },
};
