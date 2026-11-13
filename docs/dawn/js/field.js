'use strict';
/* 필드: 마을·던전을 걷고, 사람과 이야기하고, 상자를 열고, 적과 마주친다.
   맵은 16×16 타일. 정적인 바닥·사물은 미리 그려 두고(물결 2장), 사람과 빛만 매 프레임 그린다. */

const Field = (() => {
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const WALK = new Set(['.', ',', ':', '*', '%', '_', '+']);
  const STEP_MS = 150;
  let cv, ctx, map = null, mapId = null, theme = null, T = null, layers = [null, null];
  let player = { x: 0, y: 0, fx: 0, fy: 0, dir: 'down', moving: false, t: 0, from: null, step: 0 };
  let npcs = [], lights = [], parts = [];
  let held = null, path = [], pendingInteract = null;
  let encSteps = 20, encGrace = 0;
  let view = { S: 4, W: 0, H: 0, cx: 0, cy: 0 };
  let time = 0, waterFrame = 0, bubble = null;

  const G = () => App.G;
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h) ? '#' : map.tiles[y][x];
  const npcAt = (x, y) => npcs.find(n => n.vis && n.x === x && n.y === y);
  const walkable = (x, y) => WALK.has(tileAt(x, y)) && !npcAt(x, y);

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); }

  /* ── 맵 불러오기 ── */
  function load(id, x, y, dir) {
    mapId = id; map = MAPS[id]; theme = map.theme; T = Gfx.tiles(theme);
    player = { x, y, fx: x, fy: y, dir: dir || 'down', moving: false, t: 0, from: null, step: 0 };
    path = []; held = null; pendingInteract = null;
    npcs = map.npcs.map(n => ({ def: n, x: n.x, y: n.y, fx: n.x, fy: n.y, hx: n.x, hy: n.y, dir: 'down', next: 1500 + Math.random() * 2500, moving: 0, from: null, vis: true }));
    refreshNpcs();
    buildLayers();
    lights = [];
    for (let yy = 0; yy < map.h; yy++) for (let xx = 0; xx < map.w; xx++) {
      const ch = map.tiles[yy][xx];
      if (ch === 'l') lights.push({ x: xx + 0.5, y: yy + 0.2, r: 3.2, c: [255, 210, 120], a: 0.55 });
      else if (ch === 'x') lights.push({ x: xx + 0.5, y: yy + 0.5, r: 2.6, c: [190, 140, 255], a: 0.6 });
      else if (ch === 'n') lights.push({ x: xx + 0.5, y: yy + 0.6, r: 1.8, c: [255, 190, 100], a: 0.45 });
      else if (ch === 'b') lights.push({ x: xx + 0.5, y: yy + 0.5, r: 3, c: [255, 220, 120], a: 0.5, bell: true });
    }
    parts = [];
    resetEnc();
    encGrace = 4;
  }
  function refreshNpcs() {
    for (const n of npcs) {
      const d = n.def;
      n.vis = (!d.show || App.cond(d.show)) && (!d.hide || !App.cond(d.hide));
    }
  }
  function resetEnc() {
    const e = map && map.enc;
    encSteps = e ? e.rate[0] + Math.floor(Math.random() * (e.rate[1] - e.rate[0])) : 999;
  }

  /* ── 정적 층 그리기 ── */
  function buildLayers() {
    for (let f = 0; f < 2; f++) {
      const c = layers[f] && layers[f].width === map.w * 16 && layers[f].height === map.h * 16 ? layers[f] : document.createElement('canvas');
      c.width = map.w * 16; c.height = map.h * 16;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, c.width, c.height);
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) drawTile(g, x, y, f);
      // 두 칸에 걸친 종은 이웃 칸을 다 그린 뒤 가운데에 얹는다
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w - 1; x++) {
        if (map.tiles[y][x] === 'b' && map.tiles[y][x + 1] === 'b' && tileAt(x - 1, y) !== 'b') spr(g, 'bell', x, y, 8, 0);
      }
      layers[f] = c;
    }
  }
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  function ground(g, x, y) {
    const below = tileAt(x, y + 1), up = tileAt(x, y - 1);
    const near = [tileAt(x - 1, y), tileAt(x + 1, y), up, below];
    if (near.includes('_') && !near.includes('.') ) g.drawImage(T.carpet, x * 16, y * 16);
    else g.drawImage(T.ground[hash(x, y) % 4], x * 16, y * 16);
  }
  function spr(g, name, x, y, ox = 0, oy = 0) { const s = Gfx.sprite(name); if (s) g.drawImage(s, x * 16 + ox, y * 16 + oy); }
  function drawTile(g, x, y, f) {
    const ch = map.tiles[y][x];
    const th = Gfx.THEMES[theme];
    const X = x * 16, Y = y * 16;
    switch (ch) {
      case '.': g.drawImage(T.ground[hash(x, y) % 4], X, Y); break;
      case ',': g.drawImage(T.ground2, X, Y); break;
      case ':': g.drawImage(T.path, X, Y); break;
      case '_': g.drawImage(T.carpet, X, Y); break;
      case '*': g.drawImage(T.ground[hash(x, y) % 4], X, Y); spr(g, th.deco, x, y); break;
      case '%': g.drawImage(T.ground[hash(x, y) % 4], X, Y); spr(g, th.rubble, x, y); break;
      case '~': g.drawImage(T.water[f], X, Y); break;
      case '+': g.drawImage(T.water[f], X, Y); g.drawImage(T.bridge, X, Y); break;
      case 'T': ground(g, x, y); spr(g, th.tree, x, y); break;
      case 'P': ground(g, x, y); spr(g, th.tree2, x, y); break;
      case 'C': ground(g, x, y); spr(g, th.cactus, x, y); break;
      case 'B': ground(g, x, y); spr(g, theme === 'snow' || theme === 'ice' ? 'bush_snow' : 'bush', x, y); break;
      case 'R': ground(g, x, y); spr(g, theme === 'desert' || theme === 'tomb' ? 'rock_sand' : (theme === 'snow' || theme === 'ice' ? 'rock_ice' : 'rock'), x, y); break;
      case '#': {
        const below = tileAt(x, y + 1);
        if (below === '#' || below === '^' || y === map.h - 1) g.drawImage(T.wallTop, X, Y);
        else { g.drawImage(T.wall[hash(x, y) % 3], X, Y); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(X, Y + 14, 16, 2); }
        break;
      }
      case '|': g.drawImage(T.ground[hash(x, y) % 4], X, Y); g.drawImage(T.pillar, X, Y); break;
      case '=': ground(g, x, y); spr(g, 'fence', x, y); break;
      case '^': g.drawImage(T.roof, X, Y); break;
      case 'H': g.drawImage(T.house, X, Y); break;
      case 'n': g.drawImage(T.house, X, Y); spr(g, 'window', x, y); break;
      case 'o': {
        const l = tileAt(x - 1, y), r = tileAt(x + 1, y);
        if (l === '#' || r === '#') g.drawImage(T.wall[0], X, Y); else g.drawImage(T.house, X, Y);
        const door = map.doors.find(d => d.x === x && d.y === y);
        spr(g, 'door', x, y);
        if (door && (door.kind === 'shop' || door.kind === 'inn')) {
          const ic = door.kind === 'inn' ? 'potion_gold' : (door.shop || '').endsWith('gear') ? 'sword' : 'potion';
          const s = Gfx.sprite(ic);
          g.fillStyle = '#3e2418'; g.fillRect(X + 3, Y - 7, 10, 9);
          g.fillStyle = '#d9a866'; g.fillRect(X + 4, Y - 6, 8, 7);
          if (s) g.drawImage(s, X + 4, Y - 6, 8, 8);
        }
        break;
      }
      case 'b': {
        const l = tileAt(x - 1, y), r = tileAt(x + 1, y);
        if (l === '#' || r === '#') g.drawImage(T.wall[1], X, Y); else ground(g, x, y);
        if (l === 'b' || r === 'b') break;
        spr(g, 'bell', x, y);
        break;
      }
      case 'l': ground(g, x, y); spr(g, 'lamp', x, y); break;
      case 'c': {
        ground(g, x, y);
        const c = map.chests.find(o => o.x === x && o.y === y);
        spr(g, c && G().opened[c.id] ? 'chest_open' : 'chest', x, y);
        break;
      }
      case 'x': ground(g, x, y); g.drawImage(T.crystal, X, Y); break;
      case 's': ground(g, x, y); spr(g, 'sign', x, y); break;
      default: g.drawImage(T.ground[0], X, Y);
    }
  }

  /* ── 움직임 ── */
  function setHeld(d) { held = d; if (d) { path = []; pendingInteract = null; } }
  function face(d) { player.dir = d; }
  function tryMove(d) {
    player.dir = d;
    const [dx, dy] = DIRV[d];
    const nx = player.x + dx, ny = player.y + dy;
    if (!walkable(nx, ny)) return false;
    player.from = [player.x, player.y];
    player.x = nx; player.y = ny;
    player.moving = true; player.t = 0;
    return true;
  }
  function arrive() {
    player.moving = false;
    player.step++;
    G().stats.steps = (G().stats.steps || 0) + 1;
    // 출구
    const ex = map.exits.find(e => e.x === player.x && e.y === player.y);
    if (ex) { held = null; path = []; App.leaveMap(ex); return; }
    // 밟는 사건
    for (const ev of map.events) {
      if (ev.check || ev.x !== player.x || ev.y !== player.y) continue;
      if (ev.unless && App.cond(ev.unless)) continue;
      if (ev.when && !App.cond(ev.when)) continue;
      if (ev.once && G().flags['done:' + ev.script]) continue;
      if (ev.once) G().flags['done:' + ev.script] = true;
      held = null; path = [];
      App.runScript(ev.script);
      return;
    }
    // 마주침
    if (map.enc && encGrace-- <= 0 && !inSafe()) {
      if (--encSteps <= 0) {
        resetEnc();
        encGrace = 3;
        held = null; path = [];
        App.encounter(pickFormation());
        return;
      }
    }
    if (!path.length && pendingInteract) {
      const p = pendingInteract; pendingInteract = null;
      const d = p.x > player.x ? 'right' : p.x < player.x ? 'left' : p.y > player.y ? 'down' : 'up';
      player.dir = d;
      interact();
    }
  }
  function inSafe() {
    return (map.safe || []).some(([x0, y0, x1, y1]) => player.x >= x0 && player.x <= x1 && player.y >= y0 && player.y <= y1);
  }
  function pickFormation() {
    let table = map.enc.table;
    for (const z of map.zones || []) {
      const [x0, y0, x1, y1] = z.rect;
      if (player.x >= x0 && player.x <= x1 && player.y >= y0 && player.y <= y1) { table = z.table; break; }
    }
    let total = table.reduce((a, [, w]) => a + w, 0), r = Math.random() * total;
    for (const [f, w] of table) if ((r -= w) < 0) return f;
    return table[0][0];
  }

  /* 누른 곳까지 걸어가기 (너비 우선 탐색) */
  function walkTo(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return;
    let goal = [tx, ty], interactAt = null;
    if (!WALK.has(tileAt(tx, ty)) || npcAt(tx, ty)) {
      interactAt = { x: tx, y: ty };
      goal = null;
    }
    const key = (x, y) => y * map.w + x;
    const prev = new Map([[key(player.x, player.y), null]]);
    const q = [[player.x, player.y]];
    let found = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (goal ? (x === goal[0] && y === goal[1]) : (Math.abs(x - tx) + Math.abs(y - ty) === 1)) { found = [x, y]; break; }
      for (const [dx, dy] of Object.values(DIRV)) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || !walkable(nx, ny)) continue;
        prev.set(k, [x, y]); q.push([nx, ny]);
      }
      if (prev.size > 2500) break;
    }
    if (!found) return;
    const steps = [];
    let cur = found;
    while (cur && !(cur[0] === player.x && cur[1] === player.y)) { steps.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
    path = steps;
    pendingInteract = interactAt;
    marker = { x: tx, y: ty, t: 400 };
    if (!steps.length && interactAt) { arrive_interact(interactAt); }
  }
  let marker = null;
  function arrive_interact(p) {
    pendingInteract = null;
    player.dir = p.x > player.x ? 'right' : p.x < player.x ? 'left' : p.y > player.y ? 'down' : 'up';
    interact();
  }
  function tap(clientX, clientY) {
    if (!map) return;
    const r = cv.getBoundingClientRect();
    const dpr = view.W / r.width;
    const wx = ((clientX - r.left) * dpr + view.cx) / (16 * view.S);
    const wy = ((clientY - r.top) * dpr + view.cy) / (16 * view.S);
    walkTo(Math.floor(wx), Math.floor(wy));
  }

  /* ── 조사 ── */
  function interact() {
    const [dx, dy] = DIRV[player.dir];
    const x = player.x + dx, y = player.y + dy;
    const n = npcAt(x, y);
    if (n) {
      n.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[player.dir];
      let talk = n.def.talk;
      if (Array.isArray(talk)) talk = (talk.find(([c]) => !c || App.cond(c)) || [null, null])[1];
      if (talk) App.runScript(talk);
      return true;
    }
    const ch = tileAt(x, y);
    // 숨은 상자(유물): 나무·바위 같은 곳에 숨어 있고, 이따금 반짝인다
    const hc = map.chests.find(o => o.hidden && o.x === x && o.y === y && !G().opened[o.id]);
    if (hc) { App.openChest(hc); return true; }
    const ev = map.events.find(e => e.check && e.x === x && e.y === y && (!e.unless || !App.cond(e.unless)));
    if (ev) { App.runScript(ev.script); return true; }
    if (ch === 'o') {
      const d = map.doors.find(o => o.x === x && o.y === y);
      if (d) App.door(d);
      return true;
    }
    if (ch === 'c') {
      const c = map.chests.find(o => o.x === x && o.y === y);
      if (c && !G().opened[c.id]) { App.openChest(c); buildLayers(); }
      else App.say(null, '빈 상자다.');
      return true;
    }
    if (ch === 's') {
      const s = map.signs.find(o => o.x === x && o.y === y);
      if (s) App.say(null, s.text);
      return true;
    }
    if (ch === 'x') { App.crystal(); return true; }
    if (ch === 'b') { App.say(null, '커다란 종이다.'); return true; }
    return false;
  }

  /* ── 매 프레임 ── */
  function update(dt, locked) {
    time += dt;
    waterFrame = Math.floor(time / 600) % 2;
    if (marker) { marker.t -= dt; if (marker.t <= 0) marker = null; }
    if (!locked) {
      if (player.moving) {
        player.t += dt / STEP_MS;
        if (player.t >= 1) { player.t = 1; arrive(); }
      }
      if (!player.moving && !App.busy()) {
        if (path.length) {
          const [nx, ny] = path[0];
          const d = nx > player.x ? 'right' : nx < player.x ? 'left' : ny > player.y ? 'down' : 'up';
          if (tryMove(d)) path.shift(); else { path = []; pendingInteract = null; }
        } else if (held) tryMove(held);
      }
      // 사람들 거닐기
      for (const n of npcs) {
        if (!n.vis) continue;
        if (n.moving) {
          n.moving -= dt / 260;
          if (n.moving <= 0) n.moving = 0;
          continue;
        }
        if (!n.def.wander) continue;
        n.next -= dt;
        if (n.next > 0) continue;
        n.next = 1800 + Math.random() * 3000;
        const dirs = Object.entries(DIRV);
        const [d, [dx, dy]] = dirs[Math.floor(Math.random() * 4)];
        const nx = n.x + dx, ny = n.y + dy;
        if (Math.abs(nx - n.hx) > 2 || Math.abs(ny - n.hy) > 2) continue;
        if (!WALK.has(tileAt(nx, ny)) || npcAt(nx, ny) || (nx === player.x && ny === player.y)) continue;
        if (player.from && nx === player.from[0] && ny === player.from[1] && player.moving) continue;
        if (map.exits.some(e => e.x === nx && e.y === ny) || map.events.some(e => !e.check && e.x === nx && e.y === ny)) continue;
        n.from = [n.x, n.y]; n.x = nx; n.y = ny; n.dir = d; n.moving = 1;
      }
    }
    const k = player.moving ? player.t : 1;
    if (player.from && player.moving) { player.fx = player.from[0] + (player.x - player.from[0]) * k; player.fy = player.from[1] + (player.y - player.from[1]) * k; }
    else { player.fx = player.x; player.fy = player.y; }
    for (const n of npcs) {
      if (n.moving && n.from) { const t = 1 - n.moving; n.fx = n.from[0] + (n.x - n.from[0]) * t; n.fy = n.from[1] + (n.y - n.from[1]) * t; }
      else { n.fx = n.x; n.fy = n.y; }
    }
    updateParticles(dt);
  }

  /* 날리는 것들: 반딧불·눈·모래·불티 */
  function updateParticles(dt) {
    const kind = { village: 'fly', forest: 'fly', desert: 'sand', tomb: 'sand', snow: 'snow', ice: 'snow', swamp: 'spore', tower: 'mote', dusk: 'ember' }[theme];
    const max = kind === 'snow' ? 70 : 34;
    while (parts.length < max) {
      parts.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, life: Math.random(), kind, ph: Math.random() * 6.28 });
    }
    for (const p of parts) {
      p.life += dt / 6000;
      p.ph += dt / 700;
      if (kind === 'snow') { p.y += dt / 9000; p.x += Math.sin(p.ph) * dt / 60000; }
      else if (kind === 'sand') { p.x += dt / 5000; p.y += Math.sin(p.ph) * dt / 40000; }
      else if (kind === 'ember') { p.y -= dt / 9000; p.x += Math.sin(p.ph) * dt / 50000; }
      else { p.x += Math.sin(p.ph) * dt / 30000; p.y += Math.cos(p.ph * 0.7) * dt / 30000; }
      if (p.x > 1.05) p.x -= 1.1; if (p.x < -0.05) p.x += 1.1;
      if (p.y > 1.05) p.y -= 1.1; if (p.y < -0.05) p.y += 1.1;
    }
  }

  /* ── 그리기 ── */
  function render() {
    if (!map) return;
    const f = Gfx.fit(cv);
    view.W = f.W; view.H = f.H;
    const S = view.S = Math.max(2, Math.round(Math.min(f.W, f.H) / (16 * 11)));
    const TS = 16 * S;
    const mw = map.w * TS, mh = map.h * TS;
    let cx = (player.fx + 0.5) * TS - f.W / 2, cy = (player.fy + 0.5) * TS - f.H / 2;
    cx = mw <= f.W ? (mw - f.W) / 2 : Math.max(0, Math.min(mw - f.W, cx));
    cy = mh <= f.H ? (mh - f.H) / 2 : Math.max(0, Math.min(mh - f.H, cy));
    cx = Math.round(cx); cy = Math.round(cy);
    view.cx = cx; view.cy = cy;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07060c'; ctx.fillRect(0, 0, f.W, f.H);
    ctx.drawImage(layers[waterFrame], -cx, -cy, mw, mh);

    if (marker) {
      ctx.strokeStyle = `rgba(255,230,140,${marker.t / 400})`; ctx.lineWidth = Math.max(2, S);
      ctx.strokeRect(marker.x * TS - cx + S, marker.y * TS - cy + S, TS - 2 * S, TS - 2 * S);
    }

    // 숨은 상자의 반짝임: 4초에 한 번 잠깐 빛난다
    for (const c of map.chests) {
      if (!c.hidden || G().opened[c.id]) continue;
      const ph = ((time + (c.x * 37 + c.y * 91) * 13) % 4000) / 4000;
      if (ph > 0.12) continue;
      const k = Math.sin(ph / 0.12 * Math.PI);
      const x = c.x * TS - cx + TS * 0.62, y = c.y * TS - cy + TS * 0.3;
      if (x < -TS || y < -TS || x > f.W + TS || y > f.H + TS) continue;
      const a = Math.max(1, Math.round(S * 2.5 * k)), w = Math.max(1, Math.round(S * 0.7));
      ctx.fillStyle = `rgba(255,248,200,${0.95 * k})`;
      ctx.fillRect(Math.round(x - a), Math.round(y - w / 2), a * 2, w);
      ctx.fillRect(Math.round(x - w / 2), Math.round(y - a), w, a * 2);
    }
    // 사람들 (y 순서)
    const actors = npcs.filter(n => n.vis).map(n => ({ y: n.fy, draw: () => drawNpc(n, TS, cx, cy, S) }));
    actors.push({ y: player.fy, draw: () => drawPlayer(TS, cx, cy, S) });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());

    lighting(f, TS, cx, cy);
    // 날리는 것
    for (const p of parts) {
      const x = p.x * f.W, y = p.y * f.H;
      const a = 0.5 + 0.5 * Math.sin(p.ph * 2);
      const sz = Math.max(1, Math.round(S * (p.kind === 'snow' ? 0.8 : 0.6)));
      ctx.fillStyle = { fly: `rgba(230,255,150,${a * 0.8})`, snow: 'rgba(255,255,255,.85)', sand: `rgba(250,225,170,${0.5 * a})`, spore: `rgba(190,240,170,${0.6 * a})`, mote: `rgba(200,170,255,${a})`, ember: `rgba(255,${150 + 80 * a | 0},90,${a})` }[p.kind];
      ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
    }
  }
  function shadow(x, y, TS, S) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(x + TS / 2, y + TS - S * 1.5, TS * 0.3, S * 1.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  function drawPlayer(TS, cx, cy, S) {
    const x = Math.round(player.fx * TS - cx), y = Math.round(player.fy * TS - cy);
    shadow(x, y, TS, S);
    const walkF = player.moving ? (player.step % 2) : 0;
    const bob = player.moving && player.t > 0.25 && player.t < 0.75 ? -S : 0;
    let name, mode = '';
    if (player.dir === 'down') name = walkF ? 'rian_d2' : 'rian_d1';
    else if (player.dir === 'up') name = walkF ? 'rian_u2' : 'rian_u1';
    else { name = walkF ? 'rian_s2' : 'rian_s1'; if (player.dir === 'left') mode = 'f'; }
    ctx.drawImage(Gfx.sprite(name, mode), x, y + bob, TS, TS);
  }
  function drawNpc(n, TS, cx, cy, S) {
    const x = Math.round(n.fx * TS - cx), y = Math.round(n.fy * TS - cy);
    shadow(x, y, TS, S);
    const bob = Math.floor((time + n.hx * 300) / 700) % 2 ? 0 : -S * 0.5;
    const side = HEROES[n.def.spr] || ['merchant', 'skeleton'].includes(n.def.spr);
    const mode = side && (n.dir === 'left' || (n.dir === 'down' && n.fx > player.fx)) ? 'f' : '';
    const s = Gfx.sprite(n.def.spr, mode);
    if (s) ctx.drawImage(s, x, Math.round(y + bob), TS, TS);
    // 할 말이 있는 사람 위의 말풍선 표시 (일행이 될 사람)
    if (HEROES[n.def.spr] && !G().flags['j_' + n.def.spr]) {
      const k = Math.floor(time / 400) % 2;
      ctx.fillStyle = '#ffd447';
      ctx.fillRect(x + TS / 2 - S, y - S * (5 + k), S * 2, S * 3);
      ctx.fillRect(x + TS / 2 - S, y - S * (1 + k), S * 2, S);
    }
  }

  /* 빛: 지역이 아직 황혼이면 노을빛, 종이 울렸으면 맑은 아침빛. 어두운 곳은 주변만 밝다 */
  function lighting(f, TS, cx, cy) {
    const region = REGION_OF_MAP[mapId];
    const dawn = region < 5 && G().flags['bell' + region];
    const darkHere = Gfx.THEMES[theme].dark && (!map.tintRect || (player.x >= map.tintRect[0] && player.x <= map.tintRect[2] && player.y >= map.tintRect[1] && player.y <= map.tintRect[3]));
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    let gr = ctx.createLinearGradient(0, 0, 0, f.H);
    if (theme === 'dusk') { gr.addColorStop(0, 'rgb(170,90,120)'); gr.addColorStop(1, 'rgb(230,130,100)'); }
    else if (dawn) { gr.addColorStop(0, 'rgb(255,250,240)'); gr.addColorStop(1, 'rgb(255,244,226)'); }
    else { gr.addColorStop(0, 'rgb(150,112,175)'); gr.addColorStop(1, 'rgb(245,165,130)'); }
    ctx.fillStyle = gr; ctx.fillRect(0, 0, f.W, f.H);
    ctx.restore();
    if (darkHere) {
      const px = (player.fx + 0.5) * TS - cx, py = (player.fy + 0.5) * TS - cy;
      const rg = ctx.createRadialGradient(px, py, TS * 1.5, px, py, TS * 7);
      rg.addColorStop(0, 'rgba(8,6,16,0)'); rg.addColorStop(1, dawn ? 'rgba(8,6,16,.45)' : 'rgba(8,6,16,.62)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, f.W, f.H);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.9 + 0.1 * Math.sin(time / 180);
    for (const l of lights) {
      if (l.bell && !(region < 5 && G().flags['bell' + region]) && mapId !== 'village') continue;
      const x = l.x * TS - cx, y = l.y * TS - cy, r = l.r * TS;
      if (x < -r || y < -r || x > f.W + r || y > f.H + r) continue;
      const a = l.a * (dawn ? 0.45 : 1) * flick;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${a * 0.6})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (dawn) {
      const rg = ctx.createRadialGradient(f.W * 0.85, -f.H * 0.1, 0, f.W * 0.85, -f.H * 0.1, f.H * 1.1);
      rg.addColorStop(0, 'rgba(255,220,150,.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, f.W, f.H);
    }
    ctx.restore();
    // 가장자리 어둡게
    const vg = ctx.createRadialGradient(f.W / 2, f.H / 2, Math.min(f.W, f.H) * 0.35, f.W / 2, f.H / 2, Math.max(f.W, f.H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, f.W, f.H);
  }

  function pushBack() {
    const [dx, dy] = DIRV[player.dir];
    const bx = player.x - dx, by = player.y - dy;
    if (walkable(bx, by)) { player.x = bx; player.y = by; player.fx = bx; player.fy = by; }
  }

  return {
    init, load, update, render, setHeld, tap, interact, face, pushBack, refreshNpcs, buildLayers,
    get mapId() { return mapId; }, get map() { return map; },
    get pos() { return { x: player.x, y: player.y, dir: player.dir }; },
    get moving() { return player.moving || path.length > 0; }
  };
})();
