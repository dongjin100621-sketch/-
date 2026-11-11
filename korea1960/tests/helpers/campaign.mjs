/* 자동 캠페인 진행 도우미. tests/game.test.mjs와 tools/simulate.mjs가 함께 쓴다.
 * 전략 결정에는 상태의 난수(s.rng)를 쓰지 않고 별도 시드의 난수를 쓴다. 그래야 엔진의 결정성을 해치지 않는다. */
import * as E from '../../game/engine.mjs';
const EC = E.econ;

export function rng(seed) { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

/** 매 행동 뒤의 불변식. 위반하면 Error를 던진다. */
export function checkInvariants(s, d) {
  const fail = m => { throw new Error(`[${E.dateLabel(Math.min(s.turn, 239))} t${s.turn}] ${m}`); };
  const X = d.economy;
  for (const m of d.metrics) { const v = s.stats[m.id]; if (!Number.isFinite(v) || v < m.min || v > m.max) fail(`지표 ${m.id}=${v}`); }
  for (const g of d.interestGroups) {
    const v = s.support[g.id], x = s.ig[g.id];
    if (!Number.isFinite(v) || v < 0 || v > 100) fail(`지지 ${g.id}=${v}`);
    if (!Number.isFinite(x.mod) || Math.abs(x.mod) > 30 || !Number.isFinite(x.clout) || x.clout < 0 || x.clout > 1 || !Number.isFinite(x.vote) || x.vote < 0 || x.vote > 1) fail(`이해집단 ${g.id} ${JSON.stringify(x)}`);
  }
  const sumOf = key => d.interestGroups.reduce((a, g) => a + s.ig[g.id][key], 0);
  if (Math.abs(sumOf('clout') - 1) > .01 || Math.abs(sumOf('vote') - 1) > .01) fail(`세력·투표 비중 합계 ${sumOf('clout')} ${sumOf('vote')}`);
  for (const n of d.countries) { const v = s.relations[n.id]; if (!Number.isFinite(v) || v < 0 || v > 100) fail(`관계 ${n.id}=${v}`); }
  if (!Number.isInteger(s.ap) || s.ap < 0 || s.ap > 3) fail(`AP ${s.ap}`);
  if (s.turn > 240) fail('turn > 240');
  if (!Number.isInteger(s.day) || s.day < 1 || s.day > E.daysInMonth(s.turn) || (s.turn === 240 && s.day !== 1)) fail(`날짜 ${s.day}`);
  if (s.history.length !== s.turn + 1) fail(`history ${s.history.length} != turn+1`);
  for (const id of s.queue) {
    const e = d.events.find(x => x.id === id); if (!e) fail(`미등록 사건 ${id}`);
    if (e.choices.length !== 3 || e.choices.some(c => !c.label)) fail(`빈 선택지 ${id}`);
  }
  if (s.queue.length && !s.ending) {
    const e = d.events.find(x => x.id === s.queue[0]);
    if (!e.choices.some(c => !E.choiceReason(s, d, c.id))) fail(`선택 가능한 선택지가 없음 ${e.id}`);
  }
  // 건물과 건설 대기열
  const seen = new Set();
  for (const b of s.buildings) {
    const def = d.buildings.find(x => x.id === b.id), r = d.regions.find(x => x.id === b.regionId);
    if (!def || !r) fail(`미등록 건물 ${b.id}@${b.regionId}`);
    if (seen.has(b.id + '@' + b.regionId)) fail(`건물 중복 ${b.id}@${b.regionId}`); seen.add(b.id + '@' + b.regionId);
    if (!Number.isInteger(b.level) || b.level < 0 || b.level > X.maxLevel || !Number.isInteger(b.state) || b.state < 0 || b.state > b.level || !Number.isFinite(b.staff) || b.staff < 0 || b.staff > 1 || !def.pm[b.pm]) fail(`건물 값 ${JSON.stringify(b)}`);
    if (!E.regionHas(d, b.regionId, def.requires)) fail(`지형·자원 없는 건물 ${b.id}@${b.regionId}`);
    if (def.cap === 'arable' && b.level > r.arable) fail(`경지 초과 ${b.regionId} ${b.level}`);
    if (def.maxPerRegion && b.level > def.maxPerRegion) fail(`권역 한도 초과 ${b.id}@${b.regionId}`);
    if (def.private === false && b.state !== b.level) fail(`국영이어야 하는 건물 ${b.id}`);
  }
  if (s.construction.filter(q => !q.private).length > X.queueMax || s.construction.filter(q => q.private).length > X.privateQueueMax) fail('건설 대기열 초과');
  for (const q of s.construction) { const def = d.buildings.find(x => x.id === q.id); if (!def || !Number.isFinite(q.progress) || q.progress < 0 || q.progress >= def.cost || !E.regionHas(d, q.regionId, def.requires)) fail(`대기열 ${JSON.stringify(q)}`); }
  // 법률·집권 연합
  for (const g of d.lawGroups) { const law = d.laws.find(l => l.id === s.laws[g.id]); if (!law || law.group !== g.id) fail(`법률 분류 ${g.id}=${s.laws[g.id]}`); }
  if (s.enactment) { const en = s.enactment, law = d.laws.find(l => l.id === en.lawId); if (!law || s.laws[law.group] === law.id || en.stage < 0 || en.stage >= X.enactment.stages || en.setbacks >= X.enactment.setbacks || en.wait < 1) fail(`제정 상태 ${JSON.stringify(en)}`); }
  if (!s.government.length || s.government.length > X.government.max || new Set(s.government).size !== s.government.length) fail(`집권 연합 ${s.government}`);
  if (s.phase === 'transition' && !s.government.includes('military')) fail('과도 통치인데 군대가 연합에 없음');
  // 시장 상태
  const ec = s.econ;
  for (const g of d.goods) { const p = ec.prices[g.id]; if (!Number.isFinite(p) || p < g.price * (1 + X.price.floor) - .01 || p > g.price * (1 + X.price.ceiling) + .01) fail(`가격 ${g.id}=${p}`); }
  if (!Number.isFinite(ec.wage) || ec.wage <= 0 || !Number.isFinite(ec.pool) || ec.pool < 0 || ec.pool > X.poolCap || !Number.isFinite(ec.workforce)) fail(`시장 상태 ${ec.wage} ${ec.pool}`);
  if (new Set(s.policies).size !== s.policies.length) fail('정책 중복');
  if (!Array.isArray(s.edicts) || new Set(s.edicts.map(x => x.regionId)).size !== s.edicts.length) fail('권역마다 시책 하나');
  for (const x of s.edicts) { const e = d.edicts.find(y => y.id === x.edictId); if (!e || !E.regionHas(d, x.regionId, e.requires) || x.startedTurn > s.turn) fail(`시책 오류 ${x.edictId}@${x.regionId}`); }
  for (const x of s.delayed) if (x.due <= s.turn) fail(`지연 효과 미적용 ${x.text}`);
  if (s.report) {
    const r = s.report;
    for (const [m, rows] of Object.entries(r.ledger)) {
      const sum = rows.reduce((a, row) => a + row[1], 0), change = r.changes[m] || 0;
      if (Math.abs(sum - change) > 1e-4) fail(`결산 원인 합계 불일치 ${m}: ${sum} vs ${change}`);
    }
    for (const m of Object.keys(r.changes)) if (!r.ledger[m]) fail(`원인 없는 변화 ${m}`);
  }
}
/** 시장 계산의 불변식(월마다 한 번): 공급·수요가 음수가 아니고, 고용이 노동 인구를 넘지 않고, 재정 항목의 합이 맞는다. */
export function checkMarket(s, d) {
  const fail = m => { throw new Error(`[${E.dateLabel(Math.min(s.turn, 239))} t${s.turn}] 시장: ${m}`); };
  const R = EC.compute(s, d);
  for (const g of d.goods) { const x = R.goods[g.id]; for (const v of [x.supply, x.demand, x.next, ...Object.values(x.sup), ...Object.values(x.dem)]) if (!Number.isFinite(v) || v < -1e-9) fail(`${g.id} ${JSON.stringify(x)}`); }
  if (R.labor.employed > R.labor.workforce + 1e-6 || R.labor.unemployed < -1e-6) fail(`고용 ${JSON.stringify(R.labor)}`);
  const f = R.finance; if (![f.income, f.expense, f.balance].every(Number.isFinite) || Math.abs(f.income - f.expense - f.balance) > 1e-6) fail(`재정 ${JSON.stringify(f)}`);
  if (!Number.isFinite(R.gdp) || R.gdp <= 0) fail(`생산 ${R.gdp}`);
  if (R.construction.used > R.construction.points + 1e-6) fail('건설점 초과 사용');
  if (R.trade.used > R.trade.capacity + 1e-6) fail('무역 역량 초과');
  return R;
}

const exec = (s, d, a) => { const r = E.dispatch(s, d, a); if (!r.ok) throw new Error(`${a.type} 실패: ${r.error} @t${s.turn}`); return r.state; };
const tryDo = (s, d, a) => { const r = E.dispatch(s, d, a); return r.ok ? r.state : s; };
const regionsByDev = (s, d) => [...d.regions].sort((a, b) => E.regionDevelopment(s, d, a.id) - E.regionDevelopment(s, d, b.id));
/** 지역 시책: 목록 순서대로, 개발이 늦은 권역부터 한 달에 하나까지 건다. */
function edicts(s, d, ids, reserve) {
  if (!ids || s.ap < 1 || s.stats.treasury < reserve) return s;
  for (const id of ids) for (const reg of regionsByDev(s, d)) { const n = tryDo(s, d, { type: 'edict', id, regionId: reg.id }); if (n !== s) return n; }
  return s;
}
/** 정부 건설 한 건을 고른다. 건설 부문·철도·항만의 병목을 먼저 풀고, 그다음 이해집단 요구와 시장 수익을 본다. */
function chooseBuild(s, d, R, cfg, r, plan) {
  const can = (id, regionId) => !E.buildReason(s, d, id, regionId);
  const anyRegion = id => [...d.regions].sort(() => r() - .5).find(reg => can(id, reg.id));
  const queued = id => s.construction.filter(q => q.id === id).length;
  const sectorLevels = EC.levelsOf(s, ['construction']) + queued('construction');
  // 건설 부문: 정부 몫 건설점이 재정이 감당할 수 있는 양보다 뚜렷이 모자랄 때만 늘린다.
  if (sectorLevels < (cfg.sectorMax || 5) && plan.govPoints < plan.affordable * .7 && s.stats.treasury > 50 && !queued('construction')) { const reg = anyRegion('construction'); if (reg) return { id: 'construction', regionId: reg.id }; }
  const tight = Object.entries(R.infra).filter(([, x]) => x.access < .9).sort((a, b) => a[1].access - b[1].access)[0];
  if (tight && !queued('railway') && R.goods.transport.ratio > -.25 && can('railway', tight[0])) return { id: 'railway', regionId: tight[0] };
  if (R.trade.used > R.trade.capacity * .85 && !queued('port')) { const reg = anyRegion('port'); if (reg) return { id: 'port', regionId: reg.id }; }
  const bonus = {};
  for (const g of d.interestGroups) if ((cfg.court || []).includes(g.id)) for (const x of EC.demandStatus(s, d, g)) if (x.have + x.buildings.reduce((a, id) => a + queued(id), 0) < x.need + 1) for (const id of x.buildings) bonus[id] = (bonus[id] || 0) + x.weight * .004;
  let best = null;
  for (const def of d.buildings) {
    if ((cfg.avoid || []).includes(def.id) || def.construction || def.trade || def.infraSupply || E.calendar(s.turn).year < def.unlockYear) continue;
    const w = (cfg.prefer && cfg.prefer[def.id]) || 0;
    for (const reg of d.regions) {
      if (!can(def.id, reg.id)) continue;
      let score;
      // 정부 건물: 올리려는 지표가 이미 높으면(체감) 덜 짓는다. 실업이 높으면 일자리를 만드는 건물을 먼저 본다.
      if (def.gov) { if (plan.surplus < 1.5 && !bonus[def.id]) continue; score = Object.entries(def.monthlyEffects || {}).reduce((a, [k, v]) => a + v * (cfg.weights[k] || 0) * (s.stats[k] > 72 ? .15 : 1), 0) / def.cost * .5 - (R.labor.rate > .12 ? .003 : 0); } // 인건비가 계속 드는 건물은 재정에 여유가 있을 때만
      else {
        if (s.buildings.some(b => b.id === def.id && b.level > 0 && b.staff < .85)) continue; // 같은 업종에 노는 설비가 있다
        const p = EC.prospect(s, d, R, def, reg.id); if (p.jobs > R.labor.unemployed + R.labor.subsistence * .4 || p.profit <= 0) continue; score = p.perPoint + (R.labor.rate > .1 ? .004 : 0);
      }
      score += (bonus[def.id] || 0) + w * .004 + r() * .0008 - (R.infra[reg.id].access < 1 ? .003 : 0);
      if (!best || score > best.score) best = { id: def.id, regionId: reg.id, score };
    }
  }
  return best && best.score > 0 ? best : null;
}
/** 법률·집권 연합·건설·생산방식을 한 달치 다룬다. */
function govern(s, d, cfg, r) {
  const R = EC.compute(s, d);
  // 집권 연합: 목표 구성과 다르면 한 달에 한 번 바꾼다(자리가 없으면 먼저 빼고, 다음 달에 넣는다).
  if (cfg.coalition && s.ap > 1) {
    const out = s.government.find(id => !cfg.coalition.includes(id) && !(s.phase === 'transition' && id === 'military')), add = cfg.coalition.find(id => !s.government.includes(id));
    if (add && s.government.length < d.economy.government.max) s = tryDo(s, d, { type: 'coalition', id: add });
    else if (out && s.government.length > 1) s = tryDo(s, d, { type: 'coalition', id: out });
  }
  if (!s.enactment && s.ap > 0 && s.stats.treasury > 30) for (const id of cfg.laws || []) { if (E.lawChance(s, d, id) < .2) continue; const n = tryDo(s, d, { type: 'enact', id }); if (n !== s) { s = n; break; } }
  // 생산방식: 산출이 모자라거나 수출로 빠지는 건물만, 한 달에 두 곳까지 올린다.
  let upgrades = 0;
  for (const b of s.buildings) {
    const def = d.buildings.find(x => x.id === b.id), next = b.pm + 1;
    if (upgrades >= 2 || b.level < 1 || b.staff < .85 || !def.pm[next] || (cfg.keepMethods || []).includes(def.id) || E.pmReason(s, d, b.id, b.regionId, next)) continue;
    if (Object.keys(def.pm[next].in).some(g => R.goods[g].ratio > .6 && !d.goods.find(x => x.id === g).world)) continue; // 교역할 수 없는 투입재가 크게 모자라면 미룬다
    if (Object.keys(def.pm[next].out).some(g => R.goods[g].ratio < 0 && R.goods[g].exportRoom < def.pm[next].out[g] * b.level * .5)) continue; // 산출이 이미 남아돌면 늘리지 않는다
    const n = tryDo(s, d, { type: 'pm', id: b.id, regionId: b.regionId, pm: next }); if (n !== s) { s = n; upgrades++; }
  }
  // 건설: 재정이 감당할 수 있는 만큼만 대기열에 올린다.
  const reserve = cfg.minTreasury ?? 30, cpp = Math.max(.02, R.construction.costPerPoint);
  const govSpend = R.construction.usedGov * cpp, surplus = R.finance.balance + govSpend - (cfg.keep ?? .5);
  const affordable = Math.max(0, surplus + Math.max(0, s.stats.treasury - reserve) / 18) / cpp;
  const govPoints = R.construction.points * (s.construction.some(q => q.private) ? 1 - R.construction.privateShare : 1);
  const plan = { affordable, govPoints, surplus }, perItem = d.economy.maxPerProject;
  for (let i = 0; i < 2 && s.ap > 0; i++) {
    const mine = s.construction.filter(q => !q.private).length;
    if (mine >= Math.min(cfg.queue ?? 4, Math.max(s.stats.treasury > reserve + 20 ? 1 : 0, Math.ceil(Math.min(affordable, govPoints) / perItem)))) break;
    const pick = chooseBuild(s, d, R, cfg, r, plan); if (!pick) break;
    s = tryDo(s, d, { type: 'build', id: pick.id, regionId: pick.regionId });
  }
  return s;
}

/** 정해진 우선순위로 사건을 고르고 정책·법률·건설·자문·외교를 쓰는 전략을 만든다. */
function focused(cfg) {
  return {
    choose(s, d, e, r) {
      const pref = { may_1961: cfg.route, yushin_1972: cfg.yushin, buma_1979: cfg.buma, election_1963: cfg.election || 'election_1963_2', heavy_1973: cfg.heavy };
      if (pref[e.id] && !E.choiceReason(s, d, pref[e.id])) return pref[e.id];
      const ok = e.choices.filter(c => !E.choiceReason(s, d, c.id) && !c.ending && (cfg.allowAuthoritarian || (!c.setFlags?.authoritarian && c.phase !== 'transition')));
      const score = c => Object.entries(cfg.weights).reduce((a, [k, w]) => a + (c.effects[k] || 0) * w, 0) + (c.influence || 0) * .3 + r();
      return (ok.sort((a, b) => score(b) - score(a))[0] || e.choices.find(c => !E.choiceReason(s, d, c.id))).id;
    },
    act(s, d, r) {
      if (E.PREPARE_PHASES.includes(s.phase)) { while (s.ap > 0) s = exec(s, d, { type: 'prepare' }); return s; }
      if (!E.isExecutive(s)) return s;
      if (s.turn % 12 === 0) s = tryDo(s, d, { type: 'budget', budget: cfg.budget });
      const reserve = cfg.minTreasury ?? 30;
      s = govern(s, d, cfg, r);
      for (const id of cfg.policies) { if (s.ap < 1 || s.stats.treasury < reserve + 10) break; s = tryDo(s, d, { type: 'policy', id }); }
      if (s.advisers.length < 2 && s.ap > 0) for (const id of cfg.advisers) s = tryDo(s, d, { type: 'adviser', id });
      s = edicts(s, d, cfg.edicts, reserve + 20);
      if (!cfg.noRepay && s.ap > 0 && s.stats.debt > 200 && s.stats.treasury > 90) s = tryDo(s, d, { type: 'repay', amount: 20 });
      if (s.ap > 0 && s.stats.treasury > reserve + 20) s = tryDo(s, d, { type: 'diplomacy', countryId: d.countries[Math.floor(r() * d.countries.length)].id, mode: cfg.diplomacy });
      return s;
    }
  };
}

/** 전략: 사건 선택 함수 + 월 행동 함수. */
export const STRATEGIES = {
  /** 헌정 경로·권리 중시. 소시민·노동자·농민 연합으로 권리 법률을 먼저 바꾼다. */
  constitutional: focused({
    route: 'may_1961_1', yushin: 'yushin_1972_1', buma: 'buma_1979_1',
    weights: { liberty: 2, legitimacy: 2, welfare: 1, equality: 1, environment: 1, education: 1, admin: .5, treasury: .03 },
    budget: { industry: 18, agriculture: 16, education: 20, welfare: 20, infrastructure: 16, security: 10 },
    coalition: ['petite', 'workers', 'farmers'], court: ['petite', 'workers', 'farmers'],
    laws: ['press_freedom', 'association', 'judicial_review', 'merit_service', 'labor_inspection', 'local_council', 'owner_farmer', 'public_relief', 'civilian_oversight', 'clean_water', 'income_tax', 'export_drive', 'local_autonomy', 'social_insurance', 'worker_protection'],
    policies: ['primary_school', 'health_centers', 'open_accounts', 'civil_service', 'farm_extension', 'rural_coops', 'housing', 'technical_school', 'small_business', 'export_credit', 'price_stability', 'energy_efficiency', 'research_fund', 'grid_planning', 'rail_priority'],
    edicts: ['local_admin', 'lagging_region', 'forest_protection', 'grain_drive', 'fishery_management'],
    prefer: { school: 1, clinic: 1, irrigation: 1 }, avoid: ['arms_plant'], advisers: ['min', 'yun'], diplomacy: 'humanitarian'
  }),
  /** 군정·권위주의 경로·산업 우선. 군대·기업가·지주 연합. */
  military: focused({
    route: 'may_1961_2', election: 'election_1963_1', yushin: 'yushin_1972_2', buma: 'buma_1979_2', heavy: 'heavy_1973_2',
    weights: { industry: 2, reserves: 1, stability: 1, infrastructure: 1, security: .5, treasury: .1 },
    budget: { industry: 34, agriculture: 12, education: 14, welfare: 8, infrastructure: 22, security: 10 },
    coalition: ['military', 'business', 'landowners'], court: ['military', 'business', 'farmers'],
    laws: ['planned_development', 'export_drive', 'merit_service', 'public_relief', 'defense_industry', 'corporate_farming'],
    policies: ['export_credit', 'small_business', 'technical_school', 'rail_priority', 'grid_planning', 'diplomatic_diversity', 'price_stability', 'civil_service', 'research_fund'],
    edicts: ['export_priority', 'mine_safety', 'urban_planning'], sectorMax: 7, expandAt: 1,
    prefer: { steel_mill: 2, machinery: 2, shipyard: 2, power_plant: 1, barracks: 1, irrigation: 2 }, advisers: ['cho', 'han'], diplomacy: 'technology', allowAuthoritarian: true
  }),
  /** 복지 우선: 헌정 경로, 노동자·농민·소시민 연합, 생활·분배 중심. */
  welfare: focused({
    route: 'may_1961_1', yushin: 'yushin_1972_1', buma: 'buma_1979_1',
    weights: { welfare: 3, equality: 2.5, education: 1, legitimacy: .3, treasury: .05 },
    budget: { industry: 12, agriculture: 18, education: 22, welfare: 30, infrastructure: 10, security: 8 },
    coalition: ['workers', 'farmers', 'petite'], court: ['workers', 'farmers'],
    laws: ['owner_farmer', 'public_relief', 'labor_inspection', 'association', 'local_council', 'income_tax', 'worker_protection', 'social_insurance', 'progressive_tax', 'social_market'],
    policies: ['health_centers', 'housing', 'primary_school', 'rural_coops', 'small_business', 'farm_extension', 'grain_buffer', 'price_stability'],
    edicts: ['lagging_region', 'local_admin', 'grain_drive'],
    prefer: { clinic: 2, housing: 2, school: 1, irrigation: 1 }, avoid: ['arms_plant', 'barracks'], advisers: ['kang', 'yun'], diplomacy: 'humanitarian'
  }),
  /** 환경 우선: 헌정 경로, 환경 부담을 줄이며 완만한 성장. */
  green: focused({
    route: 'may_1961_1', yushin: 'yushin_1972_3', buma: 'buma_1979_1',
    weights: { environment: 3, welfare: 1, agriculture: 1, education: 1, industry: -.5, treasury: .05 },
    budget: { industry: 16, agriculture: 20, education: 20, welfare: 16, infrastructure: 18, security: 10 },
    coalition: ['petite', 'farmers', 'workers'], court: ['petite', 'farmers'],
    laws: ['clean_water', 'merit_service', 'press_freedom', 'local_council', 'owner_farmer', 'income_tax', 'pollution_control', 'export_drive'],
    policies: ['energy_efficiency', 'grid_planning', 'research_fund', 'technical_school', 'export_credit', 'farm_extension', 'rail_priority', 'small_business', 'primary_school'],
    edicts: ['forest_protection', 'fishery_management', 'water_management'],
    prefer: { greenworks: 3, hydro_dam: 2, clinic: 1, school: 1 }, avoid: ['steel_mill', 'arms_plant', 'cement_plant', 'coal_mine'], advisers: ['yun', 'kang'], diplomacy: 'technology'
  }),
  /** 강경: 군정·권력 집중 경로에서 통제와 동원을 우선한다. 위기 엔딩 도달 확인용. */
  hardline: focused({
    route: 'may_1961_2', election: 'election_1963_1', yushin: 'yushin_1972_2', buma: 'buma_1979_2', heavy: 'heavy_1973_2',
    weights: { security: 2, stability: 2, admin: 1.5, industry: 1, legitimacy: 1, liberty: -2, treasury: .1 },
    budget: { industry: 30, agriculture: 10, education: 10, welfare: 6, infrastructure: 20, security: 24 },
    coalition: ['military', 'landowners', 'business'], court: ['military'],
    laws: ['planned_development', 'defense_industry', 'export_drive'],
    policies: ['export_credit', 'civil_service', 'rail_priority', 'grid_planning', 'diplomatic_diversity'],
    prefer: { barracks: 3, steel_mill: 2, arms_plant: 2 }, advisers: ['cho', 'lee'], diplomacy: 'talk', allowAuthoritarian: true
  }),
  /** 성장 우선: 헌정 경로를 지키되 민간 주도 시장과 수출에 집중하고 분배·권리는 뒤로 미룬다. */
  growth: focused({
    route: 'may_1961_1', yushin: 'yushin_1972_3', buma: 'buma_1979_2', heavy: 'heavy_1973_1',
    weights: { industry: 3, infrastructure: 1.5, reserves: 1, legitimacy: .5, education: .5, treasury: .1 },
    budget: { industry: 34, agriculture: 12, education: 16, welfare: 8, infrastructure: 22, security: 8 },
    coalition: ['business', 'petite', 'landowners'], court: ['business', 'petite'],
    laws: ['export_drive', 'merit_service', 'planned_development', 'judicial_review', 'market_led', 'corporate_farming'],
    policies: ['export_credit', 'small_business', 'technical_school', 'rail_priority', 'grid_planning', 'research_fund', 'price_stability', 'diplomatic_diversity', 'civil_service'],
    edicts: ['export_priority', 'mine_safety', 'local_admin'], sectorMax: 8, expandAt: 1, queue: 4,
    prefer: { research: 1, school: 1 }, advisers: ['cho', 'han'], diplomacy: 'technology'
  }),
  /** 소극: 사건에서 첫 번째로 가능한 선택만 고르고 국정 행동을 하지 않는다. 민간 투자만 건물을 짓는다. */
  passive: {
    choose(s, d, e) { return (e.choices.find(c => !E.choiceReason(s, d, c.id) && !c.ending) || e.choices.find(c => !E.choiceReason(s, d, c.id))).id; },
    act(s, d) { if (E.PREPARE_PHASES.includes(s.phase)) while (s.ap > 0) s = exec(s, d, { type: 'prepare' }); return s; }
  },
  /** 무작위: 가능한 행동 중 아무거나. 교착·악용 탐지용. */
  random: {
    choose(s, d, e, r) { const ok = e.choices.filter(c => !E.choiceReason(s, d, c.id)); return ok[Math.floor(r() * ok.length)].id; },
    act(s, d, r) {
      const pick = list => list[Math.floor(r() * list.length)];
      for (let i = 0; i < 8; i++) {
        const k = Math.floor(r() * 17), b = s.buildings.length ? pick(s.buildings) : null;
        const a = k === 0 ? { type: 'prepare' }
          : k === 1 ? { type: 'policy', id: pick(d.policies).id }
            : k === 2 || k === 3 ? { type: 'build', id: pick(d.buildings).id, regionId: pick(d.regions).id }
              : k === 4 ? { type: 'diplomacy', countryId: pick(d.countries).id, mode: pick(['talk', 'technology', 'humanitarian']) }
                : k === 5 ? { type: 'adviser', id: pick(d.advisers).id }
                  : k === 6 ? { type: 'repay', amount: 10 }
                    : k === 7 ? { type: 'budget', budget: (() => { const w = E.BUDGET_KEYS.map(() => 1 + Math.floor(r() * 10)); const t = w.reduce((a, b) => a + b, 0); const v = w.map(x => Math.floor(x / t * 100)); v[0] += 100 - v.reduce((a, b) => a + b, 0); return Object.fromEntries(E.BUDGET_KEYS.map((key, j) => [key, v[j]])); })() }
                      : k === 8 ? { type: 'edict', id: pick(d.edicts).id, regionId: pick(d.regions).id }
                        : k === 9 ? { type: 'revokeEdict', regionId: pick(d.regions).id }
                          : k === 10 ? { type: 'enact', id: pick(d.laws).id }
                            : k === 11 ? (r() < .15 ? { type: 'cancelEnact' } : { type: 'coalition', id: pick(d.interestGroups).id })
                              : k === 12 && b ? { type: 'pm', id: b.id, regionId: b.regionId, pm: Math.floor(r() * 3) }
                                : k === 13 && b ? { type: 'subsidy', id: b.id, regionId: b.regionId }
                                  : k === 14 && b ? { type: r() < .5 ? 'privatize' : 'downsize', id: b.id, regionId: b.regionId }
                                    : k === 15 ? { type: r() < .5 ? 'cancelBuild' : 'prioritize', index: Math.floor(r() * 6) }
                                      : { type: 'endMonth' };
        if (a.type === 'endMonth') break;
        s = tryDo(s, d, a);
      }
      return s;
    }
  }
};

/** 한 캠페인을 끝까지 진행한다. onStep(s)는 매 행동 뒤 호출. onMonth(s)는 월 결산 직전 한 번. */
export function playCampaign(d, { seed = 1, strategy = 'constitutional', onStep = () => {}, onMonth = null, maxSteps = 6000 } = {}) {
  const strat = STRATEGIES[strategy], r = rng(seed * 7919 + 13);
  let s = E.createState(d, seed), steps = 0;
  const seen = { events: new Set(), endings: new Set() };
  onStep(s);
  while (!s.ending) {
    if (++steps > maxSteps) throw new Error(`교착: ${maxSteps}단계 안에 끝나지 않음 (turn ${s.turn})`);
    if (s.queue.length) {
      const e = d.events.find(x => x.id === s.queue[0]); seen.events.add(e.id);
      s = exec(s, d, { type: 'choose', choiceId: strat.choose(s, d, e, r) });
    } else {
      const turn = s.turn;
      s = strat.act(s, d, r); onStep(s);
      if (s.queue.length || s.ending) continue;
      if (onMonth) onMonth(s);
      s = exec(s, d, { type: 'endMonth' });
      if (s.turn !== turn + 1 && !s.ending) throw new Error('월 종료 후 날짜가 한 달 진행되지 않음');
    }
    onStep(s);
  }
  seen.endings.add(s.ending.id);
  return { state: s, seen, steps };
}
