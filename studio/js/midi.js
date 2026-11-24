'use strict';
/* 표준 MIDI 파일(SMF) 내보내기·불러오기 */
(function (S) {
  const T = S.theory, SG = S.song;

  function vlq(n) {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  }
  const str = (s) => Array.from(new TextEncoder().encode(s));
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const u16 = (n) => [(n >>> 8) & 255, n & 255];

  function chunk(type, bytes) { return [...str(type), ...u32(bytes.length), ...bytes]; }

  function trackChunk(events) {
    // events: {t, bytes, order}
    events.sort((a, b) => a.t - b.t || a.order - b.order);
    const out = [];
    let last = 0;
    for (const e of events) { out.push(...vlq(e.t - last), ...e.bytes); last = e.t; }
    out.push(0, 0xff, 0x2f, 0);
    return chunk('MTrk', out);
  }

  function exportMidi(song) {
    const tracks = [];
    // 0번 트랙: 템포·박자·제목
    const mpq = Math.round(60000000 / song.bpm);
    const title = str(song.title || '');
    tracks.push(trackChunk([
      { t: 0, order: 0, bytes: [0xff, 0x03, ...vlq(title.length), ...title] },
      { t: 0, order: 1, bytes: [0xff, 0x51, 3, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255] },
      { t: 0, order: 2, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] },
    ]));
    let ch = 0;
    for (const tr of song.tracks) {
      const drums = tr.type === 'drums';
      const c = drums ? 9 : ch;
      if (!drums) { ch++; if (ch === 9) ch++; if (ch > 15) ch = 15; }
      const name = str(tr.name);
      const ev = [{ t: 0, order: 0, bytes: [0xff, 0x03, ...vlq(name.length), ...name] }];
      if (!drums) ev.push({ t: 0, order: 1, bytes: [0xc0 | c, (SG.INSTRUMENTS[tr.inst] || SG.INSTRUMENTS.piano).gm] });
      ev.push({ t: 0, order: 2, bytes: [0xb0 | c, 7, Math.round(Math.min(1, tr.vol) * 127)] });
      ev.push({ t: 0, order: 3, bytes: [0xb0 | c, 10, Math.round((tr.pan + 1) * 63.5)] });
      ev.push({ t: 0, order: 4, bytes: [0xb0 | c, 91, Math.round(tr.rev * 127)] });
      for (const n of tr.notes) {
        const key = drums ? (SG.DRUMS[n.p] || SG.DRUMS[0]).gm : n.p;
        const vel = Math.max(1, Math.min(127, Math.round(n.v * 127)));
        const st = Math.round(S.audio.swingTick(n.t, song.swing));
        const d = drums ? Math.min(n.d, T.PPQ / 4) : n.d;
        ev.push({ t: st, order: 6, bytes: [0x90 | c, key, vel] });
        ev.push({ t: st + Math.max(1, d), order: 5, bytes: [0x80 | c, key, 0] });
      }
      tracks.push(trackChunk(ev));
    }
    const header = chunk('MThd', [...u16(1), ...u16(tracks.length), ...u16(T.PPQ)]);
    return new Uint8Array([...header, ...tracks.flat()]);
  }

  /* 불러오기 */
  function gmToInst(prog) {
    const exact = { 5: 'wurli', 6: 'harpsi', 7: 'clav', 8: 'celesta', 9: 'glock', 10: 'musicbox', 11: 'vibes', 12: 'marimba', 13: 'xylo',
      21: 'accordion', 22: 'harmonica', 23: 'accordion', 24: 'nylon', 25: 'agtr', 26: 'egtr_clean', 27: 'egtr_clean', 28: 'muted', 29: 'egtr_drive', 30: 'heavy',
      32: 'upright', 33: 'fbass', 34: 'fbass', 36: 'slap', 37: 'slap', 39: 'acid', 40: 'violin', 42: 'cello', 43: 'upright', 45: 'pizz', 46: 'harp', 47: 'timpani',
      52: 'choir', 53: 'ooh', 54: 'vox', 55: 'orchhit', 56: 'trumpet', 57: 'trombone', 60: 'horn', 62: 'synbrass', 63: 'synbrass',
      68: 'oboe', 71: 'clarinet', 77: 'shakuhachi', 80: 'sqlead', 85: 'vox', 104: 'sitar', 105: 'banjo', 106: 'shamisen', 107: 'koto', 108: 'kalimba',
      110: 'erhu', 114: 'steeldrum' };
    if (exact[prog]) return exact[prog];
    if (prog <= 3) return 'piano';
    if (prog <= 7) return 'epiano';
    if (prog <= 15) return 'bell';
    if (prog <= 23) return 'organ';
    if (prog <= 31) return 'egtr_drive';
    if (prog <= 39) return prog === 32 ? 'fbass' : 'bass';
    if (prog <= 55) return 'strings';
    if (prog <= 63) return 'brass';
    if (prog <= 71) return 'sax';
    if (prog <= 79) return 'flute';
    if (prog <= 87) return 'lead';
    if (prog <= 103) return 'pad';
    return 'piano';
  }
  function gmToDrum(k) {
    if (k === 35 || k === 36) return 0;
    if (k === 37 || k === 38 || k === 40) return 1;
    if (k === 39) return 2;
    if (k === 42 || k === 44) return 3;
    if (k === 46) return 4;
    if (k === 47 || k === 48 || k === 50) return 5;
    if (k === 41 || k === 43 || k === 45) return 6;
    if (k === 49 || k === 52 || k === 55 || k === 57) return 7;
    if (k === 51 || k === 53 || k === 59) return 8;
    if (k === 54) return 9;
    if (k === 69 || k === 70 || k === 82) return 10;
    return -1;
  }

  function importMidi(bytes) {
    const d = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let p = 0;
    const rd = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 8) | d[p++]; return v >>> 0; };
    const tag = () => String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]);
    if (tag() !== 'MThd') throw new Error('MIDI 파일이 아닙니다');
    p += 4; const hl = rd(4); const fmt = rd(2); const ntr = rd(2); const div = rd(2); p += hl - 6;
    if (div & 0x8000) throw new Error('SMPTE 시간 형식은 지원하지 않습니다');
    void fmt;
    const scale = T.PPQ / div;
    let tempo = 0, title = '';
    const parts = new Map(); // 채널+트랙 → {name, prog, notes}
    for (let ti = 0; ti < ntr && p < d.length; ti++) {
      while (p < d.length && tag() !== 'MTrk') { p += 4; const l = rd(4); p += l; }
      if (p >= d.length) break;
      p += 4; const len = rd(4); const end = p + len;
      let t = 0, run = 0, tname = '';
      const open = new Map();
      const progs = {};
      const vlqR = () => { let v = 0, b; do { b = d[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80 && p < end); return v; };
      while (p < end) {
        t += vlqR();
        let st = d[p];
        if (st & 0x80) { p++; if (st < 0xf0) run = st; } else st = run;
        if (st === 0xff) {
          const type = d[p++]; const l = vlqR();
          const data = d.subarray(p, p + l); p += l;
          if (type === 0x51 && !tempo) tempo = 60000000 / ((data[0] << 16) | (data[1] << 8) | data[2]);
          if (type === 0x03) { try { tname = new TextDecoder().decode(data); } catch (e) { tname = ''; } if (ti === 0 && !title) title = tname; }
          continue;
        }
        if (st === 0xf0 || st === 0xf7) { const l = vlqR(); p += l; continue; }
        const kind = st & 0xf0, ch = st & 0x0f;
        const a = d[p++];
        const b = (kind === 0xc0 || kind === 0xd0) ? 0 : d[p++];
        const keyOf = (ch2) => ti + ':' + ch2;
        if (kind === 0xc0) { progs[ch] = a; const part = parts.get(keyOf(ch)); if (part && part.prog == null) part.prog = a; continue; }
        if (kind === 0x90 && b > 0) {
          const k = ch + ':' + a;
          if (!open.has(k)) open.set(k, []);
          open.get(k).push({ t, v: b / 127 });
        } else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
          const k = ch + ':' + a;
          const stack = open.get(k);
          if (stack && stack.length) {
            const on = stack.shift();
            const pk = keyOf(ch);
            if (!parts.has(pk)) parts.set(pk, { name: tname, ch, prog: progs[ch], notes: [] });
            parts.get(pk).notes.push({ t: on.t, d: Math.max(1, t - on.t), p: a, v: on.v });
          }
        }
      }
      for (const part of parts.values()) if (!part.name) part.name = tname;
      p = end;
    }
    const song = SG.newSong();
    song.tracks = [];
    song.title = title || '불러온 곡';
    if (tempo) song.bpm = Math.round(tempo);
    let maxT = 0, ci = 0;
    for (const part of parts.values()) {
      const drums = part.ch === 9;
      const tr = SG.makeTrack(drums ? 'drums' : 'synth', {
        name: (part.name || (drums ? '드럼' : '트랙 ' + (song.tracks.length + 1))).slice(0, 40),
        inst: drums ? 'std' : gmToInst(part.prog || 0),
        color: SG.COLORS[ci++ % SG.COLORS.length],
      });
      for (const n of part.notes) {
        const nt = Math.round(n.t * scale), nd = Math.max(1, Math.round(n.d * scale));
        if (drums) {
          const row = gmToDrum(n.p);
          if (row < 0) continue;
          tr.notes.push({ t: nt, d: T.PPQ / 4, p: row, v: n.v });
        } else tr.notes.push({ t: nt, d: nd, p: n.p, v: n.v });
        maxT = Math.max(maxT, nt + nd);
      }
      tr.notes.sort((x, y) => x.t - y.t || x.p - y.p);
      if (tr.notes.length) song.tracks.push(tr);
    }
    if (!song.tracks.length) throw new Error('음표가 없는 MIDI 파일입니다');
    song.bars = Math.max(1, Math.min(256, Math.ceil(maxT / T.BAR)));
    song.chords = new Array(song.bars).fill(null);
    return SG.normalize(song);
  }

  S.midi = { exportMidi, importMidi };
})(globalThis.Studio = globalThis.Studio || {});
