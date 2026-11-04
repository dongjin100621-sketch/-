/* 조국과 민족을 위하여 — 픽셀 아트 장면 렌더러 (320×180, 코드로 그림) */
'use strict';

const Scenes = (() => {
  const W = 320, H = 180;
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rgbCache = {};
  function rgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    const n = parseInt(hex.slice(1), 16);
    return (rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }

  /* 디더링된 세로 그라데이션 */
  function grad(g, x, y, w, h, cols) {
    const img = g.getImageData(x, y, w, h), d = img.data, n = cols.length - 1;
    const cs = cols.map(rgb);
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
      for (let k = 0; k < w; k++) {
        const c = f * 16 > BAYER[(y + j) & 3][(x + k) & 3] ? cs[i + 1] : cs[i];
        const o = (j * w + k) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    g.putImageData(img, x, y);
  }
  /* 1차원 값 노이즈 */
  function noise1(seed, scale) {
    const r = rng(seed), pts = [];
    for (let i = 0; i < 64; i++) pts.push(r());
    return (x) => {
      const t = x / scale, i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f);
      return pts[i & 63] * (1 - s) + pts[(i + 1) & 63] * s;
    };
  }
  function ridge(g, c, base, amp, seed, scale = 40, detail = 0.35) {
    const n1 = noise1(seed, scale), n2 = noise1(seed + 7, scale / 4);
    g.fillStyle = c;
    for (let x = 0; x < W; x++) {
      const h = base - amp * (n1(x) * (1 - detail) + n2(x) * detail);
      g.fillRect(x, Math.round(h), 1, H - Math.round(h));
    }
  }
  function circle(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y));
      g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }
  function glow(g, x, y, r, c, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const [R, G, B] = rgb(c);
    gr.addColorStop(0, `rgba(${R},${G},${B},${a})`);
    gr.addColorStop(1, `rgba(${R},${G},${B},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function stars(g, n, seed, maxY, col = '#cfd6e8') {
    const r = rng(seed);
    for (let i = 0; i < n; i++) px(g, r() * W, r() * maxY, r() < 0.2 ? '#ffffff' : col);
  }

  /* 문자열 스프라이트 */
  const SPR = {
    man: ['.hh.', 'hffh', '.ff.', 'bbbb', 'bbbb', 'bbbb', 'bbbb', '.ll.', '.ll.', '.l.l', 'l..l'],
    officer: ['.cccc', 'ccccc', '.ff..', '.ff..', 'bbbb.', 'bbbbb', 'bbbb.', 'bbbb.', 'bbbb.', '.l.l.', '.l.l.', 'l..l.'],
    soldier: ['.kk.', 'kkkk', '.ff.', 'bbbb', 'bbbbg', 'bbbbg', 'bbb.g', '.ll.', '.ll.', 'l..l'],
    woman: ['.hh.', 'hffh', '.ff.', '.bb.', 'bbbb', '.ss.', 'ssss', 'ssss', 'ssss', 'ssssss'.slice(0, 4)],
    student: ['.cc.', 'cccc', '.ff.', 'wwww', 'wwww', 'wwww', '.ll.', '.ll.', '.ll.', 'l..l'],
    carrier: ['.pp.', 'pppp', '.hh.', 'hffh', '.ff.', 'bbbb', 'bbbb', 'bbbb', '.ll.', 'l..l'],
    sitter: ['..hh', '.hff', '.bbb', 'bbbb', 'bbbb', 'bbll', 'll..'],
    fist: ['a...', 'a.hh', 'ahffh', '.aff.', '.bbbb', '.bbbb', '.bbbb', '..ll.', '..ll.', '.l..l'],
  };
  function spr(g, name, x, y, pal, s = 1) {
    const rows = SPR[name];
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        const c = typeof pal === 'string' ? pal : (pal[ch] || pal._ || '#000');
        g.fillStyle = c;
        g.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s);
      }
    }
  }
  function sprH(name) { return SPR[name].length; }

  /* 태극기 (작은 픽셀 버전) */
  function taegukgi(g, x, y, w) {
    const h = Math.round(w * 2 / 3);
    rect(g, x, y, w, h, '#f4f2ec');
    const cx = x + w / 2, cy = y + h / 2, R = h / 4;
    const a = Math.atan2(2, 3);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      if (i * i + j * j > R * R) continue;
      const u = i * Math.cos(a) + j * Math.sin(a), v = -i * Math.sin(a) + j * Math.cos(a);
      let red = v < 0;
      if ((u + R / 2) ** 2 + v * v < (R / 2) ** 2) red = true;
      if ((u - R / 2) ** 2 + v * v < (R / 2) ** 2) red = false;
      px(g, cx + i, cy + j, red ? '#c8102e' : '#0a3a8a');
    }
    const k = Math.max(1, Math.round(w / 14)), bw = k * 3;
    const tri = (tx, ty, pat) => pat.forEach((full, n) => {
      if (full) rect(g, tx, ty + n * k * 1.6, bw, k, '#111');
      else { rect(g, tx, ty + n * k * 1.6, k, k, '#111'); rect(g, tx + bw - k, ty + n * k * 1.6, k, k, '#111'); }
    });
    tri(x + w * 0.1, y + h * 0.12, [1, 1, 1]);
    tri(x + w * 0.9 - bw, y + h * 0.12, [0, 1, 0]);
    tri(x + w * 0.1, y + h * 0.88 - k * 4.2, [1, 0, 1]);
    tri(x + w * 0.9 - bw, y + h * 0.88 - k * 4.2, [0, 0, 0]);
  }

  /* 파티클 */
  function emitter() { return []; }
  function stepParticles(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.life -= dt;
      if (p.life <= 0 || p.y > H + 10 || p.y < -20) list.splice(i, 1);
    }
  }
  function smoke(list, x, y, r, opts = {}) {
    if (r() < (opts.rate || 0.25)) list.push({ x: x + (r() - 0.5) * 3, y, vx: (opts.wind || 3) + (r() - 0.5) * 2, vy: -(opts.up || 6) - r() * 3, life: opts.life || 5, max: opts.life || 5, s: 1 + r() * 1.5 });
  }
  function drawSmoke(g, list, c, a0 = 0.5) {
    const [R, G, B] = rgb(c);
    for (const p of list) {
      const k = p.life / p.max, s = p.s + (1 - k) * (p.grow ?? 5);
      g.fillStyle = `rgba(${R},${G},${B},${(a0 * k).toFixed(3)})`;
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
    }
  }
  function birds(g, t, seed, n, col, y0) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const sp = 6 + r() * 6, ox = r() * W, oy = y0 + r() * 30;
      const x = ((ox + t * sp) % (W + 40)) - 20, y = oy + Math.sin(t * 0.7 + i) * 2;
      const f = Math.floor(t * 4 + i) % 2;
      g.fillStyle = col;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillRect(Math.round(x - 1), Math.round(y - f), 1, 1);
      g.fillRect(Math.round(x + 1), Math.round(y - f), 1, 1);
      g.fillRect(Math.round(x - 2), Math.round(y - 1 + f), 1, 1);
      g.fillRect(Math.round(x + 2), Math.round(y - 1 + f), 1, 1);
    }
  }

  /* 건물 조각 */
  function thatched(g, x, y, w) {
    const h = Math.round(w * 0.45);
    rect(g, x + 2, y - h, w - 4, h, '#d6c49c');
    rect(g, x + 2, y - h, 1, h, '#4a3524'); rect(g, x + w - 3, y - h, 1, h, '#4a3524');
    rect(g, x + w / 2 - 2, y - h + 3, 5, h - 3, '#3a2a1c');
    for (let j = 0; j < 8; j++) {
      const ww = w + 4 - Math.round(Math.pow(j / 7, 2) * w * 0.7);
      rect(g, x + (w - ww) / 2, y - h - 7 + j, ww, 1, j > 5 ? '#7a6232' : (j % 2 ? '#a88a4a' : '#b8964e'));
    }
    rect(g, x - 1, y, w + 2, 1, '#5a4a3a');
  }
  function slate(g, x, y, w, roof) {
    const h = Math.round(w * 0.42);
    rect(g, x + 2, y - h, w - 4, h, '#ece8dc');
    rect(g, x + w / 2 - 2, y - h + 3, 5, h - 3, '#5a4030');
    rect(g, x + 5, y - h + 3, 4, 3, '#7aa0c0');
    for (let j = 0; j < 7; j++) rect(g, x + 4 - j, y - h - 7 + j, w - 8 + j * 2, 1, j === 6 ? '#1e1e24' : roof);
    for (let i = 0; i < w; i += 3) px(g, x + i, y - h - 2, 'rgba(0,0,0,.25)');
  }
  function building(g, x, y, w, h, c, win, r, lit = 0) {
    rect(g, x, y - h, w, h, c);
    for (let j = y - h + 3; j < y - 3; j += 5) for (let i = x + 2; i < x + w - 2; i += 4) {
      px(g, i, j, r() < lit ? '#e8c070' : win); px(g, i + 1, j, r() < lit ? '#e8c070' : win);
    }
  }

  /* ───────────── 장면 정의 ───────────── */
  const DEF = {};

  DEF.title = {
    bg(g) {
      grad(g, 0, 0, W, 130, ['#120a0e', '#2a1016', '#5a1e1c', '#9a3a22', '#d0662e']);
      circle(g, 160, 118, 40, '#e8a050');
      circle(g, 160, 118, 36, '#f2be6a');
      ridge(g, '#5a1e1c', 118, 22, 11, 50);
      ridge(g, '#30121a', 134, 18, 23, 34);
      ridge(g, '#140a0c', 152, 12, 31, 26);
      rect(g, 0, 165, W, 15, '#0a0607');
      spr(g, 'officer', 232, 128, '#0a0607', 2);
    },
    fg(g, t, st) {
      birds(g, t, 5, 6, '#140a0c', 40);
      stepParticles(st.p, st.dt);
      if (st.r() < 0.3) st.p.push({ x: st.r() * W, y: 180, vx: 1, vy: -4 - st.r() * 4, life: 8, max: 8, s: 1, grow: 0 });
      drawSmoke(g, st.p, '#f0b070', 0.5);
    },
  };

  DEF.village = {
    bg(g) {
      grad(g, 0, 0, W, 112, ['#2b2440', '#5b3a5a', '#b8584a', '#e89a5a', '#f4c27a']);
      ridge(g, '#4a3a52', 98, 42, 3, 60, 0.4);
      ridge(g, '#3b3040', 114, 12, 9, 30);
      for (let y = 116; y < H; y++) rect(g, 0, y, W, 1, (Math.floor((y - 116) / 4) % 2) ? '#a8843a' : '#b8923e');
      for (let y = 120; y < H; y += 8) rect(g, 0, y, W, 1, '#7a5a26');
      const r = rng(4);
      for (let i = 0; i < 160; i++) px(g, r() * W, 118 + r() * 62, '#d0aa50');
      for (let y = 116; y < H; y++) rect(g, 140 + (y - 116) * 0.9, y, 10 + (y - 116) * 0.4, 1, '#8a6a42');
      thatched(g, 40, 122, 34); thatched(g, 88, 126, 30); thatched(g, 196, 120, 36);
      for (let i = 0; i < 70; i++) px(g, 30 + i, 125 + (i % 3 === 0 ? 0 : 1), '#6a5a4a');
      rect(g, 262, 92, 3, 30, '#3a2a1e');
      for (const [x, y, rr] of [[263, 88, 9], [255, 94, 6], [271, 95, 6]]) circle(g, x, y, rr, '#4a3a24');
      for (let i = 0; i < 14; i++) px(g, 252 + r() * 22, 84 + r() * 16, '#f07a2a');
    },
    fg(g, t, st) {
      stepParticles(st.p, st.dt);
      smoke(st.p, 50, 104, st.r, { rate: 0.2, wind: 2.5 });
      smoke(st.p, 210, 102, st.r, { rate: 0.2, wind: 2.5 });
      drawSmoke(g, st.p, '#d8d0c8', 0.35);
      birds(g, t, 9, 4, '#2a1e28', 30);
    },
  };

  DEF.classroom = {
    bg(g) {
      grad(g, 0, 0, W, 100, ['#b8a27a', '#cdb88e']);
      rect(g, 0, 100, W, 40, '#6a4a2e'); rect(g, 0, 100, W, 2, '#4a3220');
      for (let x = 0; x < W; x += 16) rect(g, x, 102, 1, 38, '#5a3e26');
      for (let y = 140; y < H; y += 5) rect(g, 0, y, W, 5, y % 10 ? '#7a5634' : '#6e4c2e');
      rect(g, 50, 26, 160, 62, '#5a3a22'); rect(g, 54, 30, 152, 54, '#2f4a3a');
      const r = rng(8);
      for (let i = 0; i < 9; i++) { const yy = 36 + i * 5; rect(g, 62, yy, 30 + r() * 100, 1, 'rgba(220,230,210,.55)'); }
      rect(g, 54, 84, 152, 3, '#4a2e1a');
      rect(g, 240, 18, 70, 78, '#4a3220');
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) rect(g, 244 + i * 33, 22 + j * 24, 30, 21, '#efe6c4');
      for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
        const x = 30 + col * 54 + row * 6, y = 118 + row * 20;
        rect(g, x, y, 34, 4, '#8a6240'); rect(g, x + 2, y + 4, 2, 9, '#4a321e'); rect(g, x + 30, y + 4, 2, 9, '#4a321e');
        spr(g, 'student', x + 14, y - 10, { c: '#1a1a22', f: '#d8b090', w: '#1e2230', l: '#1e2230' });
      }
      rect(g, 20, 96, 26, 28, '#5a3a22'); rect(g, 18, 94, 30, 3, '#6a4a2e');
    },
    fg(g, t, st) {
      g.fillStyle = 'rgba(255,240,200,0.08)';
      g.beginPath(); g.moveTo(244, 22); g.lineTo(308, 22); g.lineTo(220, 180); g.lineTo(120, 180); g.closePath(); g.fill();
      if (st.p.length < 40 && st.r() < 0.5) st.p.push({ x: 150 + st.r() * 120, y: 40 + st.r() * 120, vx: (st.r() - 0.5) * 2, vy: -0.5 - st.r(), life: 6, max: 6, s: 1, grow: 0 });
      stepParticles(st.p, st.dt);
      drawSmoke(g, st.p, '#fff4d0', 0.7);
    },
  };

  DEF.manchuria = {
    bg(g) {
      grad(g, 0, 0, W, 110, ['#6e7888', '#8a96a6', '#aab4c0', '#c8ced6']);
      ridge(g, '#7a8494', 104, 14, 21, 70);
      grad(g, 0, 106, W, 74, ['#c8cfd8', '#e6eaf0']);
      const r = rng(13);
      for (let i = 0; i < 40; i++) rect(g, r() * W, 110 + r() * 70, 6 + r() * 20, 1, '#cbd2dc');
      for (let i = 0; i < 3; i++) {
        const x = 30 + i * 70, y = 118;
        rect(g, x, y - 12, 56, 12, '#5a5048'); rect(g, x - 2, y - 16, 60, 4, '#3a3430'); rect(g, x - 2, y - 17, 60, 2, '#f0f2f5');
        for (let k = 0; k < 6; k++) rect(g, x + 4 + k * 9, y - 9, 3, 3, '#2a2420');
      }
      rect(g, 268, 70, 2, 46, '#3a3430'); rect(g, 286, 70, 2, 46, '#3a3430');
      rect(g, 264, 60, 28, 12, '#4a4038'); rect(g, 262, 57, 32, 3, '#f0f2f5');
      for (let x = 0; x < W; x += 9) rect(g, x, 124, 1, 6, '#4a4440');
      rect(g, 0, 126, W, 1, '#5a5450');
    },
    fg(g, t, st) {
      for (let i = 0; i < 9; i++) {
        const x = ((t * 6 + i * 11) % (W + 120)) - 60;
        spr(g, 'soldier', x, 140 + (Math.floor(t * 3 + i) % 2), { k: '#3a4232', f: '#c8a888', b: '#4a5240', l: '#2a2e24', g: '#2a2420' });
      }
      if (st.r() < 0.9) st.p.push({ x: st.r() * (W + 60) - 30, y: -2, vx: 8 + st.r() * 6, vy: 14 + st.r() * 10, life: 20, max: 20, s: st.r() < 0.2 ? 2 : 1, grow: 0 });
      stepParticles(st.p, st.dt);
      drawSmoke(g, st.p, '#ffffff', 1.4);
    },
  };

  DEF.prison = {
    bg(g) {
      rect(g, 0, 0, W, H, '#1e1e24');
      for (let y = 0; y < 150; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) rect(g, x + 1, y + 1, 14, 6, (x + y) % 3 ? '#2a2a32' : '#30303a');
      rect(g, 0, 150, W, 30, '#16161a');
      grad(g, 200, 30, 44, 36, ['#0e1428', '#1e2a4a']);
      circle(g, 228, 42, 5, '#e6e2cc');
      for (let i = 0; i < 6; i++) rect(g, 203 + i * 7, 30, 2, 36, '#0c0c10');
      rect(g, 198, 28, 48, 3, '#141418'); rect(g, 198, 65, 48, 3, '#141418');
      rect(g, 80, 136, 70, 6, '#3a3026'); rect(g, 82, 142, 3, 8, '#2a2018'); rect(g, 145, 142, 3, 8, '#2a2018');
      spr(g, 'sitter', 104, 124, '#0a0a0e', 2);
    },
    fg(g, t, st) {
      g.fillStyle = 'rgba(160,180,220,0.09)';
      g.beginPath(); g.moveTo(200, 30); g.lineTo(244, 30); g.lineTo(190, 160); g.lineTo(120, 160); g.closePath(); g.fill();
      if (st.p.length < 30 && st.r() < 0.4) st.p.push({ x: 150 + st.r() * 70, y: 50 + st.r() * 100, vx: (st.r() - 0.5), vy: -0.4, life: 6, max: 6, s: 1, grow: 0 });
      stepParticles(st.p, st.dt);
      drawSmoke(g, st.p, '#c8d4f0', 0.6);
    },
  };

  DEF.war = {
    bg(g) {
      grad(g, 0, 0, W, 130, ['#2a1410', '#5a2214', '#9a3a1a', '#d0702e']);
      const r = rng(17);
      for (let x = 0; x < W;) {
        const w = 14 + r() * 26, h = 30 + r() * 50;
        rect(g, x, 140 - h, w, h, '#1e1412');
        for (let k = 0; k < w; k += 2) rect(g, x + k, 140 - h - r() * 8, 2, 8, '#1e1412');
        for (let j = 140 - h + 6; j < 134; j += 7) for (let i = x + 3; i < x + w - 3; i += 6) if (r() < 0.25) rect(g, i, j, 2, 3, r() < 0.5 ? '#e07a2a' : '#7a2a14');
        x += w + r() * 10;
      }
      grad(g, 0, 138, W, 42, ['#2a1e18', '#1a1410']);
    },
    fg(g, t, st) {
      stepParticles(st.p, st.dt);
      for (const x of [60, 170, 260]) smoke(st.p, x, 110, st.r, { rate: 0.5, wind: 4, up: 8, life: 7 });
      drawSmoke(g, st.p, '#1a1210', 0.55);
      for (let i = 0; i < 10; i++) {
        const x = W - ((t * 5 + i * 31) % (W + 40));
        spr(g, i % 3 ? 'carrier' : 'woman', x, 150 + (i % 2), { p: '#8a7a5a', h: '#0e0a08', f: '#0e0a08', b: '#2a221c', l: '#1a1410', s: '#2a221c' });
      }
      if (st.r() < 0.4) st.e.push({ x: st.r() * W, y: 140, vx: (st.r() - 0.5) * 6, vy: -10 - st.r() * 10, life: 3, max: 3, s: 1, grow: 0 });
      stepParticles(st.e, st.dt);
      drawSmoke(g, st.e, '#ffb050', 1);
    },
  };

  DEF.bridge = {
    bg(g) {
      grad(g, 0, 0, W, 100, ['#03050c', '#08101e', '#121c34']);
      stars(g, 70, 21, 70);
      const r = rng(5);
      for (let x = 0; x < W; x += 6 + r() * 8) rect(g, x, 92 - r() * 10, 6 + r() * 8, 14, '#0a0e18');
      for (let i = 0; i < 40; i++) px(g, r() * W, 86 + r() * 10, r() < 0.5 ? '#e0c070' : '#8a7a50');
      rect(g, 0, 100, W, 80, '#081222');
      for (let x = -10; x < W; x += 64) {
        g.fillStyle = '#1a2030';
        for (let i = 0; i <= 64; i++) {
          const y = 100 - Math.sin((i / 64) * Math.PI) * 22;
          g.fillRect(x + i, Math.round(y), 1, 2);
          if (i % 8 === 0) g.fillRect(x + i, Math.round(y), 1, 100 - Math.round(y));
        }
        rect(g, x - 2, 104, 6, 76, '#10141e');
      }
      rect(g, 0, 98, W, 6, '#1c2230'); rect(g, 0, 97, W, 1, '#2c3444');
      for (const x of [40, 80, 120]) { rect(g, x, 91, 16, 7, '#20262c'); rect(g, x + 11, 88, 5, 4, '#20262c'); }
    },
    fg(g, t, st) {
      for (let i = 0; i < 60; i++) {
        const x = (i * 53 + Math.floor(t * 2) * 17) % W, y = 110 + ((i * 29) % 68);
        rect(g, x, y, 3 + (i % 4), 1, i % 3 ? 'rgba(80,110,160,0.35)' : 'rgba(220,190,110,0.25)');
      }
      for (const x of [40, 80, 120]) {
        g.fillStyle = 'rgba(255,240,180,0.10)';
        g.beginPath(); g.moveTo(x + 16, 93); g.lineTo(x + 60, 86); g.lineTo(x + 60, 102); g.closePath(); g.fill();
        px(g, x + 16, 93, '#fff2b0');
      }
      if (st.r() < 0.06) st.fl = { x: 200 + st.r() * 100, y: 90 + st.r() * 8, life: 0.12 };
      if (st.fl && st.fl.life > 0) { glow(g, st.fl.x, st.fl.y, 10, '#fff0a0', 0.8); px(g, st.fl.x, st.fl.y, '#ffffff'); st.fl.life -= st.dt; }
    },
  };

  DEF.office = {
    bg(g) {
      rect(g, 0, 0, W, H, '#3a2a20');
      for (let x = 0; x < W; x += 20) { rect(g, x, 0, 1, 130, '#2e2119'); rect(g, x + 1, 0, 1, 130, '#46342a'); }
      rect(g, 0, 128, W, 52, '#24180f');
      grad(g, 24, 22, 70, 76, ['#0a1024', '#1a2a4a', '#2a3a5a']);
      { const r = rng(4); for (let i = 0; i < 12; i++) px(g, 26 + r() * 66, 24 + r() * 30, '#cfd6e8'); }
      g.fillStyle = '#0e1420';
      for (let x = 24; x < 94; x++) g.fillRect(x, 80 - Math.round(Math.sin((x - 24) / 70 * Math.PI) * 18), 1, 18 + Math.round(Math.sin((x - 24) / 70 * Math.PI) * 18));
      rect(g, 24, 22, 70, 2, '#5a4230'); rect(g, 58, 22, 2, 76, '#5a4230'); rect(g, 24, 58, 70, 2, '#5a4230');
      for (let j = 0; j < 90; j++) { rect(g, 12 + Math.sin(j / 6) * 1.5, 14 + j, 14, 1, j % 6 < 3 ? '#6a1a1a' : '#5a1414'); rect(g, 92 + Math.sin(j / 6) * 1.5, 14 + j, 14, 1, j % 6 < 3 ? '#6a1a1a' : '#5a1414'); }
      rect(g, 10, 12, 98, 4, '#8a6a3a');
      rect(g, 140, 70, 44, 64, '#22140c'); rect(g, 144, 74, 36, 40, '#2e1c12');
      rect(g, 90, 118, 150, 8, '#5a3a22'); rect(g, 90, 117, 150, 1, '#7a5432'); rect(g, 94, 126, 142, 40, '#3a2416');
      for (let i = 0; i < 3; i++) rect(g, 100 + i * 48, 132, 40, 28, '#442a1a');
      rect(g, 110, 112, 18, 6, '#e8e2d4'); rect(g, 112, 110, 18, 6, '#f2ece0');
      rect(g, 196, 111, 10, 5, '#111'); rect(g, 198, 109, 6, 2, '#111');
      rect(g, 218, 104, 2, 14, '#2a5a3a'); rect(g, 212, 100, 14, 5, '#2a6a3a');
      rect(g, 268, 40, 2, 92, '#c8a050'); circle(g, 269, 38, 2, '#d8b060');
      taegukgi(g, 270, 44, 30);
    },
    fg(g, t, st) {
      const f = 0.22 + Math.sin(t * 3) * 0.02 + (st.r() < 0.02 ? -0.05 : 0);
      glow(g, 219, 104, 46, '#f0d890', f);
      for (let i = 0; i < 30; i++) {
        const yy = 44 + i, off = Math.sin(t * 2 + i / 5) * 1;
        rect(g, 300 + off, yy, 1, 1, 'rgba(0,0,0,0.15)');
      }
    },
  };

  DEF.protest = {
    bg(g) {
      grad(g, 0, 0, W, 110, ['#7a7a78', '#9a9894', '#b8b4aa']);
      const r = rng(31);
      for (let x = -4; x < W; x += 22 + r() * 16) building(g, x, 112, 20 + r() * 18, 30 + r() * 50, r() < 0.5 ? '#6a6a6c' : '#5c5c62', '#3a3a40', r);
      rect(g, 0, 112, W, 68, '#5e5850');
      for (let i = 0; i < 8; i++) {
        const x = 8 + i * 30;
        rect(g, x + 4, 92, 1, 30, '#3a3028');
        rect(g, x, 92, 22, 9, '#e8e2d2');
        for (let k = 0; k < 4; k++) rect(g, x + 2 + k * 5, 94 + (k % 2), 3, 4, i % 3 ? '#1a1a1a' : '#a02020');
      }
      for (let i = 0; i < 9; i++) {
        const x = 252 + (i % 3) * 22 + Math.floor(i / 3) * 4, y = 112 + Math.floor(i / 3) * 4;
        spr(g, 'soldier', x, y, { k: '#2a3028', f: '#a88a70', b: '#3a4034', l: '#22261e', g: '#5a6050' });
        rect(g, x - 2, y + 3, 2, 8, '#8a9090');
      }
    },
    fg(g, t, st) {
      for (let row = 0; row < 5; row++) for (let i = 0; i < 26; i++) {
        const x = i * 9 + (row % 2) * 4 - 4, y = 118 + row * 12 + (Math.floor(t * 4 + i * 1.3 + row) % 2);
        if (x > 240 - row * 6) continue;
        const up = (Math.floor(t * 1.5 + i * 0.7 + row) % 5) === 0;
        spr(g, up ? 'fist' : 'man', x, y, { a: '#2a2420', h: '#14100c', f: '#b89878', b: (i + row) % 3 ? '#d8d4c8' : '#2a2a30', l: '#22201e' });
      }
      stepParticles(st.p, st.dt);
      if (st.r() < 0.35) st.p.push({ x: 220 + st.r() * 30, y: 120 + st.r() * 40, vx: -8 - st.r() * 6, vy: -2 - st.r() * 2, life: 6, max: 6, s: 3, grow: 14 });
      drawSmoke(g, st.p, '#e8e8e0', 0.35);
    },
  };

  DEF.port = {
    bg(g) {
      grad(g, 0, 0, W, 96, ['#8ab8d8', '#b4d4e6', '#e2ecee']);
      grad(g, 0, 96, W, 60, ['#4a7a9a', '#2e5a7a']);
      ridge(g, '#6a8aa0', 98, 10, 41, 50);
      rect(g, 0, 96, W, 2, '#5a8aa8');
      rect(g, 130, 74, 180, 40, '#4a5258'); rect(g, 130, 108, 180, 6, '#2a2e32');
      rect(g, 136, 72, 172, 2, '#e8e8e2');
      rect(g, 190, 52, 70, 20, '#e4e2da'); rect(g, 200, 40, 50, 12, '#d8d6ce');
      for (let i = 0; i < 9; i++) rect(g, 194 + i * 7, 58, 4, 3, '#3a4a5a');
      rect(g, 226, 26, 12, 14, '#2a2e32'); rect(g, 226, 26, 12, 3, '#a02020');
      for (let i = 0; i < 40; i++) spr(g, 'soldier', 136 + i * 4.3, 64, { k: '#3a4a30', f: '#3a4a30', b: '#3a4a30', l: '#3a4a30', g: '#3a4a30' });
      rect(g, 0, 140, W, 40, '#8a8478'); rect(g, 0, 140, W, 2, '#a8a294');
    },
    fg(g, t, st) {
      for (let i = 0; i < 30; i++) {
        const x = (i * 37 + t * 4) % W, y = 116 + (i * 13) % 22;
        rect(g, x, y, 4 + (i % 3) * 2, 1, 'rgba(220,240,255,0.35)');
      }
      for (let i = 0; i < 34; i++) {
        const x = 4 + i * 9.4, y = 146 + (i % 2) * 6, up = Math.floor(t * 4 + i) % 2;
        spr(g, 'man', x, y, { h: '#1a1410', f: '#c8a080', b: i % 4 ? '#e4e0d4' : '#3a3a42', l: '#2a2622' });
        rect(g, x + 4, y - 4 + up, 1, 4, '#3a2a1a'); rect(g, x + 5, y - 5 + up, 4, 3, '#f4f2ec'); px(g, x + 6, y - 4 + up, '#c8102e');
      }
      birds(g, t, 12, 5, '#f4f4f0', 20);
    },
  };

  DEF.highway = {
    bg(g) {
      grad(g, 0, 0, W, 92, ['#6aa4d4', '#9ac4e0', '#d4e6ee']);
      ridge(g, '#6a8a7a', 88, 26, 51, 50);
      ridge(g, '#4a6a44', 102, 18, 61, 30);
      grad(g, 0, 92, W, 88, ['#7a8a4a', '#6a7a3e']);
      for (let y = 92; y < H; y++) {
        const k = (y - 92) / 88, half = 4 + k * 130, cx = 160;
        rect(g, cx - half - 6 - k * 20, y, 6 + k * 20, 1, '#a88a62');
        rect(g, cx + half, y, 6 + k * 20, 1, '#a88a62');
        rect(g, cx - half, y, half * 2, 1, y % 2 ? '#3a3a3e' : '#38383c');
      }
      rect(g, 40, 140, 26, 12, '#e0b030'); rect(g, 46, 132, 12, 9, '#e0b030'); rect(g, 48, 134, 8, 5, '#5a7a9a');
      rect(g, 34, 146, 8, 7, '#8a8a8a'); rect(g, 40, 152, 28, 4, '#2a2a2a');
      rect(g, 250, 128, 22, 10, '#c89a28'); rect(g, 254, 120, 10, 8, '#c89a28'); rect(g, 248, 138, 26, 3, '#2a2a2a');
    },
    fg(g, t, st) {
      for (let i = 0; i < 10; i++) {
        const p = ((i / 10) + t * 0.12) % 1, k = p * p, y = 92 + k * 88, len = 1 + k * 10;
        rect(g, 160 - Math.max(1, k * 3) / 2, y, Math.max(1, k * 3), len, '#e8d070');
      }
      const workers = [[80, 150], [92, 154], [228, 146], [240, 150], [276, 156]];
      workers.forEach(([x, y], i) => spr(g, 'man', x, y - (Math.floor(t * 3 + i) % 2), { h: '#e8e0c0', f: '#c89a78', b: '#5a6a7a', l: '#3a3a3e' }));
      stepParticles(st.p, st.dt);
      smoke(st.p, 54, 140, st.r, { rate: 0.4, wind: 6, up: 3, life: 4 });
      smoke(st.p, 262, 130, st.r, { rate: 0.3, wind: -5, up: 3, life: 4 });
      drawSmoke(g, st.p, '#c8b48a', 0.4);
    },
  };

  DEF.factory = {
    bg(g) {
      grad(g, 0, 0, W, 140, ['#0c0a12', '#1a121c', '#3a1c1a', '#6a2a18']);
      const c = '#120e14';
      rect(g, 40, 50, 30, 90, c); rect(g, 36, 44, 38, 8, c);
      rect(g, 90, 30, 8, 110, c); rect(g, 106, 40, 8, 100, c); rect(g, 122, 24, 8, 116, c);
      rect(g, 150, 70, 90, 70, c); rect(g, 150, 64, 90, 6, '#1a1418');
      for (let i = 0; i < 6; i++) rect(g, 156 + i * 14, 80, 8, 5, '#c85a1e');
      rect(g, 250, 40, 4, 100, c); rect(g, 250, 40, 60, 4, c); rect(g, 300, 44, 1, 30, '#2a2228');
      rect(g, 70, 90, 80, 3, c); rect(g, 74, 60, 2, 30, c);
      rect(g, 0, 138, W, 42, '#0e0a0c');
      rect(g, 0, 150, W, 3, '#ff7a1a'); rect(g, 0, 149, W, 1, '#ffb050');
      rect(g, 44, 120, 22, 18, '#d8601a');
    },
    fg(g, t, st) {
      glow(g, 55, 128, 40, '#ff8a2a', 0.35 + Math.sin(t * 5) * 0.05);
      glow(g, 160, 151, 120, '#ff7a1a', 0.12);
      stepParticles(st.p, st.dt);
      for (const x of [94, 110, 126]) smoke(st.p, x, 26, st.r, { rate: 0.5, wind: 5, up: 7, life: 7 });
      drawSmoke(g, st.p, '#2a2228', 0.7);
      if (st.r() < 0.8) st.e.push({ x: 55 + (st.r() - 0.5) * 16, y: 122, vx: (st.r() - 0.5) * 40, vy: -20 - st.r() * 30, g: 60, life: 1.2, max: 1.2, s: 1, grow: 0 });
      stepParticles(st.e, st.dt);
      drawSmoke(g, st.e, '#ffd070', 1.6);
    },
  };

  DEF.saemaul = {
    bg(g) {
      grad(g, 0, 0, W, 100, ['#7ab8e4', '#a8d4ee', '#d8eee8']);
      ridge(g, '#6aa65a', 96, 26, 71, 50);
      ridge(g, '#5a9a4a', 108, 10, 81, 30);
      grad(g, 0, 108, W, 72, ['#7aa84a', '#5a8a36']);
      for (let y = 140; y < H; y += 4) for (let x = (y % 8) ? 0 : 3; x < W; x += 6) rect(g, x, y, 2, 2, '#4a7a2a');
      rect(g, 0, 126, W, 10, '#c8b48a'); rect(g, 0, 126, W, 1, '#a89468');
      slate(g, 30, 124, 34, '#3a6aa6'); slate(g, 80, 122, 30, '#c45a3a'); slate(g, 124, 124, 36, '#e0a03a');
      slate(g, 182, 122, 30, '#3a6aa6'); slate(g, 226, 124, 32, '#c45a3a');
      for (let i = 0; i < 4; i++) rect(g, 20 + i * 90, 78, 2, 48, '#5a4030');
      g.strokeStyle = '#3a3030'; g.lineWidth = 1;
      g.beginPath(); for (let i = 0; i < 3; i++) { g.moveTo(21 + i * 90, 80); g.quadraticCurveTo(66 + i * 90, 88, 111 + i * 90, 80); } g.stroke();
      rect(g, 286, 70, 2, 56, '#d8d4c8');
    },
    fg(g, t, st) {
      for (let j = 0; j < 14; j++) for (let i = 0; i < 20; i++) {
        const off = Math.round(Math.sin(t * 4 - i * 0.4) * 1.2 * (i / 20));
        px(g, 288 + i, 72 + j + off, '#2a8a3a');
      }
      circle(g, 298 + Math.round(Math.sin(t * 4 - 4) * 0.6), 79, 4, '#f0d040');
      rect(g, 297 + Math.round(Math.sin(t * 4 - 4) * 0.6), 77, 2, 5, '#2a8a3a');
      for (let i = 0; i < 4; i++) {
        const x = ((t * 3 + i * 90) % (W + 60)) - 30, y = 16 + i * 9;
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(Math.round(x), y, 26, 4); g.fillRect(Math.round(x) + 5, y - 3, 14, 3);
      }
    },
  };

  DEF.sewing = {
    bg(g) {
      rect(g, 0, 0, W, H, '#3a3024');
      for (let y = 0; y < 44; y++) rect(g, 0, y, W, 1, y % 11 === 0 ? '#1e160e' : '#2e2418');
      for (let x = 0; x < W; x += 40) rect(g, x, 0, 4, 44, '#22180e');
      rect(g, 0, 44, W, 4, '#1a120a');
      rect(g, 0, 140, W, 40, '#2a2218');
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
        const x = 14 + i * 52 + row * 14, y = 96 + row * 34;
        rect(g, x, y, 40, 4, '#6a5440'); rect(g, x + 2, y + 4, 2, 14, '#3a2c1e'); rect(g, x + 36, y + 4, 2, 14, '#3a2c1e');
        rect(g, x + 8, y - 8, 14, 3, '#141414'); rect(g, x + 8, y - 8, 3, 8, '#141414'); rect(g, x + 19, y - 6, 3, 6, '#141414');
        px(g, x + 12, y - 7, '#9a9a9a');
        rect(g, x + 26, y - 3, 10, 3, ['#a04a4a', '#4a6aa0', '#c8b070'][(i + row) % 3]);
        spr(g, 'sitter', x + 2, y - 2, { h: '#141010', f: '#a88a70', b: (i + row) % 2 ? '#5a5a6a' : '#6a4a4a', l: '#2a2420' });
      }
      rect(g, 159, 0, 1, 50, '#1a1a1a');
    },
    fg(g, t, st) {
      const f = 0.4 + (st.r() < 0.05 ? -0.15 : 0) + Math.sin(t * 9) * 0.02;
      glow(g, 160, 52, 110, '#f0d890', f * 0.5);
      circle(g, 160, 52, 2, '#fff2c0');
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
        const x = 14 + i * 52 + row * 14, y = 96 + row * 34;
        rect(g, x + 13, y - 5 + (Math.floor(t * 12 + i) % 2), 1, 2, '#d0d0d0');
      }
      if (st.p.length < 30 && st.r() < 0.4) st.p.push({ x: 120 + st.r() * 80, y: 50 + st.r() * 90, vx: (st.r() - 0.5), vy: -0.3, life: 6, max: 6, s: 1, grow: 0 });
      stepParticles(st.p, st.dt);
      drawSmoke(g, st.p, '#fff0d0', 0.7);
    },
  };

  DEF.rally = {
    bg(g) {
      grad(g, 0, 0, W, 90, ['#7aaed6', '#a6cce4', '#d0e4ec']);
      for (let i = 0; i < 16; i++) circle(g, i * 21 + 6, 82 + (i % 3) * 3, 12, i % 2 ? '#3a6a3a' : '#2e5a30');
      rect(g, 0, 88, W, 92, '#7a7062');
      rect(g, 110, 62, 100, 34, '#e8e2d0'); rect(g, 110, 62, 100, 3, '#a02020');
      for (let k = 0; k < 8; k++) rect(g, 118 + k * 11, 72, 7, 8, '#1a1a1a');
      rect(g, 100, 96, 120, 12, '#5a3a22'); rect(g, 100, 96, 120, 2, '#7a5432');
      rect(g, 153, 86, 14, 10, '#6a4a2e');
      spr(g, 'man', 158, 76, { h: '#141010', f: '#c8a080', b: '#2a2a32', l: '#2a2a32' });
    },
    fg(g, t, st) {
      for (let row = 0; row < 7; row++) for (let i = 0; i < 40; i++) {
        const x = i * 8.2 + (row % 2) * 4 - 4, y = 112 + row * 10 + (Math.floor(t * 3 + i * 0.9 + row) % 2);
        spr(g, 'man', x, y, { h: '#14100c', f: '#c0a080', b: (i * 7 + row) % 5 ? '#ece8dc' : '#3a3a44', l: '#3a3632' });
      }
      for (let i = 0; i < 5; i++) {
        const x = 30 + i * 62, fl = Math.round(Math.sin(t * 5 + i) * 1);
        rect(g, x, 92, 1, 22, '#3a2a1a'); rect(g, x + 1, 92 + fl, 14, 6, i % 2 ? '#e8e2d0' : '#a02020');
      }
    },
  };

  DEF.sea = {
    bg(g) {
      grad(g, 0, 0, W, 104, ['#02040a', '#060c1a', '#101a30']);
      stars(g, 90, 33, 90);
      circle(g, 252, 30, 8, '#e8e4d0'); circle(g, 255, 28, 7, '#101a30');
      rect(g, 0, 102, W, 78, '#060c18');
      rect(g, 100, 106, 52, 8, '#03050a'); rect(g, 116, 98, 18, 8, '#03050a'); rect(g, 126, 90, 2, 8, '#03050a');
    },
    fg(g, t, st) {
      for (let i = 0; i < 70; i++) {
        const y = 104 + (i * 7) % 76, x = (i * 41 + Math.sin(t + i) * 4 + t * (i % 3 + 1) * 2) % W;
        rect(g, x, y, 3 + (i % 5), 1, 'rgba(70,100,150,0.35)');
      }
      for (let j = 0; j < 40; j++) {
        const y = 106 + j * 1.8, w = 2 + Math.abs(Math.sin(t * 2 + j)) * 6;
        rect(g, 252 - w / 2, y, w, 1, 'rgba(230,226,200,0.25)');
      }
      px(g, 120, 104, (Math.floor(t * 2) % 2) ? '#f0d080' : '#806030');
    },
  };

  DEF.theater = {
    bg(g) {
      rect(g, 0, 0, W, H, '#0e0708');
      for (let x = 0; x < W; x += 6) rect(g, x, 0, 6, 26, x % 12 ? '#5a1216' : '#7a1a1e');
      for (let y = 0; y < 26; y += 4) rect(g, 0, 24 + Math.sin(y) * 2, W, 2, '#8a2a2a');
      for (let x = 0; x < 40; x += 5) rect(g, x, 26, 5, 110, x % 10 ? '#5a1216' : '#7a1a1e');
      for (let x = 280; x < W; x += 5) rect(g, x, 26, 5, 110, x % 10 ? '#5a1216' : '#7a1a1e');
      rect(g, 40, 26, 240, 90, '#1e1414');
      rect(g, 80, 34, 160, 22, '#e8dcc0');
      for (let k = 0; k < 10; k++) rect(g, 90 + k * 14, 41, 9, 9, k === 4 || k === 5 ? '#c8102e' : '#2a2a2a');
      taegukgi(g, 48, 34, 24); taegukgi(g, 248, 34, 24);
      rect(g, 40, 112, 240, 26, '#3a2418'); rect(g, 40, 112, 240, 2, '#5a3a24');
      for (let i = 0; i < 6; i++) { spr(g, 'sitter', 56 + i * 12, 98, '#140c0c'); spr(g, 'sitter', 200 + i * 12, 98, '#140c0c'); }
      rect(g, 150, 92, 20, 22, '#5a3a22'); rect(g, 148, 90, 24, 3, '#7a5432');
      for (let i = 0; i < 9; i++) circle(g, 146 + i * 3.5, 112, 2, i % 2 ? '#e8e8e0' : '#d04a5a');
      spr(g, 'man', 158, 78, { h: '#0e0a0a', f: '#b89878', b: '#1a1a22', l: '#1a1a22' });
    },
    fg(g, t, st) {
      for (const [x, s] of [[90, 1], [230, -1]]) {
        const sw = Math.sin(t * 0.8 * s) * 10;
        g.fillStyle = 'rgba(255,244,208,0.08)';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 10, 0); g.lineTo(165 + sw + 26, 120); g.lineTo(165 + sw - 26, 120); g.closePath(); g.fill();
      }
      for (let row = 0; row < 3; row++) for (let i = 0; i < 34; i++) {
        const x = i * 10 - 6 + (row % 2) * 5, y = 146 + row * 12;
        circle(g, x + 4, y, 4, '#070304'); rect(g, x - 1, y + 3, 10, 12, '#070304');
      }
    },
  };

  DEF.night = {
    bg(g) {
      rect(g, 0, 0, W, H, '#1e140e');
      rect(g, 30, 20, 120, 70, '#3a2c1e');
      for (let x = 30; x <= 150; x += 15) rect(g, x, 20, 2, 70, '#120c08');
      for (let y = 20; y <= 90; y += 14) rect(g, 30, y, 122, 2, '#120c08');
      rect(g, 180, 24, 110, 80, '#5a4a30');
      for (let i = 0; i < 5; i++) rect(g, 180 + i * 22, 24, 1, 80, '#3a2e1c');
      g.fillStyle = '#2a2014';
      for (let x = 180; x < 290; x++) g.fillRect(x, Math.round(70 - Math.abs(Math.sin((x - 180) / 18)) * 22 - Math.sin(x / 7) * 3), 1, 3);
      rect(g, 0, 118, W, 62, '#140e0a');
      rect(g, 50, 122, 220, 12, '#4a2c16'); rect(g, 50, 121, 220, 1, '#6a4422'); rect(g, 60, 134, 200, 6, '#2a1a0e');
      for (let i = 0; i < 9; i++) { circle(g, 70 + i * 22, 125, 3, '#e8e2d4'); px(g, 70 + i * 22, 124, '#a04a2a'); }
      for (const x of [110, 168, 214]) { rect(g, x, 112, 4, 10, '#2a5a3a'); rect(g, x + 1, 110, 2, 2, '#2a5a3a'); }
      for (let i = 0; i < 6; i++) {
        const x = 64 + i * 38;
        spr(g, 'sitter', x, i % 2 ? 136 : 106, '#080504', 2);
      }
    },
    fg(g, t, st) {
      const f = 0.3 + Math.sin(t * 2.3) * 0.03 + (st.r() < 0.03 ? -0.08 : 0);
      glow(g, 160, 60, 150, '#f0b860', f);
      rect(g, 159, 0, 2, 40, '#0e0806'); rect(g, 150, 40, 20, 6, '#6a4a22');
      stepParticles(st.p, st.dt);
      smoke(st.p, 216, 108, st.r, { rate: 0.15, wind: 1, up: 4, life: 6 });
      drawSmoke(g, st.p, '#a8a090', 0.25);
    },
  };

  DEF.dawn = {
    bg(g) {
      grad(g, 0, 0, W, 124, ['#24304e', '#4a5a7e', '#a08aa0', '#e8b494', '#f6d6a6']);
      circle(g, 160, 124, 20, '#fbe2b0');
      ridge(g, '#5a6a84', 112, 16, 91, 60);
      ridge(g, '#3a4660', 126, 12, 93, 40);
      ridge(g, '#222a3a', 142, 10, 95, 30);
      grad(g, 0, 150, W, 30, ['#1a2030', '#12161f']);
    },
    fg(g, t, st) {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.22 + Math.sin(t * 0.3) * 0.03;
        g.fillStyle = 'rgba(255,230,180,0.05)';
        g.beginPath(); g.moveTo(160, 124); g.lineTo(160 + Math.cos(a - 0.05) * 260, 124 + Math.sin(a - 0.05) * 260); g.lineTo(160 + Math.cos(a + 0.05) * 260, 124 + Math.sin(a + 0.05) * 260); g.closePath(); g.fill();
      }
      birds(g, t, 21, 5, '#1a2030', 50);
    },
  };

  /* ───────────── 렌더 루프 ───────────── */
  let canvas, ctx, cur = null, prev = null, fade = 0, flash = 0, shake = 0, last = 0, tStart = 0, running = false;

  function build(key) {
    const def = DEF[key] || DEF.dawn;
    const layer = document.createElement('canvas');
    layer.width = W; layer.height = H;
    const g = layer.getContext('2d');
    def.bg(g);
    return { key, def, layer, st: { p: emitter(), e: emitter(), r: rng(key.length * 97 + 13), dt: 0.016 } };
  }

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    tStart = performance.now();
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  function set(key) {
    if (cur && cur.key === key) return;
    if (cur) {
      prev = document.createElement('canvas'); prev.width = W; prev.height = H;
      prev.getContext('2d').drawImage(canvas, 0, 0);
      fade = 1;
    }
    cur = build(key);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (!cur) return;
    const t = (now - tStart) / 1000;
    ctx.save();
    if (shake > 0) { ctx.translate(Math.round((Math.random() - 0.5) * 6 * shake), Math.round((Math.random() - 0.5) * 6 * shake)); shake = Math.max(0, shake - dt * 2.5); }
    ctx.drawImage(cur.layer, 0, 0);
    cur.st.dt = dt;
    cur.def.fg && cur.def.fg(ctx, t, cur.st);
    if (fade > 0 && prev) {
      ctx.globalAlpha = fade; ctx.drawImage(prev, 0, 0); ctx.globalAlpha = 1;
      fade = Math.max(0, fade - dt * 1.6);
      if (fade === 0) prev = null;
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,250,235,${flash})`; ctx.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - dt * 2.2);
    }
    ctx.restore();
  }

  /* 파티클을 미리 돌려 둔 정지 화면 (스토어 이미지·썸네일용) */
  function snapshot(key, t = 4) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H;
    const sg = scratch.getContext('2d');
    const s = build(key);
    if (s.def.fg) for (let i = 0; i < 150; i++) { s.st.dt = 1 / 30; s.def.fg(sg, t - (150 - i) / 30, s.st); }
    g.drawImage(s.layer, 0, 0);
    if (s.def.fg) s.def.fg(g, t, s.st);
    return c;
  }

  return {
    init, set, snapshot, keys: () => Object.keys(DEF),
    flash: (a = 0.9) => { flash = a; }, shake: (a = 1) => { shake = a; },
    current: () => (cur ? cur.key : null),
    util: { rng, rect, px, grad, ridge, circle, glow, spr, sprH, taegukgi, birds, stars, noise1, W, H },
  };
})();
