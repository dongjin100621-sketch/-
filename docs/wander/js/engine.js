'use strict';
/* 은빛 유랑기 — 상태, 주사위, 판정, 효과 적용, 저장 */

const SAVE_KEY = 'wander-save-v1';
const PHASES = ['새벽', '아침', '낮', '저녁', '밤'];

const Dice = {
  d(n) { return 1 + Math.floor(Math.random() * n); },
  /* '2d6+3' / '1d8' / '7' → { total, rolls, text } */
  roll(expr) {
    const m = String(expr).replace(/\s/g, '').match(/^(?:(\d+)d(\d+))?([+-]\d+)?$|^(\d+)$/);
    if (!m) return { total: 0, rolls: [], text: '0' };
    if (m[4]) return { total: +m[4], rolls: [], text: m[4] };
    const n = +(m[1] || 0), s = +(m[2] || 0), b = +(m[3] || 0);
    const rolls = []; for (let i = 0; i < n; i++) rolls.push(Dice.d(s));
    return { total: rolls.reduce((a, c) => a + c, 0) + b, rolls, text: expr };
  }
};
const mod = v => Math.floor((v - 10) / 2);
const sign = n => (n >= 0 ? '+' : '') + n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];

const G = {
  S: null,

  newState(name, cls) {
    const C = CLASSES[cls];
    const S = {
      v: 1, name, cls, lvl: 1, xp: 0, hp: 1, mp: 1,
      st: { ...C.st }, gold: 30, day: 1, phase: 1, region: 'central',
      inv: {}, eq: { weapon: null, helm: null, armor: null, acc: null },
      skills: [...C.skills], flags: {}, quest: {}, side: {}, runes: { weapon: [], armor: [] }, tree: [], sp: 0, job: null,
      seals: [], journal: [], seen: {}, bestiary: {}, kills: 0, travelled: 0, ended: false, poison: 0, chill: 0
    };
    G.migrate(S);
    for (const [id, n] of Object.entries(C.items)) S.inv[id] = n;
    S.eq.weapon = C.gear.weapon; S.eq.armor = C.gear.armor;
    G.S = S;
    S.hp = G.maxHp(); S.mp = G.maxMp();
    return S;
  },

  /* ── 파생 수치 ── */
  /* 모든 보너스의 합: 장비 + 룬(+룬어) + 스킬 트리 + 전직 */
  bonus(key) {
    const S = G.S;
    let b = 0;
    for (const slot of SLOTS) {
      const it = ITEMS[S.eq[slot]];
      if (it && it.bonus && it.bonus[key]) b += it.bonus[key];
    }
    for (const slot of ['weapon', 'armor']) {
      for (const r of G.activeRunes(slot)) b += RUNES[r].bonus[key] || 0;
      const w = G.runeword(slot); if (w) b += w.bonus[key] || 0;
    }
    for (const id of S.tree) { const n = G.node(id); if (n && n.bonus) b += n.bonus[key] || 0; }
    if (S.job) { const J = JOBS[S.job]; b += (J.bonus[key] || 0) + (J.st[key] || 0); }
    return b;
  },
  activeRunes(slot) {
    const it = ITEMS[G.S.eq[slot]];
    return (G.S.runes[slot] || []).slice(0, it ? it.sockets || 0 : 0);
  },
  runeword(slot) {
    const act = G.activeRunes(slot).slice().sort().join();
    return RUNEWORDS.find(w => w.slot === slot && w.need.slice().sort().join() === act) || null;
  },
  /* 룬 새기기·회수 */
  socket(runeId, slot) {
    const S = G.S, R = RUNES[runeId], it = ITEMS[S.eq[slot]];
    if (!R || !it || (R.slot !== 'any' && R.slot !== slot)) return false;
    if ((S.runes[slot] || []).length >= (it.sockets || 0)) return false;
    if (!G.take(runeId)) return false;
    S.runes[slot].push(runeId);
    G.clampVitals();
    return true;
  },
  unsocket(slot, i) {
    const S = G.S, id = S.runes[slot][i];
    if (!id || S.gold < 15) return false;
    S.gold -= 15; S.runes[slot].splice(i, 1); G.give(id);
    G.clampVitals();
    return true;
  },
  clampVitals() { const S = G.S; S.hp = Math.min(S.hp, G.maxHp()); S.mp = Math.min(S.mp, G.maxMp()); },

  /* ── 스킬 트리와 전직 ── */
  treeNodes() {
    const S = G.S, list = TREES[S.cls].map(n => ({ ...n, tier: 'base' }));
    if (S.job) for (const n of JOBS[S.job].tree) list.push({ ...n, tier: 'job' });
    return list;
  },
  node(id) {
    for (const t of Object.values(TREES)) { const n = t.find(x => x.id === id); if (n) return n; }
    for (const J of Object.values(JOBS)) { const n = J.tree.find(x => x.id === id); if (n) return n; }
    return null;
  },
  canLearn(n) {
    const S = G.S;
    if (S.tree.includes(n.id)) return { ok: false, why: '익힘' };
    if (S.lvl < n.lv) return { ok: false, why: `레벨 ${n.lv}` };
    const miss = (n.req || []).filter(r => !S.tree.includes(r));
    if (miss.length) return { ok: false, why: `선행: ${miss.map(r => G.node(r).name).join(', ')}` };
    if (S.sp < 1) return { ok: false, why: '포인트 없음' };
    return { ok: true, why: '배우기' };
  },
  learn(id) {
    const S = G.S, n = G.node(id);
    if (!n || !G.canLearn(n).ok) return false;
    S.sp--; S.tree.push(id);
    if (n.skill && !S.skills.includes(n.skill)) S.skills.push(n.skill);
    if (n.bonus && n.bonus.hp) S.hp += n.bonus.hp;
    if (n.bonus && n.bonus.mp) S.mp += n.bonus.mp;
    G.clampVitals();
    return true;
  },
  canJob() { const S = G.S; return !S.job && S.lvl >= 6; },
  setJob(id) {
    const S = G.S, J = JOBS[id];
    if (!J || J.base !== S.cls || S.job) return false;
    S.job = id;
    for (const sk of J.skills) if (!S.skills.includes(sk)) S.skills.push(sk);
    S.hp = G.maxHp(); S.mp = G.maxMp();
    G.log(`${J.name}(으)로 전직했다`);
    return true;
  },
  className() { const S = G.S; return S.job ? JOBS[S.job].name : CLASSES[S.cls].name; },
  classIcon() { const S = G.S; return S.job ? JOBS[S.job].icon : CLASSES[S.cls].icon; },

  /* 예전 저장 파일 보정 */
  migrate(S) {
    S.eq.helm = S.eq.helm || null;
    S.quest = Object.assign({ central: 0, west: 0, south: 0, east: 0, north: 0, final: 0, royal: 0, archi: 0, waste: 0, sky: 0 }, S.quest || {});
    S.side = S.side || {};
    S.runes = S.runes || { weapon: [], armor: [] };
    S.bestiary = S.bestiary || {};
    if (!S.tree) {
      // 예전 버전: 레벨마다 자동으로 익힌 기술을 트리 노드로 옮기고 남은 포인트를 돌려준다
      S.tree = [];
      for (const n of TREES[S.cls]) if (n.skill && S.skills.includes(n.skill)) S.tree.push(n.id);
      S.sp = Math.max(0, (S.lvl - 1) - S.tree.length);
      if (S.cls === 'bard' && !S.skills.includes('sting')) S.skills.unshift('sting');
    }
    if (S.sp === undefined) S.sp = 0;
    if (S.job === undefined) S.job = null;
    return S;
  },
  stat(k) { return G.S.st[k] + G.bonus(k); },
  mod(k) { return mod(G.stat(k)); },
  prof() { return 2 + Math.floor((G.S.lvl - 1) / 3); },
  maxHp() {
    const S = G.S, C = CLASSES[S.cls];
    let hp = C.hitDie + mod(G.stat('con')) + (S.lvl - 1) * (Math.ceil(C.hitDie / 2) + 1 + mod(G.stat('con')));
    if (S.cls === 'sword') hp += 4;
    return Math.max(6, hp + G.bonus('hp'));
  },
  maxMp() {
    const S = G.S, C = CLASSES[S.cls];
    return C.baseMp + (S.lvl - 1) * C.mpPer + G.bonus('mp');
  },
  ac() {
    const a = ITEMS[G.S.eq.armor], h = ITEMS[G.S.eq.helm];
    return 10 + G.mod('dex') + (a ? a.ac || 0 : 0) + (h ? h.ac || 0 : 0) + G.bonus('ac');
  },
  weapon() { return ITEMS[G.S.eq.weapon] || { name: '맨손', dmg: '1d3', stat: 'str' }; },
  atkBonus() { const w = G.weapon(); return G.mod(w.stat) + G.prof() + (w.hit || 0) + G.bonus('hit'); },
  critMin() { return Math.max(17, 20 - G.bonus('crit')); },
  checkBonus(k) {
    let b = G.mod(k) + G.bonus('check');
    const c = G.S.cls;
    if (c === 'mage' && k === 'int') b += 2;
    if (c === 'bard' && k === 'cha') b += 2;
    if (c === 'sword' && k === 'str') b += 1;
    return b;
  },
  xpNeed() { return G.S.lvl * 100; },
  title() {
    if (G.S.flags.true_end) return '바람의 자장가를 부른 자';
    if (G.S.ended) return '청령화를 피운 자';
    const n = G.S.seals.length;
    return ['떠돌이 여행자', '첫 인장의 유랑자', '두 바람의 길손', '세 땅의 순례자', '네 하늘의 방랑자', '다섯 바람의 유랑자'][n];
  },

  /* ── 인벤토리 ── */
  has(id, n = 1) { return (G.S.inv[id] || 0) >= n; },
  give(id, n = 1) { G.S.inv[id] = (G.S.inv[id] || 0) + n; },
  take(id, n = 1) {
    if (!G.has(id, n)) return false;
    G.S.inv[id] -= n; if (G.S.inv[id] <= 0) delete G.S.inv[id];
    return true;
  },
  equip(id) {
    const it = ITEMS[id]; if (!it || !SLOTS.includes(it.type)) return;
    const slot = it.type, old = G.S.eq[slot];
    if (!G.take(id)) return;
    if (old) G.give(old);
    G.S.eq[slot] = id;
    G.S.hp = Math.min(G.S.hp, G.maxHp()); G.S.mp = Math.min(G.S.mp, G.maxMp());
  },
  unequip(slot) {
    const id = G.S.eq[slot]; if (!id) return;
    G.give(id); G.S.eq[slot] = null;
    G.clampVitals();
  },
  priceOf(id) {
    const p = ITEMS[id].price;
    return G.S.cls === 'bard' ? Math.ceil(p * 0.9) : p;
  },

  /* ── 판정: d20 + 보정 vs DC ── */
  check(k, dc, extra = 0) {
    const r = Dice.d(20), b = G.checkBonus(k) + extra, total = r + b;
    const ok = r === 20 ? true : r === 1 ? false : total >= dc;
    UI.dice({ label: `${STATS[k].name} 판정`, roll: r, bonus: b, total, dc, ok, crit: r === 20, fumble: r === 1 });
    return ok;
  },

  /* ── 시간 ── */
  advance(n = 1) {
    const S = G.S;
    S.phase += n;
    while (S.phase >= PHASES.length) { S.phase -= PHASES.length; S.day++; }
  },
  sleep() { const S = G.S; S.day++; S.phase = 1; },

  /* ── 성장 ── */
  gainXp(n) {
    const S = G.S; S.xp += n;
    UI.say(`✦ 경험치 +${n}`, 'gain');
    while (S.xp >= G.xpNeed() && S.lvl < 15) {
      S.xp -= G.xpNeed(); S.lvl++;
      S.hp = G.maxHp(); S.mp = G.maxMp();
      S.sp = (S.sp || 0) + 1;
      S.pendingStat = (S.pendingStat || 0) + 1;
      UI.say(`<b>레벨 ${S.lvl}!</b> 체력과 마나가 가득 찼다. 능력치 포인트 +1, 기술 포인트 +1 (상태창 → 성장)`, 'level');
      if (S.lvl === 6 && !S.job) UI.say('<b>전직할 수 있다!</b> 왕도 루멘하르트의 영웅의 전당을 찾아가자.', 'level');
      G.log(`레벨 ${S.lvl} 달성`);
    }
  },
  heal(n) { const S = G.S, b = S.hp; S.hp = clamp(S.hp + n, 0, G.maxHp()); return S.hp - b; },
  restoreMp(n) { const S = G.S, b = S.mp; S.mp = clamp(S.mp + n, 0, G.maxMp()); return S.mp - b; },

  log(text) {
    const S = G.S;
    S.journal.push({ d: S.day, t: text });
    if (S.journal.length > 80) S.journal.shift();
  },

  /* ── 결과 적용 ──
     o: { text, hp, mp, gold, xp, rations, item, take, flag, time, seal, quest, log, fn, fight, win, lose, flee, go } */
  apply(o) {
    if (!o) return;
    const S = G.S;
    if (o.text) UI.say(typeof o.text === 'function' ? o.text(S) : o.text);
    if (o.fn) o.fn(S);
    if (o.hp) {
      const v = typeof o.hp === 'string' ? (o.hp[0] === '-' ? -Dice.roll(o.hp.slice(1)).total : Dice.roll(o.hp).total) : o.hp;
      if (v < 0) { S.hp = Math.max(0, S.hp + v); UI.say(`체력 ${v}`, 'loss'); }
      else { const h = G.heal(v); if (h) UI.say(`체력 +${h}`, 'gain'); }
    }
    if (o.mp) { const h = o.mp > 0 ? G.restoreMp(o.mp) : (S.mp = Math.max(0, S.mp + o.mp), o.mp); UI.say(`마나 ${sign(h)}`, h >= 0 ? 'gain' : 'loss'); }
    if (o.gold) {
      const v = Array.isArray(o.gold) ? o.gold[0] + Math.floor(Math.random() * (o.gold[1] - o.gold[0] + 1)) : o.gold;
      S.gold = Math.max(0, S.gold + v);
      if (v) UI.say(`금화 ${sign(v)}`, v > 0 ? 'gain' : 'loss');
    }
    if (o.rations) {
      if (o.rations > 0) G.give('ration', o.rations); else G.take('ration', Math.min(-o.rations, S.inv.ration || 0));
      UI.say(`여행 식량 ${sign(o.rations)}`, o.rations > 0 ? 'gain' : 'loss');
    }
    if (o.item) for (const id of [].concat(o.item)) { G.give(id); UI.say(`획득: <b>${ITEMS[id].name}</b>`, 'gain'); }
    if (o.take) for (const id of [].concat(o.take)) G.take(id);
    if (o.flag) for (const f of [].concat(o.flag)) S.flags[f] = true;
    if (o.time) G.advance(o.time);
    if (o.quest) { const [r, n] = o.quest; S.quest[r] = n; }
    if (o.side) { const [r, n] = o.side; S.side[r] = n; }
    if (o.seal && !S.seals.includes(o.seal)) {
      S.seals.push(o.seal);
      UI.say(`<b>유람 인장 획득 — ${REGIONS[o.seal].name}</b> (${S.seals.length}/5)`, 'level');
      G.log(`${REGIONS[o.seal].name}의 인장을 받았다`);
    }
    if (o.log) G.log(o.log);
    if (o.xp) G.gainXp(o.xp);
  },

  /* ── 저장 ── */
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.S)); } catch (e) { /* 저장 불가 환경 */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const S = JSON.parse(raw);
      if (!S || S.v !== 1 || !CLASSES[S.cls]) return null;
      return G.migrate(S);
    } catch (e) { return null; }
  },
  wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } }
};
