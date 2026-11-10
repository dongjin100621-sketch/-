/* 검토용 저장 파일(저장 형식 4)을 game/saves/에 다시 만든다.
 *   node tools/make_sample_saves.mjs
 * example/saves/의 두 파일은 제작 패키지 v1이 만든 버전 1 저장이며, 변환(migrateSave) 검사용으로 그대로 둔다. */
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
until(48);
write('1964_start_governing.json', '취임 직후, 행동점수 3 그대로');
action({ type: 'policy', id: 'press_freedom' }); action({ type: 'project', id: 'rural_clinic', regionId: 'jeonnam' }); action({ type: 'adviser', id: 'min' });
until(56);
action({ type: 'policy', id: 'farm_extension' }); action({ type: 'diplomacy', countryId: 'japan', mode: 'talk' });
write('1964_bills_and_projects.json', '법안 결과·사업 준공 이후, AP 1 남음');
until(60);
action({ type: 'edict', id: 'grain_drive', regionId: 'jeonbuk' }); action({ type: 'project', id: 'farmland_consolidation', regionId: 'jeonbuk' }); action({ type: 'edict', id: 'forest_protection', regionId: 'gangwon' });
until(61);
action({ type: 'project', id: 'coal_mechanization', regionId: 'gangwon' }); action({ type: 'edict', id: 'export_priority', regionId: 'busan' });
until(74);
write('1966_regional_edicts.json', '지역 시책 3개(전북 곡창·강원 산림·부산 수출 공업)와 고유 사업 2건 준공 이후');
until(156);
write('1973_policy_choices.json', '1973년 1월 중화학공업 사건 직후');
