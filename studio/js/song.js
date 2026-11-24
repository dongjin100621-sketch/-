'use strict';
/* 곡 데이터: 트랙·음표·코드, 되돌리기 기록, 저장소 */
(function (S) {
  const T = S.theory;

  // cat: 악기 고르는 목록의 묶음
  const INSTRUMENTS = {
    piano:      { name: '피아노',              gm: 0,   cat: '건반' },
    epiano:     { name: '일렉 피아노',         gm: 4,   cat: '건반' },
    organ:      { name: '오르간',              gm: 16,  cat: '건반' },
    glock:      { name: '글로켄슈필',          gm: 9,   cat: '건반' },
    musicbox:   { name: '오르골',              gm: 10,  cat: '건반' },
    bell:       { name: '벨',                  gm: 14,  cat: '건반' },
    agtr:       { name: '어쿠스틱 기타',       gm: 25,  cat: '기타·베이스' },
    egtr_clean: { name: '일렉 기타 (클린)',    gm: 27,  cat: '기타·베이스' },
    egtr_drive: { name: '일렉 기타 (드라이브)', gm: 29, cat: '기타·베이스' },
    fbass:      { name: '핑거 베이스',         gm: 33,  cat: '기타·베이스' },
    slap:       { name: '슬랩 베이스',         gm: 36,  cat: '기타·베이스' },
    bass:       { name: '신스 베이스',         gm: 38,  cat: '기타·베이스' },
    sub808:     { name: '808 베이스',          gm: 38,  cat: '기타·베이스' },
    strings:    { name: '스트링',              gm: 48,  cat: '현악·관악·합창' },
    violin:     { name: '바이올린',            gm: 40,  cat: '현악·관악·합창' },
    pizz:       { name: '피치카토',            gm: 45,  cat: '현악·관악·합창' },
    harp:       { name: '하프',                gm: 46,  cat: '현악·관악·합창' },
    brass:      { name: '브라스',              gm: 61,  cat: '현악·관악·합창' },
    sax:        { name: '색소폰',              gm: 65,  cat: '현악·관악·합창' },
    flute:      { name: '플루트',              gm: 73,  cat: '현악·관악·합창' },
    choir:      { name: '코러스 (아—)',        gm: 52,  cat: '현악·관악·합창' },
    supersaw:   { name: '슈퍼소 리드',         gm: 81,  cat: '신스' },
    lead:       { name: '신스 리드',           gm: 81,  cat: '신스' },
    synbrass:   { name: '신스 브라스',         gm: 62,  cat: '신스' },
    pad:        { name: '신스 패드',           gm: 89,  cat: '신스' },
    pluck:      { name: '신스 플럭',           gm: 84,  cat: '신스' },
    chip:       { name: '8비트 스퀘어',        gm: 80,  cat: '신스' },
    koto:       { name: '고토',                gm: 107, cat: '일본 전통' },
    shamisen:   { name: '샤미센',              gm: 106, cat: '일본 전통' },
    shakuhachi: { name: '샤쿠하치',            gm: 77,  cat: '일본 전통' },
  };
  const KITS = { std: '스탠더드 킷', '808': '808 킷', lofi: '로파이 킷' };
  /** <select> 안의 악기 목록(묶음별) */
  function instrumentOptions(esc = (x) => x) {
    const groups = {};
    for (const [k, v] of Object.entries(INSTRUMENTS)) (groups[v.cat] = groups[v.cat] || []).push(`<option value="${k}">${esc(v.name)}</option>`);
    return Object.entries(groups).map(([g, o]) => `<optgroup label="${esc(g)}">${o.join('')}</optgroup>`).join('');
  }
  // 드럼 줄: 위에서 아래 순서. gm 은 MIDI 10번 채널 음 번호
  const DRUMS = [
    { id: 'kick',  name: '킥',          gm: 36 },
    { id: 'snare', name: '스네어',      gm: 38 },
    { id: 'clap',  name: '클랩',        gm: 39 },
    { id: 'chh',   name: '닫힌 하이햇', gm: 42 },
    { id: 'ohh',   name: '열린 하이햇', gm: 46 },
    { id: 'tomh',  name: '하이 탐',     gm: 48 },
    { id: 'toml',  name: '로우 탐',     gm: 45 },
    { id: 'crash', name: '크래시',      gm: 49 },
    { id: 'ride',  name: '라이드',      gm: 51 },
    { id: 'tamb',  name: '탬버린',      gm: 54 },
    { id: 'shaker', name: '셰이커',     gm: 70 },
  ];
  const COLORS = ['#f2b155', '#5fb3f0', '#7bd389', '#ef6f8c', '#b08cf4', '#4fd1c5', '#f08a5d', '#d6d35a'];

  let uid = Date.now() % 100000;
  const newId = () => 't' + (uid++).toString(36);

  function makeTrack(type, opts = {}) {
    return Object.assign({
      id: newId(), type, name: type === 'drums' ? '드럼' : '피아노',
      inst: type === 'drums' ? 'std' : 'piano', role: '',
      vol: 0.8, pan: 0, rev: 0.2, mute: false, solo: false,
      color: COLORS[0], notes: [],
    }, opts);
  }

  function newSong() {
    const s = {
      v: 1, title: '새 곡', bpm: 110, key: 0, scale: 'major', bars: 8, swing: 0,
      master: 0.85, loop: { on: false, start: 0, end: T.BAR * 4 },
      chords: new Array(8).fill(null), tracks: [],
    };
    s.tracks.push(makeTrack('synth', { name: '피아노', inst: 'piano', color: COLORS[0] }));
    return s;
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /** 불러온 자료를 안전한 곡 형태로 맞춘다 */
  function normalize(raw) {
    const d = newSong();
    if (!raw || typeof raw !== 'object') return d;
    const s = {
      v: 1,
      title: typeof raw.title === 'string' ? raw.title.slice(0, 80) : d.title,
      bpm: clamp(Math.round(num(raw.bpm, 110)), 30, 300),
      key: T.mod12(Math.round(num(raw.key, 0))),
      scale: T.SCALES[raw.scale] ? raw.scale : 'major',
      bars: clamp(Math.round(num(raw.bars, 8)), 1, 256),
      swing: clamp(num(raw.swing, 0), 0, 0.75),
      master: clamp(num(raw.master, 0.85), 0, 1.2),
      loop: { on: !!(raw.loop && raw.loop.on), start: 0, end: T.BAR * 4 },
      chords: [], tracks: [],
    };
    if (raw.loop) {
      s.loop.start = Math.max(0, Math.round(num(raw.loop.start, 0)));
      s.loop.end = Math.max(s.loop.start + T.PPQ, Math.round(num(raw.loop.end, T.BAR * 4)));
    }
    for (let i = 0; i < s.bars; i++) {
      const c = Array.isArray(raw.chords) ? raw.chords[i] : null;
      s.chords.push(c && typeof c === 'object' && T.QUALITIES[c.q] !== undefined
        ? { root: T.mod12(Math.round(num(c.root, 0))), q: c.q } : null);
    }
    const tracks = Array.isArray(raw.tracks) ? raw.tracks : [];
    tracks.slice(0, 32).forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      const type = t.type === 'drums' ? 'drums' : 'synth';
      const tr = makeTrack(type, {
        id: typeof t.id === 'string' ? t.id : newId(),
        name: typeof t.name === 'string' ? t.name.slice(0, 40) : (type === 'drums' ? '드럼' : '트랙 ' + (i + 1)),
        inst: type === 'drums' ? (KITS[t.inst] ? t.inst : 'std') : (INSTRUMENTS[t.inst] ? t.inst : 'piano'),
        role: typeof t.role === 'string' ? t.role : '',
        vol: clamp(num(t.vol, 0.8), 0, 1.2), pan: clamp(num(t.pan, 0), -1, 1), rev: clamp(num(t.rev, 0.2), 0, 1),
        mute: !!t.mute, solo: !!t.solo,
        color: typeof t.color === 'string' && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : COLORS[i % COLORS.length],
      });
      const notes = Array.isArray(t.notes) ? t.notes : [];
      for (const n of notes) {
        if (!n) continue;
        const p = Math.round(num(n.p, -1));
        const ok = type === 'drums' ? p >= 0 && p < DRUMS.length : p >= 0 && p <= 127;
        if (!ok) continue;
        tr.notes.push({ t: Math.max(0, Math.round(num(n.t, 0))), d: Math.max(1, Math.round(num(n.d, T.PPQ / 4))), p, v: clamp(num(n.v, 0.8), 0.05, 1) });
      }
      tr.notes.sort((a, b) => a.t - b.t || a.p - b.p);
      s.tracks.push(tr);
    });
    if (!s.tracks.length) s.tracks = d.tracks;
    // 아이디가 겹치면 새로 준다
    const seen = new Set();
    for (const tr of s.tracks) { if (seen.has(tr.id)) tr.id = newId(); seen.add(tr.id); }
    return s;
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const songEnd = (s) => s.bars * T.BAR;

  function resizeChords(s) {
    while (s.chords.length < s.bars) s.chords.push(null);
    s.chords.length = s.bars;
  }

  /* 되돌리기: 바뀔 때마다 곡 전체를 문자열로 남긴다(곡이 작아서 충분히 가볍다) */
  class History {
    constructor(limit = 120) { this.limit = limit; this.past = []; this.future = []; this.cur = null; }
    reset(song) { this.past = []; this.future = []; this.cur = JSON.stringify(song); }
    push(song) {
      const s = JSON.stringify(song);
      if (s === this.cur) return false;
      if (this.cur != null) this.past.push(this.cur);
      if (this.past.length > this.limit) this.past.shift();
      this.cur = s; this.future = [];
      return true;
    }
    undo() {
      if (!this.past.length) return null;
      this.future.push(this.cur); this.cur = this.past.pop();
      return JSON.parse(this.cur);
    }
    redo() {
      if (!this.future.length) return null;
      this.past.push(this.cur); this.cur = this.future.pop();
      return JSON.parse(this.cur);
    }
    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }
  }

  /* 브라우저 저장소(localStorage). 막혀 있어도 앱은 돌아가게 감싼다. */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };
  const LIB = 'studio.library';
  const library = {
    list() {
      const lib = store.get(LIB, {});
      return Object.entries(lib).map(([id, e]) => ({ id, title: e.title, updated: e.updated, bars: e.song && e.song.bars }))
        .sort((a, b) => b.updated - a.updated);
    },
    load(id) { const e = store.get(LIB, {})[id]; return e ? normalize(e.song) : null; },
    save(id, song) {
      const lib = store.get(LIB, {});
      lib[id] = { title: song.title, updated: Date.now(), song };
      return store.set(LIB, lib);
    },
    remove(id) { const lib = store.get(LIB, {}); delete lib[id]; store.set(LIB, lib); },
  };

  S.song = { INSTRUMENTS, KITS, instrumentOptions, DRUMS, COLORS, makeTrack, newSong, normalize, clone, songEnd, resizeChords, History, store, library, newId };
})(globalThis.Studio = globalThis.Studio || {});
