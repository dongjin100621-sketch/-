'use strict';
/* 한자 서당 — 초급·중급·고급·심화 한자·한문 학습 (사파리 대응 단일 페이지 앱)
   화면은 주소의 # 뒤(#/level/beginner …)로 나뉘고, 기록은 이 브라우저(localStorage)에만 저장된다. */
(function () {
  /* ======================= 도우미 ======================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const isHangul = (s) => s >= '가' && s <= '힣';
  const syllables = (s) => Array.from(s).filter(isHangul);
  const hanOnly = (s) => Array.from(s).filter((c) => !/\s/.test(c));
  const GRADE = (g) => (g.slice(-1) === 'Ⅱ' ? g.slice(0, -1) + '급Ⅱ' : g + '급');

  // 선 아이콘 (Feather·Lucide, MIT/ISC)
  const ICONS = {
    back: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    vol: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    cards: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    quiz: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    scroll: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    note: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
    down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    redo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'
  };
  const ic = (n) => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>';

  // 두음 법칙 (낱말 첫머리의 ㄹ·ㄴ): 녀→여, 리→이, 로→노 …
  const IY = [2, 6, 7, 12, 17, 20]; // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
  function dueum(s) {
    const n = s.charCodeAt(0) - 0xac00;
    if (n < 0 || n > 11171) return s;
    let c = Math.floor(n / 588);
    const j = Math.floor((n % 588) / 28), t = n % 28;
    if (c === 5) c = IY.indexOf(j) >= 0 ? 11 : 2;
    else if (c === 2 && IY.indexOf(j) >= 0) c = 11;
    return String.fromCharCode(0xac00 + c * 588 + j * 28 + t);
  }

  /* ======================= 자료 ======================= */
  const parseReadings = (s) => s.split('/').map((r) => { r = r.trim(); const i = r.lastIndexOf(' '); return { hun: r.slice(0, i), eum: r.slice(i + 1) }; });
  const CHARS = {};
  const EXTRA = {};
  const LEVELS = LEVEL_INFO.map((l) => Object.assign({}, l, { chars: [], units: [], idiomUnits: [], phraseUnits: [] }));
  const LV = {};
  LEVELS.forEach((l) => { LV[l.id] = l; });

  (function parseChars() {
    let level = null, unit = null;
    CHAR_SRC.split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      if (line[0] === '@') { level = LV[line.slice(1).trim()]; unit = null; return; }
      if (line[0] === '#') { unit = { name: line.slice(1).trim(), chars: [] }; level.units.push(unit); return; }
      const f = line.split('|');
      const info = {
        c: f[0], g: f[1], level: level.id, readings: parseReadings(f[2]),
        words: (f[3] || '').split(',').filter((w) => w.trim()).map((w) => { const p = w.trim().split(' '); return { h: p[0], r: p[1] }; })
      };
      info.main = info.readings[0].hun + ' ' + info.readings[0].eum;
      info.hunum = info.readings.map((r) => r.hun + ' ' + r.eum).join(', ');
      const u = (typeof UNIHAN !== 'undefined' && UNIHAN[info.c]) || [0, 0];
      info.strokes = u[0];
      info.rad = (typeof RADICALS !== 'undefined' && RADICALS[u[1]]) || null;
      CHARS[info.c] = info;
      level.chars.push(info);
      if (unit) unit.chars.push(info);
    });
    LEVELS.forEach((l) => {
      if (l.sort) {
        // 가나다 차례로 늘어놓고 열 자씩 단원으로 나눈다
        const key = (c) => c.readings[0].eum;
        l.chars.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
        l.units = [];
        for (let i = 0; i < l.chars.length; i += 10) {
          const cs = l.chars.slice(i, i + 10);
          l.units.push({ name: key(cs[0]) + ' ~ ' + key(cs[cs.length - 1]), chars: cs });
        }
      }
      l.units.forEach((u, i) => { u.index = i; u.chars.forEach((c) => { c.unit = i; }); });
    });
  })();

  EXTRA_SRC.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const f = line.split('|');
    EXTRA[f[0]] = parseReadings(f[1]);
  });

  const IDIOMS = [];
  (function parseIdioms() {
    let level = null, unit = null;
    IDIOM_SRC.split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      if (line[0] === '@') { level = LV[line.slice(1).trim()]; return; }
      if (line[0] === '#') { unit = { name: line.slice(1).trim(), items: [], index: level.idiomUnits.length }; level.idiomUnits.push(unit); return; }
      const f = line.split('|');
      const gloss = {};
      (f[6] || '').split(';').forEach((g) => { if (g) { const p = g.split('='); gloss[p[0]] = p[1]; } });
      const it = { id: 'i' + (IDIOMS.length + 1), h: f[0], r: f[1], lit: f[2], mean: f[3], src: f[4] || '', story: f[5] || '', gloss, level: level.id, unit: unit.index };
      IDIOMS.push(it);
      unit.items.push(it);
    });
  })();

  const PHRASES = [];
  (function parsePhrases() {
    let level = LV.adv, unit = null;
    PHRASE_SRC.split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      if (line[0] === '@') { level = LV[line.slice(1).trim()]; return; }
      if (line[0] === '#') { unit = { name: line.slice(1).trim(), items: [], index: level.phraseUnits.length }; level.phraseUnits.push(unit); return; }
      const f = line.split('|');
      const gloss = {};
      (f[4] || '').split(';').forEach((g) => { if (g) { const p = g.split('='); gloss[p[0]] = p[1]; } });
      const p = { id: 'p' + (PHRASES.length + 1), h: f[0], r: f[1], mean: f[2], src: f[3] || '', gloss, level: level.id, unit: unit.index };
      PHRASES.push(p);
      unit.items.push(p);
    });
  })();
  const IDIOM_BY = {}; IDIOMS.forEach((i) => { IDIOM_BY[i.id] = i; });
  const PHRASE_BY = {}; PHRASES.forEach((p) => { PHRASE_BY[p.id] = p; });
  /* 사자성어 시험: 성어를 가장 어려운 글자의 급수로 나눈 다섯 단계 (js/tiers.js) */
  const TIER_INFO = [null,
    { n: 1, name: '초급', lv: 'beginner', hanja: '初', sub: '8·7급 한자로 된 성어' },
    { n: 2, name: '중급', lv: 'mid', hanja: '中', sub: '6·5급 한자까지 쓴 성어' },
    { n: 3, name: '고급', lv: 'adv', hanja: '高', sub: '4급 한자까지 쓴 성어' },
    { n: 4, name: '최상', lv: 'top', hanja: '上', sub: '3급~1급 한자까지 쓴 성어' },
    { n: 5, name: '극상', lv: 'ultra', hanja: '極', sub: '특급 한자까지 쓴 성어' }];
  const TIERS = TIER_INFO.map((t) => t && Object.assign({}, t, { items: [] }));
  const TIER_BY = {};
  (function parseTiers() {
    let t = null;
    (typeof TIER_SRC === 'undefined' ? '' : TIER_SRC).split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line || line[0] === '/' || line[0] === '*') return;
      if (line[0] === '@') { t = TIERS[+line.slice(1)]; return; }
      if (!t) return;
      const f = line.split('|');
      const it = { id: f[0], h: f[0], r: f[1], mean: f[2], tier: t.n };
      t.items.push(it);
      TIER_BY[it.id] = it;
    });
  })();
  const ALL_CHARS = LEVELS.reduce((a, l) => a.concat(l.chars), []);
  const ALL_WORDS = [];
  ALL_CHARS.forEach((c) => c.words.forEach((w) => { if (!ALL_WORDS.some((x) => x.h === w.h)) ALL_WORDS.push(w); }));

  const readingsOf = (c) => (CHARS[c] && CHARS[c].readings) || EXTRA[c] || [];
  const matches = (eum, syl, first) => eum === syl || (first && dueum(eum) === syl) || ((eum === '렬' || eum === '률') && syl === (eum === '렬' ? '열' : '율'));

  // 원문 글자마다 그 자리에서 읽히는 훈음을 붙인다 (樂山 → 좋아할 요, 不知 → 아닐 부)
  function glossFor(text, reading, over) {
    const words = text.split(/\s+/);
    const rs = syllables(reading);
    const out = [];
    let k = 0;
    words.forEach((w, wi) => {
      const group = [];
      Array.from(w).forEach((c, ci) => {
        const s = rs[k++];
        let g = over && over[c];
        if (!g) {
          const rd = readingsOf(c);
          let m = rd.filter((r) => matches(r.eum, s, ci === 0))[0];
          if (!m && c === '不' && s === '부') m = { hun: '아닐', eum: '부' };
          if (!m) m = rd[0];
          g = m ? m.hun + ' ' + (s && m.eum !== s && dueum(m.eum) === s ? s : m.eum) : '';
        }
        group.push({ c, g, s });
      });
      out.push(group);
      if (wi < words.length - 1) out.push(null);
    });
    return out;
  }

  /* ======================= 기록 ======================= */
  const KEY = 'hanja-seodang-v1';
  const SETTINGS0 = { theme: 'system', font: 'serif', sound: true, speak: false };
  const fresh = () => ({ v: 1, cards: {}, idioms: {}, phrases: {}, wrong: {}, days: {}, tiers: {}, settings: Object.assign({}, SETTINGS0), tipClosed: false });
  let S = fresh();
  function adopt(o) {
    const n = fresh();
    ['cards', 'idioms', 'phrases', 'tiers', 'wrong', 'days'].forEach((k) => { if (o[k] && typeof o[k] === 'object') n[k] = o[k]; });
    n.settings = Object.assign({}, SETTINGS0, o.settings || {});
    n.tipClosed = !!o.tipClosed;
    return n;
  }
  try { const raw = localStorage.getItem(KEY); if (raw) S = adopt(JSON.parse(raw)); } catch (e) { /* 사생활 보호 모드 등 */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 못 해도 계속 쓸 수 있게 */ } }

  const STORE = { c: 'cards', i: 'idioms', p: 'phrases', t: 'tiers' };
  const boxOf = (k, id) => S[STORE[k]][id] || 0;
  const known = (k, id) => boxOf(k, id) >= 2;
  const inWrong = (k, id) => !!S.wrong[k + ':' + id];
  function record(k, id, ok) {
    const st = S[STORE[k]];
    const b = st[id] || 0;
    st[id] = ok ? Math.min(5, Math.max(2, b + 1)) : 1;
    if (ok) delete S.wrong[k + ':' + id]; else S.wrong[k + ':' + id] = Date.now();
    const d = dayKey();
    S.days[d] = (S.days[d] || 0) + 1;
    save();
  }
  function streak() {
    const d = new Date();
    if (!S.days[dayKey(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (S.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const knownCount = (list, k) => list.filter((x) => known(k, k === 'c' ? x.c : x.id)).length;
  const wrongList = (k) => Object.keys(S.wrong).filter((w) => w.slice(0, 2) === k + ':').sort((a, b) => S.wrong[b] - S.wrong[a]).map((w) => w.slice(2));

  /* ======================= 소리 ======================= */
  const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  let koVoice = null;
  function pickVoice() {
    try {
      const vs = speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang));
      koVoice = vs.filter((v) => /yuna|유나/i.test(v.name))[0] || vs.filter((v) => v.localService)[0] || vs[0] || null;
    } catch (e) { koVoice = null; }
  }
  if (canSpeak) { pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* 무시 */ } }
  function speak(text) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      if (koVoice) u.voice = koVoice;
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* 무시 */ }
  }
  const stopSpeak = () => { if (canSpeak) try { speechSynthesis.cancel(); } catch (e) { /* 무시 */ } };
  const speakBtn = (text, label) => (canSpeak ? '<button class="icon-btn" data-speak="' + esc(text) + '" aria-label="' + esc(label || '읽어 주기') + '">' + ic('vol') + '</button>' : '');

  let AC = null;
  function beep(ok) {
    if (!S.settings.sound) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      AC = AC || new Ctx();
      if (AC.state === 'suspended') AC.resume();
      const t0 = AC.currentTime + 0.01;
      (ok ? [784, 1175] : [247, 208]).forEach((f, i) => {
        const o = AC.createOscillator(), g = AC.createGain();
        const t = t0 + i * 0.09;
        o.type = ok ? 'sine' : 'triangle';
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(ok ? 0.16 : 0.12, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); g.connect(AC.destination);
        o.start(t); o.stop(t + 0.3);
      });
    } catch (e) { /* 무시 */ }
  }

  /* ======================= 공통 조각 ======================= */
  const app = $('#app');
  let view = {};
  let toastTimer = 0;
  function toast(msg) {
    let t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  }
  const lvStyle = (l) => '--lv:var(--lv-' + l.id + ');--lv-soft:var(--lv-' + l.id + '-soft)';
  function topbar(title, back, end) {
    return '<header class="topbar"><div class="side">' +
      (back ? '<a class="icon-btn back" href="' + back + '" aria-label="뒤로">' + ic('back') + '<span>뒤로</span></a>' : '') +
      '</div><h1>' + esc(title) + '</h1><div class="side end">' + (end || '') + '</div></header>';
  }
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const unitTitle = (u) => (u.index + 1) + '단원 · ' + u.name;
  function grade(score, total) {
    const r = total ? score / total : 0;
    if (r >= 1) return ['秀', '수', '완벽해요! 훈장님도 감탄하시겠어요.'];
    if (r >= 0.8) return ['優', '우', '아주 잘했어요. 틀린 것만 한 번 더 보면 끝!'];
    if (r >= 0.6) return ['美', '미', '좋아요. 헷갈린 글자를 카드로 다시 익혀 봐요.'];
    if (r >= 0.4) return ['良', '양', '조금만 더! 카드 학습으로 먼저 눈에 익혀 봐요.'];
    return ['可', '가', '괜찮아요. 처음엔 누구나 어려워요. 천천히 다시 해 봐요.'];
  }
  const stamp = (g) => '<div class="stamp" aria-label="' + g[1] + '"><span class="han">' + g[0] + '</span><small>' + g[1] + '</small></div>';
  function glyphRow(text, reading, over, cls) {
    return '<div class="glyphs ' + (cls || '') + '" lang="ko">' + glossFor(text, reading, over).map((grp) => {
      if (!grp) return '';
      return '<span class="grp">' + grp.map((g) => '<button class="gl' + (CHARS[g.c] ? ' in' : '') + '" data-char="' + esc(g.c) + '"><span class="han">' + esc(g.c) + '</span><small>' + esc(g.g) + '</small></button>').join('') + '</span>';
    }).join('') + '</div>';
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function nextUnit(l) { const i = l.units.findIndex((u) => u.chars.some((c) => !known('c', c.c))); return i < 0 ? 0 : i; }

  /* ======================= 홈 ======================= */
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  function todayChar() {
    const d = new Date();
    const n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    return ALL_CHARS[(n * 37) % ALL_CHARS.length];
  }
  function viewHome() {
    const kn = knownCount(ALL_CHARS, 'c');
    const wrongN = Object.keys(S.wrong).length;
    const t = todayChar();
    const levels = LEVELS.map((l) => {
      const k = knownCount(l.chars, 'c');
      return '<a class="card level-card" href="#/level/' + l.id + '" style="' + lvStyle(l) + '">' +
        '<span class="lv-badge han">' + l.hanja + '</span>' +
        '<div class="lv-text"><div class="lv-name">' + l.name + '</div><div class="lv-sub">' + esc(l.sub) + '</div>' +
        '<div class="bar"><i style="width:' + pct(k, l.chars.length) + '%"></i></div>' +
        '<div class="lv-count">익힌 한자 ' + k + ' / ' + l.chars.length + '</div></div>' + ic('right') + '</a>';
    }).join('');
    const tip = isIOS && !standalone && !S.tipClosed
      ? '<div class="card tip">' + ic('share') + '<p>사파리 아래쪽의 공유 버튼을 누르고 <b>「홈 화면에 추가」</b>를 고르면 앱처럼 전체 화면으로 쓰고, 인터넷이 없어도 열려요.</p><button class="icon-btn" data-act="tip" aria-label="닫기">' + ic('x') + '</button></div>'
      : '';
    const html = '<div class="wrap fade-in">' +
      '<header class="hero"><div class="brand"><span class="seal-logo" aria-hidden="true">書</span><div><h1>한자 서당</h1><p>하루 열 자씩, 천천히 익히는 한자와 한문</p></div></div>' +
      '<a class="icon-btn" href="#/settings" aria-label="설정">' + ic('gear') + '</a></header>' +
      '<section class="stats"><div class="card stat"><b>' + streak() + '일</b><span>연속 공부</span></div>' +
      '<div class="card stat"><b>' + (S.days[dayKey()] || 0) + '</b><span>오늘 공부</span></div>' +
      '<div class="card stat"><b>' + kn + '</b><span>익힌 한자 / ' + ALL_CHARS.length + '</span></div></section>' + tip +
      '<button class="card today" data-char="' + t.c + '"><span class="han" lang="ko">' + t.c + '</span><span class="tb"><span class="lbl">오늘의 한자</span>' +
      '<span class="hunum">' + esc(t.readings[0].hun) + ' <b>' + esc(t.readings[0].eum) + '</b></span>' +
      '<span class="meta">' + GRADE(t.g) + ' · ' + LV[t.level].name + (t.strokes ? ' · 총 ' + t.strokes + '획' : '') + '</span>' +
      '<span class="words">' + t.words.map((w) => '<span class="han">' + w.h + '</span> ' + w.r).join(' · ') + '</span></span></button>' +
      '<h2 class="sec">단계 고르기</h2><div class="levels">' + levels + '</div>' +
      '<a class="card row-link" href="#/seongeo"><span class="ic-box">' + ic('msg') + '</span><span class="grow">사자성어 시험<small>초급부터 극상까지 · 글자 맞추기, 읽기, 뜻 맞추기</small></span>' + ic('right') + '</a>' +
      '<a class="card row-link" href="#/review"><span class="ic-box">' + ic('note') + '</span><span class="grow">오답 노트<small>틀렸거나 다시 보기로 한 한자·성어·명구</small></span><span class="count' + (wrongN ? '' : ' zero') + '">' + wrongN + '</span></a>' +
      '<a class="card row-link" href="#/list?l=all"><span class="ic-box">' + ic('search') + '</span><span class="grow">한자 찾기<small>' + ALL_CHARS.length + '자를 뜻·소리·한자로 찾아보기</small></span>' + ic('right') + '</a>' +
      '</div>';
    render(html, {
      act: { tip() { S.tipClosed = true; save(); const el = $('.tip'); if (el) el.remove(); } }
    });
  }

  /* ======================= 단계 ======================= */
  function viewLevel(id) {
    const l = LV[id];
    if (!l) return go('#/');
    const kc = knownCount(l.chars, 'c');
    const idioms = l.idiomUnits.reduce((a, u) => a.concat(u.items), []);
    const phrases = l.phraseUnits.reduce((a, u) => a.concat(u.items), []);
    const nu = nextUnit(l);
    const row = (name, k, n) => '<div class="row"><span>' + name + '</span><div class="bar"><i style="width:' + pct(k, n) + '%"></i></div><span>' + k + ' / ' + n + '</span></div>';
    const action = (href, icon, title, sub) => '<a class="card action" href="' + href + '"><span class="ic-box">' + ic(icon) + '</span><b>' + title + '</b><small>' + sub + '</small></a>';
    const units = l.units.map((u) => {
      const k = knownCount(u.chars, 'c');
      return '<li class="card unit' + (k === u.chars.length ? ' done' : '') + '">' +
        '<a class="unit-main" href="#/study?l=' + l.id + '&u=' + u.index + '">' +
        '<div class="unit-title"><span class="unit-no">' + (u.index + 1) + '</span>' + esc(u.name) + '</div>' +
        '<div class="unit-chars han" lang="ko">' + u.chars.map((c) => (known('c', c.c) ? '<span class="k">' + c.c + '</span>' : c.c)).join('') + '</div>' +
        '<div class="bar small"><i style="width:' + pct(k, u.chars.length) + '%"></i></div></a>' +
        '<div class="unit-btns"><a href="#/quiz?l=' + l.id + '&k=char&u=' + u.index + '&t=mix&n=10">퀴즈</a><a href="#/write?l=' + l.id + '&u=' + u.index + '">쓰기</a></div></li>';
    }).join('');
    const html = '<div class="wrap fade-in" style="' + lvStyle(l) + '">' + topbar(l.name, '#/') +
      '<section class="lv-head"><span class="lv-badge han">' + l.hanja + '</span><div><h2>' + l.name + ' 과정</h2><p>' + esc(l.desc) + '</p></div></section>' +
      '<section class="card lv-progress">' + row('한자', kc, l.chars.length) +
      (idioms.length ? row('사자성어', knownCount(idioms, 'i'), idioms.length) : '') +
      (phrases.length ? row('한문 명구', knownCount(phrases, 'p'), phrases.length) : '') + '</section>' +
      '<div class="actions">' +
      action('#/study?l=' + l.id + '&u=' + nu, 'cards', '카드 학습', '이어서 ' + (nu + 1) + '단원 · 뒤집으며 외우기') +
      action('#/quizset?l=' + l.id, 'quiz', '퀴즈', '훈음, 한자 찾기, 한자어 읽기, 빈칸 채우기') +
      action('#/write?l=' + l.id + '&u=' + nu, 'pen', '쓰기 연습', '손가락이나 펜으로 따라 쓰기') +
      action('#/list?l=' + l.id, 'grid', '한자 목록', l.chars.length + '자 한눈에 보기 · 찾기') +
      (idioms.length ? action('#/idioms?l=' + l.id, 'msg', '사자성어', idioms.length + '개 · 글자 풀이와 이야기') : '') +
      (phrases.length ? action('#/phrases?l=' + l.id, 'scroll', '한문 명구', phrases.length + '구 · 《논어》《맹자》《명심보감》') : '') +
      '</div><h2 class="sec">단원 (' + l.units.length + ')</h2><ol class="units">' + units + '</ol></div>';
    render(html);
  }

  /* ======================= 카드 학습 ======================= */
  function cardBack(c) {
    const rad = c.rad ? '<span class="tag">부수 <span class="han" style="margin:0 3px">' + c.rad[0] + '</span>' + esc(c.rad[1]) + '</span>' : '';
    return '<span class="han mid" lang="ko">' + c.c + '</span>' +
      '<div class="hunum">' + esc(c.readings[0].hun) + ' <b>' + esc(c.readings[0].eum) + '</b></div>' +
      (c.readings.length > 1 ? '<div class="alt">또는 ' + c.readings.slice(1).map((r) => esc(r.hun + ' ' + r.eum)).join(', ') + '</div>' : '') +
      '<div class="meta-line"><span class="tag">' + GRADE(c.g) + '</span>' + rad + (c.strokes ? '<span class="tag">총 ' + c.strokes + '획</span>' : '') + '</div>' +
      '<ul class="words">' + c.words.map((w) => '<li><span class="han" lang="ko">' + w.h + '</span><span>' + w.r + '</span>' + speakBtn(w.r) + '</li>').join('') + '</ul>' +
      (canSpeak ? '<button class="btn small soft" data-speak="' + esc(c.main) + '" style="margin-top:12px">' + ic('vol') + '훈음 듣기</button>' : '');
  }
  function viewStudy(q) {
    const review = q.get('k') === 'review';
    let items, title, back, l = null, unit = null;
    if (review) {
      items = wrongList('c').map((c) => CHARS[c]).filter(Boolean);
      title = '모르는 한자 복습'; back = '#/review';
    } else {
      l = LV[q.get('l')];
      if (!l) return go('#/');
      const ui = Math.max(0, Math.min(l.units.length - 1, +q.get('u') || 0));
      unit = l.units[ui];
      items = unit.chars.slice();
      title = unitTitle(unit); back = '#/level/' + l.id;
    }
    if (!items.length) {
      return render('<div class="wrap">' + topbar(title, back) + '<div class="empty"><span class="han">空</span>복습할 한자가 없어요.</div></div>');
    }
    const st = { i: 0, back: false, res: {}, items };

    function frame() {
      return '<div class="wrap fade-in"' + (l ? ' style="' + lvStyle(l) + '"' : '') + '>' + topbar(title, back, '<span id="pos"></span>') + '<div class="study" id="study"></div></div>';
    }
    function dots() {
      return '<div class="dots" aria-hidden="true">' + st.items.map((c, i) => '<i class="' + (i === st.i ? 'cur' : st.res[c.c] === true ? 'yes' : st.res[c.c] === false ? 'no' : '') + '"></i>').join('') + '</div>';
    }
    function drawCard() {
      const c = st.items[st.i];
      st.back = false;
      $('#pos').textContent = (st.i + 1) + ' / ' + st.items.length;
      $('#study').innerHTML = dots() +
        '<div class="flash" data-act="flip" role="button" tabindex="0" aria-label="카드 뒤집기">' +
        '<div class="face front"><span class="corner tag">' + GRADE(c.g) + '</span><span class="han huge" lang="ko">' + c.c + '</span><span class="hint">눌러서 뜻과 소리 보기</span></div>' +
        '<div class="face back">' + cardBack(c) + '</div></div>' +
        '<div class="study-btns" id="sbtns"></div><p class="kbd">스페이스: 뒤집기 · ←: 다시 볼래요 · →: 알아요</p>';
      drawBtns();
    }
    function drawBtns() {
      $('#sbtns').innerHTML = st.back
        ? '<button class="btn no" data-act="no">다시 볼래요</button><button class="btn yes" data-act="yes">' + ic('check') + '알아요</button>'
        : '<button class="btn primary only" data-act="flip">뜻 보기</button>';
    }
    function flip() {
      const el = $('.flash');
      if (!el || el.classList.contains('turn')) return;
      el.classList.add('turn');
      setTimeout(() => {
        st.back = !st.back;
        el.classList.toggle('is-back', st.back);
        el.classList.remove('turn');
        drawBtns();
        if (st.back && S.settings.speak) speak(st.items[st.i].main);
      }, 170);
    }
    function answer(ok) {
      if (!st.back) return flip();
      const c = st.items[st.i];
      st.res[c.c] = ok;
      record('c', c.c, ok);
      st.i++;
      if (st.i >= st.items.length) summary(); else drawCard();
    }
    function summary() {
      const yes = st.items.filter((c) => st.res[c.c]).length;
      const miss = st.items.filter((c) => !st.res[c.c]);
      const g = grade(yes, st.items.length);
      $('#pos').textContent = '';
      let next = '';
      if (unit && unit.index < l.units.length - 1) next = '<a class="btn" href="#/study?l=' + l.id + '&u=' + (unit.index + 1) + '">다음 단원</a>';
      $('#study').innerHTML = '<section class="card result fade-in">' + stamp(g) +
        '<h2>' + (review ? '복습을 마쳤어요' : esc(title) + ' 끝!') + '</h2>' +
        '<p>알아요 <b>' + yes + '</b> · 다시 볼 한자 <b>' + miss.length + '</b></p>' +
        (miss.length ? '<div class="miss">' + miss.map((c) => '<button class="han" data-char="' + c.c + '">' + c.c + '<small>' + esc(c.main) + '</small></button>').join('') + '</div>' : '<p>' + g[2] + '</p>') +
        '<div class="btns" style="width:100%">' +
        (miss.length ? '<button class="btn seal" data-act="again">모르는 것 다시</button>' : '') +
        (unit ? '<a class="btn primary" href="#/quiz?l=' + l.id + '&k=char&u=' + unit.index + '&t=mix&n=10">이 단원 퀴즈</a>' : '<a class="btn primary" href="#/quiz?k=review">오답 퀴즈</a>') +
        next + '</div></section>';
    }
    render(frame(), {
      act: {
        flip,
        yes: () => answer(true),
        no: () => answer(false),
        again() { st.items = st.items.filter((c) => !st.res[c.c]); st.res = {}; st.i = 0; drawCard(); }
      },
      key(e) {
        if (!$('.flash')) return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
        else if (e.key === 'ArrowRight') answer(true);
        else if (e.key === 'ArrowLeft') answer(false);
      }
    });
    drawCard();
  }

  /* ======================= 퀴즈 만들기 ======================= */
  const QTYPES = {
    char: [['mix', '섞어서', '아래 네 가지를 골고루'], ['hun', '훈음 맞히기', '한자를 보고 뜻과 소리 고르기'], ['char', '한자 찾기', '훈음을 보고 한자 고르기'], ['word', '한자어 읽기', '낱말을 바르게 읽기'], ['fill', '빈칸 채우기', '한자어의 빈칸에 알맞은 한자']],
    idiom: [['mix', '섞어서', '세 가지를 골고루'], ['imean', '뜻 맞히기', '성어의 속뜻 고르기'], ['iread', '바르게 읽기', '성어의 독음 고르기'], ['ifill', '빈칸 채우기', '성어의 빠진 글자 고르기']],
    phrase: [['mix', '섞어서', '두 가지를 골고루'], ['pmean', '풀이 맞히기', '명구의 뜻 고르기'], ['pfill', '빈칸 채우기', '명구의 빠진 글자 고르기']]
  };
  function viewQuizSet(q) {
    const l = LV[q.get('l')];
    if (!l) return go('#/');
    const kinds = [['char', '한자']];
    if (l.idiomUnits.length) kinds.push(['idiom', '사자성어']);
    if (l.phraseUnits.length) kinds.push(['phrase', '한문 명구']);
    const st = { k: q.get('k') || 'char', u: 'all', t: 'mix', n: 10 };
    function units() {
      if (st.k === 'char') return l.units.map((u) => [u.index, unitTitle(u)]);
      const us = st.k === 'idiom' ? l.idiomUnits : l.phraseUnits;
      return us.map((u) => [u.index, u.name]);
    }
    function draw() {
      const types = QTYPES[st.k];
      const chip = (act, v, label, on) => '<button class="chip" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + on + '">' + label + '</button>';
      $('#qs').innerHTML =
        (kinds.length > 1 ? '<div><h3>무엇을 풀까요</h3><div class="chips">' + kinds.map((k) => chip('kind', k[0], k[1], st.k === k[0])).join('') + '</div></div>' : '') +
        '<div><h3>범위</h3><select id="qsUnit" aria-label="범위"><option value="all">전체</option>' + units().map((u) => '<option value="' + u[0] + '"' + (String(st.u) === String(u[0]) ? ' selected' : '') + '>' + esc(u[1]) + '</option>').join('') + '</select></div>' +
        '<div><h3>문제 유형</h3><div class="chips">' + types.map((t) => chip('type', t[0], t[1], st.t === t[0])).join('') + '</div>' +
        '<p class="muted" style="margin:8px 2px 0;font-size:14px">' + esc(types.filter((t) => t[0] === st.t)[0][2]) + '</p></div>' +
        '<div><h3>문제 수</h3><div class="chips">' + [10, 20, 30].map((n) => chip('num', n, n + '문제', st.n === n)).join('') + '</div></div>' +
        '<button class="btn primary wide" data-act="start">시작하기</button>';
      $('#qsUnit').onchange = (e) => { st.u = e.target.value; };
    }
    render('<div class="wrap fade-in" style="' + lvStyle(l) + '">' + topbar(l.name + ' 퀴즈', '#/level/' + l.id) + '<section class="card form" id="qs"></section></div>', {
      act: {
        kind(el) { st.k = el.dataset.v; st.u = 'all'; st.t = 'mix'; draw(); },
        type(el) { st.t = el.dataset.v; draw(); },
        num(el) { st.n = +el.dataset.v; draw(); },
        start() { go('#/quiz?l=' + l.id + '&k=' + st.k + '&u=' + st.u + '&t=' + st.t + '&n=' + st.n); }
      }
    });
    draw();
  }

  /* ======================= 문제 만들기 ======================= */
  function repeatTo(pool, n) {
    let out = [];
    while (out.length < n && pool.length) out = out.concat(shuffle(pool));
    return out.slice(0, n);
  }
  const optText = (html, ok, long) => ({ html, ok, long });
  const BLANK = '<span class="blank" aria-label="빈칸"><i>?</i></span>';
  function exChar(c, w) {
    return '<div class="ex"><span class="han" lang="ko">' + c.c + '</span><div><b>' + esc(c.hunum) + '</b><small>' + GRADE(c.g) +
      (w ? ' · <span class="han">' + w.h + '</span> ' + w.r : '') + ' · ' + c.words.filter((x) => !w || x.h !== w.h).map((x) => '<span class="han">' + x.h + '</span> ' + x.r).join(' · ') + '</small></div></div>';
  }
  function exIdiom(it) {
    return '<div class="ex"><div><div class="han" style="font-size:32px" lang="ko">' + it.h + '</div><b>' + it.r + '</b><small>' + esc(it.mean) + ' — ' + esc(it.lit) + '</small></div></div>';
  }
  function exPhrase(p) {
    return '<div class="ex"><div><div class="han" style="font-size:24px;line-height:1.5" lang="ko">' + esc(p.h) + '</div><b>' + esc(p.r) + '</b><small>' + esc(p.mean) + ' ' + esc(p.src) + '</small></div></div>';
  }

  // 독음 오답 만들기: 다른 음으로 읽기(樂園→악원), 두음 법칙을 잊은 읽기(女子→녀자), 같은 글자를 쓰는 다른 낱말의 읽기
  function readingDistractors(h, r, n, pool) {
    const hs = hanOnly(h), rs = syllables(r);
    const out = [];
    const add = (s) => { if (s && s !== r && out.indexOf(s) < 0) out.push(s); };
    const spaced = (arr) => { // 원래 띄어쓰기 자리를 살린다
      let k = 0;
      return r.replace(/[가-힣]/g, () => arr[k++]);
    };
    hs.forEach((c, i) => {
      readingsOf(c).forEach((rd) => {
        if (!matches(rd.eum, rs[i], i === 0)) { const a = rs.slice(); a[i] = i === 0 ? dueum(rd.eum) : rd.eum; add(spaced(a)); }
        if (i === 0 && dueum(rd.eum) === rs[0] && rd.eum !== rs[0]) { const a = rs.slice(); a[0] = rd.eum; add(spaced(a)); }
      });
    });
    const len = rs.length;
    const same = shuffle(pool.filter((x) => syllables(x.r).length === len && x.r !== r));
    same.filter((x) => syllables(x.r).some((s, i) => s === rs[i])).slice(0, 2).forEach((x) => add(x.r));
    same.forEach((x) => { if (out.length < n + 2) add(x.r); });
    // 그래도 모자라면 한 음절을 다른 한자의 음으로 바꿔 채운다
    for (let tries = 0; out.length < n && tries < 60; tries++) {
      const a = rs.slice();
      const i = Math.floor(Math.random() * a.length);
      a[i] = pick(ALL_CHARS).readings[0].eum;
      add(spaced(a));
    }
    return sample(out.slice(0, Math.max(n + 2, 4)), n);
  }
  function charOptions(answer, pool, n, avoidEum) {
    const cand = shuffle(pool.filter((x) => x !== answer && x.c !== answer.c && (!avoidEum || !x.readings.some((r) => avoidEum(r.eum)))));
    const out = [];
    cand.forEach((x) => { if (out.length < n && !out.some((o) => o.c === x.c)) out.push(x); });
    return out;
  }
  function makeCharQ(c, type, pool) {
    const r0 = c.readings[0];
    if (!c.words.length && (type === 'word' || type === 'fill')) type = Math.random() < 0.5 ? 'hun' : 'char';
    if (type === 'hun') {
      const ds = charOptions(c, pool, 3, (e) => e === r0.eum);
      return {
        kind: 'c', id: c.c, ask: '이 한자의 훈(뜻)과 음(소리)은?',
        prompt: '<div class="han q-big" lang="ko">' + c.c + '</div>',
        options: shuffle([c].concat(ds)).map((o) => optText('<span>' + esc(o.readings[0].hun) + ' <b>' + esc(o.readings[0].eum) + '</b></span>', o === c)),
        explain: exChar(c), say: c.main
      };
    }
    if (type === 'char') {
      // 소리가 같은 한자(校·敎)를 하나쯤 섞어 뜻까지 보게 한다
      const twin = shuffle(pool.filter((x) => x !== c && x.readings[0].eum === r0.eum && x.readings[0].hun !== r0.hun)).slice(0, 1);
      const ds = twin.concat(charOptions(c, pool.filter((x) => twin.indexOf(x) < 0), 3 - twin.length, (e) => e === r0.eum));
      return {
        kind: 'c', id: c.c, ask: '이 훈음에 맞는 한자는?', grid: true,
        prompt: '<div class="hunum" style="font-size:34px">' + esc(r0.hun) + ' <b>' + esc(r0.eum) + '</b></div>',
        options: shuffle([c].concat(ds)).map((o) => optText('<span class="han" lang="ko">' + o.c + '</span>', o === c)),
        explain: exChar(c), say: c.main
      };
    }
    const w = pick(c.words);
    if (type === 'word') {
      const ds = readingDistractors(w.h, w.r, 3, ALL_WORDS);
      return {
        kind: 'c', id: c.c, ask: '이 한자어를 바르게 읽은 것은?',
        prompt: '<div class="han q-word" lang="ko">' + w.h + '</div>',
        options: shuffle([w.r].concat(ds)).map((s) => optText('<span>' + s + '</span>', s === w.r)),
        explain: exChar(c, w), say: w.r
      };
    }
    // fill: 낱말 속 그 한자를 비우고 소리를 힌트로 준다
    const hs = Array.from(w.h), rs = syllables(w.r);
    const at = hs.indexOf(c.c);
    const syl = rs[at];
    const ds = charOptions(c, pool, 3, (e) => matches(e, syl, at === 0));
    return {
      kind: 'c', id: c.c, ask: '빈칸에 알맞은 한자는?', grid: true,
      prompt: '<div class="han q-word" lang="ko">' + hs.map((x, i) => (i === at ? BLANK : x)).join('') + '</div>' +
        '<div class="q-sub">' + rs.map((s, i) => (i === at ? '<span class="syl-blank">' + s + '</span>' : s)).join('') + '</div>',
      options: shuffle([c].concat(ds)).map((o) => optText('<span class="han" lang="ko">' + o.c + '</span>', o === c)),
      explain: exChar(c, w), say: w.r
    };
  }
  function blankChoices(answerChar, syl, first, n) {
    // 소리가 다른 글자만 오답으로 (소리 힌트로 답이 하나로 정해지게)
    const pool = ALL_CHARS.concat(Object.keys(EXTRA).map((c) => ({ c, readings: EXTRA[c] })));
    return charOptions({ c: answerChar }, pool, n, (e) => matches(e, syl, first));
  }
  function makeIdiomQ(it, type) {
    const others = IDIOMS.filter((x) => x !== it);
    if (type === 'imean') {
      const ds = sample(others.filter((x) => x.mean !== it.mean), 3);
      return {
        kind: 'i', id: it.id, ask: '이 성어의 뜻은?',
        prompt: '<div class="han q-idiom" lang="ko">' + it.h + '</div><div class="q-sub">' + it.r + '</div>',
        options: shuffle([it].concat(ds)).map((o) => optText(esc(o.mean), o === it, true)),
        explain: exIdiom(it), say: it.r
      };
    }
    if (type === 'iread') {
      const ds = readingDistractors(it.h, it.r, 3, IDIOMS);
      return {
        kind: 'i', id: it.id, ask: '이 성어를 바르게 읽은 것은?',
        prompt: '<div class="han q-idiom" lang="ko">' + it.h + '</div><div class="q-hint">' + esc(it.mean) + '</div>',
        options: shuffle([it.r].concat(ds)).map((s) => optText('<span>' + s + '</span>', s === it.r)),
        explain: exIdiom(it), say: it.r
      };
    }
    const hs = Array.from(it.h), rs = syllables(it.r);
    const spots = hs.map((c, i) => i).filter((i) => CHARS[hs[i]]);
    const at = spots.length ? pick(spots) : Math.floor(Math.random() * 4);
    const ds = blankChoices(hs[at], rs[at], at === 0, 3);
    const opts = shuffle([{ c: hs[at] }].concat(ds));
    return {
      kind: 'i', id: it.id, ask: '빈칸에 알맞은 한자는?', grid: true,
      prompt: '<div class="han q-idiom" lang="ko">' + hs.map((x, i) => (i === at ? BLANK : x)).join('') + '</div>' +
        '<div class="q-sub">' + rs.map((s, i) => (i === at ? '<span class="syl-blank">' + s + '</span>' : s)).join('') + '</div><div class="q-hint">' + esc(it.mean) + '</div>',
      options: opts.map((o) => optText('<span class="han" lang="ko">' + o.c + '</span>', o.c === hs[at])),
      explain: exIdiom(it), say: it.r
    };
  }
  function makePhraseQ(p, type) {
    if (type === 'pmean') {
      const ds = sample(PHRASES.filter((x) => x !== p), 3);
      return {
        kind: 'p', id: p.id, ask: '이 구절의 풀이로 알맞은 것은?',
        prompt: '<div class="han q-phrase" lang="ko">' + esc(p.h) + '</div><div class="q-sub">' + esc(p.r) + '</div>',
        options: shuffle([p].concat(ds)).map((o) => optText(esc(o.mean), o === p, true)),
        explain: exPhrase(p), say: p.r
      };
    }
    const hs = hanOnly(p.h), rs = syllables(p.r);
    let spots = hs.map((c, i) => i).filter((i) => CHARS[hs[i]]);
    if (!spots.length) spots = hs.map((c, i) => i);
    const at = pick(spots);
    const ds = blankChoices(hs[at], rs[at], false, 3);
    let k = 0, kr = 0;
    const shown = p.h.replace(/\S/g, (x) => (k++ === at ? BLANK : esc(x)));
    const read = p.r.replace(/[가-힣]/g, (s) => (kr++ === at ? '<span class="syl-blank">' + s + '</span>' : s));
    return {
      kind: 'p', id: p.id, ask: '빈칸에 알맞은 한자는?', grid: true,
      prompt: '<div class="han q-phrase" lang="ko">' + shown + '</div><div class="q-sub">' + read + '</div><div class="q-hint">' + esc(p.mean) + '</div>',
      options: shuffle([{ c: hs[at] }].concat(ds)).map((o) => optText('<span class="han" lang="ko">' + o.c + '</span>', o.c === hs[at])),
      explain: exPhrase(p), say: p.r
    };
  }
  function makeQ(item, kind, t, pool) {
    if (kind === 'c') return makeCharQ(item, t === 'mix' ? pick(['hun', 'char', 'word', 'fill']) : t, pool);
    if (kind === 'i') return makeIdiomQ(item, t === 'mix' ? pick(['imean', 'iread', 'ifill']) : t);
    return makePhraseQ(item, t === 'mix' ? pick(['pmean', 'pfill']) : t);
  }
  function buildQuiz(q) {
    const k = q.get('k') || 'char';
    const n = Math.max(1, Math.min(50, +q.get('n') || 10));
    const t = q.get('t') || 'mix';
    const u = q.get('u') || 'all';
    if (k === 'review') {
      const items = Object.keys(S.wrong).map((w) => [w.slice(0, 1), w.slice(2)]);
      return shuffle(items).slice(0, 30).map((x) => {
        if (x[0] === 'c' && CHARS[x[1]]) return makeQ(CHARS[x[1]], 'c', 'mix', LV[CHARS[x[1]].level].chars);
        if (x[0] === 'i' && IDIOM_BY[x[1]]) return makeQ(IDIOM_BY[x[1]], 'i', 'mix');
        if (x[0] === 'p' && PHRASE_BY[x[1]]) return makeQ(PHRASE_BY[x[1]], 'p', 'mix');
        if (x[0] === 't' && TIER_BY[x[1]]) return makeTierQ(TIER_BY[x[1]], pick(['read', 'mean']));
        return null;
      }).filter(Boolean);
    }
    const l = LV[q.get('l')];
    if (!l) return [];
    if (k === 'idiom') {
      const items = u === 'all' ? l.idiomUnits.reduce((a, x) => a.concat(x.items), []) : (l.idiomUnits[+u] || { items: [] }).items;
      return repeatTo(items, n).map((it) => makeQ(it, 'i', t));
    }
    if (k === 'phrase') {
      const items = u === 'all' ? l.phraseUnits.reduce((a, x) => a.concat(x.items), []) : (l.phraseUnits[+u] || { items: [] }).items;
      return repeatTo(items, n).map((p) => makeQ(p, 'p', t));
    }
    const pool = u === 'all' ? l.chars : (l.units[+u] || { chars: [] }).chars;
    return repeatTo(pool, n).map((c) => makeQ(c, 'c', t, l.chars));
  }

  /* ======================= 퀴즈 ======================= */
  function viewQuiz(q) {
    const k = q.get('k') || 'char';
    const l = LV[q.get('l')];
    const u = q.get('u') || 'all';
    let back = '#/';
    if (k === 'review') back = '#/review';
    else if (l && k === 'idiom') back = '#/idioms?l=' + l.id + (u !== 'all' ? '&u=' + u : '');
    else if (l && k === 'phrase') back = '#/phrases?l=' + l.id + (u !== 'all' ? '&u=' + u : '');
    else if (l) back = '#/level/' + l.id;
    const title = k === 'review' ? '오답 퀴즈' : k === 'idiom' ? '사자성어 퀴즈' : k === 'phrase' ? '한문 명구 퀴즈' : (l ? l.name : '') + ' 한자 퀴즈';
    const st = { qs: buildQuiz(q), i: 0, score: 0, wrong: [], answered: false, timer: 0 };
    if (!st.qs.length) {
      return render('<div class="wrap">' + topbar(title, back) + '<div class="empty"><span class="han">空</span>' + (k === 'review' ? '오답 노트가 비어 있어요. 잘하고 있어요!' : '문제를 만들 수 없어요.') + '</div></div>');
    }
    function drawQ() {
      const qq = st.qs[st.i];
      st.answered = false;
      $('#pos').textContent = (st.i + 1) + ' / ' + st.qs.length;
      $('#quiz').innerHTML = '<div class="bar qbar"><i style="width:' + pct(st.i, st.qs.length) + '%"></i></div>' +
        '<section class="card question fade-in"><div class="q-ask">' + esc(qq.ask) + '</div>' + qq.prompt + '</section>' +
        '<div class="options' + (qq.grid ? ' grid2' : '') + '">' + qq.options.map((o, i) => '<button class="opt' + (o.long ? ' long' : '') + '" data-act="ans" data-i="' + i + '"><span class="no">' + (i + 1) + '</span>' + o.html + '</button>').join('') + '</div>' +
        '<div id="fb"></div>';
    }
    function answer(i) {
      if (st.answered) return;
      st.answered = true;
      const qq = st.qs[st.i];
      const ok = qq.options[i].ok;
      record(qq.kind, qq.id, ok);
      beep(ok);
      if (ok) st.score++; else st.wrong.push(qq);
      $$('.opt').forEach((b, j) => {
        b.disabled = true;
        if (qq.options[j].ok) b.classList.add('right');
        else if (j === i) b.classList.add('wrong');
        else b.classList.add('dim');
      });
      const last = st.i === st.qs.length - 1;
      $('#fb').innerHTML = '<section class="card feedback">' +
        '<div class="verdict ' + (ok ? 'ok">' + ic('check') + '맞았어요!' : 'ng">' + ic('x') + '아쉬워요. 정답을 확인해요') + (qq.say ? speakBtn(qq.say) : '') + '</div>' +
        qq.explain + '<button class="btn primary wide" data-act="next">' + (last ? '결과 보기' : '다음 문제') + '</button></section>';
      if (ok) st.timer = setTimeout(next, 1300);
      else { const f = $('#fb'); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
    function next() {
      clearTimeout(st.timer);
      if (!st.answered) return;
      st.i++;
      if (st.i >= st.qs.length) result(); else { drawQ(); window.scrollTo(0, 0); }
    }
    function result() {
      const g = grade(st.score, st.qs.length);
      $('#pos').textContent = '';
      const seen = {};
      const miss = st.wrong.filter((x) => (seen[x.kind + x.id] ? false : (seen[x.kind + x.id] = true)));
      const missBtn = (x) => {
        if (x.kind === 'c') return '<button class="han" data-char="' + x.id + '">' + x.id + '<small>' + esc(CHARS[x.id].main) + '</small></button>';
        if (x.kind === 't') return '<button class="han" data-speak="' + esc(TIER_BY[x.id].r) + '">' + x.id + '<small>' + esc(TIER_BY[x.id].r) + '</small></button>';
        if (x.kind === 'i') return '<button class="han" data-idiom="' + x.id + '">' + IDIOM_BY[x.id].h + '<small>' + IDIOM_BY[x.id].r + '</small></button>';
        return '<button class="han" data-phrase="' + x.id + '" style="font-size:17px">' + esc(PHRASE_BY[x.id].h) + '</button>';
      };
      $('#quiz').innerHTML = '<section class="card result fade-in">' + stamp(g) +
        '<div class="score">' + st.score + ' / ' + st.qs.length + '</div><p>' + g[2] + '</p>' +
        (miss.length ? '<h2 style="font-size:16px;margin-top:8px">틀린 문제 (오답 노트에 모았어요)</h2><div class="miss">' + miss.map(missBtn).join('') + '</div>' : '') +
        '<div class="btns" style="width:100%">' + (miss.length ? '<button class="btn seal" data-act="retry">틀린 문제만 다시</button>' : '') +
        '<button class="btn primary" data-act="again">새 문제로 다시</button><a class="btn" href="' + back + '">돌아가기</a></div></section>';
    }
    render('<div class="wrap fade-in"' + (l ? ' style="' + lvStyle(l) + '"' : '') + '>' + topbar(title, back, '<span id="pos"></span>') + '<div id="quiz"></div></div>', {
      act: {
        ans(el) { answer(+el.dataset.i); },
        next,
        again() { route(); },
        retry() {
          st.qs = shuffle(st.wrong).map((x) => {
            const t = 'mix';
            if (x.kind === 'c') return makeQ(CHARS[x.id], 'c', t, LV[CHARS[x.id].level].chars);
            if (x.kind === 't') return makeTierQ(TIER_BY[x.id], pick(['read', 'mean']));
            if (x.kind === 'i') return makeQ(IDIOM_BY[x.id], 'i', t);
            return makeQ(PHRASE_BY[x.id], 'p', t);
          });
          st.i = 0; st.score = 0; st.wrong = [];
          drawQ();
        }
      },
      key(e) {
        if (!st.answered && /^[1-4]$/.test(e.key) && $('.opt')) answer(+e.key - 1);
        else if (st.answered && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); next(); }
      },
      destroy() { clearTimeout(st.timer); }
    });
    drawQ();
  }

  /* ======================= 쓰기 ======================= */
  function viewWrite(q) {
    let list, back, title, l = null;
    const one = q.get('c');
    if (one) {
      const info = CHARS[one] || (EXTRA[one] && { c: one, readings: EXTRA[one], main: EXTRA[one][0].hun + ' ' + EXTRA[one][0].eum, strokes: (UNIHAN[one] || [0])[0] });
      if (!info) return go('#/');
      list = [info]; back = CHARS[one] ? '#/level/' + CHARS[one].level : '#/'; title = '쓰기 연습';
      if (CHARS[one]) l = LV[CHARS[one].level];
    } else {
      l = LV[q.get('l')];
      if (!l) return go('#/');
      const u = l.units[Math.max(0, Math.min(l.units.length - 1, +q.get('u') || 0))];
      list = u.chars; back = '#/level/' + l.id; title = (u.index + 1) + '단원 쓰기';
    }
    const st = { i: Math.max(0, Math.min(list.length - 1, +q.get('i') || 0)), guide: true, done: {} };
    const html = '<div class="wrap fade-in"' + (l ? ' style="' + lvStyle(l) + '"' : '') + '>' + topbar(title, back, '<span id="pos"></span>') +
      '<div class="write"><div class="write-info">' + (list.length > 1 ? '<button class="icon-btn" data-act="prev" aria-label="앞 글자">' + ic('back') + '</button>' : '') +
      '<div class="grow-info" id="winfo"></div>' + (list.length > 1 ? '<button class="icon-btn" data-act="next" aria-label="다음 글자">' + ic('right') + '</button>' : '') + '</div>' +
      '<div class="pad-wrap"><canvas id="pad" aria-label="쓰기 연습판. 손가락이나 펜으로 따라 쓰세요."></canvas></div>' +
      '<div class="write-status" id="wstat" aria-live="polite"></div>' +
      '<div class="tools">' +
      '<button class="btn" data-act="guide" id="gbtn" aria-pressed="true">' + ic('eye') + '본보기</button>' +
      '<button class="btn" data-act="undo">' + ic('undo') + '되돌리기</button>' +
      '<button class="btn" data-act="clear">' + ic('trash') + '지우기</button></div>' +
      (list.length > 1 ? '<div class="strip" id="strip">' + list.map((c, i) => '<button class="han" data-act="jump" data-i="' + i + '" lang="ko">' + c.c + '</button>').join('') + '</div>' : '') +
      '</div></div>';
    let pad = null;
    function status(n) {
      const c = list[st.i];
      const el = $('#wstat');
      if (!el) return;
      const total = c.strokes || 0;
      el.classList.toggle('done', !!total && n === total);
      if (!n) el.textContent = total ? '총 ' + total + '획이에요. 본보기를 따라 써 보세요.' : '본보기를 따라 써 보세요.';
      else if (!total) el.textContent = '그은 획 ' + n;
      else if (n === total) {
        el.textContent = '그은 획 ' + n + ' / 총 ' + total + '획 — 획 수를 딱 맞췄어요!';
        if (!st.done[c.c]) { st.done[c.c] = true; const d = dayKey(); S.days[d] = (S.days[d] || 0) + 1; save(); }
      } else if (n < total) el.textContent = '그은 획 ' + n + ' / 총 ' + total + '획';
      else el.textContent = '그은 획 ' + n + ' / 총 ' + total + '획 — 획이 ' + (n - total) + '개 많아요';
    }
    function show() {
      const c = list[st.i];
      $('#pos').textContent = list.length > 1 ? (st.i + 1) + ' / ' + list.length : '';
      $('#winfo').innerHTML = '<span class="han" lang="ko">' + c.c + '</span><div class="grow"><div class="hunum">' + esc(c.readings[0].hun) + ' <b>' + esc(c.readings[0].eum) + '</b></div>' +
        '<div class="muted">' + (c.g ? GRADE(c.g) + ' · ' : '') + (c.strokes ? '총 ' + c.strokes + '획' : '') + '</div></div>' + speakBtn(c.main);
      $$('#strip button').forEach((b, i) => b.classList.toggle('cur', i === st.i));
      const cur = $('#strip .cur');
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
      pad.setChar(c.c);
    }
    render(html, {
      act: {
        prev() { st.i = (st.i - 1 + list.length) % list.length; show(); },
        next() { st.i = (st.i + 1) % list.length; show(); },
        jump(el) { st.i = +el.dataset.i; show(); },
        undo() { pad.undo(); },
        clear() { pad.clear(); },
        guide() {
          st.guide = !st.guide; pad.setGuide(st.guide);
          $('#gbtn').innerHTML = (st.guide ? ic('eye') : ic('eyeoff')) + '본보기';
          $('#gbtn').setAttribute('aria-pressed', st.guide);
        }
      },
      key(e) {
        if (e.key === 'ArrowRight') { st.i = (st.i + 1) % list.length; show(); }
        else if (e.key === 'ArrowLeft') { st.i = (st.i - 1 + list.length) % list.length; show(); }
        else if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); pad.undo(); }
      },
      destroy() { if (pad) pad.destroy(); }
    });
    pad = new WritePad($('#pad'), status);
    show();
    if (document.fonts && document.fonts.load) {
      document.fonts.load('500 100px "Noto Serif KR"', list.map((c) => c.c).join('')).then(() => pad && pad.draw()).catch(() => {});
    }
  }

  /* ======================= 목록 ======================= */
  function viewList(q) {
    const sel = LV[q.get('l')] ? q.get('l') : 'all';
    const lvls = sel === 'all' ? LEVELS : [LV[sel]];
    const back = sel === 'all' ? '#/' : '#/level/' + sel;
    const tile = (c) => {
      const b = boxOf('c', c.c);
      return '<button class="tile' + (b >= 2 ? ' known' : b === 1 ? ' seen' : '') + '" data-char="' + c.c + '"><span class="han" lang="ko">' + c.c + '</span><small>' + esc(c.main) + '</small></button>';
    };
    function body(text) {
      text = (text || '').trim();
      if (!text) {
        return lvls.map((l) => (sel === 'all' ? '<h2 class="sec">' + l.name + ' · ' + esc(l.sub) + '</h2>' : '') +
          l.units.map((u) => '<h3 class="group-h">' + esc(unitTitle(u)) + '<span>' + knownCount(u.chars, 'c') + ' / ' + u.chars.length + '</span></h3><div class="grid">' + u.chars.map(tile).join('') + '</div>').join('')).join('');
      }
      const all = lvls.reduce((a, l) => a.concat(l.chars), []);
      const main = all.filter((c) => c.c === text || text.indexOf(c.c) >= 0 ||
        c.readings.some((r) => r.eum === text || dueum(r.eum) === text || r.hun.indexOf(text) >= 0 || (r.hun + ' ' + r.eum).indexOf(text) >= 0));
      const more = all.filter((c) => main.indexOf(c) < 0 && c.words.some((w) => w.h.indexOf(text) >= 0 || w.r.indexOf(text) >= 0));
      if (!main.length && !more.length) return '<div class="empty"><span class="han">無</span>「' + esc(text) + '」에 맞는 한자가 없어요.</div>';
      return (main.length ? '<h3 class="group-h">훈음이 맞는 한자<span>' + main.length + '자</span></h3><div class="grid">' + main.map(tile).join('') + '</div>' : '') +
        (more.length ? '<h3 class="group-h">낱말에 「' + esc(text) + '」이(가) 들어간 한자<span>' + more.length + '자</span></h3><div class="grid">' + more.map(tile).join('') + '</div>' : '');
    }
    const chips = '<div class="scroll-x" style="margin-bottom:4px">' + [['all', '전체']].concat(LEVELS.map((l) => [l.id, l.name])).map((x) => '<a class="chip' + (sel === x[0] ? ' on' : '') + '" href="#/list?l=' + x[0] + '">' + x[1] + '</a>').join('') + '</div>';
    render('<div class="wrap fade-in">' + topbar(sel === 'all' ? '한자 찾기' : LV[sel].name + ' 한자 목록', back) + chips +
      '<label class="search">' + ic('search') + '<span class="sr">한자 찾기</span><input id="find" type="search" inputmode="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="뜻·소리·한자로 찾기 (예: 물, 수, 水)"></label>' +
      '<div class="legend"><span><i class="k"></i>익힌 한자</span><span><i class="s"></i>다시 볼 한자</span><span><i></i>아직 안 본 한자</span></div>' +
      '<div id="lbody">' + body('') + '</div></div>');
    const input = $('#find');
    let tm = 0;
    input.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { $('#lbody').innerHTML = body(input.value); }, 120); });
  }

  /* ======================= 사자성어 ======================= */
  function idiomCard(it) {
    const k = boxOf('i', it.id);
    return '<article class="card idiom" data-act="reveal">' + glyphRow(it.h, it.r, it.gloss) +
      '<div class="read">' + it.r + speakBtn(it.r) + '</div>' +
      '<div class="meaning"><div><span class="lab">글뜻</span>' + esc(it.lit) + '</div><div class="mean"><span class="lab">속뜻</span>' + esc(it.mean) + '</div></div>' +
      (it.story ? '<details class="story"><summary>이야기</summary><p>' + esc(it.story) + '</p></details>' : '') +
      ((it.src || k) ? '<div class="src">' + (k >= 2 ? '<span class="tag" style="float:left;background:var(--good-bg);color:var(--good)">익힘</span>' : k === 1 ? '<span class="tag" style="float:left;background:var(--bad-bg);color:var(--bad)">다시 보기</span>' : '') + esc(it.src) + '</div>' : '') +
      '</article>';
  }
  function phraseCard(p) {
    const k = boxOf('p', p.id);
    return '<article class="card idiom phrase" data-act="reveal">' + glyphRow(p.h, p.r, p.gloss) +
      '<div class="read">' + esc(p.r) + speakBtn(p.r) + '</div>' +
      '<div class="meaning"><div class="mean"><span class="lab">풀이</span>' + esc(p.mean) + '</div></div>' +
      '<div class="src">' + (k >= 2 ? '<span class="tag" style="float:left;background:var(--good-bg);color:var(--good)">익힘</span>' : k === 1 ? '<span class="tag" style="float:left;background:var(--bad-bg);color:var(--bad)">다시 보기</span>' : '') + esc(p.src) + '</div></article>';
  }
  function viewCollection(kind, q) {
    const l = kind === 'idiom' ? (LV[q.get('l')] && LV[q.get('l')].idiomUnits.length ? LV[q.get('l')] : LV.mid) : (LV[q.get('l')] && LV[q.get('l')].phraseUnits.length ? LV[q.get('l')] : LV.adv);
    const units = kind === 'idiom' ? l.idiomUnits : l.phraseUnits;
    const st = { u: Math.max(0, Math.min(units.length - 1, +q.get('u') || 0)), hide: false };
    const title = l.name + (kind === 'idiom' ? ' 사자성어' : ' 한문 명구');
    function draw() {
      const u = units[st.u];
      $('#tabs').innerHTML = units.map((x, i) => '<button class="chip" data-act="unit" data-i="' + i + '" aria-pressed="' + (i === st.u) + '">' + esc(x.name) + '</button>').join('');
      $('#hideBtn').setAttribute('aria-pressed', st.hide);
      $('#hideBtn').innerHTML = (st.hide ? ic('eye') + '뜻 보이기' : ic('eyeoff') + '뜻 가리기');
      const list = $('#col');
      list.classList.toggle('hide-mean', st.hide);
      list.innerHTML = u.items.map(kind === 'idiom' ? idiomCard : phraseCard).join('');
      $('#colQuiz').setAttribute('href', '#/quiz?l=' + l.id + '&k=' + kind + '&u=' + st.u + '&t=mix&n=10');
    }
    render('<div class="wrap fade-in" style="' + lvStyle(l) + '">' + topbar(title, '#/level/' + l.id) +
      '<div class="scroll-x" id="tabs"></div>' +
      '<div class="toolbar"><span class="muted" style="font-size:13.5px">글자를 누르면 훈음과 쓰임을 볼 수 있어요</span><button class="chip" id="hideBtn" data-act="hide"></button></div>' +
      '<div class="idioms" id="col"></div>' +
      '<a class="btn seal wide" id="colQuiz" style="margin-top:16px">' + ic('quiz') + '이 묶음 퀴즈 풀기</a></div>', {
      act: {
        unit(el) { st.u = +el.dataset.i; draw(); window.scrollTo(0, 0); history.replaceState(null, '', '#/' + (kind === 'idiom' ? 'idioms?l=' + l.id + '&u=' : 'phrases?l=' + l.id + '&u=') + st.u); },
        hide() { st.hide = !st.hide; draw(); },
        reveal(el, e) { if (st.hide && !e.target.closest('button,summary,a')) el.classList.toggle('revealed'); }
      }
    });
    draw();
  }

  /* ======================= 오답 노트 ======================= */
  function viewReview() {
    const cs = wrongList('c').filter((c) => CHARS[c]);
    const is = wrongList('i').filter((i) => IDIOM_BY[i]);
    const ps = wrongList('p').filter((p) => PHRASE_BY[p]);
    const ts = wrongList('t').filter((x) => TIER_BY[x]);
    const total = cs.length + is.length + ps.length + ts.length;
    let html = '<div class="wrap fade-in">' + topbar('오답 노트', '#/');
    if (!total) {
      html += '<div class="empty"><span class="han">淸</span>오답 노트가 깨끗해요.<br>퀴즈에서 틀리거나 카드에서 「다시 볼래요」를 누르면 여기에 모여요.</div></div>';
      return render(html);
    }
    html += '<p class="muted" style="margin:4px 4px 14px;font-size:14.5px">틀렸거나 다시 보기로 한 것을 모았어요. 퀴즈나 카드에서 맞히면 노트에서 빠져요.</p>' +
      '<div class="btns"><a class="btn seal" href="#/quiz?k=review">' + ic('quiz') + '오답 퀴즈 ' + Math.min(30, total) + '문제</a>' +
      (cs.length ? '<a class="btn" href="#/study?k=review">' + ic('cards') + '카드로 복습</a>' : '') + '</div>';
    if (cs.length) {
      html += '<h3 class="group-h">한자<span>' + cs.length + '자</span></h3><div class="grid">' + cs.map((c) => {
        const x = CHARS[c];
        return '<div class="tile seen" style="padding:0"><button style="all:unset;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-height:86px;cursor:pointer" data-char="' + c + '"><span class="han" lang="ko">' + c + '</span><small>' + esc(x.main) + '</small></button>' +
          '<button class="x" data-act="rm" data-k="c:' + c + '" aria-label="' + c + ' 노트에서 빼기">' + ic('x') + '</button></div>';
      }).join('') + '</div>';
    }
    const rowItem = (key, hanja, sub, attr) => '<div class="card row-link" style="margin-top:8px;padding:10px 6px 10px 14px"><button style="all:unset;flex:1;cursor:pointer" ' + attr + '><span class="han" style="font-size:22px">' + esc(hanja) + '</span><small>' + esc(sub) + '</small></button>' +
      '<button class="icon-btn" data-act="rm" data-k="' + key + '" aria-label="노트에서 빼기">' + ic('x') + '</button></div>';
    if (is.length) html += '<h3 class="group-h">사자성어<span>' + is.length + '개</span></h3>' + is.map((i) => rowItem('i:' + i, IDIOM_BY[i].h, IDIOM_BY[i].r + ' · ' + IDIOM_BY[i].mean, 'data-idiom="' + i + '"')).join('');
    if (ts.length) html += '<h3 class="group-h">사자성어 시험<span>' + ts.length + '개</span></h3>' + ts.map((x) => rowItem('t:' + x, TIER_BY[x].h, TIER_BY[x].r + ' · ' + TIER_BY[x].mean, 'data-speak="' + TIER_BY[x].r + '"')).join('');
    if (ps.length) html += '<h3 class="group-h">한문 명구<span>' + ps.length + '구</span></h3>' + ps.map((p) => rowItem('p:' + p, PHRASE_BY[p].h, PHRASE_BY[p].r, 'data-phrase="' + p + '"')).join('');
    html += '<button class="btn wide soft" style="margin-top:24px" data-act="clear">' + ic('trash') + '오답 노트 모두 비우기</button></div>';
    render(html, {
      act: {
        rm(el) { delete S.wrong[el.dataset.k]; save(); viewReview(); },
        clear() { if (confirm('오답 노트를 모두 비울까요?')) { S.wrong = {}; save(); viewReview(); } }
      }
    });
  }

  /* ======================= 설정 ======================= */
  function viewSettings() {
    const seg = (act, cur, opts) => '<div class="seg" role="group">' + opts.map((o) => '<button data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
    const sw = (act, on, label) => '<button class="switch" role="switch" aria-checked="' + on + '" aria-label="' + label + '" data-act="' + act + '"></button>';
    const html = '<div class="wrap fade-in">' + topbar('설정', '#/') +
      '<h2 class="sec">화면</h2><section class="card set">' +
      '<div class="row"><div class="grow">테마</div>' + seg('theme', S.settings.theme, [['system', '시스템'], ['light', '밝게'], ['dark', '어둡게']]) + '</div>' +
      '<div class="row"><div class="grow">한자 글꼴<small>명조는 붓글씨 획에 가깝고, 고딕은 작은 화면에서 또렷해요</small></div>' + seg('font', S.settings.font, [['serif', '명조'], ['sans', '고딕']]) + '</div></section>' +
      '<h2 class="sec">소리</h2><section class="card set">' +
      '<div class="row"><div class="grow">효과음<small>퀴즈에서 맞히거나 틀리면 짧게 울려요</small></div>' + sw('sound', S.settings.sound, '효과음') + '</div>' +
      (canSpeak ? '<div class="row"><div class="grow">카드를 뒤집으면 읽어 주기<small>기기의 한국어 음성으로 훈음을 읽어 줘요</small></div>' + sw('speak', S.settings.speak, '자동 읽기') + '</div>' : '') +
      '</section>' +
      '<h2 class="sec">기록</h2><section class="card set">' +
      '<div class="row"><div class="grow">기록 내보내기<small>다른 기기로 옮기거나 보관할 때 (JSON 파일)</small></div><button class="btn small" data-act="export">' + ic('down') + '내보내기</button></div>' +
      '<div class="row"><div class="grow">기록 불러오기</div><button class="btn small" data-act="import">' + ic('up') + '불러오기</button><input type="file" id="importFile" accept="application/json,.json" hidden></div>' +
      '<div class="row"><div class="grow">처음부터 다시<small>익힌 한자, 오답 노트, 공부한 날을 모두 지워요</small></div><button class="btn small" data-act="reset" style="color:var(--bad)">' + ic('trash') + '지우기</button></div></section>' +
      '<p class="about">급수와 훈음은 한국어문회 한자능력검정시험 배정 한자(8급~특급 2,500자)를 따랐고, 획수와 부수는 Unicode Unihan 자료에서 가져왔어요. 기록은 이 기기의 브라우저에만 저장돼요.</p></div>';
    render(html, {
      act: {
        theme(el) { S.settings.theme = el.dataset.v; save(); applySettings(); viewSettings(); },
        font(el) { S.settings.font = el.dataset.v; save(); applySettings(); viewSettings(); },
        sound() { S.settings.sound = !S.settings.sound; save(); viewSettings(); if (S.settings.sound) beep(true); },
        speak() { S.settings.speak = !S.settings.speak; save(); viewSettings(); if (S.settings.speak) speak('물 수'); },
        export() {
          try {
            const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'hanja-seodang-' + dayKey() + '.json';
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          } catch (e) { toast('내보내기를 할 수 없어요'); }
        },
        import() { $('#importFile').click(); },
        reset() {
          if (!confirm('지금까지의 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
          const keep = S.settings;
          S = fresh(); S.settings = keep; save(); toast('기록을 지웠어요'); viewSettings();
        }
      }
    });
    $('#importFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const o = JSON.parse(rd.result);
          if (!o || typeof o !== 'object' || !o.cards) throw new Error('bad');
          S = adopt(o); save(); applySettings(); toast('기록을 불러왔어요'); viewSettings();
        } catch (err) { toast('한자 서당 기록 파일이 아니에요'); }
      };
      rd.readAsText(f);
    });
  }

  /* ======================= 아래에서 올라오는 창 ======================= */
  let sheetOpen = false;
  function openSheet(html) {
    closeSheet(true);
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.addEventListener('click', () => closeSheet());
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.setAttribute('role', 'dialog');
    sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="grab" aria-hidden="true"></div><button class="icon-btn close" data-act="close-sheet" aria-label="닫기">' + ic('x') + '</button>' + html;
    document.body.appendChild(bg);
    document.body.appendChild(sh);
    sheetOpen = true;
    requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
    // 아래로 끌어내려 닫기
    let y0 = null;
    sh.addEventListener('touchstart', (e) => { y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    sh.addEventListener('touchmove', (e) => { if (y0 != null && e.touches[0].clientY - y0 > 0) sh.style.transform = 'translateY(' + (e.touches[0].clientY - y0) + 'px)'; }, { passive: true });
    sh.addEventListener('touchend', (e) => {
      if (y0 == null) return;
      const dy = (e.changedTouches[0] ? e.changedTouches[0].clientY : y0) - y0;
      sh.style.transform = '';
      y0 = null;
      if (dy > 90) closeSheet();
    });
    const c = $('.close', sh);
    if (c) c.focus({ preventScroll: true });
  }
  function closeSheet(now) {
    const bg = $('.sheet-bg'), sh = $('.sheet');
    sheetOpen = false;
    if (!sh) return;
    if (now) { bg && bg.remove(); sh.remove(); return; }
    bg && bg.classList.remove('on');
    sh.classList.remove('on');
    setTimeout(() => { bg && bg.remove(); sh.remove(); }, 260);
  }
  function refsOf(c) {
    const out = [];
    IDIOMS.forEach((it) => { if (it.h.indexOf(c) >= 0) out.push('<a href="#/idioms?l=' + it.level + '&u=' + it.unit + '"><span class="han">' + it.h + '</span>' + it.r + ' <small>' + esc(it.mean) + '</small></a>'); });
    PHRASES.forEach((p) => { if (p.h.indexOf(c) >= 0) out.push('<a href="#/phrases?l=' + p.level + '&u=' + p.unit + '"><span class="han">' + esc(p.h) + '</span><small>' + esc(p.mean) + '</small></a>'); });
    return out;
  }
  function openChar(c) {
    const info = CHARS[c];
    const rd = info ? info.readings : EXTRA[c];
    if (!rd) return;
    const u = (typeof UNIHAN !== 'undefined' && UNIHAN[c]) || [0, 0];
    const rad = info ? info.rad : RADICALS[u[1]];
    const strokes = info ? info.strokes : u[0];
    const tags = info
      ? '<span class="tag">' + GRADE(info.g) + '</span><span class="tag">' + LV[info.level].name + ' ' + (info.unit + 1) + '단원</span>' + (known('c', c) ? '<span class="tag" style="background:var(--good-bg);color:var(--good)">익힘</span>' : '')
      : '<span class="tag">성어·명구에 나오는 글자</span>';
    const refs = refsOf(c);
    const main = rd[0].hun + ' ' + rd[0].eum;
    const html = '<div class="ch-head"><span class="han" lang="ko">' + c + '</span><div><div class="hunum">' + esc(rd[0].hun) + ' <b>' + esc(rd[0].eum) + '</b></div>' +
      (rd.length > 1 ? '<div class="alt">또는 ' + rd.slice(1).map((r) => esc(r.hun + ' ' + r.eum)).join(', ') + '</div>' : '') +
      '<div class="tags">' + tags + '</div></div></div>' +
      '<dl class="ch-meta"><div><dt>부수</dt><dd>' + (rad ? '<span class="han">' + rad[0] + '</span>' + esc(rad[1]) : '—') + '</dd></div><div><dt>총 획수</dt><dd>' + (strokes ? strokes + '획' : '—') + '</dd></div></dl>' +
      (info ? '<h4>이 한자가 들어간 낱말</h4><ul class="words">' + info.words.map((w) => '<li><span class="han" lang="ko">' + w.h + '</span><span>' + w.r + '</span>' + speakBtn(w.r) + '</li>').join('') + '</ul>' : '') +
      (refs.length ? '<h4>이 한자가 나오는 성어·명구</h4><div class="refs">' + refs.join('') + '</div>' : '') +
      '<div class="btns">' + (canSpeak ? '<button class="btn" data-speak="' + esc(main) + '">' + ic('vol') + '읽어 주기</button>' : '') +
      '<a class="btn" href="#/write?c=' + encodeURIComponent(c) + '">' + ic('pen') + '써 보기</a>' +
      (info ? '<button class="btn" data-act="toggle-wrong" data-c="' + c + '">' + ic('note') + (inWrong('c', c) ? '노트에서 빼기' : '오답 노트에 넣기') + '</button>' : '') + '</div>';
    openSheet(html);
  }
  function openIdiom(id) { const it = IDIOM_BY[id]; if (it) openSheet('<div style="padding-top:28px">' + idiomCard(it) + '</div>'); }
  function openPhrase(id) { const p = PHRASE_BY[id]; if (p) openSheet('<div style="padding-top:28px">' + phraseCard(p) + '</div>'); }

  /* ======================= 사자성어 시험 ======================= */
  const tierStyle = (t) => lvStyle({ id: t.lv });
  const TEST_KINDS = [
    ['build', '글자 맞추기', '뜻을 보고 여덟 글자 가운데 네 글자를 순서대로 골라 성어를 만들어요', 'cards'],
    ['read', '읽기 맞추기', '한자 성어를 보고 바르게 읽은 것을 골라요', 'msg'],
    ['mean', '뜻 맞추기', '한자 성어를 보고 알맞은 뜻을 골라요', 'quiz']
  ];
  function viewSeongeo() {
    const rows = TIERS.slice(1).map((t) => {
      const k = knownCount(t.items, 't');
      return '<a class="card level-card" href="#/seongeo/' + t.n + '" style="' + tierStyle(t) + '">' +
        '<span class="lv-badge han">' + t.hanja + '</span>' +
        '<div class="lv-text"><div class="lv-name">' + t.name + '</div><div class="lv-sub">' + esc(t.sub) + '</div>' +
        '<div class="bar"><i style="width:' + pct(k, t.items.length) + '%"></i></div>' +
        '<div class="lv-count">익힌 성어 ' + k + ' / ' + t.items.length + '</div></div>' + ic('right') + '</a>';
    }).join('');
    render('<div class="wrap fade-in">' + topbar('사자성어 시험', '#/') +
      '<p class="muted" style="margin:4px 4px 14px;font-size:14.5px">성어에 든 가장 어려운 글자의 급수로 단계를 나눴어요. 단계마다 세 가지 시험이 있어요.</p>' +
      '<div class="levels">' + rows + '</div></div>');
  }
  function tierRow(it) {
    const k = boxOf('t', it.id);
    return '<article class="card idiom tier-row"><div class="han" lang="ko" style="font-size:30px;letter-spacing:.08em">' + it.h + '</div>' +
      '<div class="read">' + esc(it.r) + speakBtn(it.r) + '</div><div class="muted" style="font-size:14.5px;line-height:1.5">' + esc(it.mean) + '</div>' +
      (k >= 2 ? '<span class="tag" style="background:var(--good-bg);color:var(--good)">익힘</span>' : k === 1 ? '<span class="tag" style="background:var(--bad-bg);color:var(--bad)">다시 보기</span>' : '') + '</article>';
  }
  function viewSeongeoTier(n) {
    const t = TIERS[+n];
    if (!t) return go('#/seongeo');
    const k = knownCount(t.items, 't');
    const tests = TEST_KINDS.map((x) => '<a class="card action" href="#/stest?t=' + t.n + '&k=' + x[0] + '&n=10"><span class="ic-box">' + ic(x[3]) + '</span><b>' + x[1] + '</b><small>' + x[2] + '</small></a>').join('');
    render('<div class="wrap fade-in" style="' + tierStyle(t) + '">' + topbar('사자성어 · ' + t.name, '#/seongeo') +
      '<div class="lv-head"><span class="lv-badge han">' + t.hanja + '</span><div><h2>' + t.name + ' 사자성어</h2><p>' + esc(t.sub) + ' · ' + t.items.length + '개</p></div></div>' +
      '<section class="card lv-progress"><div class="row"><span>익힌 성어</span><div class="bar"><i style="width:' + pct(k, t.items.length) + '%"></i></div><span>' + k + ' / ' + t.items.length + '</span></div></section>' +
      '<h2 class="sec">시험 보기</h2><div class="actions">' + tests + '</div>' +
      '<h2 class="sec">이 단계의 사자성어 (' + t.items.length + ')</h2><div class="idioms">' + t.items.map(tierRow).join('') + '</div></div>');
  }
  const exTier = (it) => '<div class="ex"><div><div class="han" style="font-size:32px" lang="ko">' + it.h + '</div><b>' + esc(it.r) + '</b><small>' + esc(it.mean) + '</small></div></div>';
  function tierPool(it) { return TIERS[it.tier].items.length >= 8 ? TIERS[it.tier].items : TIERS.slice(1).reduce((a, x) => a.concat(x.items), []); }
  function makeTierQ(it, type) {
    const pool = tierPool(it);
    if (type === 'build') {
      const have = Array.from(it.h);
      const others = pool.filter((x) => x !== it).map((x) => x.h).join('');
      const other = shuffle(Array.from(new Set(Array.from(others)))).filter((c) => have.indexOf(c) < 0);
      const decoys = other.slice(0, 4);
      let i = 0;
      return {
        kind: 't', id: it.id, type: 'build', item: it,
        tiles: shuffle(have.concat(decoys).map((ch) => ({ ch, id: i++ }))),
        ask: '뜻에 맞는 사자성어를 만들어요', say: it.r, explain: exTier(it)
      };
    }
    if (type === 'read') {
      const ds = readingDistractors(it.h, it.r, 3, pool.map((x) => ({ r: x.r, h: x.h })));
      return {
        kind: 't', id: it.id, ask: '이 성어를 바르게 읽은 것은?',
        prompt: '<div class="han q-idiom" lang="ko">' + it.h + '</div>',
        options: shuffle([it.r].concat(ds)).map((o) => optText('<span>' + esc(o) + '</span>', o === it.r)),
        explain: exTier(it), say: it.r
      };
    }
    const ds = sample(pool.filter((x) => x !== it && x.mean !== it.mean), 3);
    return {
      kind: 't', id: it.id, ask: '이 성어의 뜻은?',
      prompt: '<div class="han q-idiom" lang="ko">' + it.h + '</div>',
      options: shuffle([it].concat(ds)).map((o) => optText(esc(o.mean), o === it, true)),
      explain: exTier(it), say: it.r
    };
  }
  function viewSTest(q) {
    const t = TIERS[+q.get('t')];
    const kind = q.get('k') || 'build';
    if (!t || !t.items.length) return go('#/seongeo');
    const back = '#/seongeo/' + t.n;
    const label = (TEST_KINDS.filter((x) => x[0] === kind)[0] || TEST_KINDS[0])[1];
    const n = Math.max(3, Math.min(30, +q.get('n') || 10));
    const make = () => repeatTo(t.items, Math.min(n, t.items.length)).map((it) => makeTierQ(it, kind === 'mix' ? pick(['build', 'read', 'mean']) : kind));
    const st = { qs: make(), i: 0, score: 0, wrong: [], answered: false, timer: 0, pick: [] };
    function drawQ() {
      const qq = st.qs[st.i];
      st.answered = false; st.pick = [];
      $('#pos').textContent = (st.i + 1) + ' / ' + st.qs.length;
      const bar = '<div class="bar qbar"><i style="width:' + pct(st.i, st.qs.length) + '%"></i></div>';
      if (qq.type === 'build') {
        $('#quiz').innerHTML = bar + '<section class="card question fade-in"><div class="q-ask">' + esc(qq.ask) + '</div>' +
          '<div class="q-sub" style="font-size:18px;line-height:1.5;margin-top:6px">' + esc(qq.item.mean) + '</div>' +
          '<button class="btn small soft" id="hintBtn" data-act="hint" style="margin-top:12px">독음 힌트 보기</button></section>' +
          '<div class="slots" id="slots"></div><div class="tiles8" id="tiles"></div>' +
          '<div class="btns" style="margin-top:12px"><button class="btn" data-act="clear">다시 놓기</button><button class="btn primary" data-act="check" id="checkBtn" disabled>확인</button></div><div id="fb"></div>';
        drawBuild();
      } else {
        $('#quiz').innerHTML = bar + '<section class="card question fade-in"><div class="q-ask">' + esc(qq.ask) + '</div>' + qq.prompt + '</section>' +
          '<div class="options">' + qq.options.map((o, i) => '<button class="opt' + (o.long ? ' long' : '') + '" data-act="ans" data-i="' + i + '"><span class="no">' + (i + 1) + '</span>' + o.html + '</button>').join('') + '</div><div id="fb"></div>';
      }
    }
    function drawBuild() {
      const qq = st.qs[st.i];
      const used = st.pick.map((p) => p.id);
      $('#slots').innerHTML = [0, 1, 2, 3].map((i) => {
        const p = st.pick[i];
        return '<button class="slot' + (p ? ' on' : '') + '" data-act="unpick" data-i="' + i + '" aria-label="' + (i + 1) + '번째 글자' + (p ? ' ' + p.ch : ' 비어 있음') + '"><span class="han" lang="ko">' + (p ? p.ch : '') + '</span></button>';
      }).join('');
      $('#tiles').innerHTML = qq.tiles.map((x) => '<button class="tile8" data-act="pick" data-id="' + x.id + '"' + (used.indexOf(x.id) >= 0 ? ' disabled' : '') + '><span class="han" lang="ko">' + x.ch + '</span></button>').join('');
      $('#checkBtn').disabled = st.pick.length < 4;
    }
    function finish(qq, ok) {
      st.answered = true;
      record('t', qq.id, ok);
      beep(ok);
      if (ok) st.score++; else st.wrong.push(qq);
      const last = st.i === st.qs.length - 1;
      $('#fb').innerHTML = '<section class="card feedback">' +
        '<div class="verdict ' + (ok ? 'ok">' + ic('check') + '맞았어요!' : 'ng">' + ic('x') + '아쉬워요. 정답을 확인해요') + (qq.say ? speakBtn(qq.say) : '') + '</div>' +
        qq.explain + '<button class="btn primary wide" data-act="next">' + (last ? '결과 보기' : '다음 문제') + '</button></section>';
      if (ok) st.timer = setTimeout(next, 1500);
      else { const f = $('#fb'); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
    function answer(i) {
      const qq = st.qs[st.i];
      if (st.answered || qq.type === 'build') return;
      const ok = qq.options[i].ok;
      $$('.opt').forEach((b, j) => {
        b.disabled = true;
        if (qq.options[j].ok) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); else b.classList.add('dim');
      });
      finish(qq, ok);
    }
    function check() {
      const qq = st.qs[st.i];
      if (st.answered || st.pick.length < 4) return;
      const got = st.pick.map((p) => p.ch).join('');
      const ok = got === qq.item.h;
      $$('.tile8,.slot').forEach((b) => { b.disabled = true; });
      $$('.slot').forEach((b, i) => b.classList.add(st.pick[i].ch === Array.from(qq.item.h)[i] ? 'right' : 'wrong'));
      $('#checkBtn').disabled = true;
      if (!ok) $('#slots').insertAdjacentHTML('afterend', '<div class="answer-line han" lang="ko">정답 ' + qq.item.h + '</div>');
      finish(qq, ok);
    }
    function next() {
      clearTimeout(st.timer);
      if (!st.answered) return;
      st.i++;
      if (st.i >= st.qs.length) result(); else { drawQ(); window.scrollTo(0, 0); }
    }
    function result() {
      const g = grade(st.score, st.qs.length);
      $('#pos').textContent = '';
      const seen = {};
      const miss = st.wrong.filter((x) => (seen[x.id] ? false : (seen[x.id] = true)));
      $('#quiz').innerHTML = '<section class="card result fade-in">' + stamp(g) +
        '<div class="score">' + st.score + ' / ' + st.qs.length + '</div><p>' + g[2] + '</p>' +
        (miss.length ? '<h2 style="font-size:16px;margin-top:8px">틀린 문제 (오답 노트에 모았어요)</h2><div class="miss">' + miss.map((x) => '<button class="han" data-speak="' + esc(x.item ? x.item.r : TIER_BY[x.id].r) + '">' + x.id + '<small>' + esc(TIER_BY[x.id].r) + '</small></button>').join('') + '</div>' : '') +
        '<div class="btns" style="width:100%">' + (miss.length ? '<button class="btn seal" data-act="retry">틀린 문제만 다시</button>' : '') +
        '<button class="btn primary" data-act="again">새 문제로 다시</button><a class="btn" href="' + back + '">돌아가기</a></div></section>';
    }
    render('<div class="wrap fade-in" style="' + tierStyle(t) + '">' + topbar(t.name + ' · ' + label, back, '<span id="pos"></span>') + '<div id="quiz"></div></div>', {
      act: {
        ans(el) { answer(+el.dataset.i); },
        pick(el) {
          if (st.answered || st.pick.length >= 4) return;
          const x = st.qs[st.i].tiles.filter((y) => y.id === +el.dataset.id)[0];
          if (x) { st.pick.push(x); drawBuild(); }
        },
        unpick(el) {
          if (st.answered) return;
          const i = +el.dataset.i;
          if (st.pick[i]) { st.pick.splice(i, 1); drawBuild(); }
        },
        clear() { if (!st.answered) { st.pick = []; drawBuild(); } },
        check,
        hint(el) { const qq = st.qs[st.i]; el.outerHTML = '<div class="q-sub" style="margin-top:10px">독음 · <b>' + esc(qq.item.r) + '</b></div>'; },
        next,
        again() { route(); },
        retry() {
          st.qs = shuffle(st.wrong).map((x) => makeTierQ(TIER_BY[x.id], x.type === 'build' ? 'build' : pick(['read', 'mean'])));
          st.i = 0; st.score = 0; st.wrong = [];
          drawQ();
        }
      },
      key(e) {
        const qq = st.qs[st.i];
        if (!st.answered && qq && qq.type !== 'build' && /^[1-4]$/.test(e.key) && $('.opt')) answer(+e.key - 1);
        else if (st.answered && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); next(); }
      },
      destroy() { clearTimeout(st.timer); }
    });
    drawQ();
  }

  /* ======================= 길잡이 ======================= */
  function render(html, v) {
    if (view.destroy) try { view.destroy(); } catch (e) { /* 무시 */ }
    view = v || {};
    app.innerHTML = html;
  }
  function route() {
    closeSheet(true);
    stopSpeak();
    const hash = location.hash.replace(/^#/, '') || '/';
    const qi = hash.indexOf('?');
    const path = qi >= 0 ? hash.slice(0, qi) : hash;
    const q = new URLSearchParams(qi >= 0 ? hash.slice(qi + 1) : '');
    const parts = path.split('/').filter(Boolean);
    switch (parts[0] || '') {
      case 'level': viewLevel(parts[1]); break;
      case 'study': viewStudy(q); break;
      case 'quizset': viewQuizSet(q); break;
      case 'quiz': viewQuiz(q); break;
      case 'write': viewWrite(q); break;
      case 'list': viewList(q); break;
      case 'idioms': viewCollection('idiom', q); break;
      case 'phrases': viewCollection('phrase', q); break;
      case 'seongeo': if (parts[1]) viewSeongeoTier(parts[1]); else viewSeongeo(); break;
      case 'stest': viewSTest(q); break;
      case 'review': viewReview(); break;
      case 'settings': viewSettings(); break;
      default: viewHome();
    }
    window.scrollTo(0, 0);
    onScroll();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-char],[data-speak],[data-idiom],[data-phrase]');
    if (!t) return;
    if (t.hasAttribute('data-speak')) { e.preventDefault(); e.stopPropagation(); speak(t.getAttribute('data-speak')); return; }
    if (t.hasAttribute('data-char')) { e.preventDefault(); openChar(t.getAttribute('data-char')); return; }
    if (t.hasAttribute('data-idiom')) { e.preventDefault(); openIdiom(t.getAttribute('data-idiom')); return; }
    if (t.hasAttribute('data-phrase')) { e.preventDefault(); openPhrase(t.getAttribute('data-phrase')); return; }
    const a = t.getAttribute('data-act');
    if (a === 'close-sheet') { closeSheet(); return; }
    if (a === 'toggle-wrong') {
      const c = t.getAttribute('data-c'), k = 'c:' + c;
      if (S.wrong[k]) { delete S.wrong[k]; toast('오답 노트에서 뺐어요'); } else { S.wrong[k] = Date.now(); toast('오답 노트에 넣었어요'); }
      save();
      t.innerHTML = ic('note') + (S.wrong[k] ? '노트에서 빼기' : '오답 노트에 넣기');
      return;
    }
    if (a === 'reveal' && t.closest('.sheet')) return;
    if (view.act && view.act[a]) view.act[a](t, e);
  });
  document.addEventListener('keydown', (e) => {
    if (sheetOpen) { if (e.key === 'Escape') closeSheet(); return; }
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.target && e.target.classList && e.target.classList.contains('flash') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (view.act && view.act.flip) view.act.flip(); return; }
    if (view.key) view.key(e);
  });
  function onScroll() { const tb = $('.topbar'); if (tb) tb.classList.toggle('scrolled', window.scrollY > 4); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('hashchange', route);

  function applySettings() {
    const r = document.documentElement;
    const t = S.settings.theme;
    if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
    if (S.settings.font === 'sans') r.setAttribute('data-font', 'sans'); else r.removeAttribute('data-font');
    $$('meta[name="theme-color"]').forEach((m) => {
      if (!m.dataset.base) m.dataset.base = m.getAttribute('content');
      m.setAttribute('content', t === 'light' ? '#f4eee2' : t === 'dark' ? '#15130f' : m.dataset.base);
    });
  }

  applySettings();
  route();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
