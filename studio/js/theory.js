'use strict';
/* 음악 이론: 음 이름, 음계, 화음, 코드 진행 프리셋 */
(function (S) {
  const PPQ = 96;              // 한 박(4분음표)의 틱 수
  const BEATS = 4;             // 4/4 박자 고정
  const BAR = PPQ * BEATS;     // 한 마디 틱 수

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const NOTE_KO = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];

  const SCALES = {
    major:      { name: '장조 (메이저)',       steps: [0, 2, 4, 5, 7, 9, 11] },
    minor:      { name: '단조 (내추럴 마이너)', steps: [0, 2, 3, 5, 7, 8, 10] },
    harmonic:   { name: '화성 단음계',          steps: [0, 2, 3, 5, 7, 8, 11] },
    dorian:     { name: '도리안',               steps: [0, 2, 3, 5, 7, 9, 10] },
    mixolydian: { name: '믹솔리디안',           steps: [0, 2, 4, 5, 7, 9, 10] },
    lydian:     { name: '리디안',               steps: [0, 2, 4, 6, 7, 9, 11] },
    phrygian:   { name: '프리지안',             steps: [0, 1, 3, 5, 7, 8, 10] },
    majpenta:   { name: '장조 펜타토닉',        steps: [0, 2, 4, 7, 9], parent: 'major' },
    minpenta:   { name: '단조 펜타토닉',        steps: [0, 3, 5, 7, 10], parent: 'minor' },
    blues:      { name: '블루스',               steps: [0, 3, 5, 6, 7, 10], parent: 'minor' },
    chromatic:  { name: '반음계 (제한 없음)',   steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], parent: 'major' },
  };

  // 화음 종류: 근음 기준 반음 간격
  const QUALITIES = {
    '':     { iv: [0, 4, 7],      label: '' },
    m:      { iv: [0, 3, 7],      label: 'm' },
    dim:    { iv: [0, 3, 6],      label: 'dim' },
    aug:    { iv: [0, 4, 8],      label: 'aug' },
    sus2:   { iv: [0, 2, 7],      label: 'sus2' },
    sus4:   { iv: [0, 5, 7],      label: 'sus4' },
    '7':    { iv: [0, 4, 7, 10],  label: '7' },
    maj7:   { iv: [0, 4, 7, 11],  label: 'maj7' },
    m7:     { iv: [0, 3, 7, 10],  label: 'm7' },
    m7b5:   { iv: [0, 3, 6, 10],  label: 'm7♭5' },
    dim7:   { iv: [0, 3, 6, 9],   label: 'dim7' },
    mmaj7:  { iv: [0, 3, 7, 11],  label: 'm(maj7)' },
    aug7:   { iv: [0, 4, 8, 10],  label: 'aug7' },
    add9:   { iv: [0, 4, 7, 14],  label: 'add9' },
    m9:     { iv: [0, 3, 7, 10, 14], label: 'm9' },
    maj9:   { iv: [0, 4, 7, 11, 14], label: 'maj9' },
  };

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  const mod12 = (n) => ((n % 12) + 12) % 12;
  const noteName = (p) => NOTE_NAMES[mod12(p)] + (Math.floor(p / 12) - 1);
  const freq = (p) => 440 * Math.pow(2, (p - 69) / 12);

  /** 화음을 만들 때 쓰는 7음 음계(펜타토닉 등은 바탕 음계) */
  function heptatonic(scaleId) {
    const s = SCALES[scaleId] || SCALES.major;
    return s.steps.length === 7 ? s.steps : SCALES[s.parent].steps;
  }
  function inScale(pitch, key, scaleId) {
    return (SCALES[scaleId] || SCALES.major).steps.includes(mod12(pitch - key));
  }
  /** 음계 안의 가장 가까운 음(같으면 아래쪽) */
  function snapToScale(pitch, key, scaleId) {
    if (inScale(pitch, key, scaleId)) return pitch;
    for (let d = 1; d < 12; d++) {
      if (inScale(pitch - d, key, scaleId)) return pitch - d;
      if (inScale(pitch + d, key, scaleId)) return pitch + d;
    }
    return pitch;
  }
  /** 음계 위에서 n칸(음계 음 기준) 이동 */
  function scaleStep(pitch, n, key, scaleId) {
    let p = snapToScale(pitch, key, scaleId);
    const dir = n > 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(n); i++) {
      do { p += dir; } while (!inScale(p, key, scaleId));
    }
    return p;
  }
  /** 음 높이의 음계 칸 번호(옥타브 포함), 음계 밖이면 아래로 붙인다 */
  function scaleIndex(pitch, key, scaleId) {
    const steps = (SCALES[scaleId] || SCALES.major).steps;
    const p = snapToScale(pitch, key, scaleId);
    const rel = p - key;
    const oct = Math.floor(rel / 12);
    return oct * steps.length + steps.indexOf(mod12(rel));
  }
  function fromScaleIndex(idx, key, scaleId) {
    const steps = (SCALES[scaleId] || SCALES.major).steps;
    const n = steps.length;
    const oct = Math.floor(idx / n);
    return key + oct * 12 + steps[((idx % n) + n) % n];
  }

  function identifyQuality(intervals) {
    const set = intervals.map(mod12).sort((a, b) => a - b).join(',');
    for (const [q, d] of Object.entries(QUALITIES)) {
      if (d.iv.map(mod12).sort((a, b) => a - b).join(',') === set) return q;
    }
    return intervals.length > 3 ? '7' : '';
  }

  /** 조성의 deg(0~6)번째 음 위에 쌓은 화음 */
  function diatonic(key, scaleId, deg, seventh) {
    const st = heptatonic(scaleId);
    const d = ((deg % 7) + 7) % 7;
    const tone = (i) => st[(d + i) % 7] + 12 * Math.floor((d + i) / 7);
    const root = tone(0);
    const iv = [0, tone(2) - root, tone(4) - root];
    if (seventh) iv.push(tone(6) - root);
    return { root: mod12(key + root), q: identifyQuality(iv) };
  }

  function chordPcs(ch) {
    const q = QUALITIES[ch.q] || QUALITIES[''];
    return q.iv.map((i) => mod12(ch.root + i));
  }
  function chordName(ch, flats) {
    if (!ch) return '';
    const names = flats ? FLAT_NAMES : NOTE_NAMES;
    let s = names[mod12(ch.root)] + (QUALITIES[ch.q] ? QUALITIES[ch.q].label : '');
    if (ch.bass != null && mod12(ch.bass) !== mod12(ch.root)) s += '/' + names[mod12(ch.bass)];
    return s;
  }
  /** 조성 안에서의 로마 숫자(조성 밖이면 '') */
  function roman(ch, key, scaleId) {
    if (!ch) return '';
    const st = heptatonic(scaleId);
    const deg = st.indexOf(mod12(ch.root - key));
    if (deg < 0) return '';
    const q = ch.q;
    const minorish = ['m', 'm7', 'dim', 'm7b5', 'dim7', 'm9', 'mmaj7'].includes(q);
    let r = ROMAN[deg];
    if (minorish) r = r.toLowerCase();
    if (q === 'dim' || q === 'dim7') r += '°';
    else if (q === 'm7b5') r += 'ø';
    else if (q === 'aug') r += '+';
    if (/7|9/.test(q) && q !== 'm7b5' && q !== 'dim7') r += (q.includes('maj') ? 'M7' : '7');
    return r;
  }
  /** 키가 플랫 조인지(표기용) */
  const isMinorLike = (scaleId) => ['minor', 'harmonic', 'dorian', 'phrygian', 'minpenta', 'blues'].includes(scaleId);
  function prefersFlats(key, scaleId) {
    const minorLike = isMinorLike(scaleId);
    const major = minorLike ? mod12(key + 3) : mod12(key);
    return [5, 10, 3, 8, 1, 6].includes(major);
  }
  function keyName(key, scaleId) {
    const names = prefersFlats(key, scaleId) ? FLAT_NAMES : NOTE_NAMES;
    return names[mod12(key)];
  }

  /* 코드 진행 프리셋. 숫자는 음계 도수(0=으뜸음), 객체는 {semi: 반음, q: 종류}. */
  const PROGRESSIONS = [
    { id: 'pop',      name: '팝 정석 (I–V–vi–IV)',            prog: [0, 4, 5, 3] },
    { id: 'sensitive', name: '감성 (vi–IV–I–V)',              prog: [5, 3, 0, 4] },
    { id: 'fifties',  name: '50년대 (I–vi–IV–V)',             prog: [0, 5, 3, 4] },
    { id: 'royal',    name: '왕도 진행 (IVM7–V7–iii7–vi7)',        prog: [3, 4, 2, 5], seventh: true },
    { id: 'komuro',   name: '고무로 진행 (vi–IV–V–I)',        prog: [5, 3, 4, 0] },
    { id: 'marunouchi', name: '마루사 진행 (IVM7–III7–vi7–I7)', prog: [{ semi: 5, q: 'maj7' }, { semi: 4, q: '7' }, { semi: 9, q: 'm7' }, { semi: 0, q: '7' }] },
    { id: 'canon',    name: '캐논 (I–V–vi–iii–IV–I–IV–V)',    prog: [0, 4, 5, 2, 3, 0, 3, 4] },
    { id: 'jazz',     name: '투파이브 (ii–V–I–vi)',           prog: [1, 4, 0, 5], seventh: true },
    { id: 'lofi',     name: '로파이 (IV–iii–ii–I)',           prog: [3, 2, 1, 0], seventh: true },
    { id: 'ballad',   name: '발라드 (I–iii–IV–V)',            prog: [0, 2, 3, 4] },
    { id: 'epic',     name: '단조 에픽 (i–VI–III–VII)',       prog: [0, 5, 2, 6], minor: true },
    { id: 'minorbal', name: '단조 발라드 (i–iv–VII–III)',     prog: [0, 3, 6, 2], minor: true },
    { id: 'andalus',  name: '안달루시아 (i–VII–VI–V)',        prog: [0, { semi: 10, q: '' }, { semi: 8, q: '' }, { semi: 7, q: '' }], minor: true },
    { id: 'blues',    name: '12마디 블루스 (I7–IV7–V7)',      prog: [{ semi: 0, q: '7' }, { semi: 0, q: '7' }, { semi: 0, q: '7' }, { semi: 0, q: '7' },
                                                                    { semi: 5, q: '7' }, { semi: 5, q: '7' }, { semi: 0, q: '7' }, { semi: 0, q: '7' },
                                                                    { semi: 7, q: '7' }, { semi: 5, q: '7' }, { semi: 0, q: '7' }, { semi: 7, q: '7' }] },
  ];

  /** 프리셋을 현재 조성의 화음 목록으로 바꾼다 */
  function progressionChords(presetId, key, scaleId) {
    const p = PROGRESSIONS.find((x) => x.id === presetId) || PROGRESSIONS[0];
    // 단조용 진행을 장조 곡에 쓰면 나란한조(vi)에서, 장조용을 단조 곡에 쓰면 나란한조(III)에서 시작한다.
    const minorScale = isMinorLike(scaleId);
    let degShift = 0, semiShift = 0;
    if (p.minor && !minorScale) { degShift = 5; semiShift = 9; }
    else if (!p.minor && minorScale && p.id !== 'blues') { degShift = 2; semiShift = 3; }
    return p.prog.map((it) => typeof it === 'number'
      ? diatonic(key, scaleId, it + degShift, !!p.seventh)
      : { root: mod12(key + it.semi + semiShift), q: it.q });
  }

  S.theory = {
    PPQ, BEATS, BAR, NOTE_NAMES, FLAT_NAMES, NOTE_KO, SCALES, QUALITIES, PROGRESSIONS,
    mod12, noteName, freq, heptatonic, inScale, snapToScale, scaleStep, scaleIndex, fromScaleIndex,
    identifyQuality, diatonic, isMinorLike, chordPcs, chordName, roman, prefersFlats, keyName, progressionChords,
  };
})(globalThis.Studio = globalThis.Studio || {});
