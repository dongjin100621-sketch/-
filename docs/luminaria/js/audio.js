/* 루미나리아: Eight Fates — 배경음악 · 효과음
 * 음원 파일 없이 Web Audio로 악기를 합성하고, 아래 악보를 시퀀서로 연주한다.
 *
 * 곡 형식
 *   bpm, beats(한 마디 박자 수), chords: 마디마다 코드 (배열이면 마디를 나눔)
 *   parts: [{ type, inst, vol, rev(리버브), ... }]
 *     mel   : notes 'A5/1.5 F#5/.5 r/1 …' (음이름/박자, r은 쉼표, | 는 마디 구분용)
 *     pad   : 코드를 마디 길이만큼 지속
 *     bass  : pat — R 근음, F 5도, O 옥타브, 3 3도, - 늘임, . 쉼 (한 글자 = step 박)
 *     arp   : pat — 숫자는 코드 구성음 순번(아래부터), - 늘임, . 쉼
 *     chord : pat — X 화음, - 늘임, . 쉼
 *     drum  : pat — x 강, o 약, . 쉼
 */
const AUDIO = (() => {
'use strict';
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (s) => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m6: [0, 3, 7, 9], 6: [0, 4, 7, 9],
  sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 4, 7, 14], dim: [0, 3, 6], aug: [0, 4, 8], m7b5: [0, 3, 6, 10], 9: [0, 4, 7, 10, 14] };
function chord(name) {
  const m = /^([A-G][#b]?)(maj7|m7b5|m7|m6|m|7|6|9|sus4|sus2|add9|dim|aug)?(?:\/([A-G][#b]?))?$/.exec(name);
  const pc = (s) => (midi(s + '0') - 12 + 120) % 12;
  return { root: pc(m[1]), ints: QUAL[m[2] || ''], bass: m[3] ? pc(m[3]) : pc(m[1]) };
}
function voice(ch, center) {
  return ch.ints.map((i) => { const p = (ch.root + i) % 12; let n = center - 6 + ((p - (center - 6)) % 12 + 12) % 12; return n; }).sort((a, b) => a - b);
}

/* ───────────── 악보 ───────────── */
const TITLE_CH = ['Dmaj7', 'A/C#', 'Bm7', 'Gmaj7', 'Em7', 'A', 'Dmaj7', ['Asus4', 'A'], 'Gmaj7', 'A', 'F#m7', 'Bm7', 'Em7', 'A7', 'D', 'D'];
const TITLE_MEL = `A5/1.5 F#5/.5 E5/1 D5/1 | E5/1.5 F#5/.5 E5/2 | D5/1.5 C#5/.5 B4/1 F#5/1 | E5/3 r/1 |
  G5/1.5 F#5/.5 E5/1 B5/1 | A5/1.5 G5/.5 F#5/1 E5/1 | F#5/1 A5/1 D6/1.5 C#6/.5 | B5/2 A5/2 |
  B5/1.5 A5/.5 G5/1 D5/1 | C#5/1 E5/1 A5/2 | A5/1.5 F#5/.5 E5/1 C#5/1 | D5/1 F#5/1 B5/2 |
  G5/1.5 F#5/.5 E5/1 D5/1 | C#5/1 E5/1 G5/1 A5/1 | F#5/2 E5/1 D5/1 | D5/3 r/1`;

const TRACKS = {
  title: { name: 'Eight Fates', ko: '여덟 개의 운명', bpm: 72, chords: TITLE_CH, parts: [
    { type: 'pad', inst: 'pad', center: 60, vol: .13, rev: .55 },
    { type: 'arp', inst: 'harp', center: 57, pat: '01232123', vol: .17, rev: .5 },
    { type: 'bass', inst: 'bass', oct: 2, pat: 'R-------', vol: .22, rev: .2 },
    { type: 'mel', inst: 'bell', notes: TITLE_MEL, vol: .26, rev: .5, dly: .25 },
  ] },
  daily: { name: 'Academy Days', ko: '학원의 하루', bpm: 104,
    chords: ['G', 'D/F#', 'Em', 'C', 'G', 'D', 'C', 'D', 'Am7', 'D7', 'Bm7', 'Em7', 'Am7', 'D7', 'G', 'G'], parts: [
    { type: 'pad', inst: 'pad', center: 62, vol: .08, rev: .4 },
    { type: 'bass', inst: 'pizz', oct: 2, pat: 'R.F.R.F.', vol: .32, rev: .15 },
    { type: 'chord', inst: 'pluck', center: 62, pat: '.X.X.X.X', vol: .1, rev: .25 },
    { type: 'drum', inst: 'kick', pat: 'x...x...', vol: .28 },
    { type: 'drum', inst: 'shaker', pat: 'oxoxoxox', vol: .1 },
    { type: 'mel', inst: 'flute', vol: .26, rev: .35, notes: `
      D5/.5 G5/.5 B5/.5 A5/.5 G5/1 D5/1 | E5/.5 F#5/.5 A5/.5 F#5/.5 D5/2 | E5/.5 G5/.5 B5/1 A5/.5 G5/.5 E5/1 | G5/1 E5/.5 D5/.5 C5/2 |
      B4/.5 D5/.5 G5/.5 B5/.5 A5/1 G5/1 | F#5/.5 A5/.5 D6/1 C6/.5 B5/.5 A5/1 | G5/.5 E5/.5 C5/.5 E5/.5 G5/1 A5/1 | F#5/2 r/1 D5/1 |
      C6/1 B5/.5 A5/.5 E5/2 | F#5/.5 G5/.5 A5/.5 C6/.5 B5/1 A5/1 | D5/.5 F#5/.5 A5/1 B5/1 A5/1 | G5/1.5 F#5/.5 E5/1 D5/1 |
      E5/.5 A5/.5 C6/1 B5/.5 A5/.5 G5/1 | F#5/1 A5/1 C6/1 F#5/1 | G5/1.5 A5/.5 B5/1 D6/1 | G5/3 r/1` },
  ] },
  calm: { name: 'Quiet Afternoon', ko: '조용한 오후', bpm: 78,
    chords: ['Fmaj7', ['Em7', 'A7'], 'Dm7', 'Cmaj7', 'Bbmaj7', 'Am7', 'Gm7', ['Csus4', 'C7']], parts: [
    { type: 'pad', inst: 'pad', center: 60, vol: .1, rev: .5 },
    { type: 'arp', inst: 'harp', center: 55, pat: '0-2-1-3-', vol: .16, rev: .45 },
    { type: 'bass', inst: 'bass', oct: 2, pat: 'R-----F-', vol: .18, rev: .2 },
    { type: 'mel', inst: 'ep', vol: .22, rev: .45, dly: .2, notes: `
      A5/1 C6/1 E5/2 | G5/1 E5/1 C#5/1 E5/1 | F5/1.5 E5/.5 D5/2 | E5/1 G5/1 B5/2 |
      D6/1.5 C6/.5 A5/1 F5/1 | E5/1 G5/1 C6/2 | Bb5/1 A5/1 G5/1 F5/1 | G5/2 E5/2` },
  ] },
  romance: { name: 'Heartbeat', ko: '두근거림', bpm: 70,
    chords: ['C', 'G/B', 'Am7', 'Em/G', 'F', 'C/E', 'Dm7', 'G', 'F', 'G', 'Em7', 'Am7', 'Dm7', 'G', 'C', ['Gsus4', 'G']], parts: [
    { type: 'pad', inst: 'pad', center: 60, vol: .1, rev: .5 },
    { type: 'arp', inst: 'ep', center: 55, pat: '01232123', vol: .12, rev: .4 },
    { type: 'bass', inst: 'bass', oct: 2, pat: 'R---F---', vol: .2, rev: .2 },
    { type: 'mel', inst: 'strings', vol: .2, rev: .5, notes: `
      E5/1.5 D5/.5 C5/1 G5/1 | D5/2 B4/1 D5/1 | C5/1.5 B4/.5 A4/1 E5/1 | G5/2 E5/2 |
      A5/1.5 G5/.5 F5/1 C5/1 | G5/1.5 F5/.5 E5/1 C5/1 | F5/1 E5/1 D5/1 A5/1 | G5/3 r/1 |
      C6/1.5 A5/.5 F5/2 | D6/1.5 B5/.5 G5/2 | B5/1 G5/1 E5/1 D5/1 | C6/2 A5/2 |
      D6/1.5 C6/.5 A5/1 F5/1 | B5/1 A5/1 G5/1 D5/1 | E5/1.5 G5/.5 C6/2 | D6/2 B5/2` },
  ] },
  sad: { name: 'Unspoken', ko: '말하지 못한 것', bpm: 62,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'Dm', 'Esus4', 'E'], parts: [
    { type: 'pad', inst: 'strings', center: 57, vol: .07, rev: .6 },
    { type: 'arp', inst: 'harp', center: 52, pat: '0.1.2.1.', vol: .14, rev: .5 },
    { type: 'bass', inst: 'bass', oct: 2, pat: 'R-------', vol: .18, rev: .3 },
    { type: 'mel', inst: 'ep', vol: .28, rev: .55, dly: .22, notes: `
      E5/2 C5/1 A4/1 | A4/1.5 C5/.5 F5/2 | E5/2 G5/1 E5/1 | D5/3 r/1 |
      C5/1 E5/1 A5/2 | F5/1.5 E5/.5 D5/2 | D5/1 C5/1 B4/2 | G#4/3 r/1` },
  ] },
  mystery: { name: 'Flicker', ko: '흔들리는 별등', bpm: 58,
    chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Eb', 'A7'], parts: [
    { type: 'pad', inst: 'choir', center: 57, vol: .12, rev: .7 },
    { type: 'arp', inst: 'harp', center: 50, pat: '0.2.1.3.', vol: .14, rev: .6 },
    { type: 'bass', inst: 'bass', oct: 1, pat: 'R-------', vol: .24, rev: .3 },
    { type: 'drum', inst: 'tri', pat: '........x.......', step: .5, vol: .05 },
    { type: 'mel', inst: 'bell', vol: .2, rev: .7, dly: .3, notes: `
      A5/3 r/1 | F5/1 D5/1 Bb4/2 | G5/2 F5/1 D5/1 | E5/2 C#5/2 |
      D6/2 A5/2 | Bb5/1 A5/1 F5/2 | G5/2 Bb5/1 G5/1 | C#5/2 E5/1 G5/1` },
  ] },
  battle: { name: 'Ruins Run', ko: '유적 질주', bpm: 132,
    chords: ['Em', 'C', 'D', 'B7', 'Em', 'C', 'Am', 'B7'], parts: [
    { type: 'bass', inst: 'bass', oct: 2, pat: 'RRRRRROR', vol: .22, rev: .1 },
    { type: 'chord', inst: 'strings', center: 60, pat: 'X--.X-X-', vol: .07, rev: .3 },
    { type: 'drum', inst: 'kick', pat: 'x..xx...', vol: .34 },
    { type: 'drum', inst: 'snare', pat: '....x...', vol: .2 },
    { type: 'drum', inst: 'hat', pat: 'xoxoxoxo', vol: .08 },
    { type: 'mel', inst: 'lead', vol: .14, rev: .3, notes: `
      E5/1 G5/1 B5/1.5 A5/.5 | G5/1 E5/1 C5/2 | D5/1 F#5/1 A5/1.5 G5/.5 | F#5/2 D#5/2 |
      E5/.5 F#5/.5 G5/1 B5/1 E6/1 | E6/1.5 D6/.5 C6/1 G5/1 | A5/1 C6/1 E6/1.5 D6/.5 | D#6/2 B5/2` },
  ] },
  market: { name: 'Guild Street', ko: '길드 거리', bpm: 112,
    chords: ['Am', 'G', 'Am', 'Em', 'F', 'G', 'Am', 'E7'], parts: [
    { type: 'bass', inst: 'pizz', oct: 2, pat: 'R.F.R.F.', vol: .32, rev: .15 },
    { type: 'chord', inst: 'acc', center: 60, pat: '.X.X.X.X', vol: .06, rev: .2 },
    { type: 'drum', inst: 'kick', pat: 'x...x...', vol: .26 },
    { type: 'drum', inst: 'tamb', pat: '..x...x.', vol: .12 },
    { type: 'mel', inst: 'acc', vol: .15, rev: .25, notes: `
      A4/.5 C5/.5 E5/.5 A5/.5 G5/.5 E5/.5 C5/1 | B4/.5 D5/.5 G5/.5 B4/.5 D5/1 G5/1 | A5/.5 G5/.5 E5/.5 C5/.5 D5/.5 E5/.5 A4/1 | B4/1 E5/.5 G5/.5 B5/2 |
      A5/.5 G5/.5 F5/.5 E5/.5 F5/1 C5/1 | D5/.5 E5/.5 G5/.5 B5/.5 D6/1 B5/1 | C6/.5 B5/.5 A5/.5 E5/.5 C5/.5 B4/.5 A4/1 | G#4/1 B4/1 D5/1 E5/1` },
  ] },
  festival: { name: 'Starlight Waltz', ko: '별빛 왈츠', bpm: 138, beats: 3,
    chords: ['F', 'F', 'C7', 'C7', 'C7', 'C7', 'F', 'F', 'F', 'F7', 'Bb', 'Bb', 'F/C', 'C7', 'F', 'F'], parts: [
    { type: 'bass', inst: 'pizz', oct: 2, pat: 'R-....', vol: .34, rev: .2 },
    { type: 'chord', inst: 'pluck', center: 62, pat: '..X.X.', vol: .12, rev: .3 },
    { type: 'drum', inst: 'tamb', pat: '..o.o.', vol: .1 },
    { type: 'drum', inst: 'tri', pat: 'x.....', vol: .04 },
    { type: 'mel', inst: 'flute', vol: .22, rev: .35, notes: `
      C5/1 F5/1 A5/1 | C6/2 A5/1 | G5/1 Bb5/1 G5/1 | E5/2 C5/1 | Bb4/1 C5/1 E5/1 | G5/2 Bb5/1 | A5/1 G5/1 F5/1 | F5/2 r/1 |
      A5/1 C6/1 A5/1 | Eb6/2 C6/1 | D6/1 C6/1 Bb5/1 | F5/2 D5/1 | C6/1 A5/1 F5/1 | G5/1 Bb5/1 E5/1 | F5/1 A5/1 C6/1 | F6/2 r/1` },
    { type: 'mel', inst: 'bell', vol: .1, rev: .4, oct: -12, notes: `
      C5/1 F5/1 A5/1 | C6/2 A5/1 | G5/1 Bb5/1 G5/1 | E5/2 C5/1 | Bb4/1 C5/1 E5/1 | G5/2 Bb5/1 | A5/1 G5/1 F5/1 | F5/2 r/1 |
      A5/1 C6/1 A5/1 | Eb6/2 C6/1 | D6/1 C6/1 Bb5/1 | F5/2 D5/1 | C6/1 A5/1 F5/1 | G5/1 Bb5/1 E5/1 | F5/1 A5/1 C6/1 | F6/2 r/1`, shift: 12 },
  ] },
  ending: { name: 'Eight Fates (Reprise)', ko: '여덟 개의 운명 (재현)', bpm: 66, chords: TITLE_CH, parts: [
    { type: 'pad', inst: 'pad', center: 60, vol: .12, rev: .6 },
    { type: 'arp', inst: 'ep', center: 55, pat: '01232123', vol: .1, rev: .45 },
    { type: 'bass', inst: 'bass', oct: 2, pat: 'R---F---', vol: .2, rev: .25 },
    { type: 'mel', inst: 'strings', notes: TITLE_MEL, vol: .18, rev: .55 },
    { type: 'mel', inst: 'bell', notes: TITLE_MEL, shift: 12, vol: .08, rev: .6, dly: .2 },
  ] },
};

/* 악보 → 이벤트 목록 */
function compile(tr) {
  const B = tr.beats || 4, nb = tr.chords.length, ev = [];
  const chordAt = (bar, off) => { const c = tr.chords[bar]; if (!Array.isArray(c)) return chord(c); return chord(c[Math.min(c.length - 1, Math.floor(off / (B / c.length)))]); };
  tr.parts.forEach((p, pi) => {
    const step = p.step || .5;
    if (p.type === 'mel') {
      let beat = 0;
      for (const tok of p.notes.split(/\s+/)) {
        if (!tok || tok === '|') continue;
        const [n, d] = tok.split('/'); const dur = +(d || 1);
        if (n !== 'r') ev.push({ beat, pi, notes: [midi(n) + (p.shift || 0)], dur, vel: beat % B === 0 ? 1 : .85 });
        beat += dur;
      }
      if (Math.abs(beat - nb * B) > 1e-6) console.warn(`[audio] ${tr.name} 선율 길이 ${beat} ≠ ${nb * B}`);
      return;
    }
    for (let bar = 0; bar < nb; bar++) {
      if (p.type === 'pad') {
        const cs = Array.isArray(tr.chords[bar]) ? tr.chords[bar] : [tr.chords[bar]];
        const len = B / cs.length;
        cs.forEach((c, i) => ev.push({ beat: bar * B + i * len, pi, notes: voice(chord(c), p.center), dur: len, vel: 1 }));
        continue;
      }
      const pat = Array.isArray(p.pat) ? p.pat[bar % p.pat.length] : p.pat;
      for (let i = 0; i < pat.length; i++) {
        const k = pat[i]; if (k === '.' || k === '-') continue;
        let len = 1; while (pat[i + len] === '-') len++;
        const off = i * step; if (off >= B) break;
        const beat = bar * B + off, dur = len * step, ch = chordAt(bar, off);
        if (p.type === 'drum') { ev.push({ beat, pi, drum: true, dur, vel: k === 'x' ? 1 : .55 }); continue; }
        let notes;
        if (p.type === 'bass') {
          const base = 12 * (p.oct + 1) + ch.bass, r = 12 * (p.oct + 1) + ch.root;
          notes = [k === 'R' ? base : k === 'F' ? r + 7 : k === 'O' ? base + 12 : r + ch.ints[1]];
        } else if (p.type === 'arp') {
          const v = voice(ch, p.center); const all = v.concat(v.map((n) => n + 12), v.map((n) => n + 24));
          notes = [all[+k]];
        } else notes = voice(ch, p.center);
        ev.push({ beat, pi, notes, dur, vel: off === 0 ? 1 : .8 });
      }
    }
  });
  ev.sort((a, b) => a.beat - b.beat);
  return { ev, len: nb * B };
}

/* ───────────── 합성 ───────────── */
let ctx = null, comp, musicBus, sfxBus, reverb, noiseBuf;
let vol = { bgm: .6, sfx: .7 };
function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = vol.bgm; musicBus.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
  // 리버브: 감쇠하는 잡음으로 만든 잔향
  const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) { lp += .35 * ((Math.random() * 2 - 1) - lp); d[i] = lp * (1 - i / len) ** 2.6; }
  }
  reverb = ctx.createConvolver(); reverb.buffer = ir;
  const rv = ctx.createGain(); rv.gain.value = .9; reverb.connect(rv); rv.connect(musicBus);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return true;
}
const osc = (type, f, t, end, dest, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; };
const gain = (dest, v = 0) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; };
function adsr(g, t, a, peak, tau, sus, end, rel) {
  end = Math.max(end, t + a + .01);
  g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + a);
  g.setTargetAtTime(peak * sus, t + a, tau); g.setTargetAtTime(0, end, rel);
  return end + rel * 6;
}
const noise = (t, end, dest) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(dest); s.start(t); s.stop(end); return s; };
const filt = (type, f, q, dest) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
function vibrato(oscs, t, rate, cents, delay) {
  const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate;
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(cents, t + delay + .3);
  l.connect(lg); oscs.forEach((o) => lg.connect(o.detune)); l.start(t); return l;
}

const INST = {
  bell(d, t, f, dur, v) {
    let stop = t;
    [[1, 1, 1.4], [2.01, .32, .5], [3.98, .16, .25], [5.43, .06, .12]].forEach(([r, a, tau]) => {
      const g = gain(d); const end = adsr(g.gain, t, .004, v * a, tau, 0, t + dur + .8, .3);
      osc('sine', f * r, t, end, g); stop = Math.max(stop, end);
    });
  },
  harp(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', f * 6, .7, g);
    lp.frequency.setValueAtTime(f * 7, t); lp.frequency.setTargetAtTime(f * 1.6, t, .25);
    const end = adsr(g.gain, t, .003, v, .7, 0, t + dur + 1, .4);
    osc('triangle', f, t, end, lp); osc('sine', f * 2, t, end, gain(lp, .25));
  },
  pluck(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', f * 4, .8, g);
    lp.frequency.setTargetAtTime(f * 1.2, t, .08);
    const end = adsr(g.gain, t, .003, v, .18, 0, t + Math.min(dur, .3), .12);
    osc('triangle', f, t, end, lp); osc('sawtooth', f, t, end, gain(lp, .2));
  },
  ep(d, t, f, dur, v) {
    const g = gain(d), end = adsr(g.gain, t, .005, v, .5, .35, t + dur, .3);
    const c = osc('sine', f, t, end, g), m = ctx.createOscillator(), mg = ctx.createGain();
    m.frequency.value = f; mg.gain.setValueAtTime(f * 1.8, t); mg.gain.setTargetAtTime(f * .25, t, .35);
    m.connect(mg); mg.connect(c.frequency); m.start(t); m.stop(end);
    const tg = gain(d); adsr(tg.gain, t, .002, v * .07, .1, 0, t + .25, .05); osc('sine', f * 4, t, t + .8, tg);
  },
  pad(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', 1300, .4, g);
    const end = adsr(g.gain, t, .7, v, 1, 1, t + dur, .5);
    osc('sawtooth', f, t, end, lp, -7); osc('sawtooth', f, t, end, lp, 7); osc('triangle', f / 2, t, end, gain(lp, .5));
  },
  strings(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', Math.min(5000, f * 5), .5, g);
    const end = adsr(g.gain, t, .18, v, 1, 1, t + dur, .28);
    const a = osc('sawtooth', f, t, end, lp, -8), b = osc('sawtooth', f, t, end, lp, 8);
    vibrato([a, b], t, 5.2, 9, .25).stop(end);
  },
  choir(d, t, f, dur, v) {
    const g = gain(d), f1 = filt('bandpass', 750, 3, g), f2 = filt('bandpass', 1150, 4, g);
    const end = adsr(g.gain, t, .9, v * 2.2, 1, 1, t + dur, .8);
    [-9, 0, 9].forEach((dt) => { const o = osc('sawtooth', f, t, end, f1, dt); o.connect(f2); });
  },
  flute(d, t, f, dur, v) {
    const g = gain(d), end = adsr(g.gain, t, .05, v, .4, .8, t + dur * .95, .12);
    const a = osc('sine', f, t, end, g), b = osc('triangle', f, t, end, gain(g, .25));
    vibrato([a, b], t, 5.4, 12, .2).stop(end);
    const bg = gain(d), bend = adsr(bg.gain, t, .02, v * .12, .05, .1, t + .12, .05); noise(t, bend, filt('bandpass', f * 2, 2, bg));
  },
  acc(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', 2200, .6, g);
    const end = adsr(g.gain, t, .03, v, .3, .85, t + dur * .9, .06);
    osc('square', f, t, end, lp, -6); osc('square', f, t, end, lp, 6); osc('sawtooth', f / 2, t, end, gain(lp, .3));
  },
  lead(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', 1800, 2, g);
    lp.frequency.setValueAtTime(3600, t); lp.frequency.setTargetAtTime(1600, t, .15);
    const end = adsr(g.gain, t, .02, v, .3, .75, t + dur * .95, .1);
    const a = osc('sawtooth', f, t, end, lp, -5), b = osc('square', f, t, end, gain(lp, .4), 5);
    vibrato([a, b], t, 5.5, 10, .3).stop(end);
  },
  bass(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', 650, .7, g);
    const end = adsr(g.gain, t, .01, v, .5, .6, t + dur * .95, .08);
    osc('triangle', f, t, end, lp); osc('sine', f, t, end, gain(lp, .8));
  },
  pizz(d, t, f, dur, v) {
    const g = gain(d), lp = filt('lowpass', f * 5, 1, g);
    const end = adsr(g.gain, t, .004, v, .16, 0, t + .35, .08);
    osc('triangle', f, t, end, lp); osc('sine', f, t, end, gain(lp, .7));
  },
  kick(d, t, f, dur, v) {
    const g = gain(d), o = osc('sine', 140, t, t + .5, g);
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
    adsr(g.gain, t, .003, v, .12, 0, t + .3, .05);
  },
  snare(d, t, f, dur, v) {
    const g = gain(d); adsr(g.gain, t, .002, v, .07, 0, t + .2, .03); noise(t, t + .4, filt('bandpass', 1900, .8, g));
    const g2 = gain(d); adsr(g2.gain, t, .002, v * .6, .05, 0, t + .1, .03); osc('triangle', 185, t, t + .3, g2);
  },
  hat(d, t, f, dur, v) { const g = gain(d); adsr(g.gain, t, .001, v, .025, 0, t + .06, .02); noise(t, t + .2, filt('highpass', 7500, .7, g)); },
  shaker(d, t, f, dur, v) { const g = gain(d); adsr(g.gain, t, .012, v, .035, 0, t + .08, .02); noise(t, t + .2, filt('bandpass', 5200, 1.4, g)); },
  tamb(d, t, f, dur, v) { const g = gain(d); adsr(g.gain, t, .002, v, .09, 0, t + .2, .05); noise(t, t + .5, filt('highpass', 6000, 1, g)); },
  tri(d, t, f, dur, v) { const g = gain(d); const end = adsr(g.gain, t, .002, v, .7, 0, t + 1.5, .5); osc('sine', 2600, t, end, g); osc('sine', 6900, t, end, gain(g, .3)); },
};

/* ───────────── 재생기 ───────────── */
const AHEAD = .16;
let cur = null, wanted = null, timer = null;
const cache = {};
class Player {
  constructor(id) {
    const tr = TRACKS[id];
    this.id = id; this.tr = tr; this.c = cache[id] || (cache[id] = compile(tr));
    this.spb = 60 / tr.bpm;
    this.out = gain(musicBus, 0);
    this.out.gain.setValueAtTime(0, ctx.currentTime); this.out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    this.sends = []; this.extra = [];
    let dly = null;
    if (tr.parts.some((p) => p.dly)) {
      dly = ctx.createDelay(1); dly.delayTime.value = this.spb * .75;
      const fb = gain(dly, .32), wet = gain(this.out, .6); dly.connect(fb); dly.connect(wet);
      this.extra.push(dly, fb, wet);
    }
    this.parts = tr.parts.map((p) => {
      const g = gain(this.out, p.vol);
      if (p.rev) { const s = gain(reverb, p.rev); g.connect(s); this.sends.push(s); }
      if (p.dly && dly) { const s = gain(dly, p.dly); g.connect(s); this.extra.push(s); }
      return g;
    });
    this.loopStart = ctx.currentTime + .08; this.i = 0;
  }
  tick(now) {
    const { ev, len } = this.c, L = len * this.spb;
    if (this.loopStart + L < now) this.loopStart += Math.floor((now - this.loopStart) / L) * L;
    for (let guard = 0; guard < 400; guard++) {
      const e = ev[this.i], t = this.loopStart + e.beat * this.spb;
      if (t > now + AHEAD) break;
      if (t >= now - .03) this.note(e, t);
      if (++this.i >= ev.length) { this.i = 0; this.loopStart += L; }
    }
  }
  note(e, t) {
    const p = this.tr.parts[e.pi], fn = INST[p.inst], d = this.parts[e.pi];
    const v = e.vel * (.92 + Math.random() * .16);
    if (e.drum) { fn(d, t, 0, e.dur * this.spb, v); return; }
    const jt = t + Math.random() * .008;
    for (const n of e.notes) fn(d, jt, hz(n), e.dur * this.spb, v);
  }
  stop(fade = 1) {
    const t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(this.out.gain.value, t); this.out.gain.linearRampToValueAtTime(0, t + fade);
    this.sends.forEach((s) => { s.gain.cancelScheduledValues(t); s.gain.setValueAtTime(s.gain.value, t); s.gain.linearRampToValueAtTime(0, t + fade); });
    setTimeout(() => { try { [this.out, ...this.sends, ...this.extra].forEach((n) => n.disconnect()); } catch { /* 무시 */ } }, (fade + 4) * 1000);
  }
}
function loop() { if (cur && ctx.state === 'running') cur.tick(ctx.currentTime); }

function bgm(id) {
  if (id && !TRACKS[id]) return;
  wanted = id || null;
  if (!ctx || ctx.state !== 'running') return;
  if (cur && cur.id === wanted) return;
  if (cur) { cur.stop(id ? 1.2 : 1.6); cur = null; }
  if (wanted && vol.bgm > 0) { cur = new Player(wanted); if (heardCb) heardCb(wanted); }
  if (!timer) timer = setInterval(loop, 30);
}

/* ───────────── 효과음 ───────────── */
const SFX = {
  click: () => { const t = ctx.currentTime, g = gain(sfxBus); adsr(g.gain, t, .002, .12, .03, 0, t + .05, .02); osc('sine', 1700, t, t + .15, g); },
  select: () => { const t = ctx.currentTime; INST.bell(sfxBus, t, hz(88), .2, .16); INST.bell(sfxBus, t + .07, hz(95), .3, .14); },
  heart: () => { const t = ctx.currentTime; [84, 88, 91, 96].forEach((n, i) => INST.bell(sfxBus, t + i * .06, hz(n), .3, .13)); },
  down: () => { const t = ctx.currentTime; INST.harp(sfxBus, t, hz(64), .3, .25); INST.harp(sfxBus, t + .12, hz(60), .5, .22); },
  coin: () => { const t = ctx.currentTime; [[83, 0], [88, .08]].forEach(([n, dt]) => { const g = gain(sfxBus); adsr(g.gain, t + dt, .002, .07, .12, 0, t + dt + .25, .05); osc('square', hz(n), t + dt, t + dt + .6, g); }); },
  day: () => { const t = ctx.currentTime, s = gain(reverb, .5); [79, 86, 91, 98].forEach((n, i) => { INST.bell(sfxBus, t + i * .12, hz(n), 1, .14); INST.bell(s, t + i * .12, hz(n), 1, .1); }); },
  event: () => { const t = ctx.currentTime, s = gain(reverb, .6); [72, 74, 76, 79, 81, 84, 86, 88, 91].forEach((n, i) => { INST.harp(sfxBus, t + i * .045, hz(n), .5, .12); INST.harp(s, t + i * .045, hz(n), .5, .08); }); },
  page: () => { const t = ctx.currentTime, g = gain(sfxBus), bp = filt('bandpass', 900, 1.2, g); bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(3200, t + .18); adsr(g.gain, t, .04, .1, .06, 0, t + .14, .04); noise(t, t + .4, bp); },
  save: () => { const t = ctx.currentTime; INST.bell(sfxBus, t, hz(91), .4, .12); INST.bell(sfxBus, t + .1, hz(96), .6, .12); },
};
function sfx(name) {
  if (!ctx || ctx.state !== 'running' || vol.sfx <= 0 || !SFX[name]) return;
  try { SFX[name](); } catch { /* 무시 */ }
}

/* ───────────── 잠금 해제 · 설정 ───────────── */
let heardCb = null;
function unlock() {
  if (!init()) return;
  if (ctx.state === 'running') { if (wanted && (!cur || cur.id !== wanted)) bgm(wanted); return; }
  ctx.resume().then(() => bgm(wanted)).catch(() => {});
  // 옛 iOS: 무음 버퍼를 한 번 재생해야 열린다
  const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0);
}
['pointerdown', 'touchend', 'click', 'keydown'].forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().then(() => bgm(wanted)).catch(() => {});
});
function setVol(kind, v) {
  vol[kind] = v;
  if (!ctx) return;
  const bus = kind === 'bgm' ? musicBus : sfxBus;
  bus.gain.setTargetAtTime(v, ctx.currentTime, .05);
  if (kind === 'bgm') { if (v === 0 && cur) { cur.stop(.5); cur = null; } else if (v > 0) bgm(wanted); }
}
function setPlayback(on) { try { if (navigator.audioSession) navigator.audioSession.type = on ? 'playback' : 'auto'; } catch { /* 미지원 */ } }

return {
  bgm, sfx, setVol, setPlayback, unlock,
  get current() { return wanted; },
  get running() { return !!ctx && ctx.state === 'running'; },
  onHeard(cb) { heardCb = cb; },
  tracks: Object.fromEntries(Object.entries(TRACKS).map(([k, t]) => [k, { name: t.name, ko: t.ko }])),
  _compile: (id) => compile(TRACKS[id]),
  _debug: () => ({ ctx, comp }),
};
})();
