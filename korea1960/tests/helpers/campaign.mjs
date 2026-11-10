/* 자동 캠페인 진행 도우미. tests/game.test.mjs와 tools/simulate.mjs가 함께 쓴다.
 * 전략 결정에는 상태의 난수(s.rng)를 쓰지 않고 별도 시드의 난수를 쓴다. 그래야 엔진의 결정성을 해치지 않는다. */
import * as E from '../../game/engine.mjs';

export function rng(seed) { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

/** 매 행동 뒤의 불변식. 위반하면 Error를 던진다. */
export function checkInvariants(s, d) {
  const fail = m => { throw new Error(`[${E.dateLabel(Math.min(s.turn, 239))} t${s.turn}] ${m}`); };
  for (const m of d.metrics) { const v = s.stats[m.id]; if (!Number.isFinite(v) || v < m.min || v > m.max) fail(`지표 ${m.id}=${v}`); }
  for (const f of d.factions) { const v = s.support[f.id]; if (!Number.isFinite(v) || v < 0 || v > 100) fail(`지지 ${f.id}=${v}`); }
  for (const n of d.countries) { const v = s.relations[n.id]; if (!Number.isFinite(v) || v < 0 || v > 100) fail(`관계 ${n.id}=${v}`); }
  if (!Number.isInteger(s.ap) || s.ap < 0 || s.ap > 3) fail(`AP ${s.ap}`);
  if (s.turn > 240) fail('turn > 240');
  if (s.history.length !== s.turn + 1) fail(`history ${s.history.length} != turn+1`);
  for (const id of s.queue) {
    const e = d.events.find(x => x.id === id); if (!e) fail(`미등록 사건 ${id}`);
    if (e.choices.length !== 3 || e.choices.some(c => !c.label)) fail(`빈 선택지 ${id}`);
  }
  if (s.queue.length && !s.ending) {
    const e = d.events.find(x => x.id === s.queue[0]);
    if (!e.choices.some(c => !E.choiceReason(s, d, c.id))) fail(`선택 가능한 선택지가 없음 ${e.id}`);
  }
  for (const p of s.projects) {
    const def = d.projects.find(x => x.id === p.projectId), elapsed = s.turn - p.startedTurn;
    if (p.status === 'building' && p.remaining !== def.months - elapsed) fail(`공기 불일치 ${p.projectId}@${p.regionId} remaining=${p.remaining} elapsed=${elapsed}`);
    if (p.status === 'building' && p.remaining <= 0) fail(`미완공 정지 ${p.projectId}`);
    if (p.status === 'complete' && (p.remaining !== 0 || p.completedTurn !== p.startedTurn + def.months - 1)) fail(`준공 시점 오류 ${p.projectId}`);
  }
  for (const b of s.bills) {
    if (['passed', 'failed'].includes(b.status)) { if (b.remaining !== 0 || !Number.isFinite(b.probability) || !Number.isFinite(b.roll)) fail(`표결 기록 ${b.policyId}`); }
    else if (b.remaining !== b.total - (s.turn - b.startedTurn) || b.remaining <= 0) fail(`심의 기간 오류 ${b.policyId}`);
  }
  if (new Set(s.policies).size !== s.policies.length) fail('정책 중복');
  for (const r of d.regions) if (s.projects.filter(p => p.regionId === r.id).length > r.slots) fail(`슬롯 초과 ${r.id}`);
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

const exec = (s, d, a) => { const r = E.dispatch(s, d, a); if (!r.ok) throw new Error(`${a.type} 실패: ${r.error} @t${s.turn}`); return r.state; };
const tryDo = (s, d, a) => { const r = E.dispatch(s, d, a); return r.ok ? r.state : s; };
const regionsByDev = (s, d) => [...d.regions].sort((a, b) => E.regionDevelopment(s, d, a.id) - E.regionDevelopment(s, d, b.id));

/** 정해진 우선순위로 사건을 고르고 정책·사업·자문·외교를 쓰는 전략을 만든다. */
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
      const reserve = cfg.minTreasury ?? 35;
      for (const id of cfg.policies) { if (s.ap < 2 || s.stats.treasury < reserve) break; s = tryDo(s, d, { type: 'policy', id }); }
      if (s.advisers.length < 2 && s.ap > 0) for (const id of cfg.advisers) s = tryDo(s, d, { type: 'adviser', id });
      if (s.ap > 0 && s.stats.treasury > reserve + 5) {
        outer: for (const reg of regionsByDev(s, d)) for (const id of cfg.projects) { const n = tryDo(s, d, { type: 'project', id, regionId: reg.id }); if (n !== s) { s = n; break outer; } }
      }
      if (!cfg.noRepay && s.ap > 0 && s.stats.debt > 200 && s.stats.treasury > 70) s = tryDo(s, d, { type: 'repay', amount: 20 });
      if (s.ap > 0) s = tryDo(s, d, { type: 'diplomacy', countryId: d.countries[Math.floor(r() * d.countries.length)].id, mode: cfg.diplomacy });
      return s;
    }
  };
}

/** 전략: 사건 선택 함수 + 월 행동 함수. */
export const STRATEGIES = {
  /** 헌정 경로·권리 중시. 정책·법안·사업·외교·자문·예산을 모두 사용. */
  constitutional: {
    choose(s, d, e, r) {
      const pref = { may_1961: 'may_1961_1', yushin_1972: 'yushin_1972_1', buma_1979: 'buma_1979_1', election_1963: 'election_1963_2' };
      if (pref[e.id]) return pref[e.id];
      const ok = e.choices.filter(c => !E.choiceReason(s, d, c.id) && !c.ending && !c.setFlags?.authoritarian && c.phase !== 'transition');
      const score = c => (c.effects.liberty || 0) * 2 + (c.effects.legitimacy || 0) * 2 + (c.effects.welfare || 0) + (c.effects.equality || 0) + (c.effects.environment || 0) + (c.influence || 0) + r() * 2;
      return (ok.sort((a, b) => score(b) - score(a))[0] || e.choices.find(c => !E.choiceReason(s, d, c.id))).id;
    },
    act(s, d, r) {
      if (E.PREPARE_PHASES.includes(s.phase)) { while (s.ap > 0) s = exec(s, d, { type: 'prepare' }); return s; }
      if (!E.isExecutive(s)) return s;
      if (s.turn % 12 === 0) s = tryDo(s, d, { type: 'budget', budget: { industry: 18, agriculture: 16, education: 20, welfare: 20, infrastructure: 16, security: 10 } });
      const order = ['press_freedom', 'association', 'judicial_review', 'labor_inspection', 'primary_school', 'health_centers', 'open_accounts', 'civil_service', 'local_council', 'clean_water', 'farm_extension', 'rural_coops', 'housing', 'technical_school', 'small_business', 'export_credit', 'price_stability', 'civilian_oversight', 'energy_efficiency', 'research_fund', 'grid_planning', 'rail_priority', 'grain_buffer', 'diplomatic_diversity'];
      for (const id of order) { if (s.ap < 2 || s.stats.treasury < 40) break; s = tryDo(s, d, { type: 'policy', id }); }
      if (s.advisers.length < 2 && s.ap > 0) for (const id of ['min', 'yun']) s = tryDo(s, d, { type: 'adviser', id });
      if (s.ap > 0 && s.stats.treasury > 45) {
        const projects = ['rural_clinic', 'primary_campus', 'waterworks', 'irrigation', 'local_road', 'river_restoration', 'public_housing', 'technical_campus', 'market_storage', 'research_campus'];
        outer: for (const reg of regionsByDev(s, d)) for (const id of projects) { const n = tryDo(s, d, { type: 'project', id, regionId: reg.id }); if (n !== s) { s = n; break outer; } }
      }
      if (s.ap > 0 && s.stats.debt > 150 && s.stats.treasury > 60) s = tryDo(s, d, { type: 'repay', amount: 25 });
      if (s.ap > 0) s = tryDo(s, d, { type: 'diplomacy', countryId: d.countries[Math.floor(r() * d.countries.length)].id, mode: 'humanitarian' });
      return s;
    }
  },
  /** 군정·권위주의 경로·산업 우선. */
  military: {
    choose(s, d, e, r) {
      const pref = { may_1961: 'may_1961_2', yushin_1972: 'yushin_1972_2', heavy_1973: 'heavy_1973_2', election_1963: 'election_1963_1', buma_1979: 'buma_1979_2' };
      if (pref[e.id]) return pref[e.id];
      const ok = e.choices.filter(c => !E.choiceReason(s, d, c.id) && !c.ending);
      const score = c => (c.effects.industry || 0) * 2 + (c.effects.reserves || 0) + (c.effects.stability || 0) + (c.effects.treasury || 0) * .2 + r();
      return (ok.sort((a, b) => score(b) - score(a))[0] || e.choices[0]).id;
    },
    act(s, d, r) {
      if (E.PREPARE_PHASES.includes(s.phase)) { while (s.ap > 0) s = exec(s, d, { type: 'prepare' }); return s; }
      if (!E.isExecutive(s)) return s;
      if (s.turn % 12 === 0) s = tryDo(s, d, { type: 'budget', budget: { industry: 34, agriculture: 12, education: 14, welfare: 8, infrastructure: 22, security: 10 } });
      for (const id of ['export_credit', 'small_business', 'technical_school', 'rail_priority', 'grid_planning', 'diplomatic_diversity', 'price_stability', 'civil_service', 'research_fund']) { if (s.ap < 1 || s.stats.treasury < 30) break; s = tryDo(s, d, { type: 'policy', id }); }
      if (s.advisers.length < 2 && s.ap > 0) for (const id of ['cho', 'han']) s = tryDo(s, d, { type: 'adviser', id });
      for (let i = 0; i < 2 && s.ap > 0; i++) {
        const projects = ['steel_complex', 'shipyard', 'light_industry', 'port_upgrade', 'power_grid', 'rail_hub', 'technical_campus', 'local_road'];
        outer: for (const reg of [...d.regions].sort(() => r() - .5)) for (const id of projects) { const n = tryDo(s, d, { type: 'project', id, regionId: reg.id }); if (n !== s) { s = n; break outer; } }
      }
      if (s.ap > 0) s = tryDo(s, d, { type: 'diplomacy', countryId: 'usa', mode: 'technology' });
      return s;
    }
  },
  /** 복지 우선: 헌정 경로, 생활·분배·교육 중심 예산과 정책. */
  welfare: focused({
    route: 'may_1961_1', yushin: 'yushin_1972_1', buma: 'buma_1979_1',
    weights: { welfare: 3, equality: 2.5, education: 1, legitimacy: .3, treasury: .05 },
    budget: { industry: 12, agriculture: 18, education: 22, welfare: 30, infrastructure: 10, security: 8 },
    policies: ['health_centers', 'housing', 'primary_school', 'labor_inspection', 'rural_coops', 'local_council', 'small_business', 'farm_extension', 'grain_buffer', 'price_stability'],
    projects: ['rural_clinic', 'public_housing', 'primary_campus', 'waterworks', 'market_storage', 'irrigation'],
    advisers: ['kang', 'yun'], diplomacy: 'humanitarian'
  }),
  /** 환경 우선: 헌정 경로, 환경 부담을 줄이며 완만한 성장. */
  green: focused({
    route: 'may_1961_1', yushin: 'yushin_1972_3', buma: 'buma_1979_1',
    weights: { environment: 3, welfare: 1, agriculture: 1, education: 1, industry: -.5, treasury: .05 },
    budget: { industry: 16, agriculture: 20, education: 20, welfare: 16, infrastructure: 18, security: 10 },
    policies: ['clean_water', 'energy_efficiency', 'grid_planning', 'research_fund', 'technical_school', 'export_credit', 'farm_extension', 'rail_priority', 'small_business', 'primary_school'],
    projects: ['river_restoration', 'waterworks', 'research_campus', 'technical_campus', 'irrigation', 'rail_hub', 'port_upgrade'],
    advisers: ['yun', 'kang'], diplomacy: 'technology'
  }),
  /** 강경: 군정·권력 집중 경로에서 통제와 동원을 우선한다. 위기 엔딩 도달 확인용. */
  hardline: focused({
    route: 'may_1961_2', election: 'election_1963_1', yushin: 'yushin_1972_2', buma: 'buma_1979_2', heavy: 'heavy_1973_2',
    weights: { security: 2, stability: 2, admin: 1.5, industry: 1, legitimacy: 1, liberty: -2, treasury: .1 },
    budget: { industry: 30, agriculture: 10, education: 10, welfare: 6, infrastructure: 20, security: 24 },
    policies: ['export_credit', 'civil_service', 'rail_priority', 'grid_planning', 'diplomatic_diversity'],
    projects: ['steel_complex', 'shipyard', 'light_industry', 'power_grid', 'port_upgrade', 'rail_hub'],
    advisers: ['cho', 'lee'], diplomacy: 'talk', allowAuthoritarian: true, prepareOnlyWhenNeeded: false
  }),
  /** 성장 우선: 헌정 경로를 지키되 산업·기반시설에 집중하고 분배·권리는 뒤로 미룬다. */
  growth: focused({
    route: 'may_1961_1', yushin: 'yushin_1972_3', buma: 'buma_1979_2', heavy: 'heavy_1973_1',
    weights: { industry: 3, infrastructure: 1.5, reserves: 1, legitimacy: .5, treasury: .1 },
    budget: { industry: 34, agriculture: 12, education: 16, welfare: 8, infrastructure: 22, security: 8 },
    policies: ['export_credit', 'small_business', 'technical_school', 'rail_priority', 'grid_planning', 'research_fund', 'price_stability', 'diplomatic_diversity', 'civil_service'],
    projects: ['steel_complex', 'shipyard', 'light_industry', 'port_upgrade', 'power_grid', 'rail_hub', 'technical_campus', 'research_campus'],
    advisers: ['cho', 'han'], diplomacy: 'technology'
  }),
  /** 소극: 사건에서 첫 번째로 가능한 선택만 고르고 국정 행동을 하지 않는다. */
  passive: {
    choose(s, d, e) { return (e.choices.find(c => !E.choiceReason(s, d, c.id) && !c.ending) || e.choices.find(c => !E.choiceReason(s, d, c.id))).id; },
    act(s, d) { if (E.PREPARE_PHASES.includes(s.phase)) while (s.ap > 0) s = exec(s, d, { type: 'prepare' }); return s; }
  },
  /** 무작위: 가능한 행동 중 아무거나. 교착·악용 탐지용. */
  random: {
    choose(s, d, e, r) { const ok = e.choices.filter(c => !E.choiceReason(s, d, c.id)); return ok[Math.floor(r() * ok.length)].id; },
    act(s, d, r) {
      for (let i = 0; i < 6 && s.ap > 0; i++) {
        const k = Math.floor(r() * 8);
        const a = k === 0 ? { type: 'prepare' }
          : k === 1 ? { type: 'policy', id: d.policies[Math.floor(r() * d.policies.length)].id }
            : k === 2 ? { type: 'project', id: d.projects[Math.floor(r() * d.projects.length)].id, regionId: d.regions[Math.floor(r() * d.regions.length)].id }
              : k === 3 ? { type: 'diplomacy', countryId: d.countries[Math.floor(r() * d.countries.length)].id, mode: ['talk', 'technology', 'humanitarian'][Math.floor(r() * 3)] }
                : k === 4 ? { type: 'adviser', id: d.advisers[Math.floor(r() * d.advisers.length)].id }
                  : k === 5 ? { type: 'repay', amount: 10 }
                    : k === 6 ? { type: 'budget', budget: (() => { const w = E.BUDGET_KEYS.map(() => 1 + Math.floor(r() * 10)); const t = w.reduce((a, b) => a + b, 0); const v = w.map(x => Math.floor(x / t * 100)); v[0] += 100 - v.reduce((a, b) => a + b, 0); return Object.fromEntries(E.BUDGET_KEYS.map((key, j) => [key, v[j]])); })() }
                      : { type: 'endMonth' };
        if (a.type === 'endMonth') break;
        s = tryDo(s, d, a);
      }
      return s;
    }
  }
};

/** 한 캠페인을 끝까지 진행한다. onStep(s)는 매 행동 뒤 호출. */
export function playCampaign(d, { seed = 1, strategy = 'constitutional', onStep = () => {}, maxSteps = 6000 } = {}) {
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
      s = exec(s, d, { type: 'endMonth' });
      if (s.turn !== turn + 1 && !s.ending) throw new Error('월 종료 후 날짜가 한 달 진행되지 않음');
    }
    onStep(s);
  }
  seen.endings.add(s.ending.id);
  return { state: s, seen, steps };
}
