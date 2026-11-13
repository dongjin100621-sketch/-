'use strict';
/* 그림 도구: 도트 자료 → 캔버스, 아이콘, 지역별 타일, 캔버스 해상도 맞추기 */

const Gfx = (() => {
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PALRGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hexRgb(v)]));
  const cache = new Map();

  function rowsOf(name) {
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
  function sprite(name, mode = '') {
    const key = name + '|' + mode;
    let c = cache.get(key);
    if (c) return c;
    const rows = rowsOf(name);
    if (!rows) return null;
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

  /* DOM 용 아이콘 (data URL) */
  const iconCache = new Map();
  function icon(name, px = 32, mode = '') {
    const key = name + '@' + px + mode;
    if (iconCache.has(key)) return iconCache.get(key);
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

  /* 타일 한 장(16×16)을 그리는 함수들. 지역 색으로 칠한다 */
  function mk(fn) { const c = document.createElement('canvas'); c.width = c.height = 16; fn(c.getContext('2d')); return c; }
  const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  function shade(hex, f) {
    const [a, b, c] = hexRgb(hex);
    const k = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${k(a)},${k(b)},${k(c)})`;
  }
  const tileCache = new Map();
  function tiles(theme) {
    if (tileCache.has(theme)) return tileCache.get(theme);
    const th = THEMES[theme];
    const r = makeRng(theme.length * 131 + theme.charCodeAt(0));
    const out = { ground: [], ground2: null, path: null, water: [], wall: [], wallTop: null, roof: null, house: null, carpet: null, bridge: null };
    const isFloor = th.dark;
    for (let v = 0; v < 4; v++) out.ground.push(mk(g => {
      const base = th.ground[v];
      g.fillStyle = base; g.fillRect(0, 0, 16, 16);
      if (isFloor) {
        g.fillStyle = shade(base, 0.82); g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16);
        if (v % 2) g.fillRect(0, 7, 15, 1);
        g.fillStyle = shade(base, 1.1); g.fillRect(0, 0, 15, 1); g.fillRect(0, 0, 1, 15);
      }
      for (let k = 0; k < 10; k++) px(g, r.int(0, 15), r.int(0, 15), shade(base, r.chance(0.5) ? 0.86 : 1.12));
      if (!isFloor && (theme === 'village' || theme === 'forest' || theme === 'swamp')) {
        for (let k = 0; k < 3; k++) { const x = r.int(1, 14), y = r.int(2, 14); px(g, x, y, shade(base, 1.25)); px(g, x, y - 1, shade(base, 1.18)); }
      }
    }));
    out.ground2 = mk(g => {
      g.fillStyle = th.ground2; g.fillRect(0, 0, 16, 16);
      for (let k = 0; k < 14; k++) px(g, r.int(0, 15), r.int(0, 15), shade(th.ground2, r.chance(0.5) ? 0.85 : 1.15));
    });
    out.path = mk(g => {
      g.fillStyle = th.path; g.fillRect(0, 0, 16, 16);
      for (let k = 0; k < 14; k++) px(g, r.int(0, 15), r.int(0, 15), shade(th.path, r.chance(0.5) ? 0.86 : 1.12));
      for (let k = 0; k < 3; k++) { const x = r.int(1, 13), y = r.int(1, 13); g.fillStyle = shade(th.path, 1.2); g.fillRect(x, y, 2, 1); g.fillStyle = th.pathEdge; g.fillRect(x, y + 1, 2, 1); }
    });
    for (let f = 0; f < 2; f++) out.water.push(mk(g => {
      g.fillStyle = th.water[0]; g.fillRect(0, 0, 16, 16);
      g.fillStyle = th.water[1];
      for (let y = 0; y < 16; y += 4) g.fillRect(((y / 4 + f) % 2) * 6, y + 1, 7, 1);
      g.fillStyle = th.water[2];
      g.fillRect(2 + f * 5, 3 + f * 6, 3, 1); g.fillRect(10 - f * 6, 10 - f * 4, 2, 1);
    }));
    for (let v = 0; v < 3; v++) out.wall.push(mk(g => {
      g.fillStyle = th.mortar; g.fillRect(0, 0, 16, 16);
      for (let row = 0; row < 4; row++) {
        const y = row * 4, off = row % 2 ? 4 : 0;
        for (let bx = -off; bx < 16; bx += 8) {
          const col = th.wall[r.int(0, th.wall.length - 1)];
          g.fillStyle = col; g.fillRect(bx + 1, y + 1, 7, 3);
          g.fillStyle = shade(col, 1.15); g.fillRect(bx + 1, y + 1, 7, 1);
        }
      }
      if (v === 1) { g.fillStyle = shade(th.mortar, 0.7); g.fillRect(r.int(3, 11), 5, 1, 5); }
    }));
    out.wallTop = mk(g => {
      g.fillStyle = shade(th.wall[0], 0.55); g.fillRect(0, 0, 16, 16);
      for (let k = 0; k < 8; k++) px(g, r.int(0, 15), r.int(0, 15), shade(th.wall[0], 0.7));
    });
    out.roof = mk(g => {
      const [a, b, c] = th.roof.length >= 3 ? th.roof : [th.roof[0], shade(th.roof[0], 0.8), shade(th.roof[0], 1.2)];
      g.fillStyle = b; g.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 4) {
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = -off; x < 16; x += 8) { g.fillStyle = a; g.fillRect(x + 1, y, 6, 3); g.fillStyle = c; g.fillRect(x + 1, y, 6, 1); }
      }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 14, 16, 2);
    });
    out.house = mk(g => {
      g.fillStyle = th.house[0]; g.fillRect(0, 0, 16, 16);
      g.fillStyle = th.house[1] || shade(th.house[0], 0.85);
      for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
      g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 16, 2);
    });
    out.carpet = mk(g => {
      g.fillStyle = th.carpet; g.fillRect(0, 0, 16, 16);
      g.fillStyle = shade(th.carpet, 1.25); g.fillRect(0, 1, 16, 1); g.fillRect(0, 14, 16, 1);
      g.fillStyle = shade(th.carpet, 0.8);
      for (let k = 0; k < 6; k++) px(g, r.int(0, 15), r.int(3, 12), shade(th.carpet, 0.85));
    });
    out.bridge = mk(g => {
      g.fillStyle = '#6e4228'; g.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 4) { g.fillStyle = '#a8703f'; g.fillRect(0, y, 16, 3); g.fillStyle = '#d9a866'; g.fillRect(0, y, 16, 1); }
      g.fillStyle = '#3e2418'; g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    });
    out.pillar = mk(g => {
      const c = th.wall[0];
      g.fillStyle = shade(c, 0.6); g.fillRect(3, 0, 10, 16);
      g.fillStyle = shade(c, 1.1); g.fillRect(4, 1, 8, 14);
      g.fillStyle = shade(c, 1.35); g.fillRect(5, 1, 2, 14);
      g.fillStyle = shade(c, 0.8); g.fillRect(10, 1, 2, 14);
      g.fillStyle = shade(c, 0.6); g.fillRect(2, 0, 12, 2); g.fillRect(2, 14, 12, 2);
    });
    out.crystal = mk(g => { g.drawImage(sprite(theme === 'tower' ? 'crystal_gold' : 'crystal'), 0, 0); });
    tileCache.set(theme, out);
    return out;
  }

  return { sprite, icon, face, fit, tiles, size, rowsOf, THEMES, hexRgb, shade };
})();
