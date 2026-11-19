'use strict';
/* ────────────────────────────────────────────────────────────
   게임 상태 · 루프 · 지역 이동 · 퀘스트 · 저장
   ──────────────────────────────────────────────────────────── */
const SAVE_KEY = 'neonheart-save-v1';
const G = {
  S: null, P: null, st: null, map: null, enemies: [], npcs: [], objs: [], pb: [], eb: [], drops: [], timers: [],
  camX: 0, time: 0, cine: false, menuOpen: false, arena: null, boss: null, bossTrig: null, comp: null, fade: 0, fadeDir: 0,
  toasts: [], banner: null, opt: { sfx: true, bgm: true, shake: true }, seraSupport: false, cineSlow: 0, started: false,

  /* ── 새 게임 / 불러오기 ── */
  newState() {
    return {
      v: 1, lv: 1, exp: 0, cr: 150, attr: { body: 3, reflex: 3, tech: 3, intel: 3, cool: 3 }, ap: 3, pp: 1,
      perks: [], skills: SKILLS.filter((s) => s.start).map((s) => s.id), slots: { atk: 's_flash', util: 's_dodge', ult: null },
      equip: { weapon: 'w_pipe', body: 'b_jacket' }, inv: { w_pipe: 1, b_jacket: 1, u_medpen: 3, u_ramen: 2, u_frag: 2 }, quick: 'u_medpen',
      q: {}, flags: {}, aff: 0, talked: {}, map: 'home', x: 420, ending: null, kills: 0, playT: 0,
    };
  },
  load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return s; } catch (e) {} return null; },
  save(quiet) {
    if (!this.S || !this.P) return;
    this.S.map = this.map.id; this.S.x = Math.round(this.P.x);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.S)); if (!quiet) this.toast('저장했다.'); } catch (e) { if (!quiet) this.toast('저장하지 못했다 (저장 공간 없음).'); }
  },
  start(fresh) {
    SND.init();
    this.S = fresh ? this.newState() : (this.load() || this.newState());
    try { const o = JSON.parse(localStorage.getItem('neonheart-opt')); if (o) Object.assign(this.opt, o); } catch (e) {}
    SND.setOpts(this.opt.sfx, this.opt.bgm);
    this.P = new Player();
    this.calcStats();
    this.P.hp = this.st.maxHp; this.P.ram = this.st.maxRam;
    this.started = true;
    UI.hideTitle();
    this.loadMap(this.S.map, null, this.S.x);
    if (fresh || !this.S.q.m1) {
      this.startQuest('m1', true);
      this.after(0.6, () => this.say('intro'));
    }
  },

  /* ── 능력치 계산 ── */
  weapon() { return ITEMS[this.S.equip.weapon] || ITEMS.w_pipe; },
  hasPerk(id) { return this.S.perks.includes(id); },
  calcStats() {
    const S = this.S, A = S.attr, w = this.weapon(), T = WTYPES[w.wt];
    const g = {}; const fx = {};
    const addFx = (f) => { if (f) for (const k in f) fx[k] = (fx[k] || 0) + f[k]; };
    for (const sl of SLOTS) {
      const it = ITEMS[S.equip[sl.k]]; if (!it) continue;
      const s = itemStats(it); for (const k in s) g[k] = (g[k] || 0) + s[k];
      addFx(it.fx);
    }
    const v = (k) => g[k] || 0, hp = this.hasPerk.bind(this);
    const st = {};
    st.maxHp = Math.round((130 + A.body * 18 + (S.lv - 1) * 12 + v('hp')) * (hp('p_tough') ? 1.15 : 1));
    st.maxRam = Math.round((40 + A.intel * 6 + v('ram')) * (hp('p_ramup') ? 1.25 : 1));
    st.ramRegen = (3 + A.intel * 0.25) * (1 + (v('ramr') + A.intel * 4) / 100) * (hp('p_ramflow') ? 1.35 : 1);
    let atk = (w.atk + v('atk') + S.lv * 1.5) * (1 + A[T.attr] * 0.025);
    if (T.melee && hp('p_iron')) atk *= 1.15;
    if (w.wt === 'blade' && hp('p_dance')) atk *= 1.15;
    if (!T.melee && hp('p_marksman')) atk *= 1.15;
    st.atk = Math.round(atk);
    st.def = Math.round((v('def') + A.tech * 3 + S.lv) * (hp('p_engineer') ? 1.2 : 1));
    st.crit = 5 + A.reflex + A.cool * 0.5 + v('crit') + (hp('p_cold') ? 8 : 0);
    st.cdmg = 150 + A.cool * 3 + v('cdmg') + (hp('p_headhunt') ? 35 : 0);
    st.spd = A.reflex + v('spd') + (hp('p_agile') ? 10 : 0);
    st.aspd = v('aspd'); st.cdr = A.tech + v('cdr'); st.ls = v('ls'); st.dodge = v('dodge');
    st.exp = v('exp'); st.gold = v('gold'); st.hack = A.intel * 3 + v('hack'); st.heal = A.tech * 2 + v('heal') + (hp('p_medic') ? 30 : 0);
    st.ranged = v('ranged'); st.melee = v('melee'); st.regen = v('regen'); st.fx = fx;
    this.st = st;
    if (this.P) { this.P.hp = Math.min(this.P.hp, st.maxHp); this.P.ram = Math.min(this.P.ram, st.maxRam); }
    return st;
  },

  /* ── 지역 ── */
  loadMap(id, side, x) {
    const m = MAP[id] || MAP.home;
    this.map = m; this.S.map = m.id;
    this.enemies = []; this.pb = []; this.eb = []; this.drops = []; this.arena = null; this.boss = null; this.comp = null;
    FX.reset();
    BG.build(m);
    const P = this.P;
    P.x = x != null ? x : side === 'R' ? m.w - 140 : 140; P.y = GROUND; P.vx = 0; P.vy = 0; P.revived = false;
    if (side === 'R') P.f = -1; else if (side === 'L') P.f = 1;
    this.camX = clamp(P.x - VW * 0.45, 0, m.w - VW);
    this.refreshNpcs();
    // 적 배치
    if (m.pop && !(this.qDone('m8') && false)) {
      const bossZone = m.boss ? m.w - 1300 : m.w - 200;
      for (let i = 0; i < m.pop.n; i++) {
        const ex = lerp(700, bossZone, (i + rand(0.1, 0.9)) / m.pop.n);
        if (Math.abs(ex - P.x) < 500) continue;
        const elite = i === Math.floor(m.pop.n / 2) && Math.random() < 0.6;
        const kind = elite ? m.pop.types.find((k) => !ENEMIES[k].fly) : choice(m.pop.types);
        this.spawn(kind, ex, randi(m.lv[0], m.lv[1]), elite ? { elite: true, name: '정예 ' + ENEMIES[kind].n } : {});
      }
    }
    // 특별 사건
    if (m.id === 'market' && this.qStep('s4') === 0) for (let i = 0; i < 4; i++) this.spawn('sin', 1100 + i * 380, 8);
    if (m.id === 'factory' && this.qStep('s5') === 0) this.spawn('psy', 2600, 14, { elite: true, name: '광인 덱스', kind: 'dex' });
    if (this.seraAt() === 'party') this.comp = new Companion(P.x - 120);
    // 보스 방
    this.bossTrig = m.boss && m.boss.when() ? m.boss : null;
    // 음악
    const mus = { roof: 'calm', home: 'calm', street: 'city', market: 'city', under: 'fight', factory: 'fight', bridge: 'fight', tower: 'fight', sanctum: 'sacred' }[m.id];
    SND.music(mus);
    this.fade = 1; this.fadeDir = -1;
    UI.mapTitle(m);
    this.questEvent('reach', m.id);
    this.save(true);
  },
  refreshNpcs() {
    const m = this.map;
    this.npcs = (m.npcs || []).filter((n) => !n.when || n.when(this.S)).map((n) => ({ id: n.id, x: n.x, D: NPCS[n.id], t: Math.random() * 5 }));
    this.objs = (m.objs || []).filter((o) => !o.when || o.when()).map((o) => Object.assign({}, o));
  },
  spawn(kind, x, lv, o = {}) {
    const e = new Enemy(kind, x, Math.max(1, lv), o);
    if (o.kind) e.kind = o.kind;
    this.enemies.push(e); return e;
  },
  edgeCheck(P) {
    if (this.arena || this.fadeDir > 0) return;
    const m = this.map;
    if (P.x <= 22 && P.vx < 0 && m.idx > 0) { this.goMap(MAPS[m.idx - 1].id, 'R'); }
    else if (P.x >= m.w - 22 && P.vx > 0) {
      if (m.idx >= MAPS.length - 1) return;
      const why = gateRight(m.id);
      if (why) { P.x = m.w - 60; P.vx = -200; if (!this._gateT || this.time - this._gateT > 2) { this._gateT = this.time; this.toast(why); SND.play('deny'); } return; }
      this.goMap(MAPS[m.idx + 1].id, 'L');
    }
  },
  goMap(id, side, x) {
    if (this.fadeDir > 0) return;
    this.fadeDir = 1; this.fade = 0;
    this.pendingMap = [id, side, x];
  },

  /* ── 루프 ── */
  loop(now) {
    const dtReal = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    if (this.started) this.update(dtReal);
    HUD.draw(dtReal);
    requestAnimationFrame((t) => this.loop(t));
  },
  update(dtReal) {
    this.time += dtReal;
    this.S.playT += dtReal;
    if (this.fadeDir) {
      this.fade += this.fadeDir * dtReal * 3.2;
      if (this.fadeDir > 0 && this.fade >= 1) { this.fade = 1; const [id, side, x] = this.pendingMap; this.loadMap(id, side, x); }
      if (this.fadeDir < 0 && this.fade <= 0) { this.fade = 0; this.fadeDir = 0; }
    }
    // 타이머
    this.timers = this.timers.filter((t) => { if (this.menuOpen && !t.always) return true; t.t -= dtReal; if (t.t <= 0) { t.fn(); return false; } return true; });
    if (this.menuOpen || UI.dialogOpen) { INPUT.frame(); return; }
    if (FX.stop > 0) { FX.stop -= dtReal; INPUT.frame(); return; }
    const dt = dtReal;
    const P = this.P;
    const slow = (P.chronoT > 0 ? 0.3 : 1);
    P.update(dt);
    if (INPUT.skill) { const k = INPUT.skill; INPUT.skill = null; P.useSkill(k); }
    if (INPUT.item) { INPUT.item = false; this.useQuick(); }
    if (INPUT.interact) { INPUT.interact = false; this.interact(); }
    for (const e of this.enemies) e.update(dt * slow);
    this.enemies = this.enemies.filter((e) => !(e.dead && e.deadT <= 0));
    if (this.comp) this.comp.update(dt);
    for (const n of this.npcs) n.t += dt;
    this.updateBullets(dt, slow);
    this.updateDrops(dt);
    FX.update(dt);
    // 보스 방
    if (this.bossTrig && !this.arena && P.x > this.map.w - VW + 160) this.startBoss();
    // 카메라
    let tx = P.x - VW * 0.45 + P.f * 90;
    const L = this.arena ? this.arena[0] : 0, R = this.arena ? this.arena[1] : this.map.w;
    tx = clamp(tx, L, R - VW);
    this.camX = lerp(this.camX, tx, Math.min(1, dt * 6));
    this.camX = clamp(this.camX, 0, this.map.w - VW);
    // 근처 상호작용
    this.near = null;
    if (!this.cine) {
      for (const n of this.npcs) if (Math.abs(n.x - P.x) < 110 && P.y > GROUND - 200) { this.near = { type: 'npc', o: n }; break; }
      if (!this.near) for (const o of this.objs) if (Math.abs(o.x - P.x) < 100 && P.y > GROUND - 220) { this.near = { type: 'obj', o }; break; }
    }
    if (this._autoT === undefined) this._autoT = 0;
    if ((this._autoT += dt) > 30) { this._autoT = 0; this.save(true); }
    INPUT.frame();
  },
  after(t, fn, always) { this.timers.push({ t, fn, always }); },

  /* ── 탄환 ── */
  pshoot(x, y, f, ang, o) {
    const a = (f > 0 ? 0 : Math.PI) + ang * f;
    this.pb.push(Object.assign({ x, y, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, left: o.range, hit: new Set(), f }, o));
  },
  eshoot(x, y, vx, vy, dmg, c, src, r = 10, o = {}) { this.eb.push(Object.assign({ x, y, vx, vy, dmg, c, src, r, life: 2.5 }, o)); },
  explode(x, y, r, dmg, c, bigShake = true, gfx = null) {
    r *= this.hasPerk('p_demo') ? 1.25 : 1;
    FX.ring(x, y, r, c, 0.4, 10); FX.burst(x, y, c, 22, 420, 0.5, 6); FX.burst(x, y, '#ffffff', 8, 250, 0.3, 4);
    if (bigShake) FX.shake(9, 0.25);
    SND.play('boom');
    for (const e of this.enemies) {
      if (e.dead || Math.hypot(e.x - x, (e.y - e.h / 2) - y) > r + e.w / 2) continue;
      hitEnemy(e, dmg, { kind: 'boom', c, dir: e.x > x ? 1 : -1, knock: 200, heavy: true });
      if (gfx && !e.dead) {
        if (gfx.stun) e.doStun(e.boss ? gfx.stun * 0.3 : gfx.stun);
        if (gfx.burn) e.burn(gfx.dmg * 0.5, 4);
        if (gfx.pull && !e.boss) e.vx += (x - e.x) * 4;
      }
    }
  },
  updateBullets(dt, slow) {
    for (const b of this.pb) {
      if (b.home) {
        const t = this.enemies.filter((e) => !e.dead && !b.hit.has(e)).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
        if (t && Math.hypot(t.x - b.x, t.y - b.y) < 600) { const ang = Math.atan2(t.y - t.h / 2 - b.y, t.x - b.x), sp = Math.hypot(b.vx, b.vy); const cur = Math.atan2(b.vy, b.vx); let d = ang - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const na = cur + clamp(d, -6 * dt, 6 * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
      }
      if (b.grav) b.vy += b.grav * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.left -= Math.hypot(b.vx, b.vy) * dt;
      if (b.grenade && b.y >= GROUND - 10) { b.left = -1; this.explode(b.x, GROUND - 40, b.grenade.r, b.grenade.dmg, b.grenade.c, true, b.grenade.fx); continue; }
      for (const e of this.enemies) {
        if (e.dead || b.hit.has(e)) continue;
        if (Math.abs(b.x - e.x) < e.w / 2 + 10 && b.y > e.y - e.h && b.y < e.y + 10) {
          b.hit.add(e);
          if (b.grenade) { b.left = -1; this.explode(b.x, b.y, b.grenade.r, b.grenade.dmg, b.grenade.c, true, b.grenade.fx); break; }
          hitEnemy(e, b.dmg, { kind: b.kind, dir: b.vx > 0 ? 1 : -1, c: b.c, critBonus: b.critBonus, weapon: b.weapon, knock: 60, ult: b.kind === 'ranged' ? 1.4 : 2 });
          if (b.boom) this.explode(b.x, b.y, b.boom, b.dmg * 0.8, '#ffb02e');
          if (!b.pierce) { b.left = -1; break; }
        }
      }
    }
    this.pb = this.pb.filter((b) => b.left > 0 && b.x > this.camX - 200 && b.x < this.camX + VW + 200);
    const P = this.P;
    for (const b of this.eb) {
      b.x += b.vx * dt * slow; b.y += b.vy * dt * slow; b.life -= dt * slow;
      if (b.saw) { b.spin = (b.spin || 0) + dt * 20; if (b.life < 1.3 && !b.returned) { b.returned = true; b.vx = -b.vx; } }
      if (Math.abs(b.x - P.x) < P.w / 2 + b.r && b.y > P.y - P.h - b.r && b.y < P.y + b.r) {
        if (P.hurt(b.dmg, b.x - b.vx, { src: b.src, big: b.r > 20 })) { if (!b.saw && !b.ground) b.life = 0; }
      }
      if (b.y > GROUND + 20 && !b.ground) b.life = 0;
    }
    this.eb = this.eb.filter((b) => b.life > 0 && b.x > this.camX - 300 && b.x < this.camX + VW + 300);
  },
  drawBullets(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of this.pb) {
      if (b.grenade) { ctx.fillStyle = b.c; ctx.fillRect(b.x - 7, b.y - 7, 14, 14); ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 3, b.y - 3, 6, 6); continue; }
      if (b.wave) { ctx.strokeStyle = hexA(b.c, 0.85); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(b.x - b.f * 30, b.y, 60, -0.9, 0.9); if (b.f < 0) { ctx.beginPath(); ctx.arc(b.x + 30, b.y, 60, Math.PI - 0.9, Math.PI + 0.9); } ctx.stroke(); continue; }
      const len = Math.min(70, Math.hypot(b.vx, b.vy) * 0.03), ang = Math.atan2(b.vy, b.vx);
      ctx.strokeStyle = b.c; ctx.lineWidth = b.thick || 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(ang) * len, b.y - Math.sin(ang) * len); ctx.stroke();
    }
    for (const b of this.eb) {
      ctx.fillStyle = hexA(b.c, 0.35); ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.8, 0, 7); ctx.fill();
      if (b.saw) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin); ctx.fillStyle = '#ffdddd'; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -b.r - 8, 8, 14); } ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 7); ctx.fill(); ctx.restore(); continue; }
      ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, 7); ctx.fill();
    }
    ctx.restore();
  },

  /* ── 떨어진 물건 ── */
  dropCr(x, y, n) { this.drops.push({ x, y, vx: rand(-150, 150), vy: rand(-500, -300), type: 'cr', n, t: 0 }); },
  dropItem(x, y, id, n = 1) { this.drops.push({ x, y, vx: rand(-120, 120), vy: -560, type: 'item', id, n, t: 0 }); },
  updateDrops(dt) {
    const P = this.P;
    for (const d of this.drops) {
      d.t += dt;
      const dist = Math.hypot(P.x - d.x, P.y - 70 - d.y);
      if (d.t > 0.45 && dist < 220) { d.x = lerp(d.x, P.x, dt * 9); d.y = lerp(d.y, P.y - 70, dt * 9); }
      else { d.vy += 1600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.y > GROUND - 10) { d.y = GROUND - 10; d.vy = 0; d.vx *= 0.8; } }
      if (d.t > 0.45 && dist < 50) {
        d.got = true;
        if (d.type === 'cr') { this.S.cr += d.n; SND.play('coin'); FX.text(P.x, P.y - 200, '+' + d.n + '₡', '#ffd23e'); }
        else this.gain(d.id, d.n, true);
      }
    }
    this.drops = this.drops.filter((d) => !d.got && d.t < 40);
  },
  drawDrops(ctx) {
    for (const d of this.drops) {
      const bob = Math.sin(this.time * 5 + d.x) * 3;
      if (d.type === 'cr') { ctx.fillStyle = '#ffd23e'; ctx.fillRect(Math.round(d.x / 2) * 2 - 5, Math.round((d.y + bob) / 2) * 2 - 5, 10, 10); ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(d.x / 2) * 2 - 2, Math.round((d.y + bob) / 2) * 2 - 3, 4, 4); }
      else {
        const it = ITEMS[d.id], col = GRADES[it.g].c;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(col, 0.25); ctx.fillRect(d.x - 3, d.y - 120, 6, 120); ctx.restore();
        ctx.fillStyle = col; ctx.save(); ctx.translate(d.x, d.y + bob); ctx.rotate(Math.PI / 4); ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = '#0a0714'; ctx.fillRect(-5, -5, 10, 10); ctx.restore();
      }
    }
  },

  /* ── 물건 ── */
  has(id, n = 1) { return (this.S.inv[id] || 0) >= n; },
  gain(id, n = 1, show) {
    const it = ITEMS[id]; if (!it) return;
    this.S.inv[id] = (this.S.inv[id] || 0) + n;
    if (show) { this.toast(`획득: ${it.n}${n > 1 ? ' ×' + n : ''}`, GRADES[it.g].c); SND.play('item'); }
    this.questEvent('collect', id);
  },
  take(id, n = 1) { this.S.inv[id] = (this.S.inv[id] || 0) - n; if (this.S.inv[id] <= 0) { delete this.S.inv[id]; for (const k in this.S.equip) if (this.S.equip[k] === id) delete this.S.equip[k]; if (this.S.quick === id) this.S.quick = null; } },
  equip(id) {
    const it = ITEMS[id]; if (!it || !it.slot) return;
    if (it.lv > this.S.lv) { this.toast(`레벨 ${it.lv} 이상이어야 장착할 수 있다.`); SND.play('deny'); return; }
    this.S.equip[it.slot] = id; this.calcStats(); SND.play('item');
  },
  unequip(slot) { if (slot === 'weapon') { this.toast('무기는 다른 무기로 바꿔 장착하세요.'); return; } delete this.S.equip[slot]; this.calcStats(); },
  useItem(id) {
    const it = ITEMS[id], P = this.P, st = this.st;
    if (!it || it.t !== 'use' || !this.has(id)) return false;
    const u = it.use; const hk = 1 + st.heal / 100;
    if (u.warp) { if (this.arena) { this.toast('전투 중에는 귀환할 수 없다.'); return false; } this.take(id); this.goMap('home', null, 900); return true; }
    if (u.grenade) {
      if (this.menuOpen) { this.toast('수류탄은 전투 중 아이템 칸에서 던지세요.'); return false; }
      const gfx = (u.stun || u.burn || u.pull) ? { stun: u.stun, burn: u.burn, pull: u.pull, dmg: st.atk } : null;
      this.pshoot(P.x + P.f * 40, P.y - 130, P.f, -0.6, { dmg: 0, speed: 820, range: 2000, grav: 1600, c: GRADES[it.g].c, grenade: { r: 150 + it.g * 25, dmg: st.atk * u.grenade, c: GRADES[it.g].c, fx: gfx } });
      SND.play('jump');
      this.take(id); return true;
    }
    if (u.heal) P.heal(st.maxHp * u.heal * hk);
    if (u.healFlat) P.heal(u.healFlat * hk);
    if (u.regenBuff) { P.regenT = 10; P.regenV = u.regenBuff * hk; }
    if (u.ram) P.ram = Math.min(st.maxRam, P.ram + u.ram);
    if (u.buff) { P.buffs.push({ s: u.buff, t: u.dur, n: it.n }); FX.text(P.x, P.y - 220, it.n, GRADES[it.g].c); }
    SND.play('heal'); FX.burst(P.x, P.y - 90, '#5dff9a', 10, 200, 0.5, 4, -100);
    this.take(id); return true;
  },
  useQuick() {
    const id = this.S.quick;
    if (!id || !this.has(id)) { this.toast('아이템 칸이 비어 있다. 「가방」에서 소모품을 아이템 칸에 등록하세요.'); SND.play('deny'); return; }
    this.useItem(id);
  },

  /* ── 처치·보상 ── */
  onKill(e) {
    const S = this.S, lv = e.lv;
    S.kills++;
    this.addExp(Math.round(e.D.exp * 14 * Math.pow(lv, 1.15) * (e.elite ? 3 : 1) * (1 + this.st.gold * 0)));
    const crN = Math.round(rand(4, 9) * (1 + lv * 0.6) * (e.elite ? 4 : 1) * (1 + this.st.gold / 100));
    this.dropCr(e.x, e.y - e.h / 2, crN);
    if (Math.random() < (e.elite ? 0.7 : 0.085)) this.dropItem(e.x, e.y - e.h / 2, this.rollGear(lv + (e.elite ? 4 : 0)));
    if (Math.random() < 0.12) this.dropItem(e.x, e.y - e.h / 2, choice(lv < 8 ? ['u_medpen', 'u_ramen', 'u_ram', 'u_frag', 'u_skewer'] : lv < 18 ? ['u_medpen', 'u_medpen2', 'u_ram', 'u_emp', 'u_fire', 'u_stim'] : ['u_medpen2', 'u_nanokit', 'u_ramxl', 'u_toxic', 'u_reflex']));
    const P = this.P;
    P.gainUlt(5 * (1 + (this.st.fx.ultc || 0) / 100));
    if (this.hasPerk('p_predator')) P.heal(this.st.maxHp * 0.05);
    if (this.st.fx.kh) P.heal(this.st.maxHp * this.st.fx.kh / 100);
    if (this.hasPerk('p_absorb')) P.ram = Math.min(this.st.maxRam, P.ram + 8);
    if (this.hasPerk('p_coldblood')) { P.coldStacks = Math.min(5, P.coldStacks + 1); P.coldT = 6; }
    // 퀘스트 물건
    for (const id of QUEST_ORDER) {
      const st = this.curStep(id); if (!st || st.t !== 'collect' || !st.drop) continue;
      if (!st.drop.from.includes(e.kind)) continue;
      if (st.drop.map && st.drop.map !== this.map.id) continue;
      if ((this.S.inv[st.item] || 0) >= st.n) continue;
      if (Math.random() < st.drop.p) this.dropItem(e.x, e.y - e.h / 2, st.item);
    }
    this.questEvent('kill', e);
  },
  rollGear(lv) {
    const w = lv < 6 ? [80, 18, 2, 0] : lv < 14 ? [40, 48, 11, 1] : lv < 22 ? [12, 46, 37, 5] : [4, 28, 52, 16];
    let r = Math.random() * 100, g = 0; for (; g < 3; g++) { if (r < w[g]) break; r -= w[g]; }
    const special = ['w_redjaw', 'w_halo', 'w_needle', 'w_dawn', 'h_crown', 'b_mended'];
    const pool = ITEM_LIST.filter((it) => it.g === g && (it.t === 'weapon' || it.t === 'gear' || it.t === 'cyber') && !special.includes(it.id));
    return choice(pool).id;
  },
  addExp(n) {
    const S = this.S; if (S.lv >= LEVEL_MAX) return;
    n = Math.round(n * (1 + this.st.exp / 100));
    S.exp += n;
    let up = false;
    while (S.lv < LEVEL_MAX && S.exp >= expNeed(S.lv)) { S.exp -= expNeed(S.lv); S.lv++; S.ap++; S.pp++; up = true; }
    if (up) {
      this.calcStats(); this.P.hp = this.st.maxHp; this.P.ram = this.st.maxRam;
      FX.ring(this.P.x, this.P.y - 80, 200, '#ffd23e', 0.7, 10); FX.burst(this.P.x, this.P.y - 100, '#ffd23e', 30, 400, 0.8, 5, -200);
      this.banner = { t: 2.4, txt: `LEVEL UP!  Lv.${S.lv}`, sub: '능력치 포인트 +1 · 특성 포인트 +1  (오른쪽 위 「능력」)', c: '#ffd23e' };
      SND.play('level');
    }
  },
  onDeath() {
    this.after(1.4, () => {
      UI.deathScreen(() => {
        const lost = Math.floor(this.S.cr * 0.1); this.S.cr -= lost;
        this.P.dead = false; this.P.hp = this.st.maxHp; this.P.ram = this.st.maxRam; this.P.inv = 2; this.P.ult = 0;
        this.goMap('home', null, 900);
        this.after(0.8, () => this.toast(`은신처에서 깨어났다. 크레딧 ${fmt(lost)}₡를 잃었다.`));
      });
    });
  },

  /* ── 보스 ── */
  startBoss() {
    const b = this.bossTrig; this.bossTrig = null;
    this.arena = [this.map.w - VW, this.map.w];
    // 일반 적은 정리 (보스 방으로 끌려 들어오지 않게)
    for (const e of this.enemies) { e.dead = true; e.deadT = 0.3; }
    const boss = new Boss(b.id, this.map.w - 430); this.boss = boss; this.enemies.push(boss);
    SND.music('boss');
    FX.flash(BOSSES[b.id].c, 0.3);
    UI.bossIntro(BOSSES[b.id]);
    this.after(1.4, () => this.say({ red: 'red_intro', halo: 'halo_intro', oracle: 'ora_intro' }[b.id]));
  },
  onBossDown(b) {
    const B = b.B;
    this.addExp(B.lv * 260);
    for (let i = 0; i < 8; i++) this.dropCr(b.x + rand(-80, 80), b.y - 120, Math.round(B.lv * 18));
    B.drops.forEach((id, i) => this.after(0.6 + i * 0.2, () => this.dropItem(b.x, b.y - 150, id)));
    this.after(0.9, () => this.dropItem(b.x, b.y - 150, this.rollGear(B.lv + 4)));
    this.S.flags['boss_' + b.id] = true;
    this.after(2.2, () => {
      this.arena = null; this.boss = null;
      for (const e of this.enemies) if (!e.dead) { e.dead = true; e.deadT = 0.3; }
      SND.music(this.map.id === 'sanctum' ? 'sacred' : 'fight');
      const dl = { red: 'red_down', halo: 'halo_down', oracle: 'ora_down' }[b.id];
      this.say(dl, () => this.questEvent('boss', b.id));
    });
  },

  /* ── 세라와 호감도 ── */
  seraAt() {
    const S = this.S;
    if (S.ending === 'bad') return null;
    if (this.qActive('m8')) return null;
    if (this.qActive('m7') && this.qStep('m7') >= 1) return 'party';
    if (!this.qDone('m1') && !(this.qStep('m1') >= 3)) return null;
    for (const id of ['m3', 'm5']) { const st = this.curStep(id); if (st && st.npc === 'sera' && st.map === 'roof') return 'roof'; }
    return 'home';
  },
  addAff(n) {
    if (!n) return;
    const S = this.S; S.aff = clamp(S.aff + n, 0, 100);
    FX.text(this.P.x, this.P.y - 240, (n > 0 ? '♥ +' : '♥ ') + n, n > 0 ? '#ff8ad8' : '#8090b0', true);
    if (n > 0) SND.play('heart');
    if (S.aff >= 60 && !S.flags.mended) { S.flags.mended = true; this.after(0.5, () => this.say('mended', () => this.gain('b_mended', 1, true))); }
  },
  giveGift(id) {
    const it = ITEMS[id]; if (!it || !this.has(id)) return;
    this.take(id);
    const base = [3, 6, 10, 16][it.g] * [0.5, 1, 1.6][it.like];
    const lines = [['그럭저럭', ['음… 고마워요. 이건 어디에 쓰는 거예요?']], ['좋아', ['고마워요, 카이! 마음에 들어요.', '와, 예쁘다! 소중히 할게요.']], ['아주 좋아', ['…이걸 저한테요? 정말… 소중히 할게요.', '카이… 어떻게 알았어요? 이런 거 갖고 싶었어요.']]][it.like];
    let say = choice(lines[1]);
    if (id === 'g_ring') say = '…반지? 카이, 이거… "어느 세상에서도". …네. 어느 세상에서도요.';
    this.say([['sera', say]], () => this.addAff(Math.round(base)));
  },

  /* ── 퀘스트 ── */
  qState(id) { const q = this.S.q[id]; if (!q) return -1; if (q.done) return 1000; return q.s; },
  qStep(id) { const q = this.S.q[id]; return q && !q.done ? q.s : -1; },
  qActive(id) { const q = this.S.q[id]; return !!(q && !q.done); },
  qDone(id) { const q = this.S.q[id]; return !!(q && q.done); },
  flag(k) { return !!this.S.flags[k]; },
  curStep(id) { const q = this.S.q[id]; if (!q || q.done) return null; return QUESTS[id].steps[q.s]; },
  startQuest(id, quiet) {
    if (this.S.q[id]) return;
    this.S.q[id] = { s: 0, c: 0 };
    const Q = QUESTS[id];
    if (!quiet) { this.banner = { t: 2.6, txt: (Q.main ? '메인 퀘스트 · ' : '곁가지 퀘스트 · ') + Q.n, sub: Q.steps[0].d, c: Q.main ? '#3ee8ff' : '#ffd23e' }; SND.play('quest'); }
    this.checkAuto(id);
    this.refreshNpcs();
  },
  advance(id) {
    const q = this.S.q[id], Q = QUESTS[id];
    q.s++; q.c = 0;
    if (q.s >= Q.steps.length) { this.complete(id); return; }
    this.toast('▶ ' + Q.steps[q.s].d, Q.main ? '#3ee8ff' : '#ffd23e');
    this.checkAuto(id);
    this.refreshNpcs();
    if (this.map.boss && !this.arena && !this.boss && this.map.boss.when()) this.bossTrig = this.map.boss;
    if (this.seraAt() === 'party' && !this.comp) this.comp = new Companion(this.P.x - 120);
    if (this.seraAt() !== 'party') this.comp = null;
    this.save(true);
  },
  checkAuto(id) {
    const st = this.curStep(id); if (!st) return;
    if (st.t === 'collect' && this.has(st.item, st.n)) this.advance(id);
    else if (st.t === 'flags' && st.f.every((f) => this.flag(f))) this.advance(id);
    else if (st.t === 'reach' && this.map && this.map.id === st.map) { if (st.dlg) this.say(st.dlg, () => this.advance(id)); else this.advance(id); }
  },
  complete(id) {
    const Q = QUESTS[id], R = Q.reward || {};
    this.S.q[id] = { done: true };
    if (R.exp) this.addExp(R.exp);
    if (R.cr) this.S.cr += R.cr;
    (R.items || []).forEach(([it, n]) => this.gain(it, n));
    if (R.flag) this.S.flags[R.flag] = true;
    if (R.aff) this.addAff(R.aff);
    const items = (R.items || []).map(([it, n]) => ITEMS[it].n + (n > 1 ? ' ×' + n : '')).join(', ');
    this.banner = { t: 3, txt: '퀘스트 완료 · ' + Q.n, sub: [R.exp ? `경험치 +${fmt(R.exp)}` : '', R.cr ? `${fmt(R.cr)}₡` : '', items].filter(Boolean).join('  ·  '), c: '#5dff9a' };
    SND.play('quest');
    if (id === 'm8') { this.ending(); return; }
    if (Q.next) this.after(1.2, () => this.startQuest(Q.next));
    this.refreshNpcs();
    this.save(true);
  },
  questEvent(type, arg) {
    for (const id of QUEST_ORDER) {
      const st = this.curStep(id); if (!st) continue;
      if (type === 'kill' && st.t === 'kill') {
        const e = arg;
        if (st.map && st.map !== this.map.id) continue;
        if (st.e !== 'any' && !st.e.includes(e.kind)) continue;
        this.S.q[id].c++;
        if (this.S.q[id].c >= st.n) this.advance(id);
      }
      if (type === 'collect' && st.t === 'collect' && st.item === arg) { if (this.has(st.item, st.n)) this.advance(id); }
      if (type === 'reach' && st.t === 'reach' && st.map === arg) { if (st.dlg) this.say(st.dlg, () => this.advance(id)); else this.advance(id); return; }
      if (type === 'boss' && st.t === 'boss' && st.boss === arg) this.advance(id);
      if (type === 'flag' && st.t === 'flags' && st.f.every((f) => this.flag(f))) this.advance(id);
    }
  },
  /* NPC에게 걸린 퀘스트 단계 */
  npcQuest(npc) {
    for (const id of QUEST_ORDER) { const st = this.curStep(id); if (st && (st.t === 'talk' || st.t === 'give') && st.npc === npc) return { id, st }; }
    return null;
  },
  npcOffers(npc) { return QUEST_ORDER.filter((id) => QUESTS[id].giver === npc && !this.S.q[id] && QUESTS[id].avail()); },

  /* ── 상호작용 ── */
  interact() {
    const n = this.near; if (!n) return;
    if (n.type === 'obj') {
      const o = n.o;
      for (const id of QUEST_ORDER) { const st = this.curStep(id); if (st && st.t === 'obj' && st.obj === o.id) { this.objs = this.objs.filter((x) => x !== o); this.say(st.dlg, () => { this.advance(id); }); return; } }
      if (o.id === 'terminal') { this.P.hp = this.st.maxHp; this.P.ram = this.st.maxRam; this.save(true); SND.play('heal'); this.say('terminal'); return; }
      if (o.flag) { this.S.flags[o.flag] = true; this.objs = this.objs.filter((x) => x !== o); FX.burst(o.x, GROUND - 60, '#ff8ad8', 20, 300, 0.6, 5, -100); SND.play('item'); this.say(o.dlg, () => this.questEvent('flag')); return; }
      return;
    }
    UI.talkMenu(n.o.id);
  },
  talkTo(npc) {
    const q = this.npcQuest(npc);
    if (q) {
      if (q.st.t === 'give') {
        const need = q.st.n || 1;
        if (!this.has(q.st.item, need)) { this.say([[npc === 'sera' ? 'sera' : npc, npc === 'sera' ? '…?' : '아직인가?'], ['sys', `「${ITEMS[q.st.item].n}」${need > 1 ? ' ' + need + '개' : ''}이(가) 필요하다. (가진 수: ${this.S.inv[q.st.item] || 0})`]]); return; }
        this.take(q.st.item, need);
      }
      this.say(q.st.dlg, () => this.advance(q.id));
      return;
    }
    const lines = npc === 'sera' ? null : NPC_IDLE[npc];
    if (lines) this.say([[npc, choice(lines)]]);
  },
  ending() {
    const a = this.S.aff;
    const kind = a >= 75 ? 'true' : a >= 40 ? 'normal' : 'bad';
    this.S.ending = kind;
    this.after(1.5, () => {
      this.goMap(kind === 'true' ? 'roof' : 'home', null, 900);
      this.after(1.0, () => this.say('end_' + kind, () => {
        if (kind === 'true') { if (!this.has('w_dawn')) this.gain('w_dawn', 1, true); }
        UI.endCard(kind, () => { this.say('epilogue'); this.refreshNpcs(); this.save(true); });
      }));
    });
  },

  /* ── 대화 ── */
  say(script, done) {
    const arr = typeof script === 'string' ? DLG[script] : script;
    if (!arr) { done && done(); return; }
    UI.dialog(arr, done);
  },
  toast(txt, c = '#e8ecff') { this.toasts.push({ txt, c, t: 3.2 }); if (this.toasts.length > 4) this.toasts.shift(); },
  ultBanner(sk) { this.banner = { t: 1.4, txt: sk.n + '!', sub: '', c: sk.c, ult: true }; },
};

