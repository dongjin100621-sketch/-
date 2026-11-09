/* 자동 캠페인 밸런스 보고서. 의존성 없음.
 *   node tools/simulate.mjs                 # 전략마다 40개 시드
 *   node tools/simulate.mjs 200 military    # 시드 수와 전략 지정
 * 출력: 전략별 엔딩 분포, 최종 지표 평균, 도달하지 못한 사건·엔딩. 불변식 위반이 있으면 종료 코드 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playCampaign, checkInvariants, STRATEGIES } from '../tests/helpers/campaign.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const d = JSON.parse(fs.readFileSync(path.join(root, 'data/game.json'), 'utf8'));
const seeds = Number(process.argv[2] || 40);
const only = process.argv[3];
const seenEvents = new Set(), seenEndings = new Set();
let violations = 0;
for (const strategy of Object.keys(STRATEGIES).filter(x => !only || x === only)) {
  const endings = {}, sums = {}, started = Date.now();
  for (let seed = 1; seed <= seeds; seed++) {
    let result;
    try { result = playCampaign(d, { seed: seed * 104729 + strategy.length, strategy, onStep: s => checkInvariants(s, d) }); }
    catch (e) { violations++; console.error(`[${strategy} seed ${seed}] ${e.message}`); continue; }
    const s = result.state;
    for (const id of result.seen.events) seenEvents.add(id);
    seenEndings.add(s.ending.id); endings[s.ending.id] = (endings[s.ending.id] || 0) + 1;
    for (const k of ['gdp', 'liberty', 'legitimacy', 'welfare', 'equality', 'environment', 'industry', 'debt']) sums[k] = (sums[k] || 0) + s.stats[k];
    sums.turn = (sums.turn || 0) + s.turn;
  }
  const avg = Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, +(v / seeds).toFixed(1)]));
  console.log(`\n## ${strategy} (${seeds} seeds, ${((Date.now() - started) / 1000).toFixed(1)}s)`);
  console.log('엔딩:', Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log('최종 평균:', JSON.stringify(avg));
}
console.log(`\n사건 도달 ${seenEvents.size}/${d.events.length}`, d.events.filter(e => !seenEvents.has(e.id)).map(e => e.id).join(', ') || '(모두 도달)');
console.log(`엔딩 도달 ${seenEndings.size}/${d.endings.length}`, d.endings.filter(e => !seenEndings.has(e.id)).map(e => e.id).join(', ') || '(모두 도달)');
if (violations) { console.error(`불변식 위반 ${violations}건`); process.exit(1); }
