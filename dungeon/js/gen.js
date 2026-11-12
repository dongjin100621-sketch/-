'use strict';
/* 층 만들기: 방과 복도, 문, 물·용암 웅덩이, 장식, 아이템, 상자, 함정, 몬스터, 상점, 보스 방. */

const T = { WALL: 0, FLOOR: 1, DOOR: 2, DOOR_OPEN: 3, STAIRS: 4, WATER: 5, LAVA: 6 };
const WALKABLE = new Set([T.FLOOR, T.DOOR, T.DOOR_OPEN, T.STAIRS, T.WATER]);
const OPAQUE = new Set([T.WALL, T.DOOR]);

let uidSeq = 1;
const newUid = () => uidSeq++;

/* ── 아이템 ── */
function makeItem(id, rng, depth = 1, plus = null) {
  const def = ITEMS[id];
  const it = { id, n: 1 };
  if (def.kind === 'weapon' || def.kind === 'armor') {
    if (plus === null) {
      const r = rng.next();
      plus = r < 0.04 + depth * 0.01 ? 2 : r < 0.18 + depth * 0.025 ? 1 : 0;
    }
    it.plus = plus;
  }
  return it;
}

function maxTier(depth) { return Math.min(5, Math.floor((depth + 1) / 2)); }

function randomItemId(depth, rng, kinds = null) {
  const kind = kinds ? rng.pick(kinds) : rng.weighted([['potion', 44], ['scroll', 24], ['weapon', 12], ['armor', 12], ['acc', 6 + depth * 0.4]]);
  const mt = maxTier(depth);
  const table = [];
  for (const [id, d] of Object.entries(ITEMS)) {
    if (d.kind !== kind) continue;
    if (d.minDepth && depth < d.minDepth) continue;
    if (kind === 'potion' || kind === 'scroll') { table.push([id, d.w]); continue; }
    if (d.tier > mt || d.tier < mt - 2 || (d.tier === 0 && depth > 2)) continue;
    table.push([id, d.tier === mt ? 1 : d.tier === mt - 1 ? 2 : 1.4]);
  }
  if (!table.length) return 'potion_heal';
  return rng.weighted(table);
}

function randomItem(depth, rng, kinds) { return makeItem(randomItemId(depth, rng, kinds), rng, depth); }

/* ── 몬스터 ── */
function spawnMonster(id, x, y, depth, rng, opts = {}) {
  const d = MONSTERS[id];
  const elite = !!opts.elite;
  const hp = Math.round(d.hp * (elite ? 1.7 : 1));
  return {
    uid: newUid(), id, x, y, hp, mhp: hp,
    atk: Math.round(d.atk * (elite ? 1.3 : 1)), def: d.def + (elite ? 1 : 0),
    spd: d.spd || 100, energy: rng.int(0, 99),
    state: opts.state || 'sleep', elite, boss: !!d.boss,
    disguised: !!d.disguise, lastX: x, lastY: y, lost: 0, cd: 0, poison: 0, poisonDmg: 0, sleep: 0,
    wx: x, wy: y, phase2: false
  };
}

/* ── 층 ── */
function generateFloor(depth, rng) {
  for (let k = 0; k < 40; k++) {
    const f = tryFloor(depth, rng);
    if (f) return f;
  }
  throw new Error('층을 만들지 못했습니다');
}

function tryFloor(depth, rng) {
  const cfg = FLOORS[depth];
  const theme = THEMES[cfg.theme];
  const boss = cfg.boss || null;
  const w = 42 + depth * 2, h = 30 + depth;
  const tiles = new Uint8Array(w * h);
  const at = (x, y) => tiles[y * w + x];
  const set = (x, y, t) => { tiles[y * w + x] = t; };
  const rooms = [];
  let arena = null;

  if (boss) {
    const aw = depth === LAST_FLOOR ? 17 : 15, ah = depth === LAST_FLOOR ? 13 : 11;
    arena = { x: w - aw - 3, y: Math.floor((h - ah) / 2), w: aw, h: ah, arena: true };
    rooms.push(arena);
  }
  const target = boss ? 6 : 8 + Math.floor(depth / 3);
  for (let tries = 0; tries < 400 && rooms.length < target + (boss ? 1 : 0); tries++) {
    const rw = rng.int(5, 10), rh = rng.int(4, 7);
    const rx = rng.int(2, (boss ? arena.x - 4 : w) - rw - 2), ry = rng.int(3, h - rh - 2);
    if (rx < 2) continue;
    if (rooms.some(r => rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y)) continue;
    rooms.push({ x: rx, y: ry, w: rw, h: rh });
  }
  if (rooms.length < (boss ? 5 : 7)) return null;
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, T.FLOOR);

  const center = (r) => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
  const normal = rooms.filter(r => !r.arena);

  // 최소 신장 트리 + 고리 몇 개로 방을 잇는다
  const edges = [];
  const inTree = [normal[0]];
  const rest = normal.slice(1);
  const dist2 = (a, b) => { const [ax, ay] = center(a), [bx, by] = center(b); return (ax - bx) ** 2 + (ay - by) ** 2; };
  while (rest.length) {
    let best = null;
    for (const a of inTree) for (const b of rest) { const d = dist2(a, b); if (!best || d < best[2]) best = [a, b, d]; }
    edges.push([best[0], best[1]]);
    inTree.push(best[1]);
    rest.splice(rest.indexOf(best[1]), 1);
  }
  for (let k = 0; k < 2 + Math.floor(depth / 4); k++) {
    const a = rng.pick(normal), b = rng.pick(normal);
    if (a !== b) edges.push([a, b]);
  }
  if (arena) {
    let near = null;
    for (const r of normal) if (!near || dist2(r, arena) < dist2(near, arena)) near = r;
    edges.push([near, arena]);
  }
  const carve = (x, y) => { if (at(x, y) === T.WALL) set(x, y, T.FLOOR); };
  for (const [a, b] of edges) {
    let [x1, y1] = center(a);
    let [x2, y2] = center(b);
    if (b.arena) { y2 = b.y + Math.floor(b.h / 2); x2 = b.x; }
    const hFirst = b.arena ? false : rng.chance(0.5);
    if (hFirst) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y1);
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x2, y);
    } else {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x1, y);
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y2);
    }
  }

  // 보스 방 기둥
  if (arena) {
    const px = [arena.x + 3, arena.x + arena.w - 4], py = [arena.y + 2, arena.y + arena.h - 3];
    for (const x of px) for (const y of py) set(x, y, T.WALL);
  }

  // 문: 방 둘레에서 복도가 들어오는 좁은 자리
  const doors = [];
  for (const r of rooms) {
    const ring = [];
    for (let x = r.x; x < r.x + r.w; x++) { ring.push([x, r.y - 1, 'h']); ring.push([x, r.y + r.h, 'h']); }
    for (let y = r.y; y < r.y + r.h; y++) { ring.push([r.x - 1, y, 'v']); ring.push([r.x + r.w, y, 'v']); }
    for (const [x, y, o] of ring) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || at(x, y) !== T.FLOOR) continue;
      const ok = o === 'h' ? at(x - 1, y) === T.WALL && at(x + 1, y) === T.WALL : at(x, y - 1) === T.WALL && at(x, y + 1) === T.WALL;
      if (!ok || doors.some(([dx, dy]) => Math.abs(dx - x) + Math.abs(dy - y) <= 1)) continue;
      if (r.arena || rng.chance(0.45)) { set(x, y, T.DOOR); doors.push([x, y]); }
    }
  }

  // 출발 방: 보스 층이면 보스 방에서 가장 먼 방
  const passable = (x, y) => WALKABLE.has(at(x, y)) || at(x, y) === T.DOOR;
  let startRoom;
  if (arena) {
    const [ax, ay] = center(arena);
    const dm = distanceMap(w, h, [[ax, ay]], passable);
    startRoom = normal.reduce((a, b) => dm[center(b)[1] * w + center(b)[0]] > dm[center(a)[1] * w + center(a)[0]] ? b : a);
  } else startRoom = rng.pick(normal);
  const [sx, sy] = center(startRoom);
  const dStart = distanceMap(w, h, [[sx, sy]], passable);
  if (rooms.some(r => dStart[center(r)[1] * w + center(r)[0]] < 0)) return null;

  // 계단: 출발점에서 가장 먼 방
  let stairs = null, stairsRoom = null;
  if (!boss) {
    stairsRoom = normal.filter(r => r !== startRoom).reduce((a, b) => dStart[center(b)[1] * w + center(b)[0]] > dStart[center(a)[1] * w + center(a)[0]] ? b : a);
    const sxx = stairsRoom.x + rng.int(1, stairsRoom.w - 2), syy = stairsRoom.y + rng.int(1, stairsRoom.h - 2);
    set(sxx, syy, T.STAIRS);
    stairs = { x: sxx, y: syy };
  }

  // 물·용암 웅덩이
  if (theme.liquid) {
    const lt = theme.liquid === 'lava' ? T.LAVA : T.WATER;
    const cands = rng.shuffle(normal.filter(r => r !== startRoom && r.w >= 7 && r.h >= 5));
    const n = Math.min(cands.length, rng.int(1, 3));
    for (let k = 0; k < n; k++) {
      const r = cands[k];
      const cx = r.x + r.w / 2 - 0.5, cy = r.y + r.h / 2 - 0.5, rx = (r.w - 2) / 2, ry = (r.h - 2) / 2;
      const changed = [];
      for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if (at(x, y) !== T.FLOOR) continue;
        const v = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + rng.range(-0.25, 0.25);
        if (v < (lt === T.LAVA ? 0.7 : 0.55)) { changed.push([x, y]); set(x, y, lt); }
      }
      if (lt === T.LAVA) {
        const dm = distanceMap(w, h, [[sx, sy]], passable);
        const broken = rooms.some(rr => {
          for (let y = rr.y; y < rr.y + rr.h; y++) for (let x = rr.x; x < rr.x + rr.w; x++) if (at(x, y) === T.FLOOR && dm[y * w + x] < 0) return true;
          return false;
        }) || (stairs && dm[stairs.y * w + stairs.x] < 0);
        if (broken) for (const [x, y] of changed) set(x, y, T.FLOOR);
      }
    }
  }
  if (arena && depth === LAST_FLOOR) {
    // 옥좌 둘레의 용암 도랑
    for (const [x, y] of [[arena.x + 1, arena.y + 1], [arena.x + arena.w - 2, arena.y + 1], [arena.x + 1, arena.y + arena.h - 2], [arena.x + arena.w - 2, arena.y + arena.h - 2]]) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const xx = x + (x > arena.x + 2 ? -dx : dx), yy = y + (y > arena.y + 2 ? -dy : dy);
        if (at(xx, yy) === T.FLOOR) set(xx, yy, T.LAVA);
      }
    }
  }

  const f = {
    depth, theme: cfg.theme, w, h, tiles, seen: new Uint8Array(w * h),
    rooms, arena, start: { x: sx, y: sy }, stairs, boss, bossDead: false, bossAwake: false,
    deco: {}, torches: [], items: [], objects: [], traps: [], monsters: [], shop: null, spawnTimer: 0
  };
  const used = new Set([sy * w + sx]);
  if (stairs) used.add(stairs.y * w + stairs.x);
  // 방 입구 바로 안쪽 칸 (상자·상인이 길을 막지 않게)
  const nearEntrance = (r, x, y) => DIRS4.some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return !inRoom(r, nx, ny) && at(nx, ny) !== T.WALL;
  });
  const freeCell = (room, avoidStart = true, solid = false) => {
    for (let k = 0; k < 80; k++) {
      const r = room || rng.pick(normal);
      const x = r.x + rng.int(0, r.w - 1), y = r.y + rng.int(0, r.h - 1);
      if (at(x, y) !== T.FLOOR || used.has(y * w + x)) continue;
      if (solid && nearEntrance(r, x, y)) continue;
      if (avoidStart && Math.abs(x - sx) + Math.abs(y - sy) < 6) continue;
      used.add(y * w + x);
      return [x, y];
    }
    return null;
  };

  // 장식
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (at(x, y) === T.FLOOR && rng.chance(0.07)) f.deco[y * w + x] = rng.weighted(theme.deco);
  }
  // 횃불: 방 윗벽(아래가 바닥인 벽)
  for (const r of rooms) {
    const k = r.arena ? 4 : rng.int(0, 2);
    for (let i = 0; i < k; i++) {
      const x = r.arena ? r.x + Math.round((i + 0.5) * r.w / 4) : r.x + rng.int(0, r.w - 1);
      const y = r.y - 1;
      if (at(x, y) === T.WALL && at(x, y + 1) === T.FLOOR && !f.torches.includes(y * w + x)) f.torches.push(y * w + x);
    }
  }

  // 상점
  if (cfg.shop) {
    const shopRoom = rng.shuffle(normal.filter(r => r !== startRoom && r !== stairsRoom && r.w >= 5))[0];
    if (shopRoom) {
      let mx = shopRoom.x + Math.floor(shopRoom.w / 2);
      const my = shopRoom.y;
      for (let k = 1; k < shopRoom.w - 1 && nearEntrance(shopRoom, mx, my); k++) mx = shopRoom.x + k;
      if (at(mx, my) === T.FLOOR && !nearEntrance(shopRoom, mx, my)) {
        f.objects.push({ type: 'merchant', x: mx, y: my });
        used.add(my * w + mx);
        for (const [dx, dy] of DIRS8) used.add((my + dy) * w + mx + dx);
        f.shop = makeShopStock(depth, rng);
      }
    }
  }

  // 아이템·금화
  const nItems = 3 + rng.int(0, 2) + (depth >= 5 ? 1 : 0);
  for (let k = 0; k < nItems; k++) { const c = freeCell(null, false); if (c) f.items.push({ x: c[0], y: c[1], item: randomItem(depth, rng) }); }
  const nGold = rng.int(2, 4);
  for (let k = 0; k < nGold; k++) { const c = freeCell(null, false); if (c) f.items.push({ x: c[0], y: c[1], item: { id: 'gold', n: Math.round(rng.int(5, 12) * (1 + depth * 0.5)) } }); }

  // 상자 (깊은 층에선 미믹일 수도)
  const nChest = boss ? 1 : rng.int(1, 2);
  for (let k = 0; k < nChest; k++) {
    const c = freeCell(null, true, true);
    if (!c) continue;
    if (cfg.mimic && rng.chance(cfg.mimic)) f.monsters.push(spawnMonster('mimic', c[0], c[1], depth, rng, { state: 'sleep' }));
    else f.objects.push({ type: 'chest', x: c[0], y: c[1], open: false, gold: rng.chance(0.3) });
  }

  // 함정
  if (depth >= 2) {
    const nTrap = depth + rng.int(0, 2);
    for (let k = 0; k < nTrap; k++) {
      let c = null;
      for (let t = 0; t < 30 && !c; t++) {
        const x = rng.int(1, w - 2), y = rng.int(1, h - 2);
        if (at(x, y) === T.FLOOR && !used.has(y * w + x) && Math.abs(x - sx) + Math.abs(y - sy) > 5 && !(arena && inRoom(arena, x, y))) c = [x, y];
      }
      if (!c) continue;
      used.add(c[1] * w + c[0]);
      const kind = rng.weighted([['spike', 5], ['poison', depth >= 3 ? 3 : 0], ['teleport', 2], ['alarm', 2]]);
      f.traps.push({ x: c[0], y: c[1], kind, hidden: true });
    }
  }

  // 몬스터
  const avoid = normal.filter(r => r !== startRoom);
  for (let k = 0; k < cfg.count; k++) {
    const c = freeCell(rng.pick(avoid), true);
    if (!c) continue;
    const id = rng.weighted(cfg.mon);
    const elite = depth >= 2 && !boss && rng.chance(0.06 + depth * 0.012);
    f.monsters.push(spawnMonster(id, c[0], c[1], depth, rng, { elite, state: rng.chance(0.6) ? 'sleep' : 'wander' }));
  }
  if (boss) {
    const [bx, by] = center(arena);
    const b = spawnMonster(boss, bx + 2, by, depth, rng, { state: 'sleep' });
    b.energy = 0;
    f.monsters.push(b);
  }
  return f;
}

function inRoom(r, x, y) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; }

function makeShopStock(depth, rng) {
  const stock = [
    { item: makeItem('potion_heal', rng), price: ITEMS.potion_heal.price, n: 3 },
    { item: makeItem('potion_mana', rng), price: ITEMS.potion_mana.price, n: 3 },
    { item: makeItem('scroll_teleport', rng), price: ITEMS.scroll_teleport.price, n: 2 },
    { item: makeItem(rng.pick(['scroll_map', 'scroll_fire', 'scroll_sleep', 'potion_power']), rng), n: 2 },
    { item: makeItem('scroll_enchant', rng), price: ITEMS.scroll_enchant.price, n: 1 }
  ];
  const mt = maxTier(depth);
  const pool = Object.entries(ITEMS).filter(([, d]) => ['weapon', 'armor', 'acc'].includes(d.kind) && d.tier >= mt - 1 && d.tier <= Math.min(5, mt + 1));
  rng.shuffle(pool);
  const kinds = new Set();
  for (const [id, d] of pool) {
    if (kinds.has(d.kind)) continue;
    kinds.add(d.kind);
    stock.push({ item: makeItem(id, rng, depth, 0), n: 1 });
    if (kinds.size >= 3) break;
  }
  if (depth >= 6) stock.push({ item: makeItem('potion_life', rng), n: 1 });
  for (const s of stock) s.price = s.price || ITEMS[s.item.id].price;
  return stock;
}
