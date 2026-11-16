'use strict';
/* 한 층 안에서 움직이는 모든 것: 지형 충돌, 길찾기, 주인공, 몬스터 행동, 탄환, 예고, 장판, 광선, 줍는 것 */

const ENT = (() => {
  const T = 32;
  let w = null;                 // 지금 층의 세계
  const D = () => DATA;

  /* ───────── 세계 ───────── */
  function newWorld(L, run) {
    w = {
      L, B: TILES.build(L), t: 0, run,
      enemies: [], pb: [], eb: [], tels: [], zones: [], beams: [], picks: [], lobs: [],
      flow: new Int16Array(L.w * L.h).fill(-1), flowT: 0, flowCell: -1,
      warpT: 0, boss: null, kills: 0, sched: []
    };
    return w;
  }
  const cellAt = (px, py) => {
    const cx = Math.floor(px / T), cy = Math.floor(py / T);
    if (cx < 0 || cy < 0 || cx >= w.L.w || cy >= w.L.h) return 1;
    return w.L.grid[cy * w.L.w + cx];
  };
  const isSolid = (v, fly, dash) => v === 1 || v === 4 || (v === 2 && !fly && !dash);
  function blocked(x, y, r, fly, dash) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const v = (cx < 0 || cy < 0 || cx >= w.L.w || cy >= w.L.h) ? 1 : w.L.grid[cy * w.L.w + cx];
      if (isSolid(v, fly, dash)) return true;
    }
    return false;
  }
  /* 축마다 따로 움직이고 벽에 닿으면 벽면에 붙인다. 막혔으면 true */
  function move(e, dx, dy, fly = e.fly, dash = false) {
    let hit = false;
    const r = e.r * 0.8;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.9)));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx) {
        if (!blocked(e.x + sx, e.y, r, fly, dash)) e.x += sx;
        else { hit = true; e.x = sx > 0 ? Math.floor((e.x + r + sx) / T) * T - r - 0.01 : Math.floor((e.x - r + sx) / T + 1) * T + r + 0.01; if (blocked(e.x, e.y, r, fly, dash)) e.x -= sx > 0 ? 0.5 : -0.5; }
      }
      if (sy) {
        if (!blocked(e.x, e.y + sy, r, fly, dash)) e.y += sy;
        else { hit = true; e.y = sy > 0 ? Math.floor((e.y + r + sy) / T) * T - r - 0.01 : Math.floor((e.y - r + sy) / T + 1) * T + r + 0.01; if (blocked(e.x, e.y, r, fly, dash)) e.y -= sy > 0 ? 0.5 : -0.5; }
      }
    }
    return hit;
  }
  /* 시야: 벽·장애물만 막는다 */
  function los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) { const v = cellAt(ax + (bx - ax) * i / n, ay + (by - ay) * i / n); if (v === 1 || v === 4) return false; }
    return true;
  }
  /* 주인공 칸에서 퍼지는 거리 지도 */
  function updateFlow(dt) {
    const p = w.player, L = w.L;
    w.flowT -= dt;
    const c = Math.floor(p.y / T) * L.w + Math.floor(p.x / T);
    if (c === w.flowCell && w.flowT > 0) return;
    if (w.flowT > 0 && c !== w.flowCell && w.flowT > 0.1) return;
    w.flowCell = c; w.flowT = 0.25;
    const f = w.flow; f.fill(-1);
    if (c < 0 || c >= f.length) return;
    const q = new Int32Array(L.w * L.h); let qh = 0, qt = 0;
    q[qt++] = c; f[c] = 0;
    while (qh < qt) {
      const i = q[qh++], x = i % L.w, y = (i / L.w) | 0, d = f[i] + 1;
      if (x > 0) { const j = i - 1; if (f[j] < 0 && !isSolid(L.grid[j])) { f[j] = d; q[qt++] = j; } }
      if (x < L.w - 1) { const j = i + 1; if (f[j] < 0 && !isSolid(L.grid[j])) { f[j] = d; q[qt++] = j; } }
      if (y > 0) { const j = i - L.w; if (f[j] < 0 && !isSolid(L.grid[j])) { f[j] = d; q[qt++] = j; } }
      if (y < L.h - 1) { const j = i + L.w; if (f[j] < 0 && !isSolid(L.grid[j])) { f[j] = d; q[qt++] = j; } }
    }
  }
  /* 목표 쪽 단위 벡터(길찾기 포함) */
  function steer(e, tx, ty) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.fly || d < 40 || los(e.x, e.y, tx, ty)) return [dx / d, dy / d];
    const L = w.L, cx = Math.floor(e.x / T), cy = Math.floor(e.y / T);
    let best = w.flow[cy * L.w + cx], bx = cx, by = cy;
    if (best < 0) best = 9999;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
      const v = w.flow[ny * L.w + nx];
      if (v < 0 || v >= best) continue;
      if (ox && oy && (isSolid(L.grid[cy * L.w + nx]) || isSolid(L.grid[ny * L.w + cx]))) continue;
      best = v; bx = nx; by = ny;
    }
    const gx = bx * T + 16 - e.x, gy = by * T + 16 - e.y, gd = Math.hypot(gx, gy) || 1;
    return [gx / gd, gy / gd];
  }
  function randomOpen(minDist, avoidHaz = true) {
    const L = w.L, p = w.player;
    for (let k = 0; k < 200; k++) {
      const x = U.R.int(1, L.w - 2), y = U.R.int(2, L.h - 2), v = L.grid[y * L.w + x];
      if (v !== 0 && !(v === 3 && !avoidHaz)) continue;
      const px = x * T + 16, py = y * T + 16;
      if (p && U.dist(px, py, p.x, p.y) < minDist) continue;
      return [px, py];
    }
    return [L.spawn.x * T + 16, (L.spawn.y - 4) * T + 16];
  }

  /* ───────── 능력치 ───────── */
  function stats(run) {
    const C = D().CLASSES[run.cls];
    const s = { maxHp: C.hp, dmg: C.dmg, atkCd: C.atkCd, spd: C.spd, dmgMul: 1, atkSpd: 1, spdMul: 1, crit: 0.05, critDmg: 1.8, proj: 0, pierce: 0, size: 1,
      dashCd: 0.85, dashDmg: 0, skillCd: 1, skillDmg: 1, lifeOnKill: 0, burn: 0, slow: 0, chain: 0, boom: 0, orbit: 0, shield: 0, berserk: 0, thorns: 0,
      goldMul: 1, magnet: 1, armor: 0, revive: 0, regen: 0, twin: 0, timewarp: 0, focus: 0, spore: 0, poison: 0, discount: 0, scarab: 0, mirror: 0,
      fireRes: 0, fireTrail: 0, cards: 3, extraRerolls: 0, metaRerolls: 0 };
    const meta = run.meta || {};
    for (const m of D().META) if (meta[m.id]) m.a(s, meta[m.id]);
    for (const [id, n] of Object.entries(run.upg)) { const u = D().UPG_BY[id]; if (u && n > 0) u.a(s, n); }
    for (const id of run.relics) { const r = D().RELIC_BY[id]; if (r) r.a(s); }
    s.maxHp += run.bonusHp || 0;
    if (run.cls === 'blade') s.armor += 0.1;
    s.armor = Math.min(0.6, s.armor);
    s.crit = Math.min(0.85, s.crit);
    s.maxHp = Math.round(s.maxHp);
    return s;
  }

  /* ───────── 주인공 ───────── */
  function makePlayer(run, x, y) {
    const st = stats(run);
    const p = {
      kind: 'p', cls: run.cls, x, y, r: 8, vx: 0, vy: 0, face: -Math.PI / 2, view: 'up', flip: false, t: 0, moving: false,
      st, hp: Math.min(run.hp ?? st.maxHp, st.maxHp), atkT: 0, combo: 0, comboT: 0, dashT: 0, dashCdT: 0, dashDir: 0, skillT: 0, iT: 0,
      shield: st.shield, revives: st.revive - (run.usedRevives || 0), safeX: x, safeY: y, spinT: 0, spinTick: 0, stillT: 0, fallT: 0,
      orbA: 0, orbHit: new Map(), scarabT: 4, trailT: 0, swingT: 0, swingA: 0, hurtT: 0, alive: true, hazT: 0
    };
    p.heal = (v) => { const before = p.hp; p.hp = Math.min(p.st.maxHp, p.hp + v); const g = Math.round(p.hp - before); if (g > 0) FX.num(p.x, p.y - 40, '+' + g, 'g'); };
    return p;
  }
  function attackDamage(p) {
    const s = p.st;
    let d = s.dmg * s.dmgMul;
    if (s.berserk && p.hp < s.maxHp * 0.5) d *= 1 + s.berserk;
    if (s.focus && p.stillT > 0.35) d *= 1 + s.focus;
    return d;
  }
  function rollCrit(p, base) {
    const c = Math.random() < p.st.crit;
    return [c ? base * p.st.critDmg : base, c];
  }

  function updatePlayer(p, dt, inp) {
    const s = p.st;
    p.t += dt;
    if (p.fallT > 0) {
      p.fallT -= dt;
      if (p.fallT <= 0) { p.x = p.safeX; p.y = p.safeY; p.iT = 1; hurtPlayer(Math.round(s.maxHp * 0.08), { fall: true, raw: true }); }
      return;
    }
    // 이동
    let mx = inp.mx, my = inp.my;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > 0.1;
    p.stillT = p.moving ? 0 : p.stillT + dt;
    const here = cellAt(p.x, p.y);
    const th = TILES.THEMES[w.L.tier].hazard;
    let spd = s.spd * s.spdMul * (p.spinT > 0 ? 0.7 : 1);
    if (here === 3 && th === 'thorn') spd *= 0.75;
    if (here === 3 && th === 'quicksand') spd *= 0.5;
    if (p.slowT > 0) { p.slowT -= dt; spd *= 0.6; }
    if (p.dashCdT > 0) p.dashCdT -= dt;
    if (inp.dash && p.dashCdT <= 0 && p.dashT <= 0) {
      p.dashDir = p.moving ? Math.atan2(my, mx) : p.face;
      p.dashT = 0.17; p.dashCdT = s.dashCd; p.iT = Math.max(p.iT, 0.26); p.dashHit = new Set();
      SND.sfx('dash');
      FX.burst(p.x, p.y, 8, { sp: 60, c: [[230, 230, 255], [180, 180, 220]], life: 0.3, a: p.dashDir + Math.PI, spread: 1.2 });
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      const ds = 540;
      move(p, Math.cos(p.dashDir) * ds * dt, Math.sin(p.dashDir) * ds * dt, false, true);
      p.vx = Math.cos(p.dashDir) * spd; p.vy = Math.sin(p.dashDir) * spd;
      if (Math.random() < 0.7) FX.part(p.x + (Math.random() - 0.5) * 8, p.y - 14 + (Math.random() - 0.5) * 16, { c: [200, 210, 255], life: 0.25, s: 2, glow: true });
      if (s.dashDmg) for (const e of w.enemies) if (!p.dashHit.has(e) && hittable(e) && U.dist2(e.x, e.y, p.x, p.y) < (e.r + 18) ** 2) { p.dashHit.add(e); const [d, c] = rollCrit(p, attackDamage(p) * s.dashDmg); dmgEnemy(e, d, { crit: c, src: 'atk' }); }
      if (s.fireTrail) { p.trailT -= dt; if (p.trailT <= 0) { p.trailT = 0.04; w.zones.push({ x: p.x, y: p.y, r: 16, t: 0, dur: 2.2, dps: attackDamage(p) * s.fireTrail, owner: 'p', kind: 'fire', tick: 0 }); } }
      if (p.dashT <= 0 && s.timewarp) { w.warpT = 1.5; FX.ring(p.x, p.y - 10, 10, 200, 0.5, [200, 170, 255], 3); SND.sfx('warp'); }
    } else {
      const tvx = mx * spd, tvy = my * spd;
      const ice = here === 3 && th === 'blackice';
      const k = ice ? 1 - Math.pow(0.05, dt) : 1 - Math.pow(0.0005, dt);
      p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
      if (ice && !p.moving) { p.vx *= Math.pow(0.6, dt); p.vy *= Math.pow(0.6, dt); }
      move(p, p.vx * dt, p.vy * dt, false, false);
    }
    // 구덩이에 빠짐
    if (p.dashT <= 0 && cellAt(p.x, p.y) === 2) {
      p.fallT = 0.5; SND.sfx('fall');
      FX.burst(p.x, p.y, 10, { c: [120, 110, 140], sp: 50, life: 0.4 });
      return;
    }
    if (cellAt(p.x, p.y) === 0 && !blocked(p.x, p.y, p.r + 6, false, false)) { p.safeX = p.x; p.safeY = p.y; }
    // 위험 지형 피해
    if (here === 3) {
      p.hazT -= dt;
      if (th === 'rift') { const cx = Math.floor(p.x / T) * T + 16, cy = Math.floor(p.y / T) * T + 16; move(p, (cx - p.x) * 1.6 * dt, (cy - p.y) * 1.6 * dt); }
      if (p.hazT <= 0) {
        const per = { thorn: 0.06, lava: 0.16, rift: 0.08 }[th];
        if (per) { p.hazT = 0.5; hurtPlayer(Math.max(2, Math.round(s.maxHp * per * (th === 'lava' ? 1 - s.fireRes : 1))), { haz: true, raw: true, soft: true }); }
      }
    } else p.hazT = 0;
    // 조준·방향
    if (inp.aim !== null && inp.aim !== undefined) p.face = inp.aim;
    else if (p.moving) p.face = Math.atan2(my, mx);
    const fa = p.moving && !inp.attack && inp.aimMode !== 'mouse' ? Math.atan2(my, mx) : p.face;
    const sn = Math.sin(fa), cs = Math.cos(fa);
    p.view = sn < -0.6 ? 'up' : sn > 0.6 ? 'down' : 'side';
    p.flip = cs < 0;
    // 공격
    if (p.atkT > 0) p.atkT -= dt;
    if (p.comboT > 0) p.comboT -= dt; else p.combo = 0;
    if (p.swingT > 0) p.swingT -= dt;
    if (inp.attack && p.atkT <= 0 && p.spinT <= 0) {
      doAttack(p, p.face);
      p.atkT = s.atkCd / s.atkSpd;
      if (s.twin && Math.random() < s.twin) w.sched.push({ t: 0.09, fn: () => doAttack(p, p.face, true) });
    }
    // 스킬
    if (p.skillT > 0) p.skillT -= dt;
    if (inp.skill && p.skillT <= 0) { doSkill(p, inp); p.skillT = D().CLASSES[p.cls].skill.cd * s.skillCd; }
    if (p.spinT > 0) {
      p.spinT -= dt; p.spinTick -= dt; p.iT = Math.max(p.iT, 0.05);
      if (p.spinTick <= 0) {
        p.spinTick = 0.09;
        const R = 82 * s.size;
        for (const e of w.enemies) if (hittable(e) && U.dist2(e.x, e.y, p.x, p.y) < (R + e.r) ** 2) { const [d, c] = rollCrit(p, attackDamage(p) * 0.65 * s.skillDmg); dmgEnemy(e, d, { crit: c, src: 'skill', kx: e.x - p.x, ky: e.y - p.y, knock: 80 }); }
        clearBullets(p.x, p.y, R);
        FX.slash(p.x, p.y - 12, p.t * 18, R, 2.4, [200, 230, 255], 0.14, 12);
      }
    }
    // 회복·무적
    if (s.regen && p.hp < s.maxHp) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
    if (p.iT > 0) p.iT -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    // 수호 구체
    if (s.orbit) {
      p.orbA += dt * 3.2;
      for (let i = 0; i < s.orbit; i++) {
        const a = p.orbA + i * U.TAU / s.orbit, ox = p.x + Math.cos(a) * 46, oy = p.y - 12 + Math.sin(a) * 46;
        for (const e of w.enemies) {
          if (!hittable(e)) continue;
          if (U.dist2(e.x, e.y - 10, ox, oy) < (e.r + 9) ** 2) { const last = p.orbHit.get(e) || 0; if (w.t - last > 0.4) { p.orbHit.set(e, w.t); dmgEnemy(e, attackDamage(p) * 0.55, { src: 'orb' }); } }
        }
        for (const b of w.eb) if (!b.heavy && U.dist2(b.x, b.y, ox, oy) < (b.r + 8) ** 2) { b.life = 0; FX.burst(b.x, b.y, 4, { c: [200, 220, 255], sp: 60, life: 0.2 }); }
      }
    }
    // 태양 스카라베
    if (s.scarab) {
      p.scarabT -= dt;
      if (p.scarabT <= 0) {
        p.scarabT = 4;
        FX.ring(p.x, p.y - 10, 10, 110, 0.4, [255, 200, 80], 4); FX.burst(p.x, p.y - 10, 20, { c: [[255, 220, 100], [255, 160, 40]], sp: 200, life: 0.4, glow: true });
        for (const e of w.enemies) if (hittable(e) && U.dist2(e.x, e.y, p.x, p.y) < (110 + e.r) ** 2) dmgEnemy(e, attackDamage(p) * s.scarab, { src: 'proc' });
        SND.sfx('boom');
      }
    }
  }

  function doAttack(p, a, echo = false) {
    const s = p.st, C = p.cls, dmg = attackDamage(p);
    p.swingT = 0.18; p.swingA = a;
    if (C === 'blade') {
      const c = p.combo; p.combo = (p.combo + 1) % 3; p.comboT = 0.75;
      const big = c === 2, arc = big ? 2.8 : 2.1, R = (big ? 72 : 60) * s.size;
      const mul = big ? 1.5 : 1;
      p.swingDir = c % 2 ? -1 : 1;
      FX.slash(p.x, p.y - 14, a, R, arc, big ? [255, 230, 160] : [200, 230, 255], 0.17, big ? 14 : 10);
      SND.sfx(big ? 'slash2' : 'slash');
      if (!echo) move(p, Math.cos(a) * 5, Math.sin(a) * 5);
      for (const e of w.enemies) {
        if (!hittable(e)) continue;
        const dx = e.x - p.x, dy = (e.y - (e.fly ? 10 : 0)) - (p.y - 8), d = Math.hypot(dx, dy);
        if (d > R + e.r) continue;
        if (d > e.r + 6 && Math.abs(U.angDiff(a, Math.atan2(dy, dx))) > arc / 2) continue;
        const [dd, cr] = rollCrit(p, dmg * mul);
        dmgEnemy(e, dd, { crit: cr, src: 'atk', kx: dx, ky: dy, knock: big ? 220 : 120 });
      }
      clearBullets(p.x + Math.cos(a) * R * 0.5, p.y - 10 + Math.sin(a) * R * 0.5, R * 0.75);
      for (let i = 0; i < s.proj; i++) {
        const aa = a + (i - (s.proj - 1) / 2) * 0.24;
        w.pb.push({ x: p.x + Math.cos(aa) * 20, y: p.y - 12 + Math.sin(aa) * 20, vx: Math.cos(aa) * 430, vy: Math.sin(aa) * 430, r: 13 * s.size, dmg: dmg * 0.75, life: 0.42, kind: 'wave', pierce: 99, hit: new Set(), ang: aa });
      }
    } else if (C === 'ranger') {
      const n = 1 + s.proj;
      SND.sfx('shoot');
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * 0.11;
        w.pb.push({ x: p.x + Math.cos(aa) * 10, y: p.y - 14 + Math.sin(aa) * 10, vx: Math.cos(aa) * 620, vy: Math.sin(aa) * 620, r: 4 * s.size, dmg, life: 0.85, kind: 'arrow', pierce: s.pierce, hit: new Set(), ang: aa });
      }
    } else {
      const n = 1 + s.proj;
      SND.sfx('magic');
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * 0.22;
        w.pb.push({ x: p.x + Math.cos(aa) * 12, y: p.y - 18 + Math.sin(aa) * 12, vx: Math.cos(aa) * 330, vy: Math.sin(aa) * 330, r: 6 * s.size, dmg, life: 1.3, kind: 'orb', pierce: s.pierce, hit: new Set(), ang: aa, homing: 3.2, splash: 32 * s.size });
      }
    }
  }
  function doSkill(p, inp) {
    const s = p.st, dmg = attackDamage(p) * s.skillDmg;
    if (p.cls === 'blade') {
      p.spinT = 0.55; p.spinTick = 0;
      SND.sfx('spin'); FX.addShake(3);
    } else if (p.cls === 'ranger') {
      const n = 14 + s.proj * 2, a = p.face;
      for (let i = 0; i < n; i++) {
        const aa = a + (i / (n - 1) - 0.5) * 1.4;
        w.pb.push({ x: p.x, y: p.y - 14, vx: Math.cos(aa) * 640, vy: Math.sin(aa) * 640, r: 4 * s.size, dmg: dmg * 0.8, life: 0.8, kind: 'arrow', pierce: s.pierce + 2, hit: new Set(), ang: aa });
      }
      p.dashDir = a + Math.PI; p.dashT = 0.12; p.iT = Math.max(p.iT, 0.3); p.dashHit = new Set();
      SND.sfx('volley'); FX.addShake(3);
    } else {
      let tx, ty;
      if (inp.aimMode === 'mouse' && inp.wx !== undefined) { tx = inp.wx; ty = inp.wy; }
      else { const e = nearestEnemy(p.x, p.y, 520); if (e) { tx = e.x; ty = e.y; } else { tx = p.x + Math.cos(p.face) * 160; ty = p.y + Math.sin(p.face) * 160; } }
      const R = 96 * s.size;
      SND.sfx('cast');
      w.tels.push({ k: 'circle', x: tx, y: ty, r: R, t: 0, dur: 0.45, c: [180, 120, 255], friendly: true, fn: () => {
        FX.ring(tx, ty, 10, R, 0.45, [255, 200, 120], 6); FX.burst(tx, ty, 40, { c: [[255, 220, 120], [255, 140, 60], [200, 120, 255]], sp: 260, life: 0.6, glow: true, s: 3 });
        FX.addShake(8); FX.flash([255, 220, 160], 0.25); SND.sfx('meteor');
        for (const e of w.enemies) if (hittable(e) && U.dist2(e.x, e.y, tx, ty) < (R + e.r) ** 2) { const [d, c] = rollCrit(p, dmg * 4); dmgEnemy(e, d, { crit: c, src: 'skill', kx: e.x - tx, ky: e.y - ty, knock: 260, burn: true }); }
        w.zones.push({ x: tx, y: ty, r: R * 0.6, t: 0, dur: 2.5, dps: attackDamage(p) * 0.5, owner: 'p', kind: 'fire', tick: 0 });
      } });
    }
  }
  function clearBullets(x, y, r) {
    for (const b of w.eb) if (!b.heavy && U.dist2(b.x, b.y, x, y) < (r + b.r) ** 2) { b.life = 0; FX.burst(b.x, b.y, 3, { c: [220, 230, 255], sp: 80, life: 0.2 }); }
  }
  function nearestEnemy(x, y, maxD = 1e9, needLos = false) {
    let best = null, bd = maxD * maxD;
    for (const e of w.enemies) {
      if (!hittable(e)) continue;
      const d = U.dist2(x, y, e.x, e.y);
      if (d < bd && (!needLos || los(x, y - 10, e.x, e.y - 10))) { bd = d; best = e; }
    }
    return best;
  }
  const hittable = (e) => !e.dead && e.spawnT <= 0 && !e.under && !e.gone;

  /* ───────── 피해 ───────── */
  function hurtPlayer(amount, o = {}) {
    const p = w.player;
    if (!p.alive || G.god) return false;
    if (!o.raw && (p.iT > 0 || p.dashT > 0)) return false;
    if (o.haz && p.dashT > 0) return false;
    if (!o.fall && !o.haz && p.shield > 0) {
      p.shield--; p.iT = 0.8;
      FX.ring(p.x, p.y - 14, 8, 34, 0.35, [140, 220, 255], 3); SND.sfx('block');
      return false;
    }
    if (o.bullet && p.st.mirror && Math.random() < p.st.mirror) {
      p.iT = 0.3; SND.sfx('block');
      FX.ring(p.x, p.y - 14, 6, 26, 0.3, [190, 240, 255], 2);
      if (o.b) w.pb.push({ x: o.b.x, y: o.b.y, vx: -o.b.vx * 1.5, vy: -o.b.vy * 1.5, r: 6, dmg: attackDamage(p) * 1.5, life: 1, kind: 'mirror', pierce: 2, hit: new Set(), ang: Math.atan2(-o.b.vy, -o.b.vx) });
      return false;
    }
    const d = Math.max(1, Math.round(amount * (o.raw ? 1 : 1 - p.st.armor)));
    p.hp -= d;
    if (!o.soft) { p.iT = 0.85; FX.addShake(5); FX.hitStop(0.05); FX.flash([255, 60, 60], 0.18); }
    else p.iT = Math.max(p.iT, 0.2);
    p.hurtT = 0.25;
    FX.num(p.x, p.y - 44, d, 'r');
    FX.burst(p.x, p.y - 16, 10, { c: [[255, 80, 90], [200, 40, 60]], sp: 120, life: 0.35 });
    SND.sfx('hurt');
    w.run.dmgTaken = (w.run.dmgTaken || 0) + d;
    if (p.hp <= 0) {
      if (p.revives > 0) {
        p.revives--; w.run.usedRevives = (w.run.usedRevives || 0) + 1;
        p.hp = Math.round(p.st.maxHp * 0.5); p.iT = 2.5;
        FX.ring(p.x, p.y - 14, 10, 160, 0.8, [255, 200, 100], 5); FX.flash([255, 230, 160], 0.6);
        FX.burst(p.x, p.y - 14, 40, { c: [[255, 220, 120], [255, 160, 60]], sp: 220, life: 0.8, glow: true });
        clearBullets(p.x, p.y, 400); SND.sfx('revive');
        G.toast('불사조의 힘으로 다시 일어섰다!');
      } else { p.hp = 0; p.alive = false; G.onDeath(); }
    }
    return true;
  }

  function dmgEnemy(e, amount, o = {}) {
    if (!hittable(e)) return;
    if (e.inv && !o.ignoreInv) { if (o.src === 'atk') FX.num(e.x, e.y - e.h * 0.8, 0, 'b'); return; }
    let d = amount * (e.dmgTakenMul || 1);
    if (e.phaseLock !== undefined && e.hp - d < e.phaseLock) d = Math.max(0, e.hp - e.phaseLock);
    d = Math.max(1, Math.round(d));
    e.hp -= d;
    e.flashT = 0.09;
    w.run.dmgDealt = (w.run.dmgDealt || 0) + d;
    FX.num(e.x, e.y - e.h * 0.85 - (e.fly || 0), d, o.crit ? 'y' : o.src === 'dot' ? 'p' : 'w');
    if (o.src !== 'dot') {
      const c = e.boss ? [255, 220, 160] : [255, 255, 255];
      FX.burst(e.x, e.y - e.h * 0.4 - (e.fly || 0), o.crit ? 8 : 4, { c: [c, [255, 200, 120]], sp: 140, life: 0.25 });
      SND.sfx(o.crit ? 'crit' : 'hit');
      if (o.crit) FX.hitStop(0.025);
    }
    if (o.knock && !e.heavy && !e.boss && (o.kx || o.ky)) {
      const l = Math.hypot(o.kx, o.ky) || 1, k = o.knock * (e.elite ? 0.5 : 1);
      e.kvx = (e.kvx || 0) + o.kx / l * k; e.kvy = (e.kvy || 0) + o.ky / l * k;
    }
    const p = w.player, s = p.st;
    if (o.src === 'atk' || o.src === 'skill') {
      if ((s.burn && Math.random() < s.burn) || o.burn) { e.burnT = 3; e.burnDps = attackDamage(p) * 0.4; }
      if (s.slow && Math.random() < s.slow) { e.slowT = 2; }
      if (s.poison) { e.poisonN = Math.min(3, (e.poisonN || 0) + 1); e.poisonT = 4; e.poisonDps = attackDamage(p) * s.poison; }
      if (s.chain && Math.random() < s.chain) chainBolt(e, attackDamage(p) * 0.7);
      if (s.thornsHit) {}
    }
    if (e.hp <= 0) killEnemy(e, o);
    else if (e.boss) G.bossHit(e);
  }
  function chainBolt(from, dmg) {
    let cur = from; const hit = new Set([from]);
    for (let k = 0; k < 3; k++) {
      let best = null, bd = 160 * 160;
      for (const e of w.enemies) if (hittable(e) && !hit.has(e)) { const d = U.dist2(cur.x, cur.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      if (!best) break;
      const pts = [], n = 6;
      for (let i = 0; i <= n; i++) pts.push([U.lerp(cur.x, best.x, i / n) + (i && i < n ? (Math.random() - 0.5) * 14 : 0), U.lerp(cur.y - cur.h * 0.5, best.y - best.h * 0.5, i / n) + (i && i < n ? (Math.random() - 0.5) * 14 : 0)]);
      FX.bolt(pts);
      hit.add(best); dmgEnemy(best, dmg, { src: 'proc' }); cur = best;
    }
    SND.sfx('zap');
  }
  function killEnemy(e, o = {}) {
    if (e.dead) return;
    e.dead = true;
    if (e.boss) { G.bossDead(e); return; }
    w.kills++; w.run.kills = (w.run.kills || 0) + 1;
    const p = w.player, s = p.st;
    const c = e.def.deathC || [255, 255, 255];
    FX.burst(e.x, e.y - e.h * 0.4 - (e.fly || 0), 14 + (e.elite ? 12 : 0), { c: [[255, 255, 255], c, [255, 220, 150]], sp: 170, life: 0.5, s: 2 });
    FX.burst(e.x, e.y, 6, { c: [[90, 80, 100]], sp: 40, life: 0.6, k: 'smoke', s: 8 });
    SND.sfx('kill');
    // 떨어뜨림
    const gold = Math.max(1, Math.round((1 + e.def.cost * 0.8 + U.R() * 1.5) * (e.elite ? 3 : 1)));
    dropCoins(e.x, e.y, gold);
    if (U.R() < (e.elite ? 0.35 : 0.035)) w.picks.push({ k: 'heart', x: e.x, y: e.y, vx: (U.R() - 0.5) * 60, vy: (U.R() - 0.5) * 60, z: 0, vz: 120, t: 0 });
    if (s.lifeOnKill) p.heal(s.lifeOnKill);
    if (s.boom && o.src !== 'boom') {
      const R = 58 * s.size;
      FX.ring(e.x, e.y - 8, 6, R, 0.3, [255, 170, 80], 4); FX.burst(e.x, e.y - 8, 14, { c: [[255, 200, 100], [255, 120, 40]], sp: 180, life: 0.35, glow: true });
      for (const o2 of w.enemies) if (o2 !== e && hittable(o2) && U.dist2(o2.x, o2.y, e.x, e.y) < (R + o2.r) ** 2) dmgEnemy(o2, attackDamage(p) * s.boom, { src: 'boom' });
      SND.sfx('boom');
    }
    if (s.spore && U.R() < s.spore) w.zones.push({ x: e.x, y: e.y, r: 44, t: 0, dur: 3, dps: attackDamage(p) * 0.5, owner: 'p', kind: 'poison', tick: 0 });
    if (e.def.ai === 'exploder') explode(e, false);
  }
  function dropCoins(x, y, total) {
    const n = Math.min(8, Math.ceil(total / 2));
    let left = total;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.max(1, Math.round(total / n)); left -= v;
      if (v <= 0) break;
      const a = U.R() * U.TAU, sp = 30 + U.R() * 70;
      w.picks.push({ k: 'coin', v, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, z: 0, vz: 100 + U.R() * 80, t: U.R() });
    }
  }

  /* ───────── 몬스터 ───────── */
  function spawnEnemy(id, x, y, o = {}) {
    const def = D().ENEMIES[id], f = w.L.floor;
    const elite = !!o.elite;
    const g = ART.get(def.spr, 0);
    const e = {
      kind: 'e', id, def, x, y, r: def.r * (elite ? 1.2 : 1), h: g.h * (elite ? 1.2 : 1), fly: def.fly ? g.fly : 0,
      hp: def.hp * D().hpScale(f) * (elite ? 2.6 : 1), dmg: def.dmg * D().dmgScale(f) * (elite ? 1.25 : 1), spd: def.spd * (elite ? 1.05 : 1),
      elite, heavy: !!def.heavy || elite && def.cost >= 3, t: U.R() * 10, st: 'idle', tm: 0.4 + U.R() * 0.8, cd: 0.8 + U.R() * 1.4, flip: false,
      spawnT: o.instant ? 0 : 0.85, kvx: 0, kvy: 0, flashT: 0, ang: 0, preT: 0
    };
    e.maxHp = e.hp;
    if (!o.instant) FX.spawnMark(x, y, 0.85, elite ? [255, 210, 90] : [255, 90, 120]);
    w.enemies.push(e);
    return e;
  }
  const P = () => w.player;
  function bullet(x, y, a, spd, kind, dmg, o = {}) {
    const B = D().BUL[kind] || D().BUL.red;
    w.eb.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: (o.r || B.r), dmg, life: o.life || 5, kind, ang: a, acc: o.acc || 0, turn: o.turn || 0,
      heavy: !!o.heavy || B.r >= 9, delay: o.delay || 0, curve: o.curve || 0, t: 0, maxSpd: o.maxSpd || 900, bounce: o.bounce || 0 });
  }
  function firePattern(e, f, ox = 0, oy = 0) {
    const p = P(), x = e.x + ox, y = e.y - e.h * 0.45 - (e.fly || 0) + oy;
    const a = Math.atan2(p.y - 12 - y, p.x - x);
    const spdK = 1 + w.L.floor * 0.006;
    if (f.pat === 'aim') for (let i = 0; i < f.n; i++) bullet(x, y, a + (i - (f.n - 1) / 2) * 0.15, f.spd * spdK, f.b, e.dmg);
    else if (f.pat === 'spread') for (let i = 0; i < f.n; i++) bullet(x, y, a + (i - (f.n - 1) / 2) * f.sp, f.spd * spdK, f.b, e.dmg);
    else if (f.pat === 'ring') { const o = U.R() * U.TAU; for (let i = 0; i < f.n; i++) bullet(x, y, o + i * U.TAU / f.n, f.spd * spdK, f.b, e.dmg); }
    else if (f.pat === 'spiral') { e.spA = (e.spA || 0) + 0.38; for (let i = 0; i < f.n; i++) bullet(x, y, e.spA + i * U.TAU / f.n, f.spd * spdK, f.b, e.dmg); }
    SND.sfx('eshoot');
  }
  function walk(e, tx, ty, spd, dt) {
    const [ux, uy] = steer(e, tx, ty);
    let k = spd * dt * (e.slowT > 0 ? 0.5 : 1);
    if (Math.abs(ux) > 0.1) e.flip = ux < 0;
    return move(e, ux * k, uy * k);
  }
  const dP = (e) => U.dist(e.x, e.y, P().x, P().y);
  const aP = (e) => Math.atan2(P().y - e.y, P().x - e.x);

  const AI = {
    hop(e, dt) {
      const d = e.def;
      e.tm -= dt;
      if (e.st === 'idle') {
        if (e.tm <= 0) { const [ux, uy] = steer(e, P().x, P().y); e.st = 'hop'; e.tm = 0.36; e.ang = Math.atan2(uy, ux) + (U.R() - 0.5) * 0.6; }
      } else {
        const hit = move(e, Math.cos(e.ang) * e.spd * 2.8 * dt * (e.slowT > 0 ? 0.5 : 1), Math.sin(e.ang) * e.spd * 2.8 * dt * (e.slowT > 0 ? 0.5 : 1));
        e.flip = Math.cos(e.ang) < 0;
        if (e.tm <= 0 || hit) {
          e.st = 'idle'; e.tm = d.hop * (0.8 + U.R() * 0.4);
          if (d.trail) w.zones.push({ x: e.x, y: e.y, r: 18, t: 0, dur: 2.6, dps: e.dmg * 0.6, owner: 'e', kind: 'fire', tick: 0 });
        }
      }
      e.frame = e.st === 'hop' ? 2 : (e.tm < 0.2 ? 1 : 0);
    },
    turret(e, dt) {
      const f = e.def.fire;
      e.cd -= dt;
      if (f.burst) {
        if (e.st === 'idle' && e.cd <= 0) { e.st = 'burst'; e.n = f.burst; e.preT = 0.3; }
        if (e.st === 'burst') {
          if (e.preT > 0) e.preT -= dt;
          else { e.tm -= dt; if (e.tm <= 0) { firePattern(e, f); e.tm = f.cd; if (--e.n <= 0) { e.st = 'idle'; e.cd = f.rest; } } }
        }
      } else if (e.cd <= 0) {
        if (!e.preT) e.preT = 0.35;
        e.preT -= dt;
        if (e.preT <= 0) { e.preT = 0; firePattern(e, f); e.cd = f.cd * (0.85 + U.R() * 0.3); }
      }
      e.flip = P().x < e.x;
      e.frame = (e.preT > 0 || e.st === 'burst') ? 1 : 0;
    },
    charger(e, dt) {
      const dd = e.def.dash;
      e.cd -= dt;
      if (e.st === 'idle') {
        walk(e, P().x, P().y, e.spd, dt);
        if (e.cd <= 0 && dP(e) < 300 && los(e.x, e.y, P().x, P().y)) {
          e.st = 'wind'; e.tm = dd.wind; e.ang = aP(e);
          w.tels.push({ k: 'line', x: e.x, y: e.y - 6, ang: e.ang, len: dd.spd * dd.dur, w: e.r * 2, t: 0, dur: dd.wind, follow: e });
        }
      } else if (e.st === 'wind') {
        e.tm -= dt; e.flip = Math.cos(e.ang) < 0;
        if (e.tm <= 0) { e.st = 'dash'; e.tm = dd.dur; SND.sfx('charge'); }
      } else if (e.st === 'dash') {
        e.tm -= dt;
        const hit = move(e, Math.cos(e.ang) * dd.spd * dt, Math.sin(e.ang) * dd.spd * dt);
        if (Math.random() < 0.5) FX.part(e.x, e.y, { c: [180, 160, 140], vx: (U.R() - 0.5) * 30, vy: -20, life: 0.4, s: 3 });
        if (dd.sparks && (e.sp = (e.sp || 0) - dt) <= 0) { e.sp = 0.09; bullet(e.x, e.y - 10, e.ang + Math.PI / 2, 90, 'ember', e.dmg * 0.7, { life: 1.6 }); bullet(e.x, e.y - 10, e.ang - Math.PI / 2, 90, 'ember', e.dmg * 0.7, { life: 1.6 }); }
        if (hit) { FX.addShake(3); FX.burst(e.x, e.y - 8, 8, { c: [200, 190, 170], sp: 100 }); SND.sfx('thud'); e.st = 'stun'; e.tm = 0.6; e.cd = dd.cd; }
        else if (e.tm <= 0) { e.st = 'idle'; e.cd = dd.cd; }
      } else { e.tm -= dt; if (e.tm <= 0) e.st = 'idle'; }
      e.contactMul = e.st === 'dash' ? 1.35 : 1;
      e.animSpd = e.st === 'dash' ? 3 : e.st === 'wind' ? 0 : 1;
    },
    flyer(e, dt) {
      const f = e.def.fire, p = P();
      e.ang = (e.ang || U.R() * U.TAU) + dt * 0.9;
      const R = 115 + Math.sin(e.t * 1.1) * 75;
      const tx = p.x + Math.cos(e.ang) * R, ty = p.y + Math.sin(e.ang) * R * 0.7;
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
      move(e, dx / d * e.spd * dt * (e.slowT > 0 ? 0.5 : 1), dy / d * e.spd * dt * (e.slowT > 0 ? 0.5 : 1));
      e.flip = p.x < e.x;
      e.cd -= dt;
      if (f && e.cd <= 0) {
        if (!e.preT) e.preT = 0.3;
        e.preT -= dt;
        if (e.preT <= 0) { e.preT = 0; firePattern(e, f); e.cd = f.cd * (0.8 + U.R() * 0.4); }
      }
    },
    tank(e, dt) {
      const sl = e.def.slam;
      e.cd -= dt;
      if (e.st === 'idle') {
        walk(e, P().x, P().y, e.spd, dt);
        if (e.cd <= 0 && dP(e) < sl.r * 0.85) {
          e.st = 'wind'; e.tm = sl.wind;
          const ex = e.x, ey = e.y;
          w.tels.push({ k: 'circle', x: ex, y: ey, r: sl.r, t: 0, dur: sl.wind, fn: () => {
            if (e.dead) return;
            FX.ring(ex, ey, 10, sl.r, 0.3, [230, 210, 160], 4); FX.burst(ex, ey, 16, { c: [200, 180, 140], sp: 140 }); FX.addShake(5); SND.sfx('thud');
            if (U.dist(P().x, P().y, ex, ey) < sl.r + P().r) hurtPlayer(e.dmg * 1.4);
            e.st = 'rest'; e.tm = 0.6; e.cd = sl.cd;
          } });
        }
      } else if (e.st === 'rest') { e.tm -= dt; if (e.tm <= 0) e.st = 'idle'; }
      e.animSpd = e.st === 'idle' ? 1 : 0;
    },
    burrow(e, dt) {
      const p = P();
      e.tm -= dt;
      if (e.st === 'idle') { e.st = 'under'; e.under = true; e.tm = 1.8 + U.R(); }
      if (e.st === 'under') {
        walk(e, p.x, p.y, e.spd, dt);
        if (Math.random() < 0.3) FX.part(e.x + (U.R() - 0.5) * 16, e.y, { c: [220, 190, 130], vy: -30, vx: (U.R() - 0.5) * 30, life: 0.4, s: 2 });
        if (e.tm <= 0 || dP(e) < 26) {
          e.st = 'emerge'; e.tm = 0.65;
          w.tels.push({ k: 'circle', x: e.x, y: e.y, r: 40, t: 0, dur: 0.65 });
        }
      } else if (e.st === 'emerge') {
        if (e.tm <= 0) {
          e.st = 'up'; e.under = false; e.tm = 1.8;
          FX.burst(e.x, e.y, 18, { c: [[220, 190, 130], [190, 160, 100]], sp: 160 }); FX.addShake(3); SND.sfx('thud');
          if (dP(e) < 40 + p.r) hurtPlayer(e.dmg * 1.2);
          const rg = e.def.ring, o = U.R() * U.TAU;
          for (let i = 0; i < rg.n; i++) bullet(e.x, e.y - 14, o + i * U.TAU / rg.n, rg.spd * (1 + w.L.floor * 0.006), rg.b, e.dmg);
        }
      } else if (e.st === 'up') {
        e.flip = p.x < e.x;
        if (e.tm <= 0) { e.st = 'idle'; }
      }
      e.frame = e.st === 'up' ? Math.min(2, Math.floor((1.8 - e.tm) * 10)) : 0;
    },
    shooter(e, dt) {
      const f = e.def.fire, p = P(), d = dP(e), R = e.def.range;
      e.strafe = e.strafe || (U.R() < 0.5 ? 1 : -1);
      if ((e.sw = (e.sw || 2) - dt) <= 0) { e.sw = 1.5 + U.R() * 2; e.strafe *= -1; }
      const a = aP(e);
      let mx = 0, my = 0;
      const seen = los(e.x, e.y - 10, p.x, p.y - 10);
      if (!seen || d > R + 50) { walk(e, p.x, p.y, e.spd, dt); }
      else {
        if (d < R - 50) { mx -= Math.cos(a); my -= Math.sin(a); }
        mx += Math.cos(a + Math.PI / 2) * e.strafe * 0.7; my += Math.sin(a + Math.PI / 2) * e.strafe * 0.7;
        const l = Math.hypot(mx, my) || 1;
        if (move(e, mx / l * e.spd * dt * 0.8, my / l * e.spd * dt * 0.8)) e.strafe *= -1;
      }
      e.flip = p.x < e.x;
      e.cd -= dt;
      if (e.cd <= 0 && seen && d < R + 140) {
        if (!e.preT) e.preT = 0.35;
        e.preT -= dt;
        if (e.preT <= 0) { e.preT = 0; firePattern(e, f); e.cd = f.cd * (0.85 + U.R() * 0.3); }
      }
    },
    lunger(e, dt) {
      const L = e.def.lunge, p = P();
      e.cd -= dt;
      if (e.st === 'idle') {
        walk(e, p.x, p.y, e.spd, dt);
        if (e.cd <= 0 && dP(e) < L.range && los(e.x, e.y, p.x, p.y)) { e.st = 'wind'; e.tm = 0.28; e.ang = aP(e); }
      } else if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'lunge'; e.tm = L.dur; SND.sfx('growl'); } }
      else if (e.st === 'lunge') {
        e.tm -= dt; e.flip = Math.cos(e.ang) < 0;
        if (move(e, Math.cos(e.ang) * L.spd * dt, Math.sin(e.ang) * L.spd * dt) || e.tm <= 0) { e.st = 'idle'; e.cd = L.cd * (0.8 + U.R() * 0.4); }
      }
      e.contactMul = e.st === 'lunge' ? 1.3 : 1;
      e.animSpd = e.st === 'lunge' ? 2.5 : e.st === 'wind' ? 0 : 1.6;
    },
    orbiter(e, dt) {
      const f = e.def.fire, p = P();
      e.dirO = e.dirO || (U.R() < 0.5 ? 1 : -1);
      e.ang = (e.ang ?? aP(e) + Math.PI) + dt * 0.7 * e.dirO;
      const R = 170;
      const tx = p.x + Math.cos(e.ang) * R, ty = p.y + Math.sin(e.ang) * R * 0.75;
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
      if (move(e, dx / d * e.spd * dt * (e.slowT > 0 ? 0.5 : 1), dy / d * e.spd * dt * (e.slowT > 0 ? 0.5 : 1))) e.dirO *= -1;
      AI.turret(e, dt);
    },
    thrower(e, dt) {
      const f = e.def.fire, p = P();
      e.cd -= dt;
      if (dP(e) > 200) walk(e, p.x, p.y, e.spd, dt);
      e.flip = p.x < e.x;
      if (e.cd <= 0 && dP(e) < 420) {
        e.cd = f.cd * (0.85 + U.R() * 0.3);
        const tx = p.x + p.vx * 0.5, ty = p.y + p.vy * 0.5;
        lob(e.x, e.y - e.h * 0.6, tx, ty, 0.95, 34, e.dmg * 1.2, f.b, f.split);
        e.frame = 1; e.preT = 0.3;
      }
      if (e.preT > 0) e.preT -= dt; else e.frame = 0;
      e.animSpd = 0;
    },
    swoop(e, dt) {
      const p = P();
      e.tm -= dt;
      if (e.st === 'idle') {
        e.ang = (e.ang || U.R() * U.TAU) + dt * 1.6;
        const tx = p.x + Math.cos(e.ang) * 140, ty = p.y - 40 + Math.sin(e.ang * 1.3) * 70;
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
        move(e, dx / d * e.spd * dt, dy / d * e.spd * dt);
        e.flip = p.x < e.x;
        if (e.tm <= 0) { e.st = 'wind'; e.tm = 0.35; e.dA = aP(e); }
      } else if (e.st === 'wind') { if (e.tm <= 0) { e.st = 'dive'; e.tm = 0.45; SND.sfx('screech'); } }
      else if (e.st === 'dive') {
        move(e, Math.cos(e.dA) * 380 * dt, Math.sin(e.dA) * 380 * dt);
        if (e.tm <= 0) { e.st = 'idle'; e.tm = 1.4 + U.R() * 1.2; }
      }
      e.contactMul = e.st === 'dive' ? 1.3 : 1;
    },
    exploder(e, dt) {
      const p = P();
      if (e.st === 'idle') {
        walk(e, p.x, p.y, e.spd, dt);
        if (dP(e) < 48) { e.st = 'fuse'; e.tm = e.def.boom.fuse; SND.sfx('fuse'); }
      } else {
        e.tm -= dt;
        move(e, Math.cos(aP(e)) * 20 * dt, Math.sin(aP(e)) * 20 * dt);
        if (e.tm <= 0) { e.dead = true; explode(e, true); w.kills++; w.run.kills = (w.run.kills || 0) + 1; dropCoins(e.x, e.y, 2); }
      }
      e.fuse = e.st === 'fuse';
      e.animSpd = e.st === 'fuse' ? 3 : 1.4;
    },
    laser(e, dt) {
      const b = e.def.beam, p = P();
      e.cd -= dt;
      if (e.st === 'idle') {
        const d = dP(e), a = aP(e);
        let mx = 0, my = 0;
        if (d > 260) { mx = Math.cos(a); my = Math.sin(a); } else if (d < 160) { mx = -Math.cos(a); my = -Math.sin(a); }
        mx += Math.cos(e.t * 0.7) * 0.5; my += Math.sin(e.t * 0.9) * 0.5;
        move(e, mx * e.spd * dt, my * e.spd * dt);
        if (e.cd <= 0 && los(e.x, e.y - 20, p.x, p.y - 10)) {
          e.st = 'beam'; e.tm = b.warm + b.dur;
          const bm = { x: e.x, y: e.y - e.h * 0.4 - e.fly, ang: Math.atan2(p.y - 12 - (e.y - e.h * 0.4 - e.fly), p.x - e.x), len: 900, w: b.w, warm: b.warm, dur: b.dur, t: 0, src: e, track: 1.6, dmg: e.dmg * 1.2, c: [200, 120, 255] };
          w.beams.push(bm); SND.sfx('charge');
        }
      } else { e.tm -= dt; if (e.tm <= 0) { e.st = 'idle'; e.cd = b.cd * (0.85 + U.R() * 0.3); } }
      e.flip = p.x < e.x;
      e.frame = e.st === 'beam' ? 0 : null;
    },
    blinker(e, dt) {
      const bl = e.def.blink, p = P();
      e.cd -= dt; e.tm -= dt;
      if (e.st === 'idle') {
        walk(e, p.x, p.y, e.spd, dt);
        if (e.cd <= 0 && dP(e) < 360) { e.st = 'out'; e.tm = 0.3; e.gone = false; FX.burst(e.x, e.y - 20, 14, { c: [[120, 80, 200], [40, 20, 80]], sp: 80, life: 0.4 }); SND.sfx('blink'); }
      } else if (e.st === 'out') {
        if (e.tm <= 0) {
          e.gone = true; e.st = 'hidden'; e.tm = 0.35;
        }
      } else if (e.st === 'hidden') {
        if (e.tm <= 0) {
          for (let k = 0; k < 12; k++) {
            const a = U.R() * U.TAU, r = 60 + U.R() * 20, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
            if (!blocked(x, y, e.r, false, false)) { e.x = x; e.y = y; break; }
          }
          e.gone = false; e.st = 'wind'; e.tm = bl.wind; e.ang = aP(e);
          FX.burst(e.x, e.y - 20, 14, { c: [[160, 120, 255], [60, 30, 120]], sp: 80, life: 0.4 });
          w.tels.push({ k: 'cone', x: e.x, y: e.y - 8, ang: e.ang, r: 78, arc: 1.9, t: 0, dur: bl.wind, follow: e, fn: () => {
            if (e.dead) return;
            FX.slash(e.x, e.y - 18, e.ang, 76, 1.9, [180, 120, 255], 0.2, 12); SND.sfx('slash2');
            const dx = p.x - e.x, dy = p.y - e.y;
            if (Math.hypot(dx, dy) < 78 + p.r && Math.abs(U.angDiff(e.ang, Math.atan2(dy, dx))) < 0.95) hurtPlayer(e.dmg * 1.3);
          } });
        }
      } else if (e.st === 'wind') { if (e.tm <= 0) { e.st = 'idle'; e.cd = bl.cd * (0.8 + U.R() * 0.4); } }
      e.flip = p.x < e.x;
      e.alpha = e.st === 'out' ? Math.max(0, e.tm / 0.3) : e.st === 'hidden' ? 0 : 1;
    }
  };
  function explode(e, hurt) {
    const r = e.def.boom.r;
    FX.ring(e.x, e.y - 8, 6, r, 0.35, [255, 170, 60], 5);
    FX.burst(e.x, e.y - 8, 26, { c: [[255, 220, 120], [255, 120, 40], [80, 60, 60]], sp: 220, life: 0.5, glow: true, s: 3 });
    FX.addShake(6); SND.sfx('boom');
    if (hurt && U.dist(P().x, P().y, e.x, e.y) < r + P().r) hurtPlayer(e.dmg);
    for (const o of w.enemies) if (o !== e && hittable(o) && !o.boss && U.dist2(o.x, o.y, e.x, e.y) < r * r) dmgEnemy(o, e.maxHp * 0.6, { src: 'boom' });
  }
  /* 포물선으로 던지는 탄: 떨어질 자리에 예고 */
  function lob(x, y, tx, ty, dur, r, dmg, kind, split, o = {}) {
    w.lobs.push({ x0: x, y0: y, tx, ty, t: 0, dur, r, dmg, kind, split, h: o.h || 90, big: o.big });
    w.tels.push({ k: 'circle', x: tx, y: ty, r, t: 0, dur });
  }

  function updateEnemies(dt) {
    const p = P();
    const warp = w.warpT > 0 ? 0.45 : 1;
    for (const e of w.enemies) {
      if (e.dead) continue;
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      const edt = dt * warp * (e.slowT > 0 ? 0.6 : 1);
      e.t += edt * (e.animSpd ?? 1);
      if (e.flashT > 0) e.flashT -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      if (e.burnT > 0) { e.burnT -= dt; e.burnTick = (e.burnTick || 0) - dt; if (e.burnTick <= 0) { e.burnTick = 0.5; dmgEnemy(e, e.burnDps * 0.5, { src: 'dot' }); FX.burst(e.x, e.y - e.h * 0.5, 3, { c: [[255, 160, 60], [255, 90, 30]], sp: 40, vy: -40, life: 0.4, glow: true }); if (e.dead) continue; } }
      if (e.poisonT > 0) { e.poisonT -= dt; e.poisonTick = (e.poisonTick || 0) - dt; if (e.poisonTick <= 0) { e.poisonTick = 0.5; dmgEnemy(e, e.poisonDps * e.poisonN * 0.5, { src: 'dot' }); if (e.dead) continue; } } else e.poisonN = 0;
      if (e.boss) BOSSAI.update(e, edt, w);
      else AI[e.def.ai](e, edt);
      // 밀려남
      if (e.kvx || e.kvy) {
        move(e, e.kvx * dt, e.kvy * dt);
        e.kvx *= Math.pow(0.0008, dt); e.kvy *= Math.pow(0.0008, dt);
        if (Math.abs(e.kvx) < 2 && Math.abs(e.kvy) < 2) e.kvx = e.kvy = 0;
      }
      // 몸통 박치기
      if (!e.under && !e.gone && p.alive && p.fallT <= 0) {
        const rr = e.r * (e.boss ? 0.8 : 0.85) + p.r * 0.7;
        if (U.dist2(e.x, e.y, p.x, p.y) < rr * rr) {
          if (hurtPlayer(e.dmg * (e.contactMul || 1)) && p.st.thorns) dmgEnemy(e, attackDamage(p) * p.st.thorns, { src: 'proc' });
        }
      }
    }
    // 서로 밀어내기
    const es = w.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i]; if (a.dead || a.spawnT > 0 || a.under || a.gone) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j]; if (b.dead || b.spawnT > 0 || b.under || b.gone || (!!a.fly !== !!b.fly)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = (a.r + b.r) * 0.9, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (rr - d) * 0.5, ux = dx / d, uy = dy / d;
        const wa = a.boss ? 0 : a.heavy && !b.heavy ? 0.25 : b.heavy && !a.heavy ? 1.75 : 1, wb = b.boss ? 0 : 2 - wa;
        if (!a.boss) move(a, -ux * push * wa, -uy * push * wa);
        if (!b.boss) move(b, ux * push * wb, uy * push * wb);
      }
    }
    for (let i = es.length - 1; i >= 0; i--) if (es[i].dead) es.splice(i, 1);
  }

  /* ───────── 탄·예고·장판·광선·줍기 ───────── */
  function updateShots(dt) {
    const p = P();
    const warp = w.warpT > 0 ? 0.4 : 1;
    // 주인공 탄
    for (const b of w.pb) {
      b.life -= dt;
      if (b.homing) {
        const e = nearestEnemy(b.x, b.y, 240);
        if (e) {
          const ta = Math.atan2(e.y - e.h * 0.4 - (e.fly || 0) - b.y, e.x - b.x), ca = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
          const na = ca + U.clamp(U.angDiff(ca, ta), -b.homing * dt, b.homing * dt);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.ang = Math.atan2(b.vy, b.vx);
      const v = cellAt(b.x, b.y + 12);
      if (v === 1 || v === 4) {
        if (b.kind === 'orb') splash(b);
        b.life = 0; FX.burst(b.x, b.y, 4, { c: [220, 220, 230], sp: 60, life: 0.2 });
        continue;
      }
      if (b.kind === 'orb' && Math.random() < 0.6) FX.part(b.x, b.y, { c: [190, 140, 255], life: 0.3, s: 2, glow: true });
      for (const e of w.enemies) {
        if (!hittable(e) || b.hit.has(e)) continue;
        const ey = e.y - e.h * 0.4 - (e.fly || 0);
        if (U.dist2(b.x, b.y, e.x, ey) > (b.r + e.r + 2) ** 2) continue;
        b.hit.add(e);
        const [d, c] = rollCrit(p, b.dmg);
        dmgEnemy(e, d, { crit: c, src: 'atk', kx: b.vx, ky: b.vy, knock: b.kind === 'arrow' ? 60 : 90 });
        if (b.kind === 'orb' && b.pierce <= 0) { splash(b, e); b.life = 0; break; }
        if (b.pierce-- <= 0) { b.life = 0; break; }
      }
    }
    for (let i = w.pb.length - 1; i >= 0; i--) if (w.pb[i].life <= 0) w.pb.splice(i, 1);
    // 적 탄
    for (const b of w.eb) {
      if (b.delay > 0) { b.delay -= dt; continue; }
      const bdt = dt * warp;
      b.t += bdt; b.life -= bdt;
      if (b.acc) { const sp = Math.min(b.maxSpd, Math.hypot(b.vx, b.vy) + b.acc * bdt), a = Math.atan2(b.vy, b.vx); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; }
      if (b.curve) { const a = Math.atan2(b.vy, b.vx) + b.curve * bdt, sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; }
      if (b.turn && b.t < 2) { const ta = Math.atan2(p.y - 12 - b.y, p.x - b.x), ca = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy); const na = ca + U.clamp(U.angDiff(ca, ta), -b.turn * bdt, b.turn * bdt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
      b.x += b.vx * bdt; b.y += b.vy * bdt; b.ang = Math.atan2(b.vy, b.vx);
      const v = cellAt(b.x, b.y + 10);
      if (v === 1 || v === 4) {
        if (b.bounce > 0) { b.bounce--; const vx = cellAt(b.x - b.vx * bdt, b.y + 10); if (vx === 1 || vx === 4) b.vy = -b.vy; else b.vx = -b.vx; b.x -= b.vx * bdt * 2; b.y -= b.vy * bdt * 2; }
        else { b.life = 0; FX.burst(b.x, b.y, 3, { c: [200, 180, 200], sp: 50, life: 0.2 }); continue; }
      }
      if (p.alive && p.fallT <= 0 && U.dist2(b.x, b.y, p.x, p.y - 12) < (b.r + 5) ** 2) {
        if (hurtPlayer(b.dmg, { bullet: true, b })) b.life = 0;
        else if (p.st.mirror && b.life > 0 && p.iT > 0.25 && p.iT < 0.31) b.life = 0;
      }
    }
    for (let i = w.eb.length - 1; i >= 0; i--) if (w.eb[i].life <= 0) w.eb.splice(i, 1);
    if (w.eb.length > 700) w.eb.splice(0, w.eb.length - 700);
    // 던진 탄
    for (const l of w.lobs) {
      l.t += dt * warp;
      if (l.t >= l.dur) {
        l.done = true;
        FX.burst(l.tx, l.ty, 14, { c: l.kind === 'snow' ? [[240, 248, 255], [180, 210, 240]] : [[255, 160, 60], [120, 60, 40]], sp: 150 }); FX.addShake(3); SND.sfx('thud');
        if (U.dist(p.x, p.y, l.tx, l.ty) < l.r + p.r) hurtPlayer(l.dmg);
        if (l.split) { const o = U.R() * U.TAU; for (let i = 0; i < l.split; i++) bullet(l.tx, l.ty - 6, o + i * U.TAU / l.split, 150, l.kind === 'snow' ? 'ice' : 'ember', l.dmg * 0.7); }
        if (l.zone) w.zones.push({ x: l.tx, y: l.ty, r: l.r, t: 0, dur: l.zone, dps: l.dmg * 0.4, owner: 'e', kind: 'fire', tick: 0 });
      }
    }
    w.lobs = w.lobs.filter(l => !l.done);
    // 예고
    for (const t of w.tels) {
      t.t += dt * (t.friendly ? 1 : warp);
      if (t.follow && !t.follow.dead) { t.x = t.follow.x; t.y = t.follow.y - 6; }
      if (t.t >= t.dur) { t.done = true; if (t.fn) t.fn(); }
    }
    w.tels = w.tels.filter(t => !t.done);
    // 장판
    for (const z of w.zones) {
      z.t += dt;
      if (z.t >= z.dur) { z.done = true; continue; }
      if (Math.random() < 0.3) FX.part(z.x + (U.R() - 0.5) * z.r * 1.4, z.y + (U.R() - 0.5) * z.r * 0.8, { c: z.kind === 'poison' ? [170, 230, 90] : z.kind === 'ice' ? [180, 230, 255] : [255, 140, 50], vy: -30, life: 0.5, s: 2, glow: z.kind === 'fire' });
      if (z.owner === 'p') {
        z.tick -= dt;
        if (z.tick <= 0) { z.tick = 0.33; for (const e of w.enemies) if (hittable(e) && U.dist2(e.x, e.y, z.x, z.y) < (z.r + e.r) ** 2) dmgEnemy(e, z.dps * 0.33, { src: 'dot' }); }
      } else if (p.alive && U.dist2(p.x, p.y, z.x, z.y) < (z.r * 0.85) ** 2) {
        hurtPlayer(z.dps * (z.kind === 'fire' ? 1 - p.st.fireRes : 1) * 0.6, { soft: true });
      }
    }
    w.zones = w.zones.filter(z => !z.done);
    // 광선
    for (const b of w.beams) {
      b.t += dt * warp;
      if (b.src) { if (b.src.dead) { b.done = true; continue; } b.x = b.src.x + (b.ox || 0); b.y = b.src.y - b.src.h * 0.4 - (b.src.fly || 0) + (b.oy || 0); }
      if (b.track && b.t < b.warm * 0.7) { const ta = Math.atan2(p.y - 12 - b.y, p.x - b.x); b.ang += U.clamp(U.angDiff(b.ang, ta), -b.track * dt, b.track * dt); }
      if (b.rot) b.ang += b.rot * dt * warp;
      // 벽까지 길이
      let len = 0; const step = 8;
      while (len < b.len) { const x = b.x + Math.cos(b.ang) * len, y = b.y + Math.sin(b.ang) * len; const v = cellAt(x, y + 10); if (v === 1 || v === 4) break; len += step; }
      b.cur = len;
      if (b.t > b.warm && b.t < b.warm + b.dur) {
        const px = p.x - b.x, py = (p.y - 12) - b.y, along = px * Math.cos(b.ang) + py * Math.sin(b.ang), perp = Math.abs(-px * Math.sin(b.ang) + py * Math.cos(b.ang));
        if (along > 0 && along < len && perp < b.w / 2 + 4) hurtPlayer(b.dmg);
        if (Math.random() < 0.8) FX.part(b.x + Math.cos(b.ang) * len, b.y + Math.sin(b.ang) * len, { c: b.c, vx: (U.R() - 0.5) * 120, vy: (U.R() - 0.5) * 120, life: 0.3, s: 2, glow: true });
      }
      if (b.t >= b.warm + b.dur) b.done = true;
    }
    w.beams = w.beams.filter(b => !b.done);
    // 줍는 것
    const mag = 80 * p.st.magnet * (w.cleared ? 20 : 1);
    for (const k of w.picks) {
      k.t += dt;
      if (k.vz || k.z > 0) { k.z += k.vz * dt; k.vz -= 420 * dt; if (k.z <= 0) { k.z = 0; k.vz = Math.abs(k.vz) > 60 ? -k.vz * 0.4 : 0; } }
      const d = U.dist(k.x, k.y, p.x, p.y);
      if (d < mag && k.t > 0.35) { const s = Math.min(900, 200 + (mag - d) * 6 + k.t * 200); k.vx = (p.x - k.x) / d * s; k.vy = (p.y - k.y) / d * s; }
      else { k.vx *= Math.pow(0.02, dt); k.vy *= Math.pow(0.02, dt); }
      const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt;
      if (d < mag || !blocked(nx, ny, 3, true)) { k.x = nx; k.y = ny; }
      if (d < 14 && k.t > 0.3) {
        k.done = true;
        if (k.k === 'coin') { const v = Math.round(k.v * p.st.goldMul); w.run.gold += v; w.run.goldGot = (w.run.goldGot || 0) + v; SND.sfx('coin'); FX.part(k.x, k.y - 6, { c: [255, 220, 90], life: 0.25, s: 3, glow: true }); }
        else if (k.k === 'heart') { p.heal(Math.round(p.st.maxHp * 0.12)); SND.sfx('heal'); }
      }
    }
    w.picks = w.picks.filter(k => !k.done);
    // 미뤄 둔 일
    for (const s of w.sched) { s.t -= dt; if (s.t <= 0) { s.done = true; s.fn(); } }
    w.sched = w.sched.filter(s => !s.done);
    if (w.warpT > 0) w.warpT -= dt;
  }
  function splash(b, skip) {
    const p = P(), R = b.splash;
    FX.ring(b.x, b.y, 4, R, 0.25, [200, 150, 255], 3);
    FX.burst(b.x, b.y, 10, { c: [[220, 180, 255], [160, 100, 255]], sp: 140, life: 0.3, glow: true });
    for (const e of w.enemies) if (e !== skip && hittable(e) && U.dist2(e.x, e.y - e.h * 0.4, b.x, b.y) < (R + e.r) ** 2) dmgEnemy(e, b.dmg * 0.6, { src: 'atk' });
  }

  return {
    newWorld, get w() { return w; }, cellAt, blocked, move, los, updateFlow, steer, randomOpen, stats, makePlayer, updatePlayer,
    hurtPlayer, dmgEnemy, killEnemy, spawnEnemy, bullet, firePattern, walk, lob, updateEnemies, updateShots, nearestEnemy, hittable,
    clearBullets, attackDamage, dropCoins, explode, AI, T
  };
})();
