"""Validate IDs, references, no-cost choices, condition DSL and the canonical split files.

python3 tools/validate_content.py          # 검사만
python3 tools/validate_content.py --sync   # data/game.json(정본)에서 분리본 14개를 다시 만든 뒤 검사
"""
from pathlib import Path
import json, sys, argparse
root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(); p.add_argument('--sync', action='store_true'); a = p.parse_args()
d = json.loads((root / 'data/game.json').read_text(encoding='utf-8'))
errors = []
keys = ['metrics', 'factions', 'traits', 'regions', 'countries', 'policies', 'projects', 'edicts', 'advisers', 'events', 'endings', 'achievements', 'sources']
for k in keys:
    ids = [x['id'] for x in d[k]]
    if len(ids) != len(set(ids)): errors.append(f'duplicate {k} ID')
    split = root / f'data/{k}.json'
    if a.sync: split.write_text(json.dumps(d[k], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if json.loads(split.read_text(encoding='utf-8')) != d[k]: errors.append(f'split mismatch: {k}')
if 'balance' in d:
    split = root / 'data/balance.json'
    if a.sync: split.write_text(json.dumps(d['balance'], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if not split.is_file() or json.loads(split.read_text(encoding='utf-8')) != d['balance']: errors.append('split mismatch: balance')
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
# 1.3.0: 권역 지형·자원, 고유 사업(requires), 지역 시책(edicts)
traits = {x['id']: x for x in d['traits']}
for t in d['traits']:
    if t.get('kind') not in ('terrain', 'resource') or not t.get('name') or not isinstance(t.get('mark'), str) or not 1 <= len(t['mark']) <= 2: errors.append('trait ' + t['id'])
for x in d['regions']:
    for key, kind in (('terrain', 'terrain'), ('resources', 'resource')):
        v = x.get(key)
        if not isinstance(v, list) or not v or len(v) != len(set(v)) or any(t not in traits or traits[t]['kind'] != kind for t in v): errors.append(f'region {key} ' + x['id'])
region_tags = {x['id']: set(x['terrain']) | set(x['resources']) for x in d['regions']}
for x in d['projects']:
    if 'requires' in x:
        if not isinstance(x['requires'], list) or not x['requires'] or any(t not in traits for t in x['requires']): errors.append('project requires ' + x['id'])
        elif not any(set(x['requires']) & tags for tags in region_tags.values()): errors.append('project buildable nowhere ' + x['id'])
    if 'development' in x and (not isinstance(x['development'], int) or not 0 <= x['development'] <= 30): errors.append('project development ' + x['id'])
edict_keys = {'id', 'name', 'requires', 'maxDevelopment', 'cost', 'monthlyCost', 'unlockYear', 'monthlyEffects', 'factionEffects', 'buildDiscount', 'description'}
for x in d['edicts']:
    if set(x) - edict_keys: errors.append('edict unknown key ' + x['id'])
    if not x.get('name') or not x.get('description'): errors.append('edict text ' + x['id'])
    if not isinstance(x.get('requires'), list) or any(t not in traits for t in x['requires']): errors.append('edict requires ' + x['id'])
    elif x['requires'] and not any(set(x['requires']) & tags for tags in region_tags.values()): errors.append('edict usable nowhere ' + x['id'])
    for k in ('cost', 'monthlyCost'):
        if not num(x.get(k)) or x[k] < 0: errors.append(f'edict {k} ' + x['id'])
    if not isinstance(x.get('unlockYear'), int): errors.append('edict unlockYear ' + x['id'])
    check_effects(x.get('monthlyEffects'), metrics, x['id']); check_effects(x.get('factionEffects', {}), factions, x['id'])
    if 'buildDiscount' in x and (not num(x['buildDiscount']) or not 0 < x['buildDiscount'] <= .5): errors.append('edict buildDiscount ' + x['id'])
    if 'maxDevelopment' in x and (not num(x['maxDevelopment']) or not 0 < x['maxDevelopment'] < 100): errors.append('edict maxDevelopment ' + x['id'])
achievement_keys = {'policies', 'passedBills', 'completedProjects', 'regionsBuilt', 'uniqueProjects', 'edicts', 'turn', 'ending', 'view'} | metrics
for x in d['achievements']:
    if not isinstance(x.get('condition'), dict) or set(x['condition']) - achievement_keys: errors.append('achievement condition ' + x['id'])
if len(all_choices) != len(set(all_choices)): errors.append('duplicate choice ID')
if abs(sum(x['weight'] for x in d['factions']) - 1) > .000001: errors.append('faction weights must sum to 1')
for f in d['factions']:
    if set(f['priorities']) - metrics: errors.append('faction priority ' + f['id'])
for m in d['metrics']:
    if not (m['min'] <= m['initial'] <= m['max']): errors.append('metric initial range ' + m['id'])
# 밸런스 규칙(데이터 1.2.0). 모르는 키·범위 밖 값을 거부한다. 엔진은 이 블록이 없으면 1.1.0 계산을 쓴다.
def check_balance(b):
    bad = lambda m: errors.append('balance: ' + m)
    if not isinstance(b, dict): return bad('not object')
    index = {m['id'] for m in d['metrics'] if m['min'] == 0 and m['max'] == 100}
    def rules(obj, where, allowed):
        if not isinstance(obj, dict): bad(f'{where} not object'); return {}
        for k in obj:
            if k != 'note' and k not in allowed: bad(f'unknown key {where}.{k}')
        if 'note' in obj and not isinstance(obj['note'], str): bad(f'{where}.note')
        return {k: v for k, v in obj.items() if k != 'note'}
    def amounts(obj, where, ids, lo, hi):
        if not isinstance(obj, dict) or not obj: bad(f'{where} must be non-empty object'); return
        for k, v in obj.items():
            if k not in ids or not num(v) or not (lo <= v <= hi): bad(f'{where}.{k}={v}')
    top = rules(b, 'balance', {'diminishing', 'eventGain', 'expectations', 'growthBase', 'growthNote', 'militaryRule', 'authoritarian'})
    if 'growthNote' in top and not isinstance(top['growthNote'], str): bad('growthNote')
    if 'diminishing' in top:
        x = rules(top['diminishing'], 'diminishing', {'metrics', 'from', 'minFactor'})
        if not isinstance(x.get('metrics'), list) or not x['metrics'] or set(x['metrics']) - index: bad('diminishing.metrics must list 0~100 metrics')
        if not num(x.get('from')) or not 0 <= x['from'] < 100: bad('diminishing.from')
        if not num(x.get('minFactor')) or not 0 <= x['minFactor'] <= 1: bad('diminishing.minFactor')
    if 'eventGain' in top: amounts(rules(top['eventGain'], 'eventGain', {'fictional_system', 'historical_anchor'}), 'eventGain', {'fictional_system', 'historical_anchor'}, 0, 2)
    if 'expectations' in top:
        for k, v in rules(top['expectations'], 'expectations', index).items():
            if not isinstance(v, dict) or set(v) != {'target', 'rate'} or not num(v['target']) or not 0 <= v['target'] <= 100 or not num(v['rate']) or not 0 <= v['rate'] <= .2: bad(f'expectations.{k}')
    if 'growthBase' in top and (not num(top['growthBase']) or not -.01 <= top['growthBase'] <= .012): bad('growthBase')
    if 'militaryRule' in top: amounts(rules(top['militaryRule'], 'militaryRule', {'monthly'}).get('monthly'), 'militaryRule.monthly', metrics, -2, 2)
    if 'authoritarian' in top:
        x = rules(top['authoritarian'], 'authoritarian', {'monthly', 'gainFactor', 'support', 'relations'})
        amounts(x.get('monthly'), 'authoritarian.monthly', metrics, -2, 2)
        if 'gainFactor' in x: amounts(x['gainFactor'], 'authoritarian.gainFactor', index, 0, 1)
        if 'support' in x: amounts(x['support'], 'authoritarian.support', factions, -2, 2)
        if 'relations' in x: amounts(x['relations'], 'authoritarian.relations', countries, -2, 2)
if 'balance' in d: check_balance(d['balance'])
for asset in json.loads((root / 'assets/manifest.json').read_text(encoding='utf-8'))['assets']:
    if not (root / asset['path']).is_file(): errors.append('missing asset ' + asset['path'])
if errors:
    print('\n'.join(errors)); sys.exit(1)
anchors = sum(e['kind'] == 'historical_anchor' for e in d['events'])
print(f'Content OK (data {d["meta"]["version"]}): {len(d["events"])} events ({anchors} historical anchors, '
      f'{sum("context" in e for e in d["events"])} with path context), {len(all_choices)} choices, {len(d["policies"])} policies, '
      f'{len(d["projects"])} projects ({sum("requires" in x for x in d["projects"])} region-unique), {len(d["edicts"])} regional edicts, {len(d["regions"])} regions, {len(d["traits"])} traits, {len(d["countries"])} countries, {len(d["advisers"])} advisers, {len(d["endings"])} endings'
      f'{", balance rules " + ", ".join(k for k in d["balance"] if k not in ("note", "growthNote")) if "balance" in d else ", no balance rules (1.1.0 계산)"}.')
