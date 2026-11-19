'use strict';
/* ────────────────────────────────────────────────────────────
   배경: 네온사인이 빛나는 고층 빌딩 도트 배경을 절반 해상도로 그린 뒤 2배로 키워 그린다.
   층: 하늘(고정) → 먼 스카이라인(0.12) → 중간 빌딩(0.35) → 가까운 빌딩(0.62) → 거리(1.0)
   ──────────────────────────────────────────────────────────── */
const THEMES = {
  roof:    { sky: ['#07051a', '#1d0b3f', '#5a1a66', '#b0306e'], far: '#160c30', mid: '#110a26', near: '#0c071b', win: ['#ff5fd2', '#3ee8ff', '#ffd36a', '#9b7cff'], neon: ['#ff3fa4', '#3ee8ff', '#b06bff', '#ffd36a'], gr: ['#1a1230', '#0e0a1c'], rain: 0.25, moon: 1, fog: '#ff4fb0' },
  home:    { sky: ['#04030f', '#0c0a2a', '#1b1050', '#3a1563'], far: '#120d2a', mid: '#0e0a22', near: '#0a0718', win: ['#3ee8ff', '#ff5fd2', '#ffd36a'], neon: ['#3ee8ff', '#ff3fa4', '#7c6bff'], gr: ['#14112a', '#09071a'], rain: 1, fog: '#3ee8ff' },
  street:  { sky: ['#05030f', '#140a33', '#36125a', '#7a1f6e'], far: '#170d33', mid: '#120a28', near: '#0b0719', win: ['#ff5fd2', '#3ee8ff', '#ffd36a', '#ff8a3d'], neon: ['#ff3fa4', '#3ee8ff', '#ffd23e', '#b06bff', '#ff7a3d'], gr: ['#1a1030', '#0b0718'], rain: 0.8, fog: '#ff3fa4', holo: 1 },
  market:  { sky: ['#0a0410', '#220a26', '#4f1430', '#9a2a32'], far: '#1c0c1f', mid: '#160a19', near: '#100712', win: ['#ffb02e', '#ff5f5f', '#ffd36a'], neon: ['#ff4f4f', '#ffb02e', '#ff3fa4', '#ffd23e'], gr: ['#1e1018', '#0f070c'], rain: 0.5, fog: '#ff7a3d', lantern: 1 },
  under:   { sky: ['#030806', '#06140f', '#0c2a1e', '#16402a'], far: '#0a1712', mid: '#08120e', near: '#060d0a', win: ['#7dff6a', '#3ee8ff', '#d6ff3e'], neon: ['#7dff6a', '#3ee8ff', '#ff3fa4', '#d6ff3e'], gr: ['#101a15', '#070d0a'], rain: 1.2, fog: '#4dff9a', overpass: 1 },
  factory: { sky: ['#0a0303', '#1f0707', '#45100e', '#7a2014'], far: '#1b0a09', mid: '#150807', near: '#0e0505', win: ['#ff4f2e', '#ffb02e', '#ff7a3d'], neon: ['#ff3b3b', '#ffb02e', '#ff7a3d'], gr: ['#1c0f0d', '#0d0605'], rain: 0.4, fog: '#ff4f2e', smoke: 1 },
  bridge:  { sky: ['#030614', '#0a1a44', '#1d3f86', '#5a7fd0'], far: '#0e1c40', mid: '#0b1634', near: '#081028', win: ['#bfe6ff', '#3ee8ff', '#ffffff'], neon: ['#3ee8ff', '#bfe6ff', '#7c6bff', '#ff3fa4'], gr: ['#1a2a4c', '#0a1430'], rain: 0, fog: '#9fd8ff', clouds: 1, holo: 1 },
  tower:   { sky: ['#0a0718', '#1a1238', '#2e2160', '#4a3690'], far: '#1a1436', mid: '#151030', near: '#100c24', win: ['#d9c8ff', '#ffffff', '#a07cff'], neon: ['#a07cff', '#ffffff', '#3ee8ff', '#ffd36a'], gr: ['#2a2248', '#14102a'], rain: 0, fog: '#a07cff', indoor: 1 },
  sanctum: { sky: ['#020108', '#0b0520', '#1d0d44', '#3a1a6e'], far: '#120a2a', mid: '#0e0822', near: '#0a061a', win: ['#ffd36a', '#a07cff', '#ffffff'], neon: ['#ffd36a', '#a07cff', '#ffffff'], gr: ['#1a1036', '#0c0720'], rain: 0, fog: '#ffd36a', clock: 1 },
};
const SIGN_WORDS = {
  roof: ['♥', 'NEON', '별', '호텔', '24H'], home: ['24시', '편의점', '세탁', '수리', 'BAR', '모텔', '라멘'],
  street: ['라멘', 'BAR', '노래방', '호텔', '전당포', 'NEON', '24시', '사이버', '酒', '클럽', '♥'],
  market: ['야시장', '꼬치', '떡볶이', '酒', '만두', '라멘', '복권', '타로', '수리'],
  under: ['위험', 'NO ENTRY', '쏘우팽', 'SAW', '폐차장', '수리'], factory: ['위험', '고압', '출입금지', '제3공장', 'SAW'],
  bridge: ['HELIOS', '에덴', 'ETERNAL', '영생', '스카이'], tower: ['HELIOS', '에덴', 'E.D.E.N', '영원'], sanctum: ['EDEN', '∞'],
};
const BG = {
  cur: null,
  build(map) {
    const th = THEMES[map.theme];
    const R = rng(hashStr(map.id));
    const W = map.w;
    const out = { th, map, layers: [], signs: [], t: 0 };
    // 하늘
    {
      const [c, x] = makeCanvas(VW / 2, VH / 2);
      const g = x.createLinearGradient(0, 0, 0, VH / 2);
      th.sky.forEach((col, i) => g.addColorStop(i / (th.sky.length - 1), col));
      x.fillStyle = g; x.fillRect(0, 0, VW / 2, VH / 2);
      // 하늘을 가로지르는 띠 (도트 디더링)
      for (let yy = 0; yy < VH / 2; yy += 2) for (let xx = (yy / 2) % 2; xx < VW / 2; xx += 2) {
        if (R() < 0.02) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(xx, yy, 1, 1); }
      }
      if (map.theme === 'roof' || map.theme === 'bridge') {
        for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${0.15 + R() * 0.4})`; x.fillRect(Math.floor(R() * VW / 2), Math.floor(R() * 160), 1, 1); }
      }
      if (th.moon) {
        x.fillStyle = 'rgba(255,200,240,0.12)'; x.beginPath(); x.arc(470, 70, 46, 0, 7); x.fill();
        x.fillStyle = '#ffe3f4'; x.beginPath(); x.arc(470, 70, 30, 0, 7); x.fill();
        x.fillStyle = '#f2b8dc'; [[460, 62, 5], [478, 80, 4], [470, 55, 2]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
      }
      if (th.clock) {
        x.strokeStyle = 'rgba(255,211,106,0.25)'; x.lineWidth = 1;
        for (let r = 40; r < 200; r += 26) { x.beginPath(); x.arc(320, 150, r, 0, 7); x.stroke(); }
        for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r1 = i % 5 ? 180 : 168; x.beginPath(); x.moveTo(320 + Math.cos(a) * r1, 150 + Math.sin(a) * r1); x.lineTo(320 + Math.cos(a) * 192, 150 + Math.sin(a) * 192); x.stroke(); }
      }
      if (th.clouds) {
        for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(160,190,255,${0.05 + R() * 0.08})`; const cx = R() * VW / 2, cy = 250 + R() * 120; for (let k = 0; k < 6; k++) x.fillRect(Math.floor(cx + k * 9 - 20), Math.floor(cy + (R() - 0.5) * 8), Math.floor(30 + R() * 30), 6); }
      }
      out.sky = c;
    }
    const layer = (p, fn) => {
      const lw = Math.ceil((VW + (W - VW) * p) / 2) + 4;
      const [c, x] = makeCanvas(lw, VH / 2);
      fn(x, lw);
      out.layers.push({ c, p });
    };
    const building = (x, bx, by, bw, bh, col, winCols, density, R2, alpha = 0.6) => {
      x.fillStyle = col; x.fillRect(bx, by, bw, bh + 400);
      // 옥상 장식
      if (R2() < 0.5) { x.fillRect(bx + Math.floor(bw * 0.3), by - 6, Math.floor(bw * 0.2), 6); }
      if (R2() < 0.4) { x.fillRect(bx + Math.floor(bw * 0.6), by - 18, 1, 18); x.fillStyle = '#ff3b5c'; x.fillRect(bx + Math.floor(bw * 0.6) - 1, by - 19, 3, 2); }
      // 창문 격자
      const cw = 2 + Math.floor(R2() * 2), gap = cw + 2 + Math.floor(R2() * 2), rowH = 6 + Math.floor(R2() * 3);
      const bcol = winCols[Math.floor(R2() * winCols.length)];
      // 창문 틀(어두운 격자) — 불 꺼진 창도 형태가 보이게
      x.fillStyle = 'rgba(255,255,255,0.025)';
      for (let yy = by + 6; yy < 400; yy += rowH) x.fillRect(bx + 2, yy, bw - 4, 2);
      for (let yy = by + 6; yy < 400; yy += rowH) {
        const rowLit = R2() < 0.12; // 가끔 한 층 전체가 켜져 있다
        for (let xx = bx + 3; xx < bx + bw - 3; xx += gap) {
          if (rowLit ? R2() < 0.8 : R2() < density) { x.fillStyle = hexA(R2() < 0.75 ? bcol : winCols[Math.floor(R2() * winCols.length)], alpha * (0.4 + R2() * 0.6)); x.fillRect(xx, yy, cw, 2); }
        }
      }
      // 가장자리 하이라이트
      x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(bx, by, 1, 400);
    };
    // 먼 스카이라인
    layer(0.12, (x, lw) => {
      const R2 = rng(hashStr(map.id + 'far'));
      if (th.indoor || th.clock) {
        // 실내: 큰 유리창 너머 도시
        for (let bx = 0; bx < lw; bx += 10 + Math.floor(R2() * 30)) { const bh = 60 + R2() * 160; building(x, bx, 330 - bh, 20 + Math.floor(R2() * 30), bh, th.far, th.win, 0.1, R2, 0.35); }
        return;
      }
      for (let bx = -10; bx < lw; bx += 12 + Math.floor(R2() * 26)) { const bh = 70 + R2() * 170; building(x, bx, 330 - bh, 18 + Math.floor(R2() * 34), bh, th.far, th.win, 0.08, R2, 0.35); }
      x.fillStyle = hexA(th.fog, 0.08); x.fillRect(0, 230, lw, 170);
    });
    // 중간 빌딩 (간판 포함)
    layer(0.35, (x, lw) => {
      const R2 = rng(hashStr(map.id + 'mid'));
      for (let bx = -20; bx < lw; bx += 30 + Math.floor(R2() * 50)) {
        const bw = 40 + Math.floor(R2() * 50), bh = 140 + R2() * 170;
        building(x, bx, 340 - bh, bw, bh, th.mid, th.win, 0.1, R2, 0.5);
        if (R2() < 0.55) {
          const col = choice2(th.neon, R2), word = choice2(SIGN_WORDS[map.theme], R2);
          vSign(x, bx + Math.floor(bw / 2) - 6, 340 - bh + 20 + Math.floor(R2() * 40), word, col, 0.75);
        }
        if (th.holo && R2() < 0.18) holoBoard(x, bx + 4, 340 - bh + 30, bw - 8, 40, choice2(th.neon, R2), R2);
      }
      x.fillStyle = hexA(th.fog, 0.1); x.fillRect(0, 260, lw, 140);
      if (th.overpass) { // 고가도로 상판
        x.fillStyle = '#050a08'; x.fillRect(0, 40, lw, 34);
        x.fillStyle = '#0e1a14'; x.fillRect(0, 70, lw, 4);
        for (let px = 20; px < lw; px += 120) { x.fillStyle = '#060c09'; x.fillRect(px, 74, 26, 330); x.fillStyle = 'rgba(125,255,106,0.05)'; x.fillRect(px + 2, 74, 2, 330); }
      }
    });
    // 가까운 빌딩 (큰 간판, 비상계단)
    layer(0.62, (x, lw) => {
      const R2 = rng(hashStr(map.id + 'near'));
      if (th.indoor) {
        // 거대한 창틀과 기둥
        for (let px = 0; px < lw; px += 140) {
          x.fillStyle = th.near; x.fillRect(px, 0, 22, 400);
          x.fillStyle = 'rgba(160,124,255,0.25)'; x.fillRect(px + 21, 0, 1, 400);
          x.fillStyle = th.near; x.fillRect(px, 40, 140, 6); x.fillRect(px, 300, 140, 100);
          x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(px + 30, 50, 4, 240); x.fillRect(px + 40, 50, 1, 240);
          if (R2() < 0.6) hSign(x, px + 50, 312, choice2(SIGN_WORDS.tower, R2), choice2(th.neon, R2), 1);
        }
        return;
      }
      if (th.clock) {
        for (let i = 0; i < lw; i += 90) { x.fillStyle = 'rgba(255,211,106,0.08)'; x.fillRect(i + 40, 0, 2, 400); x.fillStyle = 'rgba(160,124,255,0.1)'; x.fillRect(i, 320 - (i % 7) * 10, 50, 2); }
        return;
      }
      if (th.clouds) {
        // 다리의 거대한 케이블 기둥
        for (let px = 60; px < lw; px += 320) {
          x.fillStyle = th.near; x.fillRect(px, 0, 24, 400);
          x.fillStyle = 'rgba(62,232,255,0.4)'; x.fillRect(px + 23, 0, 1, 400);
          x.strokeStyle = 'rgba(191,230,255,0.25)'; x.lineWidth = 1;
          for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(px + 12, 10 + k * 14); x.lineTo(px + 12 - 150 + k * 10, 330); x.moveTo(px + 12, 10 + k * 14); x.lineTo(px + 12 + 150 - k * 10, 330); x.stroke(); }
          if (R2() < 0.8) holoBoard(x, px + 40, 60 + Math.floor(R2() * 60), 90, 50, choice2(th.neon, R2), R2);
        }
        return;
      }
      for (let bx = -30; bx < lw; bx += 70 + Math.floor(R2() * 90)) {
        const bw = 60 + Math.floor(R2() * 70), bh = 200 + R2() * 160;
        building(x, bx, 330 - bh, bw, bh, th.near, th.win, 0.06, R2, 0.55);
        // 비상계단
        if (R2() < 0.5) { x.fillStyle = '#05030a'; for (let yy = 330 - bh + 30; yy < 300; yy += 26) { x.fillRect(bx + 4, yy, bw - 8, 2); for (let xx = bx + 4; xx < bx + bw - 4; xx += 4) x.fillRect(xx, yy - 6, 1, 6); } }
        if (R2() < 0.7) { const col = choice2(th.neon, R2), w2 = choice2(SIGN_WORDS[map.theme], R2); R2() < 0.5 ? vSign(x, bx + bw - 16, 330 - bh + 40, w2, col, 1) : hSign(x, bx + 6, 330 - bh + 50 + Math.floor(R2() * 60), w2, col, 1); }
        if (th.smoke && R2() < 0.5) { x.fillStyle = '#120706'; x.fillRect(bx + 10, 330 - bh - 60, 12, 60); }
      }
      x.fillStyle = hexA(th.fog, 0.07); x.fillRect(0, 280, lw, 120);
    });
    // 거리(땅) — 지역 전체 크기
    {
      const lw = Math.ceil(W / 2) + 4;
      const [c, x] = makeCanvas(lw, VH / 2);
      const R2 = rng(hashStr(map.id + 'ground'));
      const gy = GROUND / 2;
      street(x, lw, gy, th, map, R2);
      out.ground = c;
    }
    out.rain = [];
    if (th.rain) for (let i = 0; i < 120 * th.rain; i++) out.rain.push({ x: Math.random() * VW, y: Math.random() * VH, s: rand(900, 1300), l: rand(10, 22) });
    out.motes = [];
    for (let i = 0; i < 40; i++) out.motes.push({ x: Math.random() * VW, y: Math.random() * VH, v: rand(10, 40), c: choice(th.neon) });
    BG.cur = out;
    return out;
  },
  draw(ctx, camX, t, dt) {
    const B = BG.cur; if (!B) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(B.sky, 0, 0, VW, VH);
    for (const L of B.layers) {
      const ox = -Math.round(camX * L.p / 2) * 2;
      ctx.drawImage(L.c, ox, 0, L.c.width * 2, VH);
    }
    // 네온 깜빡임: 화면 전체에 은은한 맥동
    const pulse = 0.04 + Math.sin(t * 2.1) * 0.015 + (Math.random() < 0.02 ? 0.03 : 0);
    ctx.fillStyle = hexA(B.th.fog, pulse); ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(B.ground, -Math.round(camX / 2) * 2, 0, B.ground.width * 2, VH);
  },
  drawFront(ctx, camX, t, dt) {
    const B = BG.cur; if (!B) return;
    // 떠다니는 빛 입자
    for (const m of B.motes) {
      m.y -= m.v * dt; if (m.y < 0) { m.y = VH; m.x = Math.random() * VW; }
      ctx.fillStyle = hexA(m.c, 0.5 + Math.sin(t * 3 + m.x) * 0.3);
      ctx.fillRect(Math.round(((m.x - camX * 0.3) % VW + VW) % VW / 2) * 2, Math.round(m.y / 2) * 2, 2, 2);
    }
    // 비
    if (B.rain.length) {
      ctx.strokeStyle = 'rgba(170,200,255,0.28)'; ctx.lineWidth = 2; ctx.beginPath();
      for (const r of B.rain) {
        r.y += r.s * dt; r.x -= r.s * 0.12 * dt;
        if (r.y > VH) { r.y = -20; r.x = Math.random() * (VW + 100); }
        ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.l * 0.12, r.y - r.l);
      }
      ctx.stroke();
      // 물웅덩이 튀김
      ctx.fillStyle = 'rgba(190,220,255,0.35)';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(Math.random() * VW / 2) * 2, GROUND + 4 + Math.floor(Math.random() * 40), 4, 2);
    }
    if (B.th.clock) { // 성소의 데이터 비
      ctx.fillStyle = 'rgba(255,211,106,0.35)';
      for (let i = 0; i < 30; i++) { const xx = (i * 97 + Math.floor(t * 60) * 7) % VW; const yy = (t * 300 + i * 53) % VH; ctx.fillRect(Math.floor(xx / 2) * 2, Math.floor(yy / 2) * 2, 2, 8); }
    }
  },
};
function choice2(arr, R) { return arr[Math.floor(R() * arr.length)]; }
function glowText(x, txt, tx, ty, col, a) {
  x.save();
  x.font = '11px Galmuri11, sans-serif'; x.textBaseline = 'top';
  x.shadowColor = col; x.shadowBlur = 6; x.globalAlpha = a;
  x.fillStyle = col; x.fillText(txt, tx, ty);
  x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.globalAlpha = a * 0.55; x.fillText(txt, tx, ty);
  x.restore();
}
function vSign(x, sx, sy, word, col, a) {
  const chars = [...word]; const h = chars.length * 12 + 6;
  x.fillStyle = 'rgba(5,3,12,0.85)'; x.fillRect(sx - 2, sy - 2, 16, h);
  x.strokeStyle = hexA(col, 0.9 * a); x.lineWidth = 1; x.strokeRect(sx - 1.5, sy - 1.5, 15, h - 1);
  chars.forEach((ch, i) => glowText(x, ch, sx + 1, sy + 2 + i * 12, col, a));
}
function hSign(x, sx, sy, word, col, a) {
  x.save(); x.font = '11px Galmuri11, sans-serif'; const w = Math.ceil(x.measureText(word).width) + 8; x.restore();
  x.fillStyle = 'rgba(5,3,12,0.85)'; x.fillRect(sx - 2, sy - 2, w, 17);
  x.strokeStyle = hexA(col, 0.9 * a); x.lineWidth = 1; x.strokeRect(sx - 1.5, sy - 1.5, w - 1, 16);
  glowText(x, word, sx + 2, sy + 1, col, a);
  return w;
}
function holoBoard(x, bx, by, bw, bh, col, R) {
  x.fillStyle = hexA(col, 0.12); x.fillRect(bx, by, bw, bh);
  x.strokeStyle = hexA(col, 0.6); x.lineWidth = 1; x.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  for (let yy = by + 2; yy < by + bh; yy += 2) { x.fillStyle = hexA(col, 0.06); x.fillRect(bx, yy, bw, 1); }
  // 광고 속 실루엣(얼굴)
  x.fillStyle = hexA(col, 0.45); const cx = bx + Math.floor(bw * (0.25 + R() * 0.5));
  x.beginPath(); x.arc(cx, by + bh * 0.45, bh * 0.22, 0, 7); x.fill(); x.fillRect(cx - bh * 0.3, by + bh * 0.7, bh * 0.6, bh * 0.3);
}
function street(x, lw, gy, th, map, R) {
  // 보도
  const g = x.createLinearGradient(0, gy, 0, 400);
  g.addColorStop(0, th.gr[0]); g.addColorStop(1, th.gr[1]);
  x.fillStyle = g; x.fillRect(0, gy, lw, 400 - gy);
  x.fillStyle = hexA(th.neon[0], 0.55); x.fillRect(0, gy, lw, 1);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, gy + 1, lw, 2);
  // 보도블록 줄눈과 물웅덩이 반사
  for (let xx = 0; xx < lw; xx += 24) { x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(xx, gy + 3, 1, 14); }
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, gy + 17, lw, 1);
  for (let i = 0; i < lw / 60; i++) {
    const px = Math.floor(R() * lw), pw = 20 + Math.floor(R() * 50), py = gy + 22 + Math.floor(R() * 25), col = choice2(th.neon, R);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py, pw, 4);
    x.fillStyle = hexA(col, 0.25); x.fillRect(px + 3, py + 1, Math.floor(pw * 0.6), 1);
  }
  const T = map.theme;
  // 지역별 소품
  const props = [];
  const lamp = (px) => { x.fillStyle = '#07050d'; x.fillRect(px, gy - 120, 3, 120); x.fillRect(px - 10, gy - 122, 16, 3); const col = choice2(th.neon, R); x.fillStyle = col; x.fillRect(px - 10, gy - 119, 12, 1); x.fillStyle = hexA(col, 0.08); x.beginPath(); x.moveTo(px - 10, gy - 118); x.lineTo(px - 40, gy); x.lineTo(px + 20, gy); x.closePath(); x.fill(); };
  const vending = (px) => { const col = choice2(th.neon, R); x.fillStyle = '#0a0814'; x.fillRect(px, gy - 52, 30, 52); x.fillStyle = hexA(col, 0.7); x.fillRect(px + 3, gy - 48, 24, 26); x.fillStyle = 'rgba(255,255,255,0.4)'; for (let k = 0; k < 3; k++) x.fillRect(px + 5 + k * 8, gy - 44, 5, 8); x.fillStyle = '#222'; x.fillRect(px + 8, gy - 14, 14, 5); };
  const barrel = (px, fire) => { x.fillStyle = '#1c1410'; x.fillRect(px, gy - 22, 16, 22); x.fillStyle = '#2c2018'; x.fillRect(px, gy - 16, 16, 2); x.fillRect(px, gy - 7, 16, 2); if (fire) { x.fillStyle = '#ffb02e'; x.fillRect(px + 3, gy - 28, 10, 6); x.fillStyle = '#ff4f2e'; x.fillRect(px + 5, gy - 33, 6, 6); x.fillStyle = 'rgba(255,140,40,0.1)'; x.fillRect(px - 20, gy - 60, 56, 60); } };
  const crate = (px, h) => { x.fillStyle = '#16121e'; x.fillRect(px, gy - h, 40, h); x.strokeStyle = 'rgba(255,255,255,0.08)'; x.strokeRect(px + 0.5, gy - h + 0.5, 39, h - 1); x.beginPath(); x.moveTo(px, gy - h); x.lineTo(px + 40, gy); x.stroke(); };
  const shop = (px, word, col, w = 110) => {
    x.fillStyle = '#0a0714'; x.fillRect(px - w / 2, gy - 120, w, 120);
    x.fillStyle = hexA(col, 0.12); x.fillRect(px - w / 2 + 6, gy - 80, w - 12, 80);
    x.fillStyle = hexA(col, 0.5); x.fillRect(px - w / 2 + 6, gy - 82, w - 12, 2);
    // 차양
    for (let k = 0; k < w; k += 10) { x.fillStyle = k % 20 ? hexA(col, 0.55) : 'rgba(20,10,30,0.9)'; x.fillRect(px - w / 2 + k, gy - 96, 10, 10); }
    x.save(); x.font = '11px Galmuri11, sans-serif'; const tw = Math.ceil(x.measureText(word).width); x.restore();
    hSign(x, Math.floor(px - tw / 2 - 4), gy - 116, word, col, 1);
  };
  const stall = (px) => { const col = choice2(th.neon, R); x.fillStyle = '#140a10'; x.fillRect(px, gy - 34, 60, 34); for (let k = 0; k < 60; k += 6) { x.fillStyle = (k / 6) % 2 ? hexA(col, 0.7) : '#2a0e18'; x.fillRect(px + k, gy - 58, 6, 8); } x.fillStyle = '#0b0609'; x.fillRect(px + 2, gy - 50, 2, 16); x.fillRect(px + 56, gy - 50, 2, 16); x.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 4; k++) x.fillRect(px + 10 + k * 12, gy - 40 - (k % 2) * 3, 6, 2); };
  const lanterns = (x0, x1, yy) => { x.strokeStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.moveTo(x0, yy); x.quadraticCurveTo((x0 + x1) / 2, yy + 20, x1, yy); x.stroke(); for (let k = 0; k <= 8; k++) { const t2 = k / 8, lx = lerp(x0, x1, t2), ly = yy + Math.sin(t2 * Math.PI) * 20; x.fillStyle = k % 2 ? '#ff4f4f' : '#ffb02e'; x.fillRect(lx - 3, ly, 6, 8); x.fillStyle = 'rgba(255,170,60,0.12)'; x.fillRect(lx - 8, ly - 4, 16, 16); } };
  const pipe = (px) => { x.fillStyle = '#0f0907'; x.fillRect(px, 0, 10, gy); x.fillStyle = 'rgba(255,120,60,0.12)'; x.fillRect(px + 8, 0, 2, gy); for (let yy = 30; yy < gy; yy += 60) { x.fillStyle = '#1e120e'; x.fillRect(px - 2, yy, 14, 4); } };
  const chain = (px) => { x.fillStyle = 'rgba(30,20,18,0.9)'; for (let yy = 0; yy < 150 + Math.floor(R() * 80); yy += 5) x.fillRect(px + (yy / 5) % 2, yy, 2, 3); };
  const rail = () => { for (let xx = 0; xx < lw; xx += 3) { x.fillStyle = 'rgba(160,200,255,0.25)'; if (xx % 30 === 0) x.fillRect(xx, gy - 32, 1, 32); } x.fillStyle = 'rgba(191,230,255,0.5)'; x.fillRect(0, gy - 33, lw, 1); x.fillStyle = 'rgba(191,230,255,0.07)'; x.fillRect(0, gy - 32, lw, 32); };
  const desk = (px) => { x.fillStyle = '#e8e2ff'; x.fillRect(px, gy - 30, 70, 4); x.fillStyle = '#3a2e66'; x.fillRect(px + 4, gy - 26, 62, 26); x.fillStyle = 'rgba(160,124,255,0.6)'; x.fillRect(px + 20, gy - 48, 30, 16); };
  const plant = (px) => { x.fillStyle = '#20142c'; x.fillRect(px, gy - 16, 34, 16); x.fillStyle = '#2e6b4a'; for (let k = 0; k < 9; k++) x.fillRect(px + 2 + k * 3.5, gy - 22 - (k % 3) * 5, 3, 8 + (k % 3) * 5); x.fillStyle = '#ff8ad8'; x.fillRect(px + 10, gy - 30, 3, 3); x.fillRect(px + 24, gy - 27, 3, 3); };
  const tank = (px) => { x.fillStyle = '#120c20'; x.fillRect(px, gy - 110, 70, 80); x.fillRect(px + 8, gy - 30, 6, 30); x.fillRect(px + 56, gy - 30, 6, 30); x.fillStyle = 'rgba(255,95,210,0.15)'; x.fillRect(px, gy - 110, 70, 2); };
  const laundry = (x0, x1, yy) => { x.strokeStyle = 'rgba(0,0,0,0.7)'; x.beginPath(); x.moveTo(x0, yy); x.lineTo(x1, yy + 6); x.stroke(); for (let k = x0 + 10; k < x1 - 10; k += 22) { x.fillStyle = choice2(['#3a2d5a', '#5a2d4a', '#2d4a5a'], R); x.fillRect(k, yy + 2, 12, 14 + Math.floor(R() * 8)); } };
  const ac = (px, py) => { x.fillStyle = '#18142a'; x.fillRect(px, py, 26, 18); x.fillStyle = 'rgba(255,255,255,0.08)'; for (let k = 0; k < 4; k++) x.fillRect(px + 3, py + 3 + k * 4, 20, 1); };
  const door = (px, col) => { x.fillStyle = '#05030a'; x.fillRect(px, gy - 60, 34, 60); x.fillStyle = hexA(col, 0.6); x.fillRect(px - 2, gy - 62, 38, 2); x.fillStyle = hexA(col, 0.12); x.fillRect(px - 10, gy - 70, 54, 70); };
  const graffiti = (px) => { const col = choice2(th.neon, R); x.fillStyle = hexA(col, 0.35); for (let k = 0; k < 14; k++) x.fillRect(px + k * 4, gy - 40 + Math.sin(k) * 8, 4, 10 + (k % 3) * 3); };

  if (T === 'roof') {
    x.fillStyle = '#0d0918'; x.fillRect(0, gy - 6, lw, 6);
    for (let xx = 0; xx < lw; xx += 6) { x.fillStyle = 'rgba(255,138,216,0.25)'; x.fillRect(xx, gy - 26, 1, 20); } x.fillStyle = 'rgba(255,138,216,0.5)'; x.fillRect(0, gy - 27, lw, 1);
    tank(80); plant(260); plant(330); plant(640); plant(700); tank(1180 / 2 + 300); plant(820); x.fillStyle = '#07040f'; x.fillRect(150, gy - 230, 3, 230); x.fillRect(140, gy - 230, 24, 3);
    hSign(x, 60, gy - 150, '♥ 별빛 옥상', '#ff8ad8', 1);
  }
  if (T === 'home') {
    for (let px = 0; px < lw; px += 180) { ac(px + 30, gy - 150); ac(px + 120, gy - 110); if ((px / 180) % 3 === 1) laundry(px, px + 110, gy - 175); }
    door(300, '#3ee8ff'); hSign(x, 290, gy - 92, '카이', '#3ee8ff', 1);
    vending(420); vending(455); lamp(560); barrel(700, false); crate(760, 30); lamp(900);
    shop(140, '24시 편의점', '#ffd23e', 120);
  }
  if (T === 'street') {
    shop(310, 'BAR K', '#c9d2e3', 120); shop(710, '토토 총포상', '#d6ff3e', 150); shop(1125, '노바 진료소 ✚', '#e8e0ff', 150);
    lamp(150); lamp(520); lamp(900); lamp(1300); vending(470); vending(500); vending(1250); crate(860, 26); barrel(560, false);
    for (let k = 0; k < 12; k++) { // 사람 실루엣
      const px = Math.floor(R() * lw), h = 40 + Math.floor(R() * 14); x.fillStyle = 'rgba(8,5,16,0.75)'; x.fillRect(px, gy - h, 10, h); x.fillRect(px + 2, gy - h - 7, 6, 7);
      x.fillStyle = hexA(choice2(th.neon, R), 0.4); x.fillRect(px + 1, gy - h + 6, 1, 14);
    }
  }
  if (T === 'market') {
    for (let px = 40; px < lw - 80; px += 110) { if (Math.abs(px - 380) > 70 && Math.abs(px - 750) > 70 && Math.abs(px - 1190) > 70) stall(px); }
    for (let px = 0; px < lw; px += 200) lanterns(px, px + 200, gy - 170);
    shop(380, '블루 문 BAR', '#7c9bff', 140); shop(750, '모모의 넷 카페', '#ff6ab8', 140); shop(1190, '운반 · 보관', '#8fa3ff', 120);
    barrel(1000, true);
  }
  if (T === 'under') {
    x.fillStyle = '#030605'; x.fillRect(0, 0, lw, 30); x.fillStyle = 'rgba(125,255,106,0.2)'; x.fillRect(0, 30, lw, 1);
    for (let px = 60; px < lw; px += 260) { x.fillStyle = '#050a08'; x.fillRect(px, 30, 46, gy - 30); x.fillStyle = 'rgba(125,255,106,0.08)'; x.fillRect(px + 44, 30, 2, gy - 30); graffiti(px + 60); }
    for (let px = 150; px < lw; px += 330) { barrel(px, R() < 0.6); crate(px + 60, 24 + Math.floor(R() * 20)); }
    x.fillStyle = 'rgba(77,255,154,0.06)'; x.fillRect(0, gy - 80, lw, 80);
  }
  if (T === 'factory') {
    for (let px = 30; px < lw; px += 210) pipe(px);
    for (let px = 100; px < lw; px += 170) chain(px);
    for (let px = 120; px < lw; px += 290) { crate(px, 30); crate(px + 42, 46); barrel(px + 100, R() < 0.5); }
    for (let px = 0; px < lw; px += 40) { x.fillStyle = (px / 40) % 2 ? '#ffb02e' : '#1a0c08'; x.fillRect(px, gy - 3, 40, 3); }
  }
  if (T === 'bridge') {
    x.fillStyle = 'rgba(10,20,48,0.9)'; x.fillRect(0, gy, lw, 400 - gy);
    x.fillStyle = 'rgba(62,232,255,0.4)'; x.fillRect(0, gy, lw, 1);
    for (let xx = 0; xx < lw; xx += 40) { x.fillStyle = 'rgba(191,230,255,0.08)'; x.fillRect(xx, gy + 2, 1, 50); }
    rail();
  }
  if (T === 'tower') {
    x.fillStyle = 'rgba(232,226,255,0.08)'; x.fillRect(0, gy, lw, 400 - gy);
    for (let xx = 0; xx < lw; xx += 64) { x.fillStyle = 'rgba(160,124,255,0.25)'; x.fillRect(xx, gy, 1, 400); }
    for (let px = 200; px < lw; px += 420) desk(px);
    for (let px = 80; px < lw; px += 520) plant(px);
  }
  if (T === 'sanctum') {
    x.fillStyle = 'rgba(255,211,106,0.06)'; x.fillRect(0, gy, lw, 400 - gy);
    x.fillStyle = 'rgba(255,211,106,0.6)'; x.fillRect(0, gy, lw, 1);
    for (let xx = 0; xx < lw; xx += 32) { x.fillStyle = 'rgba(255,211,106,0.12)'; x.fillRect(xx, gy + 4, 16, 1); }
    for (let px = 100; px < lw; px += 300) { x.fillStyle = 'rgba(160,124,255,0.15)'; x.fillRect(px, 40, 6, gy - 40); x.fillStyle = 'rgba(255,211,106,0.3)'; x.fillRect(px + 2, 40, 2, gy - 40); }
  }
  // 발판
  for (const [px, py, pw] of map.plat || []) {
    const X = Math.floor(px / 2), Y = Math.floor(py / 2), Wd = Math.floor(pw / 2);
    x.fillStyle = '#0a0714'; x.fillRect(X, Y, Wd, 6);
    x.fillStyle = hexA(th.neon[0], 0.8); x.fillRect(X, Y, Wd, 1);
    x.fillStyle = 'rgba(255,255,255,0.08)'; for (let k = X; k < X + Wd; k += 6) x.fillRect(k, Y + 2, 3, 2);
    x.fillStyle = '#07050d'; x.fillRect(X + 4, Y + 6, 2, gy - Y - 6); x.fillRect(X + Wd - 6, Y + 6, 2, gy - Y - 6);
    x.fillStyle = hexA(th.neon[0], 0.08); x.fillRect(X, Y + 6, Wd, 8);
  }
}
