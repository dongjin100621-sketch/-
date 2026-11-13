'use strict';
/* 그림 도구: 도트 자료 → 캔버스, 아이콘, 지역별 타일, 캔버스 해상도 맞추기 */

const Gfx = (() => {
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PALRGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hexRgb(v)]));
  const cache = new Map();

  /* 고해상도 캐릭터(chars.js): 그림마다 제 색표를 가진다 */
  const HDA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-/:;<=>?@[]^_{|}~';
  const hdPal = new Map();
  const isHD = (name) => typeof HD !== 'undefined' && !!HD[name];
  function palOf(name) {
    if (!isHD(name)) return PALRGB;
    let p = hdPal.get(name);
    if (p) return p;
    const s = HD[name].pal;
    p = {};
    for (let i = 0; i * 6 < s.length; i++) p[HDA[i]] = hexRgb('#' + s.slice(i * 6, i * 6 + 6));
    hdPal.set(name, p);
    return p;
  }
  function rowsOf(name) {
    if (isHD(name)) return HD[name].rows;
    if (SPR[name]) return SPR[name];
    if (SPR32[name]) return SPR32[name];
    if (ICON8[name]) return ICON8[name];
    const rc = RECOLOR[name];
    if (rc) {
      const base = rowsOf(rc[0]);
      return base && base.map(r => [...r].map(c => rc[1][c] ?? c).join(''));
    }
    return null;
  }
  const size = (name) => { const r = rowsOf(name); return r ? r.length : 16; };

  /* mode: f 좌우 뒤집기, w 흰 실루엣, k 검은 실루엣, g 회색, o 금빛 테두리만, r 붉은 기운 */
  /* EPX: 16 밀도 그림을 32 밀도로 부드럽게 키운다 */
  function epx(rows) {
    const h = rows.length, w = rows[0].length, out = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '.' : rows[y][x];
    for (let y = 0; y < h; y++) {
      let r1 = '', r2 = '';
      for (let x = 0; x < w; x++) {
        const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        r1 += (C === A && C !== D && A !== B ? A : P) + (A === B && A !== C && B !== D ? B : P);
        r2 += (D === C && D !== B && C !== A ? C : P) + (B === D && B !== A && D !== C ? D : P);
      }
      out.push(r1, r2);
    }
    return out;
  }
  function sprite(name, mode = '') {
    const key = name + '|' + mode;
    let c = cache.get(key);
    if (c) return c;
    let rows = rowsOf(name);
    if (rows && mode.includes('x')) rows = epx(rows);
    if (!rows) return null;
    const PALRGB = palOf(name);
    const h = rows.length, w = rows[0].length;
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const flip = mode.includes('f');
    const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '.' : rows[y][x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = flip ? w - 1 - x : x;
      const ch = get(sx, y);
      let rgb;
      if (mode.includes('o')) {
        if (ch === '.' && (get(sx - 1, y) !== '.' || get(sx + 1, y) !== '.' || get(sx, y - 1) !== '.' || get(sx, y + 1) !== '.')) rgb = [255, 220, 90];
        else continue;
      } else {
        if (ch === '.') continue;
        rgb = PALRGB[ch];
        if (mode.includes('w')) rgb = [255, 255, 255];
        else if (mode.includes('k')) rgb = [14, 11, 22];
        else if (mode.includes('g')) { const l = (rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11) * 0.8; rgb = [l, l, l * 1.05]; }
        else if (mode.includes('r')) rgb = [Math.min(255, rgb[0] * 0.6 + 120), rgb[1] * 0.5, rgb[2] * 0.5];
      }
      const i = (y * w + x) * 4;
      img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    cache.set(key, c);
    return c;
  }

  /* DOM 용 아이콘 (data URL). img 는 CSS 로 크기를 정하므로, 고해상도 그림은 화면 밀도만큼 크게 만든다 */
  const iconCache = new Map();
  const DPR = () => Math.min(3, window.devicePixelRatio || 1);
  function hiRes(src, sx, sy, sw, sh, px, mode, key) {
    const k = Math.max(1, Math.ceil(px * DPR() / Math.max(sw, sh)));
    const c = document.createElement('canvas');
    const side = Math.max(sw, sh) * k;
    c.width = c.height = side;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, sx, sy, sw, sh, (side - sw * k) >> 1, (side - sh * k) >> 1, sw * k, sh * k);
    const url = c.toDataURL();
    iconCache.set(key, url);
    return url;
  }
  /* 초상(48×48 흉상) — 일행 목록·대화창 */
  function portrait(name, px = 96, mode = '') {
    const key = 'pt:' + name + '@' + px + mode;
    if (iconCache.has(key)) return iconCache.get(key);
    const id = isHD('pt_' + name) ? 'pt_' + name : null;
    if (!id) return face(name, px, mode);
    const s = sprite(id, mode);
    return hiRes(s, 0, 0, s.width, s.height, px, mode, key);
  }
  function icon(name, px = 32, mode = '') {
    const key = name + '@' + px + mode;
    if (iconCache.has(key)) return iconCache.get(key);
    if (isHD('pt_' + name)) return portrait(name, px, mode);
    if (isHD(name)) { const s = sprite(name, mode); return hiRes(s, 0, 0, s.width, s.height, px, mode, key); }
    const s = sprite(name, mode);
    if (!s) return '';
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const k = Math.max(1, Math.floor(px / Math.max(s.width, s.height)));
    g.drawImage(s, (px - s.width * k) >> 1, (px - s.height * k) >> 1, s.width * k, s.height * k);
    const url = c.toDataURL();
    iconCache.set(key, url);
    return url;
  }
  /* 얼굴만 잘라 낸 작은 초상 (16×16 그림의 위쪽 10줄) */
  function face(name, px = 30, mode = '') {
    const key = 'face:' + name + '@' + px + mode;
    if (iconCache.has(key)) return iconCache.get(key);
    if (isHD('pt_' + name)) {
      // 초상에서 얼굴 둘레(32×32)만
      const s = sprite('pt_' + name, mode);
      return hiRes(s, 8, 4, 32, 32, px, mode, key);
    }
    const s = sprite(name, mode);
    if (!s) return '';
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const big = s.width > 16;
    const cw = big ? 20 : 12, ch = big ? 20 : 12;
    const sx = big ? 6 : 2, sy = big ? 0 : 1;
    g.drawImage(s, sx, sy, cw, ch, 0, 0, px, px);
    const url = c.toDataURL();
    iconCache.set(key, url);
    return url;
  }

  /* 캔버스를 기기 해상도에 맞춘다. 돌려주는 값: CSS 크기와 dpr */
  function fit(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    return { W, H, cssW: r.width, cssH: r.height, dpr };
  }

  /* ── 지역별 색 ── */
  const THEMES = {
    village: { ground: ['#5f9f49', '#5a9844', '#64a54e', '#5c9b46'], ground2: '#518c3e', path: '#bf9560', pathEdge: '#a47c4c', water: ['#3b78c2', '#4a8ad0', '#9fd0f2'],
      wall: ['#8d8798', '#7b7588', '#a29db0'], mortar: '#4a4458', roof: ['#b5493a', '#953a30', '#d0644e'], house: ['#e6d1a3', '#c9b07f'], tree: 'tree', tree2: 'pine', cactus: 'cactus', deco: 'flowers', rubble: 'skull', carpet: '#a63240' },
    forest: { ground: ['#4c8a3c', '#478437', '#529040', '#4a8739'], ground2: '#3d7431', path: '#9b7a4c', pathEdge: '#7f6340', water: ['#2f6aa8', '#3e7cbc', '#8cc4ea'],
      wall: ['#5a6a4a'], mortar: '#2c3424', roof: ['#b5493a', '#953a30', '#d0644e'], house: ['#e6d1a3', '#c9b07f'], tree: 'tree', tree2: 'pine', cactus: 'bush', deco: 'flowers', rubble: 'mushroom', carpet: '#a63240' },
    desert: { ground: ['#e3c27f', '#dcba76', '#e8c987', '#dfbe7a'], ground2: '#d2ad69', path: '#c49a5c', pathEdge: '#a98250', water: ['#2f86b8', '#3f98c8', '#a8e0f4'],
      wall: ['#c9a466', '#b8955a', '#d8b676'], mortar: '#7a5c34', roof: ['#d28a3e', '#b06e2c', '#e8a458'], house: ['#efdcae', '#d6bf8a'], tree: 'cactus', tree2: 'cactus', cactus: 'cactus', deco: 'grass', rubble: 'skull', carpet: '#a63240' },
    tomb: { ground: ['#c9a96e', '#c2a167', '#cfb076', '#c5a56a'], ground2: '#b8975e', path: '#b08b52', pathEdge: '#957443', water: ['#2f86b8', '#3f98c8', '#a8e0f4'],
      wall: ['#a07c48', '#8e6c3e', '#b28c56'], mortar: '#4e3820', roof: ['#d28a3e'], house: ['#efdcae'], tree: 'cactus', tree2: 'cactus', cactus: 'cactus', deco: 'grass', rubble: 'skull', carpet: '#8c2a34', dark: true },
    snow: { ground: ['#e9eff6', '#e2e9f2', '#f1f5fa', '#e5ecf4'], ground2: '#d4dde9', path: '#b9c6d8', pathEdge: '#a3b2c8', water: ['#4f86b8', '#5e96c8', '#c4e6f8'],
      wall: ['#8a94a8', '#7a8498', '#9aa4b8'], mortar: '#4a5064', roof: ['#6a4a8a', '#523a6e', '#e9eff6'], house: ['#a8784c', '#8a603c'], tree: 'pine_snow', tree2: 'pine_snow', cactus: 'bush_snow', deco: 'crystal', rubble: 'rock_ice', carpet: '#a63240' },
    ice: { ground: ['#b6dcef', '#acd4ea', '#c0e2f3', '#b0d8ec'], ground2: '#9fcbe4', path: '#d6ecf7', pathEdge: '#b0d4e8', water: ['#2b5f9a', '#3a70aa', '#9fd0f2'],
      wall: ['#5d8fc0', '#4f7fb0', '#6fa0cf'], mortar: '#2a4468', roof: ['#6a4a8a'], house: ['#a8784c'], tree: 'pine_snow', tree2: 'pine_snow', cactus: 'bush_snow', deco: 'crystal', rubble: 'crystal', carpet: '#a63240', dark: true },
    swamp: { ground: ['#5e7a4c', '#587446', '#647f52', '#5b7749'], ground2: '#4e6840', path: '#7d7050', pathEdge: '#655a40', water: ['#3e5c52', '#4a6a5e', '#88b0a0'],
      wall: ['#6a6478', '#5a5468', '#7a7488'], mortar: '#2e2a3a', roof: ['#4a4a72', '#3a3a5c', '#5e5e8a'], house: ['#bdb4a2', '#9f9684'], tree: 'tree_dead', tree2: 'pine', cactus: 'bush', deco: 'mushroom', rubble: 'skull', carpet: '#7a2a4a' },
    tower: { ground: ['#4e3e70', '#4a3a6a', '#544476', '#48386a'], ground2: '#40325e', path: '#5a4a80', pathEdge: '#4a3c6c', water: ['#3a2a6a', '#4a3a7a', '#a090e0'],
      wall: ['#3a2e58', '#32284e', '#44386a'], mortar: '#1a1430', roof: ['#4a4a72'], house: ['#bdb4a2'], tree: 'crystal', tree2: 'crystal', cactus: 'crystal', deco: 'crystal', rubble: 'skull', carpet: '#8a2440', dark: true },
    dusk: { ground: ['#5c3440', '#56303c', '#623844', '#58323e'], ground2: '#4c2a36', path: '#6c3c46', pathEdge: '#5a3038', water: ['#c2401f', '#e0602c', '#ffd070'],
      wall: ['#3a1e2c', '#321a26', '#4a2636'], mortar: '#160a12', roof: ['#4a4a72'], house: ['#bdb4a2'], tree: 'tree_dusk', tree2: 'tree_dusk', cactus: 'tree_dusk', deco: 'ember', rubble: 'skull', carpet: '#c0552a', dark: true }
  };

  /* 타일 한 장(32×32)을 그리는 함수들. 지역 색으로 칠한다(사람 그림과 같은 2배 밀도) */
  const TP = 32;
  function mk(fn) { const c = document.createElement('canvas'); c.width = c.height = TP; fn(c.getContext('2d')); return c; }
  const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  function shade(hex, f) {
    const [a, b, c] = hexRgb(hex);
    const k = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${k(a)},${k(b)},${k(c)})`;
  }
  /* 색조를 살짝 틀어 어둡게/밝게: 어두울수록 푸르게, 밝을수록 노랗게 */
  function tone(hex, f) {
    const [a, b, c] = hexRgb(hex);
    const k = (v) => Math.max(0, Math.min(255, Math.round(v)));
    if (f < 1) return `rgb(${k(a * f * 0.94)},${k(b * f * 0.98)},${k(c * f + (1 - f) * 28)})`;
    return `rgb(${k(a * f + (f - 1) * 30)},${k(b * f + (f - 1) * 18)},${k(c * f - (f - 1) * 10)})`;
  }
  const GRASSY = new Set(['village', 'forest', 'swamp']);
  const tileCache = new Map();
  function tiles(theme) {
    if (tileCache.has(theme)) return tileCache.get(theme);
    const th = THEMES[theme];
    const r = makeRng(theme.length * 131 + theme.charCodeAt(0));
    const out = { ground: [], ground2: null, path: null, water: [], wall: [], wallTop: null, roof: null, house: null, carpet: null, bridge: null };
    const isFloor = th.dark;
    const tuft = (g, x, y, base) => {
      px(g, x, y - 2, tone(base, 1.28)); px(g, x, y - 1, tone(base, 1.12));
      px(g, x - 1, y, tone(base, 0.8)); px(g, x + 1, y, tone(base, 0.8)); px(g, x, y, tone(base, 0.86));
      px(g, x - 2, y - 1, tone(base, 1.15)); px(g, x + 2, y - 1, tone(base, 1.08));
    };
    for (let v = 0; v < 4; v++) out.ground.push(mk(g => {
      const base = th.ground[0];
      g.fillStyle = base; g.fillRect(0, 0, TP, TP);
      if (isFloor) {
        // 돌판 2×2: 왼쪽 위는 밝게, 오른쪽 아래는 어둡게
        for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) {
          const X = bx * 16 + (by && v % 2 ? 8 : 0), Y = by * 16;
          const col = shade(base, 0.94 + r.next() * 0.1);
          g.fillStyle = col; g.fillRect(X, Y, 16, 16); g.fillRect(X - 16, Y, 16, 16);
          g.fillStyle = tone(base, 1.14); g.fillRect(X, Y, 15, 1); g.fillRect(X, Y, 1, 15); g.fillRect(X - 16, Y, 15, 1);
          g.fillStyle = tone(base, 0.74); g.fillRect(X, Y + 15, 16, 1); g.fillRect(X + 15, Y, 1, 16); g.fillRect(X - 16, Y + 15, 16, 1); g.fillRect(X - 1, Y, 1, 16);
        }
        for (let k = 0; k < 24; k++) px(g, r.int(0, 31), r.int(0, 31), tone(base, r.chance(0.5) ? 0.88 : 1.1));
        if (v === 3) { g.fillStyle = tone(base, 0.7); let x = r.int(4, 24), y = r.int(4, 24); for (let k = 0; k < 6; k++) { g.fillRect(x, y, 1, 1); x += r.int(0, 1); y += 1; } }
        return;
      }
      for (let k = 0; k < 70; k++) px(g, r.int(0, 31), r.int(0, 31), tone(base, r.chance(0.5) ? 0.9 : 1.08));
      if (GRASSY.has(theme)) {
        for (let k = 0; k < 7; k++) tuft(g, r.int(2, 29), r.int(3, 30), base);
        if (theme === 'village' && v === 2) for (let k = 0; k < 2; k++) { const x = r.int(3, 28), y = r.int(3, 28); px(g, x, y, '#f6f0ff'); px(g, x + 1, y, '#ffd447'); }
      } else if (theme === 'desert' || theme === 'tomb') {
        for (let k = 0; k < 3; k++) { const y = r.int(3, 29), x0 = r.int(0, 18), L = r.int(6, 12); for (let x = x0; x < x0 + L; x++) { px(g, x, y + (x % 6 < 3 ? 0 : 1), tone(base, 1.1)); px(g, x, y + 1 + (x % 6 < 3 ? 0 : 1), tone(base, 0.88)); } }
        if (v === 1) { const x = r.int(4, 26), y = r.int(4, 26); px(g, x, y, tone(base, 0.7)); px(g, x + 1, y, tone(base, 0.8)); px(g, x, y - 1, tone(base, 1.2)); }
      } else if (theme === 'snow') {
        for (let k = 0; k < 3; k++) { const x = r.int(3, 26), y = r.int(4, 28); g.fillStyle = tone(base, 0.93); g.fillRect(x, y, 5, 1); g.fillRect(x + 1, y - 1, 3, 1); }
        for (let k = 0; k < 3; k++) px(g, r.int(1, 30), r.int(1, 30), '#ffffff');
      }
    }));
    out.ground2 = mk(g => {
      const b = th.ground2;
      g.fillStyle = b; g.fillRect(0, 0, TP, TP);
      for (let k = 0; k < 60; k++) px(g, r.int(0, 31), r.int(0, 31), tone(b, r.chance(0.5) ? 0.86 : 1.12));
      if (GRASSY.has(theme)) for (let k = 0; k < 12; k++) tuft(g, r.int(2, 29), r.int(3, 30), b);
    });
    out.path = mk(g => {
      const b = th.path;
      g.fillStyle = b; g.fillRect(0, 0, TP, TP);
      if (isFloor) {
        for (let y = 0; y < TP; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < TP; x += 16) {
          g.fillStyle = shade(b, 0.95 + r.next() * 0.1); g.fillRect(x + 1, y + 1, 14, 6);
          g.fillStyle = tone(b, 1.15); g.fillRect(x + 1, y + 1, 14, 1);
          g.fillStyle = tone(b, 0.78); g.fillRect(x + 1, y + 7, 15, 1);
        }
        return;
      }
      for (let k = 0; k < 60; k++) px(g, r.int(0, 31), r.int(0, 31), tone(b, r.chance(0.5) ? 0.88 : 1.1));
      for (let k = 0; k < 6; k++) {
        const x = r.int(1, 28), y = r.int(1, 28), w = r.int(2, 3);
        g.fillStyle = tone(b, 1.22); g.fillRect(x, y, w, 1);
        g.fillStyle = tone(b, 1.05); g.fillRect(x, y + 1, w, 1);
        g.fillStyle = tone(b, 0.72); g.fillRect(x, y + 2, w, 1);
      }
    });
    for (let f = 0; f < 2; f++) out.water.push(mk(g => {
      const [w0, w1, w2] = th.water;
      g.fillStyle = w0; g.fillRect(0, 0, TP, TP);
      for (let k = 0; k < 30; k++) px(g, r.int(0, 31), r.int(0, 31), tone(w0, 0.92));
      g.fillStyle = w1;
      for (let y = 2; y < TP; y += 6) { const o = ((y / 6 + f) % 2) * 9 + (y % 12 ? 3 : 0); g.fillRect(o, y, 9, 1); g.fillRect(o + 16, y, 7, 1); g.fillRect(o + 1, y - 1, 6, 1); }
      g.fillStyle = w2;
      g.fillRect(4 + f * 9, 6 + f * 12, 3, 1); g.fillRect(20 - f * 11, 21 - f * 8, 2, 1); g.fillRect(26 - f * 4, 11 + f * 3, 1, 1);
    }));
    for (let v = 0; v < 3; v++) out.wall.push(mk(g => {
      g.fillStyle = th.mortar; g.fillRect(0, 0, TP, TP);
      for (let row = 0; row < 4; row++) {
        const y = row * 8, off = row % 2 ? 8 : 0;
        for (let bx = -off; bx < TP; bx += 16) {
          const col = th.wall[r.int(0, th.wall.length - 1)];
          g.fillStyle = col; g.fillRect(bx + 1, y + 1, 15, 6);
          g.fillStyle = tone(col, 1.18); g.fillRect(bx + 1, y + 1, 15, 1); g.fillRect(bx + 1, y + 1, 1, 6);
          g.fillStyle = tone(col, 0.8); g.fillRect(bx + 1, y + 6, 15, 1); g.fillRect(bx + 15, y + 1, 1, 6);
          for (let k = 0; k < 3; k++) px(g, bx + r.int(3, 13), y + r.int(2, 5), tone(col, r.chance(0.5) ? 0.88 : 1.1));
        }
      }
      if (v === 1) { g.fillStyle = shade(th.mortar, 0.7); let x = r.int(6, 24); for (let y = 9; y < 22; y++) { g.fillRect(x, y, 1, 1); if (y % 3 === 0) x += r.chance(0.5) ? 1 : -1; } }
      if (v === 2 && GRASSY.has(theme)) { for (let k = 0; k < 9; k++) px(g, r.int(0, 31), r.int(18, 31), r.chance(0.5) ? '#3f7a3a' : '#5a9a48'); }
    }));
    out.wallTop = mk(g => {
      const b = shade(th.wall[0], 0.58);
      g.fillStyle = b; g.fillRect(0, 0, TP, TP);
      for (let k = 0; k < 40; k++) px(g, r.int(0, 31), r.int(0, 31), tone(th.wall[0], r.chance(0.5) ? 0.5 : 0.68));
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, TP, 2);
    });
    out.roof = mk(g => {
      const [a, b, c] = th.roof.length >= 3 ? th.roof : [th.roof[0], shade(th.roof[0], 0.8), shade(th.roof[0], 1.2)];
      g.fillStyle = b; g.fillRect(0, 0, TP, TP);
      for (let y = 0; y < TP; y += 6) {
        const off = (y / 6) % 2 ? 4 : 0;
        for (let x = -off; x < TP; x += 8) {
          g.fillStyle = a; g.fillRect(x + 1, y, 7, 5);
          g.fillStyle = c; g.fillRect(x + 1, y, 7, 1); g.fillRect(x + 1, y, 1, 4);
          g.fillStyle = tone(a, 0.78); g.fillRect(x + 2, y + 4, 6, 1);
        }
      }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 28, TP, 4);
    });
    out.house = mk(g => {
      const [h0, h1] = [th.house[0], th.house[1] || shade(th.house[0], 0.85)];
      g.fillStyle = h0; g.fillRect(0, 0, TP, TP);
      for (let k = 0; k < 30; k++) px(g, r.int(0, 31), r.int(0, 31), tone(h0, r.chance(0.5) ? 0.94 : 1.05));
      g.fillStyle = tone(h1, 0.75); g.fillRect(0, 0, 3, TP); g.fillRect(29, 0, 3, TP); g.fillRect(0, 14, TP, 3);
      g.fillStyle = tone(h1, 1.0); g.fillRect(1, 0, 1, TP); g.fillRect(30, 0, 1, TP); g.fillRect(0, 15, TP, 1);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, TP, 3);
    });
    out.carpet = mk(g => {
      const c = th.carpet;
      g.fillStyle = c; g.fillRect(0, 0, TP, TP);
      g.fillStyle = tone(c, 0.85);
      for (let y = 4; y < TP; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < TP; x += 8) { g.fillRect(x + 2, y, 3, 1); g.fillRect(x + 3, y - 1, 1, 3); }
      g.fillStyle = '#e8b84a'; g.fillRect(0, 2, TP, 1); g.fillRect(0, 29, TP, 1);
      g.fillStyle = tone(c, 1.2); g.fillRect(0, 3, TP, 1);
      g.fillStyle = tone(c, 0.7); g.fillRect(0, 28, TP, 1);
    });
    out.bridge = mk(g => {
      g.fillStyle = '#4a2c1a'; g.fillRect(0, 0, TP, TP);
      for (let x = 2; x < 30; x += 7) {
        g.fillStyle = '#a8703f'; g.fillRect(x, 0, 6, TP);
        g.fillStyle = '#c8905a'; g.fillRect(x, 0, 1, TP);
        g.fillStyle = '#7a4a2a'; g.fillRect(x + 5, 0, 1, TP);
        px(g, x + 2, 4, '#3e2418'); px(g, x + 2, 27, '#3e2418');
      }
      g.fillStyle = '#3e2418'; g.fillRect(0, 0, 2, TP); g.fillRect(30, 0, 2, TP);
    });
    out.pillar = mk(g => {
      const c = th.wall[0];
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(9, 26, 20, 6);
      g.fillStyle = tone(c, 0.6); g.fillRect(7, 2, 18, 28);
      g.fillStyle = tone(c, 1.05); g.fillRect(8, 3, 16, 26);
      g.fillStyle = tone(c, 1.32); g.fillRect(10, 3, 3, 26);
      g.fillStyle = tone(c, 0.82); g.fillRect(19, 3, 4, 26);
      g.fillStyle = tone(c, 0.92); g.fillRect(15, 3, 1, 26);
      g.fillStyle = tone(c, 0.7); g.fillRect(5, 0, 22, 4); g.fillRect(5, 27, 22, 4);
      g.fillStyle = tone(c, 1.15); g.fillRect(5, 0, 22, 1); g.fillRect(5, 27, 22, 1);
    });
    out.crystal = sprite(theme === 'tower' ? 'o_save_gold' : 'o_save');
    tileCache.set(theme, out);
    return out;
  }

  /* 경계 덮개: 이웃 칸(8방향 비트)이 다른 땅이면, 그 땅이 이 칸 가장자리로 들쭉날쭉 번져 든다.
     kind: 'path'(풀→길), 'water'(물가), 'floor'(벽 아래 그늘) */
  const edgeCache = new Map(), srcData = new WeakMap();
  const NB = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  function edge(theme, kind, mask, src) {
    const key = theme + kind + mask;
    let c = edgeCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = TP;
    const g = c.getContext('2d');
    const img = g.createImageData(TP, TP);
    let sd = srcData.get(src);
    if (!sd) { sd = src.getContext('2d').getImageData(0, 0, TP, TP).data; srcData.set(src, sd); }
    const th = THEMES[theme];
    const noise = (x, y) => { const h = ((x * 374761393 + y * 668265263 + mask * 2654435761) >>> 0) % 1000; return h / 1000; };
    const rim = hexRgb(kind === 'water' ? th.water[2] : th.pathEdge);
    for (let y = 0; y < TP; y++) for (let x = 0; x < TP; x++) {
      let d = 99;
      for (let k = 0; k < 8; k++) {
        if (!(mask & (1 << k))) continue;
        const [dx, dy] = NB[k];
        let e;
        if (dx === 0) e = dy < 0 ? y : TP - 1 - y;
        else if (dy === 0) e = dx < 0 ? x : TP - 1 - x;
        else { const ex = dx < 0 ? x : TP - 1 - x, ey = dy < 0 ? y : TP - 1 - y; e = Math.hypot(ex, ey) - 1; }
        d = Math.min(d, e);
      }
      if (d > 9) continue;
      const wob = Math.sin((x + y) * 0.9 + mask) * 0.8 + noise(x >> 1, y >> 1) * 1.6;
      const t = (kind === 'water' ? 2.4 : kind === 'soft' ? 5.5 : 3.0) + wob * (kind === 'soft' ? 1.8 : 1);
      const i = (y * TP + x) * 4;
      if (d < t) {
        const edgeLight = d >= t - 1.2;
        img.data[i] = sd[i]; img.data[i + 1] = sd[i + 1]; img.data[i + 2] = sd[i + 2]; img.data[i + 3] = 255;
        if (kind === 'soft') { /* 그대로 */ }
        else if (edgeLight && kind === 'water') { img.data[i] *= 0.62; img.data[i + 1] *= 0.6; img.data[i + 2] *= 0.6; }
        else if (edgeLight) { img.data[i] = Math.min(255, sd[i] * 1.1 + 6); img.data[i + 1] = Math.min(255, sd[i + 1] * 1.1 + 4); img.data[i + 2] = sd[i + 2] * 1.0; }
      } else if (d < t + 1.3 && kind !== 'soft') {
        if (kind === 'water') { img.data[i] = rim[0]; img.data[i + 1] = rim[1]; img.data[i + 2] = rim[2]; img.data[i + 3] = 200; }
        else { img.data[i] = rim[0] * 0.8; img.data[i + 1] = rim[1] * 0.8; img.data[i + 2] = rim[2] * 0.85; img.data[i + 3] = 150; }
      }
    }
    g.putImageData(img, 0, 0);
    edgeCache.set(key, c);
    return c;
  }

  return { sprite, icon, face, portrait, isHD, fit, tiles, edge, size, rowsOf, THEMES, hexRgb, shade, tone, TP };
})();
