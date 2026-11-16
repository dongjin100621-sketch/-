'use strict';
/* 보스 10종의 행동. 보스마다 「무늬(패턴)」 몇 가지를 차례로 쓰고, 체력이 줄면 다음 페이즈로 넘어가 무늬가 바뀐다.
   페이즈 경계에서는 한 번에 깎이지 않고(넘치는 피해는 사라짐) 잠깐 무적이 되며 탄환이 모두 지워진다. */

const BOSSAI = (() => {
  const E = () => ENT;
  const W = () => ENT.w;
  const P = () => ENT.w.player;

  /* ── 시간표 도우미 ── */
  const at = (C, tt) => C.prev < tt && C.t >= tt;
  const every = (C, iv, from = 0, to = 1e9) => {
    if (C.t < from || C.prev > to) return 0;
    const a = Math.floor((Math.max(C.prev, from) - from) / iv), b = Math.floor((Math.min(C.t, to) - from) / iv);
    return C.prev < from && C.t >= from ? b - a + 1 : b - a;
  };
  const mouth = (e) => [e.x, e.y - e.h * 0.5 - (e.fly || 0)];
  const aimA = (x, y) => Math.atan2(P().y - 12 - y, P().x - x);
  const spdK = () => 1 + W().L.floor * 0.004;
  function ring(e, n, spd, kind, off = 0, o = {}) {
    const [x, y] = o.at || mouth(e);
    for (let i = 0; i < n; i++) E().bullet(x, y, off + i * U.TAU / n, spd * spdK(), kind, e.dmg * (o.mul || 1), o);
    SND.sfx('eshoot');
  }
  function fan(e, n, spread, spd, kind, o = {}) {
    const [x, y] = o.at || mouth(e), a = o.a ?? aimA(x, y);
    for (let i = 0; i < n; i++) E().bullet(x, y, a + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), spd * spdK(), kind, e.dmg * (o.mul || 1), o);
    SND.sfx('eshoot');
  }
  function summon(e, ids, max = 6) {
    const alive = W().enemies.filter(m => !m.boss && !m.dead).length;
    let n = 0;
    for (const id of ids) {
      if (alive + n >= max) break;
      const [x, y] = E().randomOpen(120);
      const m = E().spawnEnemy(id, x, y); m.minion = true; n++;
    }
    if (n) SND.sfx('summon');
  }
  function circleTel(x, y, r, dur, fn) { W().tels.push({ k: 'circle', x, y, r, t: 0, dur, fn }); }
  function lineTel(x, y, ang, len, w, dur, fn, follow) { W().tels.push({ k: 'line', x, y, ang, len, w, t: 0, dur, fn, follow }); }
  function hitCircle(x, y, r, dmg) { const p = P(); if (U.dist(p.x, p.y, x, y) < r + p.r) E().hurtPlayer(dmg); }
  function hitLine(x, y, ang, len, w, dmg) {
    const p = P(), px = p.x - x, py = p.y - 6 - y;
    const al = px * Math.cos(ang) + py * Math.sin(ang), pe = Math.abs(-px * Math.sin(ang) + py * Math.cos(ang));
    if (al > -10 && al < len && pe < w / 2 + p.r * 0.6) E().hurtPlayer(dmg);
  }
  function slamFx(x, y, r, c = [230, 210, 170]) {
    FX.ring(x, y, 10, r, 0.35, c, 5); FX.burst(x, y, 20, { c: [c, [120, 100, 90]], sp: 180, life: 0.5 });
    FX.addShake(7); SND.sfx('thud');
  }
  function beam(e, ang, o = {}) {
    W().beams.push({ x: e.x, y: e.y, ang, len: 1200, w: o.w || 16, warm: o.warm ?? 1, dur: o.dur ?? 2, t: 0, src: e, rot: o.rot || 0, track: o.track || 0, dmg: e.dmg * (o.mul || 1.2), c: o.c || [255, 120, 80], ox: o.ox || 0, oy: o.oy || 0 });
  }
  function walkTo(e, tx, ty, spd, dt) { return E().walk(e, tx, ty, spd, dt); }
  function teleport(e, x, y) {
    FX.burst(e.x, e.y - e.h * 0.5, 24, { c: [[200, 160, 255], [120, 80, 200]], sp: 160, life: 0.5 });
    e.x = x; e.y = y;
    FX.burst(e.x, e.y - e.h * 0.5, 24, { c: [[200, 160, 255], [120, 80, 200]], sp: 160, life: 0.5 });
    SND.sfx('blink');
  }
  const center = () => { const L = W().L; return [L.w * 16, L.h * 16 - 20]; };
  function randomSpot(minD = 150) { return E().randomOpen(minD); }
  function lobRain(e, n, r, spread, dur, kind, zone, interval) {
    const p = P();
    for (let i = 0; i < n; i++) {
      W().sched.push({ t: i * interval, fn: () => {
        if (e.dead) return;
        const tx = p.x + (U.R() - 0.5) * spread, ty = p.y + (U.R() - 0.5) * spread * 0.7;
        if (E().cellAt(tx, ty) === 1) return;
        E().lob(e.x, e.y - e.h * 0.8, tx, ty, dur, r, e.dmg * 1.1, kind, 0);
        const l = W().lobs[W().lobs.length - 1]; l.h = 260; l.zone = zone;
      } });
    }
  }

  /* ───────── 보스별 무늬 ───────── */
  const S = {
    sporeking: {
      seq: [['ring', 'jump', 'ring', 'summon', 'jump'], ['ring2', 'jump', 'cloud', 'jump', 'ring2', 'summon']],
      idle(e, dt) { walkTo(e, P().x, P().y, e.spd, dt); },
      pat: {
        ring(e, C) { for (let k = 0; k < 3; k++) if (at(C, 0.3 + k * 0.45)) ring(e, 14, 120, 'spore', k * 0.22); return C.t > 1.7; },
        ring2(e, C) { for (let k = 0; k < 4; k++) if (at(C, 0.3 + k * 0.35)) ring(e, 18, 140, 'spore', k * 0.17); if (at(C, 1.2)) fan(e, 5, 0.6, 180, 'poison'); return C.t > 1.9; },
        jump(e, C) {
          if (at(C, 0.01)) { e.under = true; e.air = 1; C.d.tx = P().x; C.d.ty = P().y; circleTel(C.d.tx, C.d.ty, 74, 1.0); SND.sfx('jump'); }
          if (C.t < 1.0) { const k = C.t / 1.0; e.x += (C.d.tx - e.x) * Math.min(1, k * 0.15 + 0.04); e.y += (C.d.ty - e.y) * Math.min(1, k * 0.15 + 0.04); e.air = Math.sin(k * Math.PI) * 120 + 1; }
          if (at(C, 1.0)) { e.x = C.d.tx; e.y = C.d.ty; e.air = 0; e.under = false; slamFx(e.x, e.y, 74); hitCircle(e.x, e.y, 74, e.dmg * 1.4); ring(e, 16, 130, 'spore', U.R(), { at: [e.x, e.y - 10] }); }
          return C.t > 1.6;
        },
        summon(e, C) { if (at(C, 0.3)) summon(e, ['shroom', 'slime', 'slime'], 6); return C.t > 0.9; },
        cloud(e, C) {
          for (let k = 0; k < 4; k++) if (at(C, 0.2 + k * 0.25)) { const [x, y] = [P().x + (U.R() - 0.5) * 220, P().y + (U.R() - 0.5) * 160]; E().lob(e.x, e.y - 60, x, y, 0.8, 44, e.dmg, 'spore', 0); const l = W().lobs[W().lobs.length - 1]; l.zone = 4; }
          return C.t > 1.6;
        }
      }
    },
    treant: {
      seq: [['roots', 'leaf', 'roots', 'sapling'], ['rootring', 'leaf2', 'roots', 'rootring', 'sapling']],
      idle() {},
      pat: {
        roots(e, C) {
          if (at(C, 0.05)) { C.d.a = aimA(e.x, e.y); SND.sfx('rumble'); }
          for (let l = -1; l <= 1; l++) {
            const a = (C.d.a ?? 0) + l * 0.38;
            for (let i = 1; i <= 14; i++) if (at(C, 0.05 + i * 0.05)) {
              const x = e.x + Math.cos(a) * (30 + i * 34), y = e.y + Math.sin(a) * (30 + i * 34);
              if (E().cellAt(x, y) !== 1) circleTel(x, y, 22, 0.7, () => { FX.burst(x, y, 8, { c: [[110, 80, 50], [80, 140, 60]], sp: 120, vz: 100 }); hitCircle(x, y, 22, e.dmg); });
            }
          }
          return C.t > 1.8;
        },
        leaf(e, C) { const n = every(C, 0.1, 0.2, 2.6); for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.31; for (let k = 0; k < 2; k++) E().bullet(e.x, e.y - 60, C.d.s + k * Math.PI, 130 * spdK(), 'leaf', e.dmg); } return C.t > 3; },
        leaf2(e, C) { const n = every(C, 0.09, 0.2, 2.8); for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.27; for (let k = 0; k < 3; k++) E().bullet(e.x, e.y - 60, C.d.s + k * U.TAU / 3, 140 * spdK(), 'leaf', e.dmg); } if (at(C, 1.5)) fan(e, 7, 0.9, 170, 'red'); return C.t > 3.2; },
        rootring(e, C) {
          if (at(C, 0.05)) { C.d.x = P().x; C.d.y = P().y; SND.sfx('rumble'); }
          if (at(C, 0.1)) for (let i = 0; i < 9; i++) { const a = i * U.TAU / 9, x = C.d.x + Math.cos(a) * 92, y = C.d.y + Math.sin(a) * 92; circleTel(x, y, 30, 0.9, () => { FX.burst(x, y, 10, { c: [[110, 80, 50], [80, 140, 60]], sp: 140, vz: 120 }); hitCircle(x, y, 30, e.dmg * 1.2); }); }
          if (at(C, 0.55)) circleTel(C.d.x, C.d.y, 40, 0.9, () => { FX.burst(C.d.x, C.d.y, 12, { c: [[110, 80, 50]], sp: 140, vz: 120 }); hitCircle(C.d.x, C.d.y, 40, e.dmg * 1.2); });
          return C.t > 1.8;
        },
        sapling(e, C) { if (at(C, 0.3)) summon(e, e.phase > 1 ? ['boar', 'wasp', 'slime'] : ['slime', 'slime', 'wasp'], 6); return C.t > 1; }
      }
    },
    scorpionlord: {
      seq: [['charge', 'tail', 'pincer', 'burrow'], ['charge', 'burrow', 'tail', 'pincer', 'charge', 'burrow']],
      idle(e, dt) { walkTo(e, P().x, P().y, e.spd, dt); },
      pat: {
        charge(e, C, dt) {
          const N = 3;
          C.d.k = C.d.k || 0;
          const base = C.d.k * 1.0;
          if (at(C, base + 0.01)) { C.d.a = aimA(e.x, e.y); lineTel(e.x, e.y, C.d.a, 380, 50, 0.55, null, e); }
          if (C.t > base + 0.55 && C.t < base + 0.95) {
            if (E().move(e, Math.cos(C.d.a) * 560 * dt, Math.sin(C.d.a) * 560 * dt)) { if (!C.d.hit) { C.d.hit = 1; slamFx(e.x, e.y, 40); } }
            e.contactMul = 1.4;
            if (e.phase > 1 && every(C, 0.07, base + 0.55, base + 0.95)) { E().bullet(e.x, e.y - 20, C.d.a + Math.PI / 2, 80, 'sand', e.dmg * 0.8); E().bullet(e.x, e.y - 20, C.d.a - Math.PI / 2, 80, 'sand', e.dmg * 0.8); }
          }
          if (C.t > base + 1.0) { C.d.k++; C.d.hit = 0; e.contactMul = 1; if (C.d.k >= N) return true; }
          return false;
        },
        tail(e, C) {
          if (at(C, 0.05)) { C.d.x = P().x; C.d.y = P().y; circleTel(C.d.x, C.d.y, 62, 0.75, () => { slamFx(C.d.x, C.d.y, 62, [200, 120, 220]); hitCircle(C.d.x, C.d.y, 62, e.dmg * 1.3); ring(e, 12, 150, 'poison', U.R(), { at: [C.d.x, C.d.y - 6] }); }); }
          if (e.phase > 1 && at(C, 0.6)) { const x = P().x, y = P().y; circleTel(x, y, 62, 0.75, () => { slamFx(x, y, 62, [200, 120, 220]); hitCircle(x, y, 62, e.dmg * 1.3); ring(e, 12, 150, 'poison', U.R(), { at: [x, y - 6] }); }); }
          return C.t > 1.6;
        },
        pincer(e, C) { for (let k = 0; k < 3; k++) if (at(C, 0.2 + k * 0.35)) fan(e, 5 + e.phase, 0.7, 210, 'red'); return C.t > 1.4; },
        burrow(e, C, dt) {
          if (at(C, 0.01)) { e.under = true; FX.burst(e.x, e.y, 20, { c: [[220, 190, 130]], sp: 150 }); SND.sfx('dig'); }
          if (C.t < 2.0) { walkTo(e, P().x, P().y, 150, dt); if (Math.random() < 0.6) FX.part(e.x + (U.R() - 0.5) * 50, e.y, { c: [220, 190, 130], vy: -40, life: 0.5, s: 3 }); }
          if (at(C, 2.0)) circleTel(e.x, e.y, 84, 0.7, () => { e.under = false; slamFx(e.x, e.y, 84); hitCircle(e.x, e.y, 84, e.dmg * 1.4); ring(e, 20, 140, 'sand', 0); if (e.phase > 1) W().sched.push({ t: 0.3, fn: () => !e.dead && ring(e, 20, 110, 'sand', 0.16) }); });
          return C.t > 3.0;
        }
      }
    },
    pharaoh: {
      seq: [['beams', 'orbs', 'summon', 'fans'], ['beams2', 'storm', 'orbs', 'beams2', 'summon']],
      idle(e, dt) { e.wt = (e.wt || 0) - dt; if (e.wt <= 0 || !e.goal) { e.wt = 2.5; e.goal = randomSpot(160); } const [gx, gy] = e.goal; const d = U.dist(e.x, e.y, gx, gy); if (d > 6) E().move(e, (gx - e.x) / d * e.spd * dt, (gy - e.y) / d * e.spd * dt, true); },
      pat: {
        beams(e, C) { if (at(C, 0.05)) { const o = U.R() * U.TAU; for (let i = 0; i < 4; i++) beam(e, o + i * Math.PI / 2, { rot: 0.55 * (U.R() < 0.5 ? 1 : -1) * (i ? 1 : 1), warm: 1.1, dur: 3, c: [255, 200, 90], w: 18 }); SND.sfx('charge'); } return C.t > 4.4; },
        beams2(e, C) {
          if (at(C, 0.05)) { const o = U.R() * U.TAU, r = U.R() < 0.5 ? 1 : -1; for (let i = 0; i < 6; i++) beam(e, o + i * Math.PI / 3, { rot: 0.5 * r, warm: 1.1, dur: 3.4, c: [255, 200, 90], w: 16 }); SND.sfx('charge'); }
          for (let k = 0; k < 3; k++) if (at(C, 1.4 + k * 0.9)) fan(e, 3, 0.4, 160, 'sun');
          return C.t > 4.8;
        },
        orbs(e, C) { for (let k = 0; k < 3; k++) if (at(C, 0.2 + k * 0.4)) { const [x, y] = mouth(e); E().bullet(x, y, aimA(x, y) + (k - 1) * 0.5, 100, 'sun', e.dmg * 1.2, { turn: 1.1, life: 6.5, r: 9 }); SND.sfx('eshoot'); } return C.t > 1.6; },
        summon(e, C) { if (at(C, 0.3)) summon(e, e.phase > 1 ? ['mummy', 'skeleton', 'skeleton'] : ['mummy', 'skeleton'], 5); return C.t > 1; },
        fans(e, C) { for (let k = 0; k < 4; k++) if (at(C, 0.2 + k * 0.3)) fan(e, 7, 1.1, 170, 'sand', { a: aimA(...mouth(e)) + (k % 2 ? 0.08 : -0.08) }); return C.t > 1.6; },
        storm(e, C) {
          const n = every(C, 0.12, 0.2, 3.2);
          for (let i = 0; i < n; i++) { const p = P(), L = W().L, side = U.R() < 0.5, y = p.y + (U.R() - 0.5) * 300; E().bullet(side ? 40 : L.w * 32 - 40, y, side ? 0.05 : Math.PI - 0.05, 190, 'sand', e.dmg * 0.9, { life: 7 }); }
          if (every(C, 0.8, 0.5, 3)) ring(e, 16, 120, 'sun', C.t);
          return C.t > 3.4;
        }
      }
    },
    yeti: {
      seq: [['pound', 'boulder', 'rush', 'pound'], ['pound2', 'boulder2', 'rush', 'pound2', 'rush']],
      idle(e, dt) { walkTo(e, P().x, P().y, e.spd, dt); },
      pat: {
        pound(e, C) {
          for (let k = 0; k < 3; k++) if (at(C, 0.45 + k * 0.6)) { slamFx(e.x, e.y, 90, [200, 230, 255]); hitCircle(e.x, e.y, 60, e.dmg * 1.3); const gap = U.R() * U.TAU; for (let i = 0; i < 26; i++) { const a = i * U.TAU / 26; if (Math.abs(U.angDiff(a, gap)) > 0.45) E().bullet(e.x, e.y - 10, a, 150 * spdK(), 'ice', e.dmg); } }
          if (at(C, 0.05)) circleTel(e.x, e.y, 60, 0.45);
          return C.t > 2.2;
        },
        pound2(e, C) {
          for (let k = 0; k < 4; k++) if (at(C, 0.45 + k * 0.5)) { slamFx(e.x, e.y, 90, [200, 230, 255]); hitCircle(e.x, e.y, 60, e.dmg * 1.3); const gap = U.R() * U.TAU; for (let r = 0; r < 2; r++) for (let i = 0; i < 26; i++) { const a = i * U.TAU / 26 + r * 0.12; if (Math.abs(U.angDiff(a, gap)) > 0.5) E().bullet(e.x, e.y - 10, a, (130 + r * 50) * spdK(), 'ice', e.dmg); } }
          if (at(C, 0.05)) circleTel(e.x, e.y, 60, 0.45);
          return C.t > 2.5;
        },
        boulder(e, C) { for (let k = 0; k < 2; k++) if (at(C, 0.3 + k * 0.7)) { E().lob(e.x, e.y - 80, P().x, P().y, 1.0, 52, e.dmg * 1.5, 'snow', 10); W().lobs[W().lobs.length - 1].big = 1; SND.sfx('throw'); } return C.t > 2; },
        boulder2(e, C) { for (let k = 0; k < 3; k++) if (at(C, 0.3 + k * 0.5)) { E().lob(e.x, e.y - 80, P().x + P().vx * 0.4, P().y + P().vy * 0.4, 0.9, 52, e.dmg * 1.5, 'snow', 12); W().lobs[W().lobs.length - 1].big = 1; SND.sfx('throw'); } return C.t > 2.1; },
        rush(e, C, dt) {
          if (at(C, 0.01)) { C.d.a = aimA(e.x, e.y); C.d.b = 0; lineTel(e.x, e.y, C.d.a, 500, 70, 0.7, null, e); SND.sfx('roar'); }
          if (C.t > 0.7 && C.t < 2.6) {
            e.contactMul = 1.5;
            if (E().move(e, Math.cos(C.d.a) * 470 * dt, Math.sin(C.d.a) * 470 * dt)) {
              slamFx(e.x, e.y, 60, [200, 230, 255]); ring(e, 12, 140, 'ice', U.R());
              if (++C.d.b > 2) return true;
              C.d.a = aimA(e.x, e.y) + (U.R() - 0.5) * 0.3;
            }
          }
          if (C.t >= 2.6) { e.contactMul = 1; return true; }
          return false;
        }
      }
    },
    queen: {
      seq: [['cross', 'blizzard', 'tele', 'cross'], ['xcross', 'blizzard2', 'tele', 'mirrors', 'cross', 'xcross']],
      idle(e, dt) { e.wt = (e.wt || 0) - dt; if (e.wt <= 0 || !e.goal) { e.wt = 2.2; e.goal = randomSpot(170); } const [gx, gy] = e.goal; const d = U.dist(e.x, e.y, gx, gy); if (d > 6) E().move(e, (gx - e.x) / d * e.spd * dt, (gy - e.y) / d * e.spd * dt, true); },
      pat: {
        cross(e, C) { if (at(C, 0.05)) crossLines(e, P().x, P().y, 0); if (e.phase > 1 && at(C, 0.7)) crossLines(e, P().x, P().y, Math.PI / 4); return C.t > 1.6; },
        xcross(e, C) { if (at(C, 0.05)) crossLines(e, P().x, P().y, Math.PI / 4); if (at(C, 0.6)) crossLines(e, P().x, P().y, 0); return C.t > 1.7; },
        blizzard(e, C) { const n = every(C, 0.08, 0.2, 2.8); for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.23; for (let k = 0; k < 2; k++) E().bullet(e.x, e.y - 50, C.d.s + k * Math.PI, 135 * spdK(), 'frost', e.dmg); } if (every(C, 0.9, 0.5, 2.8)) fan(e, 3, 0.3, 230, 'ice'); return C.t > 3; },
        blizzard2(e, C) { const n = every(C, 0.07, 0.2, 3.0); for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.21; for (let k = 0; k < 3; k++) { E().bullet(e.x, e.y - 50, C.d.s + k * U.TAU / 3, 140 * spdK(), 'frost', e.dmg); E().bullet(e.x, e.y - 50, -C.d.s * 0.8 + k * U.TAU / 3, 100 * spdK(), 'ice', e.dmg); } } return C.t > 3.2; },
        tele(e, C) {
          if (at(C, 0.05)) { e.gone = true; FX.burst(e.x, e.y - 50, 26, { c: [[200, 240, 255], [120, 200, 255]], sp: 160 }); SND.sfx('blink'); }
          if (at(C, 0.55)) { const [x, y] = randomSpot(200); e.x = x; e.y = y; e.gone = false; FX.burst(e.x, e.y - 50, 26, { c: [[200, 240, 255], [120, 200, 255]], sp: 160 }); ring(e, 24, 150, 'frost', U.R()); }
          if (at(C, 0.95)) ring(e, 24, 120, 'ice', U.R());
          return C.t > 1.4;
        },
        mirrors(e, C) { if (at(C, 0.3)) summon(e, ['wisp', 'icebat', 'icebat'], 6); return C.t > 0.9; }
      }
    },
    golem: {
      seq: [['slam', 'rain', 'spin', 'slam'], ['slam2', 'rain2', 'spin', 'summon', 'slam2']],
      idle(e, dt) { walkTo(e, P().x, P().y, e.spd, dt); },
      pat: {
        slam(e, C) { if (at(C, 0.05)) slamLine(e, aimA(e.x, e.y), 1); return C.t > 1.7; },
        slam2(e, C) { if (at(C, 0.05)) slamLine(e, aimA(e.x, e.y) - 0.5, 1); if (at(C, 0.6)) slamLine(e, aimA(e.x, e.y) + 0.5, 1); return C.t > 2.2; },
        rain(e, C) { if (at(C, 0.1)) { lobRain(e, 9, 40, 340, 0.85, 'fire', 3, 0.18); SND.sfx('roar'); } return C.t > 2.4; },
        rain2(e, C) { if (at(C, 0.1)) { lobRain(e, 14, 40, 380, 0.8, 'fire', 3, 0.14); SND.sfx('roar'); } return C.t > 2.6; },
        spin(e, C, dt) {
          if (C.t < 3) {
            walkTo(e, P().x, P().y, 105, dt); e.contactMul = 1.3;
            const n = every(C, 0.07, 0, 3);
            for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.5; for (let k = 0; k < 2; k++) E().bullet(e.x, e.y - 40, C.d.s + k * Math.PI, 160 * spdK(), 'ember', e.dmg * 0.9); }
            if (every(C, 0.5)) SND.sfx('swoosh');
          }
          if (C.t >= 3) { e.contactMul = 1; return true; }
          return false;
        },
        summon(e, C) { if (at(C, 0.3)) summon(e, ['automaton', 'bomber', 'bomber'], 5); return C.t > 0.9; }
      }
    },
    dragon: {
      seq: [['breath', 'dive', 'fireballs', 'meteor'], ['breath2', 'dive', 'meteor', 'dive', 'fireballs', 'breath2']],
      idle(e, dt) { const p = P(); const d = U.dist(e.x, e.y, p.x, p.y); if (d > 230) walkTo(e, p.x, p.y, e.spd, dt); else if (d < 150) E().move(e, -(p.x - e.x) / d * e.spd * dt, -(p.y - e.y) / d * e.spd * dt); },
      pat: {
        breath(e, C) {
          if (at(C, 0.05)) { C.d.a = aimA(e.x, e.y - 80); SND.sfx('roar'); }
          if (C.t > 0.5 && C.t < 2.1) { const n = every(C, 0.045, 0.5, 2.1); for (let i = 0; i < n; i++) { const k = (C.t - 0.5) / 1.6, a = C.d.a + Math.sin(k * Math.PI * 2) * 0.7; for (let j = 0; j < 2; j++) E().bullet(e.x, e.y - 80, a + (U.R() - 0.5) * 0.15, (190 + U.R() * 60) * spdK(), 'fire', e.dmg); } }
          return C.t > 2.4;
        },
        breath2(e, C) {
          if (at(C, 0.05)) { C.d.a = aimA(e.x, e.y - 80); SND.sfx('roar'); }
          if (C.t > 0.5 && C.t < 2.5) { const n = every(C, 0.04, 0.5, 2.5); for (let i = 0; i < n; i++) { const k = (C.t - 0.5) / 2, s = Math.sin(k * Math.PI * 2) * 0.8; for (const a of [C.d.a + s, C.d.a - s]) E().bullet(e.x, e.y - 80, a + (U.R() - 0.5) * 0.12, (200 + U.R() * 60) * spdK(), 'fire', e.dmg); } }
          return C.t > 2.8;
        },
        dive(e, C, dt) {
          if (at(C, 0.01)) { e.under = true; e.air = 1; SND.sfx('wing'); }
          if (C.t < 1.5) { e.air = Math.min(600, C.t * 600); const p = P(); e.x += (p.x - e.x) * Math.min(1, dt * 3); e.y += (p.y - e.y) * Math.min(1, dt * 3); }
          if (at(C, 1.5)) { C.d.x = P().x; C.d.y = P().y; circleTel(C.d.x, C.d.y, 96, 0.8); }
          if (C.t > 1.5 && C.t < 2.3) { e.x = C.d.x; e.y = C.d.y; e.air = 600 * (1 - (C.t - 1.5) / 0.8) + 1; }
          if (at(C, 2.3)) { e.air = 0; e.under = false; slamFx(e.x, e.y, 96, [255, 160, 80]); hitCircle(e.x, e.y, 96, e.dmg * 1.6); ring(e, 22, 160, 'fire', U.R(), { at: [e.x, e.y - 20] }); W().zones.push({ x: e.x, y: e.y, r: 60, t: 0, dur: 3, dps: e.dmg * 0.5, owner: 'e', kind: 'fire', tick: 0 }); }
          return C.t > 3;
        },
        fireballs(e, C) { for (let k = 0; k < 5; k++) if (at(C, 0.2 + k * 0.25)) { const [x, y] = [e.x, e.y - 80]; E().bullet(x, y, aimA(x, y) + (k - 2) * 0.25, 170 * spdK(), 'big', e.dmg * 1.3, { curve: (k - 2) * -0.25 }); SND.sfx('eshoot'); } return C.t > 1.8; },
        meteor(e, C) { if (at(C, 0.1)) { lobRain(e, e.phase > 1 ? 14 : 10, 42, 420, 0.9, 'fire', 2.5, 0.15); SND.sfx('roar'); } return C.t > 2.6; }
      }
    },
    watcher: {
      seq: [['sweep', 'spiral', 'stare', 'eyes'], ['sweep2', 'spiral2', 'stare', 'sweep2', 'eyes']],
      idle(e, dt) { const [cx, cy] = center(); const tx = cx + Math.cos(e.t * 0.4) * 120, ty = cy - 60 + Math.sin(e.t * 0.6) * 40; const d = U.dist(e.x, e.y, tx, ty); if (d > 4) E().move(e, (tx - e.x) / d * e.spd * dt, (ty - e.y) / d * e.spd * dt, true); },
      pat: {
        sweep(e, C) { if (at(C, 0.05)) { const a = aimA(...mouth(e)), dir = U.R() < 0.5 ? 1 : -1; beam(e, a - dir * 1.7, { rot: dir * 1.45, warm: 0.9, dur: 2.4, c: [255, 140, 220], w: 20, oy: 0 }); SND.sfx('charge'); } return C.t > 3.5; },
        sweep2(e, C) { if (at(C, 0.05)) { const a = aimA(...mouth(e)), dir = U.R() < 0.5 ? 1 : -1; beam(e, a - dir * 1.6, { rot: dir * 1.3, warm: 0.9, dur: 2.8, c: [255, 140, 220], w: 20 }); beam(e, a - dir * 1.6 + Math.PI, { rot: dir * 1.3, warm: 0.9, dur: 2.8, c: [255, 140, 220], w: 20 }); SND.sfx('charge'); } if (every(C, 0.7, 1, 3.5)) fan(e, 5, 0.5, 170, 'void'); return C.t > 4; },
        spiral(e, C) { const n = every(C, 0.08, 0.2, 3); for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.19; for (let k = 0; k < 4; k++) E().bullet(e.x, e.y - 50, C.d.s + k * Math.PI / 2, 130 * spdK(), 'void', e.dmg); } return C.t > 3.3; },
        spiral2(e, C) { const n = every(C, 0.08, 0.2, 3.2); for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.19; for (let k = 0; k < 4; k++) { E().bullet(e.x, e.y - 50, C.d.s + k * Math.PI / 2, 130 * spdK(), 'void', e.dmg); E().bullet(e.x, e.y - 50, -C.d.s + k * Math.PI / 2 + 0.4, 100 * spdK(), 'pink', e.dmg); } } return C.t > 3.5; },
        stare(e, C) { for (let k = 0; k < 3; k++) if (at(C, 0.1 + k * 1.0)) { beam(e, aimA(...mouth(e)), { track: 2.2, warm: 0.75, dur: 0.35, c: [255, 220, 120], w: 14 }); SND.sfx('charge'); } return C.t > 3.3; },
        eyes(e, C) { if (at(C, 0.3)) summon(e, ['voideye', 'voideye', 'starling'], 5); return C.t > 0.9; }
      }
    },
    devourer: {
      seq: [['stars', 'fan', 'summon', 'stars', 'fan'], ['hole', 'tele', 'beams', 'fan', 'hole', 'summon'], ['storm', 'beams3', 'spiral', 'hole', 'storm', 'tele']],
      idle(e, dt) { const [cx, cy] = center(); const tx = cx + Math.cos(e.t * 0.5) * 140, ty = cy - 70 + Math.sin(e.t * 0.7) * 30; const d = U.dist(e.x, e.y, tx, ty); if (d > 4) E().move(e, (tx - e.x) / d * e.spd * dt, (ty - e.y) / d * e.spd * dt, true); },
      pat: {
        stars(e, C) { for (let k = 0; k < 5; k++) if (at(C, 0.2 + k * 0.32)) ring(e, 20, 130 + k * 8, 'star', k * 0.157); return C.t > 2; },
        fan(e, C) { for (let k = 0; k < 4; k++) if (at(C, 0.2 + k * 0.3)) fan(e, 9, 1.2, 190, k % 2 ? 'pink' : 'star'); return C.t > 1.6; },
        summon(e, C) { if (at(C, 0.3)) summon(e, ['shadowknight', 'starling', 'voideye'], 5); return C.t > 0.9; },
        hole(e, C, dt) {
          if (at(C, 0.05)) { SND.sfx('hole'); FX.ring(e.x, e.y - 60, 300, 20, 0.8, [160, 80, 255], 4); }
          if (C.t < 3.2) {
            const p = P(), dx = e.x - p.x, dy = e.y - 50 - p.y, d = Math.hypot(dx, dy) || 1;
            if (p.dashT <= 0) E().move(p, dx / d * 95 * dt, dy / d * 95 * dt);
            const n = every(C, 0.1, 0.3, 3.2);
            for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.33; for (let k = 0; k < 3; k++) E().bullet(e.x, e.y - 60, C.d.s + k * U.TAU / 3, 150 * spdK(), 'void', e.dmg); }
            if (Math.random() < 0.6) { const a = U.R() * U.TAU, r = 200; FX.part(e.x + Math.cos(a) * r, e.y - 60 + Math.sin(a) * r, { vx: -Math.cos(a) * 260, vy: -Math.sin(a) * 260, c: [190, 140, 255], life: 0.7, s: 2, glow: true }); }
          }
          return C.t > 3.5;
        },
        tele(e, C) {
          if (at(C, 0.05)) { e.gone = true; FX.burst(e.x, e.y - 60, 30, { c: [[200, 160, 255], [80, 40, 160]], sp: 200 }); SND.sfx('blink'); }
          if (at(C, 0.6)) { const [x, y] = randomSpot(220); e.x = x; e.y = y; e.gone = false; FX.burst(e.x, e.y - 60, 30, { c: [[200, 160, 255], [80, 40, 160]], sp: 200 }); ring(e, 28, 150, 'star', 0); }
          if (at(C, 0.9)) ring(e, 28, 115, 'void', 0.11);
          return C.t > 1.4;
        },
        beams(e, C) { if (at(C, 0.05)) { const o = U.R() * U.TAU; for (let i = 0; i < 4; i++) beam(e, o + i * Math.PI / 2, { rot: 0.6, warm: 1, dur: 3, c: [200, 120, 255], w: 18 }); SND.sfx('charge'); } if (every(C, 0.6, 1.2, 4)) fan(e, 3, 0.3, 200, 'star'); return C.t > 4.2; },
        beams3(e, C) { if (at(C, 0.05)) { const o = U.R() * U.TAU; for (let i = 0; i < 6; i++) beam(e, o + i * Math.PI / 3, { rot: i % 2 ? 0.45 : 0.45, warm: 1, dur: 3.4, c: [255, 140, 230], w: 16 }); SND.sfx('charge'); } if (every(C, 0.5, 1.2, 4.2)) ring(e, 12, 110, 'pink', C.t); return C.t > 4.6; },
        storm(e, C) { if (at(C, 0.1)) { lobRain(e, 16, 44, 460, 0.85, 'void', 0, 0.12); SND.sfx('roar'); } if (every(C, 0.45, 0.3, 2.4)) fan(e, 7, 1, 180, 'star'); return C.t > 2.8; },
        spiral(e, C) { const n = every(C, 0.075, 0.2, 3.4); for (let i = 0; i < n; i++) { C.d.s = (C.d.s || 0) + 0.21; for (let k = 0; k < 5; k++) E().bullet(e.x, e.y - 60, C.d.s + k * U.TAU / 5, 125 * spdK(), k % 2 ? 'star' : 'void', e.dmg); } return C.t > 3.6; }
      }
    }
  };

  function crossLines(e, x, y, rot) {
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2;
      const sx = x - Math.cos(a) * 20, sy = y - Math.sin(a) * 20;
      lineTel(sx, sy, a, 640, 28, 0.85, () => {
        hitLine(sx, sy, a, 640, 28, e.dmg * 1.3);
        for (let d = 0; d < 640; d += 26) { const px = sx + Math.cos(a) * d, py = sy + Math.sin(a) * d; if (E().cellAt(px, py) === 1) break; FX.burst(px, py, 2, { c: [[200, 240, 255], [140, 210, 255]], sp: 60, vz: 80, life: 0.5 }); }
        SND.sfx('ice');
      });
    }
    SND.sfx('charge');
  }
  function slamLine(e, a, mul) {
    W().tels.push({ k: 'cone', x: e.x, y: e.y - 6, ang: a, r: 130, arc: 1.1, t: 0, dur: 0.8, follow: e, fn: () => {
      if (e.dead) return;
      const p = P(), dx = p.x - e.x, dy = p.y - e.y;
      slamFx(e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, 70, [255, 160, 80]);
      if (Math.hypot(dx, dy) < 130 + p.r && Math.abs(U.angDiff(a, Math.atan2(dy, dx))) < 0.6) E().hurtPlayer(e.dmg * 1.5 * mul);
      for (let i = 1; i <= 9; i++) W().sched.push({ t: i * 0.06, fn: () => { const x = e.x + Math.cos(a) * (110 + i * 34), y = e.y + Math.sin(a) * (110 + i * 34); if (E().cellAt(x, y) === 1) return; W().zones.push({ x, y, r: 22, t: 0, dur: 2.4, dps: e.dmg * 0.6, owner: 'e', kind: 'fire', tick: 0 }); FX.burst(x, y, 6, { c: [[255, 180, 80], [255, 100, 40]], sp: 90, glow: true }); } });
    } });
  }

  /* ───────── 공통 진행 ───────── */
  function make(id, x, y) {
    const def = DATA.BOSSES[id], f = ENT.w.L.floor;
    const g = ART.get(def.spr, 0);
    const e = {
      kind: 'e', boss: true, bid: id, def: { ...def, ai: 'boss', cost: 10 }, x, y, r: def.r, h: g.h, fly: g.fly ? 6 : 0,
      hp: def.hp * DATA.bossHpScale(f), dmg: def.dmg * DATA.dmgScale(f), spd: def.spd, heavy: true, t: 0, spawnT: 0, flashT: 0, kvx: 0, kvy: 0,
      phase: 1, pi: 0, cur: null, rest: 1.4, trans: 0, air: 0
    };
    e.maxHp = e.hp;
    const nph = S[id].seq.length;
    e.thresholds = nph === 3 ? [0.66, 0.33] : [0.5];
    e.phaseLock = e.maxHp * e.thresholds[0];
    return e;
  }
  function update(e, dt) {
    const sc = S[e.bid];
    if (e.trans > 0) {
      e.trans -= dt; e.inv = true;
      if (Math.random() < 0.5) FX.part(e.x + (U.R() - 0.5) * e.r * 2, e.y - U.R() * e.h, { c: [255, 120, 120], vy: -60, life: 0.6, s: 3, glow: true });
      if (e.trans <= 0) e.inv = false;
      return;
    }
    if (e.phaseLock !== undefined && e.hp <= e.phaseLock + 0.5) {
      e.phase++; e.pi = 0; e.cur = null; e.rest = 0.6; e.trans = 1.4; e.inv = true; e.under = false; e.air = 0; e.gone = false; e.contactMul = 1;
      const next = e.thresholds[e.phase - 1];
      e.phaseLock = next !== undefined ? e.maxHp * next : undefined;
      ENT.w.eb.length = 0; ENT.w.tels.length = 0; ENT.w.beams.length = 0; ENT.w.lobs.length = 0;
      FX.ring(e.x, e.y - e.h * 0.5, 20, 260, 0.8, [255, 120, 120], 6); FX.addShake(10); FX.flash([255, 200, 200], 0.4);
      SND.sfx('roar');
      G.toast(e.phase === 2 ? `${e.def.name}이(가) 분노한다!` : `${e.def.name}의 마지막 발악!`);
      return;
    }
    if (!e.cur) {
      e.rest -= dt;
      if (sc.idle) sc.idle(e, dt);
      if (e.rest <= 0) {
        const seq = sc.seq[Math.min(e.phase, sc.seq.length) - 1];
        e.cur = { name: seq[e.pi++ % seq.length], t: 0, prev: 0, d: {} };
      }
    } else {
      const C = e.cur;
      C.prev = C.t; C.t += dt;
      if (sc.pat[C.name](e, C, dt)) { e.cur = null; e.rest = (e.phase > 1 ? 0.55 : 0.85) + (e.bid === 'devourer' ? -0.15 : 0); e.under = false; e.air = 0; e.contactMul = 1; }
    }
  }

  return { make, update, S };
})();
