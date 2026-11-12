'use strict';
/* 화면 그리기: 도트 그림을 낮은 해상도 캔버스에 그리고 CSS 로 정수배 확대한다.
   게임 규칙은 즉시 바뀌고, 여기서는 Game 이 보낸 사건을 시간에 맞춰 연출한다. */

const Render = (() => {
  const TS = 16;
  let cv, ctx, W = 0, H = 0, scale = 3;
  const cache = new Map();
  let tiles = null, tilesTheme = null;
  let light = null, lightFloor = null;
  const vfx = new Map();       // 액터 연출 상태 (uid → {x,y,...})
  let queue = [];               // 예약된 사건
  let projectiles = [], floats = [], parts = [], slashes = [], dying = [], rings = [], bolts = [];
  let shakeUntil = 0, shakeMag = 0, flash = null, fade = null, busyUntil = 0;
  let cam = { x: 0, y: 0, init: false };
  let marks = [];               // 길 표시 (탭 이동 목적지)

  /* ── 도트 그림 → 캔버스 ── */
  function rowsOf(name) {
    if (SPR[name]) return SPR[name];
    if (SPR32[name]) return SPR32[name];
    const rc = RECOLOR[name];
    if (rc) {
      const base = rowsOf(rc[0]);
      return base.map(r => [...r].map(c => rc[1][c] ?? c).join(''));
    }
    return null;
  }
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PALRGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hexRgb(v)]));

  /* mode: f 뒤집기, w 흰 실루엣, o 금빛 테두리, r1~r3 시계 방향 회전 */
  function sprite(name, mode = '') {
    const key = name + '|' + mode;
    let c = cache.get(key);
    if (c) return c;
    const rows = rowsOf(name);
    if (!rows) return null;
    const n = rows.length;
    c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    const img = g.createImageData(n, n);
    const flip = mode.includes('f');
    const rot = +(mode.match(/r(\d)/)?.[1] || 0);
    const get = (x, y) => (x < 0 || y < 0 || x >= n || y >= n) ? '.' : rows[y][x];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let sx = flip ? n - 1 - x : x, sy = y;
      for (let k = 0; k < rot; k++) { const t = sx; sx = sy; sy = n - 1 - t; }
      let ch = get(sx, sy);
      let rgb = null;
      if (mode.includes('o')) {
        if (ch === '.' && (get(sx - 1, sy) !== '.' || get(sx + 1, sy) !== '.' || get(sx, sy - 1) !== '.' || get(sx, sy + 1) !== '.')) rgb = [255, 212, 71];
        else continue;
      } else {
        if (ch === '.') continue;
        rgb = mode.includes('w') ? [255, 255, 255] : PALRGB[ch];
      }
      const i = (y * n + x) * 4;
      img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    cache.set(key, c);
    return c;
  }

  /* UI 아이콘 (data URL) */
  const iconCache = new Map();
  function icon(name, size = 48) {
    const key = name + '@' + size;
    if (iconCache.has(key)) return iconCache.get(key);
    const s = sprite(name);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(s, 0, 0, size, size);
    const url = c.toDataURL();
    iconCache.set(key, url);
    return url;
  }

  /* ── 테마 타일 (절차적 도트) ── */
  function makeTiles(themeId) {
    const th = THEMES[themeId];
    const r = makeRng(themeId.length * 977 + themeId.charCodeAt(0) * 13);
    const mk = (fn) => { const c = document.createElement('canvas'); c.width = c.height = TS; fn(c.getContext('2d')); return c; };
    const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    const shade = (hex, f) => { const [a, b, c] = hexRgb(hex); const k = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${k(a)},${k(b)},${k(c)})`; };
    const out = { floor: [], front: [], top: null, water: [], lava: [] };

    for (let v = 0; v < 4; v++) out.floor.push(mk(g => {
      const base = th.floor[v % 3];
      g.fillStyle = base; g.fillRect(0, 0, TS, TS);
      if (themeId === 'crypt' || themeId === 'abyss') {
        // 돌판 이음새
        g.fillStyle = th.floor[3];
        g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16);
        if (v % 2) g.fillRect(0, 7, 15, 1);
        g.fillStyle = shade(base, 1.12);
        g.fillRect(0, 0, 15, 1); g.fillRect(0, 0, 1, 15);
      }
      for (let k = 0; k < 9; k++) px(g, r.int(0, 15), r.int(0, 15), shade(base, r.chance(0.5) ? 0.82 : 1.15));
      if (themeId === 'cave' || themeId === 'lava') {
        for (let k = 0; k < 2; k++) {               // 조약돌
          const x = r.int(1, 13), y = r.int(1, 13);
          g.fillStyle = shade(base, 1.22); g.fillRect(x, y, 2, 1);
          g.fillStyle = shade(base, 0.75); g.fillRect(x, y + 1, 2, 1);
        }
      }
      if (themeId === 'lava' && v === 3) { px(g, r.int(2, 13), r.int(2, 13), '#f39236'); }
    }));

    for (let v = 0; v < 3; v++) out.front.push(mk(g => {
      g.fillStyle = th.mortar; g.fillRect(0, 0, TS, TS);
      for (let row = 0; row < 4; row++) {
        const y = row * 4, off = row % 2 ? 4 : 0;
        for (let bx = -off; bx < TS; bx += 8) {
          const col = r.pick(th.brick);
          g.fillStyle = col;
          g.fillRect(bx + 1, y + 1, 7, 3);
          g.fillStyle = shade(col, 1.18);
          g.fillRect(bx + 1, y + 1, 7, 1);
        }
      }
      g.fillStyle = th.wallLine; g.fillRect(0, 0, TS, 2);
      g.fillStyle = shade(th.wallLine, 1.3); g.fillRect(0, 0, TS, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 14, TS, 2);
      if (v === 1) for (let k = 0; k < 7; k++) px(g, r.int(0, 15), r.int(2, 6) + (k > 3 ? r.int(0, 6) : 0), th.moss);
      if (v === 2) { g.fillStyle = shade(th.mortar, 0.8); g.fillRect(r.int(3, 11), 5, 1, 5); }
    }));

    out.top = mk(g => {
      g.fillStyle = th.wallTop; g.fillRect(0, 0, TS, TS);
      for (let k = 0; k < 6; k++) px(g, r.int(0, 15), r.int(0, 15), shade(th.wallTop, 1.5));
    });

    for (let f = 0; f < 2; f++) out.water.push(mk(g => {
      g.fillStyle = '#23508f'; g.fillRect(0, 0, TS, TS);
      g.fillStyle = '#2d62a8';
      for (let y = 0; y < TS; y += 4) g.fillRect(((y / 4 + f) % 2) * 6, y + 1, 7, 1);
      g.fillStyle = '#7fb8e8';
      g.fillRect(2 + f * 5, 3 + f * 6, 3, 1); g.fillRect(10 - f * 6, 10 - f * 4, 2, 1);
    }));
    for (let f = 0; f < 3; f++) out.lava.push(mk(g => {
      g.fillStyle = '#c23a1f'; g.fillRect(0, 0, TS, TS);
      const rr = makeRng(91 + f);
      for (let k = 0; k < 6; k++) { g.fillStyle = '#f0702c'; g.fillRect(rr.int(0, 12), rr.int(0, 13), rr.int(2, 4), 2); }
      for (let k = 0; k < 4; k++) { g.fillStyle = '#ffc23a'; g.fillRect(rr.int(0, 14), rr.int(0, 14), 2, 1); }
      for (let k = 0; k < 3; k++) px(g, rr.int(0, 15), rr.int(0, 15), '#fff0a0');
    }));
    // 옆으로 난 문 (세로 벽에 있는 문)
    out.doorSide = mk(g => {
      g.fillStyle = '#3e2418'; g.fillRect(5, 0, 6, 16);
      g.fillStyle = '#a8703f'; g.fillRect(6, 1, 4, 14);
      g.fillStyle = '#6e4228'; g.fillRect(6, 5, 4, 1); g.fillRect(6, 10, 4, 1);
      g.fillStyle = '#ffd447'; g.fillRect(9, 7, 1, 2);
    });
    out.doorSideOpen = mk(g => {
      g.fillStyle = '#3e2418'; g.fillRect(1, 0, 3, 16);
      g.fillStyle = '#a8703f'; g.fillRect(2, 1, 1, 14);
    });
    return out;
  }

  /* ── 빛 지도: 횃불·용암이 비추는 고정 조명 ── */
  function buildLight(f) {
    light = new Float32Array(f.w * f.h);
    const blocks = (x, y) => OPAQUE.has(f.tiles[y * f.w + x]);
    const add = (sx, sy, rad, amt) => {
      computeFov(sx, sy, Math.ceil(rad), f.w, f.h, blocks, (x, y) => {
        const d = Math.hypot(x - sx, y - sy);
        if (d > rad) return;
        const i = y * f.w + x;
        light[i] = Math.min(1, light[i] + amt * (1 - d / rad));
      });
    };
    for (const i of f.torches) add(i % f.w, ((i / f.w) | 0) + 1, 5, 0.85);
    for (let i = 0; i < f.tiles.length; i++) if (f.tiles[i] === T.LAVA) add(i % f.w, (i / f.w) | 0, 2.6, 0.5);
    if (f.stairs) add(f.stairs.x, f.stairs.y, 2, 0.4);
    lightFloor = f;
  }

  /* ── 3×5 도트 숫자·글자 ── */
  const FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', ' ': '000000000000000', 'G': '111100101101111',
    'M': '101111111101101', 'I': '111010010010111', 'S': '111100111001111', 'L': '100100100100111', 'V': '101101101101010',
    'U': '101101101101111', 'P': '111101111100100', 'Z': '111001010100111', 'E': '111100111100111', 'X': '101101010101101',
    'B': '110101110101110', 'O': '111101101101111', 'A': '010101111101101', 'T': '111010010010010', 'R': '110101110101101',
    'H': '101101111101101', 'N': '110101101101101', 'C': '111100100100111', 'K': '101101110101101', 'D': '110101101101110'
  };
  function drawText(str, x, y, color, big = 1) {
    const w = str.length * 4 * big - big;
    x = Math.round(x - w / 2); y = Math.round(y);
    const pass = (col, ox, oy) => {
      ctx.fillStyle = col;
      for (let k = 0; k < str.length; k++) {
        const gl = FONT[str[k]] || FONT[' '];
        for (let i = 0; i < 15; i++) if (gl[i] === '1') ctx.fillRect(x + k * 4 * big + (i % 3) * big + ox, y + ((i / 3) | 0) * big + oy, big, big);
      }
    };
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pass('#0e0b16', ox, oy);
    pass(color, 0, 0);
  }

  /* ── 크기 ── */
  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d', { alpha: false });
    Game.on(onEvent);
    resize();
  }
  function resize() {
    const box = cv.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const small = Math.min(box.width, box.height);
    const target = small < 520 ? 42 : small < 800 ? 52 : 60;          // 타일 한 칸의 CSS 크기
    scale = Math.max(1, Math.round(target * dpr / TS));               // 기기 픽셀 기준 정수배
    W = Math.ceil(box.width * dpr / scale);
    H = Math.ceil(box.height * dpr / scale);
    cv.width = W; cv.height = H;
    cv.style.width = (W * scale / dpr) + 'px';
    cv.style.height = (H * scale / dpr) + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  /* 화면 좌표(CSS px, 캔버스 기준) → 타일 */
  function screenToTile(cx, cy) {
    const dpr = window.devicePixelRatio || 1;
    const x = cx * dpr / scale + cam.x, y = cy * dpr / scale + cam.y;
    return [Math.floor(x / TS), Math.floor(y / TS)];
  }

  /* ── 사건 받기 ── */
  function onEvent(type, d) {
    const now = performance.now();
    if (type === 'floor' || type === 'load') {
      queue = []; projectiles = []; floats = []; parts = []; slashes = []; dying = []; rings = []; bolts = [];
      vfx.clear(); cam.init = false; marks = [];
      fade = { t0: now, dur: 650, from: 1, to: 0 };
      busyUntil = now + 250;
      return;
    }
    if (type === 'msg') return;
    queue.push({ type, d, at: now + (d.delay || 0) });
  }

  const actorKey = (a) => a.uid;
  function vOf(a) {
    let v = vfx.get(actorKey(a));
    if (!v) { v = { x: a.x * TS, y: a.y * TS, tw: null, bump: null, flash: 0 }; vfx.set(actorKey(a), v); }
    return v;
  }
  const center = (x, y) => [x * TS + 8, y * TS + 8];

  function burst(x, y, colors, n = 10, spd = 1.4, life = 450) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, g: 0.06, c: colors[k % colors.length], t0: performance.now(), life: life * (0.6 + Math.random() * 0.6), sz: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  function sparkle(x, y, colors, n = 12) {
    for (let k = 0; k < n; k++) parts.push({ x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 10, vx: 0, vy: -0.25 - Math.random() * 0.5, g: 0, c: colors[k % colors.length], t0: performance.now() + k * 25, life: 600, sz: 1 });
  }
  function floatText(text, x, y, color, big = 1, life = 850) {
    const now = performance.now();
    // 같은 자리에 겹치면 조금씩 위로 쌓는다
    const near = floats.filter(f => Math.abs(f.x - x) < 14 && Math.abs(f.y0 - y) < 10 && now - f.t0 < 450).length;
    floats.push({ text, x, y: y - near * 7, y0: y, color, big, t0: now, life });
  }
  const shake = (mag, dur) => { shakeMag = Math.max(shakeMag, mag); shakeUntil = Math.max(shakeUntil, performance.now() + dur); };
  const flashScreen = (color, dur = 220, alpha = 0.4) => { flash = { color, t0: performance.now(), dur, alpha }; };

  function runEvent(e, now) {
    const d = e.d, S = Game.S;
    switch (e.type) {
      case 'move': {
        const v = vOf(d.who);
        if (d.instant) { v.x = d.tx * TS; v.y = d.ty * TS; v.tw = null; break; }
        v.tw = { fx: d.fx * TS, fy: d.fy * TS, tx: d.tx * TS, ty: d.ty * TS, t0: now, dur: d.who.uid === 'p' ? 105 : 120 };
        if (d.who.uid === 'p' || Game.isVisible(d.tx, d.ty) || Game.isVisible(d.fx, d.fy)) busyUntil = Math.max(busyUntil, now + (d.who.uid === 'p' ? 95 : 110));
        break;
      }
      case 'teleport': {
        const who = d.who || S.player;
        const v = vOf(who);
        sparkle(...center(d.fx, d.fy), ['#9cd6f0', '#f5f2fb', '#9c66dc']);
        v.x = d.tx * TS; v.y = d.ty * TS; v.tw = null;
        sparkle(...center(d.tx, d.ty), ['#9cd6f0', '#f5f2fb', '#9c66dc']);
        if (who.uid === 'p') { cam.init = false; flashScreen('#9cd6f0', 250, 0.3); }
        break;
      }
      case 'attack': {
        const v = vOf(d.who);
        const dx = Math.sign(d.tx - d.who.x), dy = Math.sign(d.ty - d.who.y);
        v.bump = { dx, dy, t0: now, dur: 150 };
        if (d.who.uid !== 'p' && !Game.isVisible(d.who.x, d.who.y)) break;
        if (d.who.uid === 'p') slashes.push({ x: d.tx, y: d.ty, dx, dy, t0: now + 40, dur: 140 });
        busyUntil = Math.max(busyUntil, now + 140);
        break;
      }
      case 'hit': {
        const t = d.target;
        const v = vOf(t);
        v.flash = now + 110;
        const [cx, cy] = [v.x + 8, v.y + 4];
        const col = t.uid === 'p' ? '#ff6a5a' : d.crit ? '#ffd447' : d.kind === 'fire' ? '#f39236' : d.kind === 'bolt' ? '#9cd6f0' : d.kind === 'poison' ? '#a6dd66' : '#f5f2fb';
        floatText(String(d.dmg) + (d.crit ? '!' : ''), cx, cy - 4, col, d.crit ? 2 : 1);
        if (t.uid === 'p') {
          if (d.kind !== 'poison') { shake(d.dmg >= Game.stats().mhp * 0.15 ? 3 : 2, 160); flashScreen('#a82a34', 160, 0.22); }
          burst(cx, cy + 2, ['#e0503f', '#a82a34'], 6, 1.1);
        } else {
          const m = MONSTERS[t.id];
          const blood = t.id.startsWith('slime') ? ['#56b048', '#a6dd66'] : m?.sfx === 'bone' ? ['#f5f2fb', '#c7c2d8'] : m?.sfx === 'rock' ? ['#8a85a2', '#56506e'] : t.id === 'ghost' ? ['#9cd6f0', '#f5f2fb'] : ['#e0503f', '#a82a34'];
          burst(cx, cy + 2, blood, d.crit ? 14 : 8, d.crit ? 1.8 : 1.2);
          if (d.crit) shake(2, 120);
          if (d.kind === 'fire') burst(cx, cy, ['#ffd447', '#f39236', '#e0503f'], 10, 1.4);
        }
        break;
      }
      case 'miss': {
        const v = vOf(d.target);
        floatText('MISS', v.x + 8, v.y, '#8a85a2');
        break;
      }
      case 'heal': {
        const v = vOf(d.target);
        floatText('+' + d.amount, v.x + 8, v.y, '#a6dd66');
        sparkle(v.x + 8, v.y + 8, ['#a6dd66', '#f5f2fb', '#56b048'], 10);
        break;
      }
      case 'mana': {
        const v = vOf(d.target);
        floatText('+' + d.amount, v.x + 8, v.y, '#4796dc');
        sparkle(v.x + 8, v.y + 8, ['#4796dc', '#9cd6f0'], 8);
        break;
      }
      case 'die': {
        const m = d.m;
        const v = vfx.get(m.uid) || { x: m.x * TS, y: m.y * TS };
        dying.push({ m, x: v.x, y: v.y, t0: now, dur: 380, flip: v.flipX });
        vfx.delete(m.uid);
        burst(v.x + 8, v.y + 10, m.boss ? ['#f5f2fb', '#ffd447', '#e0503f', '#9c66dc'] : ['#f5f2fb', '#8a85a2', '#56506e'], m.boss ? 40 : 12, m.boss ? 2.2 : 1.3, m.boss ? 900 : 500);
        if (m.boss) { shake(5, 600); flashScreen('#f5f2fb', 500, 0.6); }
        break;
      }
      case 'proj': {
        projectiles.push({ spr: d.spr, fx: d.fx * TS, fy: d.fy * TS, tx: d.tx * TS, ty: d.ty * TS, t0: now, dur: d.dur });
        busyUntil = Math.max(busyUntil, now + d.dur);
        break;
      }
      case 'gold': floatText('+' + d.n + 'G', d.x * TS + 8, d.y * TS - 2, '#ffd447'); sparkle(d.x * TS + 8, d.y * TS + 8, ['#ffd447', '#fff4b0'], 6); break;
      case 'levelup': {
        const p = S.player;
        floatText('LEVEL UP', p.x * TS + 8, p.y * TS - 10, '#ffd447', 1, 1400);
        sparkle(p.x * TS + 8, p.y * TS + 8, ['#ffd447', '#fff4b0', '#f5f2fb'], 26);
        flashScreen('#ffd447', 400, 0.25);
        break;
      }
      case 'chest': sparkle(d.x * TS + 8, d.y * TS + 8, ['#ffd447', '#fff4b0'], 14); break;
      case 'trap': {
        const [cx, cy] = center(d.x, d.y);
        if (d.kind === 'poison') burst(cx, cy, ['#a6dd66', '#56b048', '#2a6e38'], 24, 0.8, 900);
        else if (d.kind === 'alarm') { rings.push({ x: cx, y: cy, t0: now, dur: 500, r: 60, c: '#ffd447' }); shake(2, 300); }
        else if (d.kind === 'spike') burst(cx, cy, ['#c7c2d8', '#f5f2fb'], 8, 1);
        break;
      }
      case 'trapFound': floatText('!', d.x * TS + 8, d.y * TS, '#ffd447'); break;
      case 'whirl': rings.push({ x: d.x * TS + 8, y: d.y * TS + 8, t0: now, dur: 260, r: 20, c: '#f5f2fb', w: 2 }); busyUntil = Math.max(busyUntil, now + 220); break;
      case 'bolt': bolts.push({ x: d.x * TS + 8, y: d.y * TS + 8, t0: now, dur: 220, seed: Math.random() }); flashScreen('#9cd6f0', 140, 0.25); busyUntil = Math.max(busyUntil, now + 200); break;
      case 'firestorm': flashScreen('#f39236', 380, 0.45); busyUntil = Math.max(busyUntil, now + 300); break;
      case 'nova': rings.push({ x: d.x * TS + 8, y: d.y * TS + 8, t0: now, dur: 380, r: 40, c: '#9c66dc', w: 3 }); shake(3, 250); break;
      case 'summon': burst(d.m.x * TS + 8, d.m.y * TS + 10, ['#5e36a0', '#9c66dc', '#2e1a4e'], 16, 0.9, 700); break;
      case 'wake': { const v = vOf(d.m); v.alert = now + 700; break; }
      case 'reveal': { const v = vOf(d.m); v.alert = now + 900; shake(2, 200); break; }
      case 'sleep': { const v = vOf(d.m); floatText('Z', v.x + 12, v.y - 2, '#9cd6f0'); break; }
      case 'enrage': shake(4, 500); flashScreen('#a82a34', 500, 0.35); break;
      case 'boss': shake(4, 700); break;
      case 'map': flashScreen('#f5f2fb', 300, 0.3); break;
      case 'enchant': case 'buff': { const p = S.player; sparkle(p.x * TS + 8, p.y * TS + 8, ['#ffd447', '#f39236', '#fff4b0'], 18); break; }
      case 'death': shake(4, 400); flashScreen('#a82a34', 700, 0.5); break;
      case 'win': flashScreen('#ffd447', 900, 0.6); break;
      case 'descend': fade = { t0: now, dur: 300, from: 0, to: 1 }; break;
    }
  }

  function busy() {
    const now = performance.now();
    return now < busyUntil || queue.length > 0 || projectiles.length > 0;
  }

  /* ── 그리기 ── */
  function frame(now) {
    const S = Game.S;
    if (!S || !ctx) return;
    const f = S.floor;
    if (tilesTheme !== f.theme) { tiles = makeTiles(f.theme); tilesTheme = f.theme; }
    if (lightFloor !== f) buildLight(f);

    // 예약된 사건 처리
    if (queue.length) {
      const due = queue.filter(e => e.at <= now);
      if (due.length) { queue = queue.filter(e => e.at > now); for (const e of due) runEvent(e, now); }
    }

    // 액터 위치 갱신
    const updV = (v) => {
      if (v.tw) {
        const t = Math.min(1, (now - v.tw.t0) / v.tw.dur);
        const e = 1 - (1 - t) * (1 - t);
        v.x = v.tw.fx + (v.tw.tx - v.tw.fx) * e;
        v.y = v.tw.fy + (v.tw.ty - v.tw.fy) * e;
        if (t >= 1) v.tw = null;
      }
    };
    const p = S.player;
    const pv = vOf(p);
    if (!pv.tw && !queue.some(e => e.type === 'move' && e.d.who === p) && (Math.abs(pv.x - p.x * TS) > 24 || Math.abs(pv.y - p.y * TS) > 24)) { pv.x = p.x * TS; pv.y = p.y * TS; }
    updV(pv);
    for (const m of f.monsters) {
      const v = vOf(m);
      updV(v);
      if (!v.tw && !queue.some(e => (e.type === 'move' || e.type === 'teleport') && e.d.who === m)) { v.x = m.x * TS; v.y = m.y * TS; }
    }

    // 카메라
    let tx = pv.x + 8 - W / 2, ty = pv.y + 8 - H / 2;
    const mw = f.w * TS, mh = f.h * TS;
    tx = mw <= W ? (mw - W) / 2 : clamp(tx, -8, mw - W + 8);
    ty = mh <= H ? (mh - H) / 2 : clamp(ty, -8, mh - H + 8);
    if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
    else { cam.x += (tx - cam.x) * 0.22; cam.y += (ty - cam.y) * 0.22; if (Math.abs(tx - cam.x) < 0.5) cam.x = tx; if (Math.abs(ty - cam.y) < 0.5) cam.y = ty; }
    let ox = Math.round(cam.x), oy = Math.round(cam.y);
    if (now < shakeUntil) { ox += Math.round((Math.random() - 0.5) * 2 * shakeMag); oy += Math.round((Math.random() - 0.5) * 2 * shakeMag); }
    else shakeMag = 0;

    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, 0, W, H);
    const x0 = Math.max(0, Math.floor(ox / TS)), y0 = Math.max(0, Math.floor(oy / TS));
    const x1 = Math.min(f.w - 1, Math.floor((ox + W) / TS)), y1 = Math.min(f.h - 1, Math.floor((oy + H) / TS) + 1);
    const vis = Game.vis;
    const tf = Math.floor(now / 300);
    const isWall = (x, y) => x < 0 || y < 0 || x >= f.w || y >= f.h || f.tiles[y * f.w + x] === T.WALL;
    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663) ^ (f.depth * 83492791)) >>> 0;

    // 1) 바닥·벽
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * f.w + x;
      if (!f.seen[i]) continue;
      const t = f.tiles[i];
      const sx = x * TS - ox, sy = y * TS - oy;
      const hsh = hash(x, y);
      if (t === T.WALL) {
        if (!isWall(x, y + 1)) {
          ctx.drawImage(tiles.front[hsh % 7 < 4 ? 0 : hsh % 7 < 6 ? 1 : 2], sx, sy);
        } else {
          ctx.drawImage(tiles.top, sx, sy);
          ctx.fillStyle = THEMES[f.theme].wallLine;
          if (!isWall(x - 1, y)) ctx.fillRect(sx, sy, 1, TS);
          if (!isWall(x + 1, y)) ctx.fillRect(sx + TS - 1, sy, 1, TS);
          if (!isWall(x, y - 1)) ctx.fillRect(sx, sy, TS, 1);
        }
        continue;
      }
      if (t === T.WATER) { ctx.drawImage(tiles.water[(tf + (hsh & 1)) % 2], sx, sy); }
      else if (t === T.LAVA) { ctx.drawImage(tiles.lava[(tf + hsh) % 3], sx, sy); }
      else ctx.drawImage(tiles.floor[hsh % 4], sx, sy);
      if ((t === T.WATER || t === T.LAVA) && f.tiles[i - f.w] !== t) { ctx.fillStyle = t === T.LAVA ? '#5c1a26' : '#152a52'; ctx.fillRect(sx, sy, TS, 2); }
      if (isWall(x, y - 1) && t !== T.WATER && t !== T.LAVA) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(sx, sy, TS, 3); }
      if (t === T.DOOR || t === T.DOOR_OPEN) {
        const side = isWall(x, y - 1) && isWall(x, y + 1);
        if (side) ctx.drawImage(t === T.DOOR ? tiles.doorSide : tiles.doorSideOpen, sx, sy);
        else ctx.drawImage(sprite(t === T.DOOR ? 'door' : 'door_open'), sx, sy);
      } else if (t === T.STAIRS) {
        ctx.drawImage(sprite('stairs'), sx, sy);
      } else {
        const dc = f.deco[i];
        if (dc) ctx.drawImage(sprite(dc), sx, sy);
      }
    }
    // 횃불
    for (const i of f.torches) {
      const x = i % f.w, y = (i / f.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1 || !f.seen[i]) continue;
      ctx.drawImage(sprite((tf + x) % 2 ? 'torch1' : 'torch2'), x * TS - ox, y * TS - oy - 2);
    }
    // 열린 상자, 함정
    for (const [x, y] of (f.openChests || [])) if (f.seen[y * f.w + x]) ctx.drawImage(sprite('chest_open'), x * TS - ox, y * TS - oy);
    for (const tr of f.traps) if (!tr.hidden && f.seen[tr.y * f.w + tr.x]) {
      ctx.globalAlpha = tr.kind === 'spike' ? 1 : 0.85;
      if (tr.kind === 'spike') ctx.drawImage(sprite('trap'), tr.x * TS - ox, tr.y * TS - oy);
      else drawRune(tr.x * TS - ox, tr.y * TS - oy, tr.kind);
      ctx.globalAlpha = 1;
    }
    // 바닥 아이템
    for (const it of f.items) {
      if (!f.seen[it.y * f.w + it.x]) continue;
      const bob = vis[it.y * f.w + it.x] ? (Math.floor((now + it.x * 97) / 450) % 2) : 0;
      const spr = it.item.id === 'gold' ? 'gold' : ITEMS[it.item.id].spr;
      shadow(it.x * TS - ox + 8, it.y * TS - oy + 14, 5);
      ctx.drawImage(sprite(spr), it.x * TS - ox, it.y * TS - oy - bob - 1);
      if (it.item.id === 'ember') { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now / 200); ctx.fillStyle = '#ffd447'; ctx.fillRect(it.x * TS - ox - 4, it.y * TS - oy - 4, 24, 24); ctx.globalAlpha = 1; }
    }
    // 길 표시
    for (const [mx, my] of marks) { ctx.fillStyle = 'rgba(255,212,71,0.55)'; ctx.fillRect(mx * TS - ox + 6, my * TS - oy + 6, 4, 4); }

    // 2) 액터 (y 순서)
    const actors = [];
    for (const o of f.objects) if (f.seen[o.y * f.w + o.x]) actors.push({ kind: 'obj', o, y: o.y * TS });
    for (const m of f.monsters) {
      const v = vOf(m);
      const shown = vis[m.y * f.w + m.x] || vis[Math.round(v.y / TS) * f.w + Math.round(v.x / TS)];
      if (shown) actors.push({ kind: 'mon', m, v, y: v.y });
    }
    actors.push({ kind: 'player', v: pv, y: pv.y });
    for (const dd of dying) actors.push({ kind: 'dying', dd, y: dd.y });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a.kind === 'obj') {
        const o = a.o, sx = o.x * TS - ox, sy = o.y * TS - oy;
        if (o.type === 'merchant') {
          shadow(sx + 8, sy + 15, 6);
          ctx.drawImage(sprite('merchant'), sx, sy - (Math.floor(now / 600) % 2));
          if (vis[o.y * f.w + o.x]) drawText('G', sx + 8, sy - 8 + Math.round(Math.sin(now / 250)), '#ffd447');
        } else if (o.type === 'chest') ctx.drawImage(sprite('chest'), sx, sy);
      } else if (a.kind === 'mon') drawMonster(a.m, a.v, now, ox, oy);
      else if (a.kind === 'player') drawPlayer(p, pv, now, ox, oy);
      else drawDying(a.dd, now, ox, oy);
    }
    dying = dying.filter(dd => now - dd.t0 < dd.dur);

    // 3) 빛·어둠
    const th = THEMES[f.theme];
    const flick = 0.04 * Math.sin(now / 130) + 0.03 * Math.sin(now / 47);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * f.w + x;
      if (!f.seen[i]) continue;
      const sx = x * TS - ox, sy = y * TS - oy;
      if (!vis[i]) { ctx.fillStyle = 'rgba(9,7,20,0.74)'; ctx.fillRect(sx, sy, TS, TS); continue; }
      const dd = Math.hypot(x - p.x, y - p.y);
      let b = Math.max(0, 1 - Math.pow(dd / 7.6, 1.6));
      b = Math.max(b, light[i] + (light[i] > 0 ? flick : 0));
      const a = Math.round((1 - Math.min(1, b)) * 5) / 5 * 0.62;
      if (a > 0.01) { ctx.fillStyle = `rgba(9,7,20,${a.toFixed(2)})`; ctx.fillRect(sx, sy, TS, TS); }
      if (light[i] > 0.2) { ctx.fillStyle = `rgba(${th.light[0]},${th.light[1]},${th.light[2]},${(light[i] * 0.07).toFixed(3)})`; ctx.fillRect(sx, sy, TS, TS); }
    }

    // 4) 효과
    for (const s of slashes) {
      const t = (now - s.t0) / s.dur;
      if (t < 0 || t > 1) continue;
      const rot = s.dx > 0 ? '' : s.dx < 0 ? 'r2' : s.dy > 0 ? 'r1' : 'r3';
      ctx.globalAlpha = 1 - t * 0.7;
      ctx.drawImage(sprite('slash', rot), s.x * TS - ox - s.dx * 4, s.y * TS - oy - s.dy * 4);
      ctx.globalAlpha = 1;
    }
    slashes = slashes.filter(s => now - s.t0 < s.dur);
    for (const pr of projectiles) {
      const t = Math.min(1, (now - pr.t0) / pr.dur);
      const x = pr.fx + (pr.tx - pr.fx) * t, y = pr.fy + (pr.ty - pr.fy) * t;
      const dx = pr.tx - pr.fx, dy = pr.ty - pr.fy;
      const rot = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? '' : 'r2') : (dy > 0 ? 'r1' : 'r3');
      ctx.drawImage(sprite(pr.spr, rot), Math.round(x - ox), Math.round(y - oy - 2));
      if (pr.spr !== 'arrow' && Math.random() < 0.6) parts.push({ x: x + 8, y: y + 6, vx: 0, vy: -0.2, g: 0, c: pr.spr === 'fireball' ? '#f39236' : '#9c66dc', t0: now, life: 250, sz: 1 });
    }
    projectiles = projectiles.filter(pr => now - pr.t0 < pr.dur);
    for (const r of rings) {
      const t = (now - r.t0) / r.dur;
      if (t < 0 || t > 1) continue;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = r.c;
      const rad = r.r * (0.3 + 0.7 * t);
      for (let k = 0; k < 28; k++) {
        const a = k / 28 * Math.PI * 2;
        ctx.fillRect(Math.round(r.x - ox + Math.cos(a) * rad), Math.round(r.y - oy + Math.sin(a) * rad * 0.8), r.w || 1, r.w || 1);
      }
      ctx.globalAlpha = 1;
    }
    rings = rings.filter(r => now - r.t0 < r.dur);
    for (const b of bolts) {
      const t = (now - b.t0) / b.dur;
      if (t < 0 || t > 1) continue;
      const rr = makeRng(Math.floor(b.seed * 1e6) + Math.floor(now / 50));
      let x = b.x - ox, y = Math.max(-oy, b.y - oy - 80);
      ctx.fillStyle = t < 0.5 ? '#f5f2fb' : '#9cd6f0';
      while (y < b.y - oy) {
        const nx = x + rr.int(-3, 3);
        ctx.fillRect(Math.round(Math.min(x, nx)), Math.round(y), Math.abs(nx - x) + 2, 4);
        x = nx; y += 4;
        x += (b.x - ox - x) * 0.25;
      }
      if (t < 0.3) burst(b.x, b.y, ['#9cd6f0', '#f5f2fb'], 3, 1.5, 300);
    }
    bolts = bolts.filter(b => now - b.t0 < b.dur);
    for (const pt of parts) {
      const t = now - pt.t0;
      if (t < 0) continue;
      const k = t / 16.7;
      const x = pt.x + pt.vx * k, y = pt.y + pt.vy * k + pt.g * k * k / 2;
      ctx.globalAlpha = Math.max(0, 1 - t / pt.life);
      ctx.fillStyle = pt.c;
      ctx.fillRect(Math.round(x - ox), Math.round(y - oy), pt.sz, pt.sz);
    }
    ctx.globalAlpha = 1;
    parts = parts.filter(pt => now - pt.t0 < pt.life);
    for (const fl of floats) {
      const t = (now - fl.t0) / fl.life;
      if (t < 0 || t > 1) continue;
      const y = fl.y - oy - 4 - Math.min(1, t * 2.2) * 10;
      ctx.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1;
      drawText(fl.text, fl.x - ox, y, fl.color, fl.big);
      ctx.globalAlpha = 1;
    }
    floats = floats.filter(fl => now - fl.t0 < fl.life);

    // 화면 번쩍임·페이드
    if (flash) {
      const t = (now - flash.t0) / flash.dur;
      if (t >= 1) flash = null;
      else { ctx.globalAlpha = flash.alpha * (1 - t); ctx.fillStyle = flash.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    }
    if (fade) {
      const t = Math.min(1, (now - fade.t0) / fade.dur);
      const a = fade.from + (fade.to - fade.from) * t;
      if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (t >= 1 && fade.to === 0) fade = null;
    }
  }

  function shadow(cx, cy, rw) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(cx - rw), Math.round(cy), rw * 2, 2);
    ctx.fillRect(Math.round(cx - rw + 2), Math.round(cy - 1), rw * 2 - 4, 1);
    ctx.fillRect(Math.round(cx - rw + 2), Math.round(cy + 2), rw * 2 - 4, 1);
  }

  function drawRune(sx, sy, kind) {
    const col = kind === 'poison' ? '#56b048' : kind === 'teleport' ? '#9c66dc' : '#ffd447';
    ctx.fillStyle = col;
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      ctx.fillRect(sx + 8 + Math.round(Math.cos(a) * 5), sy + 8 + Math.round(Math.sin(a) * 4), 1, 1);
    }
    ctx.fillRect(sx + 7, sy + 7, 2, 2);
  }

  function bumpOffset(v, now) {
    if (!v.bump) return [0, 0];
    const t = (now - v.bump.t0) / v.bump.dur;
    if (t >= 1) { v.bump = null; return [0, 0]; }
    const k = Math.sin(t * Math.PI) * 5;
    return [v.bump.dx * k, v.bump.dy * k];
  }

  function drawMonster(m, v, now, ox, oy) {
    const d = MONSTERS[m.id];
    const [bx, by] = bumpOffset(v, now);
    let sx = Math.round(v.x - ox + bx), sy = Math.round(v.y - oy + by);
    const p = Game.S.player;
    if (m.x !== p.x) v.flipX = m.x > p.x && m.state !== 'sleep';
    let name = d.spr;
    if (m.disguised) name = 'chest';
    else if (d.anim) name = d.anim[Math.floor((now + m.uid * 61) / 160) % d.anim.length];
    const asleep = m.state === 'sleep' || m.sleep > 0;
    const bob = m.disguised || asleep ? 0 : Math.floor((now + m.uid * 137) / 380) % 2;
    const flip = v.flipX ? 'f' : '';
    const white = now < (v.flash || 0) ? 'w' : '';
    if (d.big) {
      shadow(sx + 8, sy + 14, 12);
      const ex = sx - 8, ey = sy - 16 + bob;
      if (m.phase2) { ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now / 120); ctx.drawImage(sprite(name, 'o' + flip), ex - 1, ey); ctx.drawImage(sprite(name, 'o' + flip), ex + 1, ey); ctx.globalAlpha = 1; }
      ctx.drawImage(sprite(name, flip + white), ex, ey);
    } else {
      if (!d.fly && !m.disguised) shadow(sx + 8, sy + 14, 5);
      if (d.fly) shadow(sx + 8, sy + 15, 3);
      const fy = d.fly ? -2 - (Math.floor((now + m.uid * 50) / 200) % 2) : 0;
      if (m.elite && !m.disguised) ctx.drawImage(sprite(name, 'o' + flip), sx, sy - bob + fy);
      if (m.id === 'ghost') ctx.globalAlpha = 0.8;
      ctx.drawImage(sprite(name, (m.disguised ? '' : flip) + white), sx, sy - bob + fy);
      ctx.globalAlpha = 1;
    }
    if (asleep && !m.disguised) {
      const k = Math.floor(now / 500) % 3;
      drawText('Z', sx + 13 + k, sy - 4 - k * 2, '#9cd6f0');
    }
    if (v.alert && now < v.alert) drawText('!', sx + 8, sy - (d.big ? 22 : 8), '#ffd447', 1);
    if (!m.disguised && m.hp < m.mhp && !d.big) {
      const w = 12, fr = Math.max(0, m.hp / m.mhp);
      ctx.fillStyle = '#0e0b16'; ctx.fillRect(sx + 2, sy - 3, w + 2, 3);
      ctx.fillStyle = fr > 0.5 ? '#56b048' : fr > 0.25 ? '#ffd447' : '#e0503f';
      ctx.fillRect(sx + 3, sy - 2, Math.max(1, Math.round(w * fr)), 1);
    }
    if (m.sleep > 0 && !asleep) drawText('Z', sx + 13, sy - 4, '#9cd6f0');
  }

  function drawPlayer(p, v, now, ox, oy) {
    const [bx, by] = bumpOffset(v, now);
    const sx = Math.round(v.x - ox + bx), sy = Math.round(v.y - oy + by);
    const moving = !!v.tw;
    const bob = moving ? (Math.floor(now / 70) % 2) : Math.floor(now / 500) % 2;
    shadow(sx + 8, sy + 14, 5);
    const white = now < (v.flash || 0) ? 'w' : '';
    if (p.power > 0) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 100); ctx.drawImage(sprite('hero', 'o' + (p.facing < 0 ? 'f' : '')), sx, sy - bob); ctx.globalAlpha = 1; }
    ctx.drawImage(sprite('hero', (p.facing < 0 ? 'f' : '') + white), sx, sy - bob);
    if (p.poison > 0 && Math.random() < 0.08) parts.push({ x: v.x + 4 + Math.random() * 8, y: v.y + 2, vx: 0, vy: -0.3, g: 0, c: '#a6dd66', t0: now, life: 500, sz: 1 });
  }

  function drawDying(dd, now, ox, oy) {
    const t = (now - dd.t0) / dd.dur;
    if (Math.floor(t * 10) % 2) return;
    const d = MONSTERS[dd.m.id];
    const name = d.anim ? d.anim[0] : d.spr;
    ctx.globalAlpha = 1 - t;
    if (d.big) ctx.drawImage(sprite(name, 'w'), Math.round(dd.x - ox - 8), Math.round(dd.y - oy - 16));
    else ctx.drawImage(sprite(name, (dd.flip ? 'f' : '') + 'w'), Math.round(dd.x - ox), Math.round(dd.y - oy));
    ctx.globalAlpha = 1;
  }

  /* ── 작은 지도 ── */
  function drawMap(canvas) {
    const S = Game.S, f = S.floor, p = S.player;
    const k = Math.max(2, Math.floor(Math.min(canvas.clientWidth * (window.devicePixelRatio || 1) / f.w, canvas.clientHeight * (window.devicePixelRatio || 1) / f.h)));
    canvas.width = f.w * k; canvas.height = f.h * k;
    const g = canvas.getContext('2d');
    g.fillStyle = '#0b0912'; g.fillRect(0, 0, canvas.width, canvas.height);
    const th = THEMES[f.theme];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const i = y * f.w + x;
      if (!f.seen[i]) continue;
      const t = f.tiles[i];
      g.fillStyle = t === T.WALL ? '#2a2342' : t === T.WATER ? '#2556a0' : t === T.LAVA ? '#c23a1f' : t === T.DOOR || t === T.DOOR_OPEN ? '#8a5a3a' : t === T.STAIRS ? '#ffd447' : '#5d5675';
      g.fillRect(x * k, y * k, k, k);
    }
    for (const it of f.items) if (f.seen[it.y * f.w + it.x]) { g.fillStyle = it.item.id === 'gold' ? '#ffd447' : '#9cd6f0'; g.fillRect(it.x * k + k / 4, it.y * k + k / 4, k / 2, k / 2); }
    for (const o of f.objects) if (f.seen[o.y * f.w + o.x]) { g.fillStyle = o.type === 'merchant' ? '#9c66dc' : '#f39236'; g.fillRect(o.x * k, o.y * k, k, k); }
    for (const tr of f.traps) if (!tr.hidden && f.seen[tr.y * f.w + tr.x]) { g.fillStyle = '#e0503f'; g.fillRect(tr.x * k + k / 4, tr.y * k + k / 4, k / 2, k / 2); }
    if (f.stairs && f.seen[f.stairs.y * f.w + f.stairs.x]) { g.fillStyle = '#ffd447'; g.fillRect(f.stairs.x * k - 1, f.stairs.y * k - 1, k + 2, k + 2); }
    for (const m of f.monsters) if (Game.isVisible(m.x, m.y) && !m.disguised) { g.fillStyle = '#e0503f'; g.fillRect(m.x * k, m.y * k, k, k); }
    g.fillStyle = '#f5f2fb'; g.fillRect(p.x * k - 1, p.y * k - 1, k + 2, k + 2);
    g.fillStyle = '#4796dc'; g.fillRect(p.x * k, p.y * k, k, k);
  }

  return {
    init, resize, frame, busy, sprite, icon, screenToTile, drawMap, drawText: (c, ...a) => { const o = ctx; ctx = c; drawText(...a); ctx = o; },
    themeTiles: (() => { const m = {}; return (id) => m[id] || (m[id] = makeTiles(id)); })(),
    setMarks(m) { marks = m || []; },
    get scale() { return scale; }
  };
})();
