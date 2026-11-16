'use strict';
/* 한 층의 지형을 만든다.
   grid: 0 바닥, 1 벽, 2 구덩이, 3 위험 지형, 4 장애물.  입구(아래 가운데)와 출구(위 가운데)는 항상 비우고,
   입구에서 걸어 닿지 않는 바닥은 장애물로 메운다. */

const LEVEL = (() => {
  const tierOf = (floor) => Math.floor((floor - 1) / 10);
  const kindOf = (floor) => { const k = (floor - 1) % 10 + 1; return k === 10 ? 'boss' : k === 5 ? 'mid' : 'mob'; };

  function gen(floor, seed) {
    const tier = tierOf(floor), kind = kindOf(floor);
    const R = U.rng(seed);
    const boss = kind !== 'mob';
    const W = boss ? 33 : R.int(34, 42), H = boss ? 20 : R.int(21, 26);
    const g = new Uint8Array(W * H), obst = new Uint8Array(W * H);
    const idx = (x, y) => y * W + x;
    const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inside(x, y)) g[idx(x, y)] = 1;
    // 위쪽 벽은 두 칸 두께(벽 윗면이 화면 위로 덜 잘리게)
    for (let x = 0; x < W; x++) g[idx(x, 1)] = 1;
    const spawn = { x: Math.floor(W / 2), y: H - 3 }, exit = { x: Math.floor(W / 2), y: 3 };
    const nObst = TILES.OBST[TILES.THEMES[tier].id].length;
    const put = (x, y, v, k) => { if (!inside(x, y) || y < 2) return; g[idx(x, y)] = v; if (v === 4) obst[idx(x, y)] = k ?? R.int(0, nObst - 1); };
    const blob = (cx, cy, r, v, rough = 0.35) => {
      for (let y = cy - r - 1; y <= cy + r + 1; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.15) / r + (U.hash2(x, y, seed) - 0.5) * rough;
        if (d < 1) put(x, y, v);
      }
    };

    if (!boss) {
      const feats = {
        0: ['scatter', 'scatter', 'hazard', 'pits', 'chunks', 'pillars'],
        1: ['pillars', 'pillars', 'hazard', 'chunks', 'scatter', 'cross'],
        2: ['hazard', 'hazard', 'scatter', 'pits', 'pillars', 'chunks'],
        3: ['river', 'river', 'hazard', 'chunks', 'scatter', 'pillars'],
        4: ['pits', 'pits', 'hazard', 'pillars', 'scatter', 'cross']
      }[tier];
      const chosen = new Set([R.pick(feats), R.pick(feats)]);
      if (R.chance(0.5)) chosen.add('scatter');
      for (const f of chosen) {
        if (f === 'scatter') {
          const n = Math.round(W * H / R.int(55, 80));
          for (let i = 0; i < n; i++) put(R.int(2, W - 3), R.int(3, H - 3), 4);
        } else if (f === 'pillars') {
          const sx = R.int(5, 7), sy = R.int(4, 6), ox = R.int(3, 5), oy = R.int(4, 5);
          for (let y = oy; y < H - 3; y += sy) for (let x = ox; x < W - 3; x += sx) { put(x, y, 4, (x + y) % nObst); if (R.chance(0.25)) put(x + 1, y, 4, (x + y) % nObst); }
        } else if (f === 'hazard') {
          const n = R.int(2, 4) + (tier === 2 ? 2 : 0);
          for (let i = 0; i < n; i++) blob(R.int(4, W - 5), R.int(5, H - 5), R.int(2, tier === 2 ? 4 : 3), 3);
        } else if (f === 'pits') {
          const n = R.int(2, 4) + (tier === 4 ? 2 : 0);
          for (let i = 0; i < n; i++) blob(R.int(5, W - 6), R.int(5, H - 6), R.int(1, 3), 2, 0.5);
        } else if (f === 'chunks') {
          const n = R.int(3, 6);
          for (let i = 0; i < n; i++) {
            const w = R.int(2, 4), h = R.int(1, 3), x0 = R.int(3, W - 3 - w), y0 = R.int(4, H - 4 - h);
            for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, 1);
          }
        } else if (f === 'cross') {
          const cx = Math.floor(W / 2), cy = Math.floor(H / 2), r = R.int(3, 5);
          for (let a = 0; a < 4; a++) {
            const dx = [1, -1, 1, -1][a], dy = [1, 1, -1, -1][a];
            for (let i = 1; i <= r; i++) { put(cx + dx * (i + 1), cy + dy * 2, 1); put(cx + dx * 2, cy + dy * (i + 1), 1); }
          }
          if (R.chance(0.6)) blob(cx, cy, 1, tier === 4 ? 2 : 3);
        } else if (f === 'river') {
          const horiz = R.chance(0.6);
          if (horiz) {
            let y = R.int(7, H - 9);
            for (let x = 1; x < W - 1; x++) { put(x, y, 3); put(x, y + 1, 3); if (R.chance(0.25)) y = U.clamp(y + R.int(-1, 1), 5, H - 8); }
            for (let b = 0; b < 3; b++) { const bx = R.int(3, W - 4); for (let yy = 4; yy < H - 4; yy++) if (g[idx(bx, yy)] === 3) { put(bx, yy, 0); put(bx + 1, yy, 0); } }
          } else {
            let x = R.int(8, W - 9);
            for (let y = 2; y < H - 1; y++) { put(x, y, 3); put(x + 1, y, 3); if (R.chance(0.25)) x = U.clamp(x + R.int(-1, 1), 6, W - 7); }
            for (let b = 0; b < 3; b++) { const by = R.int(4, H - 5); for (let xx = 2; xx < W - 2; xx++) if (g[idx(xx, by)] === 3) { put(xx, by, 0); put(xx, by + 1, 0); } }
          }
        }
      }
    } else {
      // 보스 방: 넓게 비우고 대칭으로 조금만
      const style = R.int(0, 2);
      if (style === 0) for (const [x, y] of [[6, 6], [W - 7, 6], [6, H - 6], [W - 7, H - 6]]) put(x, y, 4, 0);
      else if (style === 1) for (const [x, y] of [[4, 5], [W - 5, 5], [4, H - 4], [W - 5, H - 4]]) blob(x, y, 1, tier === 3 || tier === 4 ? 3 : (tier === 2 ? 3 : 4));
      else for (const [x, y] of [[9, 9], [W - 10, 9]]) put(x, y, 4, 1);
    }

    // 입구·출구 둘레 비우기
    const clear = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inside(x, y) && y >= 2) { g[idx(x, y)] = 0; obst[idx(x, y)] = 0; } };
    clear(spawn.x, spawn.y, 2); clear(exit.x, exit.y, 2);

    // 연결 검사: 입구에서 걸어서(바닥·위험 지형) 닿는 곳
    const flood = () => {
      const seen = new Uint8Array(W * H), q = [idx(spawn.x, spawn.y)];
      seen[q[0]] = 1;
      while (q.length) {
        const i = q.pop(), x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = idx(x + dx, y + dy);
          if (!seen[j] && (g[j] === 0 || g[j] === 3)) { seen[j] = 1; q.push(j); }
        }
      }
      return seen;
    };
    let seen = flood();
    if (!seen[idx(exit.x, exit.y)]) {
      for (let y = exit.y; y <= spawn.y; y++) for (const x of [spawn.x - 1, spawn.x, spawn.x + 1]) { g[idx(x, y)] = 0; obst[idx(x, y)] = 0; }
      seen = flood();
    }
    let open = 0;
    for (let i = 0; i < W * H; i++) {
      if (!seen[i] && (g[i] === 0 || g[i] === 3)) { g[i] = 4; obst[i] = R.int(0, nObst - 1); }
      if (seen[i]) open++;
    }
    return { floor, tier, kind, w: W, h: H, grid: g, obst, spawn, exit, seed, open };
  }

  return { gen, tierOf, kindOf };
})();
