'use strict';
/* 하루 책상 — 공통 기능: 저장소, 날짜/숫자 도우미, 아이콘, 라우터, 토스트·모달, 소리, 알림 */
window.App = (function () {
  /* ---------- 저장소 ---------- */
  const PREFIX = 'haru.';
  const memory = {};
  let warnedStorage = false;

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) { /* 저장소를 쓸 수 없거나 값이 깨진 경우 */ }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback;
  }
  function persist(key, value) {
    memory[key] = value;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (!warnedStorage) {
        warnedStorage = true;
        setTimeout(() => toast('브라우저 저장소에 쓸 수 없어요. 새로고침하면 이번 기록이 사라질 수 있어요.', { duration: 6000 }), 0);
      }
      return false;
    }
  }
  function wipeAll() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* noop */ }
    Object.keys(memory).forEach(k => delete memory[k]);
  }

  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const DEFAULTS = {
    prefs: { name: '', theme: 'dark', city: null, seeded: false, sound: 'chime' },
    notes: [],
    todoLists: [{ id: 'inbox', name: '할 일' }],
    todos: [],
    events: [],
    alarms: [],
    snoozes: [],
    txs: [],
    budget: 0,
    habits: [],
    ddays: [],
    timer: null,
    stopwatch: null,
    pomo: null,
    pomoLog: {},
    player: null,
    ambient: null,
    eq: null,
    ui: {},
    weather: null
  };
  const KEYS = Object.keys(DEFAULTS);
  const data = {};
  for (const k of KEYS) data[k] = load(k, clone(DEFAULTS[k]));
  data.prefs = Object.assign(clone(DEFAULTS.prefs), data.prefs || {});
  if (!Array.isArray(data.todoLists) || !data.todoLists.length) data.todoLists = clone(DEFAULTS.todoLists);

  function save(key) { return persist(key, data[key]); }

  /* ---------- 이벤트 ---------- */
  const listeners = {};
  function on(evt, fn) {
    (listeners[evt] || (listeners[evt] = new Set())).add(fn);
    return () => listeners[evt].delete(fn);
  }
  function emit(evt, payload) {
    const set = listeners[evt];
    if (!set) return;
    [...set].forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  /* ---------- 도우미 ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const today = () => ymd(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function fmtDate(d, withYear = true) {
    return `${withYear ? d.getFullYear() + '년 ' : ''}${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`;
  }
  function fmtClock(d) {
    const h = d.getHours();
    return { ampm: h < 12 ? '오전' : '오후', hm: `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}`, h24: `${pad(h)}:${pad(d.getMinutes())}` };
  }
  function fmtHM(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const c = fmtClock(new Date(2000, 0, 1, h, m));
    return `${c.ampm} ${c.hm}`;
  }
  function fmtDur(ms, { cs = false } = {}) {
    ms = Math.max(0, ms);
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    let out = h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    if (cs) out += '.' + pad(Math.floor((ms % 1000) / 10));
    return out;
  }
  function untilText(ms) {
    const min = Math.ceil(ms / 60000);
    if (min <= 1) return '1분 안에';
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    const parts = [];
    if (d) parts.push(`${d}일`);
    if (h) parts.push(`${h}시간`);
    if (m && !d) parts.push(`${m}분`);
    return parts.join(' ') + ' 후';
  }
  function relDay(s) {
    const n = diffDays(new Date(), parseYmd(s));
    if (n === 0) return '오늘';
    if (n === 1) return '내일';
    if (n === 2) return '모레';
    if (n === -1) return '어제';
    const d = parseYmd(s);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function relTime(ts) {
    const d = new Date(ts), now = new Date();
    if (ymd(d) === ymd(now)) { const c = fmtClock(d); return `${c.ampm} ${c.hm}`; }
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  }
  const won = n => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`;
  const num = n => Math.round(Number(n) || 0).toLocaleString('ko-KR');
  function debounce(fn, ms) {
    let t;
    const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
    return wrapped;
  }

  /* ---------- 음력 (한국 음력 = dangi 달력) ---------- */
  let lunarFmt = null;
  try {
    lunarFmt = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { year: 'numeric', month: 'numeric', day: 'numeric' });
    const probe = lunarFmt.formatToParts(new Date(2026, 1, 17));
    const m = probe.find(p => p.type === 'month'), d = probe.find(p => p.type === 'day');
    if (!(m && d && m.value === '1' && d.value === '1')) lunarFmt = null;
  } catch (e) { lunarFmt = null; }
  function lunarParts(date) {
    if (!lunarFmt) return null;
    const parts = lunarFmt.formatToParts(date);
    const month = (parts.find(p => p.type === 'month') || {}).value;
    const day = (parts.find(p => p.type === 'day') || {}).value;
    return month && day ? { month, day: Number(day) } : null;
  }
  function lunar(date) {
    const p = lunarParts(date);
    return p ? `음력 ${p.month}월 ${p.day}일` : '';
  }

  /* ---------- 아이콘 ---------- */
  const ICONS = {
    home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5.5h4V20"/>',
    note: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14 3.5V8.5h5"/><path d="M9 13h7M9 16.5h5"/>',
    todo: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12.3 2.8 2.8L16.5 9"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 1.8M3.5 6 6.5 3M20.5 6l-3-3"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5 20 5"/>',
    music: '<path d="M9 18V5.5L20 3v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>',
    wallet: '<path d="M19 7.5V5.5a1.5 1.5 0 0 0-1.5-1.5H6A2.5 2.5 0 0 0 3.5 6.5v11A2.5 2.5 0 0 0 6 20h13.5a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1-2.5-2"/><circle cx="16.5" cy="14" r="1.2"/>',
    habit: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.7 3.1-5.6 3.6-9.4 2.3 1.4 3.8 3.6 3.8 5.8 1-.6 1.7-1.7 1.9-3 1.9 1.6 3.7 4 3.7 6.6 0 3.5-2.6 6.1-6.5 6.1z"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8.5 6.5h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
    prefs: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
    pin: '<path d="M9 3.5h6l-1 6.5 3.5 3.5h-11L10 10z"/><path d="M12 13.5V20.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    play: '<path d="M8 5.2v13.6L18.8 12z" fill="currentColor"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    next: '<path d="M5.5 5.5v13l9.5-6.5z" fill="currentColor"/><path d="M18.5 5v14"/>',
    prev: '<path d="M18.5 5.5v13L9 12z" fill="currentColor"/><path d="M5.5 5v14"/>',
    shuffle: '<path d="M3 7h3.5c5 0 6 10 11 10H21M3 17h3.5c1.6 0 2.8-1 3.7-2.3M13.8 9.3C14.7 8 15.9 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    repeat: '<path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M17 3l3 3-3 3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4M7 21l-3-3 3-3"/>',
    volume: '<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2"/>',
    back: '<path d="m14.5 5-7 7 7 7"/>',
    chevronL: '<path d="m14.5 6-6 6 6 6"/>',
    chevronR: '<path d="m9.5 6 6 6-6 6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 14v5.5h15V14"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    partly: '<path d="M8.5 4v1.2M3.8 8.5H5M5.2 5.2l.9.9M12.4 6.1l.9-.9"/><path d="M5.6 11a3.4 3.4 0 0 1 6.1-3"/><path d="M8 19.5h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1A3 3 0 0 0 8 19.5z"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.4 10.6 4 4 0 0 0 7 18.5z"/>',
    rain: '<path d="M7 14.5h10.5a3.6 3.6 0 0 0 .5-7.17A5 5 0 0 0 7.4 7.5 3.5 3.5 0 0 0 7 14.5z"/><path d="M9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5"/>',
    snow: '<path d="M7 14.5h10.5a3.6 3.6 0 0 0 .5-7.17A5 5 0 0 0 7.4 7.5 3.5 3.5 0 0 0 7 14.5z"/><path d="M8.5 18h.01M12 20h.01M15.5 18h.01"/>',
    storm: '<path d="M7 14.5h10.5a3.6 3.6 0 0 0 .5-7.17A5 5 0 0 0 7.4 7.5 3.5 3.5 0 0 0 7 14.5z"/><path d="m12.5 15-2 3h3l-2 3"/>',
    fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
    wave: '<path d="M3 10c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2M3 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2M3 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/>',
    noise: '<path d="M3 12h2.5l2-5.5 3 11 3-8 2 5 1.5-2.5H21"/>',
    swap: '<path d="M7 4 4 7l3 3M4 7h12M17 14l3 3-3 3M20 17H8"/>',
    flag: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 16.8v.2"/>',
    sparkle: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6.5 6.5l2.3 2.3M15.2 15.2l2.3 2.3M6.5 17.5l2.3-2.3M15.2 8.8l2.3-2.3"/>'
  };
  function icon(name, size = 20, cls = '') {
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  }

  /* ---------- 토스트 ---------- */
  function toast(msg, opts = {}) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(msg)}</span>` + (opts.action ? `<button type="button" class="toast-act">${esc(opts.action)}</button>` : '');
    const remove = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    if (opts.action) {
      el.querySelector('.toast-act').addEventListener('click', () => { try { opts.onAction && opts.onAction(); } finally { remove(); } });
    }
    box.appendChild(el);
    setTimeout(remove, opts.duration || (opts.action ? 5000 : 2800));
  }

  /* ---------- 모달 ---------- */
  const modalStack = [];
  function modal({ title, body = '', actions = [], onMount, className = '' }) {
    const layer = document.getElementById('layer');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title-${modalStack.length}">
        <div class="modal-head">
          <h2 id="modal-title-${modalStack.length}">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="닫기">${icon('x')}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button type="button" class="btn ${a.kind || ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
      </div>`;
    const prevFocus = document.activeElement;
    let closed = false;
    const api = {
      el: wrap.querySelector('.modal'),
      close() {
        if (closed) return;
        closed = true;
        wrap.classList.add('out');
        const i = modalStack.indexOf(api);
        if (i >= 0) modalStack.splice(i, 1);
        setTimeout(() => wrap.remove(), 160);
        if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
        api.onClose && api.onClose();
      }
    };
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) api.close(); });
    wrap.querySelector('[data-close]').addEventListener('click', () => api.close());
    wrap.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const a = actions[Number(b.dataset.act)];
      const res = a.onClick ? a.onClick(api) : undefined;
      if (res !== false) api.close();
    }));
    layer.appendChild(wrap);
    modalStack.push(api);
    onMount && onMount(api.el, api);
    const first = api.el.querySelector('[autofocus], input, select, textarea, .modal-foot .btn.primary');
    (first || api.el.querySelector('[data-close]')).focus();
    return api;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); modalStack[modalStack.length - 1].close(); }
  });

  function confirmBox(message, { title = '확인', ok = '확인', cancel = '취소', danger = false } = {}) {
    return new Promise(resolve => {
      let result = false;
      const m = modal({
        title,
        body: `<p class="modal-text">${esc(message)}</p>`,
        actions: [
          { label: cancel, kind: 'ghost' },
          { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => { result = true; } }
        ]
      });
      m.onClose = () => resolve(result);
    });
  }

  /* ---------- 소리 ---------- */
  const Sound = (function () {
    let ctx = null;
    function get() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const unlock = () => { get(); emit('sound:unlock'); };
    ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, unlock, { once: true, passive: true, capture: true }));

    function tone(c, freq, t, dur, { type = 'sine', gain = 0.25, dest } = {}) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest || c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const PATTERNS = {
      chime: { label: '차임벨', period: 2.4, play: (c, t, d) => [659.25, 523.25, 587.33, 392.0].forEach((f, i) => tone(c, f, t + i * 0.42, 1.3, { gain: 0.32, dest: d })) },
      beep: { label: '디지털 삐삐', period: 1.0, play: (c, t, d) => { for (let i = 0; i < 4; i++) tone(c, 1760, t + i * 0.12, 0.08, { type: 'square', gain: 0.1, dest: d }); } },
      bell: { label: '맑은 종', period: 2.8, play: (c, t, d) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.16, 1.8, { type: 'triangle', gain: 0.2, dest: d })) },
      marimba: { label: '마림바', period: 1.8, play: (c, t, d) => [784, 988, 1175, 988, 1568].forEach((f, i) => tone(c, f, t + i * 0.14, 0.35, { gain: 0.28, dest: d })) }
    };
    function ring(kind) {
      const c = get();
      if (!c) return () => {};
      const p = PATTERNS[kind] || PATTERNS.chime;
      const master = c.createGain();
      master.gain.value = 0.9;
      master.connect(c.destination);
      let next = c.currentTime + 0.05;
      const pump = () => { while (next < c.currentTime + 2.5) { p.play(c, next, master); next += p.period; } };
      pump();
      const timer = setInterval(pump, 400);
      return () => {
        clearInterval(timer);
        try { master.gain.setTargetAtTime(0, c.currentTime, 0.04); } catch (e) { /* noop */ }
        setTimeout(() => { try { master.disconnect(); } catch (e) { /* noop */ } }, 500);
      };
    }
    function preview(kind) {
      const c = get();
      if (!c) return;
      const p = PATTERNS[kind] || PATTERNS.chime;
      p.play(c, c.currentTime + 0.03, c.destination);
    }
    return { get, ring, preview, PATTERNS, state: () => (ctx ? ctx.state : 'none') };
  })();

  /* ---------- 알림 ---------- */
  function notify(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(title, { body, tag: 'haru-desk', renotify: true });
      }
    } catch (e) { /* 지원하지 않는 환경 */ }
  }

  /* ---------- 알람이 울릴 때 띄우는 창 ---------- */
  const Ringer = (function () {
    let el = null, stopSound = null, items = [], autoStop = null, titleTimer = null, savedTitle = null;
    function start({ title, sub = '', sound, snooze }) {
      items.push({ title, sub, snooze });
      if (!stopSound) stopSound = Sound.ring(sound || data.prefs.sound);
      try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) { /* noop */ }
      notify(title, sub);
      clearTimeout(autoStop);
      autoStop = setTimeout(silence, 3 * 60 * 1000);
      if (!titleTimer) {
        let on = false;
        savedTitle = document.title;
        titleTimer = setInterval(() => { on = !on; document.title = on ? `● ${title}` : savedTitle; }, 900);
      }
      render();
    }
    function silence() { if (stopSound) { stopSound(); stopSound = null; } }
    function dismiss() {
      silence();
      clearTimeout(autoStop);
      clearInterval(titleTimer);
      titleTimer = null;
      if (savedTitle != null) document.title = savedTitle;
      savedTitle = null;
      items = [];
      if (el) { el.remove(); el = null; }
      emit('ringer:done');
    }
    function render() {
      if (!el) {
        el = document.createElement('div');
        el.className = 'ringer';
        document.body.appendChild(el);
      }
      const c = fmtClock(new Date());
      const canSnooze = items.some(i => i.snooze);
      el.innerHTML = `
        <div class="ringer-card" role="alertdialog" aria-modal="true" aria-label="${esc(items[0].title)}">
          <div class="ringer-pulse">${icon('alarm', 36)}</div>
          <p class="ringer-time"><small>${c.ampm}</small> ${c.hm}</p>
          <ul class="ringer-list">${items.map(i => `<li><strong>${esc(i.title)}</strong>${i.sub ? `<span>${esc(i.sub)}</span>` : ''}</li>`).join('')}</ul>
          <div class="ringer-actions">
            ${canSnooze ? '<button type="button" class="btn" data-snooze>5분 뒤 다시</button>' : ''}
            <button type="button" class="btn primary" data-stop>끄기</button>
          </div>
        </div>`;
      el.querySelector('[data-stop]').addEventListener('click', dismiss);
      const sn = el.querySelector('[data-snooze]');
      if (sn) sn.addEventListener('click', () => { items.forEach(i => i.snooze && i.snooze()); dismiss(); toast('5분 뒤에 다시 울려요'); });
      el.querySelector('[data-stop]').focus();
    }
    return { start, dismiss, active: () => !!el };
  })();

  /* ---------- 라우터 ---------- */
  const views = new Map();
  const order = [];
  let cleanup = null, current = null;
  function register(view) { views.set(view.id, view); order.push(view.id); }
  function route() {
    const id = decodeURIComponent((location.hash || '').replace(/^#/, '')) || 'home';
    const v = views.get(id) || views.get('home');
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    current = v.id;
    const el = document.getElementById('view');
    el.innerHTML = '';
    el.dataset.view = v.id;
    el.className = `view view-${v.id}`;
    try { cleanup = v.render(el) || null; } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="empty"><p>화면을 그리다 문제가 생겼어요.</p><p class="muted">${esc(e.message)}</p></div>`;
    }
    const nav = document.getElementById('nav');
    nav.querySelectorAll('a').forEach(a => {
      const active = a.dataset.id === v.id;
      a.classList.toggle('active', active);
      if (active) {
        a.setAttribute('aria-current', 'page');
        // 휴대폰처럼 메뉴가 가로로 스크롤될 때 지금 화면의 메뉴가 보이게
        if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
      } else a.removeAttribute('aria-current');
    });
    if (!Ringer.active()) document.title = v.id === 'home' ? '하루 책상' : `${v.label} · 하루 책상`;
    window.scrollTo(0, 0);
    emit('route', v.id);
  }
  function go(id) {
    if ((location.hash || '').replace(/^#/, '') === id) route();
    else location.hash = id;
  }

  /* ---------- 테마 ---------- */
  const hostTheme = document.documentElement.getAttribute('data-theme');
  function applyTheme() {
    const root = document.documentElement;
    const t = data.prefs.theme;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--paper').trim() || '#1F1E1D');
  }

  /* 페이지 다른 곳에서 클릭할 때 열린 인라인 메뉴를 닫는 등의 공통 처리는 각 화면에서 */
  return {
    data, save, load, persist, wipeAll, KEYS, DEFAULTS, clone,
    on, emit,
    uid, esc, pad, ymd, parseYmd, today, addDays, diffDays, startOfDay, WD, clamp,
    fmtDate, fmtClock, fmtHM, fmtDur, untilText, relDay, relTime, won, num, debounce,
    lunar, lunarParts,
    icon, toast, modal, confirm: confirmBox,
    Sound, Ringer, notify,
    register, route, go, views, order, current: () => current,
    applyTheme
  };
})();
