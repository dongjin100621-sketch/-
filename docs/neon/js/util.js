'use strict';
const VW = 1280, VH = 800;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
function rng(seed) { // mulberry32 — 같은 지역은 늘 같은 배경
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const FONT = (px, bold) => `${bold ? 'bold ' : ''}${px}px Galmuri11, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ── 스프라이트 ── 좌표는 발 밑 가운데 기준 */
const SPR = {
  img: null, white: {}, red: {},
  load() {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { SPR.img = im; res(); };
      im.onerror = rej;
      im.src = 'img/sprites.png';
    });
  },
  tinted(name, store, color) {
    if (store[name]) return store[name];
    const [x, y, w, h] = ATLAS[name];
    const [c, cx] = makeCanvas(w, h);
    cx.drawImage(SPR.img, x, y, w, h, 0, 0, w, h);
    cx.globalCompositeOperation = 'source-atop';
    cx.fillStyle = color; cx.fillRect(0, 0, w, h);
    return (store[name] = c);
  },
  size(name, sc = 1) { const a = ATLAS[name]; return [a[2] * sc, a[3] * sc]; },
  /* o: sc 배율, f 바라볼 방향(1/-1), alpha, flash(0~1 흰색), tint('red'), sy 세로 늘림, rot */
  draw(ctx, name, x, y, o = {}) {
    const a = ATLAS[name]; if (!a || !SPR.img) return;
    const sc = o.sc || 1, w = a[2] * sc, h = a[3] * sc * (o.sy || 1);
    const flip = (o.f || 1) !== a[4];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (o.rot) ctx.rotate(o.rot);
    if (flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(SPR.img, a[0], a[1], a[2], a[3], -w / 2, -h, w, h);
    if (o.flash > 0) { ctx.globalAlpha *= o.flash; ctx.drawImage(SPR.tinted(name, SPR.white, '#ffffff'), -w / 2, -h, w, h); }
    if (o.tint) { ctx.globalAlpha = (o.alpha ?? 1) * (o.tintA || 0.35); ctx.drawImage(SPR.tinted(name, SPR.red, o.tint), -w / 2, -h, w, h); }
    ctx.restore();
  },
  /* 초상화: 위쪽(얼굴)을 정사각형으로 잘라 그린다 */
  face(ctx, name, x, y, size, round = true) {
    const a = ATLAS[name]; if (!a || !SPR.img) return;
    const s = Math.min(a[2], a[3]);
    ctx.save();
    if (round) { ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip(); }
    ctx.drawImage(SPR.img, a[0] + (a[2] - s) / 2, a[1], s, s, x, y, size, size);
    ctx.restore();
  },
  faceURL: {},
  faceImg(name, size = 96) {
    const k = name + size;
    if (SPR.faceURL[k]) return SPR.faceURL[k];
    const [c, cx] = makeCanvas(size, size);
    SPR.face(cx, name, 0, 0, size, false);
    return (SPR.faceURL[k] = c.toDataURL());
  },
  fullURL: {},
  fullImg(name, maxH = 220) {
    const k = name + maxH;
    if (SPR.fullURL[k]) return SPR.fullURL[k];
    const a = ATLAS[name]; const sc = Math.min(1, maxH / a[3]);
    const [c, cx] = makeCanvas(a[2] * sc, a[3] * sc);
    cx.drawImage(SPR.img, a[0], a[1], a[2], a[3], 0, 0, a[2] * sc, a[3] * sc);
    return (SPR.fullURL[k] = c.toDataURL());
  },
};
