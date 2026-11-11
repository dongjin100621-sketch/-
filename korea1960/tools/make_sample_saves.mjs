/* 검토용 저장 파일(저장 형식 5)을 game/saves/에 다시 만든다.
 *   node tools/make_sample_saves.mjs
 * 이전 형식(1~4)의 저장은 tests/fixtures/에 거부 검사용으로만 남아 있다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, dispatch, exportSave, importSave, PREPARE_PHASES } from '../game/engine.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const d = JSON.parse(fs.readFileSync(path.join(root, 'data/game.json'), 'utf8'));
let s = createState(d, 20261110);
function action(a) { const r = dispatch(s, d, a); if (!r.ok) throw Error(`${a.type}: ${r.error}`); s = r.state; }
function solve() { while (s.queue.length && !s.ending) { const e = d.events.find(e => e.id === s.queue[0]); const c = e.choices.find(c => !c.ending && (c.effects.treasury || 0) >= 0 && !c.setFlags?.authoritarian && c.phase !== 'transition') || e.choices[0]; action({ type: 'choose', choiceId: c.id }); } }
function until(turn) { while (s.turn < turn && !s.ending) { solve(); if (s.ending) break; while (PREPARE_PHASES.includes(s.phase) && s.ap > 0) action({ type: 'prepare' }); action({ type: 'endMonth' }); } if (s.ending) throw Error('Sample seed ended before target'); solve(); }
function write(name, note) {
  const p = path.join(root, 'game/saves', name); fs.mkdirSync(path.dirname(p), { recursive: true });
  const raw = exportSave(s); importSave(raw, d); fs.writeFileSync(p, raw + '\n'); console.log(name, s.turn, s.phase, `AP ${s.ap}`, note);
}
for (const f of fs.readdirSync(path.join(root, 'game/saves'))) if (f.endsWith('.json')) fs.unlinkSync(path.join(root, 'game/saves', f));
until(48);
write('1964_start_governing.json', '취임 직후, 행동점수 3 그대로');
action({ type: 'coalition', id: 'petite' }); action({ type: 'enact', id: 'press_freedom' }); action({ type: 'build', id: 'school', regionId: 'jeonnam' });
until(49); action({ type: 'build', id: 'construction', regionId: 'capital' }); action({ type: 'build', id: 'irrigation', regionId: 'jeonbuk' }); action({ type: 'policy', id: 'farm_extension' });
until(50); action({ type: 'build', id: 'garment', regionId: 'busan' }); action({ type: 'adviser', id: 'min' });
until(60);
write('1965_market_and_laws.json', '건설 대기열과 준공, 법률 제정 절차, 소시민이 든 집권 연합');
action({ type: 'edict', id: 'grain_drive', regionId: 'jeonbuk' }); action({ type: 'build', id: 'coal_mine', regionId: 'gangwon' });
until(61); action({ type: 'edict', id: 'export_priority', regionId: 'busan' }); action({ type: 'build', id: 'port', regionId: 'busan' });
until(74);
write('1966_regional_edicts.json', '지역 시책 2개(전북 곡창·부산 수출 공업)와 자원 건물(강원 탄광) 이후');
until(156);
write('1973_policy_choices.json', '1973년 1월 중화학공업 사건 직후');
