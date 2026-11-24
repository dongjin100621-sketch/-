'use strict';
/* 자동 작곡: 코드 진행에 맞춘 반주·베이스·멜로디·드럼 만들기 */
(function (S) {
  const T = S.theory, SG = S.song;
  const { PPQ, BAR } = T;
  const STEP = PPQ / 4; // 16분음표

  function rng(seed) {
    let a = seed >>> 0 || 1;
    const f = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (n) => Math.floor(f() * n);
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  }

  /* 장르: 기본으로 고를 값 */
  const GENRES = {
    pop:     { name: '팝',     bpm: 108, prog: 'pop',       comp: 'pulse',  bass: 'eighth', drums: 'pop',    chordInst: 'piano',  melInst: 'lead',   bassInst: 'bass',   kit: 'std',  density: 0.55, swing: 0 },
    ballad:  { name: '발라드', bpm: 72,  prog: 'ballad',    comp: 'arp',    bass: 'root',   drums: 'ballad', chordInst: 'piano',  melInst: 'strings', bassInst: 'bass',  kit: 'std',  density: 0.4,  swing: 0 },
    hiphop:  { name: '힙합',   bpm: 90,  prog: 'sensitive', comp: 'block',  bass: 'synco',  drums: 'boombap', chordInst: 'epiano', melInst: 'bell',  bassInst: 'sub808', kit: '808',  density: 0.45, swing: 0.25 },
    lofi:    { name: '로파이', bpm: 78,  prog: 'lofi',      comp: 'ballad', bass: 'root',   drums: 'boombap', chordInst: 'epiano', melInst: 'flute', bassInst: 'bass',   kit: 'lofi', density: 0.35, swing: 0.4 },
    house:   { name: '하우스', bpm: 124, prog: 'sensitive', comp: 'offbeat', bass: 'octave', drums: 'house', chordInst: 'organ',  melInst: 'pluck',  bassInst: 'bass',   kit: '808',  density: 0.6,  swing: 0 },
    rock:    { name: '록',     bpm: 132, prog: 'fifties',   comp: 'pulse',  bass: 'eighth', drums: 'rock',   chordInst: 'brass',  melInst: 'lead',   bassInst: 'bass',   kit: 'std',  density: 0.6,  swing: 0 },
    trap:    { name: '트랩',   bpm: 140, prog: 'epic',      comp: 'block',  bass: 'synco',  drums: 'trap',   chordInst: 'pad',    melInst: 'bell',   bassInst: 'sub808', kit: '808',  density: 0.5,  swing: 0 },
    cinema:  { name: '영화풍', bpm: 84,  prog: 'epic',      comp: 'block',  bass: 'root',   drums: 'none',   chordInst: 'strings', melInst: 'flute', bassInst: 'bass',   kit: 'std',  density: 0.35, swing: 0 },
  };
  const COMP_STYLES = { block: '길게 누르기', pulse: '4분 리듬', offbeat: '엇박 찍기', arp: '아르페지오', ballad: '분산 화음' };
  const BASS_STYLES = { root: '근음 길게', eighth: '8분 근음', octave: '옥타브 튕기기', synco: '당김음', walk: '워킹' };
  const DRUM_STYLES = { pop: '팝', ballad: '발라드', boombap: '붐뱁', house: '하우스(4비트)', rock: '록', trap: '트랩', none: '없음' };

  /* 화음을 앞 화음과 가깝게 쌓는다(목소리 이끌기) */
  function voice(ch, prev, lo = 52, hi = 76) {
    const pcs = T.chordPcs(ch).slice(0, 4);
    const cands = [];
    for (let base = lo - 12; base <= hi; base++) {
      if (T.mod12(base) !== pcs[0] && !pcs.slice(1).includes(T.mod12(base))) continue;
      // base 부터 위로 화음 음을 하나씩 쌓는다
      const start = pcs.indexOf(T.mod12(base));
      const v = [base];
      for (let i = 1; i < pcs.length; i++) {
        const pc = pcs[(start + i) % pcs.length];
        let n = v[v.length - 1] + 1;
        while (T.mod12(n) !== pc) n++;
        v.push(n);
      }
      if (v[0] >= lo && v[v.length - 1] <= hi) cands.push(v);
    }
    if (!cands.length) return pcs.map((pc) => 60 + pc);
    if (!prev) {
      const mid = (lo + hi) / 2;
      cands.sort((a, b) => Math.abs(avg(a) - mid) - Math.abs(avg(b) - mid));
      return cands[0];
    }
    let best = cands[0], bd = Infinity;
    for (const c of cands) {
      let dsum = 0;
      for (const n of c) dsum += Math.min(...prev.map((q) => Math.abs(q - n)));
      dsum += Math.abs(avg(c) - avg(prev)) * 0.5;
      if (dsum < bd) { bd = dsum; best = c; }
    }
    return best;
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  function chordAt(chords, bar) {
    for (let b = bar; b >= 0; b--) if (chords[b]) return chords[b];
    return chords.find(Boolean) || null;
  }

  function genChords(song, chords, style, r) {
    const notes = [];
    let prev = null;
    for (let bar = 0; bar < song.bars; bar++) {
      const ch = chordAt(chords, bar);
      if (!ch) continue;
      const v = voice(ch, prev); prev = v;
      const t0 = bar * BAR;
      const add = (t, d, p, vel) => notes.push({ t: t0 + t, d, p, v: vel });
      const root = 36 + T.mod12(ch.root) + (T.mod12(ch.root) > 7 ? 0 : 12); // 왼손 근음
      switch (style) {
        case 'block':
          for (const p of v) add(0, BAR - 4, p, 0.62);
          break;
        case 'pulse':
          for (let b = 0; b < 4; b++) for (const p of v) add(b * PPQ, PPQ - 10, p, b % 2 ? 0.5 : 0.62);
          break;
        case 'offbeat':
          for (let b = 0; b < 4; b++) for (const p of v) add(b * PPQ + PPQ / 2, PPQ / 2 - 8, p, 0.58);
          break;
        case 'arp': {
          const pat = [0, 1, 2, 3, 2, 1, 0, 1];
          const tones = [root, ...v];
          for (let i = 0; i < 8; i++) {
            const idx = i === 0 ? 0 : 1 + (pat[i] % v.length);
            add(i * PPQ / 2, i === 0 ? BAR - 8 : PPQ / 2 + 20, tones[idx], i === 0 ? 0.62 : 0.5);
          }
          break;
        }
        case 'ballad':
        default:
          add(0, BAR - 8, root, 0.58);
          for (const p of v) add(PPQ / 2 + (r.chance(0.5) ? 6 : 0), PPQ * 1.5, p, 0.5);
          for (const p of v) add(PPQ * 2 + PPQ / 2, PPQ * 1.4, p, 0.45);
          break;
      }
    }
    return notes;
  }

  function bassPitch(pc) { let p = 36 + T.mod12(pc); if (p > 43) p -= 12; return p; }

  function genBass(song, chords, style, r) {
    const notes = [];
    for (let bar = 0; bar < song.bars; bar++) {
      const ch = chordAt(chords, bar);
      if (!ch) continue;
      const next = chordAt(chords, bar + 1) || ch;
      const t0 = bar * BAR;
      const root = bassPitch(ch.root);
      const pcs = T.chordPcs(ch);
      const fifth = root + T.mod12(pcs[2] - pcs[0]);
      const add = (t, d, p, v) => notes.push({ t: t0 + t, d, p, v });
      switch (style) {
        case 'root':
          add(0, PPQ * 2.5, root, 0.8); add(PPQ * 3, PPQ - 8, r.chance(0.5) ? fifth : root, 0.6);
          break;
        case 'eighth':
          for (let i = 0; i < 8; i++) add(i * PPQ / 2, PPQ / 2 - 6, i === 7 && r.chance(0.4) ? fifth : root, i % 2 ? 0.6 : 0.78);
          break;
        case 'octave':
          for (let i = 0; i < 8; i++) add(i * PPQ / 2 + (i % 2 ? 0 : 0), PPQ / 2 - 8, i % 2 ? root + 12 : root, i % 2 ? 0.7 : 0.8);
          break;
        case 'synco':
          add(0, PPQ * 1.25, root, 0.85);
          add(PPQ * 1.5, PPQ / 2, root, 0.65);
          add(PPQ * 2.5, PPQ * 0.75, r.chance(0.5) ? root : fifth, 0.75);
          if (r.chance(0.5)) add(PPQ * 3.5, PPQ / 2 - 6, root + 12, 0.6);
          break;
        case 'walk': {
          const nr = bassPitch(next.root);
          const third = root + T.mod12(pcs[1] - pcs[0]);
          const approach = nr + (r.chance(0.5) ? -1 : 1);
          [root, r.chance(0.5) ? third : fifth, r.chance(0.5) ? fifth : third + 12 > 52 ? third : third, approach]
            .forEach((p, i) => add(i * PPQ, PPQ - 8, p, i === 0 ? 0.82 : 0.68));
          break;
        }
      }
    }
    return notes;
  }

  /* 멜로디: 두 마디 동기(모티프)를 만들어 되풀이·변형하고, 센박에는 화음 음을 놓는다 */
  const CELLS = [
    { s: [0], w: 3 },            // 4분
    { s: [0, 2], w: 4 },         // 8분 둘
    { s: [0, 3], w: 1.2 },       // 점8분+16분
    { s: [0, 1, 2], w: 0.8 },
    { s: [0, 2, 3], w: 1.2 },
    { s: [0, 1, 2, 3], w: 0.6 },
    { s: [], w: 1.2 },           // 쉼
    { s: [2], w: 1 },            // 엇박
  ];
  function pickCell(r, density) {
    const ws = CELLS.map((c) => c.w * (c.s.length === 0 ? (1.4 - density) : c.s.length > 2 ? density * 1.6 : c.s.length === 2 ? 0.5 + density : 1));
    let x = r() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < CELLS.length; i++) { x -= ws[i]; if (x <= 0) return CELLS[i]; }
    return CELLS[0];
  }
  function motifRhythm(r, density) {
    const on = [];
    for (let beat = 0; beat < 8; beat++) {
      let cell = pickCell(r, density);
      if (beat === 0 && cell.s[0] !== 0) cell = CELLS[1];
      if (beat === 7) cell = r.chance(0.6) ? { s: [] } : CELLS[0];
      if (beat === 6 && r.chance(0.5)) cell = CELLS[0];
      for (const s of cell.s) on.push(beat * 4 + s);
    }
    return on; // 16분 단위 위치(두 마디 = 32칸)
  }

  function nearestChordTone(p, ch, lo, hi) {
    const pcs = T.chordPcs(ch);
    let best = p, bd = 99;
    for (let q = lo; q <= hi; q++) {
      if (!pcs.includes(T.mod12(q))) continue;
      const d = Math.abs(q - p);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  function genMelody(song, chords, opts, r) {
    const key = song.key, sc = song.scale;
    const lo = opts.lo || 62, hi = opts.hi || 81;
    const density = opts.density == null ? 0.5 : opts.density;
    const notes = [];
    const phrases = Math.ceil(song.bars / 2);
    const A = { rhythm: motifRhythm(r, density), steps: [] };
    const B = { rhythm: motifRhythm(r, density), steps: [] };
    for (const M of [A, B]) {
      M.steps = M.rhythm.map(() => r.pick([-2, -1, -1, 1, 1, 2, 0, -3, 3]));
    }
    // 모양: A A' B A'' (4프레이즈마다 되풀이)
    const form = ['A', 'A2', 'B', 'A3'];
    let prev = T.snapToScale(Math.round((lo + hi) / 2) - 2, key, sc);
    for (let ph = 0; ph < phrases; ph++) {
      const kind = form[ph % 4];
      const M = kind === 'B' ? B : A;
      let rhythm = M.rhythm.slice();
      if (kind === 'A3' && r.chance(0.6)) {
        rhythm = rhythm.filter((x) => x < 24);
        rhythm.push(24); // 끝맺음: 마지막 마디 3박에 긴 음
      }
      const baseBar = ph * 2;
      if (baseBar >= song.bars) break;
      const lastPhrase = ph === phrases - 1 || kind === 'A3';
      for (let i = 0; i < rhythm.length; i++) {
        const pos = rhythm[i];
        const bar = baseBar + Math.floor(pos / 16);
        if (bar >= song.bars) break;
        const ch = chordAt(chords, bar);
        const strong = pos % 8 === 0;
        const step = M.steps[i % M.steps.length] + (kind === 'A2' && i === rhythm.length - 1 ? -1 : 0);
        let p = T.scaleStep(prev, step || 0, key, sc);
        // 음역 밖으로 나가면 반대로 돌린다
        if (p > hi) p = T.scaleStep(prev, -Math.abs(step || 1), key, sc);
        if (p < lo) p = T.scaleStep(prev, Math.abs(step || 1), key, sc);
        if (ch && (strong || r.chance(0.25))) p = nearestChordTone(p, ch, lo, hi);
        const isLast = i === rhythm.length - 1;
        if (isLast && lastPhrase) {
          // 으뜸음(또는 화음의 근음)으로 끝맺기
          const target = ph === phrases - 1 ? key : (ch ? ch.root : key);
          let best = p, bd = 99;
          for (let q = lo; q <= hi; q++) if (T.mod12(q) === T.mod12(target) && Math.abs(q - p) < bd) { bd = Math.abs(q - p); best = q; }
          p = best;
        }
        p = Math.max(lo, Math.min(hi, p));
        const nextPos = i + 1 < rhythm.length ? rhythm[i + 1] : 32;
        let len = (nextPos - pos) * STEP;
        len = Math.min(len, isLast ? PPQ * 3 : PPQ * 2);
        const gap = len > STEP ? 8 : 3;
        notes.push({ t: baseBar * BAR + pos * STEP, d: Math.max(STEP - 3, len - gap), p, v: strong ? 0.85 : 0.7 + r() * 0.1 });
        prev = p;
      }
    }
    return notes.filter((n) => n.t < song.bars * BAR);
  }

  /* 드럼: 한 마디 16칸 무늬. x=센 소리, o=약한 소리 */
  const PATTERNS = {
    pop:     { kick: 'x.....x.x.......', snare: '....x.......x...', chh: 'x.o.x.o.x.o.x.o.' },
    ballad:  { kick: 'x.......x.....o.', snare: '........x.......', chh: 'x...o...x...o...' },
    boombap: { kick: 'x......o..x.....', snare: '....x.......x...', chh: 'x.o.x.o.x.o.x.oo' },
    house:   { kick: 'x...x...x...x...', clap: '....x.......x...', chh: 'oooooooooooooooo', ohh: '..x...x...x...x.' },
    rock:    { kick: 'x.......x.x.....', snare: '....x.......x...', chh: 'x.x.x.x.x.x.x.x.' },
    trap:    { kick: 'x......x..x.....', snare: '........x.......', chh: 'x.x.x.x.x.xxx.x.', clap: '........x.......' },
    none:    {},
  };
  const ROW = Object.fromEntries(SG.DRUMS.map((d, i) => [d.id, i]));

  function genDrums(song, style, r) {
    const pat = PATTERNS[style] || PATTERNS.pop;
    const notes = [];
    if (style === 'none') return notes;
    for (let bar = 0; bar < song.bars; bar++) {
      const t0 = bar * BAR;
      const fill = bar % 4 === 3 && bar !== song.bars - 1 || bar === song.bars - 1 && song.bars > 1;
      for (const [id, s] of Object.entries(pat)) {
        for (let i = 0; i < 16; i++) {
          if (fill && i >= 12 && id !== 'chh' && id !== 'ohh') continue;
          const c = s[i];
          if (c === 'x' || c === 'o') notes.push({ t: t0 + i * STEP, d: STEP, p: ROW[id], v: c === 'x' ? 0.9 : 0.55 });
        }
      }
      // 변주: 가끔 킥 하나 더
      if (!fill && r.chance(0.3) && style !== 'house') notes.push({ t: t0 + 14 * STEP, d: STEP, p: ROW.kick, v: 0.6 });
      if (fill) {
        const fillPat = r.pick([
          [['snare', 12], ['snare', 13], ['tomh', 14], ['toml', 15]],
          [['tomh', 12], ['tomh', 13], ['toml', 14], ['toml', 15]],
          [['snare', 12], ['snare', 14], ['snare', 15], ['kick', 12]],
        ]);
        for (const [id, i] of fillPat) notes.push({ t: t0 + i * STEP, d: STEP, p: ROW[id], v: 0.65 + i * 0.02 });
      }
      if (bar % 4 === 0 && style !== 'ballad' || bar === 0) notes.push({ t: t0, d: STEP, p: ROW.crash, v: bar === 0 ? 0.7 : 0.6 });
    }
    // 같은 자리에 겹친 음 정리
    const seen = new Set();
    return notes.filter((n) => { const k = n.t + ':' + n.p; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  const ROLE_DEF = {
    chords: { name: '코드', color: SG.COLORS[1], rev: 0.25, vol: 0.62 },
    bass:   { name: '베이스', color: SG.COLORS[2], rev: 0.05, vol: 0.78 },
    melody: { name: '멜로디', color: SG.COLORS[0], rev: 0.3, vol: 0.75 },
    drums:  { name: '드럼', color: SG.COLORS[3], rev: 0.1, vol: 0.8 },
  };
  function ensureTrack(song, role, type, inst) {
    let tr = song.tracks.find((t) => t.role === role);
    const def = ROLE_DEF[role];
    if (!tr) {
      tr = SG.makeTrack(type, { name: def.name, role, color: def.color, rev: def.rev, vol: def.vol, inst });
      song.tracks.push(tr);
    } else tr.inst = inst;
    return tr;
  }

  /**
   * opts: { genre, prog ('lane' = 코드 레인 그대로), comp, bass, drums, density, parts: {chords,bass,melody,drums},
   *         chordInst, melInst, bassInst, kit, seed, bpm, swing }
   */
  function generate(song, opts) {
    const r = rng(opts.seed || 1);
    const g = GENRES[opts.genre] || GENRES.pop;
    if (opts.bpm) song.bpm = opts.bpm;
    if (opts.swing != null) song.swing = opts.swing;
    let chords;
    if (opts.prog === 'lane' && song.chords.some(Boolean)) {
      chords = song.chords.slice();
    } else {
      const prog = T.progressionChords(opts.prog || g.prog, song.key, song.scale);
      chords = [];
      for (let b = 0; b < song.bars; b++) chords.push(prog[b % prog.length]);
      // 마지막 마디는 으뜸화음으로 끝낸다(프로그레션이 딱 맞게 끝나지 않을 때)
      if (song.bars >= 4 && song.bars % prog.length !== 0) chords[song.bars - 1] = T.diatonic(song.key, song.scale, 0, false);
      song.chords = chords.slice();
    }
    const parts = opts.parts || { chords: true, bass: true, melody: true, drums: true };
    if (parts.chords) ensureTrack(song, 'chords', 'synth', opts.chordInst || g.chordInst).notes = genChords(song, chords, opts.comp || g.comp, r);
    if (parts.bass) ensureTrack(song, 'bass', 'synth', opts.bassInst || g.bassInst).notes = genBass(song, chords, opts.bass || g.bass, r);
    if (parts.melody) ensureTrack(song, 'melody', 'synth', opts.melInst || g.melInst).notes = genMelody(song, chords, { density: opts.density == null ? g.density : opts.density, lo: opts.lo, hi: opts.hi }, r);
    if (parts.drums) {
      const style = opts.drums || g.drums;
      const tr = ensureTrack(song, 'drums', 'drums', opts.kit || g.kit);
      tr.notes = genDrums(song, style, r);
    }
    // 비어 있는 기본 트랙은 치운다
    song.tracks = song.tracks.filter((t) => t.role || t.notes.length);
    // 역할 순서대로 정렬: 멜로디, 코드, 베이스, 드럼, 나머지
    const order = { melody: 0, chords: 1, bass: 2, drums: 3 };
    song.tracks.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));
    for (const tr of song.tracks) tr.notes.sort((a, b) => a.t - b.t || a.p - b.p);
    return song;
  }

  S.compose = { GENRES, COMP_STYLES, BASS_STYLES, DRUM_STYLES, generate, genMelody, genChords, genBass, genDrums, voice, rng };
})(globalThis.Studio = globalThis.Studio || {});
