/* 여명의 종 전투 밸런스 시뮬레이션.
   일행 레벨·장비를 정해 적 무리와 여러 번 싸워 보고 승률·라운드 수·잃은 HP를 출력한다.
     node tools/dawn_sim.js            (모든 장 요약)
     node tools/dawn_sim.js boss3 24   (한 무리, 레벨 지정)
   아군은 「약점을 아는 보통 실력의 사람」처럼 움직인다: 약점으로 실드를 깎고, 브레이크되면 BP를 몰아 쓰고,
   HP가 낮으면 회복한다. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'dawn', 'js');
const ctx = { console, Math };
vm.createContext(ctx);
for (const f of ['data.js', 'party.js', 'battle.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8') + '\n;this.__x=1;', ctx);
const { HEROES, SKILLS, ENEMIES, FORMATIONS, EQUIP, ITEMS, Party, Battle, makeRng } = vm.runInContext('({HEROES,SKILLS,ENEMIES,FORMATIONS,EQUIP,ITEMS,Party,Battle,makeRng})', ctx);

/* tier 가 x.5 이면 무기는 한 단계 위, 방어구는 아래(돈이 모자라 무기부터 사는 현실적인 차림) */
function gearFor(id, tier) {
  const h = HEROES[id];
  const wt = Math.ceil(tier), at = Math.floor(tier);
  const w = h.weapons.map(t => t + Math.min(5, wt)).find(k => EQUIP[k]);
  const robe = ['seira', 'mir', 'hazel'].includes(id);
  const armor = robe ? 'robe' + Math.min(5, at) : 'armor' + Math.min(6, at);
  return { weapon: w, armor, acc: null };
}
function makeGame(members, lv, tier, backMembers = []) {
  const G = { heroes: {}, front: [null, null, null, null], back: [null, null, null, null], items: {}, gold: 0, dex: {}, stats: {} };
  members.forEach((id, i) => { const h = Party.create(id, lv); h.equip = gearFor(id, tier); Party.healFull(h); G.heroes[id] = h; G.front[i] = id; });
  backMembers.forEach((id, i) => { const h = Party.create(id, lv); h.equip = gearFor(id, tier); Party.healFull(h); G.heroes[id] = h; G.back[i] = id; });
  G.items = { herb: 6, herb2: 4, ether: 2, feather: 2 };
  return G;
}

/* 사람처럼 고르는 간단한 판단 */
function decide(B, u) {
  const enemies = B.enemies.filter(e => e.hp > 0);
  const front = B.front.filter(x => x && x.hp > 0);
  const skills = Party.skills(u.h).filter(s => B.canSkill(u, s));
  const maxB = B.maxBoost(u);
  // 쓰러진 동료 일으키기
  const ko = B.front.find(x => x && x.hp <= 0);
  const rev = skills.find(s => SKILLS[s].revive);
  if (ko && rev) return { type: 'skill', skill: rev, target: ko.uid, boost: 0 };
  // 회복
  const low = front.filter(x => x.hp / x.maxhp < 0.45).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp);
  if (low.length) {
    const healAll = skills.find(s => SKILLS[s].kind === 'heal' && SKILLS[s].target === 'allies' && SKILLS[s].power >= 50);
    const heal1 = skills.find(s => SKILLS[s].kind === 'heal' && SKILLS[s].target === 'ally');
    if (low.length >= 2 && healAll) return { type: 'skill', skill: healAll, boost: Math.min(maxB, 1) };
    if (heal1) return { type: 'skill', skill: heal1, target: low[0].uid, boost: low[0].hp / low[0].maxhp < 0.25 ? Math.min(maxB, 1) : 0 };
    if (low[0].hp / low[0].maxhp < 0.3 && B.state.G.items.herb2) return { type: 'item', item: 'herb2', target: low[0].uid };
    if (low[0].hp / low[0].maxhp < 0.3 && B.state.G.items.herb) return { type: 'item', item: 'herb', target: low[0].uid };
  }
  if (u.latent >= 100 && !u.la && HEROES[u.id].latent !== 'encore') return { type: 'latent' };
  // 목표: 브레이크된 적 우선, 아니면 실드가 가장 적은 적
  const broken = enemies.filter(e => e.broken).sort((a, b) => b.hp - a.hp);
  // 공격 수단 목록
  const opts = [];
  for (const w of HEROES[u.id].weapons) opts.push({ type: 'attack', weapon: w, t: w, power: 100, hits: 1, all: false, kind: 'phys', sp: 0, boostMode: 'hits' });
  for (const s of skills) {
    const d = SKILLS[s];
    if (d.kind !== 'phys' && d.kind !== 'mag') continue;
    opts.push({ type: 'skill', skill: s, t: d.type, power: d.power, hits: d.hits || 1, all: d.target === 'enemies', rnd: d.target === 'random', kind: d.kind, sp: d.sp, boostMode: d.boost });
  }
  const statA = (o) => o.kind === 'phys' ? u.base.patk : u.base.matk;
  const score = (o, e, boost) => {
    const weak = e.weak.includes(o.t);
    let hits = o.hits + (o.boostMode === 'hits' ? boost : 0);
    let pw = o.power * (o.boostMode === 'power' ? Battle.BOOST_POWER[boost] : 1);
    let dmg = statA(o) * pw / 100 * hits * (weak ? 1.3 : 1) * (e.broken ? 2 : 1);
    if (o.all) dmg *= enemies.length * 0.8;
    if (o.rnd) dmg *= 0.8;
    const shieldDmg = weak && !e.broken ? (o.all ? hits * enemies.filter(x => x.weak.includes(o.t) && !x.broken).length : hits) : 0;
    return { dmg, shieldDmg, weak };
  };
  if (broken.length) {
    const e = broken[0];
    let best = null;
    for (const o of opts) { const sc = score(o, e, maxB); if (!best || sc.dmg > best.sc.dmg) best = { o, sc }; }
    return toCmd(best.o, e, maxB);
  }
  const targets = enemies.slice().sort((a, b) => (a.shield - b.shield) || (a.hp - b.hp));
  for (const e of targets) {
    const wk = opts.filter(o => e.weak.includes(o.t));
    if (!wk.length) continue;
    // 실드를 깨는 데 필요한 부스트
    let best = null;
    for (const o of wk) {
      for (let bst = 0; bst <= maxB; bst++) {
        const sc = score(o, e, bst);
        const breaks = sc.shieldDmg >= e.shield;
        const val = (breaks ? 1000 : 0) + sc.shieldDmg * 50 + sc.dmg / 50 - bst * 30 - o.sp * 0.5;
        if (!best || val > best.val) best = { o, bst, val };
      }
    }
    let bst = best.bst;
    if (u.bp >= 5 && bst === 0) bst = 1;
    return toCmd(best.o, e, bst);
  }
  const e = targets[0];
  let best = null;
  for (const o of opts) { const sc = score(o, e, 0); if (!best || sc.dmg - o.sp * 2 > best.v) best = { o, v: sc.dmg - o.sp * 2 }; }
  return toCmd(best.o, e, u.bp >= 5 ? 1 : 0);
}
function toCmd(o, e, boost) {
  if (o.type === 'attack') return { type: 'attack', weapon: o.weapon, target: e.uid, boost };
  return { type: 'skill', skill: o.skill, target: e.uid, boost };
}

function run(formation, G, seed) {
  const B = Battle.create(G, FORMATIONS[formation], { rng: makeRng(seed), noEscape: true });
  let guard = 0;
  B.advance();
  while (!B.over && guard++ < 400) {
    const u = B.actor();
    if (!u) { B.advance(); continue; }
    // HP가 매우 낮으면 후열과 교대
    const sw = B.swapOptions().find(o => o.self);
    if (sw && u.hp / u.maxhp < 0.25 && B.back[sw.col].hp / B.back[sw.col].maxhp > 0.6) B.act({ type: 'swap', col: sw.col });
    const actor = B.actor();
    B.act(decide(B, actor));
    if (!B.over && !B.waiting) B.advance();
    else if (!B.over && B.waiting && B.actor() === actor && !B.state.waiting.twice) B.advance();
  }
  const hpLeft = B.front.concat(B.back).filter(Boolean).reduce((a, x) => a + x.hp / x.maxhp, 0) / B.front.concat(B.back).filter(Boolean).length;
  return { win: B.over === 'win', rounds: B.round, hpLeft, breaks: B.log.breaks, exp: B.over === 'win' && B.rewards ? B.rewards.exp : 0 };
}
function sim(formation, members, lv, tier, back = [], n = 60) {
  let wins = 0, rounds = 0, hp = 0, br = 0, exp = 0;
  for (let i = 0; i < n; i++) {
    const G = makeGame(members, lv, tier, back);
    const r = run(formation, G, 1000 + i * 7919);
    wins += r.win; rounds += r.rounds; hp += r.hpLeft; br += r.breaks; exp += r.exp;
  }
  console.log(`${formation.padEnd(6)} Lv${String(lv).padStart(2)} T${tier}  승률 ${(wins / n * 100).toFixed(0).padStart(3)}%  라운드 ${(rounds / n).toFixed(1).padStart(4)}  남은HP ${(hp / n * 100).toFixed(0).padStart(3)}%  브레이크 ${(br / n).toFixed(1)}  경험치 ${Math.round(exp / n)}`);
}

const P1 = ['rian', 'seira', 'kyle', 'mir'];
const P2b = ['born', 'elda'];
const P3b = ['born', 'elda', 'hazel', 'luka'];
const arg = process.argv.slice(2);
if (arg[0]) {
  const lv = +arg[1] || 10, tier = +arg[2] || Math.ceil(lv / 8);
  sim(arg[0], P1, lv, tier, lv >= 9 ? (lv >= 17 ? P3b : P2b) : [], 100);
} else {
  console.log('── 1장 (일행 2명 → 4명)');
  sim('f1a', ['rian', 'seira'], 1, 1); sim('f1b', ['rian', 'seira'], 2, 1);
  for (const f of ['f1c', 'f1d', 'f1e', 'f1f', 'f1g', 'f1h']) sim(f, P1, 4, 1);
  for (const f of ['f1g', 'f1h']) sim(f, P1, 6, 2);
  sim('boss1', P1, 7, 2); sim('boss1', P1, 8, 2); sim('boss1', P1, 9, 2);
  console.log('── 2장 (후열 2명)');
  for (const f of ['f2a', 'f2b', 'f2c', 'f2d', 'f2e', 'f2f', 'f2g', 'f2h']) sim(f, P1, 11, 2, P2b);
  for (const f of ['f2g', 'f2h']) sim(f, P1, 14, 3, P2b);
  sim('boss2', P1, 15, 3, P2b); sim('boss2', P1, 16, 3, P2b); sim('boss2', P1, 17, 3, P2b);
  console.log('── 3장 (8명)');
  for (const f of ['f3a', 'f3b', 'f3c', 'f3d', 'f3e', 'f3f', 'f3g']) sim(f, P1, 19, 3, P3b);
  sim('boss3', P1, 23, 4, P3b); sim('boss3', P1, 24, 4, P3b); sim('boss3', P1, 25, 4, P3b);
  console.log('── 4장');
  for (const f of ['f4a', 'f4b', 'f4c', 'f4d', 'f4e', 'f4f', 'f4g']) sim(f, P1, 27, 4, P3b);
  sim('boss4', P1, 31, 4, P3b); sim('boss4', P1, 32, 4, P3b); sim('boss4', P1, 33, 5, P3b);
  console.log('── 5장');
  for (const f of ['f5a', 'f5b', 'f5c', 'f5d', 'f5e', 'f5f']) sim(f, P1, 35, 5, P3b);
  sim('boss5', P1, 38, 5, P3b); sim('boss5', P1, 40, 5, P3b);
  sim('boss6', P1, 38, 6, P3b); sim('boss6', P1, 40, 6, P3b); sim('boss6', P1, 42, 6, P3b);
  console.log('── 자연 진행 레벨(던전을 다 돌고 장마다 들판에서 8번쯤 싸운 레벨), 무기만 한 단계 위인 현실적인 차림');
  sim('boss1', P1, 7, 1.5); sim('boss2', P1, 14, 2.5, P2b); sim('boss3', P1, 22, 3.5, P3b); sim('boss4', P1, 30, 3.5, P3b);
  sim('boss5', P1, 36, 4.5, P3b); sim('boss6', P1, 36, 5, P3b);
  console.log('── 들판 (잡몹 사냥터, 끝의 r은 드문 적 — 경험치 0은 달아남)');
  for (const f of ['g1a', 'g1b', 'g1c', 'g1d', 'g1e', 'g1f', 'g1g', 'g1h', 'g1r']) sim(f, P1, 3, 1);
  for (const f of ['g1f', 'g1h', 'g1r']) sim(f, P1, 7, 2);
  for (const f of ['g2a', 'g2b', 'g2c', 'g2d', 'g2e', 'g2f', 'g2r']) sim(f, P1, 10, 2, P2b);
  for (const f of ['g2f', 'g2r']) sim(f, P1, 15, 3, P2b);
  for (const f of ['g3a', 'g3b', 'g3c', 'g3d', 'g3e', 'g3f', 'g3r']) sim(f, P1, 18, 3, P3b);
  for (const f of ['g3e', 'g3r']) sim(f, P1, 24, 4, P3b);
  for (const f of ['g4a', 'g4b', 'g4c', 'g4d', 'g4e', 'g4f', 'g4r']) sim(f, P1, 26, 4, P3b);
  for (const f of ['g4b', 'g4r']) sim(f, P1, 31, 4, P3b);
}
