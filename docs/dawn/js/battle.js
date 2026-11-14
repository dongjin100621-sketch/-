'use strict';
/* 전투 규칙. 화면 없이 상태만 바꾸고, 일어난 일을 사건(events) 목록으로 돌려준다.
   화면(bview.js)은 사건을 차례로 연출한다. node 에서도 돈다(tools/dawn_sim.js).

   ■ 실드와 브레이크: 적마다 실드 수와 약점(무기·속성)이 있다. 약점으로 한 번 맞을 때마다 실드가 1 줄고,
     0이 되면 브레이크 — 이번 라운드 남은 행동과 다음 라운드 행동을 모두 잃고, 받는 피해가 2배가 된다.
     그다음 라운드 처음에 실드를 모두 되찾고 가장 먼저 움직인다. 모아 둔 강공격은 브레이크되면 취소된다.
   ■ 부스트: 라운드가 시작될 때 BP를 1 얻는다(최대 5, 직전 라운드에 부스트했으면 얻지 못함).
     한 행동에 BP를 3까지 써서 일반 공격은 타수를, 기술은 위력·타수·지속 턴을 늘린다.
   ■ 잠재력: 맞거나 적을 브레이크하면 게이지가 찬다. 가득 차면 사람마다 다른 고유 능력을 쓴다.
   ■ 전열·후열: 전열 넷이 싸우고 후열 넷은 쉰다. 자기 차례에 같은 열의 후열과 교대하면 들어온 사람이 바로 행동한다.
     후열은 라운드마다 HP 10%·SP 6%를 되찾는다. 전열이 모두 쓰러지면 살아 있는 후열이 저절로 나선다. */

const Battle = (() => {
  const BUFF_UP = 1.35, BUFF_DOWN = 0.7, MAX_BP = 5;
  const BOOST_POWER = [1, 1.9, 2.8, 3.7, 4.6, 5.5];
  const STATUS_TURNS = { poison: 3, blind: 3, sleep: 2 };

  function create(G, enemyIds, opts = {}) {
    const rng = opts.rng || makeRng((Math.random() * 4294967296) >>> 0);
    const b = {
      G, rng, round: 0, queue: [], waiting: null, over: null, ev: [],
      front: [null, null, null, null], back: [null, null, null, null], enemies: [],
      rolls: {}, seq: 0, noEscape: !!opts.noEscape, started: false, rewards: null, log: { breaks: 0, maxDmg: 0 }
    };

    /* ── 유닛 ── */
    function heroUnit(h) {
      const s = Party.stats(h);
      return {
        side: 'p', uid: 'h:' + h.id, id: h.id, h, name: HEROES[h.id].name, spr: HEROES[h.id].spr,
        base: s, maxhp: s.hp, maxsp: s.sp, hp: Math.min(h.hp, s.hp), sp: Math.min(h.sp, s.sp),
        bp: Math.min(MAX_BP, 1 + s.startBp), latent: h.latent || 0, latentUp: s.latentUp, immune: s.immune, fx: s.fx,
        buffs: {}, status: {}, defending: false, defendNext: 0, boosted: false, taunt: 0, regen: null, la: null,
        revived: false, tally: { breaks: 0, kills: 0, maxhit: 0, heal: 0, skills: 0 }
      };
    }
    function freeSlot() {
      const used = new Set(b.enemies.filter(e => e.hp > 0).map(e => e.slot));
      for (let i = 0; i < 6; i++) if (!used.has(i)) return i;
      return 5;
    }
    function addEnemy(id) {
      const d = ENEMIES[id];
      const e = {
        side: 'e', uid: 'e' + (++b.seq), id, d, name: d.name, spr: d.spr, big: !!d.big, boss: !!d.boss,
        base: { patk: d.patk, matk: d.matk, pdef: d.pdef, mdef: d.mdef, spd: d.spd, crit: 0 },
        maxhp: d.hp, hp: d.hp, shield: d.shield, maxShield: d.shield, weak: d.weak,
        buffs: {}, status: {}, broken: false, recoverRound: 0, acts: d.acts || 1, pidx: 0, phase: 0,
        pattern: d.pattern || null, charging: null, stolen: false, used: {}, slot: freeSlot(),
        ward: d.ward || null      // 'phys' 또는 'mag': 그 피해를 절반만 받는다. 브레이크하면 벗겨진다
      };
      b.enemies.push(e);
      return e;
    }
    for (let c = 0; c < 4; c++) {
      if (G.front[c]) b.front[c] = heroUnit(G.heroes[G.front[c]]);
      if (G.back[c]) b.back[c] = heroUnit(G.heroes[G.back[c]]);
    }
    enemyIds.forEach(addEnemy);

    /* ── 도구 ── */
    const push = (e) => b.ev.push(e);
    const msg = (text) => push({ t: 'msg', text });
    const alive = (u) => u && u.hp > 0;
    const liveEnemies = () => b.enemies.filter(alive);
    const liveFront = () => b.front.filter(alive);
    const unit = (uid) => b.enemies.find(e => e.uid === uid) || [...b.front, ...b.back].find(u => u && u.uid === uid) || null;
    const colOf = (u) => b.front.indexOf(u);
    const st = (u, k) => {
      let v = u.base[k];
      const bf = u.buffs[k];
      if (bf) v *= bf.lv > 0 ? BUFF_UP : BUFF_DOWN;
      return v;
    };
    const dex = (id) => (b.G.dex[id] = b.G.dex[id] || []);
    const isRevealed = (e, type) => dex(e.id).includes(type);
    function reveal(e, type) {
      const d = dex(e.id);
      if (!d.includes(type)) { d.push(type); push({ t: 'reveal', uid: e.uid, type }); }
    }
    function addLatent(u, amt) {
      if (u.side !== 'p' || !alive(u)) return;
      const before = u.latent;
      u.latent = Math.min(100, u.latent + amt * (1 + u.latentUp));
      if (before < 100 && u.latent >= 100) push({ t: 'latentReady', uid: u.uid });
    }
    function setBuff(u, k, lv, turns) {
      u.buffs[k] = { lv, turns };
      push({ t: 'buff', uid: u.uid, stat: k, lv });
    }
    function applyStatus(t, [s, chance]) {
      if (!alive(t)) return;
      if (t.side === 'p' && t.immune.includes(s)) return;
      if (t.side === 'e' && (s === 'sleep' || (t.boss && s !== 'poison' && s !== 'blind'))) return;
      if (!b.rng.chance(chance)) return;
      t.status[s] = STATUS_TURNS[s];
      push({ t: 'status', uid: t.uid, status: s, on: true });
    }

    /* ── 차례 정하기 ── */
    const keyOf = (en) => en.kind === 'p' ? 'p' + en.col : en.uid + '#' + en.n;
    const roll = (key) => (key in b.rolls) ? b.rolls[key] : (b.rolls[key] = b.rng.range(0.82, 1.18));
    function entriesFor(r) {
      const list = [];
      for (let c = 0; c < 4; c++) if (alive(b.front[c])) list.push({ kind: 'p', col: c });
      for (const e of b.enemies) {
        if (!alive(e)) continue;
        if (e.broken && e.recoverRound > r) continue;
        for (let n = 0; n < e.acts; n++) list.push({ kind: 'e', uid: e.uid, n });
      }
      return list;
    }
    function sortEntries(list, r) {
      for (const en of list) {
        if (en.kind === 'p') {
          const u = b.front[en.col];
          en.prio = st(u, 'spd') * roll(keyOf(en)) + (u.defendNext === r ? 10000 : 0);
        } else {
          const e = unit(en.uid);
          en.prio = st(e, 'spd') * roll(keyOf(en)) * (en.n ? 0.8 - en.n * 0.1 : 1) + (e.recoverRound === r ? 5000 : 0);
        }
      }
      return list.sort((x, y) => y.prio - x.prio);
    }
    /* 화면에 보여 줄 차례: 이번 라운드 남은 차례(지금 행동 중인 사람 포함)와 다음 라운드 */
    function orderNow() {
      const out = [];
      if (b.waiting) out.push({ kind: 'p', col: b.waiting.col, now: true });
      else if (b.acting) out.push({ ...b.acting, now: true });
      for (const en of b.queue) out.push(en);
      return out.map(en => ({ ...en, u: en.kind === 'p' ? b.front[en.col] : unit(en.uid) })).filter(en => alive(en.u));
    }
    function orderNext() {
      const r = b.round + 1;
      const list = sortEntries(entriesFor(r), r).map(en => ({ ...en, u: en.kind === 'p' ? b.front[en.col] : unit(en.uid) }));
      for (const e of b.enemies) if (alive(e) && e.broken && e.recoverRound > r) list.push({ kind: 'e', uid: e.uid, u: e, broken: true });
      return list;
    }

    /* ── 라운드 ── */
    function startRound() {
      b.round++;
      if (b.round > 1) {
        const gains = [];
        for (const u of [...b.front, ...b.back]) {
          if (!alive(u)) continue;
          const gain = (u.boosted ? 0 : 1) + u.fx.bpUp;
          if (gain && u.bp < MAX_BP) { u.bp = Math.min(MAX_BP, u.bp + gain); gains.push(u.uid); }
          u.boosted = false;
        }
        if (gains.length) push({ t: 'bpgain', uids: gains });
      }
      for (const e of b.enemies) {
        if (alive(e) && e.broken && e.recoverRound === b.round) {
          e.broken = false; e.shield = e.maxShield;
          push({ t: 'recover', uid: e.uid, shield: e.shield });
        }
      }
      b.queue = sortEntries(entriesFor(b.round), b.round);
      b.rolls = {};
      push({ t: 'round', n: b.round });
    }

    function endRound() {
      const everyone = [...b.front, ...b.back, ...b.enemies];
      for (const u of everyone) {
        if (!alive(u)) continue;
        if (u.status.poison) {
          const dmg = u.side === 'p' ? Math.round(u.maxhp * 0.08) : Math.round(Math.min(u.maxhp * 0.05, 700));
          u.hp = Math.max(0, u.hp - dmg);
          push({ t: 'dot', uid: u.uid, dmg, hp: u.hp });
          if (u.hp <= 0) { ko(u); continue; }
        }
        if (u.regen) {
          const amt = Math.min(u.regen.amount, u.maxhp - u.hp);
          u.hp += amt;
          push({ t: 'heal', uid: u.uid, amount: amt, hp: u.hp });
          if (--u.regen.turns <= 0) u.regen = null;
        }
        for (const s of Object.keys(u.status)) {
          if (--u.status[s] <= 0) { delete u.status[s]; push({ t: 'status', uid: u.uid, status: s, on: false }); }
        }
        for (const k of Object.keys(u.buffs)) {
          if (--u.buffs[k].turns <= 0) { delete u.buffs[k]; push({ t: 'buff', uid: u.uid, stat: k, lv: 0 }); }
        }
        if (u.taunt) u.taunt--;
      }
      for (const u of b.front) {
        if (!alive(u) || !u.fx.regen || u.hp >= u.maxhp) continue;
        healUnit(u, Math.ceil(u.maxhp * u.fx.regen));
      }
      for (const u of b.back) {
        if (!alive(u)) continue;
        const hp = Math.min(u.maxhp - u.hp, Math.ceil(u.maxhp * 0.1));
        const sp = Math.min(u.maxsp - u.sp, Math.ceil(u.maxsp * 0.06));
        u.hp += hp; u.sp += sp;
        if (hp || sp) push({ t: 'rest', uid: u.uid, hp: u.hp, sp: u.sp });
      }
      checkEnd();
    }

    /* ── 피해 ── */
    function strike(att, t, o) {
      if (!alive(t)) return 0;
      if (o.kind === 'phys' && !o.fixed) {
        if (att.status.blind && b.rng.chance(0.5)) { push({ t: 'miss', uid: t.uid, src: att.uid }); return 0; }
        if (t.side === 'e' && t.d.evade && b.rng.chance(t.d.evade)) { push({ t: 'miss', uid: t.uid, src: att.uid }); return 0; }
        if (t.side === 'p' && t.fx.evade && b.rng.chance(t.fx.evade)) { push({ t: 'miss', uid: t.uid, src: att.uid }); return 0; }
      }
      let dmg;
      if (o.fixed) dmg = o.fixed;
      else {
        const A = st(att, o.kind === 'phys' ? 'patk' : 'matk');
        const D = st(t, o.kind === 'phys' ? 'pdef' : 'mdef');
        dmg = 2 * A * A / (A + D) * o.power / 100;
      }
      // 약점: 기술·무기 속성, 그리고 유물이 더해 주는 속성(alt)
      const weakType = t.side === 'e' ? [o.type, ...(o.alt || [])].find(x => x && t.weak.includes(x)) : null;
      const weak = !!weakType;
      if (weak) dmg *= 1.3;
      // 반감 갑옷(브레이크하면 벗겨짐)과 호위(호위 부하가 살아 있으면 보스가 받는 피해 절반)
      let warded = false, guarded = false;
      if (t.side === 'e' && !o.fixed) {
        if (t.ward && t.ward === o.kind) { dmg *= 0.5; warded = true; }
        if (t.boss && guardsOf(t).length) { dmg *= 0.5; guarded = true; }
      }
      if (t.side === 'e' && t.broken) dmg *= 2 * (att.side === 'p' ? 1 + att.fx.breakDmg : 1);
      if (att.side === 'p' && o.kind === 'mag' && !o.fixed && att.fx.magUp) dmg *= 1 + att.fx.magUp;
      if (t.side === 'p' && o.type && t.fx.resist.includes(o.type)) dmg *= 0.5;
      let crit = false;
      if (att.side === 'p' && o.kind === 'phys' && !o.fixed) crit = att.la === 'valor' || b.rng.chance(st(att, 'crit') / 100);
      if (crit) dmg *= 1.5;
      if (o.mult) dmg *= o.mult;
      if (t.side === 'p' && t.defending) dmg *= 0.5;
      dmg = Math.max(1, Math.round(dmg * b.rng.range(0.93, 1.07)));
      // 페이즈 관문: 보스는 다음 페이즈 HP 아래로 한 번에 내려가지 않는다(넘치는 피해는 사라지고 곧 페이즈가 바뀐다)
      let gate = false;
      if (t.side === 'e' && t.d.phases && t.phase < t.d.phases.length) {
        const g = Math.floor(t.d.phases[t.phase].hp * t.maxhp);
        if (t.hp > g && t.hp - dmg <= g) { dmg = t.hp - g; gate = true; }
      }
      t.hp = Math.max(0, t.hp - dmg);
      if (att.side === 'p') { b.log.maxDmg = Math.max(b.log.maxDmg, dmg); att.tally.maxhit = Math.max(att.tally.maxhit, dmg); }
      let shieldHit = 0;
      if (t.side === 'e' && !t.broken && (weak || (att.la === 'valor' && !o.fixed))) {
        shieldHit = Math.min(t.shield, att.la === 'hawk' ? 2 : 1);
        t.shield -= shieldHit;
      }
      if (weak) reveal(t, weakType);
      push({ t: 'hit', uid: t.uid, src: att.uid, dmg, weak, crit, hp: t.hp, shield: t.shield, shieldHit, type: o.type || null, warded, guarded });
      if (t.side === 'p') {
        addLatent(t, dmg / t.maxhp * 90);
        if (t.status.sleep && t.hp > 0) { delete t.status.sleep; push({ t: 'status', uid: t.uid, status: 'sleep', on: false }); }
      }
      if (gate) enterPhase(t);
      else if (shieldHit && t.shield <= 0 && !t.broken) doBreak(t, att);
      if (t.hp <= 0) { if (t.side === 'e' && att.side === 'p') att.tally.kills++; ko(t); }
      if (att.side === 'p' && att.fx.drain && alive(att) && t.side === 'e') healUnit(att, dmg * att.fx.drain);
      return dmg;
    }
    /* 다음 페이즈: 브레이크에서 깨어나 실드를 가득 채우고, 행동·약점·갑옷·부하가 바뀐다 */
    function enterPhase(e) {
      const ph = e.d.phases[e.phase++];
      if (ph.shield) e.maxShield += ph.shield;
      e.shield = e.maxShield;
      const wasBroken = e.broken;
      e.broken = false; e.recoverRound = 0; e.charging = null;
      if (ph.acts) e.acts = ph.acts;
      if (ph.pattern) { e.pattern = ph.pattern; e.pidx = 0; }
      if (ph.weak) e.weak = ph.weak;
      push({ t: 'phase', uid: e.uid, msg: ph.msg, shield: e.shield, maxShield: e.maxShield, weakChanged: !!ph.weak, woke: wasBroken });
      if (ph.ward !== undefined) setWard(e, ph.ward);
      for (const id of ph.summon || []) {
        if (liveEnemies().length >= 4) break;
        const n = addEnemy(id);
        push({ t: 'summon', uid: n.uid, src: e.uid, name: n.name });
      }
    }
    const guardsOf = (boss) => b.enemies.filter(m => m !== boss && alive(m) && m.d.guard);
    function setWard(e, kind) {
      e.ward = kind;
      push({ t: 'ward', uid: e.uid, on: !!kind, kind });
    }
    function doBreak(e, att) {
      e.broken = true; e.shield = 0;
      if (e.ward) setWard(e, null);
      e.recoverRound = b.round + 2;
      b.queue = b.queue.filter(en => en.uid !== e.uid);
      const wasCharging = !!e.charging;
      e.charging = null;
      push({ t: 'break', uid: e.uid, canceled: wasCharging });
      b.log.breaks++;
      if (b.G.stats) b.G.stats.breaks = (b.G.stats.breaks || 0) + 1;
      if (att && att.side === 'p') { addLatent(att, 30); att.tally.breaks++; }
    }
    function ko(u) {
      u.hp = 0;
      if (u.side === 'p') { u.status = {}; u.buffs = {}; u.taunt = 0; u.regen = null; u.bp = 0; u.la = null; u.defending = false; }
      else b.queue = b.queue.filter(en => en.uid !== u.uid);
      push({ t: 'ko', uid: u.uid });
      if (u.side === 'p' && u.fx.autoRevive && !u.revived) {
        u.revived = true;
        u.hp = Math.max(1, Math.round(u.maxhp * u.fx.autoRevive));
        push({ t: 'msg', text: `등불이 타올라 ${u.name}이(가) 다시 일어선다!`, good: true });
        push({ t: 'revive', uid: u.uid, hp: u.hp });
      }
    }
    function healUnit(t, amount, spAmount = 0, src = null) {
      if (!alive(t)) return;
      const hp = Math.min(Math.round(amount), t.maxhp - t.hp);
      if (src && src.side === 'p') src.tally.heal += hp;
      const sp = Math.min(Math.round(spAmount), (t.maxsp || 0) - (t.sp || 0));
      t.hp += hp; if (t.side === 'p') t.sp += sp;
      push({ t: 'heal', uid: t.uid, amount: hp, sp: sp || 0, hp: t.hp, spNow: t.sp });
    }
    function cure(t, list = ['poison', 'blind', 'sleep']) {
      for (const s of list) if (t.status[s]) { delete t.status[s]; push({ t: 'status', uid: t.uid, status: s, on: false }); }
    }
    const healPower = (u, power, mult) => power / 100 * (st(u, 'matk') * 3 + 40) * mult;

    /* ── 아군 행동 ── */
    function pickEnemy(uid) {
      const t = unit(uid);
      if (alive(t) && t.side === 'e') return t;
      const l = liveEnemies();
      return l.length ? b.rng.pick(l) : null;
    }
    const maxBoost = (u) => Math.min(u.bp, u.la === 'berserk' ? 5 : 3);
    const spCost = (u, sid) => u.la === 'grace' ? 0 : Math.ceil(SKILLS[sid].sp * (u.fx ? u.fx.spCost : 1));

    function doAttack(u, cmd) {
      const boost = cmd.boost || 0;
      u.bp -= boost;
      const type = cmd.weapon;
      push({ t: 'act', uid: u.uid, name: '공격', type, kind: 'phys', boost, anim: 'attack' });
      let t = pickEnemy(cmd.target);
      for (let i = 0; i < 1 + boost + u.fx.hitsUp; i++) {
        if (!alive(t)) t = pickEnemy(null);
        if (!t) break;
        strike(u, t, { kind: 'phys', type, power: 100, alt: u.fx.alt });
      }
    }

    function doSkill(u, cmd) {
      const s = SKILLS[cmd.skill];
      const boost = cmd.boost || 0;
      u.sp -= spCost(u, cmd.skill);
      u.bp -= boost;
      u.tally.skills++;
      let mult = s.boost === 'power' ? BOOST_POWER[boost] : 1;
      const hits = (s.hits || 1) + (s.boost === 'hits' ? boost : 0);
      const turns = (s.turns || 2) + (s.boost === 'turns' ? boost : 0);
      let target = s.target;
      if (u.la === 'surge' && s.kind === 'mag') { if (target === 'enemy' || target === 'random') target = 'enemies'; mult *= 1.5; }
      if (u.la === 'grace') { if (target === 'ally') target = 'allies'; if (target === 'ko') target = 'kos'; }
      push({ t: 'act', uid: u.uid, name: s.name, type: s.type || null, kind: s.kind, boost, anim: s.kind, target, skill: cmd.skill });

      if (s.kind === 'phys' || s.kind === 'mag') {
        if (s.desperate) mult *= 1 + 2 * (1 - u.hp / u.maxhp);
        const o = { kind: s.kind, type: s.type, power: s.power, mult };
        const struck = new Set();
        let total = 0;
        if (target === 'enemies') {
          for (let i = 0; i < hits; i++) for (const t of liveEnemies()) { total += strike(u, t, o); struck.add(t); }
        } else {
          let t = target === 'enemy' ? pickEnemy(cmd.target) : null;
          for (let i = 0; i < hits; i++) {
            const tt = target === 'random' ? pickEnemy(null) : (alive(t) ? t : (t = pickEnemy(null)));
            if (!tt) break;
            total += strike(u, tt, o); struck.add(tt);
          }
        }
        for (const t of struck) {
          if (!alive(t)) continue;
          if (s.debuffs) for (const [k, lv] of Object.entries(s.debuffs)) setBuff(t, k, lv, turns);
          if (s.status) applyStatus(t, s.status);
        }
        if (s.drain && total) healUnit(u, total * s.drain);
        return;
      }
      if (s.kind === 'heal') {
        let targets;
        if (target === 'allies') targets = liveFront();
        else if (target === 'kos') targets = b.front.filter(x => x && x.hp <= 0);
        else targets = [unit(cmd.target)].filter(Boolean);
        for (const t of targets) {
          if (s.revive) {
            if (t.hp > 0) continue;
            t.hp = Math.max(1, Math.round(t.maxhp * Math.min(1, s.revive + 0.2 * boost)));
            push({ t: 'revive', uid: t.uid, hp: t.hp });
            continue;
          }
          if (!alive(t)) continue;
          const amt = healPower(u, s.power, mult);
          healUnit(t, amt, 0, u);
          if (s.cure) cure(t);
          if (s.regen) t.regen = { turns: s.regen, amount: Math.round(amt * 0.3) };
        }
        return;
      }
      if (s.kind === 'buff') {
        const targets = target === 'allies' ? liveFront() : [u];
        for (const t of targets) for (const [k, lv] of Object.entries(s.buffs || {})) setBuff(t, k, lv, turns);
        if (s.taunt) { u.taunt = turns; push({ t: 'msg', text: `${u.name}이(가) 적의 시선을 끈다!` }); }
        if (s.spGain) healUnit(u, 0, s.spGain);
        if (s.bpGain) { u.bp = Math.min(MAX_BP, u.bp + s.bpGain); push({ t: 'bp', uid: u.uid, bp: u.bp }); }
        return;
      }
      if (s.kind === 'debuff') {
        const t = pickEnemy(cmd.target);
        if (!t) return;
        push({ t: 'aim', uid: t.uid, src: u.uid });
        for (const [k, lv] of Object.entries(s.debuffs || {})) setBuff(t, k, lv, turns);
        if (s.selfBuffs) for (const [k, lv] of Object.entries(s.selfBuffs)) setBuff(u, k, lv, turns);
        if (s.status) applyStatus(t, s.status);
        return;
      }
      if (s.kind === 'special') {
        if (s.steal) {
          const t = pickEnemy(cmd.target);
          if (!t) return;
          push({ t: 'aim', uid: t.uid, src: u.uid });
          if (t.stolen || !t.d.steal) { msg('훔칠 것이 없다.'); return; }
          const chance = (t.boss ? 0.25 : 0.55) + 0.15 * boost;
          if (b.rng.chance(chance)) {
            t.stolen = true;
            b.G.items[t.d.steal] = (b.G.items[t.d.steal] || 0) + 1;
            push({ t: 'msg', text: `${ITEMS[t.d.steal].name}을(를) 훔쳤다!`, good: true });
          } else msg('훔치지 못했다…');
          return;
        }
        if (s.reveal) {
          const t = pickEnemy(cmd.target);
          if (!t) return;
          push({ t: 'aim', uid: t.uid, src: u.uid });
          const hidden = t.weak.filter(w => !isRevealed(t, w));
          if (!hidden.length) { msg('이미 약점이 모두 드러나 있다.'); return; }
          b.rng.shuffle(hidden).slice(0, s.reveal + boost).forEach(w => reveal(t, w));
          return;
        }
        if (s.bpGive) {
          const targets = target === 'allies' ? liveFront().filter(x => x !== u) : [unit(cmd.target)];
          for (const t of targets) {
            if (!alive(t)) continue;
            t.bp = Math.min(MAX_BP, t.bp + s.bpGive + boost);
            push({ t: 'bp', uid: t.uid, bp: t.bp, gain: true });
          }
        }
      }
    }

    function doItem(u, cmd) {
      const it = ITEMS[cmd.item];
      if (!b.G.items[cmd.item]) return;
      b.G.items[cmd.item]--;
      if (!b.G.items[cmd.item]) delete b.G.items[cmd.item];
      const cat = u.la === 'catalyst';
      const m = cat ? 2 : 1;
      push({ t: 'act', uid: u.uid, name: it.name, kind: 'item', type: it.type || null, anim: it.dmg ? 'throw' : 'item', item: cmd.item });
      if (it.dmg) {
        const targets = (it.target === 'enemies' || cat) ? liveEnemies() : [pickEnemy(cmd.target)].filter(Boolean);
        for (const t of targets) strike(u, t, { kind: 'mag', type: it.type, fixed: it.dmg * m });
        return;
      }
      let targets;
      if (it.target === 'ko') targets = cat ? b.front.filter(x => x && x.hp <= 0) : [unit(cmd.target)].filter(Boolean);
      else targets = cat ? liveFront() : [unit(cmd.target)].filter(Boolean);
      for (const t of targets) {
        if (it.revive) {
          if (t.hp > 0) continue;
          t.hp = Math.max(1, Math.round(t.maxhp * Math.min(1, it.revive * m)));
          push({ t: 'revive', uid: t.uid, hp: t.hp });
          continue;
        }
        if (!alive(t)) continue;
        if (it.heal || it.spHeal) healUnit(t, (it.heal || 0) * m, (it.spHeal || 0) * m);
        if (it.cure) cure(t, it.cure);
        if (it.bp) { t.bp = Math.min(MAX_BP, t.bp + it.bp * m); push({ t: 'bp', uid: t.uid, bp: t.bp, gain: true }); }
      }
    }

    /* ── 적 행동 ── */
    function pickHero() {
      const l = liveFront();
      if (!l.length) return null;
      const taunters = l.filter(u => u.taunt > 0);
      if (taunters.length && b.rng.chance(0.8)) return b.rng.pick(taunters);
      return b.rng.pick(l);
    }
    function chooseAi(e) {
      const table = e.d.ai.filter(([id, , cond]) => {
        if (cond === 'once') return !e.used[id];
        if (cond === 'hp<0.5') return e.hp / e.maxhp < 0.5;
        return true;
      }).map(([id, w]) => [id, w]);
      return table.length ? b.rng.weighted(table) : 'attack';
    }
    function enemyTurn(en) {
      const e = unit(en.uid);
      if (!alive(e) || e.broken) return;
      const d = e.d;
      if (d.phases) while (e.phase < d.phases.length && e.hp / e.maxhp <= d.phases[e.phase].hp) enterPhase(e);
      if (d.flee && b.round >= 2 && b.rng.chance(d.flee)) {
        if (liveFront().some(u => u.fx.noFlee)) {
          push({ t: 'msg', text: `${e.name}이(가) 달아나려 했지만 달빛에 붙들렸다!`, good: true });
          return;
        }
        e.hp = 0; e.fled = true;
        b.queue = b.queue.filter(q => q.uid !== e.uid);
        push({ t: 'runaway', uid: e.uid, name: e.name });
        return;
      }
      if (e.charging) {
        if (e.charging.round === b.round) { push({ t: 'charging', uid: e.uid }); return; }
        const id = e.charging.act; e.charging = null;
        return execEnemyAct(e, id);
      }
      let id = e.pattern ? e.pattern[e.pidx++ % e.pattern.length] : chooseAi(e);
      if (id.startsWith('ward:')) {
        if (e.ward) id = 'attack';
        else { setWard(e, id.slice(5)); return; }
      }
      if (id.startsWith('charge:')) {
        e.used[id] = true;
        e.charging = { act: id.slice(7), round: b.round };
        push({ t: 'charge', uid: e.uid, name: ENEMY_ACTS[e.charging.act].name });
        return;
      }
      if (id.startsWith('summon:')) {
        const max = e.big ? 3 : 4;
        if (liveEnemies().length < max) {
          const n = addEnemy(id.slice(7));
          push({ t: 'summon', uid: n.uid, src: e.uid, name: n.name });
          return;
        }
        id = 'attack';
      }
      execEnemyAct(e, id);
    }
    function execEnemyAct(e, id) {
      const a = ENEMY_ACTS[id];
      e.used[id] = true;
      push({ t: 'act', uid: e.uid, name: a.name, type: a.type || null, kind: a.kind, anim: a.kind, big: !!a.charged });
      if (a.kind === 'phys' || a.kind === 'mag') {
        const o = { kind: a.kind, type: a.type, power: a.power };
        const hits = a.hits || 1;
        if (a.target === 'all') {
          for (let i = 0; i < hits; i++) for (const t of liveFront()) { strike(e, t, o); if (a.status) applyStatus(t, a.status); }
        } else {
          let t = a.target === 'one' ? pickHero() : null;
          let total = 0;
          for (let i = 0; i < hits; i++) {
            const tt = a.target === 'random' ? pickHero() : (alive(t) ? t : (t = pickHero()));
            if (!tt) break;
            total += strike(e, tt, o);
            if (a.status) applyStatus(tt, a.status);
          }
          if (a.drain && total) healUnit(e, total * a.drain);
        }
      } else if (a.kind === 'none') {
        for (const t of liveFront()) applyStatus(t, a.status);
      } else if (a.kind === 'buff') {
        for (const [k, lv] of Object.entries(a.buffs)) setBuff(e, k, lv, a.turns || 2);
      } else if (a.kind === 'debuff') {
        const targets = a.target === 'all' ? liveFront() : [pickHero()].filter(Boolean);
        for (const t of targets) for (const [k, lv] of Object.entries(a.debuffs)) setBuff(t, k, lv, a.turns || 2);
      } else if (a.kind === 'healself') {
        healUnit(e, e.maxhp * a.power);
      } else if (a.kind === 'healally') {
        const t = liveEnemies().filter(x => x.hp < x.maxhp).sort((x, y) => (y.boss - x.boss) || (x.hp / x.maxhp - y.hp / y.maxhp))[0];
        if (t) healUnit(t, t.maxhp * a.power);
      }
    }

    /* ── 끝 ── */
    function autoSwap() {
      let any = false;
      for (let c = 0; c < 4; c++) {
        if (!alive(b.front[c]) && alive(b.back[c])) {
          [b.front[c], b.back[c]] = [b.back[c], b.front[c]];
          push({ t: 'swap', col: c, auto: true, in: b.front[c].uid, out: b.back[c] ? b.back[c].uid : null });
          any = true;
        }
      }
      return any;
    }
    function checkEnd() {
      if (b.over) return;
      if (!liveEnemies().length) return victory();
      if (!liveFront().length) {
        autoSwap();
        if (!liveFront().length) {
          b.over = 'lose'; b.waiting = null;
          push({ t: 'end', result: 'lose' });
        }
      }
    }
    function victory() {
      b.over = 'win'; b.waiting = null;
      const r = { exp: 0, gold: 0, items: [], gear: [], levels: [], rare: 0 };
      for (const e of b.enemies) {
        if (e.fled) continue;
        r.exp += e.d.exp; r.gold += e.d.gold;
        if (e.d.flee) r.rare++;
        if (e.d.drop && b.rng.chance(e.d.drop[1])) r.items.push(e.d.drop[0]);
        // 장비 전리품: [id, 확률] 하나 또는 그 목록(목록이면 하나만 떨어뜨린다)
        if (e.d.gearDrop) {
          const list = Array.isArray(e.d.gearDrop[0]) ? e.d.gearDrop : [e.d.gearDrop];
          const hit = list.find(([, p]) => b.rng.chance(p));
          if (hit) r.gear.push(hit[0]);
        }
      }
      // 살아 있는 사람이 낀 유물의 덤 (가장 큰 것 하나만)
      const living = [...b.front, ...b.back].filter(alive);
      const bonus = (k) => Math.max(0, ...living.map(u => u.fx[k] || 0));
      r.expUp = bonus('partyExp'); r.goldUp = bonus('goldUp');
      r.exp = Math.round(r.exp * (1 + r.expUp)); r.gold = Math.round(r.gold * (1 + r.goldUp));
      b.G.gold += r.gold;
      for (const it of r.items) b.G.items[it] = (b.G.items[it] || 0) + 1;
      if (!b.G.gear) b.G.gear = {};
      for (const g of r.gear) b.G.gear[g] = (b.G.gear[g] || 0) + 1;
      for (const u of [...b.front, ...b.back]) {
        if (!alive(u)) continue;
        const res = Party.addExp(u.h, r.exp);
        if (res.to > res.from) r.levels.push({ id: u.id, ...res });
      }
      b.rewards = r;
      push({ t: 'end', result: 'win', rewards: r });
    }
    /* 전투 결과를 일행 자료에 되돌린다 */
    function sync() {
      for (const u of [...b.front, ...b.back]) {
        if (!u) continue;
        const h = u.h;
        const s = Party.stats(h);
        const lvUp = s.hp - u.maxhp;   // 전투 중 레벨이 올랐으면 늘어난 만큼 더한다
        h.hp = Math.max(b.over === 'win' ? 1 : 0, Math.min(s.hp, u.hp + Math.max(0, lvUp)));
        h.sp = Math.min(s.sp, u.sp + Math.max(0, s.sp - u.maxsp));
        h.latent = Math.round(u.latent);
      }
      // 교대한 결과를 대열에 반영
      for (let c = 0; c < 4; c++) {
        b.G.front[c] = b.front[c] ? b.front[c].id : null;
        b.G.back[c] = b.back[c] ? b.back[c].id : null;
      }
    }

    /* ── 진행 ── */
    function advance() {
      b.ev = [];
      let guard = 0;
      while (!b.over && !b.waiting && guard++ < 500) {
        if (!b.started) { b.started = true; startRound(); continue; }
        if (!b.queue.length) { endRound(); if (b.over) break; startRound(); continue; }
        const en = b.queue.shift();
        if (en.kind === 'p') {
          const u = b.front[en.col];
          if (!alive(u)) continue;
          u.defending = false;
          if (u.status.sleep) { push({ t: 'sleep', uid: u.uid }); continue; }
          addLatent(u, 4);
          b.waiting = { col: en.col, swapped: false, twice: 0, extra: !!en.extra };
          push({ t: 'turn', uid: u.uid, col: en.col });
        } else {
          b.acting = en;
          push({ t: 'eturn', uid: en.uid });
          enemyTurn(en);
          b.acting = null;
          checkEnd();
        }
      }
      return b.ev;
    }

    /* 명령이 지금 가능한지 */
    function canSkill(u, sid) {
      const s = SKILLS[sid];
      if (!s) return false;
      if (u.sp < spCost(u, sid)) return false;
      if (s.target === 'ko' && !b.front.some(x => x && x.hp <= 0)) return false;
      return true;
    }
    function swapOptions() {
      const w = b.waiting;
      if (!w) return [];
      const out = [];
      for (let c = 0; c < 4; c++) {
        if (!alive(b.back[c])) continue;
        if (c === w.col && !w.swapped && !w.twice) out.push({ col: c, self: true });
        else if (c !== w.col && !alive(b.front[c])) out.push({ col: c, self: false });
      }
      return out;
    }

    function act(cmd) {
      b.ev = [];
      const w = b.waiting;
      if (!w || b.over) return b.ev;
      let u = b.front[w.col];
      if (cmd.type === 'swap') {
        const c = cmd.col;
        if (!swapOptions().some(o => o.col === c)) return b.ev;
        const out = b.front[c];
        [b.front[c], b.back[c]] = [b.back[c], b.front[c]];
        if (out) { out.la = null; out.defending = false; }
        push({ t: 'swap', col: c, in: b.front[c].uid, out: out ? out.uid : null });
        if (c === w.col) { w.swapped = true; push({ t: 'turn', uid: b.front[c].uid, col: c, swapIn: true }); }
        return b.ev;
      }
      if (cmd.type === 'latent') {
        if (u.latent < 100 || u.la) return b.ev;
        const id = HEROES[u.id].latent;
        u.latent = 0; u.la = id;
        push({ t: 'latent', uid: u.uid, id, name: LATENTS[id].name });
        if (id === 'berserk') { u.bp = MAX_BP; push({ t: 'bp', uid: u.uid, bp: u.bp, gain: true }); }
        if (id === 'hawk') for (const e of liveEnemies()) for (const wk of e.weak) reveal(e, wk);
        if (id === 'encore') u.encoreCol = cmd.col;
        return b.ev;
      }
      if (cmd.type === 'attack') doAttack(u, cmd);
      else if (cmd.type === 'skill') { if (!canSkill(u, cmd.skill)) return b.ev; doSkill(u, cmd); }
      else if (cmd.type === 'item') doItem(u, cmd);
      else if (cmd.type === 'defend') {
        u.defending = true; u.defendNext = b.round + 1;
        push({ t: 'defend', uid: u.uid });
      } else if (cmd.type === 'flee') {
        if (b.noEscape) { msg('이 싸움에서는 도망칠 수 없다!'); return b.ev; }
        const ps = liveFront().reduce((a, x) => a + st(x, 'spd'), 0) / Math.max(1, liveFront().length);
        const es = liveEnemies().reduce((a, x) => a + st(x, 'spd'), 0) / Math.max(1, liveEnemies().length);
        const p = Math.max(0.3, Math.min(0.95, 0.6 + (ps - es) / (ps + es)));
        if (b.rng.chance(p)) { b.over = 'flee'; b.waiting = null; push({ t: 'end', result: 'flee' }); return b.ev; }
        msg('도망치지 못했다!');
      }
      if ((cmd.boost || 0) > 0) u.boosted = true;
      checkEnd();
      if (b.over) return b.ev;
      if (!alive(u)) { b.waiting = null; return b.ev; }
      if (u.la === 'twice' && !w.twice && cmd.type !== 'flee') {
        w.twice = 1;
        push({ t: 'msg', text: '그림자 걸음 — 한 번 더!', good: true });
        push({ t: 'turn', uid: u.uid, col: w.col, again: true });
        return b.ev;
      }
      if (u.la === 'encore') {
        const c = u.encoreCol;
        if (c != null && alive(b.front[c]) && b.front[c] !== u) {
          b.queue.unshift({ kind: 'p', col: c, extra: true });
          push({ t: 'msg', text: `앙코르! ${b.front[c].name}이(가) 한 번 더 움직인다.`, good: true });
        }
        u.encoreCol = null;
      }
      u.la = null;
      b.waiting = null;
      return b.ev;
    }

    return {
      get state() { return b; },
      get waiting() { return b.waiting; },
      get over() { return b.over; },
      get round() { return b.round; },
      get rewards() { return b.rewards; },
      get front() { return b.front; },
      get back() { return b.back; },
      get enemies() { return b.enemies; },
      get log() { return b.log; },
      actor: () => b.waiting ? b.front[b.waiting.col] : null,
      advance, act, sync, unit, orderNow, orderNext, canSkill, swapOptions, maxBoost, spCost,
      isRevealed, st
    };
  }

  return { create, MAX_BP, BOOST_POWER };
})();

if (typeof module !== 'undefined') module.exports = { Battle };
