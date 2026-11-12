'use strict';
/* 공통 도구: 난수, 시야(그림자 투사), 거리 지도, 직선. DOM 을 쓰지 않아 node 에서도 돈다. */

/* 시드가 있는 난수 (mulberry32). 상태를 저장해 이어하기 뒤에도 같은 흐름을 잇는다. */
function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),   // a 이상 b 이하
    range: (a, b) => a + next() * (b - a),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(table) {                                       // [[값, 무게], ...]
      let total = 0;
      for (const [, w] of table) total += w;
      let r = next() * total;
      for (const [v, w] of table) { if ((r -= w) < 0) return v; }
      return table[table.length - 1][0];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    get state() { return s; },
    set state(v) { s = v >>> 0; }
  };
}

const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

/* 재귀 그림자 투사 시야. blocks(x,y) 가 참이면 빛을 막는다(막는 칸 자체는 보인다). */
function computeFov(ox, oy, radius, w, h, blocks, mark) {
  mark(ox, oy);
  const r2 = radius * radius + radius;
  const mult = [
    [1, 0, 0, -1, -1, 0, 0, 1],
    [0, 1, -1, 0, 0, -1, 1, 0],
    [0, 1, 1, 0, 0, -1, -1, 0],
    [1, 0, 0, 1, -1, 0, 0, -1]
  ];
  function cast(row, start, end, xx, xy, yx, yy) {
    if (start < end) return;
    let newStart = 0;
    for (let j = row; j <= radius; j++) {
      let dx = -j - 1;
      const dy = -j;
      let blocked = false;
      while (dx <= 0) {
        dx++;
        const X = ox + dx * xx + dy * xy;
        const Y = oy + dx * yx + dy * yy;
        const lSlope = (dx - 0.5) / (dy + 0.5);
        const rSlope = (dx + 0.5) / (dy - 0.5);
        if (start < rSlope) continue;
        if (end > lSlope) break;
        const inside = X >= 0 && Y >= 0 && X < w && Y < h;
        if (inside && dx * dx + dy * dy <= r2) mark(X, Y);
        const opaque = !inside || blocks(X, Y);
        if (blocked) {
          if (opaque) { newStart = rSlope; continue; }
          blocked = false;
          start = newStart;
        } else if (opaque && j < radius) {
          blocked = true;
          cast(j + 1, start, lSlope, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
      if (blocked) break;
    }
  }
  for (let o = 0; o < 8; o++) cast(1, 1.0, 0.0, mult[0][o], mult[1][o], mult[2][o], mult[3][o]);
}

/* 너비 우선 거리 지도. passable(x,y) 인 칸만 지난다. 닿지 못한 칸은 -1. */
function distanceMap(w, h, sources, passable, maxDist = 9999) {
  const dist = new Int16Array(w * h).fill(-1);
  const q = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (const [x, y] of sources) {
    const i = y * w + x;
    if (dist[i] === -1) { dist[i] = 0; q[tail++] = i; }
  }
  while (head < tail) {
    const i = q[head++];
    const d = dist[i];
    if (d >= maxDist) continue;
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (dist[ni] !== -1 || !passable(nx, ny)) continue;
      dist[ni] = d + 1;
      q[tail++] = ni;
    }
  }
  return dist;
}

/* 출발점에서 목표까지 4방향 최단 경로(출발점 제외). 없으면 null. */
function findPath(w, h, sx, sy, tx, ty, passable) {
  const dist = distanceMap(w, h, [[tx, ty]], (x, y) => (x === sx && y === sy) || passable(x, y));
  if (dist[sy * w + sx] < 0) return null;
  const path = [];
  let x = sx, y = sy;
  while (!(x === tx && y === ty)) {
    let best = null, bd = dist[y * w + x];
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const d = dist[ny * w + nx];
      if (d >= 0 && d < bd) { bd = d; best = [nx, ny]; }
    }
    if (!best) return null;
    [x, y] = best;
    path.push(best);
  }
  return path;
}

/* 브레젠험 직선 (양 끝 포함) */
function lineCells(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

const manhattan = (a, b, c, d) => Math.abs(a - c) + Math.abs(b - d);
const chebyshev = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;


/* 받침에 맞는 조사: josa('슬라임', '을를') → '슬라임을' */
function josa(word, pair) {
  const last = String(word).trim().slice(-1);
  const c = last.charCodeAt(0);
  let has = false, rieul = false;
  if (c >= 0xAC00 && c <= 0xD7A3) { const j = (c - 0xAC00) % 28; has = j !== 0; rieul = j === 8; }
  else if (/[0-9]/.test(last)) { has = '013678'.includes(last); rieul = '178'.includes(last); }
  if (pair === '으로') return word + (has && !rieul ? '으로' : '로');
  return word + (has ? pair[0] : pair[1]);
}
