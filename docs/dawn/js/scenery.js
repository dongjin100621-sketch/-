'use strict';
/* 여명의 종 — 맵 풍경 그리기 (32 밀도).
   · 건물: 지붕(기와·용마루·처마·굴뚝)·벽(골조·주춧돌·창문·문·간판)을 한 장으로 그려 사람과 앞뒤 순서로 놓는다.
     지붕은 지붕 칸보다 위로 솟아, 그 뒤를 지나는 사람을 가린다.
   · 던전 벽 윗면: 바닥과 맞닿은 가장자리에 빛을 받는 테두리를 둘러 두께가 보이게 한다.
   · 벽면 장식(횃불·금·이끼·깃발), 땅의 작은 장식(꽃·자갈·뼈·금…)과 넓은 색 얼룩.
   그림은 모두 이 자리에서 도형으로 찍는다(그림 파일 없음). */

const Scenery = (() => {
  const TP = 32;
  const shade = (c, f) => Gfx.shade(c, f);
  const tone = (c, f) => Gfx.tone(c, f);
  const px = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const hsh = (a, b) => (((a * 73856093) ^ (b * 19349663) ^ (a * b * 83492791)) >>> 0);

  /* ── 건물 ──
     b = { x, y, w, cells: ['H'|'n'|'o', …], doors: [{kind, shop}|null…], chimney } (칸 좌표, y 는 지붕 줄)
     돌려주는 것: { canvas, ox, oy } — 칸 (x, y) 왼쪽 위에서 ox, oy 만큼 옮겨 그린다 */
  const RISE = 22, EAVE = 6;
  function building(theme, b) {
    const th = Gfx.THEMES[theme];
    const W = b.w * TP + EAVE * 2, roofH = TP + RISE, H = roofH + TP;
    const c = document.createElement('canvas'); c.width = W; c.height = H + 4;
    const g = c.getContext('2d');
    const [ra, rb, rc] = th.roof.length >= 3 ? th.roof : [th.roof[0], shade(th.roof[0], 0.8), shade(th.roof[0], 1.2)];
    const outline = '#1a1020';
    const snowy = theme === 'snow' || theme === 'ice', sandy = theme === 'desert' || theme === 'tomb';
    const r = makeRng(b.x * 131 + b.y * 17 + b.w);
    // 지붕
    const top = 6;
    px(g, 0, top, W, roofH - top, outline);
    const rows = Math.floor((roofH - top - 8) / 6);
    for (let i = 0; i <= rows; i++) {
      const y = top + 4 + i * 6;
      const k = 1.08 - (i / rows) * 0.26;      // 위는 밝고 처마 쪽은 어둡게
      const base = tone(ra, k);
      px(g, 1, y, W - 2, 6, tone(rb, k));
      const off = i % 2 ? 4 : 0;
      for (let x = 1 - off; x < W - 1; x += 8) {
        const sx = Math.max(1, x), ex = Math.min(W - 1, x + 7);
        px(g, sx, y, ex - sx, 5, base);
        px(g, sx, y, ex - sx, 1, tone(rc, k));
        px(g, sx, y + 4, ex - sx, 1, tone(ra, k * 0.78));
        if (r.chance(0.06)) px(g, sx + 2, y + 2, 2, 1, tone(ra, k * 0.7));   // 이끼·얼룩
      }
    }
    // 용마루
    px(g, 1, top, W - 2, 5, tone(rb, 0.9));
    px(g, 1, top + 1, W - 2, 2, tone(rc, 1.05));
    for (let x = 4; x < W - 4; x += 10) px(g, x, top + 3, 2, 2, tone(rb, 0.75));
    // 박공 테두리(양 끝)
    px(g, 1, top, 3, roofH - top - 4, tone(rb, 0.8)); px(g, W - 4, top, 3, roofH - top - 4, tone(rb, 0.7));
    px(g, 1, top, 1, roofH - top - 4, tone(rc, 0.95));
    // 굴뚝(용마루 위로 솟게)
    if (b.chimney !== null && b.chimney !== undefined) {
      const cx = EAVE + b.chimney * TP + 10;
      px(g, cx - 1, 1, 14, 21, outline);
      px(g, cx, 2, 12, 20, sandy ? '#b08a5a' : '#8a5a48');
      for (let y = 4; y < 20; y += 4) for (let x = cx + ((y / 4) % 2 ? 0 : 3); x < cx + 12; x += 6) px(g, x, y, 5, 1, sandy ? '#c8a070' : '#a86a52');
      px(g, cx - 2, 0, 16, 4, sandy ? '#8a6a44' : '#5a3a30');
      px(g, cx - 2, 0, 16, 1, '#c8a080');
    }
    // 눈 덮인 지붕
    if (snowy) {
      for (let x = 1; x < W - 1; x++) {
        const d = 14 + Math.round(Math.sin(x * 0.35) * 2 + Math.sin(x * 0.11) * 3);
        px(g, x, top + 1, 1, d, '#f4f8ff');
        px(g, x, top + 1 + d, 1, 1, '#c8d8ec');
      }
      px(g, 1, top, W - 2, 1, '#ffffff');
    }
    // 처마(나무 띠)
    const eaveY = roofH - 4;
    px(g, 0, eaveY, W, 4, outline);
    px(g, 1, eaveY, W - 2, 3, sandy ? '#8a6a44' : '#4a2c1a');
    px(g, 1, eaveY, W - 2, 1, sandy ? '#b08a5a' : '#6e4228');
    if (snowy) for (let x = 3; x < W - 3; x += 5 + (x % 3)) px(g, x, eaveY + 3, 1, 2 + (x % 4), '#dff0ff');   // 고드름
    // 벽
    const wx = EAVE, wy = roofH, ww = b.w * TP;
    const h0 = th.house[0], h1 = th.house[1] || shade(th.house[0], 0.85);
    px(g, wx - 1, wy, ww + 2, TP + 1, outline);
    px(g, wx, wy, ww, TP, h0);
    for (let k = 0; k < 50 * b.w; k++) px(g, wx + r.int(0, ww - 1), wy + r.int(0, TP - 1), 1, 1, tone(h0, r.chance(0.5) ? 0.94 : 1.05));
    if (sandy) {
      // 흙벽: 갈라진 금과 얼룩
      for (let k = 0; k < b.w * 2; k++) { let x = wx + r.int(2, ww - 3), y = wy + r.int(6, 18); for (let t = 0; t < 5; t++) { px(g, x, y, 1, 1, tone(h0, 0.8)); x += r.int(-1, 1); y++; } }
    } else if (snowy) {
      // 통나무 벽
      for (let y = wy + 4; y < wy + TP - 6; y += 5) { px(g, wx, y, ww, 1, tone(h1, 0.75)); px(g, wx, y + 1, ww, 1, tone(h0, 1.12)); }
    } else {
      // 나무 골조
      const beam = tone(h1, 0.62);
      for (let i = 0; i <= b.w; i++) { const x = wx + i * TP - (i === b.w ? 3 : 0); px(g, x, wy, 3, TP, beam); px(g, x, wy, 1, TP, tone(h1, 0.85)); }
      px(g, wx, wy + 11, ww, 3, beam); px(g, wx, wy + 11, ww, 1, tone(h1, 0.85));
    }
    // 주춧돌
    const fy = wy + TP - 6;
    px(g, wx, fy, ww, 6, '#5a5468');
    for (let x = wx; x < wx + ww; x += 7) { px(g, x + 1, fy + 1, 5, 4, x % 14 ? '#7a7488' : '#8a8498'); px(g, x + 1, fy + 1, 5, 1, '#a29db0'); }
    // 처마 그늘
    const sg = g.createLinearGradient(0, wy, 0, wy + 7);
    sg.addColorStop(0, 'rgba(10,6,20,.55)'); sg.addColorStop(1, 'rgba(10,6,20,0)');
    g.fillStyle = sg; g.fillRect(wx, wy, ww, 7);
    // 창문·문
    b.cells.forEach((cell, i) => {
      const cx = wx + i * TP;
      if (cell === 'n') window_(g, cx + 8, wy + 6, theme, r);
      else if (cell === 'o') door(g, cx + 7, wy + 4, sandy, b.doors[i]);
    });
    return { canvas: c, ox: -EAVE, oy: -RISE };
  }
  function window_(g, x, y, theme, r) {
    px(g, x - 1, y - 1, 18, 15, '#2a1a14');
    px(g, x, y, 16, 13, '#3e2418');
    // 불 켜진 유리(위는 밝게)
    px(g, x + 2, y + 2, 5, 4, '#ffe8a0'); px(g, x + 9, y + 2, 5, 4, '#ffe8a0');
    px(g, x + 2, y + 7, 5, 4, '#f0b860'); px(g, x + 9, y + 7, 5, 4, '#f0b860');
    px(g, x + 2, y + 2, 2, 1, '#ffffff'); px(g, x + 9, y + 2, 2, 1, '#ffffff');
    // 덧문
    px(g, x - 4, y, 3, 13, '#6e4228'); px(g, x + 17, y, 3, 13, '#6e4228');
    px(g, x - 4, y, 1, 13, '#8a5a34'); px(g, x + 19, y, 1, 13, '#4a2c1a');
    // 창턱과 꽃 상자
    px(g, x - 2, y + 13, 20, 2, '#c8b090'); px(g, x - 2, y + 15, 20, 1, '#6e5a44');
    if (theme === 'village' || theme === 'forest') {
      px(g, x, y + 16, 16, 3, '#6e4228');
      for (let k = 0; k < 5; k++) px(g, x + 1 + k * 3, y + 14 + (k % 2), 2, 2, ['#e0503f', '#ffd447', '#f6f0ff', '#e286c4'][k % 4]);
    }
  }
  function door(g, x, y, sandy, d) {
    const W = 18, H = 24;
    px(g, x - 2, y - 2, W + 4, H + 2, '#2a1a14');
    px(g, x - 1, y - 1, W + 2, H + 1, sandy ? '#a8784c' : '#5a3a28');
    px(g, x, y, W, H, sandy ? '#7a4a2a' : '#8a5230');
    for (let k = 4; k < W; k += 4) px(g, x + k, y + 1, 1, H - 1, sandy ? '#6a3e22' : '#6e3e22');
    px(g, x, y, W, 2, '#3e2418'); px(g, x + 1, y + 2, 2, 2, '#3e2418'); px(g, x + W - 3, y + 2, 2, 2, '#3e2418');   // 아치
    px(g, x + 2, y + 9, W - 4, 1, '#5a3420'); px(g, x + 2, y + 17, W - 4, 1, '#5a3420');            // 쇠띠
    px(g, x + W - 5, y + 12, 2, 2, '#ffd447'); px(g, x + W - 5, y + 12, 1, 1, '#fff4b0');           // 손잡이
    px(g, x - 3, y + H - 1, W + 6, 2, '#a29db0'); px(g, x - 3, y + H - 1, W + 6, 1, '#c7c2d8');     // 문턱 돌
    // 가게·여관 간판: 문 위 쇠막대에 매단 판
    if (d && (d.kind === 'shop' || d.kind === 'inn')) {
      const ic = d.kind === 'inn' ? 'potion_gold' : (d.shop || '').endsWith('gear') ? 'sword' : 'potion';
      const s = Gfx.sprite(ic, 'x');
      const sx = x + W + 2, sy = y - 12;
      px(g, x + W - 2, sy - 2, 14, 2, '#2a2a34');
      px(g, sx + 1, sy, 1, 3, '#2a2a34'); px(g, sx + 9, sy, 1, 3, '#2a2a34');
      px(g, sx - 3, sy + 3, 18, 16, '#3e2418');
      px(g, sx - 2, sy + 4, 16, 14, '#d9a866'); px(g, sx - 2, sy + 4, 16, 1, '#f3d2a2');
      if (s) g.drawImage(s, sx - 1, sy + 4, 14, 14);
    }
  }

  /* ── 던전 벽 윗면: 가장자리 테두리 ──
     m: 바닥과 닿은 쪽(1 위, 2 오른쪽, 4 아래, 8 왼쪽), deep: 사방이 벽인 깊은 곳 */
  function wallTop(g, X, Y, th, m, deep, h) {
    const c = th.wall[0];
    px(g, X, Y, TP, TP, tone(c, deep ? 0.36 : 0.5));
    // 큰 돌판 결
    const s2 = tone(c, deep ? 0.31 : 0.43);
    px(g, X, Y + 15, TP, 1, s2); px(g, X + ((h >> 3) % 2 ? 9 : 21), Y, 1, 15, s2); px(g, X + ((h >> 5) % 2 ? 6 : 17), Y + 16, 1, 16, s2);
    for (let k = 0; k < 10; k++) px(g, X + ((h >> k) % 31), Y + ((h >> (k + 3)) % 31), 1, 1, tone(c, deep ? 0.42 : 0.58));
    // 어두운 벽일수록 테두리를 더 밝혀 모양이 읽히게
    const [cr, cg, cb] = Gfx.hexRgb(c), lum = cr * 0.3 + cg * 0.59 + cb * 0.11, lift = lum < 90 ? 1 : lum < 130 ? 0.5 : 0;
    const rim = tone(c, 1.08 + lift * 0.55), rimHi = tone(c, 1.4 + lift * 0.8), dark = tone(c, 0.22), inner = tone(c, 0.34);
    if (m & 1) { px(g, X, Y, TP, 1, dark); px(g, X, Y + 1, TP, 4, rim); px(g, X, Y + 1, TP, 1, rimHi); px(g, X, Y + 5, TP, 1, inner); }
    if (m & 8) { px(g, X, Y, 1, TP, dark); px(g, X + 1, Y, 4, TP, rim); px(g, X + 1, Y, 1, TP, rimHi); px(g, X + 5, Y, 1, TP, inner); }
    if (m & 2) { px(g, X + TP - 1, Y, 1, TP, dark); px(g, X + TP - 5, Y, 4, TP, tone(c, 0.78)); px(g, X + TP - 6, Y, 1, TP, inner); }
    if (m & 4) { px(g, X, Y + TP - 4, TP, 4, tone(c, 0.82)); px(g, X, Y + TP - 5, TP, 1, inner); }
    // 모서리 이음
    if ((m & 1) && (m & 8)) px(g, X + 1, Y + 1, 4, 4, rimHi);
  }

  /* ── 벽면 장식: 횃불·금·이끼·깃발 ── 돌려주는 값: 횃불이면 true(빛을 단다) */
  function wallDeco(g, X, Y, theme, h, torch) {
    const th = Gfx.THEMES[theme];
    if (torch) {
      px(g, X + 14, Y + 12, 4, 10, '#3a2a24'); px(g, X + 12, Y + 12, 8, 2, '#2a2a34'); px(g, X + 12, Y + 20, 8, 2, '#2a2a34');
      px(g, X + 13, Y + 6, 6, 6, '#ff9a3a'); px(g, X + 14, Y + 4, 4, 4, '#ffd447'); px(g, X + 15, Y + 3, 2, 2, '#fff4b0');
      return true;
    }
    const k = h % 7;
    if (k === 0) {   // 금
      let x = X + 6 + (h >> 4) % 18, y = Y + 4;
      for (let i = 0; i < 9; i++) { px(g, x, y, 1, 1, shade(th.mortar, 0.6)); x += ((h >> i) & 1) ? 1 : -1; y += 2; }
    } else if (k === 1 && ['village', 'forest', 'swamp'].includes(theme)) {   // 이끼
      for (let i = 0; i < 14; i++) px(g, X + ((h >> i) % 28) + 2, Y + 18 + ((h >> (i + 2)) % 12), 2, 1, i % 2 ? '#3f7a3a' : '#5a9a48');
    } else if (k === 2 && ['tower', 'dusk', 'tomb'].includes(theme)) {   // 깃발
      const col = theme === 'dusk' ? '#a82a34' : theme === 'tomb' ? '#c8902a' : '#5e36a0';
      px(g, X + 9, Y + 2, 14, 2, '#2a2a34');
      px(g, X + 10, Y + 4, 12, 18, col); px(g, X + 10, Y + 4, 12, 1, shade(col, 1.3));
      px(g, X + 10, Y + 22, 4, 3, col); px(g, X + 18, Y + 22, 4, 3, col);
      px(g, X + 14, Y + 9, 4, 6, theme === 'tomb' ? '#5a2a10' : '#ffd447');
    }
    return false;
  }

  /* ── 땅의 작은 장식 ── */
  function decal(g, X, Y, theme, h) {
    const t = h % 6;
    const cx = X + 6 + (h >> 3) % 18, cy = Y + 8 + (h >> 6) % 16;
    switch (theme) {
      case 'village': case 'forest':
        if (t < 2) for (let k = 0; k < 3; k++) { const x = cx + k * 3 - 3, y = cy + (k % 2) * 2; px(g, x, y, 2, 2, ['#f6f0ff', '#ffd447', '#e286c4'][(h >> k) % 3]); px(g, x, y + 2, 1, 2, '#3f7a3a'); }
        else if (t < 4) { px(g, cx, cy, 4, 3, '#8a8698'); px(g, cx, cy, 4, 1, '#c7c2d8'); px(g, cx + 5, cy + 2, 2, 2, '#7a7488'); }
        else for (let k = 0; k < 4; k++) px(g, cx + k * 2, cy - (k % 2) * 2, 1, 3 + (k % 2), k % 2 ? '#7ac060' : '#4a8a3a');
        break;
      case 'desert':
        if (t < 3) { px(g, cx, cy, 3, 2, '#a88450'); px(g, cx + 4, cy + 1, 2, 2, '#b8955a'); px(g, cx, cy, 3, 1, '#f0d8a0'); }
        else if (t < 5) { let x = cx, y = cy; for (let k = 0; k < 6; k++) { px(g, x, y, 1, 1, '#b88a50'); x++; y += k % 2 ? 1 : 0; } }
        else { px(g, cx, cy, 6, 2, '#efe4d0'); px(g, cx - 1, cy - 1, 2, 4, '#efe4d0'); px(g, cx + 5, cy - 1, 2, 4, '#efe4d0'); }
        break;
      case 'snow': case 'ice':
        if (t < 3) { px(g, cx, cy, 6, 2, '#ffffff'); px(g, cx + 1, cy - 1, 4, 1, '#ffffff'); px(g, cx, cy + 2, 6, 1, '#c8d8ec'); }
        else { px(g, cx, cy, 1, 1, '#ffffff'); px(g, cx - 1, cy + 1, 3, 1, '#e8f6ff'); px(g, cx, cy + 2, 1, 1, '#ffffff'); }
        break;
      case 'swamp':
        if (t < 3) { g.fillStyle = 'rgba(40,60,52,.55)'; g.beginPath(); g.ellipse(cx + 3, cy + 2, 6, 3, 0, 0, Math.PI * 2); g.fill(); px(g, cx + 1, cy + 1, 3, 1, 'rgba(160,200,180,.5)'); }
        else { px(g, cx, cy, 3, 2, '#c8584a'); px(g, cx + 1, cy + 2, 1, 2, '#e8e0d0'); px(g, cx + 4, cy + 1, 2, 1, '#c8584a'); px(g, cx + 4, cy + 2, 1, 2, '#e8e0d0'); }
        break;
      default: {   // 어두운 바닥: 금·돌 부스러기·얼룩
        const th = Gfx.THEMES[theme];
        if (t < 3) { let x = cx, y = cy; for (let k = 0; k < 7; k++) { px(g, x, y, 1, 1, tone(th.ground[0], 0.7)); x += (h >> k) & 1 ? 1 : -1; y += 1; } }
        else if (t < 5) { px(g, cx, cy, 3, 2, tone(th.ground[0], 0.75)); px(g, cx + 4, cy + 1, 2, 2, tone(th.ground[0], 0.8)); px(g, cx, cy, 3, 1, tone(th.ground[0], 1.2)); }
        else { g.fillStyle = 'rgba(10,6,16,.25)'; g.beginPath(); g.ellipse(cx + 4, cy + 3, 7, 4, 0, 0, Math.PI * 2); g.fill(); }
      }
    }
  }

  /* ── 넓은 색 얼룩: 칸보다 큰 밝고 어두운 무늬를 부드럽게 ── */
  function patches(w, h, seed) {
    const c = document.createElement('canvas');
    const cw = Math.ceil(w / 3) + 2, ch = Math.ceil(h / 3) + 2;
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    const img = g.createImageData(cw, ch);
    const r = makeRng(seed);
    for (let i = 0; i < cw * ch; i++) {
      const v = r.next();
      img.data[i * 4] = v > 0.5 ? 255 : 0; img.data[i * 4 + 1] = v > 0.5 ? 240 : 0; img.data[i * 4 + 2] = v > 0.5 ? 200 : 20;
      img.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 255);
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* ── 구름 그림자 한 장(부드러운 타원) ── */
  let cloud = null;
  function cloudTex() {
    if (cloud) return cloud;
    cloud = document.createElement('canvas'); cloud.width = 256; cloud.height = 160;
    const g = cloud.getContext('2d');
    for (const [x, y, rx, ry] of [[128, 80, 100, 50], [80, 70, 60, 40], [180, 90, 60, 38], [130, 60, 70, 40]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, 'rgba(10,8,30,.55)'); gr.addColorStop(1, 'rgba(10,8,30,0)');
      g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    return cloud;
  }

  return { building, wallTop, wallDeco, decal, patches, cloudTex, hsh, RISE, EAVE, doorAt: door };
})();
