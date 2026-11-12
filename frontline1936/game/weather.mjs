/* 전선과 공장 — 날씨. 항공 구역과 해역마다 하루 날씨가 있다. 기후대의 달별 확률에서 뽑고, 어제의 날씨가 며칠 이어진다.
 * 남반구(오스트레일리아·뉴질랜드·남쪽 바다)는 계절을 여섯 달 밀어 쓴다. 효과의 수치는 data/game.json의 weather. */
import { index, dateOf, rand } from './core.mjs';

const zoneOf = (d, id) => { const X = index(d); return X.airZones.get(id) || X.seas.get(id) || (X.regions.get(id) && X.airZones.get(X.regions.get(id).airZone)) || null; };
/** 이 지역·해역·항공 구역의 오늘 날씨 정의(이름과 효과). */
export function weatherOf(s, d, id) {
  const z = zoneOf(d, id);
  const code = (z && s.weather && s.weather[z.id]) || 'clear';
  return { code, ...d.weather[code] };
}
function pick(s, table) {
  let r = rand(s);
  for (const [code, p] of Object.entries(table)) { if (r < p) return code; r -= p; }
  return 'clear';
}
/** 하루 날씨를 정한다(결정적). */
export function dailyWeather(s, d) {
  const t = dateOf(s.day);
  s.weather = s.weather || {};
  for (const z of [...d.airZones, ...d.seas]) {
    const m = z.south ? ((t.m + 5) % 12) + 1 : t.m;
    const table = d.climates[z.climate].months[m - 1];
    const cur = s.weather[z.id];
    const keep = cur === 'typhoon' ? .6 : cur === 'snow' || cur === 'blizzard' ? .85 : cur && cur !== 'clear' ? .72 : .8;
    if (cur && (table[cur] || cur === 'clear') && rand(s) < keep) continue;
    s.weather[z.id] = pick(s, table);
  }
}
