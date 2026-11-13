'use strict';
/* 일행 모델: 레벨·능력치·장비·기술. 필드와 전투가 함께 쓰고, node 에서도 돈다. */

/* 시드가 있는 난수 (mulberry32) */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    range: (a, b) => a + next() * (b - a),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(table) {
      let total = 0;
      for (const [, w] of table) total += w;
      let r = next() * total;
      for (const [v, w] of table) { if ((r -= w) < 0) return v; }
      return table[table.length - 1][0];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    }
  };
}

const Party = (() => {
  const STATS = ['hp', 'sp', 'patk', 'matk', 'pdef', 'mdef', 'spd'];

  function baseStats(id, lv) {
    const d = HEROES[id];
    const s = {};
    for (const k of STATS) s[k] = Math.round(d.base[k] + d.grow[k] * (lv - 1));
    s.crit = d.base.crit;
    return s;
  }

  /* 장비까지 더한 능력치 */
  function stats(h, equip = h.equip) {
    const s = baseStats(h.id, h.lv);
    s.startBp = 0; s.latentUp = 0; s.immune = [];
    for (const slot of ['weapon', 'armor', 'acc']) {
      const e = equip[slot] && EQUIP[equip[slot]];
      if (!e) continue;
      for (const k of [...STATS, 'crit']) if (e[k]) s[k] += e[k];
      if (e.startBp) s.startBp += e.startBp;
      if (e.latentUp) s.latentUp += e.latentUp;
      if (e.immune) s.immune.push(...e.immune);
    }
    s.spd = Math.max(1, s.spd);
    return s;
  }

  function create(id, lv = HEROES[id].joinLv) {
    const h = { id, lv, exp: 0, equip: { ...HEROES[id].equip }, latent: 0 };
    const s = stats(h);
    h.hp = s.hp; h.sp = s.sp;
    return h;
  }

  const skills = (h) => HEROES[h.id].skills.filter(([, l]) => h.lv >= l).map(([id]) => id);

  /* 경험치를 더하고 오른 레벨과 새로 배운 기술을 돌려준다 */
  function addExp(h, n) {
    const out = { from: h.lv, to: h.lv, learned: [] };
    if (h.lv >= MAX_LEVEL) return out;
    h.exp += n;
    while (h.lv < MAX_LEVEL && h.exp >= expToNext(h.lv)) {
      const before = stats(h);
      h.exp -= expToNext(h.lv);
      h.lv++;
      const after = stats(h);
      h.hp += after.hp - before.hp;
      h.sp += after.sp - before.sp;
      for (const [sk, l] of HEROES[h.id].skills) if (l === h.lv) out.learned.push(sk);
    }
    if (h.lv >= MAX_LEVEL) h.exp = 0;
    out.to = h.lv;
    return out;
  }

  /* 레벨을 정해 맞춘다 (합류할 때 일행 평균에 맞춤) */
  function setLevel(h, lv) {
    h.lv = Math.max(h.lv, Math.min(MAX_LEVEL, lv));
    h.exp = 0;
    const s = stats(h);
    h.hp = s.hp; h.sp = s.sp;
  }

  const canEquip = (h, eqId) => {
    const e = EQUIP[eqId];
    if (!e) return false;
    if (e.slot !== 'weapon') return true;
    return HEROES[h.id].weapons.includes(e.type);
  };

  function clamp(h) {
    const s = stats(h);
    h.hp = Math.max(0, Math.min(h.hp, s.hp));
    h.sp = Math.max(0, Math.min(h.sp, s.sp));
  }

  function healFull(h) { const s = stats(h); h.hp = s.hp; h.sp = s.sp; }

  return { stats, baseStats, create, skills, addExp, setLevel, canEquip, clamp, healFull, STATS };
})();
