"""Validate IDs, references, no-cost choices, condition DSL and the canonical split files.

python3 tools/validate_content.py          # 검사만
python3 tools/validate_content.py --sync   # data/game.json(정본)에서 분리본 11개를 다시 만든 뒤 검사
"""
from pathlib import Path
import json, sys, argparse
root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(); p.add_argument('--sync', action='store_true'); a = p.parse_args()
d = json.loads((root / 'data/game.json').read_text(encoding='utf-8'))
errors = []
keys = ['metrics', 'factions', 'regions', 'countries', 'policies', 'projects', 'advisers', 'events', 'endings', 'achievements', 'sources']
for k in keys:
    ids = [x['id'] for x in d[k]]
    if len(ids) != len(set(ids)): errors.append(f'duplicate {k} ID')
    split = root / f'data/{k}.json'
    if a.sync: split.write_text(json.dumps(d[k], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if json.loads(split.read_text(encoding='utf-8')) != d[k]: errors.append(f'split mismatch: {k}')
metrics = {x['id'] for x in d['metrics']}; sources = {x['id'] for x in d['sources']}; factions = {x['id'] for x in d['factions']}
countries = {x['id'] for x in d['countries']}; endings = {x['id'] for x in d['endings']}; all_choices = []
phases = {'prelude', 'civilian', 'transition', 'elected', 'governing'}
flag_keys = {'route', 'won1963', 'constitutionalLimit', 'authoritarian'}
condition_keys = {'phaseIn', 'flag', 'eq', 'yearGte', 'yearLte', 'metric', 'gte', 'lte'}
num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)

def check_effects(effects, allowed, where):
    if not isinstance(effects, dict): errors.append(f'effects not object {where}'); return
    for k, v in effects.items():
        if k not in allowed or not num(v): errors.append(f'invalid effect {where}: {k}')

def check_conditions(conds, where):
    if not isinstance(conds, list): errors.append(f'conditions not list {where}'); return
    for c in conds:
        if not isinstance(c, dict) or not c or set(c) - condition_keys: errors.append(f'unknown condition {where}: {c}'); continue
        if 'phaseIn' in c and (not isinstance(c['phaseIn'], list) or set(c['phaseIn']) - phases): errors.append(f'bad phaseIn {where}')
        if 'flag' in c and (c['flag'] not in flag_keys or 'eq' not in c): errors.append(f'bad flag condition {where}')
        if 'metric' in c and (c['metric'] not in metrics or not any(k in c for k in ('gte', 'lte'))): errors.append(f'bad metric condition {where}')
        for k in ('yearGte', 'yearLte', 'gte', 'lte'):
            if k in c and not num(c[k]): errors.append(f'bad number {where}: {k}')

for e in d['events']:
    if len(e['choices']) != 3: errors.append('choice count ' + e['id'])
    if not any(c.get('effects', {}).get('treasury', 0) >= 0 for c in e['choices']): errors.append('no free choice ' + e['id'])
    if e['kind'] not in ('historical_anchor', 'fictional_system'): errors.append('kind ' + e['id'])
    if e['kind'] == 'historical_anchor' and not e['sourceIds']: errors.append('history source missing ' + e['id'])
    if any(s not in sources for s in e['sourceIds']): errors.append('source ref ' + e['id'])
    if e['art'] not in ['cover', 'cabinet', 'industry', 'civic']: errors.append('art ref ' + e['id'])
    if not e.get('title') or not e.get('body'): errors.append('empty text ' + e['id'])
    check_conditions(e['conditions'], e['id'])
    if 'context' in e:
        if not isinstance(e['context'], list) or not e['context']: errors.append('context must be non-empty list ' + e['id'])
        else:
            for i, x in enumerate(e['context']):
                if not isinstance(x, dict) or set(x) != {'conditions', 'text'} or not isinstance(x['text'], str) or not x['text'].strip() or len(x['text']) > 400:
                    errors.append(f'bad context {e["id"]}[{i}]'); continue
                check_conditions(x['conditions'], f'{e["id"]}.context[{i}]')
    for c in e['choices']:
        all_choices.append(c['id'])
        if not c.get('label'): errors.append('empty label ' + c['id'])
        check_effects(c.get('effects', {}), metrics, c['id']); check_effects(c.get('factionEffects', {}), factions, c['id']); check_effects(c.get('relations', {}), countries, c['id'])
        if 'delay' in c:
            check_effects(c['delay']['effects'], metrics, c['id'])
            if not isinstance(c['delay'].get('months'), int) or c['delay']['months'] < 1: errors.append('delay months ' + c['id'])
        if 'ending' in c and c['ending'] not in endings: errors.append('ending ref ' + c['id'])
        if 'special' in c and c['special'] != 'firstElection': errors.append('unknown special ' + c['id'])
        if 'phase' in c and c['phase'] not in phases: errors.append('phase ref ' + c['id'])
        for k in c.get('setFlags', {}):
            if k not in flag_keys: errors.append('unknown flag ' + c['id'])
for k in ['policies', 'projects', 'advisers']:
    for x in d[k]:
        check_effects(x.get('effects', {}), metrics, x['id']); check_effects(x.get('monthlyEffects', {}), metrics, x['id']); check_effects(x.get('factionEffects', {}), factions, x['id'])
for x in d['projects']:
    if not isinstance(x['months'], int) or x['months'] < 1: errors.append('project months ' + x['id'])
for x in d['advisers']:
    if x.get('fictional') is not True: errors.append('adviser must be fictional ' + x['id'])
for x in d['endings']:
    for key in x['conditions']:
        if key != 'explicit' and key not in metrics: errors.append('ending condition ' + x['id'])
for x in d['regions']:
    if x['slots'] != 4: errors.append('region slots ' + x['id'])
if len(all_choices) != len(set(all_choices)): errors.append('duplicate choice ID')
if abs(sum(x['weight'] for x in d['factions']) - 1) > .000001: errors.append('faction weights must sum to 1')
for f in d['factions']:
    if set(f['priorities']) - metrics: errors.append('faction priority ' + f['id'])
for m in d['metrics']:
    if not (m['min'] <= m['initial'] <= m['max']): errors.append('metric initial range ' + m['id'])
for asset in json.loads((root / 'assets/manifest.json').read_text(encoding='utf-8'))['assets']:
    if not (root / asset['path']).is_file(): errors.append('missing asset ' + asset['path'])
if errors:
    print('\n'.join(errors)); sys.exit(1)
anchors = sum(e['kind'] == 'historical_anchor' for e in d['events'])
print(f'Content OK (data {d["meta"]["version"]}): {len(d["events"])} events ({anchors} historical anchors, '
      f'{sum("context" in e for e in d["events"])} with path context), {len(all_choices)} choices, {len(d["policies"])} policies, '
      f'{len(d["projects"])} projects, {len(d["regions"])} regions, {len(d["countries"])} countries, {len(d["advisers"])} advisers, {len(d["endings"])} endings.')
