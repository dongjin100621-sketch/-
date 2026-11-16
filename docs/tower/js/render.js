'use strict';
/* 그리기: 배경 → 바닥 → 바닥 위 표시(예고·장판) → 줄마다 벽/사물/인물 → 탄·입자 → 조명 → 빛 번짐 → HUD */

const RENDER = (() => {
  let cv, x, lc, lx, vig;
  const VW = 1066, VH = 600, LS = 2;   // 조명은 절반 해상도
  const glowSoft = new Map();

  function init() {
    cv = document.getElementById('cv');
    cv.width = VW; cv.height = VH;
    x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    [lc, lx] = U.canvas(VW / LS, VH / LS);
    // 가장자리 어둡게
    let vx;
    [vig, vx] = U.canvas(VW, VH);
    const g = vx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(4,2,10,0.55)');
    vx.fillStyle = g; vx.fillRect(0, 0, VW, VH);
  }
  function soft(rgb) {
    const k = rgb.join(',');
    if (!glowSoft.has(k)) {
      const [c, cx] = U.canvas(64, 64);
      const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, U.rgba(rgb, 1)); g.addColorStop(0.45, U.rgba(rgb, 0.5)); g.addColorStop(1, U.rgba(rgb, 0));
      cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
      glowSoft.set(k, c);
    }
    return glowSoft.get(k);
  }

  function draw() {
    const st = G.state;
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (ENT.w && (st === 'play' || st === 'dying' || st === 'dead' || st === 'reward' || st === 'pause' || st === 'victory')) {
      drawWorld();
      if (st === 'play' || st === 'dying' || st === 'pause') drawHUD();
    } else drawTitle();
  }

  /* ───────── 타이틀 배경: 별을 삼키는 탑 ───────── */
  let titleBg = null;
  function drawTitle() {
    const t = G.time;
    if (!titleBg) {
      const [c, cx] = U.canvas(VW, VH);
      const g = cx.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, '#05030e'); g.addColorStop(0.6, '#140c2e'); g.addColorStop(1, '#2a1640');
      cx.fillStyle = g; cx.fillRect(0, 0, VW, VH);
      const R = U.rng(7);
      for (let i = 0; i < 420; i++) { const b = R(); cx.fillStyle = b > 0.95 ? '#ffffff' : b > 0.7 ? '#c8b8ff' : '#6a5a98'; const s = b > 0.97 ? 2 : 1; cx.fillRect(R.int(0, VW), R.int(0, VH * 0.85), s, s); }
      // 먼 산
      for (let layer = 0; layer < 2; layer++) {
        cx.fillStyle = layer ? '#0c0818' : '#1a1030';
        cx.beginPath(); cx.moveTo(0, VH);
        for (let xx = 0; xx <= VW; xx += 8) cx.lineTo(xx, VH - 70 - layer * -30 - U.fbm(xx, layer * 100, 120, 3 + layer, 3) * (110 - layer * 40));
        cx.lineTo(VW, VH); cx.fill();
      }
      // 탑
      const tx = VW * 0.7;
      cx.fillStyle = '#08050f';
      cx.beginPath(); cx.moveTo(tx - 60, VH); cx.lineTo(tx - 34, 80); cx.lineTo(tx - 20, 40); cx.lineTo(tx - 12, 0); cx.lineTo(tx + 12, 0); cx.lineTo(tx + 20, 40); cx.lineTo(tx + 34, 80); cx.lineTo(tx + 60, VH); cx.fill();
      for (let y = 100; y < VH - 40; y += 34) { cx.fillStyle = 'rgba(255,190,120,0.5)'; cx.fillRect(tx - 4 + (y % 68 ? 10 : -12), y, 3, 5); }
      titleBg = c;
    }
    x.drawImage(titleBg, 0, 0);
    // 빨려 드는 별
    const tx = VW * 0.7;
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const k = ((t * 0.12 + i / 26) % 1), a = i * 2.4;
      const r = (1 - k) * 420;
      const px = tx + Math.cos(a + k * 2) * r, py = 10 + Math.sin(a + k * 2) * r * 0.5;
      x.globalAlpha = k < 0.1 ? k * 10 : 1 - k * 0.5;
      x.drawImage(PX.glow(4, [220, 190, 255], 3), px - 5, py - 5);
      x.fillStyle = '#fff'; x.fillRect(px | 0, py | 0, 2, 2);
    }
    x.globalAlpha = 1;
    x.drawImage(soft([160, 90, 255]), tx - 90, -60, 180, 140);
    x.globalCompositeOperation = 'source-over';
    x.drawImage(vig, 0, 0);
  }

  /* ───────── 세계 ───────── */
  function drawWorld() {
    const w = ENT.w, L = w.L, B = w.B, th = TILES.THEMES[L.tier];
    const cx = Math.round(G.cam.x + FX.shakeX), cy = Math.round(G.cam.y + FX.shakeY);
    const T = 32;
    // 배경(시차)
    const bx = -100 - U.clamp(cx * 0.12, -100, 100), by = -100 - U.clamp(cy * 0.12, -100, 100);
    x.drawImage(G.bg, Math.round(bx), Math.round(by));
    if (th.id === 'void') {
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) { const sx = (U.hash2(i, 1, 3) * 1300 - cx * (0.2 + U.hash2(i, 2, 3) * 0.3)) % 1100, sy = (U.hash2(i, 4, 3) * 800 - cy * 0.25) % 640; const tw = 0.5 + 0.5 * Math.sin(w.t * 2 + i); x.globalAlpha = tw; x.fillStyle = '#e8d8ff'; x.fillRect((sx + 1100) % 1100 - 20, (sy + 640) % 640 - 20, 2, 2); }
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    }
    x.save();
    x.translate(-cx, -cy);
    // 바닥
    const fw = B.floor.width, fh = B.floor.height;
    const sx0 = U.clamp(cx, 0, fw), sy0 = U.clamp(cy, 0, fh), sx1 = U.clamp(cx + VW, 0, fw), sy1 = U.clamp(cy + VH, 0, fh);
    if (sx1 > sx0 && sy1 > sy0) x.drawImage(B.floor, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
    const fr = Math.floor(w.t * 4) % 4;
    for (const [hx, hy, v, k] of B.haz) { const px = hx * T, py = hy * T; if (px > cx - T && px < cx + VW && py > cy - T && py < cy + VH) x.drawImage(B.hazC[k][fr], px, py); }
    // 출구
    if (G.portal) drawPortal(G.portal, w.t, th);
    // 장판
    for (const z of w.zones) drawZone(z);
    // 예고
    for (const t of w.tels) drawTel(t);
    // 그림자(사람·몬스터·탄)
    x.fillStyle = 'rgba(6,2,14,0.32)';
    const p = w.player;
    for (const e of w.enemies) {
      if (e.dead || e.spawnT > 0 || e.gone) continue;
      const sr = e.boss ? e.r * 1.1 : e.r * 1.05;
      x.beginPath(); x.ellipse(Math.round(e.x), Math.round(e.y), sr * (e.air ? Math.max(0.4, 1 - e.air / 400) : 1), sr * 0.38, 0, 0, U.TAU); x.fill();
    }
    if (p.alive && p.fallT <= 0) { x.beginPath(); x.ellipse(Math.round(p.x), Math.round(p.y), 9, 3.5, 0, 0, U.TAU); x.fill(); }
    for (const l of w.lobs) { const k = l.t / l.dur; const gx = U.lerp(l.x0, l.tx, k), gy = U.lerp(l.x0 === l.tx ? l.y0 : l.y0 + 40, l.ty, k); x.beginPath(); x.ellipse(gx, gy, l.big ? 14 : 6, l.big ? 5 : 2.5, 0, 0, U.TAU); x.fill(); }

    // 줄마다 벽·사물과 인물
    const list = [];
    for (const e of w.enemies) if (!e.dead && !e.gone && (e.spawnT <= 0)) list.push(e);
    if (p.alive || G.state === 'dying') list.push(p);
    for (const k of w.picks) list.push(k);
    for (const f of B.flames) list.push({ kind: 'flame', x: f.x, y: f.y + 30, fy: f.y });
    list.sort((a, b) => a.y - b.y);
    let li = 0;
    const r0 = Math.max(0, Math.floor(cy / T) - 1), r1 = Math.min(L.h - 1, Math.floor((cy + VH) / T) + 3);
    while (li < list.length && list[li].y < r0 * T) drawEnt(list[li++], w);
    for (let r = r0; r <= r1; r++) {
      const s = B.strips[r];
      if (s) x.drawImage(s.c, 0, s.oy);
      while (li < list.length && list[li].y < (r + 1) * T) drawEnt(list[li++], w);
    }
    while (li < list.length) drawEnt(list[li++], w);

    // 탄
    for (const l of w.lobs) drawLob(l);
    for (const b of w.pb) drawPB(b);
    for (const b of w.eb) drawEB(b);
    for (const b of w.beams) drawBeam(b);
    FX.drawParts(x, false);
    FX.drawFx(x);
    x.restore();

    // 조명
    drawLight(w, th, cx, cy);
    // 빛 번짐(가산)
    x.save();
    x.translate(-cx, -cy);
    x.globalCompositeOperation = 'lighter';
    for (const b of w.eb) {
      if (b.delay > 0) continue;
      const B2 = DATA.BUL[b.kind]; const c = glowCol(b.kind);
      x.globalAlpha = 0.55; const r = b.r * 2.4;
      x.drawImage(PX.glow(Math.round(r), c, 4), Math.round(b.x - r - 1), Math.round(b.y - r - 1));
      void B2;
    }
    x.globalAlpha = 0.5;
    for (const b of w.pb) { const c = b.kind === 'orb' ? [180, 120, 255] : b.kind === 'wave' ? [140, 210, 255] : b.kind === 'mirror' ? [180, 240, 255] : [255, 230, 180]; const r = b.kind === 'arrow' ? 6 : b.r * 2; x.drawImage(PX.glow(Math.round(r), c, 4), Math.round(b.x - r - 1), Math.round(b.y - r - 1)); }
    x.globalAlpha = 1;
    for (const b of w.beams) drawBeamGlow(b);
    for (const f of B.flames) drawFlame(f.x, f.y, w.t);
    if (th.id === 'void' && B.hasPit) {
      x.save(); x.clip(B.pitPath);
      for (let i = 0; i < 160; i++) {
        const depth = 0.3 + U.hash2(i, 9, 1) * 0.6;
        const sx = U.hash2(i, 1, 7) * 1400 + cx * (1 - depth), sy = U.hash2(i, 2, 7) * 900 + cy * (1 - depth);
        const px = ((sx % 1400) + 1400) % 1400 + cx - 160, py = ((sy % 900) + 900) % 900 + cy - 150;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(w.t * (0.8 + depth) + i));
        x.globalAlpha = tw; x.fillStyle = i % 7 ? '#c8b8ff' : '#ffffff';
        const s2 = i % 11 === 0 ? 2 : 1; x.fillRect(Math.round(px), Math.round(py), s2, s2);
      }
      x.globalAlpha = 1; x.restore();
    }
    FX.drawParts(x, true);
    x.globalCompositeOperation = 'source-over';
    x.restore();
    // 숫자
    x.save(); x.translate(-cx, -cy); FX.drawNums(x); x.restore();
    x.drawImage(vig, 0, 0);
    if (w.warpT > 0) { x.fillStyle = `rgba(120,80,200,${Math.min(0.18, w.warpT * 0.2)})`; x.fillRect(0, 0, VW, VH); }
    if (FX.flashA > 0) { x.fillStyle = U.rgba(FX.flashC, FX.flashA * 0.6); x.fillRect(0, 0, VW, VH); }
    if (p.alive && p.hp < p.st.maxHp * 0.3) { const a = 0.15 + 0.1 * Math.sin(G.time * 6); const g = x.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VW * 0.6); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,20,${a})`); x.fillStyle = g; x.fillRect(0, 0, VW, VH); }
    if (G.state === 'dying' || G.state === 'dead') { x.fillStyle = `rgba(10,0,6,${Math.min(0.6, (G.deathT || 0) * 0.4)})`; x.fillRect(0, 0, VW, VH); }
  }
  const GLOWC = {};
  function glowCol(kind) {
    if (GLOWC[kind]) return GLOWC[kind];
    const B = DATA.BUL[kind]; let c = [255, 200, 120];
    if (B && B.orb) c = U.hexRgb(B.orb);
    else if (kind === 'arrow') c = [255, 220, 160]; else if (kind === 'ice' || kind === 'needle') c = [150, 230, 255]; else if (kind === 'fire') c = [255, 140, 50]; else if (kind === 'star') c = [255, 230, 140];
    GLOWC[kind] = c; return c;
  }

  function drawLight(w, th, cx, cy) {
    const amb = U.mix([255, 255, 255], th.tint, 0.5).map(v => v * (1 - th.dark));
    lx.globalCompositeOperation = 'source-over';
    lx.fillStyle = U.rgba(amb, 1); lx.fillRect(0, 0, lc.width, lc.height);
    lx.globalCompositeOperation = 'lighter';
    const L = (px, py, r, c, a = 1) => {
      const sx = (px - cx) / LS, sy = (py - cy) / LS, rr = r / LS;
      if (sx < -rr || sy < -rr || sx > lc.width + rr || sy > lc.height + rr) return;
      lx.globalAlpha = a; lx.drawImage(soft(c), sx - rr, sy - rr, rr * 2, rr * 2);
    };
    const p = w.player;
    L(p.x, p.y - 16, 340, [255, 240, 220], 0.85);
    for (const l of w.B.lights) L(l.x, l.y, l.r * (1 + Math.sin(w.t * 7 + l.x) * l.fl), l.c, 0.8);
    for (const b of w.eb) if (b.r >= 5) L(b.x, b.y, b.r * 8, glowCol(b.kind), 0.35);
    for (const b of w.pb) L(b.x, b.y, 40, [255, 230, 200], 0.3);
    for (const z of w.zones) L(z.x, z.y, z.r * 2.4, z.kind === 'fire' ? [255, 130, 50] : z.kind === 'poison' ? [150, 230, 90] : [150, 220, 255], 0.5);
    for (const b of w.beams) if (b.t > b.warm) { const n = 6; for (let i = 0; i <= n; i++) L(b.x + Math.cos(b.ang) * b.cur * i / n, b.y + Math.sin(b.ang) * b.cur * i / n, 90, b.c, 0.5); }
    if (G.portal) L(G.portal.x, G.portal.y - 20, 200, [255, 220, 150], 0.9);
    for (const e of w.enemies) if (e.boss) L(e.x, e.y - e.h * 0.5, 260, [255, 230, 220], 0.35);
    lx.globalAlpha = 1;
    x.globalCompositeOperation = 'multiply';
    x.imageSmoothingEnabled = true;
    x.drawImage(lc, 0, 0, VW, VH);
    x.imageSmoothingEnabled = false;
    x.globalCompositeOperation = 'source-over';
  }

  function drawPortal(pt, t, th) {
    const k = Math.min(1, pt.t * 2);
    x.save();
    x.translate(Math.round(pt.x), Math.round(pt.y));
    x.fillStyle = `rgba(255,220,150,${0.25 * k})`;
    x.beginPath(); x.ellipse(0, 0, 26 * k, 10 * k, 0, 0, U.TAU); x.fill();
    for (let i = 0; i < 3; i++) { x.strokeStyle = `rgba(255,${200 + i * 20},${120 + i * 50},${(0.9 - i * 0.25) * k})`; x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, (14 + i * 6 + Math.sin(t * 4 + i) * 2) * k, (5 + i * 2.2) * k, 0, 0, U.TAU); x.stroke(); }
    x.globalCompositeOperation = 'lighter';
    const g = x.createLinearGradient(0, -110, 0, 0);
    g.addColorStop(0, 'rgba(255,220,150,0)'); g.addColorStop(1, `rgba(255,220,150,${0.5 * k})`);
    x.fillStyle = g; x.fillRect(-14 * k, -110, 28 * k, 110);
    for (let i = 0; i < 6; i++) { const yy = -((t * 50 + i * 20) % 110), xx = Math.sin(t * 3 + i * 2) * 10; x.fillStyle = `rgba(255,240,200,${k * (1 + yy / 110)})`; x.fillRect(Math.round(xx), Math.round(yy), 2, 2); }
    x.globalCompositeOperation = 'source-over';
    x.restore();
  }
  function drawZone(z) {
    const k = z.t / z.dur, a = (k < 0.1 ? k * 10 : k > 0.8 ? (1 - k) * 5 : 1);
    const c = z.kind === 'fire' ? [255, 110, 40] : z.kind === 'poison' ? [140, 210, 70] : [140, 210, 255];
    x.fillStyle = U.rgba(c, 0.22 * a);
    x.beginPath(); x.ellipse(z.x, z.y, z.r, z.r * 0.6, 0, 0, U.TAU); x.fill();
    x.fillStyle = U.rgba(c, 0.18 * a);
    x.beginPath(); x.ellipse(z.x, z.y, z.r * 0.6, z.r * 0.36, 0, 0, U.TAU); x.fill();
  }
  function drawTel(t) {
    const k = U.clamp(t.t / t.dur, 0, 1);
    const c = t.friendly ? [180, 120, 255] : [255, 60, 70];
    const pulse = 0.5 + 0.5 * Math.sin(t.t * 22);
    x.save();
    if (t.k === 'circle') {
      x.fillStyle = U.rgba(c, 0.12 + 0.06 * pulse); x.beginPath(); x.ellipse(t.x, t.y, t.r, t.r * 0.62, 0, 0, U.TAU); x.fill();
      x.fillStyle = U.rgba(c, 0.28); x.beginPath(); x.ellipse(t.x, t.y, t.r * k, t.r * 0.62 * k, 0, 0, U.TAU); x.fill();
      x.strokeStyle = U.rgba(c, 0.8); x.lineWidth = 2; x.beginPath(); x.ellipse(t.x, t.y, t.r, t.r * 0.62, 0, 0, U.TAU); x.stroke();
    } else if (t.k === 'line') {
      x.translate(t.x, t.y); x.rotate(t.ang);
      x.fillStyle = U.rgba(c, 0.12 + 0.06 * pulse); x.fillRect(0, -t.w / 2, t.len, t.w);
      x.fillStyle = U.rgba(c, 0.3); x.fillRect(0, -t.w / 2, t.len * k, t.w);
      x.strokeStyle = U.rgba(c, 0.7); x.lineWidth = 1; x.strokeRect(0, -t.w / 2, t.len, t.w);
    } else if (t.k === 'cone') {
      x.translate(t.x, t.y);
      x.fillStyle = U.rgba(c, 0.14 + 0.06 * pulse);
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, t.r, t.ang - t.arc / 2, t.ang + t.arc / 2); x.closePath(); x.fill();
      x.fillStyle = U.rgba(c, 0.3);
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, t.r * k, t.ang - t.arc / 2, t.ang + t.arc / 2); x.closePath(); x.fill();
    }
    x.restore();
  }
  function spr(g, px, py, flip, alpha = 1) {
    if (alpha < 1) x.globalAlpha = alpha;
    if (flip) { x.save(); x.translate(Math.round(px), 0); x.scale(-1, 1); x.drawImage(g.c, -g.ax, Math.round(py - g.ay)); x.restore(); }
    else x.drawImage(g.c, Math.round(px - g.ax), Math.round(py - g.ay));
    if (alpha < 1) x.globalAlpha = 1;
  }
  function sprImg(img, g, px, py, flip, scale = 1) {
    const w = img.width * scale, h = img.height * scale;
    if (flip) { x.save(); x.translate(Math.round(px), 0); x.scale(-1, 1); x.drawImage(img, Math.round(-g.ax * scale), Math.round(py - g.ay * scale), w, h); x.restore(); }
    else x.drawImage(img, Math.round(px - g.ax * scale), Math.round(py - g.ay * scale), w, h);
  }

  function drawEnt(e, w) {
    if (e.kind === 'p') return drawPlayer(e, w);
    if (e.kind === 'e') return drawEnemy(e, w);
    if (e.kind === 'flame') return;
    if (e.k === 'coin') { const g = ART.get('coin', Math.floor(w.t * 10 + e.t * 7)); spr(g, e.x, e.y - e.z - 2, false); return; }
    if (e.k === 'heart') { const g = ART.get('heart', 0); spr(g, e.x, e.y - e.z - 6 - Math.sin(w.t * 4) * 2, false); return; }
  }
  function drawPlayer(p, w) {
    if (p.fallT > 0) {
      const k = p.fallT / 0.5;
      const g = ART.get(`hero_${p.cls}_down`, 0);
      sprImg(g.c, g, p.x, p.y + (1 - k) * 10, false, Math.max(0.1, k));
      return;
    }
    const view = p.view, g = ART.get(`hero_${p.cls}_${view}`, p.moving ? Math.floor(p.t * 9) % 4 : (Math.floor(p.t * 2) % 2 ? 0 : 0));
    const flip = view === 'side' && p.flip;
    const blink = p.iT > 0 && p.dashT <= 0 && p.spinT <= 0 && Math.floor(G.time * 20) % 2 === 0;
    // 구르기 잔상
    if (p.dashT > 0) for (let i = 1; i <= 3; i++) { x.globalAlpha = 0.25 / i; const sil = PX.cache('sil' + g.c.width + view + p.cls, () => PX.silhouette(g.c, [160, 180, 255])); sprImg(sil, g, p.x - Math.cos(p.dashDir) * i * 10, p.y - Math.sin(p.dashDir) * i * 10, flip); }
    x.globalAlpha = 1;
    const wBehind = view === 'up';
    if (wBehind) drawWeapon(p, w);
    if (!blink) {
      if (p.spinT > 0) { x.save(); x.translate(Math.round(p.x), Math.round(p.y - 20)); x.scale(Math.cos(p.t * 30) >= 0 ? 1 : -1, 1); x.drawImage(g.c, -g.ax, -g.ay + 20); x.restore(); }
      else spr(g, p.x, p.y, flip);
      if (p.hurtT > 0) { x.globalAlpha = p.hurtT * 3; sprImg(PX.cache('wsil' + view + p.cls + g.c.width + (p.moving ? Math.floor(p.t * 9) % 4 : 0), () => PX.silhouette(g.c, [255, 255, 255])), g, p.x, p.y, flip); x.globalAlpha = 1; }
    }
    if (!wBehind) drawWeapon(p, w);
    // 보호막
    if (p.shield > 0) { x.strokeStyle = `rgba(140,220,255,${0.35 + 0.15 * Math.sin(G.time * 5)})`; x.lineWidth = 1; x.beginPath(); x.ellipse(p.x, p.y - 18, 16, 22, 0, 0, U.TAU); x.stroke(); }
    // 수호 구체
    for (let i = 0; i < p.st.orbit; i++) {
      const a = p.orbA + i * U.TAU / p.st.orbit, ox = p.x + Math.cos(a) * 46, oy = p.y - 12 + Math.sin(a) * 46;
      const o = ART.orb('#9ad8ff', 5); x.drawImage(o.c, Math.round(ox - o.ax), Math.round(oy - o.ay));
    }
  }
  function drawWeapon(p, w) {
    const C = p.cls, a = p.face;
    if (p.spinT > 0) return;
    const hx = p.x + (p.view === 'side' ? (p.flip ? -5 : 5) : Math.cos(a) * 6), hy = p.y - 16 + (p.view === 'up' ? -2 : 1);
    let g, ang, ox = 0;
    if (C === 'blade') {
      g = ART.get('w_sword', 0);
      if (p.swingT > 0) { const k = 1 - p.swingT / 0.18, dir = p.swingDir || 1; ang = p.swingA + dir * (-1.3 + 2.6 * U.easeOut(k)); }
      else ang = a + (Math.cos(a) < 0 ? -0.9 : 0.9);
      x.save(); x.translate(Math.round(hx), Math.round(hy)); x.rotate(ang + Math.PI / 2); x.drawImage(g.c, -g.ax, -g.ay - 2); x.restore();
    } else if (C === 'ranger') {
      g = ART.get('w_bow', 0); ang = a; ox = 8;
      x.save(); x.translate(Math.round(hx + Math.cos(a) * ox), Math.round(hy + Math.sin(a) * ox)); x.rotate(ang); x.drawImage(g.c, -g.ax, -g.ay); x.restore();
    } else {
      g = ART.get('w_staff', 0);
      ang = a * 0.25 + (Math.cos(a) < 0 ? -0.25 : 0.25) + (p.swingT > 0 ? Math.sin(p.swingT * 30) * 0.15 : 0);
      const sx = p.x + (Math.cos(a) < 0 ? -9 : 9);
      x.save(); x.translate(Math.round(sx), Math.round(p.y - 8)); x.rotate(ang); x.drawImage(g.c, -g.ax, -g.ay); x.restore();
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.6 + (p.swingT > 0 ? 0.4 : 0);
      x.drawImage(PX.glow(7, [200, 120, 255], 4), Math.round(sx + Math.sin(ang) * 24 - 8), Math.round(p.y - 8 - Math.cos(ang) * 24 - 8));
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    }
  }
  function drawEnemy(e, w) {
    if (e.under && !e.boss) { const g = ART.get('mound', Math.floor(w.t * 6) % 2); spr(g, e.x, e.y + 2, false); return; }
    const d = e.def, name = d.spr;
    const n = ART.D[name].n;
    let f;
    if (e.frame !== undefined && e.frame !== null) f = e.frame;
    else f = Math.floor(e.t * (e.boss ? 4 : 7)) % n;
    const g = ART.get(name, f);
    let px = e.x, py = e.y;
    if (e.fly) py -= Math.sin(e.t * 4 + e.x) * 2;
    if (e.air) py -= e.air;
    if (e.boss && e.trans > 0) px += (Math.random() - 0.5) * 4;
    if (e.boss && e.under && !e.air) { // 땅속(전갈)
      x.fillStyle = 'rgba(200,160,100,0.6)'; x.beginPath(); x.ellipse(e.x, e.y, 30, 10, 0, 0, U.TAU); x.fill();
      const mg = ART.get('mound', Math.floor(w.t * 8) % 2); sprImg(mg.c, mg, e.x, e.y + 4, false, 2); return;
    }
    if (e.air > 400) return;
    const flip = (d.side ? e.flip : (!e.boss && e.flip));
    const sc = e.elite ? 1.2 : 1;
    const alpha = e.alpha ?? 1;
    if (e.elite) {
      const gs = ART.flash(name, f, [255, 210, 80]);
      x.globalAlpha = (0.55 + 0.25 * Math.sin(G.time * 6)) * alpha;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sprImg(gs, g, px + ox, py + oy, flip, sc);
      x.globalAlpha = 1;
    }
    if (alpha < 1) x.globalAlpha = alpha;
    if (sc !== 1) sprImg(g.c, g, px, py, flip, sc); else spr(g, px, py, flip);
    x.globalAlpha = 1;
    const fl = e.flashT > 0 || (e.preT > 0 && Math.floor(G.time * 16) % 2 === 0) || (e.fuse && Math.floor(G.time * 14) % 2 === 0) || (e.boss && e.trans > 0 && Math.floor(G.time * 12) % 2 === 0);
    if (fl) {
      const col = e.fuse || (e.boss && e.trans > 0) ? [255, 70, 60] : e.preT > 0 ? [255, 230, 140] : [255, 255, 255];
      x.globalAlpha = e.flashT > 0 ? 0.9 : 0.6;
      sprImg(ART.flash(name, f, col), g, px, py, flip, sc);
      x.globalAlpha = 1;
    } else if (e.slowT > 0) { x.globalAlpha = 0.35; sprImg(ART.flash(name, f, [120, 200, 255]), g, px, py, flip, sc); x.globalAlpha = 1; }
    else if (e.inv && e.boss) { x.globalAlpha = 0.3; sprImg(ART.flash(name, f, [160, 160, 200]), g, px, py, flip, sc); x.globalAlpha = 1; }
    // 체력 줄
    if (!e.boss && e.hp < e.maxHp) {
      const bw = Math.max(16, e.r * 2), bx = Math.round(e.x - bw / 2), by = Math.round(py - g.ay * sc - 6);
      x.fillStyle = '#140a1c'; x.fillRect(bx - 1, by - 1, bw + 2, 4);
      x.fillStyle = e.elite ? '#ffc84a' : '#ff4a5a'; x.fillRect(bx, by, Math.round(bw * Math.max(0, e.hp / e.maxHp)), 2);
    }
  }
  function drawLob(l) {
    const k = l.t / l.dur;
    const px = U.lerp(l.x0, l.tx, k), py = U.lerp(l.y0 + 40, l.ty, k) - Math.sin(k * Math.PI) * l.h - (1 - k) * 40;
    let g;
    if (l.big) g = ART.get('p_boulder', 0);
    else if (l.kind === 'fire') g = ART.orb('#ff7a2a', 7);
    else if (l.kind === 'void') g = ART.orb('#b05aff', 7);
    else if (l.kind === 'spore') g = ART.orb('#9ae04a', 7);
    else g = ART.orb('#e8f4ff', 7);
    x.drawImage(g.c, Math.round(px - g.ax), Math.round(py - g.ay));
  }
  function drawPB(b) {
    if (b.kind === 'arrow') { const g = ART.get('p_arrow', 0); x.save(); x.translate(Math.round(b.x), Math.round(b.y)); x.rotate(b.ang); x.drawImage(g.c, -g.ax, -g.ay); x.restore(); }
    else if (b.kind === 'wave') { const g = ART.get('p_wave', 0); const k = Math.min(1, b.life / 0.15); x.globalAlpha = k; x.save(); x.translate(Math.round(b.x), Math.round(b.y)); x.rotate(b.ang); const s = b.r / 13; x.scale(s, s); x.drawImage(g.c, -g.ax, -g.ay); x.restore(); x.globalAlpha = 1; }
    else { const g = ART.orb(b.kind === 'mirror' ? '#bff0ff' : '#b47aff', Math.round(b.r)); x.drawImage(g.c, Math.round(b.x - g.ax), Math.round(b.y - g.ay)); }
  }
  function drawEB(b) {
    const B = DATA.BUL[b.kind] || DATA.BUL.red;
    if (b.delay > 0) { x.globalAlpha = 0.3; }
    if (B.orb) { const g = ART.orb(B.orb, b.r); x.drawImage(g.c, Math.round(b.x - g.ax), Math.round(b.y - g.ay)); }
    else {
      const g = ART.get(B.spr, Math.floor(b.t * 10));
      x.save(); x.translate(Math.round(b.x), Math.round(b.y)); x.rotate(B.spr === 'p_rock' || B.spr === 'p_boulder' ? b.t * 6 : b.ang); x.drawImage(g.c, -g.ax, -g.ay); x.restore();
    }
    x.globalAlpha = 1;
  }
  function drawBeam(b) {
    const ex = b.x + Math.cos(b.ang) * b.cur, ey = b.y + Math.sin(b.ang) * b.cur;
    if (b.t < b.warm) {
      const k = b.t / b.warm;
      x.strokeStyle = U.rgba(b.c, 0.3 + 0.5 * k * (0.5 + 0.5 * Math.sin(b.t * 40))); x.lineWidth = 1 + k * 2;
      x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(ex, ey); x.stroke();
    } else {
      const k = (b.t - b.warm) / b.dur, wd = b.w * (k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1) * (0.9 + Math.random() * 0.2);
      x.save(); x.translate(b.x, b.y); x.rotate(b.ang);
      x.fillStyle = U.rgba(b.c, 0.85); x.fillRect(0, -wd / 2, b.cur, wd);
      x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(0, -wd / 4, b.cur, wd / 2);
      x.restore();
    }
  }
  function drawBeamGlow(b) {
    if (b.t < b.warm) return;
    x.save(); x.translate(b.x, b.y); x.rotate(b.ang);
    x.fillStyle = U.rgba(b.c, 0.3); x.fillRect(0, -b.w, b.cur, b.w * 2);
    x.restore();
    x.drawImage(PX.glow(18, b.c, 4), b.x - 19, b.y - 19);
  }
  function drawFlame(fx, fy, t) {
    for (let i = 0; i < 3; i++) {
      const h = 6 + Math.sin(t * 12 + i * 2) * 2 + i * 2, xx = fx + (i - 1) * 4;
      x.fillStyle = i === 1 ? '#fff0a0' : '#ff9a3a';
      x.fillRect(Math.round(xx - 1), Math.round(fy - h), 3, Math.round(h));
    }
    x.drawImage(PX.glow(10, [255, 160, 60], 4), fx - 11, fy - 16);
  }

  /* ───────── HUD ───────── */
  function txt(s, px, py, size = 22, col = '#fff', align = 'left', bold = false) {
    x.font = `${bold ? 'bold ' : ''}${size}px Galmuri11, monospace`;
    x.textAlign = align; x.textBaseline = 'top';
    x.lineWidth = size / 5; x.strokeStyle = 'rgba(10,4,18,0.95)'; x.lineJoin = 'round';
    x.strokeText(s, px, py); x.fillStyle = col; x.fillText(s, px, py);
  }
  function bar(bx, by, bw, bh, k, c1, c2, back = '#1a0e24') {
    x.fillStyle = '#05020a'; x.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    x.fillStyle = back; x.fillRect(bx, by, bw, bh);
    const fw = Math.round(bw * U.clamp(k, 0, 1));
    x.fillStyle = c1; x.fillRect(bx, by, fw, bh);
    x.fillStyle = c2; x.fillRect(bx, by, fw, Math.max(1, Math.round(bh / 3)));
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(bx, by + bh - 2, fw, 2);
  }
  function drawHUD() {
    const w = ENT.w, p = w.player, run = G.run, L = w.L;
    // 체력
    x.fillStyle = 'rgba(8,4,16,0.55)'; x.fillRect(10, 10, 268, 62);
    bar(18, 18, 252, 16, p.hp / p.st.maxHp, '#e8384a', '#ff8a8a');
    FX.text(x, `${Math.ceil(p.hp)}`, 24, 21, 'w', 2, 'left');
    for (let i = 0; i < p.shield; i++) { x.fillStyle = '#05020a'; x.fillRect(18 + i * 16, 39, 13, 11); x.fillStyle = '#8ad8ff'; x.fillRect(19 + i * 16, 40, 11, 9); x.fillStyle = '#d8f4ff'; x.fillRect(19 + i * 16, 40, 11, 3); }
    // 골드
    const cg = ART.get('coin', 0); x.drawImage(cg.c, 18, 54);
    FX.text(x, run.gold, 32, 55, 'c', 2, 'left');
    if (p.revives > 0) { x.fillStyle = '#ffb040'; FX.text(x, 'x' + p.revives, 260, 55, 'c', 2, 'right'); x.drawImage(ART.get('heart', 0).c, 214, 52); }
    // 층
    FX.text(x, `${L.floor}`, VW - 60, 14, 'w', 4, 'right');
    txt('층', VW - 54, 16, 22, '#fff');
    txt(DATA.TIERS[L.tier].name, VW - 16, 44, 16, '#d8c8ff', 'right');
    if (L.kind === 'mob') {
      const left = w.enemies.length + (w.queue ? w.queue.length : 0);
      txt(w.cleared ? '출구가 열렸다 ▲' : w.wave < 0 ? '적이 몰려온다…' : `웨이브 ${w.wave + 1}/${w.waves.length} · 남은 적 ${left}`, VW - 16, 64, 16, w.cleared ? '#ffe08a' : '#fff', 'right');
    }
    // 스킬·구르기
    const sk = DATA.CLASSES[p.cls].skill;
    const kS = U.clamp(p.skillT / (sk.cd * p.st.skillCd), 0, 1), kD = U.clamp(p.dashCdT / p.st.dashCd, 0, 1);
    if (INPUT.touch) { touchCd('tSkill', kS); touchCd('tDash', kD); }
    else {
      cool(18, VH - 62, 'skill', kS, sk.name, '우클릭·K');
      cool(84, VH - 62, 'dash', kD, '구르기', 'Space');
    }
    // 보스 체력
    if (w.boss && !w.boss.dead) {
      const b = w.boss, bw = 460, bx = (VW - bw) / 2;
      txt(b.def.name, VW / 2, 16, 22, '#ffe0e0', 'center', true);
      bar(bx, 44, bw, 14, b.hp / b.maxHp, b.inv ? '#8a7a9a' : '#d8304a', '#ff8a8a');
      for (const th of b.thresholds) { x.fillStyle = '#05020a'; x.fillRect(Math.round(bx + bw * th) - 1, 42, 2, 18); }
    }
    // 화면 밖 표시
    const cx = G.cam.x, cy = G.cam.y;
    for (const e of w.enemies) {
      if (e.dead || e.spawnT > 0 || e.gone || e.boss) continue;
      const sx = e.x - cx, sy = e.y - 16 - cy;
      if (sx > 0 && sx < VW && sy > 0 && sy < VH) continue;
      const ex = U.clamp(sx, 10, VW - 10), ey = U.clamp(sy, 80, VH - 10);
      const a = Math.atan2(sy - ey, sx - ex);
      x.save(); x.translate(ex, ey); x.rotate(a); x.fillStyle = e.elite ? '#ffc84a' : '#ff5a6a';
      x.beginPath(); x.moveTo(6, 0); x.lineTo(-4, -5); x.lineTo(-4, 5); x.fill(); x.restore();
    }
    if (G.portal) {
      const sx = G.portal.x - cx, sy = G.portal.y - 30 - cy;
      if (sx < 0 || sx > VW || sy < 0 || sy > VH) {
        const ex = U.clamp(sx, 24, VW - 24), ey = U.clamp(sy, 90, VH - 24), a = Math.atan2(sy - ey, sx - ex), b = Math.sin(G.time * 6) * 3;
        x.save(); x.translate(ex, ey); x.rotate(a); x.fillStyle = '#ffe08a'; x.beginPath(); x.moveTo(12 + b, 0); x.lineTo(-6 + b, -9); x.lineTo(-6 + b, 9); x.fill(); x.restore();
      }
    }
    // 알림 띠
    if (G.banner) {
      const bn = G.banner, k = bn.t < 0.4 ? bn.t / 0.4 : bn.t > bn.dur - 0.5 ? (bn.dur - bn.t) / 0.5 : 1;
      x.globalAlpha = Math.max(0, k);
      const y0 = bn.boss ? 150 : 170;
      x.fillStyle = 'rgba(6,2,14,0.6)'; x.fillRect(0, y0 - 14, VW, bn.story ? 128 : 96);
      x.fillStyle = bn.boss ? '#d8304a' : '#ffd86a'; x.fillRect(0, y0 - 14, VW, 2); x.fillRect(0, y0 + (bn.story ? 112 : 80), VW, 2);
      txt(bn.small, VW / 2, y0, 22, bn.boss ? '#ff9aa8' : '#d8c8ff', 'center');
      txt(bn.big, VW / 2, y0 + 26, 33, '#fff', 'center', true);
      if (bn.story) txt(bn.story, VW / 2, y0 + 76, 16, '#e8e0f4', 'center');
      x.globalAlpha = 1;
    }
    if (G.toastT > 0) {
      x.globalAlpha = Math.min(1, G.toastT * 2);
      x.font = '22px Galmuri11, monospace'; const tw = x.measureText(G.toastMsg).width;
      x.fillStyle = 'rgba(8,4,16,0.75)'; x.fillRect(VW / 2 - tw / 2 - 16, VH - 108, tw + 32, 36);
      txt(G.toastMsg, VW / 2, VH - 100, 22, '#ffe8b0', 'center');
      x.globalAlpha = 1;
    }
    if (G.showFps) txt(G.fps + 'fps ' + w.eb.length, VW / 2, VH - 24, 16, '#8f8', 'center');
  }
  const cdLast = {};
  function touchCd(id, k) {
    const v = Math.ceil(k * 20) / 20;
    if (cdLast[id] === v) return;
    cdLast[id] = v;
    const el = document.getElementById(id);
    if (el) { el.style.setProperty('--cd', v); el.classList.toggle('ready', v <= 0); }
  }
  const icoCache = {};
  function cool(bx, by, kind, k, label, key) {
    x.fillStyle = '#05020a'; x.fillRect(bx - 2, by - 2, 52, 52);
    x.fillStyle = '#2a1c40'; x.fillRect(bx, by, 48, 48);
    const ic = icoCache[kind + G.run.cls] || (icoCache[kind + G.run.cls] = ICONS.get(kind === 'skill' ? 'skill_' + G.run.cls : 'dash', 2));
    x.drawImage(ic, bx + 24 - ic.width / 2, by + 24 - ic.height / 2);
    if (k > 0) { x.fillStyle = 'rgba(6,2,12,0.7)'; x.fillRect(bx, by, 48, Math.round(48 * U.clamp(k, 0, 1))); }
    else { x.strokeStyle = '#ffe08a'; x.lineWidth = 2; x.strokeRect(bx + 1, by + 1, 46, 46); }
    if (key) txt(key, bx + 24, by + 50, 11, '#c8b8e8', 'center');
    void label;
  }

  return { init, draw, get ctx() { return x; } };
})();
