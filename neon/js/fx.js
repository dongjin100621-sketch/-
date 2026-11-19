'use strict';
/* 효과: 입자, 피해 숫자, 베기 궤적, 폭발 고리, 광선, 화면 흔들림 */
const FX = {
  parts: [], texts: [], slashes: [], rings: [], beams: [], shakeT: 0, shakeA: 0, flashT: 0, flashC: '#fff', stop: 0,
  reset() { this.parts = []; this.texts = []; this.slashes = []; this.rings = []; this.beams = []; this.shakeT = 0; this.flashT = 0; },
  burst(x, y, c, n = 10, sp = 300, life = 0.5, size = 4, grav = 600) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life, max: life, c, s: size * (0.6 + Math.random() * 0.7), g: grav });
    }
  },
  spark(x, y, c, dir, n = 6) {
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: dir * rand(200, 700), vy: rand(-300, 100), life: 0.35, max: 0.35, c, s: rand(2, 5), g: 900 });
  },
  text(x, y, txt, c = '#fff', big = false) { this.texts.push({ x: x + rand(-14, 14), y, txt, c, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big }); },
  slash(x, y, f, r, c, w = 26, life = 0.18, a0 = -1.1, a1 = 1.0) { this.slashes.push({ x, y, f, r, c, w, life, max: life, a0, a1 }); },
  ring(x, y, r1, c, life = 0.4, w = 6) { this.rings.push({ x, y, r1, c, life, max: life, w }); },
  beam(x1, y1, x2, y2, c, w = 4, life = 0.12) { this.beams.push({ x1, y1, x2, y2, c, w, life, max: life }); },
  shake(a, t = 0.25) { if (G.opt.shake === false) return; this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); },
  flash(c = '#fff', t = 0.15) { this.flashC = c; this.flashT = t; },
  update(dt) {
    for (const p of this.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > GROUND + 30) { p.y = GROUND + 30; p.vy *= -0.3; p.vx *= 0.6; } }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= (t.big ? 50 : 70) * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const arr of [this.slashes, this.rings, this.beams]) for (const s of arr) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
    this.rings = this.rings.filter((s) => s.life > 0);
    this.beams = this.beams.filter((s) => s.life > 0);
    if (this.shakeT > 0) this.shakeT -= dt; else this.shakeA = 0;
    if (this.flashT > 0) this.flashT -= dt;
  },
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.slashes) {
      const k = s.life / s.max;
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.f, 1);
      ctx.strokeStyle = hexA(s.c, k); ctx.lineWidth = s.w * k + 2; ctx.lineCap = 'round';
      ctx.shadowColor = s.c; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, s.r, s.a0, s.a1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = Math.max(1, s.w * k * 0.3);
      ctx.beginPath(); ctx.arc(0, 0, s.r, s.a0 + 0.15, s.a1 - 0.1); ctx.stroke();
      ctx.restore();
    }
    for (const r of this.rings) {
      const k = r.life / r.max, rad = r.r1 * (1 - k * k);
      ctx.strokeStyle = hexA(r.c, k); ctx.lineWidth = r.w * k + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, rad), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hexA(r.c, k * 0.15); ctx.fill();
    }
    for (const b of this.beams) {
      const k = b.life / b.max;
      ctx.strokeStyle = hexA(b.c, k); ctx.lineWidth = b.w * (0.5 + k); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k * 0.9})`; ctx.lineWidth = Math.max(1, b.w * 0.35);
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    for (const p of this.parts) {
      ctx.fillStyle = hexA(p.c, Math.min(1, p.life / p.max * 1.5));
      const s = Math.max(2, Math.round(p.s / 2) * 2);
      ctx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, s, s);
    }
    ctx.restore();
  },
  drawTexts(ctx) {
    ctx.save(); ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.max, sc = t.big ? 1 + (1 - k) * 0.2 : 1;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = FONT(t.big ? 30 : 20, true);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(5,2,12,0.9)';
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(sc, sc);
      ctx.strokeText(t.txt, 0, 0); ctx.fillStyle = t.c; ctx.fillText(t.txt, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  },
};
