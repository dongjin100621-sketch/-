'use strict';
/* 도트 조각 엔진.
   도형(공·원기둥·다각형·상자)을 칸 단위로 찍으면서 칸마다 「재질」과 「밝기」를 기록하고,
   마지막에 재질별 색 계단(그림자는 푸른 쪽, 빛은 노란 쪽으로 색조를 틂)으로 바꾼다.
   앞에 그린 부품과 맞닿는 칸은 한 단계 어둡게(접촉 그늘), 바깥에는 재질에 맞춘 외곽선을 두른다.
   빛은 왼쪽 위 앞에서 온다. */

const PX = (() => {
  const L = (() => { const v = [-0.5, -0.66, 0.56], n = Math.hypot(...v); return v.map(c => c / n); })();
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

  /* ── 재질 ── */
  const mats = [], byKey = new Map();
  function hueToward(h, target, amt) {
    let d = ((target - h + 540) % 360) - 180;
    return (h + Math.sign(d) * Math.min(Math.abs(d), amt) + 360) % 360;
  }
  function makeRamp(hex, n = 6, o = {}) {
    const [h, s, l] = U.rgbHsl(...U.hexRgb(hex));
    const mid = o.mid ?? Math.round((n - 1) * 0.55);
    const out = [];
    // 채도 대신 「색의 진하기(chroma)」를 유지해야 흰색 계열이 그늘에서 새파래지지 않는다
    const chroma = s * (1 - Math.abs(2 * l - 1));
    const sOf = (c, ll) => { const d = 1 - Math.abs(2 * ll - 1); return d < 0.01 ? 0 : U.clamp(c / d, 0, 1); };
    for (let i = 0; i < n; i++) {
      let hh = h, ss = s, ll = l;
      if (i < mid) {
        const k = (mid - i) / mid;
        hh = hueToward(h, o.sh ?? 252, k * (o.hs ?? 26));
        ll = l * (1 - k * (o.dk ?? 0.66));
        ss = sOf(chroma * (1 + 0.1 * k) + 0.05 * k, ll);
      } else if (i > mid) {
        const k = (i - mid) / (n - 1 - mid);
        hh = hueToward(h, o.lh ?? 52, k * (o.hl ?? 16));
        ll = l + (0.96 - l) * k * (o.lt ?? 0.6);
        ss = sOf(chroma * (1 - k * 0.3), ll);
      }
      out.push(U.hslRgb(hh, ss, ll));
    }
    return out;
  }
  /* mat('#hex', {gloss, emit, alpha, n, dither ...}) → 번호 */
  function mat(spec, o = {}) {
    if (typeof spec === 'number') return spec;
    if (spec && typeof spec === 'object' && spec.id !== undefined) return spec.id;
    const key = spec + '|' + JSON.stringify(o);
    if (byKey.has(key)) return byKey.get(key);
    const n = o.n || 6;
    const m = {
      id: mats.length, ramp: makeRamp(spec, n, o), n,
      gloss: !!o.gloss, emit: !!o.emit, alpha: o.alpha ?? 1, dither: o.dither ?? 0.32,
      noAO: !!o.noAO, flat: !!o.flat, outA: o.outA ?? 1
    };
    if (o.gloss) m.spec = U.mix(m.ramp[n - 1], [255, 255, 255], 0.65);
    if (o.flat) m.ramp = Array(n).fill(U.hexRgb(spec));
    mats.push(m); byKey.set(key, m.id);
    return m.id;
  }
  const shadeOf = (nx, ny, nz, amb) => amb + (1 - amb) * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);

  /* ── 조각 판 ── */
  class Spr {
    constructor(w, h) {
      this.w = w; this.h = h;
      const n = w * h;
      this.M = new Int16Array(n).fill(-1);
      this.S = new Float32Array(n);
      this.P = new Int16Array(n).fill(-1);
      this.part = 0; this.clip = null;
    }
    np() { this.part++; return this; }
    set(x, y, m, s) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      if (this.clip && !this.clip(x, y)) return;
      const i = y * this.w + x;
      this.M[i] = m; this.S[i] = s; this.P[i] = this.part;
    }
    get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? -1 : this.M[y * this.w + x]; }
    erase(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.M[y * this.w + x] = -1; }
    /* 이미 칠한 칸의 밝기만 바꾼다 */
    tint(x, y, d) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) { const i = y * this.w + x; if (this.M[i] >= 0) this.S[i] = U.clamp(this.S[i] + d, 0, 1); } }

    /* 타원체: 구처럼 명암 */
    ball(cx, cy, rx, ry, spec, o = {}) {
      const m = mat(spec, o.m), amb = o.amb ?? 0.2, b = o.bias ?? 0, tex = o.tex;
      const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1), y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        if (o.half === 'top' && y + 0.5 > cy) continue;
        if (o.half === 'bottom' && y + 0.5 < cy) continue;
        const nz = Math.sqrt(1 - d2);
        let s = o.flatS ?? shadeOf(dx * (o.nk ?? 1), dy * (o.nk ?? 1), nz, amb) + b;
        if (tex) s += tex(x, y, dx, dy);
        this.set(x, y, m, U.clamp(s, 0, 1));
      }
      return this;
    }
    /* 원뿔대(팔다리·꼬리): 굵기 r0→r1, 원통 명암 */
    cyl(ax, ay, bx, by, r0, r1, spec, o = {}) {
      const m = mat(spec, o.m), amb = o.amb ?? 0.2, b = o.bias ?? 0, tex = o.tex;
      const r = Math.max(r0, r1);
      const x0 = Math.floor(Math.min(ax, bx) - r - 1), x1 = Math.ceil(Math.max(ax, bx) + r + 1);
      const y0 = Math.floor(Math.min(ay, by) - r - 1), y1 = Math.ceil(Math.max(ay, by) + r + 1);
      const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy || 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const t = U.clamp(((px - ax) * vx + (py - ay) * vy) / vv, 0, 1);
        const cx = ax + vx * t, cy = ay + vy * t, rr = r0 + (r1 - r0) * t;
        const ox = px - cx, oy = py - cy, d = Math.hypot(ox, oy);
        if (d > rr + 0.01 || rr <= 0) continue;
        const nx = ox / rr, ny = oy / rr, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let s = o.flatS ?? shadeOf(nx, ny, nz, amb) + b;
        if (tex) s += tex(x, y, t);
        this.set(x, y, m, U.clamp(s, 0, 1));
      }
      return this;
    }
    /* 점들을 잇는 굵은 선(꼬리·덩굴) */
    chain(pts, r0, r1, spec, o = {}) {
      const n = pts.length - 1;
      for (let i = 0; i < n; i++) this.cyl(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], U.lerp(r0, r1, i / n), U.lerp(r0, r1, (i + 1) / n), spec, o);
      return this;
    }
    /* 다각형: 밝기는 수 또는 (x,y)=>수 */
    poly(pts, spec, shade = 0.55, o = {}) {
      const m = mat(spec, o.m);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (!inside) continue;
        const s = typeof shade === 'function' ? shade(x, y) : shade;
        this.set(x, y, m, U.clamp(s, 0, 1));
      }
      return this;
    }
    rect(x, y, w, h, spec, shade = 0.55, o = {}) {
      const m = mat(spec, o.m);
      for (let j = Math.floor(y); j < Math.floor(y + h); j++) for (let i = Math.floor(x); i < Math.floor(x + w); i++) {
        const s = typeof shade === 'function' ? shade(i, j) : shade;
        this.set(i, j, m, U.clamp(s, 0, 1));
      }
      return this;
    }
    /* 모서리를 깎은 상자: 위·왼쪽 테두리는 밝게, 아래·오른쪽은 어둡게 */
    box(x, y, w, h, spec, o = {}) {
      const bv = o.bevel ?? 1, base = o.base ?? 0.55, r = o.round ?? 0;
      return this.rect(x, y, w, h, spec, (i, j) => {
        const lx = i - x, ly = j - y, rx2 = x + w - 1 - i, ry2 = y + h - 1 - j;
        if (r) {
          const cx = Math.min(lx, rx2), cy = Math.min(ly, ry2);
          if (cx < r && cy < r && (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > r * r) return -1;
        }
        let s = base + (o.grad ? -o.grad * (ly / h - 0.5) : 0);
        if (ly < bv || lx < bv) s += 0.25;
        if (ry2 < bv || rx2 < bv) s -= 0.22;
        if (o.tex) s += o.tex(i, j);
        return s;
      }, o);
    }
    line(ax, ay, bx, by, spec, shade = 0.5, o = {}) {
      const m = mat(spec, o.m);
      let x = Math.round(ax), y = Math.round(ay); const x2 = Math.round(bx), y2 = Math.round(by);
      const dx = Math.abs(x2 - x), dy = -Math.abs(y2 - y), sx = x < x2 ? 1 : -1, sy = y < y2 ? 1 : -1;
      let err = dx + dy;
      for (let k = 0; k < 400; k++) {
        this.set(x, y, m, shade);
        if (x === x2 && y === y2) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
      return this;
    }
    px(x, y, spec, shade = 0.5, o = {}) { this.set(x, y, mat(spec, o.m), shade); return this; }
    /* 별 모양 */
    star(cx, cy, r0, r1, n, rot, spec, o = {}) {
      const pts = [];
      for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r1 : r0; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      return this.poly(pts, spec, o.shade ?? ((x, y) => 0.55 - ((x - cx) * 0.6 + (y - cy)) / (r0 * 3)), o);
    }
    /* 가장자리에서 d칸 안쪽까지를 밝게/어둡게 (빛 방향 기준) */
    rim(amount = 0.18) {
      const { w, h, M, S } = this;
      const out = new Float32Array(S);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (M[i] < 0) continue;
        if (this.get(x - 1, y) < 0 || this.get(x, y - 1) < 0) out[i] = Math.min(1, S[i] + amount);
      }
      this.S = out; return this;
    }

    /* 색으로 굽기 */
    render(o = {}) {
      const { w, h, M, S, P } = this;
      const [c, x] = U.canvas(w, h);
      const img = x.createImageData(w, h), d = img.data;
      const idx = new Int8Array(w * h);
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
        const i = y * w + xx, m = M[i];
        if (m < 0) continue;
        const mt = mats[m];
        let v = S[i] * (mt.n - 1) + BAYER[(y & 3) * 4 + (xx & 3)] * mt.dither;
        let k = Math.round(v);
        if (!mt.noAO && o.ao !== false) {
          const p = P[i];
          let front = 0;
          if (xx > 0 && M[i - 1] >= 0 && P[i - 1] > p && M[i - 1] !== m) front++;
          if (y > 0 && M[i - w] >= 0 && P[i - w] > p && M[i - w] !== m) front += 2;
          if (xx < w - 1 && M[i + 1] >= 0 && P[i + 1] > p && M[i + 1] !== m) front++;
          if (front) k -= 1;
        }
        idx[i] = U.clamp(k, 0, mt.n - 1);
      }
      for (let i = 0; i < w * h; i++) {
        const m = M[i]; if (m < 0) continue;
        const mt = mats[m];
        let col = mt.ramp[idx[i]];
        if (mt.gloss && S[i] > 0.93) col = mt.spec;
        d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = mt.alpha * 255;
      }
      if (o.outline !== false) {
        const oc = o.outline ? U.hexRgb(o.outline) : null;
        for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
          const i = y * w + xx;
          if (M[i] >= 0) continue;
          let nb = -1, lit = false;
          if (y < h - 1 && M[i + w] >= 0) { nb = M[i + w]; lit = true; }
          else if (xx < w - 1 && M[i + 1] >= 0) { nb = M[i + 1]; lit = true; }
          else if (y > 0 && M[i - w] >= 0) nb = M[i - w];
          else if (xx > 0 && M[i - 1] >= 0) nb = M[i - 1];
          if (nb < 0 && o.diag) {
            for (const j of [i - w - 1, i - w + 1, i + w - 1, i + w + 1]) if (j >= 0 && j < w * h && M[j] >= 0) { nb = M[j]; break; }
          }
          if (nb < 0) continue;
          const mt = mats[nb];
          if (mt.outA <= 0) continue;
          let col = oc || U.mix(mt.ramp[0], [12, 8, 22], lit && o.selout !== false ? 0.45 : 0.72);
          d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255 * mt.outA * (mt.alpha < 1 ? Math.max(0.5, mt.alpha) : 1);
        }
      }
      x.putImageData(img, 0, 0);
      return c;
    }
  }

  /* ── 보조 ── */
  const cacheMap = new Map();
  function cache(key, fn) { if (!cacheMap.has(key)) cacheMap.set(key, fn()); return cacheMap.get(key); }

  /* 빛 무리(가산 합성용): 계단식 원으로 도트 느낌을 살린다 */
  function glow(r, rgb, steps = 5, soft = false) {
    return cache('glow' + r + rgb + steps + soft, () => {
      const s = Math.ceil(r) * 2 + 2, [c, x] = U.canvas(s, s);
      const cc = s / 2;
      if (soft) {
        const g = x.createRadialGradient(cc, cc, 0, cc, cc, r);
        g.addColorStop(0, U.rgba(rgb, 1)); g.addColorStop(0.4, U.rgba(rgb, 0.45)); g.addColorStop(1, U.rgba(rgb, 0));
        x.fillStyle = g; x.fillRect(0, 0, s, s);
        return c;
      }
      const img = x.createImageData(s, s), d = img.data;
      for (let y = 0; y < s; y++) for (let xx = 0; xx < s; xx++) {
        const dd = Math.hypot(xx + 0.5 - cc, y + 0.5 - cc) / r;
        if (dd >= 1) continue;
        const k = Math.ceil((1 - dd) * steps) / steps;
        const a = Math.pow(k, 1.6);
        const i = (y * s + xx) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = a * 255;
      }
      x.putImageData(img, 0, 0);
      return c;
    });
  }
  /* 실루엣 단색(피격 번쩍임·그림자용) */
  function silhouette(src, rgb, a = 1) {
    const [c, x] = U.canvas(src.width, src.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = U.rgba(rgb, a); x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function scaled(src, k) {
    const [c, x] = U.canvas(src.width * k, src.height * k);
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  return { Spr, mat, mats, cache, glow, silhouette, scaled, makeRamp, BAYER, L };
})();
