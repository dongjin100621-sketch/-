'use strict';
/* 쓰기 연습판: 빨간 십자 점선 칸(田字格) 위에 흐린 본보기 글자를 깔고 손가락이나 펜으로 따라 쓴다.
   Pointer Events 를 쓰므로 사파리(아이폰·아이패드의 Apple Pencil 포함)에서 그대로 동작한다. */
class WritePad {
  constructor(canvas, onChange) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange || (() => {});
    this.strokes = [];
    this.cur = null;
    this.char = '';
    this.guide = true;
    this.size = 0;
    this.dpr = 1;
    this._down = (e) => this.down(e);
    this._move = (e) => this.move(e);
    this._up = (e) => this.up(e);
    canvas.addEventListener('pointerdown', this._down);
    canvas.addEventListener('pointermove', this._move);
    canvas.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointercancel', this._up);
    canvas.addEventListener('lostpointercapture', this._up);
    // iOS 사파리에서 그리는 동안 화면이 움직이지 않게
    this._touch = (e) => e.preventDefault();
    canvas.addEventListener('touchstart', this._touch, { passive: false });
    canvas.addEventListener('touchmove', this._touch, { passive: false });
    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    if (window.ResizeObserver) { this.ro = new ResizeObserver(this._resize); this.ro.observe(canvas); }
    this.resize();
  }
  destroy() {
    window.removeEventListener('resize', this._resize);
    if (this.ro) this.ro.disconnect();
  }
  colors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      grid: cs.getPropertyValue('--grid-line').trim() || 'rgba(179,54,44,.38)',
      guide: cs.getPropertyValue('--guide').trim() || 'rgba(0,0,0,.12)',
      ink: cs.getPropertyValue('--ink').trim() || '#1e1a15',
      font: cs.getPropertyValue('--font-han').trim() || 'serif'
    };
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    const size = Math.round(r.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (!size || (size === this.size && dpr === this.dpr)) return;
    // 크기가 바뀌면 이미 그은 획도 비율에 맞춰 옮긴다
    if (this.size) {
      const k = size / this.size;
      this.strokes.forEach((s) => s.forEach((p) => { p.x *= k; p.y *= k; }));
    }
    this.size = size; this.dpr = dpr;
    this.cv.width = size * dpr; this.cv.height = size * dpr;
    this.draw();
  }
  setChar(c) { this.char = c; this.strokes = []; this.draw(); this.onChange(0); }
  setGuide(on) { this.guide = on; this.draw(); }
  clear() { this.strokes = []; this.draw(); this.onChange(0); }
  undo() { this.strokes.pop(); this.draw(); this.onChange(this.strokes.length); }
  pos(e) {
    const r = this.cv.getBoundingClientRect();
    const p = e.pressure && e.pointerType === 'pen' ? e.pressure : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, p };
  }
  down(e) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    try { this.cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    this.cur = [this.pos(e)];
    this.strokes.push(this.cur);
    this.draw();
  }
  move(e) {
    if (!this.cur) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) this.cur.push(this.pos(ev));
    this.draw();
  }
  up() {
    if (!this.cur) return;
    if (this.cur.length === 1) { const p = this.cur[0]; this.cur.push({ x: p.x + 0.1, y: p.y + 0.1, p: p.p }); }
    this.cur = null;
    this.draw();
    this.onChange(this.strokes.length);
  }
  draw() {
    const { ctx, size, dpr } = this;
    if (!size) return;
    const c = this.colors();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // 田字格: 가운데 십자와 대각선 점선
    ctx.save();
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
    ctx.stroke();
    ctx.globalAlpha = 0.45; ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(size, size);
    ctx.moveTo(size, 0); ctx.lineTo(0, size);
    ctx.stroke();
    ctx.restore();
    // 본보기 글자
    if (this.guide && this.char) {
      ctx.save();
      ctx.fillStyle = c.guide;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `500 ${Math.round(size * 0.8)}px ${c.font}`;
      ctx.fillText(this.char, size / 2, size * 0.53);
      ctx.restore();
    }
    // 먹으로 그은 획
    const base = Math.max(5, size / 30);
    ctx.save();
    ctx.strokeStyle = c.ink; ctx.fillStyle = c.ink;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of this.strokes) {
      if (s.length < 2) continue;
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1], b = s[i];
        const m = i < s.length - 1 ? { x: (b.x + s[i + 1].x) / 2, y: (b.y + s[i + 1].y) / 2 } : b;
        const am = i > 1 ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
        ctx.lineWidth = base * (0.65 + b.p * 0.7);
        ctx.beginPath();
        ctx.moveTo(am.x, am.y);
        ctx.quadraticCurveTo(b.x, b.y, m.x, m.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
