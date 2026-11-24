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

  /* J-pop 에서 자주 쓰는 신스·관현악 소리 */
  Object.assign(PRESETS, {
    supersaw: {
      osc: [-32, -20, -9, 0, 9, 20, 32].map((d) => ({ type: 'sawtooth', ratio: 1, detune: d, gain: 0.13 })).concat([{ type: 'sawtooth', ratio: 0.5, gain: 0.1 }]),
      filter: { type: 'lowpass', freq: 3000, env: 2400, decay: 0.4, q: 0.7, key: 0.3 },
      env: { a: 0.01, d: 0.3, s: 0.8, r: 0.25 }, gain: 0.52,
    },
    synbrass: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -10, gain: 0.35 }, { type: 'sawtooth', ratio: 1, detune: 10, gain: 0.35 }, { type: 'square', ratio: 0.5, gain: 0.1 }],
      filter: { type: 'lowpass', freq: 420, env: 3200, decay: 0.5, attack: 0.07, q: 1.6, key: 0.4 },
      env: { a: 0.03, d: 0.4, s: 0.7, r: 0.2 }, gain: 0.56,
    },
    chip: {
      osc: [{ type: 'square', ratio: 1, gain: 0.5 }],
      env: { a: 0.002, d: 0.12, s: 0.7, r: 0.04 }, vib: { rate: 6, depth: 14, delay: 0.3 }, gain: 0.6,
    },
    glock: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.6 }, { type: 'sine', ratio: 2.76, gain: 0.25 }, { type: 'sine', ratio: 5.4, gain: 0.1 }],
      env: { a: 0.001, d: 1.5, s: 0, r: 0.4 }, keyDecay: true, gain: 0.42,
    },
    musicbox: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.7 }, { type: 'sine', ratio: 4, gain: 0.12 }, { type: 'sine', ratio: 2, gain: 0.08 }],
      fm: { ratio: 7, index: 0.35, decay: 0.04 },
      env: { a: 0.001, d: 1.9, s: 0, r: 0.5 }, keyDecay: true, gain: 0.48,
    },
    sax: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.55 }, { type: 'square', ratio: 1, detune: 4, gain: 0.15 }],
      filter: { type: 'lowpass', freq: 1500, env: 1800, decay: 0.3, q: 1, key: 0.5 },
      formants: [[650, 3, 1], [1250, 4, 0.7], [2600, 5, 0.35]],
      noise: { gain: 0.05, freq: 3000 },
      env: { a: 0.05, d: 0.3, s: 0.85, r: 0.12 }, vib: { rate: 5, depth: 14, delay: 0.25 }, gain: 1.1,
    },
    violin: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -4, gain: 0.4 }, { type: 'sawtooth', ratio: 1, detune: 4, gain: 0.4 }],
      filter: { type: 'lowpass', freq: 5200, env: 0, decay: 1, q: 0.5 },
      formants: [[450, 2, 1], [1100, 2.5, 0.8], [2800, 3, 0.6]],
      env: { a: 0.09, d: 0.3, s: 0.9, r: 0.25 }, vib: { rate: 5.8, depth: 18, delay: 0.2 }, gain: 0.9,
    },
    choir: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -9, gain: 0.3 }, { type: 'sawtooth', ratio: 1, detune: 9, gain: 0.3 }, { type: 'sawtooth', ratio: 1, gain: 0.3 }, { type: 'triangle', ratio: 1, gain: 0.3 }],
      formants: [[730, 8, 1], [1090, 9, 0.5], [2440, 10, 0.25]],
      env: { a: 0.35, d: 0.5, s: 0.85, r: 0.6 }, vib: { rate: 4.5, depth: 8, delay: 0.3 }, gain: 1.6,
    },
    shakuhachi: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.8 }, { type: 'triangle', ratio: 2, gain: 0.05 }],
      noise: { gain: 0.16, freq: 1800 },
      env: { a: 0.1, d: 0.3, s: 0.8, r: 0.15 }, vib: { rate: 4.5, depth: 20, delay: 0.35 }, gain: 0.5,
    },
  });

  /* 현대 작곡에서 자주 쓰는 소리들 */
  Object.assign(PRESETS, {
    wurli: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.8 }, { type: 'triangle', ratio: 1, gain: 0.2 }],
      fm: { ratio: 1, index: 1.4, decay: 0.5 }, drive: 1.4,
      env: { a: 0.002, d: 1.4, s: 0.2, r: 0.3 }, keyDecay: true, trem: { rate: 5.5, depth: 0.08 }, gain: 0.5,
    },
    vibes: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.75 }, { type: 'sine', ratio: 4, gain: 0.1 }, { type: 'sine', ratio: 10, gain: 0.03 }],
      env: { a: 0.002, d: 3, s: 0, r: 0.8 }, keyDecay: true, trem: { rate: 5, depth: 0.25 }, gain: 0.45,
    },
    marimba: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.85 }, { type: 'sine', ratio: 4, gain: 0.18 }, { type: 'sine', ratio: 9.9, gain: 0.04 }],
      env: { a: 0.001, d: 0.7, s: 0, r: 0.2 }, keyDecay: true, gain: 0.55,
    },
    xylo: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.7 }, { type: 'sine', ratio: 3, gain: 0.28 }, { type: 'sine', ratio: 6.2, gain: 0.06 }],
      env: { a: 0.001, d: 0.38, s: 0, r: 0.12 }, keyDecay: true, gain: 0.5,
    },
    celesta: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.75 }, { type: 'sine', ratio: 2, gain: 0.2 }],
      fm: { ratio: 5, index: 0.4, decay: 0.08 },
      env: { a: 0.001, d: 1.3, s: 0, r: 0.4 }, keyDecay: true, gain: 0.45,
    },
    steeldrum: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.7 }, { type: 'sine', ratio: 2, gain: 0.35 }, { type: 'sine', ratio: 3, gain: 0.15 }, { type: 'sine', ratio: 4.2, gain: 0.08 }],
      drop: { ratio: 1.02, time: 0.03 },
      env: { a: 0.003, d: 0.9, s: 0.05, r: 0.3 }, keyDecay: true, gain: 0.42,
    },
    kalimba: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.85 }, { type: 'sine', ratio: 5.4, gain: 0.12 }],
      env: { a: 0.001, d: 1.1, s: 0, r: 0.3 }, keyDecay: true, gain: 0.5,
    },
    accordion: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -11, gain: 0.3 }, { type: 'sawtooth', ratio: 1, detune: 11, gain: 0.3 }, { type: 'square', ratio: 0.5, gain: 0.12 }],
      filter: { type: 'lowpass', freq: 2600, env: 0, decay: 1, q: 0.8, key: 0.2 },
      env: { a: 0.04, d: 0.2, s: 0.9, r: 0.08 }, trem: { rate: 6.5, depth: 0.06 }, gain: 0.36,
    },
    harmonica: {
      osc: [{ type: 'square', ratio: 1, gain: 0.45 }, { type: 'sawtooth', ratio: 1, gain: 0.2 }],
      formants: [[900, 3, 1], [1800, 4, 0.6], [3000, 5, 0.25]],
      noise: { gain: 0.04, freq: 2500 },
      env: { a: 0.03, d: 0.2, s: 0.85, r: 0.08 }, vib: { rate: 5.5, depth: 18, delay: 0.3 }, gain: 0.9,
    },
    acid: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.7 }],
      filter: { type: 'lowpass', freq: 260, env: 3800, decay: 0.16, q: 14, key: 0.3 }, drive: 2,
      env: { a: 0.003, d: 0.25, s: 0.6, r: 0.05 }, gain: 0.45,
    },
    reese: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -24, gain: 0.4 }, { type: 'sawtooth', ratio: 1, detune: 24, gain: 0.4 }, { type: 'sine', ratio: 1, gain: 0.5 }],
      filter: { type: 'lowpass', freq: 750, env: 300, decay: 0.6, q: 1.5, key: 0.1 },
      env: { a: 0.01, d: 0.4, s: 0.85, r: 0.12 }, gain: 0.55,
    },
    fmbass: {
      osc: [{ type: 'sine', ratio: 1, gain: 1 }],
      fm: { ratio: 1, index: 3, decay: 0.18 },
      env: { a: 0.002, d: 0.6, s: 0.5, r: 0.08 }, gain: 0.6,
    },
    warmpad: {
      osc: [{ type: 'triangle', ratio: 1, detune: -7, gain: 0.35 }, { type: 'sawtooth', ratio: 1, detune: 7, gain: 0.18 }, { type: 'sine', ratio: 0.5, gain: 0.3 }],
      filter: { type: 'lowpass', freq: 650, env: 500, decay: 2, attack: 1, q: 0.6, key: 0.2 },
      env: { a: 0.8, d: 1, s: 0.85, r: 1.4 }, vib: { rate: 0.3, depth: 6, delay: 0 }, gain: 0.45,
    },
    sqlead: {
      osc: [{ type: 'square', ratio: 1, detune: -5, gain: 0.35 }, { type: 'square', ratio: 1, detune: 5, gain: 0.35 }],
      filter: { type: 'lowpass', freq: 2200, env: 1800, decay: 0.3, q: 2, key: 0.5 },
      env: { a: 0.005, d: 0.2, s: 0.75, r: 0.1 }, vib: { rate: 5.5, depth: 12, delay: 0.25 }, gain: 0.32,
    },
    vox: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.45 }, { type: 'sawtooth', ratio: 1, detune: 6, gain: 0.3 }],
      formants: [[570, 7, 1], [840, 8, 0.7], [2410, 9, 0.3]],
      env: { a: 0.02, d: 0.25, s: 0.75, r: 0.12 }, vib: { rate: 5.2, depth: 14, delay: 0.2 }, gain: 1.7,
    },
    cello: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -3, gain: 0.45 }, { type: 'sawtooth', ratio: 1, detune: 3, gain: 0.35 }],
      filter: { type: 'lowpass', freq: 3500, env: 0, decay: 1, q: 0.5 },
      formants: [[250, 2, 1], [700, 2.5, 0.8], [1800, 3, 0.45]],
      env: { a: 0.1, d: 0.3, s: 0.9, r: 0.3 }, vib: { rate: 5.3, depth: 16, delay: 0.25 }, gain: 1,
    },
    stacc: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -9, gain: 0.3 }, { type: 'sawtooth', ratio: 1, detune: 9, gain: 0.3 }, { type: 'sawtooth', ratio: 2, gain: 0.08 }],
      filter: { type: 'lowpass', freq: 1800, env: 2500, decay: 0.1, q: 0.6, key: 0.3 },
      env: { a: 0.008, d: 0.16, s: 0.05, r: 0.1 }, gain: 0.5,
    },
    trumpet: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.6 }],
      filter: { type: 'lowpass', freq: 700, env: 3400, decay: 0.3, attack: 0.04, q: 1.2, key: 0.5 },
      formants: [[1200, 3, 1], [2500, 4, 0.6]],
      env: { a: 0.03, d: 0.25, s: 0.8, r: 0.1 }, vib: { rate: 5.5, depth: 10, delay: 0.3 }, gain: 1,
    },
    trombone: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.6 }],
      filter: { type: 'lowpass', freq: 450, env: 1800, decay: 0.35, attack: 0.06, q: 1, key: 0.4 },
      formants: [[500, 3, 1], [1300, 4, 0.5]],
      env: { a: 0.05, d: 0.3, s: 0.8, r: 0.15 }, vib: { rate: 5, depth: 8, delay: 0.35 }, gain: 1.1,
    },
    horn: {
      osc: [{ type: 'triangle', ratio: 1, gain: 0.6 }, { type: 'sawtooth', ratio: 1, gain: 0.2 }],
      filter: { type: 'lowpass', freq: 600, env: 900, decay: 0.5, attack: 0.1, q: 0.8, key: 0.3 },
      formants: [[400, 2.5, 1], [900, 3, 0.5]],
      env: { a: 0.08, d: 0.3, s: 0.85, r: 0.25 }, gain: 1.1,
    },
    clarinet: {
      osc: [{ type: 'square', ratio: 1, gain: 0.5 }, { type: 'sine', ratio: 1, gain: 0.3 }],
      filter: { type: 'lowpass', freq: 1800, env: 600, decay: 0.3, q: 0.8, key: 0.6 },
      noise: { gain: 0.03, freq: 2200 },
      env: { a: 0.04, d: 0.2, s: 0.85, r: 0.1 }, vib: { rate: 5, depth: 6, delay: 0.4 }, gain: 0.42,
    },
    oboe: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.55 }],
      formants: [[1000, 6, 1], [2800, 7, 0.55], [1500, 5, 0.3]],
      env: { a: 0.04, d: 0.2, s: 0.85, r: 0.1 }, vib: { rate: 5.5, depth: 10, delay: 0.3 }, gain: 1.6,
    },
    ooh: {
      osc: [{ type: 'sawtooth', ratio: 1, detune: -8, gain: 0.3 }, { type: 'sawtooth', ratio: 1, detune: 8, gain: 0.3 }, { type: 'triangle', ratio: 1, gain: 0.4 }],
      formants: [[300, 8, 1], [870, 9, 0.4], [2240, 10, 0.15]],
      env: { a: 0.35, d: 0.5, s: 0.85, r: 0.6 }, vib: { rate: 4.5, depth: 8, delay: 0.3 }, gain: 2,
    },
    timpani: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.9 }, { type: 'sine', ratio: 1.5, gain: 0.25 }, { type: 'sine', ratio: 1.99, gain: 0.15 }],
      drop: { ratio: 1.06, time: 0.18 }, noise: { gain: 0.12, freq: 300 },
      env: { a: 0.003, d: 1.6, s: 0, r: 0.5 }, gain: 0.7,
    },
    orchhit: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.3 }, { type: 'sawtooth', ratio: 1.5, gain: 0.22 }, { type: 'sawtooth', ratio: 2, gain: 0.22 }, { type: 'square', ratio: 0.5, gain: 0.2 }],
      filter: { type: 'lowpass', freq: 900, env: 4000, decay: 0.15, q: 0.8, key: 0.2 }, noise: { gain: 0.12, freq: 1500 },
      env: { a: 0.002, d: 0.35, s: 0, r: 0.15 }, gain: 0.55,
    },
    erhu: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.55 }],
      formants: [[800, 4, 1], [1600, 5, 0.6], [3200, 5, 0.3]],
      env: { a: 0.08, d: 0.3, s: 0.85, r: 0.2 }, vib: { rate: 6, depth: 30, delay: 0.15 }, gain: 1.3,
    },
  });

  /* 현을 뜯는 악기: Karplus–Strong 방식으로 음 높이마다 한 번 계산해 둔 소리를 튼다.
     ks: t60(소리가 1/1000로 줄어드는 초), bright(뜯는 소리의 밝기 0~1), pos(뜯는 자리), len(최대 길이 초) */
  const STRINGS = {
    agtr:       { ks: { t60: 3.2, bright: 0.55, pos: 0.18, len: 3 },   body: [['peaking', 110, 1, 4], ['peaking', 2400, 1.2, 3]], tone: 6500, gain: 0.6, r: 0.25 },
    egtr_clean: { ks: { t60: 3.6, bright: 0.45, pos: 0.25, len: 3.5 }, body: [['peaking', 900, 1, 2]], tone: 4200, gain: 0.6, r: 0.2 },
    egtr_drive: { ks: { t60: 7, bright: 0.55, pos: 0.3, len: 4 },      pre: 3, drive: 10, body: [['highpass', 90, 0.7, 0], ['peaking', 1800, 1, 4]], tone: 3600, gain: 0.2, r: 0.15 },
    fbass:      { ks: { t60: 2.4, bright: 0.25, pos: 0.2, len: 2.5 },  sub: 0.4, tone: 1800, gain: 0.75, r: 0.1 },
    slap:       { ks: { t60: 1.6, bright: 0.92, pos: 0.1, len: 2 },    sub: 0.3, body: [['peaking', 2500, 1, 6]], tone: 7000, gain: 0.6, r: 0.08 },
    koto:       { ks: { t60: 2.8, bright: 0.75, pos: 0.12, len: 3 },   body: [['peaking', 600, 1, 3]], tone: 8000, gain: 0.6, r: 0.3 },
    shamisen:   { ks: { t60: 1.2, bright: 0.95, pos: 0.08, len: 1.6 }, drive: 1.6, body: [['highpass', 200, 0.7, 0], ['peaking', 3000, 1.5, 4]], tone: 9000, gain: 0.5, r: 0.1 },
    harp:       { ks: { t60: 3.6, bright: 0.3, pos: 0.5, len: 3.5 },   tone: 5000, gain: 0.6, r: 0.6 },
    nylon:      { ks: { t60: 2.8, bright: 0.32, pos: 0.2, len: 3 },  body: [['peaking', 120, 1, 4], ['peaking', 2000, 1, 1]], tone: 4500, gain: 0.6, r: 0.25 },
    muted:      { ks: { t60: 0.28, bright: 0.5, pos: 0.15, len: 0.6 }, body: [['peaking', 300, 1, 4]], tone: 3000, gain: 0.7, r: 0.05 },
    heavy:      { ks: { t60: 8, bright: 0.6, pos: 0.3, len: 4 },     pre: 6, drive: 22, body: [['highpass', 100, 0.7, 0], ['peaking', 650, 1, -4], ['peaking', 2400, 1, 5]], tone: 4200, gain: 0.16, r: 0.12 },
    ukulele:    { ks: { t60: 1.7, bright: 0.6, pos: 0.15, len: 2 },  body: [['peaking', 500, 1, 4], ['highpass', 150, 0.7, 0]], tone: 7000, gain: 0.6, r: 0.2 },
    mandolin:   { ks: { t60: 1.4, bright: 0.85, pos: 0.12, len: 1.8 }, body: [['peaking', 900, 1, 3]], tone: 8000, gain: 0.55, r: 0.15 },
    banjo:      { ks: { t60: 1.0, bright: 0.95, pos: 0.1, len: 1.4 },  body: [['peaking', 1500, 1.5, 7], ['highpass', 180, 0.7, 0]], tone: 9000, gain: 0.5, r: 0.1 },
    sitar:      { ks: { t60: 3.5, bright: 0.9, pos: 0.07, len: 3.5 },  pre: 1.5, drive: 2.5, body: [['peaking', 2200, 2, 6]], tone: 9000, gain: 0.45, r: 0.3 },
    harpsi:     { ks: { t60: 2.2, bright: 0.92, pos: 0.08, len: 2.5 }, body: [['highpass', 160, 0.7, 0], ['peaking', 3000, 1, 3]], tone: 10000, gain: 0.55, r: 0.15 },
    clav:       { ks: { t60: 0.9, bright: 0.85, pos: 0.06, len: 1.2 }, body: [['highpass', 250, 0.7, 0], ['peaking', 1500, 2, 6]], tone: 6000, gain: 0.6, r: 0.04 },
    upright:    { ks: { t60: 1.6, bright: 0.18, pos: 0.25, len: 2 },   sub: 0.5, body: [['peaking', 120, 1, 3]], tone: 1300, gain: 0.85, r: 0.12 },
    pizz:       { ks: { t60: 0.5, bright: 0.35, pos: 0.4, len: 0.8 },  body: [['peaking', 450, 1, 4]], tone: 4000, gain: 0.7, r: 0.1 },
  };
  const ksCache = new Map();
  function ksBuffer(ctx, id, f) {
    const sr = ctx.sampleRate, K = STRINGS[id].ks;
    const key = id + ':' + f.toFixed(2) + ':' + sr;
    let e = ksCache.get(key);
    if (e) return e;
    const period = sr / f;
    const N = Math.max(2, Math.floor(period - 0.5));
    const len = Math.floor(sr * K.len);
    const y = new Float32Array(len);
    let seed = 1234 + N * 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
    const ex = new Float32Array(N);
    let lp = 0, mean = 0;
    for (let i = 0; i < N; i++) { lp += K.bright * (rnd() - lp); ex[i] = lp; }
    const M = Math.max(1, Math.floor(N * K.pos));
    for (let i = 0; i < N; i++) { y[i] = ex[i] - 0.9 * ex[(i - M + N) % N]; mean += y[i]; }
    mean /= N;
    for (let i = 0; i < N; i++) y[i] -= mean;
    const g = Math.pow(0.001, 1 / (K.t60 * Math.pow(f / 110, 0.35) * f)); // 높은 음일수록 조금 빨리 사라진다
    for (let i = N; i < len; i++) y[i] = g * 0.5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]);
    let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(y[i]));
    if (pk > 0) for (let i = 0; i < len; i++) y[i] *= 0.8 / pk;
    const buf = ctx.createBuffer(1, len, sr);
    buf.copyToChannel ? buf.copyToChannel(y, 0) : buf.getChannelData(0).set(y);
    e = { buf, rate: (N + 0.5) / period };
    if (ksCache.size > 400) ksCache.clear();
    ksCache.set(key, e);
    return e;
  }
  function stringVoice(engine, dest, inst, t, pitch, dur, vel) {
    const ctx = engine.ctx, P = STRINGS[inst];
    const f = T.freq(pitch);
    const { buf, rate } = ksBuffer(ctx, inst, f);
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    let node = src;
    if (P.drive) {
      const pre = ctx.createGain(); pre.gain.value = P.pre || 1;
      const ws = ctx.createWaveShaper(); ws.curve = engine.curve(P.drive);
      node.connect(pre); pre.connect(ws); node = ws;
    }
    for (const [type, fq, q, gain] of P.body || []) {
      const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fq; b.Q.value = q; if (gain) b.gain.value = gain;
      node.connect(b); node = b;
    }
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.6;
    tone.frequency.value = Math.min(16000, P.tone * (0.45 + 0.75 * vel));
    node.connect(tone);
    const amp = ctx.createGain(), g = amp.gain;
    const peak = P.gain * (0.3 + 0.7 * vel);
    g.setValueAtTime(peak, t);
    const end = t + Math.max(dur, 0.02);
    g.setTargetAtTime(0, end, P.r / 4);
    tone.connect(amp); amp.connect(dest);
    const srcs = [src];
    if (P.sub) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(P.sub * (0.4 + 0.6 * vel), t);
      og.gain.setTargetAtTime(0, t, P.ks.t60 / 6);
      o.connect(og); og.connect(amp); srcs.push(o);
    }
    const stopAt = Math.min(end + P.r * 2 + 0.05, t + buf.duration / rate + 0.05);
    for (const s2 of srcs) { s2.start(t); s2.stop(Math.max(stopAt, t + 0.05)); }
    return {
      release(at) {
        at = Math.max(at, ctx.currentTime);
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at); else { g.cancelScheduledValues(at); g.setValueAtTime(g.value, at); }
        g.setTargetAtTime(0, at, P.r / 4);
        for (const s2 of srcs) { try { s2.stop(at + P.r * 2 + 0.05); } catch (e) { /* 이미 멈춤 */ } }
      },
    };
  }

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

  /* 앰프(기타·베이스 앰프와 음색 변형). k: 찌그러짐 곡선 세기, pre: 드라이브 최대 증폭, tone: 톤 필터 기준(Hz),
     hp: 저역 컷, mid: [주파수, dB] 앰프 특유의 중음, post: 출력 보정 */
  const AMPS = {
    none:   { name: '없음' },
    tube:   { name: '진공관 (따뜻하게)', k: 1.3, pre: 2,  tone: 12000, hp: 20,  mid: [800, 1],  post: 0.85 },
    clean:  { name: '클린 앰프',        k: 1.6, pre: 3,  tone: 8000,  hp: 70,  mid: [1200, 2], post: 0.8 },
    crunch: { name: '크런치',           k: 4,   pre: 8,  tone: 6000,  hp: 90,  mid: [900, 4],  post: 0.42 },
    lead:   { name: '하이게인',         k: 10,  pre: 24, tone: 4800,  hp: 110, mid: [750, -3], post: 0.3 },
    fuzz:   { name: '퍼즈',             k: 28,  pre: 30, tone: 3600,  hp: 60,  mid: [1000, 3], post: 0.28 },
    bass:   { name: '베이스 앰프',      k: 2,   pre: 5,  tone: 4000,  hp: 30,  mid: [90, 4],   post: 0.75 },
    lofi:   { name: '로파이 라디오',    k: 2.2, pre: 4,  tone: 2800,  hp: 450, mid: [1500, 5], post: 0.8 },
  };
  const DELAY_DIVS = { '1/16': 0.25, '1/8': 0.5, '3/16': 0.75, '1/4': 1, '3/8': 1.5, '1/2': 2 };
  const dB = (d) => Math.pow(10, d / 20);

  /** 오디오 값 바꾸기: 재생 중엔 부드럽게, 오프라인 렌더에선 바로 */
  function setp(param, v, ctx, now) {
    if (now == null) { param.cancelScheduledValues(0); param.value = v; }
    else param.setTargetAtTime(v, now, 0.015);
  }
  function applyComp(comp, makeup, a, ctx, now) {
    setp(comp.threshold, -a * 30, ctx, now);
    setp(comp.ratio, 1 + a * 7, ctx, now);
    setp(makeup.gain, dB(a * 30 * 0.33), ctx, now);
  }

  class Engine {
    constructor(ctx) {
      this.ctx = ctx;
      const g = () => ctx.createGain(), f = (type, fq, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fq; b.Q.value = q; return b; };
      this.master = g(); this.master.gain.value = 0.85;
      // 마스터: EQ(저·중·고) → 컴프 → 리미터
      this.mLow = f('lowshelf', 110); this.mMid = f('peaking', 1000, 0.8); this.mHigh = f('highshelf', 8000);
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -12; this.comp.knee.value = 10; this.comp.ratio.value = 3.5;
      this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.makeup = g();
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -1; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.002; this.limiter.release.value = 0.08;
      this.out = g();
      this.master.connect(this.mLow); this.mLow.connect(this.mMid); this.mMid.connect(this.mHigh);
      this.mHigh.connect(this.comp); this.comp.connect(this.makeup); this.makeup.connect(this.limiter);
      this.limiter.connect(this.out); this.out.connect(ctx.destination);
      // 리버브 버스
      this.revIn = g();
      const pre = f('highpass', 220);
      this.conv = ctx.createConvolver(); this.conv.buffer = makeImpulse(ctx, 2.4, 3.2);
      this.revOut = g(); this.revOut.gain.value = 0.7;
      this.revIn.connect(pre); pre.connect(this.conv); this.conv.connect(this.revOut); this.revOut.connect(this.master);
      // 딜레이 버스(박자에 맞춘 메아리)
      this.dlyIn = g();
      this.dly = ctx.createDelay(4); this.dly.delayTime.value = 0.3;
      this.dlyFb = g(); this.dlyFb.gain.value = 0.35;
      const dlp = f('lowpass', 4200), dhp = f('highpass', 180);
      this.dlyOut = g(); this.dlyOut.gain.value = 0.8;
      this.dlyIn.connect(this.dly); this.dly.connect(dlp); dlp.connect(dhp); dhp.connect(this.dlyFb); this.dlyFb.connect(this.dly);
      dhp.connect(this.dlyOut); this.dlyOut.connect(this.master);
      this.noise = makeNoise(ctx);
      this.curves = {};
      this.analyser = null;
    }
    curve(k) { return this.curves[k] || (this.curves[k] = driveCurve(k)); }
    analyse() {
      if (!this.analyser) { this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024; this.out.connect(this.analyser); }
      return this.analyser;
    }
    /** 곡의 마스터 설정을 소리에 반영. now 가 없으면 즉시(오프라인) */
    applyMaster(song, now) {
      const m = song.mix, ctx = this.ctx;
      setp(this.master.gain, song.master, ctx, now);
      setp(this.mLow.gain, m.low, ctx, now); setp(this.mMid.gain, m.mid, ctx, now); setp(this.mHigh.gain, m.high, ctx, now);
      applyComp(this.comp, this.makeup, m.comp, ctx, now);
      setp(this.limiter.threshold, m.limit ? -1 : 0, ctx, now);
      setp(this.limiter.ratio, m.limit ? 20 : 1, ctx, now);
      setp(this.revOut.gain, m.revLevel, ctx, now);
      const sec = 60 / song.bpm * (DELAY_DIVS[m.dlyDiv] || 0.75);
      setp(this.dly.delayTime, Math.min(3.9, sec), ctx, now);
      setp(this.dlyFb.gain, m.dlyFb, ctx, now);
    }
  }

  /* 한 번의 재생(또는 미리 듣기)에 쓰는 트랙별 믹서 줄:
     입력 → 앰프(증폭·찌그러짐·톤) → EQ(저역 컷·저·중·고) → 컴프 → 음량 → 팬 → 출력, 음량 뒤에서 리버브·딜레이로 보냄 */
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
        const g = () => ctx.createGain(), f = (type, fq, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fq; b.Q.value = q; return b; };
        c = {
          input: g(), pre: g(), shaper: ctx.createWaveShaper(), aHp: f('highpass', 10), aMid: f('peaking', 1000, 0.9), aLp: f('lowpass', 20000), post: g(),
          hp: f('highpass', 20), low: f('lowshelf', 120), mid: f('peaking', 1000, 1), high: f('highshelf', 7000),
          comp: ctx.createDynamicsCompressor(), makeup: g(),
          vol: g(), pan: ctx.createStereoPanner ? ctx.createStereoPanner() : null, send: g(), dsend: g(), meter: null, ampType: null,
        };
        c.shaper.oversample = '2x';
        c.comp.knee.value = 6; c.comp.attack.value = 0.005; c.comp.release.value = 0.15; c.comp.threshold.value = 0; c.comp.ratio.value = 1;
        const seq = [c.input, c.pre, c.shaper, c.aHp, c.aMid, c.aLp, c.post, c.hp, c.low, c.mid, c.high, c.comp, c.makeup, c.vol];
        for (let i = 0; i < seq.length - 1; i++) seq[i].connect(seq[i + 1]);
        if (c.pan) { c.vol.connect(c.pan); c.pan.connect(this.out); c.tap = c.pan; } else { c.vol.connect(this.out); c.tap = c.vol; }
        c.vol.connect(c.send); c.send.connect(this.e.revIn);
        c.vol.connect(c.dsend); c.dsend.connect(this.e.dlyIn);
        this.chains.set(tr.id, c);
      }
      return c;
    }
    /** 트랙 설정 하나를 반영. now 가 없으면 즉시 */
    applyTrack(tr, audible, now) {
      const c = this.chain(tr), ctx = this.ctx;
      const amp = AMPS[(tr.amp && tr.amp.type) || 'none'] || AMPS.none;
      const drive = tr.amp ? tr.amp.drive : 0.5, tone = tr.amp ? tr.amp.tone : 0.5;
      if (amp.k) {
        if (c.ampType !== amp.k) { c.shaper.curve = this.e.curve(amp.k); c.ampType = amp.k; }
        setp(c.pre.gain, 1 + (amp.pre - 1) * drive, ctx, now);
        setp(c.aHp.frequency, amp.hp, ctx, now);
        setp(c.aMid.frequency, amp.mid[0], ctx, now); setp(c.aMid.gain, amp.mid[1], ctx, now);
        setp(c.aLp.frequency, Math.min(20000, amp.tone * Math.pow(2, (tone - 0.5) * 2.5)), ctx, now);
        setp(c.post.gain, amp.post * (1 - drive * 0.25), ctx, now);
      } else {
        if (c.ampType !== null) { c.shaper.curve = null; c.ampType = null; }
        setp(c.pre.gain, 1, ctx, now); setp(c.aHp.frequency, 10, ctx, now); setp(c.aMid.gain, 0, ctx, now);
        setp(c.aLp.frequency, 20000, ctx, now); setp(c.post.gain, 1, ctx, now);
      }
      const eq = tr.eq || {};
      setp(c.hp.frequency, eq.hp || 20, ctx, now);
      setp(c.low.gain, eq.low || 0, ctx, now);
      setp(c.mid.gain, eq.mid || 0, ctx, now); setp(c.mid.frequency, eq.midF || 1000, ctx, now);
      setp(c.high.gain, eq.high || 0, ctx, now);
      applyComp(c.comp, c.makeup, tr.comp || 0, ctx, now);
      setp(c.vol.gain, audible ? tr.vol * tr.vol : 0, ctx, now);
      if (c.pan) setp(c.pan.pan, tr.pan || 0, ctx, now);
      setp(c.send.gain, (tr.rev || 0) * 0.6, ctx, now);
      setp(c.dsend.gain, (tr.dly || 0) * 0.7, ctx, now);
      return c;
    }
    meter(tr) {
      const c = this.chain(tr);
      if (!c.meter) { c.meter = this.ctx.createAnalyser(); c.meter.fftSize = 512; c.tap.connect(c.meter); }
      return c.meter;
    }
    update(song, immediate) {
      const solo = song.tracks.some((t) => t.solo);
      const now = immediate ? null : this.ctx.currentTime;
      for (const tr of song.tracks) this.applyTrack(tr, !tr.mute && (!solo || tr.solo), now);
      this.e.applyMaster(song, now);
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
    if (STRINGS[inst]) return stringVoice(engine, dest, inst, t, pitch, dur, vel);
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
    if (P.formants) {
      // 사람 목소리·관악기처럼 몇 군데 주파수를 도드라지게(포먼트)
      const mix = ctx.createGain();
      for (const [fq, q, gn] of P.formants) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
        const bg = ctx.createGain(); bg.gain.value = gn;
        mix.connect(bp); bp.connect(bg); bg.connect(amp);
      }
      target = mix;
    }
    let filter = null;
    if (P.filter) {
      const F = P.filter;
      filter = ctx.createBiquadFilter(); filter.type = F.type; filter.Q.value = F.q || 0.7;
      const base = Math.min(18000, F.freq * Math.pow(f / 261.6, F.key || 0));
      const top = Math.min(18000, base + F.env * (0.4 + 0.6 * vel));
      filter.frequency.setValueAtTime(F.attack ? base : top, t);
      if (F.attack) filter.frequency.linearRampToValueAtTime(top, t + F.attack);
      filter.frequency.setTargetAtTime(base, t + (F.attack || 0), F.decay / 3);
      filter.connect(target); target = filter;
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
      case 'ride': {
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.16 * v, t); g.gain.setTargetAtTime(0, t + 0.005, 0.32);
        hp.connect(g); g.connect(out);
        for (const fr of [263, 400, 421, 474, 587, 845]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr * 1.9; o.connect(hp); o.start(t); o.stop(t + 1.4); }
        noise(1.0, 'bandpass', 9000, 1, 0.12, 0.5);
        break;
      }
      case 'tamb':
        for (const off of [0, 0.014, 0.03]) noise(0.08, 'bandpass', 9500, 1.4, 0.45, 0.05, t + off);
        noise(0.3, 'highpass', 8000, 0.8, 0.25, 0.12, t + 0.03);
        break;
      case 'shaker': {
        const n = ctx.createBufferSource(); n.buffer = engine.noise;
        const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 6000; flt.Q.value = 0.8;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4 * v, t + 0.018); g.gain.setTargetAtTime(0, t + 0.02, 0.025);
        n.connect(flt); flt.connect(g); g.connect(out); n.start(t); n.stop(t + 0.2);
        break;
      }
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
    const tail = 3.5;
    const len = Math.ceil(((to - from) * spt + tail) * rate);
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const ctx = new OAC(2, len, rate);
    const eng = new Engine(ctx);
    const ses = new Session(eng); ses.update(song, true);
    const solo = song.tracks.some((t) => t.solo);
    for (const tr of song.tracks) {
      if (tr.mute || (solo && !tr.solo)) continue;
      const c = ses.chain(tr);
      for (const n of tr.notes) {
        if (n.t < from || n.t >= to) continue;
        const t = 0.02 + (swingTick(n.t, song.swing) - from) * spt;
        playNote(eng, c.input, tr, t, n, Math.min(n.d, to - n.t) * spt);
      }
    }
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

  S.audio = { PRESETS, STRINGS, AMPS, DELAY_DIVS, Engine, Session, Player, synthVoice, drumHit, playNote, render, encodeWav, swingTick };
})(globalThis.Studio = globalThis.Studio || {});
