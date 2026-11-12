// data/src/*.mjs와 data/map.json을 합쳐 data/game.json을 만들고, ID·참조·범위를 검사한다.
// node tools/build_data.mjs        → data/game.json 쓰기 + 검사
// node tools/build_data.mjs --check → 검사만
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGION_TABLE, HOMELAND_TABLE, HOMELAND_LINKS, EXTRA_LINKS } from '../data/src/regions.mjs';
import { COUNTRIES, FACTIONS, RELEASABLE } from '../data/src/countries.mjs';
import * as R from '../data/src/rules.mjs';
import { FOCUS_TREES, AI_FOCUS_ORDER } from '../data/src/focus.mjs';
import { EVENTS, SYSTEM_EVENTS } from '../data/src/events.mjs';
import { LEADERS, TRAITS } from '../data/src/leaders.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/map.json'), 'utf8'));
const errors = [];
const err = m => errors.push(m);

const SEA_NAMES = {
  okhotsk_sea: '오호츠크해', japan_sea_n: '동해 북부', japan_sea_s: '동해 남부', tsushima_strait: '대한 해협', yellow_sea: '황해', bohai: '발해',
  east_china_sea: '동중국해', formosa_strait: '타이완 해협', scs_n: '남중국해 북부', scs_s: '남중국해 남부', tonkin_gulf: '통킹만', siam_gulf: '타이만',
  malacca: '말라카 해협', andaman_sea: '안다만해', bengal_bay: '벵골만', indian_n: '인도양 북부', laccadive: '라카디브해', indian_se: '인도양 동부',
  indian_s: '인도양 남부', java_sea: '자바해', sulu_sea: '술루해', celebes_sea: '셀레베스해', molucca_sea: '몰루카해', banda_sea: '반다해',
  timor_sea: '티모르해', arafura_sea: '아라푸라해', coral_sea: '산호해', solomon_sea: '솔로몬해', bismarck_sea: '비스마르크해', tasman_sea: '태즈먼해',
  australia_s: '오스트레일리아 남쪽 바다', philippine_sea: '필리핀해', palau_sea: '팔라우 근해', marianas: '마리아나 근해', carolines: '캐롤라인 근해',
  marshalls_sea: '마셜 근해', japan_south: '일본 남쪽 태평양', japan_east: '일본 동쪽 태평양', kuril_sea: '쿠릴 근해', north_pacific: '북태평양',
  bering: '베링해', wake_sea: '웨이크 근해', midway_sea: '미드웨이 근해', hawaii_sea: '하와이 근해', central_pacific: '중부 태평양',
  gilbert_sea: '길버트 근해', south_pacific: '남태평양', pacific_ne: '동태평양'
};

function parseTable(text, offmap) {
  return text.trim().split('\n').map(line => {
    const [id, name, owner, terrain, vp, pop, infra, port, air, res, build] = line.split('|');
    const kv = s => Object.fromEntries((s || '').split(',').filter(Boolean).map(x => { const m = x.match(/^([a-z_]+?)(\d+(?:\.\d+)?)$/); if (!m) err(`${id}: 해석할 수 없는 항목 ${x}`); return [m[1], Number(m[2])]; }));
    return { id, name, owner, terrain, vp: +vp, pop: +pop, infra: +infra, port: +port, air: +air, fort: 0, res: kv(res), build: kv(build), offmap: !!offmap };
  });
}

const regions = [...parseTable(REGION_TABLE), ...parseTable(HOMELAND_TABLE, true)];
const ids = new Set();
for (const r of regions) { if (ids.has(r.id)) err(`지역 ID 중복: ${r.id}`); ids.add(r.id); }
// 지도와 맞추기
const adj = new Map(regions.map(r => [r.id, new Set()]));
for (const [a, b] of [...map.adjacency, ...EXTRA_LINKS]) { if (!adj.has(a) || !adj.has(b)) { err(`인접 목록의 알 수 없는 지역: ${a}-${b}`); continue; } adj.get(a).add(b); adj.get(b).add(a); }
for (const r of regions) {
  if (r.offmap) { r.link = HOMELAND_LINKS[r.id]; if (!r.link) err(`본국 연결 없음: ${r.id}`); r.adj = []; r.coast = []; r.label = null; continue; }
  const m = map.regions[r.id];
  if (!m) { err(`지도에 없는 지역: ${r.id}`); continue; }
  r.label = m.label; r.area = m.area;
  r.adj = [...adj.get(r.id)].sort();
  r.coast = map.coast[r.id] || [];
  if (!r.coast.length && r.port > 0) err(`해안이 아닌데 항구가 있다: ${r.id}`);
  if (!r.adj.length && !r.coast.length) err(`고립된 지역: ${r.id}`);
  if (!R.TERRAIN[r.terrain]) err(`${r.id}: 알 수 없는 지형 ${r.terrain}`);
}
for (const id of Object.keys(map.regions)) if (!ids.has(id)) err(`표에 없는 지도 지역: ${id}`);
// 해역
const seaAdj = new Map(Object.keys(map.seas).map(s => [s, new Set()]));
for (const [a, b] of map.seaAdjacency) { seaAdj.get(a).add(b); seaAdj.get(b).add(a); }
const seas = Object.entries(map.seas).map(([id, s]) => ({ id, name: SEA_NAMES[id] || (err(`해역 이름 없음: ${id}`), id), label: s.label, adj: [...seaAdj.get(id)].sort(), coast: regions.filter(r => (r.coast || []).includes(id)).map(r => r.id) }));
// 항공 구역: 지도 위 땅 지역의 이름표 좌표를 k-평균으로 묶는다(결정적).
function airZones(k) {
  const pts = regions.filter(r => !r.offmap).map(r => ({ id: r.id, x: r.label[0], y: r.label[1], vp: r.vp }));
  pts.sort((a, b) => a.id < b.id ? -1 : 1);
  let cs = pts.filter((_, i) => i % Math.floor(pts.length / k) === 0).slice(0, k).map(p => ({ x: p.x, y: p.y }));
  let assign = [];
  for (let it = 0; it < 30; it++) {
    assign = pts.map(p => { let best = 0, bd = Infinity; cs.forEach((c, i) => { const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; });
    cs = cs.map((c, i) => { const m = pts.filter((_, j) => assign[j] === i); return m.length ? { x: m.reduce((a, p) => a + p.x, 0) / m.length, y: m.reduce((a, p) => a + p.y, 0) / m.length } : c; });
  }
  const zones = cs.map((c, i) => ({ id: `az${i + 1}`, regions: pts.filter((_, j) => assign[j] === i).map(p => p.id), center: [Math.round(c.x), Math.round(c.y)] })).filter(z => z.regions.length);
  for (const z of zones) { const top = z.regions.map(id => regions.find(r => r.id === id)).sort((a, b) => b.vp - a.vp || b.pop - a.pop)[0]; z.name = `${top.name.replace(/\(.*\)/, '')} 상공`; }
  return zones;
}
const zones = airZones(36);
for (const r of regions) if (!r.offmap) r.airZone = zones.find(z => z.regions.includes(r.id)).id;
// 땅덩어리: 육지 인접으로 이어진 지역 묶음. 가장 큰 것이 유라시아 대륙, 간토가 든 것이 일본 본토.
{
  const seen = new Map(); let n = 0;
  for (const r of regions) {
    if (r.offmap || seen.has(r.id)) continue;
    const q = [r.id]; seen.set(r.id, n);
    while (q.length) { const id = q.shift(); for (const x of regions.find(y => y.id === id).adj) if (!seen.has(x)) { seen.set(x, n); q.push(x); } }
    n++;
  }
  const size = new Map(); for (const v of seen.values()) size.set(v, (size.get(v) || 0) + 1);
  const biggest = [...size].sort((a, b) => b[1] - a[1])[0][0], japan = seen.get('kanto');
  for (const r of regions) if (!r.offmap) r.landmass = seen.get(r.id) === biggest ? 'eurasia' : seen.get(r.id) === japan ? 'japan_home' : `m${seen.get(r.id)}`;
}
// 기후: 항공 구역·해역의 중심 좌표(위도·경도)로 기후대를 정한다. 남반구는 계절을 뒤집는다.
{
  const P = map.projection, mercTop = Math.log(Math.tan(Math.PI / 4 + P.latTop * Math.PI / 360)) * 180 / Math.PI;
  const lonlat = ([x, y]) => { let lon = x / P.scale + P.lon0; if (lon > 180) lon -= 360; const ym = (mercTop - y / P.scale) * Math.PI / 180; return [lon, (2 * Math.atan(Math.exp(ym)) - Math.PI / 2) * 180 / Math.PI]; };
  const HIGH = ['lhasa', 'ngari', 'chamdo', 'qinghai_w', 'xining', 'xikang', 'nepal', 'bhutan'];
  const ARID = ['gobi', 'khovd', 'alxa', 'hexi', 'hami', 'kashgar', 'khotan', 'urumqi', 'yinchuan', 'urga', 'dornod', 'outback', 'kimberley', 'rajputana', 'semipalatinsk', 'almaty'];
  const MARITIME = ['tohoku', 'kanto', 'chubu', 'kansai', 'chugoku', 'shikoku', 'kyushu'];
  const landClimate = (lat, lon, ids) => {
    const a = Math.abs(lat);
    if (ids.filter(r => HIGH.includes(r)).length * 2 >= ids.length) return 'highland';
    if (ids.filter(r => ARID.includes(r)).length * 2 >= ids.length) return 'arid';
    // 바다에 둘러싸인 일본 본토는 같은 위도의 대륙보다 겨울이 무르다: 냉대는 북위 40도부터.
    const sea = ids.filter(r => MARITIME.includes(r)).length * 2 >= ids.length ? 3 : 0;
    if (a >= 46 + sea) return 'frigid'; if (a >= 37 + sea) return 'cold'; if (a >= 28) return 'temperate'; if (a >= 19) return 'subtropical'; if (a >= 8) return 'monsoon'; return 'equatorial';
  };
  for (const z of zones) { const [lon, lat] = lonlat(z.center); z.lat = Math.round(lat * 10) / 10; z.lon = Math.round(lon * 10) / 10; z.climate = landClimate(lat, lon, z.regions); z.south = lat < 0; }
  for (const s of seas) {
    const [lon, lat] = lonlat(s.label), a = Math.abs(lat), lon360 = lon < 0 ? lon + 360 : lon;
    s.lat = Math.round(lat * 10) / 10; s.lon = Math.round(lon * 10) / 10; s.south = lat < 0;
    s.climate = a >= 40 ? 'sea_cold' : a >= 8 && a <= 36 && lon360 >= 105 && lon360 <= 175 ? 'sea_typhoon' : a < 12 ? 'sea_tropical' : 'sea_temperate';
  }
  for (const z of [...zones, ...seas]) if (!R.CLIMATES[z.climate]) err(`기후 없음: ${z.id}`);
}
const LEADER_CHECK = () => {
  const ids = new Set();
  for (const l of LEADERS) {
    if (ids.has(l.id)) err(`장군 ID 중복: ${l.id}`); ids.add(l.id);
    if (!cids.has(l.country)) err(`${l.id}: 나라 ${l.country}`);
    for (const k of ['skill', 'atk', 'def', 'plan', 'log']) if (!(l[k] >= 1 && l[k] <= 5)) err(`${l.id}.${k}`);
    for (const t of l.traits) if (!TRAITS[t]) err(`${l.id}: 특성 ${t}`);
    if (!['army', 'navy'].includes(l.kind)) err(`${l.id}: 종류`);
  }
};
// 식민지(일본의 국가 정신 '식민 통치'가 산출을 깎는 곳): 조선·타이완
const COLONY = new Set([...RELEASABLE.find(c => c.id === 'korea').cores, 'taiwan']);
for (const r of regions) if (COLONY.has(r.id)) r.colony = true;

// 나라
const allCountries = [...COUNTRIES, ...RELEASABLE.map(c => ({ ...c, releasable: true }))];
const cids = new Set(allCountries.map(c => c.id));
for (const r of regions) if (!cids.has(r.owner)) err(`${r.id}: 알 수 없는 소유국 ${r.owner}`);
const tplIds = new Set(R.TEMPLATES.map(t => t.id));
const regionIds = new Set(regions.map(r => r.id));
for (const c of allCountries) {
  if (!regionIds.has(c.capital)) err(`${c.id}: 수도 ${c.capital} 없음`);
  if (c.mapCapital && !regionIds.has(c.mapCapital)) err(`${c.id}: 지도 수도 ${c.mapCapital} 없음`);
  for (const [k, v] of Object.entries(c.laws)) if (!R.LAWS[k].options.some(o => o.id === v)) err(`${c.id}: 법 ${k}=${v} 없음`);
  for (const s of c.spirits) if (!R.SPIRITS[s]) err(`${c.id}: 정신 ${s} 없음`);
  for (const [t, , at] of c.forces) { if (!tplIds.has(t)) err(`${c.id}: 편제 ${t} 없음`); if (!regionIds.has(at)) err(`${c.id}: 배치 지역 ${at} 없음`); }
  for (const f of c.fleets) { if (!regionIds.has(f.at)) err(`${c.id}: 함대 위치 ${f.at} 없음`); for (const s of Object.keys(f.ships)) if (!R.SHIPS.some(x => x.id === s)) err(`${c.id}: 함선 ${s} 없음`); }
  for (const [t, , at] of c.air) { if (!R.AIRCRAFT[t]) err(`${c.id}: 항공기 ${t}`); if (!regionIds.has(at)) err(`${c.id}: 비행장 ${at}`); }
  const sum = Object.values(c.popularity).reduce((a, b) => a + b, 0); if (Math.abs(sum - 100) > .01) err(`${c.id}: 지지율 합 ${sum}`);
  if (!c.releasable && !regions.some(r => r.owner === c.id)) err(`${c.id}: 지역이 없다`);
}
LEADER_CHECK();
// 건물·자원
const bIds = new Set(R.BUILDINGS.map(b => b.id)), resIds = new Set(['coal', 'iron', 'oil', 'rubber', 'rare']);
for (const r of regions) {
  for (const k of Object.keys(r.res)) if (!resIds.has(k)) err(`${r.id}: 자원 ${k}`);
  for (const [b, n] of Object.entries(r.build)) {
    if (!bIds.has(b)) { err(`${r.id}: 건물 ${b}`); continue; }
    const def = R.BUILDINGS.find(x => x.id === b);
    if (def.res && n > (r.res[def.res] || 0)) err(`${r.id}: ${b} ${n}단계가 자원 ${r.res[def.res] || 0}보다 많다`);
  }
}
const goodIds = new Set(R.GOODS.map(g => g.id));
for (const b of R.BUILDINGS) for (const pm of b.pm) for (const g of [...Object.keys(pm.in || {}), ...Object.keys(pm.out || {}), ...Object.keys(pm.materials || {})]) if (!goodIds.has(g)) err(`${b.id}: 상품 ${g}`);
for (const e of R.EQUIPMENT) for (const g of Object.keys(e.recipe)) if (!goodIds.has(g)) err(`${e.id}: 상품 ${g}`);
const techIds = new Set(R.TECHS.map(t => t.id));
for (const t of R.TECHS) for (const q of t.req || []) if (!techIds.has(q)) err(`${t.id}: 선행 ${q}`);
for (const [c, list] of Object.entries(R.START_TECHS)) for (const t of list) if (!techIds.has(t)) err(`시작 기술 ${c}: ${t}`);
const batIds = new Set(R.BATTALIONS.map(b => b.id));
for (const t of R.TEMPLATES) { for (const b of [...Object.keys(t.bat), ...t.sup]) if (!batIds.has(b)) err(`${t.id}: 대대 ${b}`); }
// 중점
const evIds = new Set(EVENTS.map(e => e.id));
const fxCheck = (where, fx) => {
  for (const [b, , at] of fx.build || []) { if (!bIds.has(b)) err(`${where}: 건물 ${b}`); if (at !== 'capital' && !regionIds.has(at)) err(`${where}: 위치 ${at}`); }
  for (const [f, , at] of fx.facility || []) { if (!R.FACILITIES.some(x => x.id === f)) err(`${where}: 시설 ${f}`); if (at !== 'capital' && !regionIds.has(at)) err(`${where}: 위치 ${at}`); }
  for (const [t, , at] of fx.divisions || []) { if (!tplIds.has(t)) err(`${where}: 편제 ${t}`); if (at !== 'capital' && !regionIds.has(at)) err(`${where}: 위치 ${at}`); }
  if (fx.spirit && !R.SPIRITS[fx.spirit]) err(`${where}: 정신 ${fx.spirit}`);
  if (fx.removeSpirit && !R.SPIRITS[fx.removeSpirit]) err(`${where}: 정신 ${fx.removeSpirit}`);
  if (fx.event && !evIds.has(fx.event)) err(`${where}: 사건 ${fx.event}`);
  for (const t of fx.tech || []) if (!techIds.has(t)) err(`${where}: 기술 ${t}`);
  for (const c of [...(fx.wargoal || []), ...(fx.war || []), ...(fx.peace || []), ...(fx.annex || [])]) if (!cids.has(c)) err(`${where}: 나라 ${c}`);
  if (fx.research && !R.TECH_CATEGORIES.some(c => c.id === fx.research.cat)) err(`${where}: 연구 분류 ${fx.research.cat}`);
  for (const e of Object.keys(fx.equipment || {})) if (!R.EQUIPMENT.some(x => x.id === e)) err(`${where}: 장비 ${e}`);
  for (const [c, sub] of Object.entries(fx.others || {})) { if (!cids.has(c)) err(`${where}: 나라 ${c}`); fxCheck(`${where}>${c}`, sub); }
};
const focusIds = new Set();
for (const [owner, tree] of Object.entries(FOCUS_TREES)) {
  const local = new Set(tree.map(f => f.id));
  for (const f of tree) {
    if (focusIds.has(f.id)) err(`중점 ID 중복: ${f.id}`); focusIds.add(f.id);
    for (const q of f.req.split(/[,|]/).filter(Boolean)) if (!local.has(q)) err(`${f.id}: 선행 ${q}`);
    for (const q of f.excl.split(',').filter(Boolean)) if (!local.has(q)) err(`${f.id}: 배타 ${q}`);
    fxCheck(f.id, f.fx);
  }
  if (tree.some(f => tree.some(g => g !== f && g.x === f.x && g.y === f.y))) err(`${owner}: 같은 칸에 중점 둘`);
}
for (const [c, list] of Object.entries(AI_FOCUS_ORDER)) for (const id of list) if (!FOCUS_TREES[c].some(f => f.id === id)) err(`AI 순서 ${c}: ${id}`);
for (const e of EVENTS) { if (!cids.has(e.to)) err(`${e.id}: 받는 나라 ${e.to}`); for (const o of e.options) fxCheck(e.id, o.fx); }

const out = {
  meta: { title: '전선과 공장: 동아시아 1936', version: '0.2.0', start: '1936-01-01', end: '1945-12-31',
    note: '모든 수치·선택 결과·가상 선택지는 게임을 위한 창작이다. 실제 역사는 사건의 history에 따로 적었다. 지도는 Natural Earth(퍼블릭 도메인)에서 만들었다.' },
  terrain: R.TERRAIN, goods: R.GOODS, buildings: R.BUILDINGS, facilities: R.FACILITIES, equipment: R.EQUIPMENT, battalions: R.BATTALIONS, templates: R.TEMPLATES,
  ships: R.SHIPS, aircraft: R.AIRCRAFT, airMissions: R.AIR_MISSIONS, techCategories: R.TECH_CATEGORIES, techs: R.TECHS, startTechs: R.START_TECHS,
  laws: R.LAWS, ideologies: R.IDEOLOGIES, spirits: R.SPIRITS, economy: R.ECONOMY, weather: R.WEATHER, climates: R.CLIMATES, leaders: LEADERS, traits: TRAITS,
  countries: allCountries, factions: FACTIONS, regions, seas, airZones: zones,
  focusTrees: FOCUS_TREES, aiFocusOrder: AI_FOCUS_ORDER, events: EVENTS, systemEvents: SYSTEM_EVENTS
};
if (errors.length) { console.error(errors.join('\n')); console.error(`\n${errors.length}개 오류`); process.exit(1); }
if (!process.argv.includes('--check')) fs.writeFileSync(path.join(ROOT, 'data/game.json'), JSON.stringify(out, null, 1) + '\n');
const onMap = regions.filter(r => !r.offmap);
console.log(`데이터 OK: 장군·제독 ${LEADERS.length}, 기후대 ${Object.keys(R.CLIMATES).length}, 나라 ${allCountries.length}(플레이 ${allCountries.filter(c => c.playable).length}), 지역 ${onMap.length}+본국 ${regions.length - onMap.length}, 해역 ${seas.length}, 항공 구역 ${zones.length}, 중점 ${focusIds.size}, 사건 ${EVENTS.length}, 기술 ${R.TECHS.length}, 편제 ${R.TEMPLATES.length}`);
