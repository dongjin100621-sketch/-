'use strict';
/* 계층별 타일·벽·장애물·장식·위험 지형 그림과, 한 층을 미리 그려 두는 일.
   바닥은 한 장의 큰 그림으로, 벽과 장애물은 줄(행)마다 따로 구워 사람·몬스터와 앞뒤 순서를 맞춘다. */

const TILES = (() => {
  const T = 32, WH = 22;              // 칸 크기, 벽 앞면 높이

  /* 픽셀 붓 */
  class Img {
    constructor(w, h) { [this.c, this.x] = U.canvas(w, h); this.w = w; this.h = h; this.img = this.x.createImageData(w, h); this.d = this.img.data; }
    set(x, y, c, a = 1) {
      x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4, d = this.d;
      if (a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
      else { const b = 1 - a; d[i] = d[i] * b + c[0] * a; d[i + 1] = d[i + 1] * b + c[1] * a; d[i + 2] = d[i + 2] * b + c[2] * a; d[i + 3] = Math.max(d[i + 3], a * 255); }
    }
    clear(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[(y * this.w + x) * 4 + 3] = 0; }
    done() { this.x.putImageData(this.img, 0, 0); return this.c; }
  }
  const B = PX.BAYER;
  const pick = (ramp, v, x, y, dz = 0.5) => ramp[U.clamp(Math.round(v + B[(y & 3) * 4 + (x & 3)] * dz), 0, ramp.length - 1)];

  /* ───────── 계층 그림 설정 ───────── */
  const THEMES = [
    { id: 'garden', slab: '#8c9078', soft: '#4f8a3a', softName: 'grass', grout: '#3a4232', wallTop: '#4e7a36', wallFace: '#7c8070', faceStyle: 'stone', vine: '#3f7a2e',
      hazard: 'thorn', pit: '#1a140e', bg: '#0b140e', dark: 0.38, tint: [255, 236, 190], amb: [40, 70, 50], softRatio: 0.42, light: [255, 220, 140] },
    { id: 'desert', slab: '#c9a066', soft: '#e0bc78', softName: 'sand', grout: '#7a5a32', wallTop: '#d8b47a', wallFace: '#b88a52', faceStyle: 'block', trim: '#e0a838',
      hazard: 'quicksand', pit: '#1c1208', bg: '#160e06', dark: 0.24, tint: [255, 226, 170], amb: [90, 60, 30], softRatio: 0.35, light: [255, 190, 100] },
    { id: 'ice', slab: '#9fc4e4', soft: '#e8f2fc', softName: 'snow', grout: '#5a7aa0', wallTop: '#e8f4ff', wallFace: '#7ab4e0', faceStyle: 'ice',
      hazard: 'blackice', pit: '#060c18', bg: '#070e1a', dark: 0.36, tint: [200, 230, 255], amb: [40, 60, 100], softRatio: 0.38, light: [140, 220, 255] },
    { id: 'forge', slab: '#5a4a48', soft: '#46363a', softName: 'ash', grout: '#1c1618', wallTop: '#46424e', wallFace: '#4a3a3a', faceStyle: 'iron', trim: '#ff7a2a',
      hazard: 'lava', pit: '#0c0606', bg: '#0e0606', dark: 0.42, tint: [255, 170, 110], amb: [70, 30, 20], softRatio: 0.3, light: [255, 140, 60] },
    { id: 'void', slab: '#3a3258', soft: '#2a2440', softName: 'dust', grout: '#120e20', wallTop: '#3e3260', wallFace: '#2c2448', faceStyle: 'obsidian', trim: '#c070ff',
      hazard: 'rift', pit: null, bg: '#05030c', dark: 0.46, tint: [210, 170, 255], amb: [50, 30, 90], softRatio: 0.3, light: [190, 120, 255] }
  ];

  /* ───────── 바닥 타일 ───────── */
  const SLABS = [[[0, 0, 32, 32]], [[0, 0, 32, 16], [0, 16, 32, 16]], [[0, 0, 16, 32], [16, 0, 16, 32]], [[0, 0, 16, 16], [16, 0, 16, 16], [0, 16, 16, 16], [16, 16, 16, 16]],
    [[0, 0, 20, 32], [20, 0, 12, 16], [20, 16, 12, 16]], [[0, 0, 32, 12], [0, 12, 16, 20], [16, 12, 16, 20]], [[0, 0, 12, 20], [12, 0, 20, 20], [0, 20, 32, 12]]];

  function slabTile(th, v) {
    const R = U.rng(1000 + v * 77 + th.id.length * 13), img = new Img(T, T);
    const rp = PX.makeRamp(th.slab, 8, { dk: 0.6 }), gr = U.mix(U.hexRgb(th.grout), rp[2], 0.45);
    const L = SLABS[[0, 1, 2, 0, 4, 1, 5, 6][v % 8]];
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) img.set(x, y, gr);
    for (const [sx, sy, sw, sh] of L) {
      const base = R.range(-0.6, 0.6), seed = R.int(0, 9999);
      for (let y = sy + 1; y < sy + sh - 1 + (sy + sh === 32 ? 1 : 0); y++) for (let x = sx + 1; x < sx + sw - 1 + (sx + sw === 32 ? 1 : 0); x++) {
        const lx = x - sx, ly = y - sy;
        let vv = 3.6 + base * 0.7 + (U.fbm(x + v * 40, y, 6, seed, 2) - 0.5) * 1.5;
        if (ly === 1 || lx === 1) vv += 0.8;
        if (ly >= sh - 2 || lx >= sw - 2) vv -= 0.7;
        if (th.id === 'void' && U.hash2(x, y, seed) > 0.985) { img.set(x, y, [230, 210, 255]); continue; }
        img.set(x, y, pick(rp, vv, x, y));
      }
      // 금
      if (R.chance(0.45)) {
        let cx = sx + R.int(3, sw - 4), cy = sy + R.int(3, sh - 4);
        for (let k = 0; k < R.int(4, 10); k++) {
          img.set(cx, cy, rp[1]); img.set(cx + 1, cy, rp[5], 0.5);
          cx += R.int(-1, 1); cy += R.int(0, 1) ? 1 : 0;
          if (cx <= sx + 1 || cx >= sx + sw - 2 || cy >= sy + sh - 2) break;
        }
      }
    }
    // 계층별 덧칠
    if (th.id === 'garden') for (let k = 0; k < 18; k++) { const x = R.int(0, 31), y = R.int(0, 31); if (U.hash2(x, y, 5) < 0.6) img.set(x, y, U.hexRgb(R.pick(['#5a9a42', '#4a8236', '#6aaa4a'])), 0.85); }
    if (th.id === 'forge') for (let k = 0; k < (v % 3 === 0 ? 1 : 0); k++) { let x = R.int(2, 29), y = R.int(2, 29); for (let s = 0; s < R.int(3, 7); s++) { img.set(x, y, [255, 120 + R.int(0, 60), 40]); x += R.int(-1, 1); y += 1; } }
    if (th.id === 'desert' && v % 3 === 0) glyphs(img, R, rp[2]);
    if (th.id === 'void' && v % 4 === 1) rune(img, R, U.hexRgb(th.trim));
    return img.done();
  }
  function glyphs(img, R, col) {
    for (let k = 0; k < 3; k++) {
      const gx = 6 + k * 8, gy = 12;
      const g = R.int(0, 4);
      const P = [[[0, 0], [0, 6], [1, 0], [2, 1], [2, 2], [1, 3]], [[1, 0], [0, 1], [2, 1], [1, 2], [1, 3], [1, 4], [1, 5], [0, 6], [2, 6]], [[0, 3], [1, 2], [2, 3], [1, 4], [1, 0], [1, 6]], [[0, 0], [2, 0], [1, 1], [1, 2], [0, 3], [2, 3], [1, 4], [1, 5], [1, 6]], [[0, 2], [1, 1], [2, 2], [0, 4], [1, 5], [2, 4]]][g];
      for (const [x, y] of P) img.set(gx + x, gy + y, col);
    }
  }
  function rune(img, R, col) {
    const c = 16;
    for (let a = 0; a < 40; a++) { const t = a / 40 * U.TAU; img.set(c + Math.cos(t) * 10, c + Math.sin(t) * 10, col, 0.75); }
    for (let k = 0; k < 3; k++) { const t = R.range(0, U.TAU); for (let r = 2; r < 9; r++) img.set(c + Math.cos(t) * r, c + Math.sin(t) * r, col, 0.6); }
  }

  function softTile(th, v) {
    const R = U.rng(5000 + v * 31 + th.id.length * 7), img = new Img(T, T);
    const rp = PX.makeRamp(th.soft, 8, { dk: 0.55 });
    const seed = R.int(0, 9999);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let vv = 4 + (U.tnoise(x + v * 32, y, 8, 32 * 64, seed) - 0.5) * 2.4;
      if (th.softName === 'sand') vv += Math.sin((x * 0.35 + y * 0.9 + U.tnoise(x, y, 8, 32, seed) * 6)) * 0.7;
      if (th.softName === 'snow') vv = 5 + (vv - 4) * 0.6;
      img.set(x, y, pick(rp, vv, x, y, 0.7));
    }
    if (th.softName === 'grass') {
      for (let k = 0; k < 46; k++) {
        const x = R.int(0, 31), y = R.int(0, 31), h = R.int(2, 4), c = R.chance(0.5) ? rp[6] : rp[2];
        for (let j = 0; j < h; j++) img.set(x + (j === h - 1 && R.chance(0.4) ? 1 : 0), y - j, c);
      }
      if (v % 3 === 0) for (let k = 0; k < 4; k++) { const x = R.int(2, 29), y = R.int(2, 29); img.set(x, y, U.hexRgb(R.pick(['#ffe070', '#ffffff', '#ff8ab0']))); }
    }
    if (th.softName === 'snow') for (let k = 0; k < 10; k++) img.set(R.int(0, 31), R.int(0, 31), [255, 255, 255]);
    if (th.softName === 'ash') for (let k = 0; k < 14; k++) img.set(R.int(0, 31), R.int(0, 31), R.chance(0.3) ? [255, 110, 40] : rp[1]);
    if (th.softName === 'dust') for (let k = 0; k < 8; k++) img.set(R.int(0, 31), R.int(0, 31), R.chance(0.5) ? [240, 220, 255] : [150, 110, 220]);
    if (th.softName === 'sand') for (let k = 0; k < 8; k++) img.set(R.int(0, 31), R.int(0, 31), rp[7]);
    return img.done();
  }

  /* ───────── 벽 ───────── */
  function wallTopTile(th, v) {
    const R = U.rng(9000 + v * 17 + th.id.length), img = new Img(T, T);
    const rp = PX.makeRamp(th.wallTop, 8, { dk: 0.6 }), seed = R.int(0, 999);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let vv;
      if (th.id === 'garden') vv = 4 + (U.hash2(x >> 1, y >> 1, seed) - 0.5) * 3 + (U.tnoise(x, y, 8, 32, seed) - 0.5) * 2;
      else if (th.id === 'desert') { vv = 4.5 + (U.tnoise(x, y, 6, 32, seed) - 0.5) * 1.5; if (y % 16 === 0 || (x + (y >= 16 ? 8 : 0)) % 16 === 0) vv = 2; }
      else if (th.id === 'ice') vv = 5 + (U.tnoise(x, y, 10, 32, seed) - 0.5) * 1.8 + ((x + y) % 23 === 0 ? 1.5 : 0);
      else if (th.id === 'forge') { vv = 3.6 + (U.tnoise(x, y, 6, 32, seed) - 0.5) * 1.2; if (x % 16 === 0 || y % 16 === 0) vv = 1.5; if ((x % 16 === 3 || x % 16 === 12) && (y % 16 === 3 || y % 16 === 12)) vv = 6.5; }
      else { vv = 3.5 + (U.tnoise(x, y, 7, 32, seed) - 0.5) * 2; if (U.hash2(x, y, seed) > 0.975) { img.set(x, y, [220, 190, 255]); continue; } }
      img.set(x, y, pick(rp, vv, x, y));
    }
    if (th.id === 'garden') for (let k = 0; k < 5; k++) img.set(R.int(1, 30), R.int(1, 30), U.hexRgb(R.pick(['#ff8ab0', '#ffe070', '#ffffff'])));
    return img.done();
  }
  function wallFaceTile(th, v) {
    const R = U.rng(7000 + v * 23 + th.id.length * 3), img = new Img(T, WH);
    const rp = PX.makeRamp(th.wallFace, 8, { dk: 0.62 }), seed = R.int(0, 999);
    const st = th.faceStyle;
    for (let y = 0; y < WH; y++) for (let x = 0; x < T; x++) {
      let vv = 4 + (U.fbm(x + v * 32, y, 5, seed, 2) - 0.5) * 1.4 - y / WH * 1.6;
      if (st === 'stone') { const row = Math.floor(y / 7), off = row % 2 ? 8 : 0; if (y % 7 === 0 || (x + off + v * 5) % 16 === 0) vv = 1.2; else if (y % 7 === 1 || (x + off + v * 5) % 16 === 1) vv += 0.9; }
      else if (st === 'block') { if (y === 10 || (x + (y > 10 ? 16 : 0)) % 32 === 0) vv = 1.5; else if (y === 11) vv += 1; if (y >= 3 && y <= 7 && x % 6 === 2) vv -= 1.2; }
      else if (st === 'ice') { vv = 4.6 + (U.fbm(x, y + v * 22, 6, seed, 2) - 0.5) * 2 - y / WH * 1.2 + ((x * 2 + y + v * 7) % 19 < 2 ? 1.6 : 0); }
      else if (st === 'iron') { if (y % 11 === 0 || (x + (y > 10 ? 8 : 0)) % 16 === 0) vv = 0.8; if ((x % 16 === 3 || x % 16 === 12) && y % 11 === 3) vv = 6.5; }
      else { vv = 3 + (U.fbm(x, y + v * 22, 4, seed, 2) - 0.5) * 2 - y / WH; }
      img.set(x, y, pick(rp, vv, x, y));
    }
    if (st === 'iron' || st === 'obsidian') {
      const glow = U.hexRgb(th.trim);
      let x = R.int(4, 27), y = 0;
      for (let k = 0; k < WH; k++) { img.set(x, y, glow, st === 'iron' ? 0.9 : 0.85); y++; if (R.chance(0.35)) x += R.int(-1, 1); }
    }
    if (st === 'block' && v % 2 === 0) { const g = U.hexRgb(th.trim); for (let x = 0; x < T; x++) { img.set(x, 1, g); img.set(x, 2, g, 0.6); } }
    for (let x = 0; x < T; x++) { img.set(x, 0, rp[6]); img.set(x, WH - 1, rp[0]); }
    // 덩굴
    if (th.id === 'garden' && v % 2 === 0) {
      const vc = PX.makeRamp(th.vine, 6);
      for (let k = 0; k < 2; k++) {
        let x = R.int(2, 29), len = R.int(6, WH - 2);
        for (let y = 0; y < len; y++) { img.set(x, y, vc[2]); img.set(x + 1, y, vc[4]); if (y % 3 === 1) { img.set(x - 1, y, vc[3]); img.set(x + 2, y + 1, vc[3]); } if (R.chance(0.2)) x += R.int(-1, 1); }
      }
    }
    if (th.id === 'ice') for (let k = 0; k < 4; k++) { const x = R.int(1, 30), l = R.int(2, 6); for (let y = WH - 2; y > WH - 2 - l; y--) img.set(x, y + l, [220, 240, 255], 0.9); }
    return img.done();
  }

  /* ───────── 위험 지형(4프레임) ───────── */
  function hazardTile(th, f, v) {
    const img = new Img(T, T), kind = th.hazard;
    if (kind === 'lava') {
      const rp = PX.makeRamp('#ff6a1a', 8, { dk: 0.5, lt: 0.9 });
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const n = U.tnoise(x + f * 2, y + f, 8, 32, 11 + v) * 0.6 + U.tnoise(x - f * 2, y + f * 2, 5, 32, 31 + v) * 0.4;
        let vv = n * 9 - 1.5; if (n > 0.72) vv = 7;
        img.set(x, y, pick(rp, vv, x, y));
      }
    } else if (kind === 'quicksand') {
      const rp = PX.makeRamp('#b88a4a', 8);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const dx = x - 16, dy = y - 16, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
        const vv = 3.5 + Math.sin(a * 2 + r * 0.45 - f * Math.PI / 2 + v) * 1.2 + (U.hash2(x, y, 3) - 0.5);
        img.set(x, y, pick(rp, vv, x, y));
      }
    } else if (kind === 'blackice') {
      const rp = PX.makeRamp('#3a6aa8', 8, { lt: 0.9 });
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        let vv = 3.2 + (U.tnoise(x, y, 10, 32, 7 + v) - 0.5) * 1.6;
        const g = (x + y * 0.6 + v * 9 - f * 6) % 48; if (g > 0 && g < 3) vv = 7;
        img.set(x, y, pick(rp, vv, x, y));
      }
    } else if (kind === 'thorn') {
      const g = PX.makeRamp('#2e5a26', 7), t = U.hexRgb('#c88aff');
      const R = U.rng(300 + v);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) img.set(x, y, pick(g, 1.5 + U.tnoise(x, y, 6, 32, 9 + v) * 2, x, y));
      for (let k = 0; k < 9; k++) {
        let x = R.int(0, 31), y = R.int(4, 31); const sway = (f % 2) * (k % 2 ? 1 : -1);
        for (let j = 0; j < 7; j++) { img.set(x + (j > 3 ? sway : 0), y - j, g[4 - (j >> 2)]); if (j % 3 === 2) img.set(x + 1 + (j > 3 ? sway : 0), y - j, t); }
      }
    } else {
      // 공허의 틈: 별이 흐르는 구멍
      const rp = PX.makeRamp('#7a3ad8', 7, { lt: 0.9 });
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const dx = x - 15.5, dy = y - 15.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        let vv = 1 + Math.sin(a * 3 - f * 0.8 + r * 0.5 + v) * 0.8 + (16 - r) * 0.08;
        if (U.hash2(x + f * 3, y, 17 + v) > 0.97) { img.set(x, y, [255, 240, 255]); continue; }
        img.set(x, y, pick(rp, vv, x, y));
      }
    }
    return img.done();
  }

  /* ───────── 장애물(높이가 있는 사물)·장식 ───────── */
  const { Spr } = PX;
  const OBST = {
    garden: [
      ['pillar', 32, 64, (s) => { s.cyl(16, 58, 16, 22, 10, 9, '#9a9e88', { tex: ART.nz(3, 0.15) }); s.np(); s.box(4, 54, 24, 8, '#8a8e78', { bevel: 1 }); s.np(); s.poly([[6, 22], [12, 18], [16, 24], [20, 16], [26, 22], [26, 26], [6, 26]], '#9a9e88', 0.6); s.np(); s.chain([[9, 24], [12, 34], [9, 44], [13, 52]], 1.6, 1.4, '#4a8a36'); s.chain([[22, 26], [20, 38], [23, 50]], 1.4, 1.2, '#3f7a2e'); for (const [x, y] of [[11, 30], [10, 40], [21, 34], [22, 46]]) s.ball(x, y, 2.2, 1.6, '#5aa042'); }],
      ['stump', 32, 44, (s) => { s.cyl(16, 38, 16, 22, 11, 10, '#7a5236', { tex: (x) => (x % 3 ? 0 : -0.15) }); s.np(); s.ball(16, 22, 10, 4, '#c8a070', { tex: (x, y) => (Math.round(Math.hypot(x - 16, (y - 22) * 2.5)) % 3 ? 0 : -0.2) }); s.np(); s.chain([[6, 36], [2, 40]], 2.5, 1.2, '#6a4430'); s.chain([[26, 36], [30, 40]], 2.5, 1.2, '#6a4430'); s.np(); s.ball(10, 30, 3, 2, '#e8e0c8'); s.ball(9, 28, 3.6, 1.8, '#c84a3a', { half: 'top' }); }],
      ['bush', 32, 42, (s) => { const lt = (x, y) => (U.hash2(x >> 1, y >> 1, 5) - 0.5) * 0.35; s.ball(16, 30, 14, 10, '#3f8a34', { tex: lt }); s.np(); s.ball(11, 22, 8, 7, '#4e9a3a', { tex: lt }); s.ball(21, 21, 8, 7.5, '#56a842', { tex: lt }); s.np(); for (const [x, y] of [[8, 26], [20, 18], [24, 28], [14, 32]]) s.ball(x, y, 1.6, 1.6, '#ff6a8a', { m: { gloss: true } }); }],
      ['statue', 32, 70, (s) => { s.box(5, 58, 22, 10, '#8a8e78', { bevel: 1 }); s.np(); s.cyl(16, 58, 16, 40, 6, 5, '#a8ac98'); s.np(); s.ball(16, 36, 7, 7, '#a8ac98'); s.np(); s.ball(16, 26, 5, 5, '#a8ac98'); s.np(); s.cyl(10, 38, 6, 26, 2, 1.6, '#a8ac98'); s.np(); s.poly([[4, 26], [8, 14], [10, 26]], '#b8bca8', 0.6); s.np(); s.chain([[20, 40], [24, 52], [21, 60]], 1.5, 1.2, '#4a8a36'); }]
    ],
    desert: [
      ['pillar', 32, 70, (s) => { s.box(4, 60, 24, 8, '#c8a066', { bevel: 1 }); s.np(); s.cyl(16, 60, 16, 16, 9.5, 9.5, '#d8b47a', { tex: (x, y) => (y % 12 === 0 ? -0.3 : 0) + (x % 5 === 0 ? -0.06 : 0) }); s.np(); s.rect(6, 28, 21, 3, ART.M.gold, 0.7); s.rect(6, 46, 21, 2, '#2a4ab8', 0.5); s.np(); s.box(3, 12, 26, 7, '#c8a066', { bevel: 1 }); }],
      ['obelisk', 32, 76, (s) => { s.box(5, 64, 22, 8, '#c8a066', { bevel: 1 }); s.np(); s.poly([[9, 64], [23, 64], [21, 14], [11, 14]], '#d0aa70', (x, y) => x < 16 ? 0.68 : 0.42); s.np(); s.poly([[11, 14], [21, 14], [16, 6]], ART.M.gold, (x) => x < 16 ? 0.85 : 0.55); s.np(); for (let y = 22; y < 58; y += 8) { s.px(15, y, '#6a4a2a', 0.3); s.px(16, y + 1, '#6a4a2a', 0.3); s.px(14, y + 3, '#6a4a2a', 0.3); s.px(17, y + 4, '#6a4a2a', 0.3); } }],
      ['urns', 32, 44, (s) => { s.ball(10, 34, 7, 8, '#b8683a', { m: { gloss: true } }); s.cyl(10, 26, 10, 23, 3, 3.5, '#a85a30'); s.np(); s.rect(4, 32, 13, 2, '#2a3a6a', 0.5); s.np(); s.ball(22, 36, 6.5, 6, '#c87a46', { m: { gloss: true } }); s.cyl(22, 30, 22, 27, 2.6, 3, '#b8683a'); s.np(); s.rect(16, 36, 13, 1, ART.M.gold, 0.7); }],
      ['brazier', 32, 54, (s) => { s.cyl(16, 50, 16, 30, 3, 3, ART.M.gold); s.np(); s.box(8, 46, 16, 5, '#8a6a3a', { bevel: 1 }); s.np(); s.ball(16, 28, 11, 6, ART.M.gold, { half: 'bottom' }); s.ball(16, 28, 11, 3, '#5a3a1a', { flatS: 0.2 }); }, { light: [255, 170, 80], flame: true }]
    ],
    ice: [
      ['crystal', 32, 64, (s) => { const c = PX.mat('#8ae0ff', { gloss: true, n: 7 }); const sh = (x, cx) => x < cx ? 0.85 : 0.45; s.poly([[16, 6], [22, 22], [20, 58], [12, 58], [10, 22]], c, (x) => sh(x, 16)); s.np(); s.poly([[6, 26], [11, 34], [11, 58], [4, 58], [3, 34]], c, (x) => sh(x, 7)); s.poly([[26, 30], [29, 38], [28, 58], [21, 58], [22, 38]], c, (x) => sh(x, 25)); }, { light: [120, 210, 255] }],
      ['frozenpillar', 32, 70, (s) => { s.box(4, 60, 24, 8, '#9ab8d8', { bevel: 1 }); s.np(); s.cyl(16, 60, 16, 16, 9, 9, '#b8d4ec', { tex: (x, y) => (y % 10 === 0 ? -0.2 : 0) }); s.np(); s.box(3, 12, 26, 7, '#e8f4ff', { bevel: 1 }); s.np(); for (let i = 0; i < 4; i++) s.poly([[5 + i * 6, 19], [8 + i * 6, 19], [6.5 + i * 6, 25 + (i % 2) * 4]], PX.mat('#d8f4ff', { gloss: true }), 0.8); }],
      ['snowrock', 32, 44, (s) => { s.ball(16, 32, 14, 10, '#6a7a94', { tex: ART.nz(4, 0.2) }); s.np(); s.ball(16, 26, 12, 6, '#f4f8ff', { half: 'top' }); s.ball(9, 28, 5, 3, '#f4f8ff'); }],
      ['icestatue', 32, 70, (s) => { const c = PX.mat('#a8e4ff', { gloss: true, alpha: 0.9 }); s.box(5, 60, 22, 8, '#9ab8d8', { bevel: 1 }); s.np(); s.cyl(13, 60, 13, 44, 2.6, 2.4, c); s.cyl(19, 60, 19, 44, 2.6, 2.4, c); s.np(); s.ball(16, 38, 7, 8, c); s.np(); s.ball(16, 26, 5.5, 5.5, c); s.np(); s.cyl(23, 36, 27, 18, 1.4, 1.2, c); s.np(); s.cyl(9, 36, 6, 46, 2, 2, c); }]
    ],
    forge: [
      ['anvil', 32, 44, (s) => { const ir = PX.mat('#4a4a5a', { gloss: true, n: 7 }); s.box(9, 36, 14, 6, '#3a2a24', { bevel: 1 }); s.np(); s.box(12, 28, 8, 9, ir); s.np(); s.poly([[3, 22], [27, 22], [30, 25], [26, 29], [6, 29]], ir, (x, y) => 0.75 - (y - 22) * 0.06); }],
      ['ironpillar', 32, 72, (s) => { const ir = PX.mat('#4a4654', { gloss: true, n: 7 }); s.box(4, 62, 24, 8, ir, { bevel: 2 }); s.np(); s.box(8, 16, 16, 47, ir, { bevel: 1, tex: (x, y) => (y % 10 === 0 ? -0.25 : 0) }); s.np(); for (let y = 20; y < 60; y += 10) { s.px(10, y, ART.M.steel, 1); s.px(21, y, ART.M.steel, 1); } s.box(4, 10, 24, 7, ir, { bevel: 2 }); }],
      ['crates', 32, 52, (s) => { const w = '#8a5a30', ct = (x, y) => (x % 7 === 0 ? -0.2 : 0); s.box(3, 30, 26, 20, w, { bevel: 1, tex: ct }); s.np(); s.line(4, 31, 28, 49, '#5a3a1a', 0.3); s.np(); s.box(8, 14, 17, 16, w, { bevel: 1, tex: ct }); s.np(); s.line(9, 15, 24, 29, '#5a3a1a', 0.3); }],
      ['furnace', 32, 60, (s) => { const br = PX.mat('#5a3a3a'); s.box(2, 20, 28, 38, br, { bevel: 2, round: 4, tex: (x, y) => (y % 6 === 0 || (x + (y % 12 < 6 ? 0 : 4)) % 8 === 0 ? -0.25 : 0) }); s.np(); s.box(8, 36, 16, 14, '#1a0a0a', { base: 0.2, round: 3 }); s.np(); s.box(10, 39, 12, 10, ART.emit('#ff8a2a'), { base: 0.8, round: 2, tex: ART.nz(9, 0.4) }); s.np(); s.cyl(16, 20, 16, 6, 4, 4, '#3a2a2a'); }, { light: [255, 130, 50] }]
    ],
    void: [
      ['monolith', 32, 80, (s) => { const ob = PX.mat('#2a2244', { gloss: true, n: 7 }); s.poly([[8, 74], [24, 74], [26, 18], [16, 6], [6, 18]], ob, (x) => x < 16 ? 0.6 : 0.3); s.np(); const g = ART.emit('#c070ff'); for (let y = 20; y < 70; y += 9) s.rect(14, y, 4, 3, g, 0.8); s.np(); }, { light: [180, 110, 255] }],
      ['brokencol', 32, 64, (s) => { s.box(4, 54, 24, 8, '#3a3258', { bevel: 1 }); s.np(); s.cyl(16, 54, 16, 26, 9, 9, '#4a4070', { tex: (x, y) => (x % 4 === 0 ? -0.12 : 0) }); s.np(); s.poly([[7, 26], [12, 20], [16, 26], [21, 18], [25, 26]], '#4a4070', 0.55); s.np(); ART.sprinkle(s, PX.mat('#4a4070'), ART.emit('#ffe8ff'), 0.04, 9); }],
      ['floatcrystal', 32, 72, (s) => { const c = PX.mat('#b070ff', { gloss: true, n: 7 }); s.ball(16, 66, 10, 3, '#1a1030', { flatS: 0.2 }); s.np(); s.poly([[16, 14], [24, 32], [16, 52], [8, 32]], c, (x) => x < 16 ? 0.9 : 0.5); }, { light: [200, 120, 255] }],
      ['pedestal', 32, 50, (s) => { s.box(6, 34, 20, 14, '#3a3258', { bevel: 1 }); s.np(); s.box(4, 30, 24, 5, '#4a4070', { bevel: 1 }); s.np(); s.ball(16, 24, 6, 6, ART.emit('#ffe08a'), { flatS: 0.95 }); }, { light: [255, 220, 140] }]
    ]
  };
  const DECOR = {
    garden: [(s) => { for (let i = 0; i < 4; i++) { const x = 3 + i * 3, h = 4 + (i % 2) * 2; s.line(x, 12, x + (i % 2 ? 1 : -1), 12 - h, '#5aa042', 0.6); } }, (s) => { s.line(6, 12, 6, 6, '#4a8a36', 0.6); s.ball(6, 5, 2.2, 2, '#ff5a7a'); s.px(6, 5, '#ffe070', 1); s.line(10, 12, 10, 8, '#4a8a36', 0.6); s.ball(10, 7, 1.8, 1.6, '#ffe070'); }, (s) => { s.ball(7, 10, 2, 1.4, '#e8e0c8'); s.ball(7, 8, 3, 1.8, '#d85a3a', { half: 'top' }); s.ball(11, 11, 1.4, 1, '#e8e0c8'); s.ball(11, 10, 2, 1.3, '#d85a3a', { half: 'top' }); }, (s) => { s.ball(5, 10, 3, 2, '#8a8e78'); s.ball(10, 11, 2, 1.5, '#9a9e88'); }],
    desert: [(s) => { s.ball(8, 10, 6, 2.6, '#e8c888'); }, (s) => { s.ball(6, 9, 3.4, 3, ART.M.bone); s.rect(5, 9, 2, 1, ART.M.eye, 0); s.cyl(9, 11, 13, 10, 0.8, 0.8, ART.M.bone); }, (s) => { s.poly([[3, 10], [7, 6], [9, 10]], '#b8683a', 0.6); s.poly([[9, 11], [12, 8], [14, 11]], '#a85a30', 0.4); }, (s) => { for (let i = 0; i < 3; i++) s.ball(4 + i * 3, 10 - (i % 2), 1.4, 1, '#c8a066'); }],
    ice: [(s) => { s.ball(8, 10, 6, 2.4, '#ffffff'); }, (s) => { const c = PX.mat('#9ae4ff', { gloss: true }); s.poly([[4, 12], [6, 4], [8, 12]], c, 0.8); s.poly([[8, 12], [11, 7], [12, 12]], c, 0.6); }, (s) => { s.ball(7, 10, 3, 2.6, ART.M.bone); s.ball(7, 9, 4, 1.5, '#ffffff', { half: 'top' }); }, (s) => { s.ball(6, 10, 3, 2, '#6a7a94'); s.ball(6, 9, 3, 1.2, '#ffffff', { half: 'top' }); }],
    forge: [(s) => { for (let i = 0; i < 4; i++) s.ball(4 + i * 2.5, 10 - (i % 2), 1.6, 1.2, '#2a2224'); s.px(7, 9, ART.emit('#ff7a2a'), 1); }, (s) => { const ir = PX.mat('#6a6a7a', { gloss: true }); s.ball(8, 9, 4, 4, ir); s.ball(8, 9, 1.6, 1.6, '#2a2a34'); for (let a = 0; a < 6; a++) s.px(8 + Math.cos(a) * 5, 9 + Math.sin(a) * 5, ir, 0.6); }, (s) => { for (let i = 0; i < 5; i++) s.ball(3 + i * 2.4, 10 + (i % 2), 1.3, 1, '#7a7a8a'); }, (s) => { s.line(2, 11, 14, 9, '#3a3236', 0.2); s.px(6, 10, ART.emit('#ff9a3a'), 1); s.px(10, 10, ART.emit('#ff7a2a'), 1); }],
    void: [(s) => { const c = PX.mat('#c070ff', { gloss: true }); s.poly([[5, 12], [7, 5], [9, 12]], c, 0.85); s.poly([[9, 12], [11, 8], [12, 12]], c, 0.6); }, (s) => { const g = ART.emit('#a060ff'); s.px(4, 8, g, 1); s.px(8, 6, g, 1); s.px(12, 9, g, 1); s.px(7, 11, ART.emit('#ffe8ff'), 1); }, (s) => { s.ball(8, 10, 4, 2, '#3a3258'); s.px(8, 9, ART.emit('#ffe08a'), 1); }, (s) => { s.ball(6, 10, 2.4, 1.6, '#4a4070'); s.ball(11, 11, 1.6, 1.2, '#4a4070'); }]
  };
  const bakedObst = new Map();
  function obstacle(th, k) {
    const list = OBST[th.id], e = list[k % list.length];
    const key = th.id + k;
    if (!bakedObst.has(key)) {
      const s = new Spr(e[1], e[2]); e[3](s);
      bakedObst.set(key, { c: s.render(), w: e[1], h: e[2], name: e[0], ...(e[4] || {}) });
    }
    return bakedObst.get(key);
  }
  const bakedDecor = new Map();
  function decor(th, k) {
    const list = DECOR[th.id], key = th.id + (k % list.length);
    if (!bakedDecor.has(key)) { const s = new Spr(16, 14); list[k % list.length](s); bakedDecor.set(key, s.render()); }
    return bakedDecor.get(key);
  }

  /* 타일 묶음(계층마다 한 번) */
  const sets = [];
  function set(t) {
    if (sets[t]) return sets[t];
    const th = THEMES[t];
    const S = { th, slab: [], soft: [], top: [], face: [], haz: [] };
    for (let v = 0; v < 8; v++) { S.slab.push(slabTile(th, v)); S.soft.push(softTile(th, v)); }
    for (let v = 0; v < 4; v++) { S.top.push(wallTopTile(th, v)); S.face.push(wallFaceTile(th, v)); }
    for (let v = 0; v < 2; v++) { const fr = []; for (let f = 0; f < 4; f++) fr.push(hazardTile(th, f, v)); S.haz.push(fr); }
    sets[t] = S;
    return S;
  }

  /* ───────── 한 층 미리 그리기 ─────────
     L.grid: 0 바닥, 1 벽, 2 구덩이, 3 위험 지형, 4 장애물 (L.obst[i] = 종류) */
  function build(L) {
    const S = set(L.tier), th = S.th;
    const W = L.w, H = L.h, g = L.grid;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : g[y * W + x];
    const solid = (v) => v === 1;
    const [fc, fx] = U.canvas(W * T, H * T);
    const seed = L.seed;
    // 바닥 타일: 돌판 위에 풀·모래·눈 같은 「부드러운 바닥」을 잡음 경계로 덮는다
    const [sc0, sx0] = U.canvas(W * T, H * T);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = at(x, y);
      if (v === 2) continue;
      const h = Math.floor(U.hash2(x, y, seed) * 8), h2 = Math.floor(U.hash2(x, y, seed + 1) * 8);
      fx.drawImage(S.slab[h], x * T, y * T);
      sx0.drawImage(S.soft[h2], x * T, y * T);
    }
    {
      const a = fx.getImageData(0, 0, W * T, H * T), b = sx0.getImageData(0, 0, W * T, H * T), ad = a.data, bd = b.data;
      const thr = th.softRatio;
      for (let y = 0; y < H * T; y += 2) for (let x = 0; x < W * T; x += 2) {
        const n = U.fbm(x, y, 150, seed, 3) + (U.vnoise(x, y, 9, seed + 5) - 0.5) * 0.06;
        const edge = (thr - n) * 40 + B[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] * 1.2;
        if (edge <= 0) continue;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const p = ((y + j) * W * T + x + i) * 4;
          if (!ad[p + 3]) continue;
          ad[p] = bd[p]; ad[p + 1] = bd[p + 1]; ad[p + 2] = bd[p + 2];
          if (edge < 0.9) { ad[p] *= 0.82; ad[p + 1] *= 0.82; ad[p + 2] *= 0.82; }
        }
      }
      fx.putImageData(a, 0, 0);
    }
    // 큰 얼룩(반복 무늬 감추기): 2×2 칸 단위로 어둡게/밝게
    const img = fx.getImageData(0, 0, W * T, H * T), d = img.data;
    for (let y = 0; y < H * T; y += 2) for (let x = 0; x < W * T; x += 2) {
      const n = U.fbm(x, y, 90, seed + 3, 2) - 0.5;
      const k = Math.round(n * 3 + B[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] * 0.9);
      if (!k) continue;
      const m = k > 0 ? 1 + k * 0.06 : 1 + k * 0.09;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const p = ((y + j) * W * T + x + i) * 4; if (d[p + 3]) { d[p] *= m; d[p + 1] *= m; d[p + 2] *= m; } }
    }
    fx.putImageData(img, 0, 0);
    // 장식
    const R = U.rng(seed + 77);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (at(x, y) !== 0 || !R.chance(0.09)) continue;
      fx.drawImage(decor(th, R.int(0, 3)), x * T + R.int(0, 14), y * T + R.int(2, 16));
    }
    // 위험 지형: 가장자리를 잡음으로 갉아 둥글고 불규칙하게(칸 모양이 드러나지 않게)
    const haz = [], hazC = [];
    const hzPix = S.haz.map(fr => fr.map(c => c.getContext('2d').getImageData(0, 0, T, T).data));
    {
      const img2 = fx.getImageData(0, 0, W * T, H * T), dd = img2.data;
      const isH = (x, y) => { const v = at(x, y); return v === 3 || v === 1 || v === 4; };
      const RR = 9;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (at(x, y) !== 3) continue;
        const v = (x + y) % 2, m = new Uint8Array(T * T);
        const L_ = isH(x - 1, y), R_ = isH(x + 1, y), U_ = isH(x, y - 1), D_ = isH(x, y + 1);
        for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
          let d = 99;
          if (!L_) d = Math.min(d, i); if (!R_) d = Math.min(d, T - 1 - i); if (!U_) d = Math.min(d, j); if (!D_) d = Math.min(d, T - 1 - j);
          if (!L_ && !U_ && i < RR && j < RR) d = Math.min(d, RR - Math.hypot(RR - i - 0.5, RR - j - 0.5));
          if (!R_ && !U_ && i > T - 1 - RR && j < RR) d = Math.min(d, RR - Math.hypot(i + 0.5 - (T - RR), RR - j - 0.5));
          if (!L_ && !D_ && i < RR && j > T - 1 - RR) d = Math.min(d, RR - Math.hypot(RR - i - 0.5, j + 0.5 - (T - RR)));
          if (!R_ && !D_ && i > T - 1 - RR && j > T - 1 - RR) d = Math.min(d, RR - Math.hypot(i + 0.5 - (T - RR), j + 0.5 - (T - RR)));
          if (L_ && U_ && !isH(x - 1, y - 1)) d = Math.min(d, Math.hypot(i, j) - 2);
          if (R_ && U_ && !isH(x + 1, y - 1)) d = Math.min(d, Math.hypot(T - 1 - i, j) - 2);
          if (L_ && D_ && !isH(x - 1, y + 1)) d = Math.min(d, Math.hypot(i, T - 1 - j) - 2);
          if (R_ && D_ && !isH(x + 1, y + 1)) d = Math.min(d, Math.hypot(T - 1 - i, T - 1 - j) - 2);
          const th2 = 1 + U.vnoise(x * T + i, y * T + j, 5, seed + 11) * 3.5;
          const k = d > th2 + 1.2 ? 2 : d > th2 ? 1 : 0;
          m[j * T + i] = k;
          const p = ((y * T + j) * W * T + x * T + i) * 4, q = (j * T + i) * 4, src = hzPix[v][0];
          if (k === 2) { dd[p] = src[q]; dd[p + 1] = src[q + 1]; dd[p + 2] = src[q + 2]; dd[p + 3] = 255; }
          else if (k === 1) { dd[p] *= 0.55; dd[p + 1] *= 0.55; dd[p + 2] *= 0.55; }
        }
        haz.push([x, y, v, hazC.length]);
        const frames = [];
        for (let f = 0; f < 4; f++) {
          const [c, cx] = U.canvas(T, T), id = cx.createImageData(T, T), src = hzPix[v][f];
          for (let i = 0; i < T * T; i++) if (m[i] === 2) { id.data[i * 4] = src[i * 4]; id.data[i * 4 + 1] = src[i * 4 + 1]; id.data[i * 4 + 2] = src[i * 4 + 2]; id.data[i * 4 + 3] = 255; }
          cx.putImageData(id, 0, 0); frames.push(c);
        }
        hazC.push(frames);
      }
      fx.putImageData(img2, 0, 0);
    }
    // 구덩이: 위쪽 벼랑 단면 + 둘레
    const pitCol = th.pit ? U.hexRgb(th.pit) : null;
    const cliff = PX.makeRamp(th.wallFace, 7, { dk: 0.7 });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x, y) !== 2) continue;
      if (pitCol) { fx.fillStyle = U.rgba(pitCol, 1); fx.fillRect(x * T, y * T, T, T); }
      if (at(x, y - 1) !== 2) {
        for (let j = 0; j < 14; j++) for (let i = 0; i < T; i++) {
          const vv = 4.5 - j * 0.35 + (U.hash2(x * T + i, j, seed) - 0.5) * 1.2 + ((i + x * 7) % 11 === 0 ? -1 : 0);
          const c = pick(cliff, vv, i, j);
          fx.fillStyle = U.rgba(c, j > 10 ? 1 - (j - 10) * 0.2 : 1); fx.fillRect(x * T + i, y * T + j, 1, 1);
        }
      }
      fx.fillStyle = 'rgba(255,255,255,0.18)';
      if (at(x - 1, y) !== 2) fx.fillRect(x * T - 1, y * T, 1, T);
      if (at(x + 1, y) !== 2) fx.fillRect(x * T + T, y * T, 1, T);
      if (at(x, y + 1) !== 2) fx.fillRect(x * T, y * T + T, T, 1);
    }
    const pitPath = new Path2D();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 2) pitPath.rect(x * T, y * T + (at(x, y - 1) !== 2 ? 12 : 0), T, T - (at(x, y - 1) !== 2 ? 12 : 0));
    // 벽 아래 그늘
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = at(x, y); if (v === 1 || v === 2) continue;
      if (solid(at(x, y - 1)) || at(x, y - 1) === 4) { const gr = fx.createLinearGradient(0, y * T, 0, y * T + 12); gr.addColorStop(0, 'rgba(8,4,16,0.55)'); gr.addColorStop(1, 'rgba(8,4,16,0)'); fx.fillStyle = gr; fx.fillRect(x * T, y * T, T, 12); }
      if (solid(at(x - 1, y))) { const gr = fx.createLinearGradient(x * T, 0, x * T + 7, 0); gr.addColorStop(0, 'rgba(8,4,16,0.4)'); gr.addColorStop(1, 'rgba(8,4,16,0)'); fx.fillStyle = gr; fx.fillRect(x * T, y * T, 7, T); }
      if (solid(at(x + 1, y))) { const gr = fx.createLinearGradient(x * T + T, 0, x * T + T - 5, 0); gr.addColorStop(0, 'rgba(8,4,16,0.3)'); gr.addColorStop(1, 'rgba(8,4,16,0)'); fx.fillStyle = gr; fx.fillRect(x * T + T - 5, y * T, 5, T); }
    }

    // 줄마다 벽·장애물
    const lights = [], flames = [];
    const strips = [];
    for (let y = 0; y < H; y++) {
      let any = false;
      for (let x = 0; x < W; x++) { const v = at(x, y); if (v === 1 || v === 4) { any = true; break; } }
      if (!any) { strips.push(null); continue; }
      const SH = T + 80;   // 장애물이 키가 커서 넉넉히
      const [sc, sx] = U.canvas(W * T, SH);
      const base = SH - T;  // 이 줄 칸 윗변의 줄 그림 안 y
      for (let x = 0; x < W; x++) {
        const v = at(x, y);
        if (v === 1) {
          const h = Math.floor(U.hash2(x, y, seed + 9) * 4);
          sx.drawImage(S.top[h], x * T, base - WH);
          // 윗면 가장자리
          const up = solid(at(x, y - 1)), dn = solid(at(x, y + 1)), lf = solid(at(x - 1, y)), rt = solid(at(x + 1, y));
          sx.fillStyle = 'rgba(255,255,255,0.22)';
          if (!up) sx.fillRect(x * T, base - WH, T, 2);
          if (!lf) sx.fillRect(x * T, base - WH, 2, T);
          sx.fillStyle = 'rgba(0,0,0,0.3)';
          if (!rt) sx.fillRect(x * T + T - 2, base - WH, 2, T);
          if (!dn) {
            sx.fillRect(x * T, base - WH + T - 2, T, 2);
            sx.drawImage(S.face[Math.floor(U.hash2(x, y, seed + 5) * 4)], x * T, base + T - WH);
            if (!lf) { sx.fillStyle = 'rgba(255,255,255,0.12)'; sx.fillRect(x * T, base + T - WH, 1, WH); }
            if (!rt) { sx.fillStyle = 'rgba(0,0,0,0.25)'; sx.fillRect(x * T + T - 1, base + T - WH, 1, WH); }
          }
        } else if (v === 4) {
          const k = L.obst[y * W + x] || 0, o = obstacle(th, k);
          // 바닥 그림자
          sx.fillStyle = 'rgba(8,4,16,0.35)';
          sx.beginPath(); sx.ellipse(x * T + 16, base + T - 4, 14, 5, 0, 0, U.TAU); sx.fill();
          sx.drawImage(o.c, x * T + (T - o.w) / 2, base + T - o.h + 2);
          if (o.light) lights.push({ x: x * T + 16, y: y * T + T - o.h * 0.55, r: 110, c: o.light, fl: o.flame ? 0.25 : 0.06 });
          if (o.flame) flames.push({ x: x * T + 16, y: y * T + T - o.h + 26 });
        }
      }
      strips.push({ c: sc, oy: y * T - base });
    }
    for (const [x, y] of haz) if (th.hazard === 'lava' || th.hazard === 'rift') {
      if ((x + y) % 2 === 0) lights.push({ x: x * T + 16, y: y * T + 16, r: 64, c: th.hazard === 'lava' ? [255, 110, 30] : [170, 90, 255], fl: 0.1 });
    }
    return { floor: fc, strips, haz, hazC, lights, flames, S, pitPath, hasPit: L.grid.includes(2) };
  }

  /* 방 바깥 배경 */
  function background(t, w, h, seed = 1) {
    const th = THEMES[t], [c, x] = U.canvas(w, h);
    const bg = U.hexRgb(th.bg);
    x.fillStyle = th.bg; x.fillRect(0, 0, w, h);
    const R = U.rng(seed);
    if (th.id === 'void') {
      for (let i = 0; i < 4; i++) {
        const gx = R.range(0, w), gy = R.range(0, h), r = R.range(150, 320);
        const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
        const col = R.pick([[120, 40, 180], [40, 60, 160], [160, 40, 120]]);
        g.addColorStop(0, U.rgba(col, 0.28)); g.addColorStop(1, U.rgba(col, 0));
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < w * h / 900; i++) { const b = R(); x.fillStyle = b > 0.97 ? '#ffffff' : b > 0.8 ? '#d8c8ff' : '#7a6aa8'; x.fillRect(R.int(0, w), R.int(0, h), b > 0.985 ? 2 : 1, b > 0.985 ? 2 : 1); }
    } else {
      const rp = PX.makeRamp(th.bg, 6, { lt: 0.25 });
      for (let y = 0; y < h; y += 4) for (let xx = 0; xx < w; xx += 4) {
        const n = U.fbm(xx, y, 60, seed, 3);
        if (n > 0.55) { x.fillStyle = U.rgba(rp[n > 0.65 ? 4 : 3], 1); x.fillRect(xx, y, 4, 4); }
      }
      void bg;
    }
    return c;
  }

  return { T, WH, THEMES, set, build, obstacle, background, OBST };
})();
