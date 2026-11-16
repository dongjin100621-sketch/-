'use strict';
/* 연출: 입자, 떠오르는 숫자, 화면 흔들림·멈칫·번쩍임, 도트 숫자 글꼴 */

const FX = (() => {
  const P = [];          // 입자
  const NUM = [];        // 숫자
  const FXS = [];        // 큰 연출(베기 궤적, 번개, 고리 등)
  let shake = 0, shakeX = 0, shakeY = 0, stop = 0, flashA = 0, flashC = [255, 255, 255];
  const opt = { shake: 1, nums: true };

  function part(x, y, o) {
    if (P.length > 900) P.shift();
    P.push({ x, y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.5, max: o.life || 0.5, s: o.s || 2, c: o.c || [255, 255, 255],
      g: o.g || 0, fr: o.fr ?? 0.9, glow: !!o.glow, k: o.k || 'sq', z: o.z || 0, vz: o.vz || 0, shrink: o.shrink ?? true });
  }
  function burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (o.a ?? 0) + (o.spread ?? U.TAU) * (Math.random() - 0.5), sp = (o.sp ?? 120) * (0.4 + Math.random() * 0.8);
      part(x + (Math.random() - 0.5) * (o.jit || 4), y + (Math.random() - 0.5) * (o.jit || 4), {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life ?? 0.45) * (0.6 + Math.random() * 0.7), s: o.s ?? (1 + Math.round(Math.random() * 2)),
        c: Array.isArray(o.c?.[0]) ? o.c[Math.floor(Math.random() * o.c.length)] : (o.c || [255, 255, 255]), g: o.g ?? 0, fr: o.fr ?? 0.88, glow: o.glow, k: o.k, vz: o.vz ? o.vz * (0.6 + Math.random() * 0.8) : 0
      });
    }
  }
  function ring(x, y, r0, r1, dur, c, w = 2) { FXS.push({ k: 'ring', x, y, r0, r1, t: 0, dur, c, w }); }
  function slash(x, y, ang, r, arc, c, dur = 0.16, w = 10) { FXS.push({ k: 'slash', x, y, ang, r, arc, c, t: 0, dur, w }); }
  function bolt(pts, c = [200, 230, 255], dur = 0.18) { FXS.push({ k: 'bolt', pts, c, t: 0, dur }); }
  function spawnMark(x, y, dur, c) { FXS.push({ k: 'spawn', x, y, t: 0, dur, c }); }
  function num(x, y, v, kind = 'w') {
    if (!opt.nums && kind !== 'r' && kind !== 'g') return;
    NUM.push({ x: x + (Math.random() - 0.5) * 8, y, v: String(v), kind, t: 0, vy: -70 - Math.random() * 20, vx: (Math.random() - 0.5) * 30 });
    if (NUM.length > 80) NUM.shift();
  }
  function addShake(a) { shake = Math.min(14, Math.max(shake, a * opt.shake)); }
  function hitStop(t) { stop = Math.max(stop, t); }
  function flash(c, a) { flashC = c; flashA = Math.max(flashA, a); }

  function update(dt) {
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P.splice(i, 1); continue; }
      p.vx *= Math.pow(p.fr, dt * 60); p.vy *= Math.pow(p.fr, dt * 60);
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vz) { p.z += p.vz * dt; p.vz -= 400 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.4; if (Math.abs(p.vz) < 30) p.vz = 0; } }
    }
    for (let i = NUM.length - 1; i >= 0; i--) {
      const n = NUM[i]; n.t += dt; n.y += n.vy * dt; n.x += n.vx * dt; n.vy += 160 * dt;
      if (n.t > 0.8) NUM.splice(i, 1);
    }
    for (let i = FXS.length - 1; i >= 0; i--) { FXS[i].t += dt; if (FXS[i].t >= FXS[i].dur) FXS.splice(i, 1); }
    shake = Math.max(0, shake - dt * 30);
    shakeX = (Math.random() - 0.5) * shake; shakeY = (Math.random() - 0.5) * shake;
    flashA = Math.max(0, flashA - dt * 3);
  }
  function tickStop(dt) { if (stop > 0) { stop -= dt; return true; } return false; }

  function drawParts(x, glowPass) {
    for (const p of P) {
      if (p.glow !== glowPass) continue;
      const k = p.life / p.max, s = p.shrink ? Math.max(1, Math.round(p.s * (0.4 + 0.6 * k))) : p.s;
      x.globalAlpha = glowPass ? Math.min(1, k * 1.3) : Math.min(1, k * 2);
      x.fillStyle = `rgb(${p.c[0]},${p.c[1]},${p.c[2]})`;
      if (p.k === 'spark') {
        const len = Math.hypot(p.vx, p.vy) * 0.03 + 1;
        const a = Math.atan2(p.vy, p.vx);
        x.save(); x.translate(Math.round(p.x), Math.round(p.y)); x.rotate(a); x.fillRect(-len, -s / 2, len * 2, s); x.restore();
      } else if (p.k === 'smoke') {
        const r = p.s * (1.6 - k);
        x.globalAlpha = k * 0.35; x.beginPath(); x.arc(p.x, p.y, r, 0, U.TAU); x.fill();
      } else x.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2 - p.z), s, s);
    }
    x.globalAlpha = 1;
  }
  function drawFx(x) {
    for (const f of FXS) {
      const k = f.t / f.dur;
      if (f.k === 'ring') {
        const r = f.r0 + (f.r1 - f.r0) * U.easeOut(k);
        x.strokeStyle = U.rgba(f.c, 1 - k); x.lineWidth = Math.max(1, f.w * (1 - k * 0.5));
        x.beginPath(); x.arc(f.x, f.y, r, 0, U.TAU); x.stroke();
      } else if (f.k === 'slash') {
        const a0 = f.ang - f.arc / 2, a1 = f.ang + f.arc / 2, sweep = U.easeOut(Math.min(1, k * 1.8));
        const end = a0 + (a1 - a0) * sweep, st = a0 + (a1 - a0) * Math.max(0, (k - 0.3) / 0.7);
        if (end > st) {
          x.fillStyle = U.rgba(f.c, 0.9 * (1 - k));
          x.beginPath(); x.arc(f.x, f.y, f.r, st, end); x.arc(f.x, f.y, f.r - f.w * (1 - k * 0.6), end, st, true); x.closePath(); x.fill();
          x.fillStyle = U.rgba([255, 255, 255], 0.85 * (1 - k));
          x.beginPath(); x.arc(f.x, f.y, f.r, st, end); x.arc(f.x, f.y, f.r - 3, end, st, true); x.closePath(); x.fill();
        }
      } else if (f.k === 'bolt') {
        x.strokeStyle = U.rgba(f.c, 1 - k); x.lineWidth = 3;
        x.beginPath(); f.pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke();
        x.strokeStyle = U.rgba([255, 255, 255], 1 - k); x.lineWidth = 1; x.stroke();
      } else if (f.k === 'spawn') {
        const r = 6 + 14 * k;
        x.strokeStyle = U.rgba(f.c, 0.4 + 0.6 * k); x.lineWidth = 2;
        x.beginPath(); x.ellipse(f.x, f.y, r * 1.3, r * 0.6, 0, 0, U.TAU); x.stroke();
        x.fillStyle = U.rgba(f.c, 0.25 * k); x.fill();
        for (let i = 0; i < 4; i++) { const a = k * 6 + i * Math.PI / 2; x.fillStyle = U.rgba(f.c, 1); x.fillRect(Math.round(f.x + Math.cos(a) * r * 1.3) - 1, Math.round(f.y + Math.sin(a) * r * 0.6 - 10 * k) - 1, 2, 2); }
      }
    }
  }

  /* ── 도트 숫자(3×5 글자를 키워 그림) ── */
  const GLY = {
    0: '###,#.#,#.#,#.#,###', 1: '.#.,##.,.#.,.#.,###', 2: '###,..#,###,#..,###', 3: '###,..#,.##,..#,###', 4: '#.#,#.#,###,..#,..#',
    5: '###,#..,###,..#,###', 6: '###,#..,###,#.#,###', 7: '###,..#,.#.,.#.,.#.', 8: '###,#.#,###,#.#,###', 9: '###,#.#,###,..#,###',
    '+': '...,.#.,###,.#.,...', '!': '.#.,.#.,.#.,...,.#.', '-': '...,...,###,...,...', 'G': '.##,#..,#.#,#.#,.##', 'x': '...,#.#,.#.,#.#,...'
  };
  const glyphCache = new Map();
  const COL = { w: [255, 255, 255], y: [255, 220, 80], r: [255, 80, 90], g: [110, 255, 140], c: [255, 200, 60], b: [140, 200, 255], p: [210, 150, 255] };
  function glyph(ch, kind, k) {
    const key = ch + kind + k;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const rows = (GLY[ch] || GLY['-']).split(','), w = 3 * k + 2, h = 5 * k + 2;
    const [c, x] = U.canvas(w, h);
    const col = COL[kind] || COL.w, dark = U.mix(col, [20, 8, 30], 0.82);
    x.fillStyle = U.rgba(dark, 1);
    rows.forEach((r, j) => [...r].forEach((v, i) => { if (v === '#') x.fillRect(i * k, j * k, k + 2, k + 2); }));
    rows.forEach((r, j) => [...r].forEach((v, i) => { if (v === '#') { x.fillStyle = U.rgba(col, 1); x.fillRect(i * k + 1, j * k + 1, k, k); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i * k + 1, j * k + 1, k, 1); } }));
    glyphCache.set(key, c);
    return c;
  }
  function text(x, s, px, py, kind = 'w', k = 2, align = 'center') {
    s = String(s);
    const cw = 3 * k + 1, w = s.length * cw;
    let ox = align === 'center' ? Math.round(px - w / 2) : align === 'right' ? Math.round(px - w) : Math.round(px);
    for (const ch of s) { x.drawImage(glyph(ch, kind, k), ox, Math.round(py)); ox += cw; }
  }
  function drawNums(x) {
    for (const n of NUM) {
      const big = n.kind === 'y' ? 3 : 2;
      x.globalAlpha = n.t > 0.55 ? 1 - (n.t - 0.55) / 0.25 : 1;
      const pop = n.t < 0.08 ? 1 + (0.08 - n.t) * 6 : 1;
      text(x, n.v, n.x, n.y - 6 * pop, n.kind, Math.round(big * pop) || big);
    }
    x.globalAlpha = 1;
  }

  function clear() { P.length = 0; NUM.length = 0; FXS.length = 0; shake = 0; flashA = 0; }

  return { part, burst, ring, slash, bolt, spawnMark, num, addShake, hitStop, flash, update, tickStop, drawParts, drawFx, drawNums, text, clear, opt,
    get shakeX() { return shakeX; }, get shakeY() { return shakeY; }, get flashA() { return flashA; }, get flashC() { return flashC; }, P };
})();
