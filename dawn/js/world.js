'use strict';
/* 세계 지도: 열린 장소를 골라 바로 이동한다. 종이 울린 지역은 아침빛으로 밝아진다. */

const World = (() => {
  const $ = (id) => document.getElementById(id);
  const LV = { village: '1', forest: '3~8', sandport: '9', tomb: '10~16', frostvale: '17', icecave: '18~24', mistcastle: '25', magetower: '26~32', dusktower: '34~40',
    meadow: '1~8 · 잡몹 사냥터', dunes: '9~16 · 잡몹 사냥터', snowfield: '17~24 · 잡몹 사냥터', marsh: '25~32 · 잡몹 사냥터' };
  const ICON = { town: null, forest: 'tree', tomb: 'skull', cave: 'crystal', castle: 'lamp', tower: 'crystal_gold', dusk: 'ember' };
  const CENTERS = { 1: [0.16, 0.50], 2: [0.50, 0.86], 3: [0.56, 0.14], 4: [0.86, 0.40], 5: [0.53, 0.50] };
  let cv, ctx, tex = null, sel = null, time = 0, at = 'village';

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); }
  const unlocked = () => Object.keys(WORLD).filter(id => !WORLD[id].unlock || App.G.unlocked[WORLD[id].unlock]);

  /* 지도 바탕 (낮은 해상도 도트, 한 번 만들어 둠) */
  function buildTex() {
    const W = 220, H = 140;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const r = makeRng(42);
    const blobs = [];
    for (let i = 0; i < 26; i++) blobs.push([r.range(0.1, 0.9), r.range(0.1, 0.9), r.range(0.10, 0.2)]);
    blobs.push([0.16, 0.5, 0.2], [0.5, 0.15, 0.18], [0.86, 0.42, 0.17], [0.55, 0.52, 0.22], [0.42, 0.72, 0.16], [0.65, 0.84, 0.15]);
    const noise = (x, y) => Math.sin(x * 23.1 + y * 7.7) * 0.5 + Math.sin(x * 9.3 - y * 15.2) * 0.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      let v = 0;
      for (const [bx, by, br] of blobs) { const d = Math.hypot((nx - bx) * 1.25, ny - by); v = Math.max(v, 1 - d / br); }
      v += noise(nx, ny) * 0.12;
      // 남쪽 만 (모래항)
      if (Math.hypot((nx - 0.37) * 1.3, ny - 0.93) < 0.09) v = -1;
      const edge = Math.min(nx, ny, 1 - nx, 1 - ny);
      if (edge < 0.05) v -= (0.05 - edge) * 12;
      let col;
      if (v <= 0) {
        const deep = v < -0.25;
        col = deep ? [30, 52, 104] : [44, 78, 140];
        if ((x * 7 + y * 13) % 37 === 0) col = [90, 130, 190];
        if (v > -0.06) col = [70, 120, 176];
      } else {
        let best = 1, bd = 9;
        for (const [k, [cx, cy]] of Object.entries(CENTERS)) { const d = Math.hypot(nx - cx, ny - cy) * (k === '5' ? 1.7 : 1); if (d < bd) { bd = d; best = +k; } }
        const base = { 1: [86, 150, 70], 2: [222, 190, 120], 3: [228, 236, 246], 4: [96, 120, 84], 5: [138, 112, 96] }[best];
        const sh = v < 0.06 ? 0.85 : (noise(nx * 3, ny * 3) > 0.6 ? 0.92 : 1);
        col = base.map(c2 => c2 * sh);
        if (v < 0.04) col = [214, 200, 150];
        // 숲·사구·산
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if (best === 1 && h % 9 === 0) col = [52, 104, 50];
        if (best === 4 && h % 11 === 0) col = [64, 84, 60];
        if (best === 2 && (x + y * 3) % 17 === 0) col = [196, 160, 96];
        if (best === 3 && h % 13 === 0) col = [190, 204, 226];
      }
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 산
    const mtn = (mx, my, s, snow) => {
      g.fillStyle = '#5a5470'; g.beginPath(); g.moveTo(mx - s, my); g.lineTo(mx, my - s * 1.2); g.lineTo(mx + s, my); g.fill();
      g.fillStyle = '#8a85a2'; g.beginPath(); g.moveTo(mx - s * 0.2, my - s * 0.95); g.lineTo(mx, my - s * 1.2); g.lineTo(mx + s * 0.5, my - s * 0.6); g.fill();
      if (snow) { g.fillStyle = '#f5f2fb'; g.beginPath(); g.moveTo(mx - s * 0.3, my - s * 0.85); g.lineTo(mx, my - s * 1.2); g.lineTo(mx + s * 0.3, my - s * 0.85); g.fill(); }
    };
    for (const [mx, my, s, sn] of [[0.30, 0.42, 6, 0], [0.33, 0.36, 5, 1], [0.70, 0.30, 6, 1], [0.74, 0.36, 5, 0], [0.40, 0.30, 4, 1], [0.66, 0.66, 5, 0], [0.70, 0.62, 4, 0], [0.28, 0.20, 5, 1], [0.92, 0.70, 4, 0]]) mtn(mx * W, my * H, s, sn);
    tex = c;
  }

  function render() {
    if (!tex) buildTex();
    const f = Gfx.fit(cv);
    time += 16;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1e3468'; ctx.fillRect(0, 0, f.W, f.H);
    // 지도는 화면에 꽉 차게 (비율 유지)
    const k = Math.min(f.W / tex.width, f.H / tex.height);
    const mw = tex.width * k, mh = tex.height * k, mx = (f.W - mw) / 2, my = (f.H - mh) / 2;
    ctx.drawImage(tex, mx, my, mw, mh);
    // 지역별 빛
    ctx.save();
    for (const [reg, [cx, cy]] of Object.entries(CENTERS)) {
      const dawn = reg !== '5' && App.G.flags['bell' + reg];
      const x = mx + cx * mw, y = my + cy * mh, rr = Math.max(mw, mh) * (reg === '5' ? 0.16 : 0.24);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rr);
      if (reg === '5') { if (!App.G.flags.bell4) continue; gr.addColorStop(0, 'rgba(200,40,40,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
      else if (dawn) { gr.addColorStop(0, 'rgba(255,240,190,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalCompositeOperation = 'lighter'; }
      else { gr.addColorStop(0, 'rgba(120,60,110,.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalCompositeOperation = 'source-over'; }
      ctx.fillStyle = gr; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // 황혼 덮개
    const allDawn = [1, 2, 3, 4].every(n => App.G.flags['bell' + n]);
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const gr = ctx.createLinearGradient(0, 0, 0, f.H);
    gr.addColorStop(0, allDawn ? 'rgb(235,225,240)' : 'rgb(190,160,210)'); gr.addColorStop(1, allDawn ? 'rgb(255,235,215)' : 'rgb(255,190,160)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, f.W, f.H);
    ctx.restore();
    // 길
    const ids = unlocked();
    const P = (id) => [mx + WORLD[id].x * mw, my + WORLD[id].y * mh];
    const u = Math.max(2, Math.round(k * 0.9));
    ctx.fillStyle = 'rgba(255,240,200,.75)';
    for (const [a, b] of ROADS) {
      if (!ids.includes(a) || !ids.includes(b)) continue;
      const [x0, y0] = P(a), [x1, y1] = P(b);
      const n = Math.hypot(x1 - x0, y1 - y0) / (u * 4);
      for (let i = 1; i < n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), u, u);
    }
    // 장소
    const S = Math.max(2, Math.round(k * 0.55));
    for (const id of ids) {
      const [x, y] = P(id);
      const w = WORLD[id];
      const isSel = id === sel;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(x, y + S * 2, S * 7, S * 2, 0, 0, Math.PI * 2); ctx.fill();
      if (isSel) {
        ctx.strokeStyle = `rgba(255,220,100,${0.6 + 0.4 * Math.sin(time / 150)})`; ctx.lineWidth = S;
        ctx.beginPath(); ctx.ellipse(x, y + S, S * 10, S * 4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const ic = w.icon || ICON[w.kind];
      if (ic) ctx.drawImage(Gfx.sprite(ic), Math.round(x - 8 * S), Math.round(y - 14 * S), 16 * S, 16 * S);
      else drawHouse(x, y, S, w.region);
      const bellDone = w.region < 5 && App.G.flags['bell' + w.region] && !['town', 'castle', 'field'].includes(w.kind);
      if (bellDone) ctx.drawImage(Gfx.sprite('bell'), Math.round(x + 2 * S), Math.round(y - 18 * S), 8 * S, 8 * S);
    }
    // 현재 위치
    if (WORLD[at]) {
      const [x, y] = P(at);
      const bob = Math.floor(time / 300) % 2 ? 0 : -S;
      ctx.drawImage(Gfx.sprite('rian_d1'), Math.round(x - 8 * S + 9 * S), Math.round(y - 15 * S + bob), 16 * S, 16 * S);
    }
    // 이름표 (DOM)
    const lab = $('wLabels');
    const r = cv.getBoundingClientRect();
    const key = ids.join(',') + '|' + sel + '|' + Math.round(r.width) + 'x' + Math.round(r.height);
    if (lab.dataset.key !== key) {
      lab.dataset.key = key;
      lab.innerHTML = ids.map(id => {
        const [x, y] = P(id);
        return `<button class="wl${id === sel ? ' sel' : ''}${id === at ? ' here' : ''}" data-id="${id}" style="left:${(x / f.dpr).toFixed(1)}px;top:${(y / f.dpr + 6).toFixed(1)}px">${WORLD[id].name}</button>`;
      }).join('');
      lab.querySelectorAll('.wl').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); pick(b.dataset.id); }));
    }
  }
  function drawHouse(x, y, S, reg) {
    const roof = { 1: '#b5493a', 2: '#d28a3e', 3: '#6a4a8a', 4: '#4a4a72' }[reg] || '#b5493a';
    ctx.fillStyle = '#0e0b16';
    ctx.fillRect(x - 7 * S, y - 9 * S, 14 * S, 10 * S);
    ctx.fillStyle = '#e6d1a3'; ctx.fillRect(x - 6 * S, y - 5 * S, 12 * S, 5 * S);
    ctx.fillStyle = roof; ctx.fillRect(x - 6 * S, y - 9 * S, 12 * S, 4 * S);
    ctx.fillStyle = '#6e4228'; ctx.fillRect(x - S, y - 3 * S, 2 * S, 3 * S);
    ctx.fillStyle = '#ffd447'; ctx.fillRect(x - 4 * S, y - 4 * S, 2 * S, 2 * S); ctx.fillRect(x + 2 * S, y - 4 * S, 2 * S, 2 * S);
  }

  function open(fromId) {
    at = fromId || at;
    sel = at;
    info();
  }
  function pick(id) {
    if (sel === id) { travel(); return; }
    sel = id; Sound.sfx('menu'); info();
  }
  function info() {
    const w = WORLD[sel];
    if (!w) return;
    const box = $('wInfo');
    box.innerHTML = `<div class="wi"><b>${w.name}</b><small>권장 레벨 ${LV[sel]}</small><p>${w.desc}</p></div>
      <div class="wb"><button class="btn gold" id="wGo">${sel === at ? '들어가기' : '이동하기'}</button></div>`;
    $('wGo').addEventListener('click', travel);
    $('wLabels').dataset.key = '';
  }
  function travel() {
    if (!sel) return;
    Sound.sfx('ok');
    at = sel;
    App.enterNode(sel);
  }
  function key(e) {
    const ids = unlocked();
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'A', 'D', 'W', 'S'].includes(k)) {
      const dir = { ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0], ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1] }[k];
      const cur = WORLD[sel];
      let best = null, bd = 9;
      for (const id of ids) {
        if (id === sel) continue;
        const dx = WORLD[id].x - cur.x, dy = WORLD[id].y - cur.y;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 0.01) continue;
        const d = Math.hypot(dx, dy) + Math.abs(dx * dir[1] - dy * dir[0]) * 1.5;
        if (d < bd) { bd = d; best = id; }
      }
      if (best) { sel = best; Sound.sfx('menu'); info(); }
      return true;
    }
    if (['Enter', ' ', 'z', 'Z'].includes(k)) { travel(); return true; }
    return false;
  }
  return { init, render, open, key, get at() { return at; }, set at(v) { at = v; } };
})();
