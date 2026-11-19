'use strict';
/* ────────────────────────────────────────────────────────────
   플레이어 · 적 · 보스 · 동료(세라) · 탄환 · 떨어진 물건
   ──────────────────────────────────────────────────────────── */
const GRAV = 2600, JUMP_V = 1060, KAI_SC = 0.92;
const GLOWS = {};
function backGlow(ctx, x, y, r, c, a) {
  const k = c + Math.round(r / 10);
  if (!GLOWS[k]) { const R = Math.round(r / 10) * 10; const [cv, cx] = makeCanvas(R * 2, R * 2); const g = cx.createRadialGradient(R, R, 0, R, R, R); g.addColorStop(0, hexA(c, 1)); g.addColorStop(1, hexA(c, 0)); cx.fillStyle = g; cx.fillRect(0, 0, R * 2, R * 2); GLOWS[k] = cv; }
  const cv = GLOWS[k]; ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(cv, x - cv.width / 2, y - cv.height / 2); ctx.restore();
}

/* ── 피해 계산 ── */
function hitEnemy(e, base, o = {}) {
  if (!e || e.dead || e.invul > 0) return 0;
  const st = G.st, p = G.P;
  let m = 1;
  if (o.kind === 'melee') m *= 1 + st.melee / 100;
  if (o.kind === 'ranged') m *= 1 + st.ranged / 100;
  if (o.kind === 'skill' || o.kind === 'boom') m *= 1 + st.hack / 100;
  if (o.kind === 'boom' && G.hasPerk('p_demo')) m *= 1.35;
  if (G.hasPerk('p_assassin') && e.hp >= e.maxHp) m *= 1.4;
  const low = e.hp / e.maxHp <= 0.25;
  if (low && G.hasPerk('p_executor')) m *= 1.5;
  if (low && st.fx.exec) m *= 1 + st.fx.exec / 100;
  if (e.hackT > 0 && G.hasPerk('p_erosion')) m *= 1.2;
  if (p.coldStacks > 0) m *= 1 + 0.04 * p.coldStacks;
  if (p.buffMul('atk')) m *= 1 + p.buffMul('atk') / 100;
  if (p.berserkT > 0) m *= 1.6;
  let crit = st.crit + (o.critBonus || 0) + p.buffMul('crit') + (p.counterT > 0 ? 30 : 0);
  if (p.cloakCrit) { crit = 100; if (!o.dot) p.cloakCrit = false; }
  const isCrit = !o.dot && Math.random() * 100 < crit;
  if (isCrit) m *= st.cdmg / 100;
  let dmg = base * m * rand(0.92, 1.08);
  dmg *= 100 / (100 + (e.def || 0));
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.flash = 0.12;
  if (!e.boss && !e.superArmor && !o.dot) { e.stagger = Math.max(e.stagger, o.stagger ?? 0.16); if (o.knock) e.vx += o.knock * (o.dir || 1); }
  FX.text(e.x, e.y - e.h - 10, (isCrit ? '✦' : '') + dmg, isCrit ? '#ffd23e' : (o.dot ? '#ff9a4d' : '#ffffff'), isCrit);
  if (!o.dot) {
    FX.spark(e.x, e.y - e.h * 0.55, o.c || '#3ee8ff', o.dir || 1, isCrit ? 10 : 5);
    SND.play(isCrit ? 'crit' : 'hit');
    if (isCrit || o.heavy) FX.stop = Math.max(FX.stop, 0.05);
    p.gainUlt((o.ult ?? 2.2) * (1 + (st.fx.ultc || 0) / 100));
    // 흡혈과 적중 효과
    const ls = st.ls + (st.fx.ls || 0) + (p.berserkT > 0 ? 8 : 0);
    if (ls > 0 && o.kind !== 'boom') p.heal(dmg * ls / 100, true);
    if (st.fx.ramhit) p.ram = Math.min(st.maxRam, p.ram + st.fx.ramhit);
    if (o.weapon) {
      if (st.fx.burn && Math.random() * 100 < st.fx.burn) e.burn(G.st.atk * 0.35, 3);
      if (st.fx.shock && Math.random() * 100 < st.fx.shock) e.doStun(0.8);
      if (st.fx.boom) G.explode(e.x, e.y - e.h / 2, st.fx.boom, G.st.atk * 0.6, '#ffb02e', false);
    }
  }
  if (e.hp <= 0) e.die();
  return dmg;
}

/* ── 플레이어 ── */
class Player {
  constructor() {
    this.x = 200; this.y = GROUND; this.vx = 0; this.vy = 0; this.f = 1; this.ground = true; this.jumps = 0;
    this.hp = 100; this.ram = 50; this.ult = 0; this.w = 56; this.h = 165;
    this.atkT = 0; this.atkCD = 0; this.combo = 0; this.comboT = 0; this.pose = 'kai_idle'; this.poseT = 0;
    this.dashT = 0; this.inv = 0; this.hurtT = 0; this.cd = { atk: 0, util: 0, ult: 0 }; this.buffs = [];
    this.shield = 0; this.shieldT = 0; this.cloakT = 0; this.cloakCrit = false; this.berserkT = 0; this.chronoT = 0;
    this.adrenT = 0; this.regenT = 0; this.regenV = 0; this.counterT = 0; this.coldStacks = 0; this.coldT = 0;
    this.undyingCD = 0; this.repairT = 0; this.revived = false; this.dropT = 0; this.animT = 0; this.flash = 0; this.dead = false;
    this.chronoCD = 0; this.castT = 0; this.flashSkill = null;
  }
  buffMul(k) { let v = 0; for (const b of this.buffs) if (b.s[k]) v += b.s[k]; return v; }
  heal(n, quiet) {
    const st = G.st; if (n <= 0 || this.dead) return;
    const before = this.hp; this.hp = Math.min(st.maxHp, this.hp + n);
    if (!quiet && this.hp - before >= 1) FX.text(this.x, this.y - 190, '+' + Math.round(this.hp - before), '#5dff9a');
  }
  gainUlt(v) { this.ult = Math.min(100, this.ult + v); }
  hurt(dmg, srcX, o = {}) {
    if (this.dead || this.inv > 0 || this.dashT > 0 || G.cine) return false;
    const st = G.st;
    if (Math.random() * 100 < st.dodge + (G.hasPerk('p_afterimg') ? 12 : 0)) { FX.text(this.x, this.y - 190, '회피', '#3ee8ff'); this.inv = 0.25; return false; }
    let d = dmg * 100 / (100 + st.def * (1 + this.buffMul('def') / 100));
    if (G.hasPerk('p_colossus')) d *= 0.85;
    if (G.hasPerk('p_firewall') && this.ram >= st.maxRam / 2) d *= 0.88;
    if (this.adrenT > 0) d *= 0.7;
    d = Math.max(1, Math.round(d * rand(0.92, 1.08)));
    if (this.shield > 0) { const a = Math.min(this.shield, d); this.shield -= a; d -= a; FX.text(this.x, this.y - 200, '방어막', '#ffd23e'); if (d <= 0) { this.inv = 0.2; return true; } }
    this.hp -= d;
    FX.text(this.x, this.y - 180, '-' + d, '#ff4f6d');
    FX.burst(this.x, this.y - 100, '#ff4f6d', 8, 250);
    FX.shake(o.big ? 14 : 6, 0.2);
    SND.play('hurt');
    this.flash = 0.15; this.inv = o.big ? 0.8 : 0.45;
    if (!G.hasPerk('p_colossus') && !o.noKnock) { this.vx = (this.x < srcX ? -1 : 1) * (o.big ? 520 : 300); this.vy = -320; this.ground = false; this.hurtT = 0.22; }
    this.gainUlt(3);
    if (st.fx.thorns && o.src && !o.src.dead) hitEnemy(o.src, dmg * st.fx.thorns / 100, { kind: 'skill', dot: true });
    if (this.hp <= 0) {
      if (G.hasPerk('p_undying') && this.undyingCD <= 0) { this.hp = 1; this.undyingCD = 90; this.inv = 1.2; FX.text(this.x, this.y - 220, '불굴!', '#ff4f6d', true); return true; }
      if (st.fx.revive && !this.revived) { this.revived = true; this.hp = st.maxHp * 0.4; this.inv = 2; FX.ring(this.x, this.y - 80, 220, '#5dff9a', 0.6, 10); FX.text(this.x, this.y - 220, '보조 심장 가동!', '#5dff9a', true); SND.play('heal'); return true; }
      this.hp = 0; this.dead = true; SND.play('die'); G.onDeath();
    }
    return true;
  }
  update(dt) {
    const st = G.st, I = INPUT;
    this.animT += dt;
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
    ['atkCD', 'inv', 'hurtT', 'flash', 'shieldT', 'cloakT', 'berserkT', 'chronoT', 'adrenT', 'regenT', 'counterT', 'coldT', 'undyingCD', 'dropT', 'chronoCD', 'castT', 'comboT'].forEach((k) => { if (this[k] > 0) this[k] -= dt; });
    if (this.shieldT <= 0) this.shield = 0;
    if (this.coldT <= 0) this.coldStacks = 0;
    this.buffs = this.buffs.filter((b) => (b.t -= dt) > 0);
    if (this.dead) return;
    // 회복
    let rg = st.regen; if (G.hasPerk('p_regen')) rg += st.maxHp * 0.006; if (this.regenT > 0) rg += this.regenV; if (this.adrenT > 0) rg += st.maxHp * 0.25 / 3;
    if (rg > 0) this.hp = Math.min(st.maxHp, this.hp + rg * dt);
    if (G.hasPerk('p_repair') && (this.repairT -= dt) <= 0) { this.repairT = 5; if (this.hp < st.maxHp) this.heal(st.maxHp * 0.03); }
    this.ram = Math.min(st.maxRam, this.ram + st.ramRegen * dt);
    if (st.fx.chrono && this.hp < st.maxHp * 0.3 && this.chronoCD <= 0 && G.enemies.length) { this.chronoT = Math.max(this.chronoT, 3); this.chronoCD = 60; FX.text(this.x, this.y - 220, '크로노 엔진', '#3ee8ff', true); }

    if (G.cine || G.menuOpen) { this.vx *= 0.8; this.applyPhysics(dt); return; }

    // 이동
    const spd = 320 * (1 + st.spd / 100 + this.buffMul('spd') / 100);
    const mx = I.mx;
    if (this.dashT > 0) {
      this.dashT -= dt;
      if (this.flashSkill) { // 섬광 베기: 지나가는 길의 적을 벤다
        for (const e of G.enemies) if (!this.flashSkill.hit.has(e) && Math.abs(e.x - this.x) < 70 + e.w / 2 && Math.abs((e.y - e.h / 2) - (this.y - 80)) < e.h / 2 + 90) {
          this.flashSkill.hit.add(e); hitEnemy(e, st.atk * this.flashSkill.mult, { kind: 'skill', dir: this.f, c: '#3ee8ff', heavy: true, ult: 4 });
          FX.slash(e.x, e.y - e.h / 2, this.f, 60, '#3ee8ff', 18, 0.2);
        }
        if (this.dashT <= 0) this.flashSkill = null;
      }
    } else if (this.hurtT <= 0) {
      const target = Math.abs(mx) > 0.15 ? mx * spd : 0;
      const busy = this.atkT > 0 && WTYPES[G.weapon().wt].melee;
      this.vx = lerp(this.vx, busy ? target * 0.35 : target, Math.min(1, dt * (this.ground ? 14 : 7)));
      if (Math.abs(mx) > 0.15 && this.atkT <= 0) this.f = mx > 0 ? 1 : -1;
    }
    if (I.jumpPressed) {
      I.jumpPressed = false;
      if (I.my > 0.5 && this.ground && this.onPlat) { this.dropT = 0.3; this.ground = false; this.y += 4; }
      else {
        const maxJ = (G.hasPerk('p_djump') || st.fx.djump) ? 2 : 1;
        if (this.ground || this.jumps < maxJ) {
          if (!this.ground) FX.ring(this.x, this.y, 50, '#3ee8ff', 0.25, 4);
          this.vy = -JUMP_V * (this.ground ? 1 : 0.88); this.ground = false; this.jumps++; SND.play('jump');
        }
      }
    }
    // 공격
    if (this.atkT > 0) this.atkT -= dt;
    if (I.atk && this.atkCD <= 0 && this.dashT <= 0) this.attack();
    this.applyPhysics(dt);
    // 지역 끝
    G.edgeCheck(this);
  }
  applyPhysics(dt) {
    this.vy += GRAV * dt;
    if (this.dashT > 0) this.vy = Math.min(this.vy, 0);
    const prevY = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const L = G.arena ? G.arena[0] + 30 : 20, R = G.arena ? G.arena[1] - 30 : G.map.w - 20;
    this.x = clamp(this.x, L, R);
    this.onPlat = false;
    if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; if (!this.ground) this.land(); this.ground = true; this.jumps = 0; }
    else {
      let landed = false;
      if (this.vy >= 0 && this.dropT <= 0) for (const [px, py, pw] of G.map.plat || []) {
        if (this.x > px && this.x < px + pw && prevY <= py + 2 && this.y >= py) { this.y = py; this.vy = 0; landed = true; this.onPlat = true; break; }
      }
      if (landed) { if (!this.ground) this.land(); this.ground = true; this.jumps = 0; }
      else this.ground = false;
    }
  }
  land() { FX.burst(this.x, this.y, '#9fb0d0', 4, 120, 0.3, 3, 200); }
  attack() {
    const w = G.weapon(), T = WTYPES[w.wt], st = G.st;
    const rate = T.rate / (1 + st.aspd / 100 + this.buffMul('aspd') / 100 + (this.berserkT > 0 ? 0.4 : 0) + (G.hasPerk('p_dance') && w.wt === 'blade' ? 0.1 : 0));
    this.atkCD = rate; this.atkT = Math.max(0.2, rate);
    if (this.cloakT > 0) { this.cloakT = 0; }
    if (T.melee) {
      if (this.comboT <= 0) this.combo = 0;
      const maxC = 3;
      const fin = this.combo === maxC - 1;
      const mult = [1, 1.1, 1.5][this.combo] * (fin && G.hasPerk('p_finisher') ? 1.6 : 1);
      const reach = T.range * (fin ? 1.15 : 1);
      this.pose = ['kai_blade', 'kai_slash', 'kai_dash'][this.combo]; this.poseT = this.atkT;
      if (this.ground) this.vx = this.f * (fin ? 420 : 200);
      const col = w.fx && w.fx.burn ? '#ff7a3d' : w.fx && w.fx.shock ? '#bfe6ff' : (w.g >= 3 ? '#ffb02e' : w.wt === 'wire' ? '#7c6bff' : '#3ee8ff');
      const a0 = this.combo === 1 ? 1.2 : -1.3, a1 = this.combo === 1 ? -1.0 : 1.1;
      FX.slash(this.x + this.f * reach * 0.35, this.y - 85, this.f, reach * 0.62, col, fin ? 34 : 24, 0.2, Math.min(a0, a1), Math.max(a0, a1));
      SND.play(w.wt === 'blunt' || w.wt === 'arm' ? 'heavy' : 'slash');
      const x0 = Math.min(this.x, this.x + this.f * reach), x1 = Math.max(this.x, this.x + this.f * reach);
      let hits = 0;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const ex0 = e.x - e.w / 2, ex1 = e.x + e.w / 2, ey0 = e.y - e.h, ey1 = e.y;
        if (ex1 > x0 - 20 && ex0 < x1 && ey1 > this.y - 200 && ey0 < this.y + 10) {
          hitEnemy(e, st.atk * mult, { kind: 'melee', dir: this.f, c: col, knock: (T.knock || 1) * (fin ? 380 : 160), weapon: true, heavy: fin });
          hits++;
        }
      }
      if (hits && fin) FX.shake(5, 0.12);
      if (w.fx && w.fx.wave) G.pshoot(this.x + this.f * 60, this.y - 90, this.f, 0, { dmg: st.atk * 0.7, speed: 1100, range: 700, pierce: true, c: col, wave: true, kind: 'melee' });
      this.combo = (this.combo + 1) % maxC; this.comboT = 0.7;
    } else {
      this.pose = 'kai_idle2'; this.poseT = this.atkT;
      const y = this.y - 112, x = this.x + this.f * 46;
      const n = (T.pellets || 1) * (w.fx && w.fx.multi ? w.fx.multi : 1);
      for (let i = 0; i < n; i++) {
        let ang = (T.spread || 0) * (n > 1 ? (i / (n - 1) - 0.5) * 2 : (Math.random() - 0.5) * 2);
        if (n > 1 && !T.pellets) ang = (i - (n - 1) / 2) * 0.06;
        G.pshoot(x, y, this.f, ang, { dmg: st.atk, speed: T.speed, range: T.range, pierce: T.pierce || (w.fx && w.fx.pierce), home: w.fx && w.fx.home, boom: T.boom, kind: 'ranged', c: w.g >= 3 ? '#ffb02e' : '#ffe6a0', weapon: true });
      }
      FX.burst(x + this.f * 10, y, '#ffd36a', 4, 200, 0.12, 3, 0);
      SND.play(w.wt === 'sniper' || w.wt === 'revolver' || w.wt === 'launcher' ? 'heavy' : 'shot');
      if (w.wt === 'shotgun' || w.wt === 'sniper') this.vx -= this.f * 160;
    }
  }
  /* 스킬 사용 */
  useSkill(slot) {
    if (this.dead || G.cine || G.menuOpen) return;
    const id = G.S.slots[slot];
    if (!id) { G.toast(`${SLOT_NAME[slot]} 칸이 비어 있다. 「능력」에서 스킬을 해금하고 장착하세요.`); SND.play('deny'); return; }
    const sk = SKILL[id], st = G.st;
    if (this.cd[slot] > 0) { SND.play('deny'); return; }
    if (slot === 'ult') { if (this.ult < 100) { G.toast('필살 게이지가 아직 다 차지 않았다.'); SND.play('deny'); return; } }
    else if (this.ram < sk.ram) { G.toast('RAM이 부족하다.'); SND.play('deny'); return; }
    if (slot === 'ult') this.ult = 0; else this.ram -= sk.ram;
    this.cd[slot] = sk.cd * (1 - Math.min(0.5, st.cdr / 100 + (G.hasPerk('p_cooling') ? 0.12 : 0)));
    const atk = st.atk * (G.hasPerk('p_overload') ? 1.25 : 1);
    const near = (r = 1300) => G.enemies.filter((e) => !e.dead && Math.abs(e.x - this.x) < r).sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x));
    this.castT = 0.35; this.pose = 'kai_skill'; this.poseT = 0.35;
    SND.play(slot === 'ult' ? 'ult' : 'skill');
    if (slot === 'ult') { FX.flash(sk.c, 0.2); G.ultBanner(sk); }
    switch (id) {
      case 's_slam': {
        this.pose = 'kai_slash'; FX.shake(10, 0.3);
        for (let i = 1; i <= 4; i++) setTimeout(() => FX.ring(this.x + this.f * i * 70, GROUND, 90, '#ff4f6d', 0.35, 8), i * 50);
        for (const e of G.enemies) if (!e.dead && (e.x - this.x) * this.f > -40 && Math.abs(e.x - this.x) < 340 && e.y > GROUND - 260) {
          hitEnemy(e, atk * sk.mult, { kind: 'skill', dir: this.f, c: '#ff4f6d', heavy: true, knock: 200 }); if (!e.boss && !e.fly) { e.vy = -700; e.air = true; }
        }
        break;
      }
      case 's_adren': this.adrenT = 5; FX.ring(this.x, this.y - 80, 160, '#ff4f6d', 0.5, 8); SND.play('heal'); break;
      case 's_berserk': this.berserkT = 10; FX.ring(this.x, this.y - 80, 260, '#ff2a4a', 0.6, 12); break;
      case 's_flash': this.dashT = 0.24; this.vx = this.f * 2100; this.inv = 0.3; this.pose = 'kai_dash'; this.poseT = 0.3; this.flashSkill = { mult: sk.mult * (G.hasPerk('p_overload') ? 1.25 : 1), hit: new Set() }; FX.beam(this.x, this.y - 80, this.x + this.f * 500, this.y - 80, '#3ee8ff', 10, 0.25); SND.play('dash'); break;
      case 's_dodge': this.dashT = 0.2; this.vx = this.f * 1500; this.inv = 0.35; this.pose = 'kai_dash'; this.poseT = 0.22; if (G.hasPerk('p_counter')) this.counterT = 3; FX.burst(this.x, this.y - 80, '#3ee8ff', 8, 200, 0.3, 4, 0); SND.play('dash'); break;
      case 's_chrono': this.chronoT = 6; FX.ring(this.x, this.y - 80, 900, '#3ee8ff', 0.8, 10); break;
      case 's_grenade': G.pshoot(this.x + this.f * 40, this.y - 130, this.f, -0.55, { dmg: 0, speed: 800, range: 2000, grav: 1600, grenade: { r: 170, dmg: atk * sk.mult, c: '#ffd23e' }, c: '#ffd23e' }); break;
      case 's_shield': this.shield = st.maxHp * 0.35; this.shieldT = 6; FX.ring(this.x, this.y - 80, 120, '#ffd23e', 0.5, 8); break;
      case 's_orbital': {
        const targets = near(1400);
        for (let i = 0; i < 6; i++) setTimeout(() => {
          const tx = targets[i % Math.max(1, targets.length)] ? targets[i % targets.length].x + rand(-40, 40) : this.x + this.f * (150 + i * 120);
          FX.beam(tx, -20, tx, GROUND, '#ffb02e', 40, 0.35); FX.ring(tx, GROUND, 150, '#ffb02e', 0.4, 10); FX.shake(8, 0.15); SND.play('boom');
          for (const e of G.enemies) if (!e.dead && Math.abs(e.x - tx) < 110) hitEnemy(e, atk * sk.mult * 0.5, { kind: 'skill', c: '#ffb02e', heavy: true });
        }, 150 + i * 160);
        break;
      }
      case 's_overheat': {
        const t = near()[0]; if (!t) { G.toast('주변에 해킹할 적이 없다.'); this.cd[slot] = 0; this.ram += sk.ram; return; }
        SND.play('hack'); const list = [t]; if (G.hasPerk('p_chain')) { const t2 = near().find((e) => e !== t && Math.abs(e.x - t.x) < 400); if (t2) list.push(t2); }
        for (const e of list) { e.hackT = 4; e.burn(atk * sk.mult / 4, 4, true); FX.beam(this.x, this.y - 120, e.x, e.y - e.h / 2, '#7c6bff', 3, 0.3); FX.text(e.x, e.y - e.h - 30, '과열', '#ff7a3d'); }
        break;
      }
      case 's_reset': SND.play('hack'); for (const e of near(1400)) { e.doStun(e.boss ? 0.6 : 2); e.hackT = 3; FX.beam(this.x, this.y - 120, e.x, e.y - e.h / 2, '#7c6bff', 2, 0.25); } FX.flash('#7c6bff', 0.12); break;
      case 's_synapse': {
        FX.flash('#a07cff', 0.25); FX.shake(12, 0.4);
        for (const e of near(1400)) { const k = e.hp / e.maxHp <= 0.3 ? 2 : 1; FX.ring(e.x, e.y - e.h / 2, 140, '#a07cff', 0.5, 8); hitEnemy(e, atk * sk.mult * k, { kind: 'skill', c: '#a07cff', heavy: true }); e.hackT = 4; }
        break;
      }
      case 's_snipe': G.pshoot(this.x + this.f * 46, this.y - 112, this.f, 0, { dmg: atk * sk.mult, speed: 3000, range: 1600, pierce: true, c: '#ffffff', critBonus: 30, kind: 'skill', thick: 6 }); FX.beam(this.x, this.y - 112, this.x + this.f * 1300, this.y - 112, '#ffffff', 6, 0.15); this.vx -= this.f * 250; break;
      case 's_cloak': this.cloakT = 4; this.cloakCrit = true; FX.burst(this.x, this.y - 80, '#d9e8ff', 14, 200, 0.4, 4, 0); for (const e of G.enemies) if (e.state === 'wind') e.state = 'chase'; break;
      case 's_deadeye': {
        const ts = near(1300).slice(0, 6); if (!ts.length) { this.ult = 100; this.cd[slot] = 0; G.toast('표적이 없다.'); return; }
        ts.forEach((e) => FX.ring(e.x, e.y - e.h / 2, 60, '#ffffff', 0.8, 3));
        G.cineSlow = 0.9;
        ts.forEach((e, i) => setTimeout(() => { if (e.dead) return; FX.beam(this.x + this.f * 40, this.y - 112, e.x, e.y - e.h / 2, '#ffffff', 5, 0.12); SND.play('heavy'); hitEnemy(e, atk * sk.mult, { kind: 'skill', c: '#ffffff', critBonus: 50, heavy: true }); }, 700 + i * 140));
        break;
      }
    }
  }
  draw(ctx) {
    const A = this.anim || (this.anim = new Animator(0));
    const dt = A.tick(G.time, this.x, this.y);
    let name = 'kai_idle2';
    if (this.poseT > 0) { this.poseT -= dt; name = this.pose; }
    else if (this.dashT > 0) name = 'kai_dash';
    else if (!this.ground) name = 'kai_jump';
    // 자세가 바뀌는 순간: 이전 자세의 잔상 + 튀어나가는 찌그러짐
    if (name !== A.prev) {
      const atk = name === 'kai_blade' || name === 'kai_slash' || name === 'kai_dash' || name === 'kai_skill';
      if (A.prev && atk) { A.ghostName = A.prev; A.ghost = 0.09; A.bump(-2.6); A.lunge = 1; }
      else if (name === 'kai_jump' && this.vy < 0) A.bump(3.2);
      else if (A.prev && A.prev !== 'kai_jump') A.bump(-1.2);
      A.prev = name;
    }
    if (this.ground && A.air) A.bump(-3.4 * clamp(A.airVy / 1100, 0.4, 1.3)); // 착지
    A.air = !this.ground; if (!this.ground) A.airVy = Math.max(0, this.vy);
    if (this.atkT > 0 && this.poseT > 0 && this.pose === 'kai_idle2' && A.recoil !== this.atkCD) { A.recoil = this.atkCD; A.kick = 0.7; A.bump(-0.8); } // 사격 반동
    const P = A.begin();
    const fwd = this.vx * this.f;
    let rot = 0;
    if (name === 'kai_idle2') {
      A.breathe(P, 1);
      const sp = Math.abs(this.vx);
      const amp = A.walk(P, sp, { len: 140, full: 330 }, 0.36);
      P.lean = clamp(fwd / 330, -0.6, 1) * 0.09 + amp * 0.02;
    } else if (name === 'kai_jump') {
      rot = clamp(this.vy / 4000, -0.12, 0.12) * this.f;
      const st = clamp(-this.vy / JUMP_V, -0.6, 1); P.sy *= 1 + st * 0.07; P.sx *= 1 - st * 0.04;
    } else {
      P.lean = 0.04;
    }
    if (this.hurtT > 0) { P.lean -= 0.16; P.ox -= 6; }
    P.lean -= A.kick * 0.05; P.ox += A.lunge * 10 - A.kick * 5;
    const [ff, tsx] = A.face(this.f); P.sx *= tsx;
    const alpha = this.cloakT > 0 ? 0.3 : (this.inv > 0 && Math.floor(this.inv * 20) % 2 ? 0.55 : 1);
    // 그림자와 뒤쪽 빛(어두운 배경에서도 보이게)
    const air = clamp((GROUND - this.y) / 300, 0, 0.6);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - air)})`; ctx.beginPath(); ctx.ellipse(this.x, Math.min(this.y, GROUND) + 2, 40 * (1 - air * 0.5) * P.sx, 8, 0, 0, 7); ctx.fill();
    backGlow(ctx, this.x, this.y - 85, 120, '#3ee8ff', 0.16);
    if (this.dashT > 0) for (let i = 1; i <= 3; i++) SPR.pose(ctx, name, this.x - this.vx * 0.012 * i, this.y, { sc: KAI_SC, f: ff, alpha: 0.25 / i, tint: '#3ee8ff', tintA: 0.8 }, P);
    if (A.ghost > 0 && A.ghostName) SPR.pose(ctx, A.ghostName, this.x, this.y, { sc: KAI_SC, f: ff, alpha: A.ghost / 0.09 * 0.35, tint: '#3ee8ff', tintA: 0.6 }, POSE0);
    if (this.berserkT > 0) SPR.pose(ctx, name, this.x + rand(-3, 3), this.y, { sc: KAI_SC * 1.04, f: ff, alpha: 0.35, tint: '#ff2a4a', tintA: 1, rot }, P);
    SPR.pose(ctx, name, this.x, this.y, { sc: KAI_SC, f: ff, alpha, flash: this.flash > 0 ? 0.8 : 0, rot }, P);
    if (this.shield > 0) { ctx.strokeStyle = 'rgba(255,210,62,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(this.x, this.y - 85, 70, 100, 0, 0, 7); ctx.stroke(); }
    // 무기 표시(원거리일 때 총구 빛)
  }
}

/* ── 적 ── */
class Enemy {
  constructor(kind, x, lv, o = {}) {
    const D = ENEMIES[kind] || ENEMIES.psy;
    this.kind = kind; this.D = D; this.lv = lv; this.x = x; this.y = D.fly ? rand(380, 470) : GROUND; this.baseY = this.y;
    this.vx = 0; this.vy = 0; this.f = -1; this.state = 'idle'; this.t = rand(0, 1); this.stagger = 0; this.stun = 0; this.flash = 0;
    const k = 1 + 0.34 * (lv - 1);
    this.maxHp = Math.round(D.hp * k * (o.elite ? 3.2 : 1)); this.hp = this.maxHp;
    this.dmg = D.dmg * (1 + 0.27 * (lv - 1)) * (o.elite ? 1.4 : 1); this.def = D.def + lv * 0.8;
    this.sc = D.sc * (o.elite ? 1.15 : 1);
    const [sw, sh] = SPR.size(D.idle, this.sc);
    this.w = Math.max(50, Math.min(110, sw * 0.5)); this.h = D.fly ? sh * 0.9 : sh * 0.88;
    this.elite = !!o.elite; this.name = o.name || D.n; this.burnT = 0; this.burnD = 0; this.hackT = 0; this.invul = 0; this.dead = false; this.deadT = 0;
    this.spd = D.spd * rand(0.9, 1.1); this.cool = rand(0.5, 1.5); this.air = false; this.aggro = false; this.shots = 0;
    if (o.elite) this.superArmor = true;
  }
  burn(dps, t, hack) { this.burnT = Math.max(this.burnT, t); this.burnD = Math.max(this.burnD, dps); if (!hack) FX.text(this.x, this.y - this.h - 30, '화상', '#ff7a3d'); }
  doStun(t) { this.stun = Math.max(this.stun, t); if (this.state === 'wind' || this.state === 'attack') this.state = 'chase'; FX.text(this.x, this.y - this.h - 30, '기절', '#bfe6ff'); }
  die() {
    if (this.dead) return; this.dead = true; this.deadT = 0.6;
    FX.burst(this.x, this.y - this.h / 2, this.D.fly ? '#d6ff3e' : '#ff3fa4', 18, 380, 0.6, 5);
    G.onKill(this);
  }
  update(dt) {
    if (this.dead) { this.deadT -= dt; return; }
    const p = G.P;
    if (this.flash > 0) this.flash -= dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.hackT > 0) this.hackT -= dt;
    if (this.burnT > 0) { this.burnT -= dt; this.burnTick = (this.burnTick || 0) + dt; if (this.burnTick >= 0.5) { this.burnTick = 0; hitEnemy(this, this.burnD * 0.5, { kind: 'skill', dot: true }); FX.burst(this.x, this.y - this.h * 0.6, '#ff7a3d', 3, 80, 0.4, 3, -200); } if (this.dead) return; }
    // 물리
    this.vx *= Math.pow(0.02, dt);
    if (!this.D.fly) { this.vy += GRAV * dt; this.y += this.vy * dt; if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.air = false; } }
    this.x += this.vx * dt;
    const L = G.arena ? G.arena[0] + 40 : 40, R = G.arena ? G.arena[1] - 40 : G.map.w - 40; this.x = clamp(this.x, L, R);
    if (this.stun > 0) { this.stun -= dt; return; }
    if (this.stagger > 0) { this.stagger -= dt; return; }
    const dx = p.x - this.x, adx = Math.abs(dx);
    const seen = p.cloakT <= 0 && !p.dead;
    if (!this.aggro && seen && adx < 760) this.aggro = true;
    if (!this.aggro) { this.t += dt; if (!this.D.fly) this.x += Math.sin(this.t * 0.7) * 30 * dt; else this.y = this.baseY + Math.sin(this.t * 2) * 12; return; }
    if (!seen) { this.state = 'idle'; if (this.D.fly) this.y = this.baseY + Math.sin((this.t += dt) * 2) * 12; return; }
    const D = this.D;
    this.cool -= dt;
    switch (this.state) {
      case 'idle': case 'chase': {
        this.state = 'chase';
        this.f = dx > 0 ? 1 : -1;
        if (D.ai === 'drone') {
          if (this.off == null) this.off = rand(180, 420) * (Math.random() < 0.5 ? 1 : -1);
          const want = p.x - this.off; this.x += clamp(want - this.x, -1, 1) * Math.min(Math.abs(want - this.x), this.spd * dt);
          this.t += dt; this.y = lerp(this.y, (this.hy || (this.hy = rand(330, 470))) + Math.sin(this.t * 2.2) * 30, dt * 2);
          if (this.cool <= 0 && adx < D.reach) { this.state = 'wind'; this.t2 = D.wind; }
        } else if (D.ai === 'ranged') {
          const ideal = D.reach * 0.7;
          if (adx > D.reach) this.x += this.f * this.spd * dt;
          else if (adx < ideal * 0.6) this.x -= this.f * this.spd * 0.7 * dt;
          if (this.cool <= 0 && adx < D.reach) { this.state = 'wind'; this.t2 = D.wind; }
        } else {
          const reach = D.ai === 'melee' ? D.reach : D.reach;
          if (adx > reach * (D.ai === 'melee' ? 0.85 : 1)) this.x += this.f * this.spd * dt;
          else if (this.cool <= 0) { this.state = 'wind'; this.t2 = D.wind; }
        }
        break;
      }
      case 'wind': {
        this.t2 -= dt;
        if (D.ai !== 'dasher' && D.ai !== 'brute') this.f = dx > 0 ? 1 : -1;
        if (this.t2 <= 0) { this.state = 'attack'; this.atkStart(); }
        break;
      }
      case 'attack': this.atkUpdate(dt); break;
      case 'recover': this.t2 -= dt; if (this.t2 <= 0) { this.state = 'chase'; this.cool = rand(0.6, 1.4) * (this.elite ? 0.7 : 1); } break;
    }
  }
  atkStart() {
    const D = this.D, p = G.P;
    this.t2 = 0.25; this.hitDone = false;
    if (D.ai === 'melee') { this.vx = this.f * 260; SND.play('slash'); FX.slash(this.x + this.f * 60, this.y - this.h * 0.55, this.f, 70, '#ff3b5c', 18, 0.18); }
    if (D.ai === 'ranged' || D.ai === 'drone') {
      const n = D.burst || 1;
      for (let i = 0; i < n; i++) setTimeout(() => { if (this.dead || this.stun > 0) return; const sy = this.y - this.h * (D.fly ? 0.4 : 0.62); const ang = Math.atan2((p.y - 90) - sy, p.x - this.x); G.eshoot(this.x + this.f * 30, sy, Math.cos(ang) * 760, Math.sin(ang) * 760, this.dmg, D.fly ? '#d6ff3e' : '#ff5f5f', this); SND.play('shot'); }, i * 130);
      this.t2 = 0.3 + n * 0.13;
    }
    if (D.ai === 'dasher') { this.vx = this.f * 1100; this.t2 = 0.36; SND.play('dash'); }
    if (D.ai === 'brute') { const tx = clamp(p.x, 60, G.map.w - 60); this.vx = (tx - this.x) / 0.6; this.vy = -1050; this.t2 = 0.62; this.leap = true; }
  }
  atkUpdate(dt) {
    const D = this.D, p = G.P;
    this.t2 -= dt;
    if (D.ai === 'melee' && !this.hitDone && this.t2 < 0.15) {
      this.hitDone = true;
      if ((p.x - this.x) * this.f > -30 && Math.abs(p.x - this.x) < D.reach + 30 && Math.abs(p.y - this.y) < 150) p.hurt(this.dmg, this.x, { src: this });
    }
    if (D.ai === 'dasher') {
      if (!this.hitDone && Math.abs(p.x - this.x) < 60 && Math.abs(p.y - this.y) < 140) { this.hitDone = true; p.hurt(this.dmg * 1.2, this.x, { src: this }); }
      if (Math.random() < 0.5) FX.parts.push({ x: this.x, y: this.y - rand(20, 140), vx: 0, vy: 0, life: 0.2, max: 0.2, c: '#b06bff', s: 4, g: 0 });
    }
    if (D.ai === 'brute' && this.leap && this.y >= GROUND && this.t2 < 0.5) {
      this.leap = false; this.vx = 0; FX.shake(10, 0.25); FX.ring(this.x, GROUND, 190, '#ff7a3d', 0.4, 10); SND.play('boom');
      if (Math.abs(p.x - this.x) < 190 && p.y > GROUND - 120) p.hurt(this.dmg * 1.3, this.x, { src: this, big: true });
    }
    if (this.t2 <= 0) { this.state = 'recover'; this.t2 = D.ai === 'brute' ? 1.0 : 0.55; }
  }
  draw(ctx) {
    const D = this.D;
    const a = this.dead ? Math.max(0, this.deadT / 0.6) : 1;
    const atkPose = this.state === 'attack' || (this.state === 'wind' && this.t2 < 0.15);
    const name = atkPose ? D.atk : D.idle;
    const A = this.anim || (this.anim = new Animator());
    A.tick(G.time, this.x, this.y);
    if (this.flash > (A.fl || 0) + 0.02 && !this.dead) { A.kick = 1; A.bump(-1.6); } A.fl = this.flash; // 맞으면 뒤로 젖혀진다
    if (this.state !== A.st) { if (this.state === 'attack') { A.bump(D.ai === 'brute' ? 3 : -2.6); A.lunge = 1; } if (A.st === 'attack') A.bump(-1); A.st = this.state; }
    if (!D.fly && !this.air && A.air) A.bump(-3); A.air = this.y < GROUND - 2;
    const P = A.begin();
    let rot = 0, yo = 0;
    const sp = Math.abs(A.vx);
    if (D.fly) {
      rot = clamp(A.vx * 0.0007, -0.25, 0.25); P.sy *= 1 + Math.sin(A.t * 9) * 0.03;
    } else if (!atkPose) {
      A.breathe(P, 1.1);
      if (RIG[name]) { const amp = A.walk(P, sp, { len: 120 * this.sc / 0.8, full: 220 }, D.ai === 'brute' ? 0.28 : 0.34); P.lean = clamp(A.vx * this.f / 260, -0.6, 1) * 0.07 + amp * 0.02; }
      else yo = -Math.round(Math.abs(Math.sin(A.t * 9)) * 4 * Math.min(1, sp / 120));
    }
    if (this.state === 'wind') { // 예비 동작: 몸을 웅크리며 뒤로 젖힌다
      const k = clamp(1 - this.t2 / (D.wind || 0.5), 0, 1);
      P.sy *= 1 - 0.06 * k; P.sx *= 1 + 0.04 * k; P.lean -= 0.07 * k; P.ox += Math.round(Math.sin(G.time * 60) * 1.5 * k);
    }
    if (atkPose) P.lean += 0.05;
    P.lean -= A.kick * 0.12; P.ox += A.lunge * 12 - A.kick * 6;
    if (this.stun > 0) P.sway = Math.sin(G.time * 7) * 0.02;
    if (this.dead) { // 쓰러진다
      const k = 1 - this.deadT / 0.6, e = k * k;
      if (D.fly) { rot = e * 2.4 * this.f; yo = e * 120; } else { rot = -this.f * e * 1.35; P.sy *= 1 - e * 0.1; }
    }
    const [ff, tsx] = A.face(this.f); P.sx *= tsx;
    ctx.fillStyle = `rgba(0,0,0,${0.3 * a})`; ctx.beginPath(); ctx.ellipse(this.x, GROUND + 2, this.w * 0.7, 7, 0, 0, 7); ctx.fill();
    backGlow(ctx, this.x, this.y - this.h * 0.5, this.h * 0.7, this.elite ? '#ffd23e' : '#ff3b5c', 0.12 * a);
    const wind = this.state === 'wind';
    SPR.pose(ctx, name, this.x, this.y + yo, { sc: this.sc, f: ff, rot, alpha: a, flash: this.flash > 0 ? 0.85 : (wind ? 0.25 + 0.25 * Math.sin(G.time * 40) : 0), tint: this.elite ? '#ff2a4a' : (this.hackT > 0 ? '#7c6bff' : null), tintA: this.elite ? 0.22 : 0.3 }, P);
    if (this.dead) return;
    // 공격 예고
    if (wind) {
      ctx.save(); ctx.font = FONT(28, true); ctx.textAlign = 'center'; ctx.fillStyle = '#ff3b5c'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.strokeText('!', this.x, this.y - this.h - 34); ctx.fillText('!', this.x, this.y - this.h - 34); ctx.restore();
      if (D.ai === 'ranged' || D.ai === 'drone') { const p = G.P; ctx.strokeStyle = 'rgba(255,60,90,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(this.x, this.y - this.h * (D.fly ? 0.4 : 0.62)); ctx.lineTo(p.x, p.y - 90); ctx.stroke(); ctx.setLineDash([]); }
      if (D.ai === 'dasher') { ctx.fillStyle = 'rgba(255,60,90,0.15)'; ctx.fillRect(this.f > 0 ? this.x : this.x - 420, this.y - 150, 420, 150); }
    }
    // 체력바
    if (this.hp < this.maxHp || this.elite) {
      const w = this.elite ? 120 : 80, x = this.x - w / 2, y = this.y - this.h - 18;
      ctx.fillStyle = 'rgba(5,3,12,0.8)'; ctx.fillRect(x - 2, y - 2, w + 4, 10);
      ctx.fillStyle = this.elite ? '#ff2a4a' : '#ff4f6d'; ctx.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), 6);
      ctx.font = FONT(13); ctx.textAlign = 'center'; ctx.fillStyle = this.elite ? '#ffd23e' : '#c9d2e3';
      ctx.fillText(`Lv.${this.lv} ${this.name}`, this.x, y - 6);
    }
    if (this.stun > 0) { ctx.fillStyle = '#bfe6ff'; for (let i = 0; i < 3; i++) { const a2 = G.time * 6 + i * 2.1; ctx.fillRect(this.x + Math.cos(a2) * 26 - 3, this.y - this.h - 40 + Math.sin(a2) * 6, 6, 6); } }
  }
}

/* ── 보스 ── */
class Boss extends Enemy {
  constructor(id, x) {
    const B = BOSSES[id];
    super('psy', x, B.lv);
    this.id = id; this.B = B; this.boss = true; this.name = B.n;
    this.maxHp = B.hp; this.hp = B.hp; this.dmg = B.dmg; this.def = B.def; this.sc = B.sc;
    const [sw, sh] = SPR.size(B.idle, this.sc);
    this.w = sw * 0.32; this.h = sh * 0.82;
    this.D = { idle: B.idle, atk: B.atk, ai: 'boss', fly: id !== 'red' };
    this.y = GROUND; this.f = -1; this.state = 'intro'; this.t2 = 1.2; this.phase = 1; this.patIdx = 0; this.tele = []; this.orbs = []; this.spd = 260;
    this.hover = id !== 'red' ? 30 : 0; this.alpha = 1; this.aggro = true; this.summoned = false; this.seraHelpT = 8;
  }
  die() {
    if (this.dead) return; this.dead = true; this.deadT = 2.5;
    FX.shake(20, 1); FX.flash('#ffffff', 0.4); SND.play('boom');
    for (let i = 0; i < 6; i++) setTimeout(() => FX.burst(this.x + rand(-120, 120), this.y - rand(50, 300), this.B.c, 30, 500, 0.9, 6), i * 200);
    G.onBossDown(this);
  }
  update(dt) {
    if (this.dead) { this.deadT -= dt; return; }
    const p = G.P;
    if (this.flash > 0) this.flash -= dt;
    if (this.hackT > 0) this.hackT -= dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.burnT > 0) { this.burnT -= dt; this.burnTick = (this.burnTick || 0) + dt; if (this.burnTick >= 0.5) { this.burnTick = 0; hitEnemy(this, this.burnD * 0.5, { kind: 'skill', dot: true }); } if (this.dead) return; }
    this.tele = this.tele.filter((t) => { t.t -= dt; if (t.t <= 0 && !t.fired) { t.fired = true; t.fire(); } return t.t > -t.linger; });
    for (const o of this.orbs) { o.a += dt * 2; o.cd -= dt; o.x = this.x + Math.cos(o.a) * 170; o.y = this.y - this.h * 0.6 + Math.sin(o.a) * 110; if (o.cd <= 0) { o.cd = this.phase > 1 ? 1.2 : 1.8; const ang = Math.atan2(p.y - 90 - o.y, p.x - o.x); G.eshoot(o.x, o.y, Math.cos(ang) * 620, Math.sin(ang) * 620, this.dmg * 0.6, '#ffd36a', this, 12); } }
    if (this.stun > 0) { this.stun -= dt; return; }
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2; FX.flash(this.B.c, 0.3); FX.shake(12, 0.5); this.t2 = 1; this.state = 'idle';
      FX.text(this.x, this.y - this.h - 40, '분노!', this.B.c, true);
      if (this.id === 'red' && !this.summoned) { this.summoned = true; G.spawn('thug', this.x - 300, 12); G.spawn('thug', this.x + 200, 12); }
      if (this.id === 'oracle') { G.say('ora_phase2'); this.orbs.push({ a: 3, cd: 1, x: 0, y: 0 }); if (G.S.aff >= 50) G.after(1.5, () => G.say('ora_sera', () => { G.seraSupport = true; })); }
    }
    if (G.seraSupport && this.id === 'oracle' && (this.seraHelpT -= dt) <= 0) { this.seraHelpT = 15; p.heal(G.st.maxHp * 0.15); FX.ring(p.x, p.y - 80, 160, '#ff8ad8', 0.6, 8); FX.text(p.x, p.y - 230, '세라의 빛', '#ff8ad8', true); SND.play('heal'); }
    const spdK = this.phase > 1 ? 1.3 : 1;
    if (this.hover) this.y = GROUND - this.hover - Math.sin(G.time * 1.6) * 14;
    this.t2 -= dt * spdK;
    const dx = p.x - this.x;
    if (this.state === 'intro') { if (this.t2 <= 0) { this.state = 'idle'; this.t2 = 0.8; } return; }
    if (this.state === 'idle') {
      if (this.id !== 'oracle' && Math.abs(dx) > 260) this.x += Math.sign(dx) * this.spd * 0.6 * dt * spdK;
      this.f = dx > 0 ? 1 : -1;
      if (this.t2 <= 0) this.pattern();
      return;
    }
    if (this.state === 'act') { this.act && this.act(dt); if (this.t2 <= 0) { this.state = 'idle'; this.t2 = (this.phase > 1 ? 0.7 : 1.1); this.pose = null; } }
  }
  tel(t, draw, fire, linger = 0.25) { this.tele.push({ t, max: t, draw, fire, linger, fired: false }); }
  pattern() {
    const p = G.P, me = this;
    const pats = {
      red: this.phase > 1 ? ['charge', 'leap', 'saw', 'swipe', 'leap', 'charge'] : ['swipe', 'charge', 'saw', 'leap'],
      halo: this.phase > 1 ? ['rain', 'blink', 'sweep', 'fan', 'rain', 'blink'] : ['rain', 'blink', 'sweep', 'blink'],
      oracle: this.phase > 1 ? ['pillars', 'beam', 'wave', 'summon', 'pillars', 'beam'] : ['orbs', 'pillars', 'wave', 'summon', 'pillars'],
    }[this.id];
    const pat = pats[this.patIdx++ % pats.length];
    this.state = 'act'; this.act = null; this.pose = 'atk';
    const L = G.arena[0] + 60, R = G.arena[1] - 60;
    const dmg = this.dmg;
    switch (pat) {
      case 'swipe': {
        this.t2 = 1.0; this.f = p.x > this.x ? 1 : -1; SND.play('warn');
        const fx = this.f;
        this.tel(0.55, (ctx, k) => { ctx.fillStyle = `rgba(255,59,92,${0.12 + 0.2 * (1 - k)})`; ctx.fillRect(fx > 0 ? me.x : me.x - 330, GROUND - 260, 330, 260); }, () => {
          FX.slash(me.x + fx * 150, GROUND - 120, fx, 170, me.B.c, 40, 0.25); SND.play('heavy'); FX.shake(8, 0.2);
          if ((p.x - me.x) * fx > -40 && Math.abs(p.x - me.x) < 340 && p.y > GROUND - 280) p.hurt(dmg * 1.2, me.x, { src: me, big: true });
        });
        break;
      }
      case 'charge': {
        const dir = p.x > this.x ? 1 : -1; this.t2 = 2.0; SND.play('warn');
        this.tel(0.85, (ctx, k) => { ctx.fillStyle = `rgba(255,59,92,${0.15 + 0.2 * Math.sin(G.time * 30)})`; ctx.fillRect(L, GROUND - 110, R - L, 110); ctx.fillStyle = '#ff3b5c'; ctx.font = FONT(22, true); ctx.textAlign = 'center'; ctx.fillText('점프로 피하세요!', (L + R) / 2, GROUND - 130); }, () => {
          me.charging = { dir, hit: false }; SND.play('dash');
        }, 0);
        this.act = (dt) => {
          if (!me.charging) return;
          me.x += me.charging.dir * 1500 * dt; me.f = me.charging.dir;
          FX.parts.push({ x: me.x, y: GROUND - rand(10, 100), vx: -me.charging.dir * 200, vy: -100, life: 0.3, max: 0.3, c: '#ff3b5c', s: 6, g: 0 });
          if (!me.charging.hit && Math.abs(p.x - me.x) < 80 && p.y > GROUND - 110) { me.charging.hit = true; p.hurt(dmg * 1.3, me.x, { src: me, big: true }); }
          if (me.x < L || me.x > R) { me.x = clamp(me.x, L, R); me.charging = null; FX.shake(10, 0.3); SND.play('boom'); }
        };
        break;
      }
      case 'leap': {
        this.t2 = 2.4; this.jumping = true; this.y = GROUND; let tx = p.x;
        this.act = (dt) => { if (me.jumping) { me.invul = 0.1; me.yOff = Math.min(900, (me.yOff || 0) + 2600 * dt); tx = lerp(tx, p.x, dt * 3); } };
        this.tel(1.2, (ctx, k) => { ctx.fillStyle = `rgba(255,59,92,${0.3 + 0.2 * Math.sin(G.time * 25)})`; ctx.beginPath(); ctx.ellipse(tx, GROUND, 130, 18, 0, 0, 7); ctx.fill(); me.leapX = tx; }, () => {
          me.jumping = false; me.x = me.leapX; me.yOff = 0; FX.shake(16, 0.4); SND.play('boom'); FX.ring(me.x, GROUND, 220, '#ff3b5c', 0.5, 12);
          if (Math.abs(p.x - me.x) < 170 && p.y > GROUND - 200) p.hurt(dmg * 1.5, me.x, { src: me, big: true });
          [-1, 1].forEach((d) => G.eshoot(me.x, GROUND - 26, d * 700, 0, dmg * 0.9, '#ff3b5c', me, 26, { ground: true }));
        });
        break;
      }
      case 'saw': {
        this.t2 = 1.6; const d = p.x > this.x ? 1 : -1; SND.play('warn');
        this.tel(0.5, (ctx) => { ctx.strokeStyle = 'rgba(255,59,92,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(me.x, GROUND - 95); ctx.lineTo(me.x + d * 1100, GROUND - 95); ctx.stroke(); ctx.setLineDash([]); }, () => {
          G.eshoot(me.x + d * 80, GROUND - 95, d * 1000, 0, dmg * 1.1, '#ff3b5c', me, 40, { saw: true, back: me, life: 2.4 }); SND.play('heavy');
        });
        break;
      }
      case 'rain': {
        this.t2 = 2.2; SND.play('warn');
        const n = this.phase > 1 ? 9 : 6, xs = [];
        for (let i = 0; i < n; i++) xs.push(i === 0 ? p.x : rand(L, R));
        xs.forEach((x, i) => this.tel(0.9 + i * 0.08, (ctx, k) => { ctx.fillStyle = `rgba(160,124,255,${0.12 + 0.25 * (1 - k)})`; ctx.fillRect(x - 40, 0, 80, GROUND); }, () => {
          FX.beam(x, -20, x, GROUND, '#a07cff', 30, 0.3); FX.ring(x, GROUND, 90, '#a07cff', 0.3, 6); SND.play('slash');
          if (Math.abs(p.x - x) < 55) p.hurt(dmg, x, { src: me });
        }));
        break;
      }
      case 'blink': {
        this.t2 = 1.5; this.alpha = 0.2;
        const side = p.f > 0 ? -1 : 1; const tx = clamp(p.x + side * 200, L, R);
        FX.burst(this.x, this.y - 150, '#a07cff', 20, 300, 0.4, 5, 0);
        this.x = tx; this.f = p.x > tx ? 1 : -1; const fx = this.f;
        this.tel(0.5, (ctx, k) => { me.alpha = 1 - k * 0.7; ctx.fillStyle = `rgba(160,124,255,${0.15 + 0.2 * (1 - k)})`; ctx.fillRect(fx > 0 ? me.x : me.x - 320, GROUND - 280, 320, 280); }, () => {
          me.alpha = 1; FX.slash(me.x + fx * 150, GROUND - 130, fx, 170, '#a07cff', 40, 0.25); SND.play('slash'); FX.shake(8, 0.2);
          if ((p.x - me.x) * fx > -40 && Math.abs(p.x - me.x) < 330 && p.y > GROUND - 300) p.hurt(dmg * 1.25, me.x, { src: me, big: true });
        });
        break;
      }
      case 'sweep': {
        this.t2 = 2.0; const low = Math.random() < 0.6; const yy = low ? GROUND - 55 : GROUND - 230; SND.play('warn');
        this.tel(1.0, (ctx, k) => { ctx.fillStyle = `rgba(160,124,255,${0.15 + 0.25 * Math.abs(Math.sin(G.time * 20))})`; ctx.fillRect(L, yy - 22, R - L, 44); ctx.fillStyle = '#d9c8ff'; ctx.font = FONT(22, true); ctx.textAlign = 'center'; ctx.fillText(low ? '점프!' : '땅에 머무르세요!', (L + R) / 2, yy - 34); }, () => {
          FX.beam(L, yy, R, yy, '#a07cff', 34, 0.35); FX.shake(10, 0.3); SND.play('boom');
          if (p.y - 165 < yy + 20 && p.y > yy - 20) p.hurt(dmg * 1.2, me.x, { src: me, big: true });
        });
        break;
      }
      case 'fan': {
        this.t2 = 1.4;
        this.tel(0.5, () => {}, () => { const base = Math.atan2(p.y - 90 - (me.y - me.h * 0.6), p.x - me.x); for (let i = -2; i <= 2; i++) { const a = base + i * 0.18; G.eshoot(me.x, me.y - me.h * 0.6, Math.cos(a) * 700, Math.sin(a) * 700, dmg * 0.8, '#a07cff', me, 18); } SND.play('slash'); });
        break;
      }
      case 'orbs': {
        this.t2 = 1.2; if (this.orbs.length < 2) { this.orbs.push({ a: 0, cd: 1.5, x: 0, y: 0 }); this.orbs.push({ a: Math.PI, cd: 2.2, x: 0, y: 0 }); }
        FX.ring(this.x, this.y - this.h * 0.6, 200, '#ffd36a', 0.5, 6);
        break;
      }
      case 'pillars': {
        this.t2 = 2.6; SND.play('warn');
        const n = 7, gap = randi(1, n - 2); const dirL = Math.random() < 0.5;
        for (let i = 0; i < n; i++) {
          if (i === gap) continue; const x = L + (R - L) * (i + 0.5) / n; const delay = 0.9 + (dirL ? i : n - i) * 0.12;
          this.tel(delay, (ctx, k) => { ctx.fillStyle = `rgba(255,211,106,${0.1 + 0.25 * (1 - k)})`; ctx.fillRect(x - (R - L) / n / 2 + 6, 0, (R - L) / n - 12, GROUND); }, () => {
            FX.beam(x, -10, x, GROUND, '#ffd36a', (R - L) / n * 0.6, 0.3); SND.play('boom');
            if (Math.abs(p.x - x) < (R - L) / n / 2) p.hurt(dmg, x, { src: me });
          });
        }
        break;
      }
      case 'wave': {
        this.t2 = 1.8; SND.play('warn');
        this.tel(0.6, (ctx, k) => { ctx.strokeStyle = `rgba(255,211,106,${0.6 * (1 - k)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(me.x, GROUND, 80 + 60 * k, Math.PI, 0); ctx.stroke(); }, () => {
          [-1, 1].forEach((d) => G.eshoot(me.x, GROUND - 30, d * 620, 0, dmg, '#ffd36a', me, 30, { ground: true }));
          if (me.phase > 1) G.after(0.6, () => [-1, 1].forEach((d) => G.eshoot(me.x, GROUND - 30, d * 620, 0, dmg, '#ffd36a', me, 30, { ground: true })));
          FX.ring(me.x, GROUND, 200, '#ffd36a', 0.4, 8);
        });
        break;
      }
      case 'summon': {
        this.t2 = 1.0; const n = G.enemies.filter((e) => !e.dead && !e.boss).length;
        if (n < 3) { G.spawn('drone2', clamp(this.x - 400, L, R), this.lv - 4); G.spawn(this.phase > 1 ? 'sin' : 'drone2', clamp(this.x - 700, L, R), this.lv - 4); FX.ring(this.x, this.y - 200, 300, '#ffd36a', 0.5, 6); }
        break;
      }
      case 'beam': {
        this.t2 = 2.6; SND.play('warn');
        this.tel(1.4, (ctx, k) => { ctx.fillStyle = `rgba(255,211,106,${0.12 + 0.25 * Math.abs(Math.sin(G.time * 18))})`; ctx.fillRect(L, GROUND - 150, R - L, 150); ctx.fillStyle = '#ffd36a'; ctx.font = FONT(22, true); ctx.textAlign = 'center'; ctx.fillText('발판 위로 피하세요!', (L + R) / 2, GROUND - 170); }, () => {
          FX.beam(me.x, GROUND - 75, L, GROUND - 75, '#ffd36a', 140, 0.6); FX.shake(18, 0.6); FX.flash('#ffd36a', 0.15); SND.play('boom');
          if (p.y > GROUND - 150 && p.y - 160 < GROUND) p.hurt(dmg * 1.6, me.x, { src: me, big: true });
        }, 0.3);
        break;
      }
    }
  }
  draw(ctx) {
    for (const t of this.tele) if (!t.fired) t.draw(ctx, Math.max(0, t.t / t.max));
    const a = this.dead ? Math.max(0, this.deadT / 2.5) : this.alpha;
    let yy = this.y - (this.yOff || 0);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, GROUND + 3, this.w * 1.1, 14, 0, 0, 7); ctx.fill();
    const name = this.pose === 'atk' && this.state === 'act' ? this.B.atk : this.B.idle;
    const A = this.anim || (this.anim = new Animator());
    A.tick(G.time, this.x, this.y);
    if (name !== A.prev) { if (A.prev) { A.bump(name === this.B.atk ? -2.4 : 1.4); if (name === this.B.atk) A.lunge = 1; } A.prev = name; }
    const P = A.begin();
    const cape = this.id !== 'red';
    P.waveFrom = cape ? 0.42 : 0.55;
    A.breathe(P, this.phase > 1 ? 1.6 : 1.2, this.phase > 1 ? 3.2 : 2);
    if (cape) { P.wave = this.phase > 1 ? 5 : 3.5; P.waveT = A.t * (this.phase > 1 ? 5 : 3.4); P.lean = clamp(A.vx / 900, -0.08, 0.08) * this.f; }
    else { // 레드 조: 무겁게 쿵쿵 걷는다
      const sp = Math.abs(A.vx), st = Math.floor(A.t * 7) % 2;
      if (sp > 20) { yy -= st * 4; P.sway += (st ? 0.012 : -0.008); P.lean = 0.04; }
    }
    if (this.state === 'act' && this.t2 > 0 && name === this.B.atk) P.lean += 0.03;
    P.ox += A.lunge * 16;
    let rot = 0;
    if (this.dead) { const k = 1 - this.deadT / 2.5; P.ox += rand(-4, 4) * (1 - k); yy += k * k * 60; P.sy *= 1 - k * 0.15; rot = -this.f * k * 0.2; }
    const [ff, tsx] = A.face(this.f); P.sx *= tsx;
    if (this.phase > 1) SPR.pose(ctx, name, this.x + rand(-2, 2), yy, { sc: this.sc * 1.03, f: ff, rot, alpha: a * 0.35, tint: this.B.c, tintA: 1 }, P);
    SPR.pose(ctx, name, this.x, yy, { sc: this.sc, f: ff, rot, alpha: a, flash: this.flash > 0 ? 0.6 : 0 }, P);
    for (const o of this.orbs) { ctx.fillStyle = '#ffd36a'; ctx.shadowColor = '#ffd36a'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(o.x, o.y, 14, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillRect(o.x - 4, o.y - 4, 8, 8); }
  }
}

/* ── 동료 세라 (타워 진입 중) ── */
class Companion {
  constructor(x) { this.x = x; this.y = GROUND; this.t = 0; this.healT = 6; this.shotT = 3; this.cast = 0; }
  update(dt) {
    const p = G.P; this.t += dt;
    const tx = p.x - p.f * 130; this.x = lerp(this.x, tx, Math.min(1, dt * 3)); this.y = lerp(this.y, Math.min(GROUND, p.y) - 30 - Math.sin(this.t * 2) * 10, Math.min(1, dt * 4));
    this.f = p.x > this.x ? 1 : -1;
    if (this.cast > 0) this.cast -= dt;
    if ((this.healT -= dt) <= 0) { this.healT = 12; if (p.hp < G.st.maxHp * 0.9) { p.heal(G.st.maxHp * 0.1); FX.ring(p.x, p.y - 80, 120, '#ff8ad8', 0.5, 6); SND.play('heal'); this.cast = 0.5; } }
    if ((this.shotT -= dt) <= 0) {
      this.shotT = 2.2;
      const e = G.enemies.filter((e) => !e.dead && Math.abs(e.x - this.x) < 700).sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0];
      if (e) { this.cast = 0.4; this.f = e.x > this.x ? 1 : -1; FX.beam(this.x + this.f * 40, this.y - 110, e.x, e.y - e.h / 2, '#ff6ab8', 5, 0.18); hitEnemy(e, G.st.atk * 0.45, { kind: 'skill', c: '#ff6ab8', ult: 0.5 }); }
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(255,106,184,0.18)'; ctx.beginPath(); ctx.ellipse(this.x, GROUND + 2, 34, 6, 0, 0, 7); ctx.fill();
    const A = this.anim || (this.anim = new Animator());
    A.tick(G.time, this.x, this.y);
    const name = this.cast > 0 ? 'sera_cast' : 'sera_idle';
    if (name !== A.prev) { if (A.prev) A.bump(name === 'sera_cast' ? -2 : 1.5); A.prev = name; }
    const P = A.begin();
    A.breathe(P, 1); P.waveFrom = 0.3; P.wave = 3 + Math.min(4, Math.abs(A.vx) / 80); P.waveT = A.t * 3;
    P.lean = clamp(A.vx / 1200, -0.12, 0.12) * this.f;
    const [ff, tsx] = A.face(this.f); P.sx *= tsx;
    SPR.pose(ctx, name, this.x, this.y, { sc: this.cast > 0 ? 0.85 : 0.72, f: ff, alpha: 0.95 }, P);
  }
}
