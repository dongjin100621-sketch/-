'use strict';
/* 게임 흐름: 층 시작 → 웨이브 → 출구 → 보상 → 다음 층. 저장, 카메라, 주 반복문 */

const G = (() => {
  const VW = 1066, VH = 600;
  const KEY_META = 'tower.meta.v1', KEY_RUN = 'tower.run.v1';
  const G = {
    VW, VH, state: 'title', run: null, meta: null, god: false, cam: { x: 0, y: 0 }, time: 0, scale: 1,
    banner: null, toastT: 0, toastMsg: '', slowT: 0, deathT: 0, portal: null, fps: 60, bot: null
  };

  /* ───────── 저장 ───────── */
  function defMeta() { return { shards: 0, lv: {}, best: 0, clears: 0, runs: 0, unlocked: 0, kills: 0, bestTime: 0, settings: { music: 0.55, sfx: 0.8, shake: 1, nums: true, auto: null }, seen: {} }; }
  function loadMeta() {
    try { const m = JSON.parse(localStorage.getItem(KEY_META)); if (m) return Object.assign(defMeta(), m, { settings: Object.assign(defMeta().settings, m.settings || {}) }); } catch (e) { /* 저장소 못 씀 */ }
    return defMeta();
  }
  function saveMeta() { try { localStorage.setItem(KEY_META, JSON.stringify(G.meta)); } catch (e) { /* 무시 */ } }
  function saveRun() { if (!G.run || G.bot) return; try { localStorage.setItem(KEY_RUN, JSON.stringify(G.run)); } catch (e) { /* 무시 */ } }
  function loadRun() { try { return JSON.parse(localStorage.getItem(KEY_RUN)); } catch (e) { return null; } }
  function clearRun() { try { localStorage.removeItem(KEY_RUN); } catch (e) { /* 무시 */ } }

  /* ───────── 새 등반 ───────── */
  function newRun(cls, startTier = 0) {
    const m = G.meta;
    const run = {
      cls, floor: startTier * 10 + 1, startFloor: startTier * 10 + 1, hp: null, upg: {}, relics: [], gold: 40 * (m.lv.legacy || 0) + startTier * 120,
      rerolls: 1 + (m.lv.luck || 0), kills: 0, time: 0, seed: (Math.random() * 1e9) | 0, meta: { ...m.lv }, usedRevives: 0,
      mid: 0, bossKills: 0, dmgDealt: 0, dmgTaken: 0, goldGot: 0, ver: 1
    };
    if (m.lv.blessing) { const r = U.R.pick(DATA.UPG.filter(u => u.r === 1)); run.upg[r.id] = 1; }
    // 높은 계층에서 시작하면 그동안 얻었을 강화를 대신 받는다
    for (let i = 0; i < startTier * 8; i++) {
      const pool = DATA.UPG.filter(u => !u.once && (run.upg[u.id] || 0) < u.max && u.r < 3);
      const pref = { power: 6, haste: 3, multi: 4, vigor: 3, keen: 2, brutal: 2, guard: 2, pierce: 2, giant: 2, skillpow: 1.5, orbit: 1.5, shield: 1.5 };
      const u = U.R.weighted(pool, x => DATA.RARITY[x.r].w * (pref[x.id] || 0.5));
      run.upg[u.id] = (run.upg[u.id] || 0) + 1;
    }
    for (let i = 0; i < startTier; i++) { const left = DATA.RELICS.filter(r => !run.relics.includes(r.id)); run.relics.push(U.R.pick(left).id); }
    G.run = run;
    G.meta.runs++; saveMeta();
    startFloor();
  }

  /* ───────── 층 ───────── */
  function startFloor() {
    const run = G.run;
    const L = LEVEL.gen(run.floor, run.seed + run.floor * 1013);
    const w = ENT.newWorld(L, run);
    const T = ENT.T;
    w.player = ENT.makePlayer(run, L.spawn.x * T + 16, L.spawn.y * T + 16);
    w.waves = []; w.wave = -1; w.queue = []; w.waveT = 0; w.cleared = false;
    G.portal = null;
    G.bg = TILES.background(L.tier, VW + 200, VH + 200, run.seed % 1000 + L.tier);
    if (L.kind === 'mob') {
      w.waves = planWaves(L);
      w.nextWaveT = 1.2;
    } else {
      const b = BOSSAI.make(L.kind === 'mid' ? DATA.TIERS[L.tier].mid : DATA.TIERS[L.tier].boss, L.w * 16, 7 * T);
      b.rest = 2.6;
      w.enemies.push(b); w.boss = b;
      G.banner = { t: 0, dur: 3, big: b.def.name, small: b.def.title, boss: true };
      SND.sfx('roar');
    }
    const tier = DATA.TIERS[L.tier];
    if (L.kind === 'mob' && !G.banner) G.banner = { t: 0, dur: 2.2, big: `${L.floor}층`, small: (L.floor - 1) % 10 === 0 ? `제${L.tier + 1}계층 · ${tier.name}` : tier.name };
    if ((L.floor - 1) % 10 === 0 && L.kind === 'mob') G.banner.story = tier.intro;
    SND.play(L.kind === 'mob' ? tier.song : L.kind === 'mid' ? 'mid' : L.floor === 50 ? 'final' : 'boss');
    snapCam();
    FX.clear();
    UI.hide();
    G.state = 'play';
    run.hp = w.player.hp;
    saveRun();
    UI.hud(true);
  }
  function planWaves(L) {
    const k = (L.floor - 1) % 10 + 1, t = L.tier;
    const n = k <= 2 ? 2 : 3;
    const mobs = DATA.TIERS[t].mobs;
    let pool = mobs.slice(0, k <= 2 ? 2 : k <= 4 ? 3 : 4);
    if (t > 0 && k >= 6) pool = pool.concat([U.R.pick(DATA.TIERS[t - 1].mobs)]);
    const waves = [];
    for (let i = 0; i < n; i++) {
      let budget = (5 + k * 0.9 + t * 1.3) * (1 + i * 0.22);
      const list = [];
      let guard = 0;
      while (budget > 0 && guard++ < 50) {
        const id = U.R.pick(pool), c = DATA.ENEMIES[id].cost;
        if (c > budget + 0.5 && list.length) break;
        const elite = L.floor > 2 && U.R() < 0.03 + L.floor * 0.004;
        list.push({ id, elite });
        budget -= c * (elite ? 2.2 : 1);
      }
      waves.push(list);
    }
    return waves;
  }
  function updateFloor(dt) {
    const w = ENT.w, L = w.L;
    if (L.kind === 'mob' && !w.cleared) {
      w.waveT += dt;
      // 줄 선 몬스터를 조금씩 내보낸다
      if (w.queue.length) {
        w.spawnT = (w.spawnT || 0) - dt;
        if (w.spawnT <= 0) {
          w.spawnT = 0.18;
          const q = w.queue.shift();
          const [x, y] = ENT.randomOpen(230);
          ENT.spawnEnemy(q.id, x, y, { elite: q.elite });
        }
      }
      const alive = w.enemies.length;
      if (w.wave < 0) { w.nextWaveT -= dt; if (w.nextWaveT <= 0) nextWave(); }
      else if (!w.queue.length) {
        if (w.wave < w.waves.length - 1) { if (alive <= 1 || (alive <= 3 && w.waveT > 14)) nextWave(); }
        else if (alive === 0) clearFloor();
      }
    }
    // 출구
    if (G.portal) {
      G.portal.t += dt;
      const p = w.player;
      if (p.alive && U.dist(p.x, p.y, G.portal.x, G.portal.y) < 26 && G.portal.t > 0.6) finishFloor();
    }
  }
  function nextWave() {
    const w = ENT.w;
    w.wave++; w.waveT = 0;
    w.queue = w.waves[w.wave].slice();
    if (w.wave > 0) SND.sfx('wave');
  }
  function clearFloor() {
    const w = ENT.w;
    w.cleared = true;
    const T = ENT.T;
    G.portal = { x: w.L.exit.x * T + 16, y: w.L.exit.y * T + 16, t: 0 };
    w.player.heal(Math.round(w.player.st.maxHp * 0.05));
    SND.sfx('clear');
    toast('모든 적을 물리쳤다 — 위쪽 출구가 열렸다');
    ENT.clearBullets(0, 0, 1e5);
  }
  function finishFloor() {
    const w = ENT.w, run = G.run, L = w.L;
    G.portal = null;
    run.hp = w.player.hp;
    SND.sfx('portal');
    G.state = 'reward';
    UI.hud(false);
    if (L.floor >= 50) return victory();
    if (L.kind === 'mob') UI.upgrades(() => nextFloor());
    else UI.relics(() => UI.shop(() => nextFloor()));
  }
  function nextFloor() {
    G.run.floor++;
    if (G.run.floor > (G.meta.best || 0)) G.meta.best = G.run.floor;
    saveMeta();
    startFloor();
  }
  function bossHit() {}
  function bossDead(e) {
    const w = ENT.w, run = G.run, L = w.L;
    G.slowT = 1.4;
    FX.flash([255, 255, 255], 0.8); FX.addShake(14);
    SND.sfx('bossdie');
    for (let i = 0; i < 10; i++) w.sched.push({ t: i * 0.12, fn: () => { const x = e.x + (U.R() - 0.5) * e.r * 2.4, y = e.y - U.R() * e.h; FX.ring(x, y, 4, 50, 0.4, [255, 220, 160], 4); FX.burst(x, y, 20, { c: [[255, 255, 255], [255, 210, 120], [255, 120, 80]], sp: 220, life: 0.6, glow: true, s: 3 }); SND.sfx('boom'); } });
    for (const m of w.enemies) if (!m.boss && !m.dead) { m.dead = true; FX.burst(m.x, m.y - 10, 10, { c: [255, 255, 255], sp: 120 }); }
    w.eb.length = 0; w.tels.length = 0; w.beams.length = 0; w.lobs.length = 0;
    w.sched.push({ t: 1.3, fn: () => {
      ENT.dropCoins(e.x, e.y, 40 + L.floor * 4);
      for (let i = 0; i < 2; i++) w.picks.push({ k: 'heart', x: e.x + (U.R() - 0.5) * 40, y: e.y, vx: (U.R() - 0.5) * 80, vy: 40, z: 0, vz: 150, t: 0 });
      clearFloor();
    } });
    if (L.kind === 'mid') run.mid++; else { run.bossKills++; G.meta.unlocked = Math.max(G.meta.unlocked || 0, Math.min(4, L.tier + 1)); }
    w.boss = null;
    saveMeta();
    toast(`${e.def.name} 처치!`);
  }
  function shardsFor(run, win) {
    const floors = Math.max(0, run.floor - run.startFloor);
    return floors + run.mid * 3 + run.bossKills * 8 + (win ? 40 : 0);
  }
  function onDeath() {
    if (G.state !== 'play') return;
    G.state = 'dying'; G.deathT = 0; G.slowT = 1.6;
    SND.play(null); SND.sfx('die');
    FX.flash([255, 40, 40], 0.6);
  }
  function endRun(win) {
    const run = G.run, m = G.meta;
    const sh = shardsFor(run, win);
    m.shards += sh; m.kills += run.kills;
    if (win) { m.clears++; if (!m.bestTime || run.time < m.bestTime) m.bestTime = run.time; m.best = 51; }
    m.best = Math.max(m.best || 0, run.floor);
    saveMeta(); clearRun();
    UI.hud(false);
    return sh;
  }
  function victory() {
    G.state = 'victory';
    const sh = endRun(true);
    SND.play('ending');
    UI.victory(G.run, sh);
  }

  /* ───────── 카메라 ───────── */
  function camTarget() {
    const w = ENT.w, p = w.player, L = w.L;
    let tx = p.x - VW / 2, ty = p.y - 16 - VH / 2;
    if (INPUT.aimMode === 'mouse') { tx += Math.cos(p.face) * 40; ty += Math.sin(p.face) * 30; }
    const RW = L.w * 32, RH = L.h * 32;
    if (RW <= VW) tx = (RW - VW) / 2; else tx = U.clamp(tx, -8, RW - VW + 8);
    if (RH + 30 <= VH) ty = (RH - VH) / 2 - 12; else ty = U.clamp(ty, -30, RH - VH + 8);
    return [tx, ty];
  }
  function snapCam() { const [x, y] = camTarget(); G.cam.x = x; G.cam.y = y; }

  function toast(msg) { G.toastMsg = msg; G.toastT = 2.6; }

  /* ───────── 주 반복 ───────── */
  let last = 0, acc = 0, fpsAcc = 0, fpsN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    if (G.bot && G.bot.fast) { for (let i = 0; i < G.bot.fast; i++) step(1 / 60); }
    else step(dt);
    RENDER.draw();
  }
  function step(dt) {
    G.time += dt;
    INPUT.poll();
    if (G.state === 'play' || G.state === 'dying') {
      if (INPUT.pausePressed() && G.state === 'play') { UI.pause(); return; }
      if (FX.tickStop(dt)) { FX.update(dt * 0.2); return; }
      let sdt = dt;
      if (G.slowT > 0) { G.slowT -= dt; sdt = dt * (G.state === 'dying' ? 0.25 : 0.35); }
      const w = ENT.w;
      if (G.state === 'play') G.run.time += dt;
      const inp = G.bot ? G.bot.input(w, sdt) : INPUT.state(w);
      w.t += sdt;
      if (w.player.alive) ENT.updatePlayer(w.player, sdt, inp);
      ENT.updateFlow(sdt);
      ENT.updateEnemies(sdt);
      ENT.updateShots(sdt);
      updateFloor(sdt);
      FX.update(sdt);
      if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
      if (G.toastT > 0) G.toastT -= dt;
      const [tx, ty] = camTarget();
      const k = 1 - Math.pow(0.0025, dt);
      G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
      if (G.state === 'dying') {
        G.deathT += dt;
        if (G.deathT > 1.8) { G.state = 'dead'; const sh = endRun(false); SND.play('gameover'); UI.gameOver(G.run, sh); }
      }
    } else {
      FX.update(dt);
    }
  }

  function boot() {
    G.meta = loadMeta();
    FX.opt.shake = G.meta.settings.shake; FX.opt.nums = G.meta.settings.nums;
    SND.setVolume('music', G.meta.settings.music); SND.setVolume('sfx', G.meta.settings.sfx);
    RENDER.init();
    INPUT.init();
    UI.init();
    UI.title();
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  Object.assign(G, { boot, newRun, startFloor, nextFloor, finishFloor, bossHit, bossDead, onDeath, toast, saveMeta, saveRun, loadRun, clearRun, endRun, shardsFor, step, snapCam, victory, clearFloor });
  return G;
})();
