'use strict';
/* 음악과 효과음. 음원 파일 없이 Web Audio 로 그 자리에서 합성한다.
   (재생 엔진은 같은 저장소의 「심연의 불씨」 sound.js 를 바탕으로 했고, 곡은 모두 새로 썼다.)
   악보: 한 칸은 8분음표, '-' 는 앞 음을 늘이고 '.' 는 쉼. '|' 는 마디 구분(무시). */

const Sound = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, songGain = null, comp = null;
  let noiseBuf = null;
  const waves = {};
  const settings = { music: 0.55, sfx: 0.8 };
  let current = null, wanted = null, afterSong = null, step = 0, nextTime = 0, timer = null;

  const SONGS = {
    title: { bpm: 96, ch: [
      ['p25', 0.15, 'E5 - - - D5 - C5 - | D5 - - - G4 - - - | C5 - D5 - E5 - G5 - | A5 - - - G5 - - - | F5 - - - E5 - D5 - | E5 - - - A4 - - - | D5 - E5 - F5 - D5 - | C5 - - - - - . .'],
      ['tri', 0.30, 'C3 - G3 - C4 - G3 - | G2 - D3 - G3 - D3 - | A2 - E3 - A3 - E3 - | E2 - B2 - E3 - B2 - | F2 - C3 - F3 - C3 - | C3 - G3 - A3 - E3 - | D3 - A3 - G2 - D3 - | C3 - G3 - C4 - - -'],
      ['p12', 0.05, 'E4 G4 C5 G4 E4 G4 C5 G4 | D4 G4 B4 G4 D4 G4 B4 G4 | C4 E4 A4 E4 C4 E4 A4 E4 | B3 E4 G4 E4 B3 E4 G4 E4 | A3 C4 F4 C4 A3 C4 F4 C4 | G3 C4 E4 C4 A3 C4 E4 C4 | A3 D4 F4 D4 B3 D4 G4 D4 | C4 E4 G4 C5 G4 E4 C4 G3']
    ] },
    story: { bpm: 72, ch: [
      ['p50', 0.10, 'A4 - - - C5 - B4 - | A4 - - - E4 - - - | F4 - - - G4 - A4 - | G4 - - - - - . . | A4 - - - C5 - D5 - | E5 - - - D5 - C5 - | B4 - - - G#4 - B4 - | A4 - - - - - . .'],
      ['tri', 0.28, 'A2 - - - E3 - - - | A2 - - - C3 - - - | F2 - - - C3 - - - | G2 - - - D3 - - - | F2 - - - C3 - - - | C3 - - - G3 - - - | E2 - - - B2 - - - | A2 - - - E3 - - -'],
      ['p12', 0.04, 'C4 E4 A4 E4 C4 E4 A4 E4 | C4 E4 A4 E4 C4 E4 A4 E4 | A3 C4 F4 C4 A3 C4 F4 C4 | B3 D4 G4 D4 B3 D4 G4 D4 | A3 C4 F4 C4 A3 C4 F4 C4 | C4 E4 G4 E4 C4 E4 G4 E4 | B3 E4 G#4 E4 B3 E4 G#4 E4 | C4 E4 A4 E4 C4 E4 A4 E4']
    ] },
    town: { bpm: 112, ch: [
      ['p25', 0.13, 'G4 - C5 - E5 - D5 C5 | D5 - - - G4 - - - | A4 - D5 - F5 - E5 D5 | E5 - - - C5 - - - | F5 - E5 - D5 - C5 - | B4 - C5 - D5 - G4 - | A4 - B4 - C5 - D5 - | C5 - - - - - . .'],
      ['tri', 0.30, 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | F2 . C3 . G2 . D3 . | C3 . G3 . C3 . . .'],
      ['p12', 0.045, 'E4 . G4 . E4 . G4 . | D4 . G4 . D4 . G4 . | F4 . A4 . F4 . A4 . | E4 . G4 . E4 . G4 . | F4 . A4 . F4 . A4 . | D4 . G4 . D4 . G4 . | F4 . A4 . D4 . G4 . | E4 . G4 . C5 . . .']
    ], drums: 'k . h . s . h . | k . h h s . h .' },
    desert: { bpm: 104, ch: [
      ['p25', 0.13, 'D5 - E5 - F5 - - - | E5 - D5 - C#5 - - - | D5 - A4 - A#4 - A4 - | G4 - - - A4 - - - | D5 - E5 - F5 - G5 - | A5 - G5 - F5 - E5 - | F5 - E5 - D5 - C#5 - | D5 - - - - - . .'],
      ['tri', 0.30, 'D3 . A3 . D3 . A3 . | A2 . E3 . A2 . E3 . | D3 . A3 . D3 . A3 . | C3 . G3 . A2 . E3 . | D3 . A3 . D3 . A3 . | F3 . C4 . F3 . C4 . | A#2 . F3 . A2 . E3 . | D3 . A3 . D3 . . .'],
      ['p12', 0.04, 'A4 D5 A4 D5 A4 D5 A4 D5 | A4 C#5 A4 C#5 A4 C#5 A4 C#5 | A4 D5 A4 D5 A4 D5 A4 D5 | G4 C5 G4 C5 A4 C#5 A4 C#5']
    ], drums: 'k . . h k . s . | k . . h k . s h' },
    snowtown: { bpm: 132, ch: [
      ['p50', 0.10, 'B4 - - D5 - - | C5 - - A4 - - | G4 - - B4 - - | A4 - - - - - | B4 - - D5 - - | E5 - - D5 - - | C5 - - A4 - - | G4 - - - - -'],
      ['tri', 0.28, 'G2 - - D3 - - | A2 - - E3 - - | E2 - - B2 - - | D2 - - A2 - - | G2 - - D3 - - | C3 - - G3 - - | D3 - - A2 - - | G2 - - D3 - -'],
      ['p12', 0.04, '. G4 B4 . G4 B4 | . A4 C5 . A4 C5 | . G4 B4 . G4 B4 | . F#4 A4 . F#4 A4 | . G4 B4 . G4 B4 | . G4 C5 . G4 C5 | . F#4 A4 . F#4 C5 | . G4 B4 . D5 .']
    ] },
    castle: { bpm: 88, ch: [
      ['p25', 0.12, 'D5 - - - A4 - - - | A#4 - - - A4 - G4 - | F4 - - - G4 - A4 - | E4 - - - - - . . | D5 - - - F5 - - - | E5 - D5 - C#5 - - - | D5 - A4 - G4 - F4 - | D4 - - - - - . .'],
      ['tri', 0.30, 'D2 - - - D3 - - - | G2 - - - G3 - - - | A#1 - - - A#2 - - - | A1 - - - A2 - - - | D2 - - - D3 - - - | A1 - - - A2 - - - | A#1 - - - A1 - - - | D2 - - - D3 - - -'],
      ['p12', 0.04, 'D4 F4 A4 F4 D4 F4 A4 F4 | D4 G4 A#4 G4 D4 G4 A#4 G4 | D4 F4 A#4 F4 D4 F4 A#4 F4 | C#4 E4 A4 E4 C#4 E4 A4 E4']
    ], drums: 'k . . . s . . . | k . k . s . . h' },
    world: { bpm: 120, ch: [
      ['p25', 0.13, 'C5 - - G4 C5 - E5 - | D5 - - - G4 - - - | A4 - - E4 A4 - C5 - | B4 - - - - - . . | F4 - - C5 F5 - E5 - | D5 - - B4 G4 - - - | A4 - B4 - C5 - D5 - | E5 - - - C5 - . .'],
      ['tri', 0.30, 'C3 . C3 G3 C3 . C3 G3 | G2 . G2 D3 G2 . G2 D3 | A2 . A2 E3 A2 . A2 E3 | E2 . E2 B2 E2 . E2 B2 | F2 . F2 C3 F2 . F2 C3 | G2 . G2 D3 G2 . G2 D3 | F2 . F2 C3 G2 . G2 D3 | C3 . C3 G3 C3 . G2 .'],
      ['p12', 0.04, 'E4 G4 C5 G4 E4 G4 C5 G4 | D4 G4 B4 G4 D4 G4 B4 G4 | C4 E4 A4 E4 C4 E4 A4 E4 | B3 E4 G#4 E4 B3 E4 G#4 E4']
    ], drums: 'k . h . s . h . | k . h k s . h .' },
    field: { bpm: 100, ch: [
      ['p50', 0.10, 'E5 - - - B4 - - - | C5 - D5 - E5 - - - | D5 - - - A4 - - - | B4 - C5 - D5 - - - | C5 - - - G4 - A4 - | B4 - - - E4 - - - | A4 - B4 - C5 - B4 - | A4 - - - - - . .'],
      ['tri', 0.28, 'A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | E2 . B2 . E2 . B2 . | F2 . C3 . F2 . C3 . | E2 . B2 . E2 . B2 . | D2 . A2 . E2 . B2 . | A2 . E3 . A2 . . .'],
      ['p12', 0.04, 'A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 F3 A3 C4 A3 | G3 B3 D4 B3 G3 B3 D4 B3 | E3 G#3 B3 G#3 E3 G#3 B3 G#3']
    ], drums: 'k . . h . . s . | k . . h k . s h' },
    dungeon: { bpm: 84, ch: [
      ['p25', 0.11, 'E5 - - - F5 - - - | E5 - - - B4 - - - | C5 - - - B4 - A4 - | B4 - - - - - - - | E5 - - - F5 - - - | G5 - - - F5 - E5 - | D5 - - - C5 - B4 - | E4 - - - - - - -'],
      ['tri', 0.30, 'E2 - - - E2 - - - | E2 - - - E2 - - - | A1 - - - A1 - - - | B1 - - - B1 - - - | C2 - - - C2 - - - | C2 - - - C2 - - - | D2 - - - B1 - - - | E2 - - - E2 - - -'],
      ['p12', 0.045, 'E4 G4 B4 G4 E4 G4 B4 G4 | F4 A4 C5 A4 F4 A4 C5 A4 | A3 C4 E4 C4 A3 C4 E4 C4 | B3 D#4 F#4 D#4 B3 D#4 F#4 D#4']
    ], drums: 'k . . . . . . . | s . . . . . h .' },
    cave: { bpm: 78, ch: [
      ['p50', 0.09, 'B4 - - - - - F#5 - | E5 - - - D5 - - - | C#5 - - - D5 - E5 - | F#5 - - - - - . . | B4 - - - - - D5 - | C#5 - - - A4 - - - | B4 - C#5 - D5 - C#5 - | B4 - - - - - . .'],
      ['tri', 0.28, 'B1 - - - B2 - - - | G1 - - - G2 - - - | A1 - - - A2 - - - | F#1 - - - F#2 - - - | B1 - - - B2 - - - | A1 - - - A2 - - - | G1 - - - F#1 - - - | B1 - - - B2 - - -'],
      ['p12', 0.035, '. B4 . D5 . F#5 . D5 | . B4 . D5 . G5 . D5 | . A4 . C#5 . E5 . C#5 | . A#4 . C#5 . F#5 . C#5']
    ] },
    dusk: { bpm: 96, ch: [
      ['p25', 0.12, 'C5 - - - D#5 - - - | D5 - C5 - G4 - - - | G#4 - - - G4 - F4 - | G4 - - - - - . . | C5 - - - D#5 - G5 - | F5 - D#5 - D5 - - - | D#5 - D5 - C5 - B4 - | C5 - - - - - . .'],
      ['tri', 0.32, 'C2 . C3 . C2 . C3 . | G1 . G2 . G1 . G2 . | G#1 . G#2 . G#1 . G#2 . | G1 . G2 . G1 . B1 . | C2 . C3 . C2 . C3 . | A#1 . A#2 . A#1 . A#2 . | G#1 . G#2 . G1 . G2 . | C2 . C3 . C2 . . .'],
      ['p12', 0.04, 'G4 C5 D#5 C5 G4 C5 D#5 C5 | G4 B4 D5 B4 G4 B4 D5 B4 | G#4 C5 D#5 C5 G#4 C5 D#5 C5 | G4 B4 D5 B4 G4 B4 D5 F5']
    ], drums: 'k . . h s . . h | k . k h s . h .' },
    battle: { bpm: 160, ch: [
      ['p25', 0.15, 'A4 - C5 - E5 - A5 - | G5 - E5 - D5 - C5 - | F5 - E5 - D5 - C5 - | B4 - G#4 - E4 - - - | A4 - C5 - E5 - A5 - | B5 - A5 - G5 - E5 - | F5 - E5 - D5 - B4 - | A4 - - - E5 - G#5 -'],
      ['tri', 0.34, 'A2 A3 A2 A3 A2 A3 A2 A3 | C3 C4 C3 C4 C3 C4 C3 C4 | D3 D4 D3 D4 D3 D4 D3 D4 | E3 E4 E3 E4 E3 E4 E3 E4 | A2 A3 A2 A3 A2 A3 A2 A3 | G2 G3 G2 G3 G2 G3 G2 G3 | F2 F3 F2 F3 E2 E3 E2 E3 | A2 A3 A2 A3 E2 E3 E2 E3'],
      ['p12', 0.05, 'E4 A4 C5 A4 E4 A4 C5 A4 | E4 G4 C5 G4 E4 G4 C5 G4 | F4 A4 D5 A4 F4 A4 D5 A4 | E4 G#4 B4 G#4 E4 G#4 B4 G#4 | E4 A4 C5 A4 E4 A4 C5 A4 | D4 G4 B4 G4 D4 G4 B4 G4 | C4 F4 A4 F4 B3 E4 G#4 E4 | C4 E4 A4 E4 B3 E4 G#4 B4']
    ], drums: 'k . h k s . h . | k k h . s . h s' },
    boss: { bpm: 168, ch: [
      ['p25', 0.16, 'D5 - - D5 F5 - D5 - | A5 - G5 - F5 - E5 - | D5 - - D5 F5 - A5 - | A#5 - A5 - G5 - A5 - | D5 - - D5 F5 - D5 - | C6 - A#5 - A5 - G5 - | F5 - G5 - A5 - C#5 - | D5 - - - A4 - C#5 -'],
      ['tri', 0.36, 'D2 D3 D2 D3 D2 D3 D2 D3 | D2 D3 D2 D3 C2 C3 C2 C3 | A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 | G1 G2 G1 G2 A1 A2 A1 A2 | D2 D3 D2 D3 D2 D3 D2 D3 | F2 F3 F2 F3 G2 G3 G2 G3 | A#1 A#2 A#1 A#2 A1 A2 A1 A2 | D2 D3 D2 D3 A1 A2 C#2 C#3'],
      ['p12', 0.05, 'A4 D5 F5 D5 A4 D5 F5 D5 | A4 C5 E5 C5 G4 C5 E5 C5 | A#4 D5 F5 D5 A#4 D5 F5 D5 | A#4 D5 G5 D5 A4 C#5 E5 C#5']
    ], drums: 'k h s h k k s h | k h s h k s s s' },
    final: { bpm: 176, ch: [
      ['p25', 0.16, 'E5 - - - B5 - - - | A5 - G5 - F#5 - E5 - | D5 - - - A5 - - - | G5 - F#5 - E5 - D5 - | C5 - - - G5 - - - | F#5 - E5 - D#5 - F#5 - | B5 - A5 - G5 - F#5 - | E5 - - - B4 - D#5 -'],
      ['p50', 0.06, 'B4 - - - E5 - - - | E5 - - - B4 - - - | A4 - - - D5 - - - | D5 - - - A4 - - - | G4 - - - C5 - - - | B4 - - - B4 - - - | D#5 - - - B4 - - - | G4 - - - F#4 - - -'],
      ['tri', 0.36, 'E2 E3 E2 E3 E2 E3 E2 E3 | E2 E3 E2 E3 E2 E3 E2 E3 | D2 D3 D2 D3 D2 D3 D2 D3 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | B1 B2 B1 B2 B1 B2 B1 B2 | A1 A2 A1 A2 B1 B2 B1 B2 | E2 E3 E2 E3 B1 B2 B1 B2'],
      ['p12', 0.04, 'G4 B4 E5 B4 G4 B4 E5 B4 | G4 B4 E5 B4 G4 B4 E5 B4 | F#4 A4 D5 A4 F#4 A4 D5 A4 | F#4 A4 D5 A4 F#4 A4 D5 A4 | E4 G4 C5 G4 E4 G4 C5 G4 | D#4 F#4 B4 F#4 D#4 F#4 B4 F#4 | E4 A4 C5 A4 D#4 F#4 B4 F#4 | E4 G4 B4 G4 D#4 F#4 B4 F#4']
    ], drums: 'k h s h k h s k | k h s h k k s s' },
    victory: { bpm: 140, once: true, ch: [
      ['p25', 0.18, 'C5 C5 C5 C5 - - G#4 - A#4 - C5 - A#4 C5 - - - - . .'],
      ['tri', 0.32, 'C3 C3 C3 C3 - - G#2 - A#2 - C3 - G2 C3 - - - - . .'],
      ['p12', 0.06, 'E4 E4 E4 E4 - - C4 - D4 - E4 - D4 E4 - - - - . .']
    ], drums: 'k k k k . . k . k . k . s k . . . . . .' },
    gameover: { bpm: 80, once: true, ch: [
      ['p25', 0.16, 'E5 - D5 - C5 - B4 - A4 - - - G#4 - - - A4 - - - - - - - . .'],
      ['tri', 0.3, 'A2 - - - F2 - - - D2 - - - E2 - - - A1 - - - - - - - . .']
    ] },
    ending: { bpm: 90, ch: [
      ['p25', 0.13, 'G4 - C5 - E5 - G5 - | F5 - E5 - D5 - - - | E5 - D5 - C5 - A4 - | G4 - - - - - . . | A4 - C5 - F5 - A5 - | G5 - F5 - E5 - D5 - | C5 - D5 - E5 - D5 - | C5 - - - - - . .'],
      ['tri', 0.28, 'C3 - G3 - C3 - G3 - | G2 - D3 - G2 - D3 - | A2 - E3 - F2 - C3 - | C3 - G3 - G2 - D3 - | F2 - C3 - F2 - C3 - | C3 - G3 - G2 - D3 - | F2 - C3 - G2 - D3 - | C3 - G3 - C4 - - -'],
      ['p12', 0.04, 'E4 G4 C5 G4 E4 G4 C5 G4 | D4 G4 B4 G4 D4 G4 B4 G4 | C4 E4 A4 E4 A3 C4 F4 C4 | E4 G4 C5 G4 D4 G4 B4 G4 | C4 F4 A4 F4 C4 F4 A4 F4 | E4 G4 C5 G4 D4 G4 B4 G4 | C4 F4 A4 F4 D4 G4 B4 G4 | E4 G4 C5 G4 E4 G4 C5 .']
    ] }
  };
  const ALIAS = { town2: 'desert', town3: 'snowtown', town4: 'castle', tomb: 'dungeon', tower: 'dungeon' };

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
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
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
    if (id && ALIAS[id]) id = ALIAS[id];
    if (after && ALIAS[after]) after = ALIAS[after];
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
    if (!id || !SONGS[id]) { songGain = null; current = null; return; }
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
    if (['tri', 'sine', 'sawtooth', 'square'].includes(w)) o.type = w === 'tri' ? 'triangle' : w;
    else o.setPeriodicWave(waves[w]);
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const arp = (w, notes, gap, dur, vol, delay = 0) => notes.forEach((n, i) => blip(w, freqOf(n), freqOf(n), dur, vol, delay + i * gap));
  /* 종소리: 비조화 배음을 겹쳐 길게 울린다 */
  function bell(f, vol = 0.3, len = 3.5, delay = 0) {
    const t = ac.currentTime + delay;
    for (const [r, v, d] of [[0.5, 0.6, 1], [1, 1, 1], [1.19, 0.45, 0.7], [1.5, 0.35, 0.6], [2, 0.5, 0.55], [2.74, 0.25, 0.4], [3.76, 0.15, 0.3]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len * d);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + len * d + 0.05);
    }
  }
  const lastAt = {};
  function sfx(name, opt = {}) {
    if (!ac || ac.state !== 'running' || settings.sfx <= 0) return;
    const now = ac.currentTime;
    if (lastAt[name] && now - lastAt[name] < 0.035) return;
    lastAt[name] = now;
    const d = (opt.delay || 0) / 1000;
    const t = now + d;
    switch (name) {
      case 'swing': noise(t, 0.09, 0.18, sfxBus, 'bandpass', 2500, 1.2, 900); break;
      case 'cast': for (let k = 0; k < 4; k++) blip('sine', 500 + k * 160, 900 + k * 200, 0.12, 0.08, d + k * 0.04); break;
      case 'hit': blip('p50', 220, 70, 0.12, 0.26, d); noise(t, 0.07, 0.2, sfxBus, 'lowpass', 2200); break;
      case 'crit': blip('p25', 520, 90, 0.18, 0.3, d); noise(t, 0.12, 0.3, sfxBus, 'lowpass', 3500); break;
      case 'weak': blip('p25', 900, 300, 0.1, 0.22, d); noise(t, 0.1, 0.25, sfxBus, 'highpass', 3000); blip('p12', 1400, 1400, 0.05, 0.12, d + 0.05); break;
      case 'hurt': blip('p50', 180, 55, 0.2, 0.3, d); noise(t, 0.1, 0.22, sfxBus, 'lowpass', 1200); break;
      case 'miss': noise(t, 0.12, 0.08, sfxBus, 'bandpass', 3500, 2, 1500); break;
      case 'break': noise(t, 0.4, 0.4, sfxBus, 'highpass', 2500, 0.7, 600); arp('p25', ['E6', 'C6', 'G5', 'E5', 'C5'], 0.035, 0.14, 0.16, d); blip('tri', 120, 40, 0.4, 0.4, d); break;
      case 'recover': arp('p12', ['C5', 'E5', 'G5'], 0.05, 0.1, 0.12, d); break;
      case 'kill': blip('p25', 400, 60, 0.25, 0.22, d); noise(t + 0.05, 0.2, 0.15, sfxBus, 'lowpass', 1500, 0.7, 200); break;
      case 'down': blip('p50', 300, 60, 0.5, 0.25, d); break;
      case 'heal': arp('sine', ['C6', 'E6', 'G6', 'C7'], 0.05, 0.18, 0.11, d); break;
      case 'revive': arp('sine', ['G5', 'C6', 'E6', 'G6', 'C7'], 0.06, 0.25, 0.12, d); break;
      case 'buff': arp('p25', ['C5', 'G5', 'C6'], 0.04, 0.1, 0.1, d); break;
      case 'debuff': arp('p25', ['C6', 'G5', 'C5'], 0.04, 0.1, 0.1, d); break;
      case 'swap': noise(t, 0.15, 0.15, sfxBus, 'bandpass', 1500, 1, 4000); blip('p12', 500, 900, 0.1, 0.1, d); break;
      case 'latent': arp('p25', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.04, 0.2, 0.15, d); noise(t, 0.5, 0.15, sfxBus, 'highpass', 4000); break;
      case 'ready': arp('p12', ['G5', 'D6', 'G6'], 0.06, 0.12, 0.12, d); break;
      case 'charge': blip('sawtooth', 80, 240, 0.8, 0.12, d); noise(t, 0.8, 0.1, sfxBus, 'lowpass', 400, 1, 2000); break;
      case 'roar': blip('sawtooth', 110, 55, 0.9, 0.2, d); noise(t, 0.8, 0.2, sfxBus, 'lowpass', 500); break;
      case 'summon': blip('sine', 600, 120, 0.5, 0.18, d); break;
      case 'bp': blip('p25', 880, 1320, 0.08, 0.12, d); break;
      case 'boostup': blip('p25', 660, 990, 0.07, 0.13, d); blip('p12', 990, 1320, 0.06, 0.08, d + 0.04); break;
      case 'defend': noise(t, 0.1, 0.18, sfxBus, 'bandpass', 1200, 2); blip('tri', 300, 300, 0.08, 0.15, d); break;
      case 'reveal': blip('p12', 1200, 1600, 0.06, 0.1, d); break;
      case 'turn': blip('p25', 1046, 1046, 0.05, 0.08, d); blip('p25', 1568, 1568, 0.06, 0.08, d + 0.05); break;
      case 'menu': blip('p25', 880, 880, 0.035, 0.07, d); break;
      case 'ok': blip('p25', 988, 1318, 0.06, 0.09, d); break;
      case 'cancel': blip('p25', 660, 440, 0.06, 0.08, d); break;
      case 'error': blip('square', 120, 100, 0.08, 0.1, d); blip('square', 120, 100, 0.08, 0.1, d + 0.1); break;
      case 'text': blip('p50', 700 + Math.random() * 80, 700, 0.025, 0.035, d); break;
      case 'levelup': arp('p25', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.07, 0.14, 0.16, d); break;
      case 'flee': for (let k = 0; k < 5; k++) blip('p12', 800 - k * 100, 400 - k * 50, 0.05, 0.1, d + k * 0.05); break;
      case 'pickup': arp('p25', ['E6', 'A6'], 0.06, 0.08, 0.14, d); break;
      case 'chest': noise(t, 0.08, 0.2, sfxBus, 'lowpass', 900); arp('p25', ['G5', 'B5', 'D6', 'G6'], 0.06, 0.1, 0.14, d + 0.05); break;
      case 'door': noise(t, 0.12, 0.25, sfxBus, 'lowpass', 500); blip('sawtooth', 140, 220, 0.18, 0.05, d + 0.03); break;
      case 'buy': arp('p25', ['A5', 'E6'], 0.05, 0.1, 0.13, d); break;
      case 'equip': noise(t, 0.08, 0.2, sfxBus, 'bandpass', 3000, 3); blip('p12', 600, 900, 0.08, 0.1, d + 0.03); break;
      case 'save': arp('sine', ['C6', 'G6', 'C7'], 0.08, 0.3, 0.1, d); break;
      case 'encounter': for (let k = 0; k < 8; k++) blip('p25', 300 + k * 120, 300 + k * 120, 0.04, 0.12, d + k * 0.03); noise(t, 0.3, 0.15, sfxBus, 'highpass', 2000, 1, 8000); break;
      case 'inn': arp('tri', ['C5', 'E5', 'G5', 'E5', 'C5', 'G4', 'C5'], 0.16, 0.3, 0.22, d); break;
      case 'bell': bell(196, 0.32, 4.5, d); bell(196, 0.22, 4, d + 1.1); bell(196, 0.18, 4, d + 2.2); break;
      case 'smallbell': bell(523, 0.18, 1.6, d); break;
    }
  }

  return {
    unlock, play, sfx,
    get settings() { return settings; },
    get current() { return current || wanted; },
    setVolume(k, v) { settings[k] = v; applyVolume(); if (k === 'music' && v > 0 && wanted && !current) play(wanted); },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    get ready() { return !!ac && ac.state === 'running'; }
  };
})();
