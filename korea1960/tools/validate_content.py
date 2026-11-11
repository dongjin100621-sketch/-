"""Validate IDs, references, no-cost choices, condition DSL and the canonical split files.

python3 tools/validate_content.py          # 검사만
python3 tools/validate_content.py --sync   # data/game.json(정본)에서 분리본 18개를 다시 만든 뒤 검사
"""
from pathlib import Path
import json, sys, argparse
root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(); p.add_argument('--sync', action='store_true'); a = p.parse_args()
d = json.loads((root / 'data/game.json').read_text(encoding='utf-8'))
errors = []
keys = ['metrics', 'goods', 'buildings', 'lawGroups', 'laws', 'interestGroups', 'traits', 'regions', 'countries', 'policies', 'edicts', 'advisers', 'events', 'endings', 'achievements', 'sources']
for stale in ('factions', 'projects'):  # 2.0.0에서 없어진 분리본
    if a.sync and (root / f'data/{stale}.json').is_file(): (root / f'data/{stale}.json').unlink()
for k in keys:
    ids = [x['id'] for x in d[k]]
    if len(ids) != len(set(ids)): errors.append(f'duplicate {k} ID')
    split = root / f'data/{k}.json'
    if a.sync: split.write_text(json.dumps(d[k], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if json.loads(split.read_text(encoding='utf-8')) != d[k]: errors.append(f'split mismatch: {k}')
for k in ('balance', 'economy'):
    split = root / f'data/{k}.json'
    if a.sync: split.write_text(json.dumps(d[k], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if not split.is_file() or json.loads(split.read_text(encoding='utf-8')) != d[k]: errors.append(f'split mismatch: {k}')
metrics = {x['id'] for x in d['metrics']}; sources = {x['id'] for x in d['sources']}; factions = {x['id'] for x in d['interestGroups']}
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
for k in ['policies', 'advisers']:
    for x in d[k]:
        check_effects(x.get('effects', {}), metrics, x['id']); check_effects(x.get('monthlyEffects', {}), metrics, x['id']); check_effects(x.get('factionEffects', {}), factions, x['id'])
for x in d['advisers']:
    if x.get('fictional') is not True: errors.append('adviser must be fictional ' + x['id'])
for x in d['endings']:
    for key in x['conditions']:
        if key != 'explicit' and key not in metrics: errors.append('ending condition ' + x['id'])
# 1.3.0: 권역 지형·자원, 고유 사업(requires), 지역 시책(edicts)
traits = {x['id']: x for x in d['traits']}
for t in d['traits']:
    if t.get('kind') not in ('terrain', 'resource') or not t.get('name') or not isinstance(t.get('mark'), str) or not 1 <= len(t['mark']) <= 2: errors.append('trait ' + t['id'])
for x in d['regions']:
    for key, kind in (('terrain', 'terrain'), ('resources', 'resource')):
        v = x.get(key)
        if not isinstance(v, list) or not v or len(v) != len(set(v)) or any(t not in traits or traits[t]['kind'] != kind for t in v): errors.append(f'region {key} ' + x['id'])
region_tags = {x['id']: set(x['terrain']) | set(x['resources']) for x in d['regions']}
edict_keys = {'id', 'name', 'requires', 'maxDevelopment', 'cost', 'monthlyCost', 'unlockYear', 'monthlyEffects', 'factionEffects', 'constructionBonus', 'description'}
for x in d['edicts']:
    if set(x) - edict_keys: errors.append('edict unknown key ' + x['id'])
    if not x.get('name') or not x.get('description'): errors.append('edict text ' + x['id'])
    if not isinstance(x.get('requires'), list) or any(t not in traits for t in x['requires']): errors.append('edict requires ' + x['id'])
    elif x['requires'] and not any(set(x['requires']) & tags for tags in region_tags.values()): errors.append('edict usable nowhere ' + x['id'])
    for k in ('cost', 'monthlyCost'):
        if not num(x.get(k)) or x[k] < 0: errors.append(f'edict {k} ' + x['id'])
    if not isinstance(x.get('unlockYear'), int): errors.append('edict unlockYear ' + x['id'])
    check_effects(x.get('monthlyEffects'), metrics, x['id']); check_effects(x.get('factionEffects', {}), factions, x['id'])
    if 'constructionBonus' in x and (not num(x['constructionBonus']) or not 0 < x['constructionBonus'] <= .5): errors.append('edict constructionBonus ' + x['id'])
    if 'maxDevelopment' in x and (not num(x['maxDevelopment']) or not 0 < x['maxDevelopment'] < 100): errors.append('edict maxDevelopment ' + x['id'])
achievement_keys = {'policies', 'lawsEnacted', 'built', 'regionsBuilt', 'resourceBuilt', 'edicts', 'tradeSurplus', 'happyGroups', 'noShortage', 'turn', 'ending', 'view'} | metrics
for x in d['achievements']:
    if not isinstance(x.get('condition'), dict) or set(x['condition']) - achievement_keys: errors.append('achievement condition ' + x['id'])
if len(all_choices) != len(set(all_choices)): errors.append('duplicate choice ID')
# 2.0.0: 상품·건물·생산방식·법률·이해집단·경제 상수
goods = {x['id']: x for x in d['goods']}; buildings = {x['id']: x for x in d['buildings']}; groups = {x['id'] for x in d['lawGroups']}
strata = ['workers', 'farmers', 'petite', 'business', 'landowners', 'military']
if [x['id'] for x in d['interestGroups']] != strata: errors.append('interestGroups must be the six strata in order')
for g in d['goods']:
    if g.get('category') not in ('staple', 'industrial', 'luxury', 'military') or not num(g.get('price')) or g['price'] <= 0 or not g.get('name') or not g.get('description') or not 1 <= len(g.get('mark', '')) <= 2: errors.append('good ' + g['id'])
    n = g.get('need', {})
    if not num(n.get('q0')) or n['q0'] < 0 or not num(n.get('e')) or n['e'] < 0 or (n['q0'] > 0 and n['e'] <= 0): errors.append('good need ' + g['id'])
    w = g.get('world')
    if w is not None and (not num(w.get('price')) or w['price'] <= 0 or not num(w.get('export')) or w['export'] < 0 or not isinstance(w.get('import'), bool) or any(not (isinstance(x, list) and len(x) == 2 and isinstance(x[0], int) and num(x[1]) and x[1] > 0) for x in w.get('schedule', []))): errors.append('good world ' + g['id'])
def check_qty(o, where):
    if not isinstance(o, dict) or any(k not in goods or not num(v) or v <= 0 for k, v in o.items()): errors.append('goods ' + where)
building_keys = {'id', 'name', 'category', 'cost', 'infraUse', 'infraSupply', 'trade', 'owner', 'tech', 'skill', 'development', 'requires', 'maxPerRegion', 'cap', 'unlockYear', 'pollution', 'private', 'gov', 'construction', 'monthlyEffects', 'description', 'pm'}
for b in d['buildings']:
    w = b['id']
    if set(b) - building_keys: errors.append(f'building unknown key {w}: {set(b) - building_keys}')
    if b.get('category') not in ('agri', 'resource', 'manufacturing', 'infrastructure', 'service', 'government', 'military') or b.get('owner') not in ('business', 'land', 'petite', 'state'): errors.append('building category/owner ' + w)
    if not num(b.get('cost')) or b['cost'] <= 0 or not num(b.get('infraUse')) or b['infraUse'] < 0 or not isinstance(b.get('unlockYear'), int) or not b.get('name') or not b.get('description'): errors.append('building numbers ' + w)
    if 'tech' in b and b['tech'] not in d['economy']['techBase']: errors.append('building tech ' + w)
    if 'requires' in b and (not b['requires'] or any(t not in traits for t in b['requires']) or not any(set(b['requires']) & tags for tags in region_tags.values())): errors.append('building requires ' + w)
    if b.get('owner') == 'state' and b.get('private') is not False: errors.append('state building must be private:false ' + w)
    if b.get('gov') and (b.get('private') is not False): errors.append('gov building must be state ' + w)
    if 'monthlyEffects' in b: check_effects(b['monthlyEffects'], metrics, w)
    if not isinstance(b.get('pm'), list) or not b['pm']: errors.append('building pm ' + w); continue
    if 'unlock' in b['pm'][0]: errors.append('first production method must be open ' + w)
    for x in b['pm']:
        if not x.get('id') or not x.get('name') or not isinstance(x.get('jobs'), dict) or not x['jobs'] or any(k not in strata or not num(v) or v <= 0 for k, v in x['jobs'].items()): errors.append(f'pm jobs {w}.{x.get("id")}')
        check_qty(x.get('in'), f'{w}.{x.get("id")}.in'); check_qty(x.get('out'), f'{w}.{x.get("id")}.out')
        u = x.get('unlock', {})
        if set(u) - {'year', 'metric'} or any(k not in metrics or not num(v) for k, v in u.get('metric', {}).items()): errors.append(f'pm unlock {w}.{x.get("id")}')
        if b.get('construction') and (not num(x.get('points')) or x['points'] <= 0 or not x.get('materials')): errors.append(f'construction pm {w}.{x.get("id")}')
        if b.get('construction'): check_qty(x.get('materials'), f'{w}.{x.get("id")}.materials')
    if b.get('gov') and any(x['out'] for x in b['pm']): errors.append('gov building has market output ' + w)
if sum(1 for b in d['buildings'] if b.get('construction')) != 1 or 'construction' not in buildings: errors.append('exactly one construction sector with id "construction"')
for g in goods:
    if not any(g in x['out'] for b in d['buildings'] for x in b['pm']) and not (goods[g]['world'] or {}).get('import'): errors.append('good can be neither produced nor imported: ' + g)
for r in d['regions']:
    if not isinstance(r.get('arable'), int) or r['arable'] < 1 or not isinstance(r.get('start'), dict): errors.append('region arable/start ' + r['id']); continue
    for bid, lv in r['start'].items():
        b = buildings.get(bid)
        if not b or not isinstance(lv, int) or lv < 1 or ('requires' in b and not set(b['requires']) & region_tags[r['id']]) or (b.get('cap') == 'arable' and lv > r['arable']) or lv > b.get('maxPerRegion', 99) or b['unlockYear'] > 1960: errors.append(f'region start {r["id"]}.{bid}')
modifier_keys = {'farmThroughput', 'mfgThroughput', 'constructionEff', 'taxEff', 'edictCap', 'subsistenceCap', 'investBonus', 'tradeCapBonus', 'pollution', 'armsDemand', 'militaryWage', 'privateShare', 'investEff', 'stateDividend', 'subsidy', 'tariff', 'exportSubsidy', 'tradeCap', 'tax', 'farmShare', 'relief', 'workerDividend', 'wageMult', 'cloutMult'}
for g in d['lawGroups']:
    if g.get('column') not in ('power', 'economy', 'rights') or not isinstance(g.get('interval'), int) or g['interval'] < 1 or not g.get('name'): errors.append('law group ' + g['id'])
    if sum(1 for l in d['laws'] if l['group'] == g['id'] and l.get('initial')) != 1: errors.append('law group needs exactly one initial law: ' + g['id'])
    if sum(1 for l in d['laws'] if l['group'] == g['id']) < 2: errors.append('law group needs a choice: ' + g['id'])
for l in d['laws']:
    w = l['id']
    if l.get('group') not in groups or not l.get('name') or not l.get('description') or not isinstance(l.get('unlockYear'), int): errors.append('law ' + w)
    for k in ('cost', 'monthlyCost'):
        if not num(l.get(k)) or l[k] < 0: errors.append(f'law {k} ' + w)
    check_effects(l.get('effects'), metrics, w); check_effects(l.get('monthlyEffects'), metrics, w)
    if set(l.get('modifiers', {})) - modifier_keys: errors.append(f'law modifier {w}: {set(l["modifiers"]) - modifier_keys}')
    if any(k not in strata or v not in (-2, -1, 1, 2) for k, v in l.get('stances', {}).items()): errors.append('law stances ' + w)
    t = l.get('modifiers', {}).get('tax')
    if t is not None and (set(t) != {'consumption', 'wage', 'profit', 'land'} or any(not num(v) or not 0 <= v < .6 for v in t.values())): errors.append('law tax ' + w)
    fs = l.get('modifiers', {}).get('farmShare')
    if fs is not None and (set(fs) - set(strata) or abs(sum(fs.values()) - 1) > 1e-9): errors.append('law farmShare must sum to 1 ' + w)
for name in ('taxation', 'land', 'economic_system', 'trade'):
    need = {'taxation': 'tax', 'land': 'farmShare', 'economic_system': 'privateShare', 'trade': 'tariff'}[name]
    if any(need not in l['modifiers'] for l in d['laws'] if l['group'] == name): errors.append(f'every {name} law must set {need}')
for ig in d['interestGroups']:
    w = ig['id']
    if not num(ig.get('cloutWeight')) or ig['cloutWeight'] <= 0 or not num(ig.get('wage')) or not num(ig.get('invest')) or not 0 <= ig['invest'] < 1 or not ig.get('name') or not ig.get('description'): errors.append('interest group ' + w)
    for x in ig.get('demands', []):
        if not x.get('text') or not x.get('buildings') or any(b not in buildings for b in x['buildings']) or not num(x.get('base')) or not num(x.get('perYear')) or not num(x.get('weight')) or x['weight'] <= 0: errors.append(f'demand {w}.{x.get("id")}')
    if set(ig.get('traits', {})) != {'unhappy', 'happy', 'loyal'}: errors.append('traits ' + w); continue
    for key, t in ig['traits'].items():
        if not t.get('name') or set(t.get('modifiers', {})) - modifier_keys: errors.append(f'trait {w}.{key}')
        check_effects(t.get('monthly', {}), metrics, f'{w}.{key}')
if not any(len([ig for ig in d['interestGroups'] if any(b in x['buildings'] for x in ig['demands'])]) > 1 for b in buildings): errors.append('no building is shared between interest group demands')
E = d['economy']
if set(E['government']['start']) - set(strata) or not E['government']['start'] or len(E['government']['start']) > E['government']['max']: errors.append('economy.government.start')
if not (E['price']['floor'] < 0 < E['price']['ceiling']) or not 0 < E['price']['speed'] <= 1: errors.append('economy.price')
if set(E['saving']) != set(strata) or set(E['subsistence']) - set(goods) or set(E['depreciation']) - metrics: errors.append('economy keys')
for key, lst in E['budgetDemand'].items():
    if key not in ('industry', 'agriculture', 'education', 'welfare', 'infrastructure', 'security') or set(lst) - set(goods): errors.append('economy.budgetDemand ' + key)
check_effects(E['enactment']['decreeCost'], metrics, 'economy.enactment.decreeCost')
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
    top = rules(b, 'balance', {'diminishing', 'eventGain', 'expectations', 'militaryRule', 'authoritarian'})
    if 'diminishing' in top:
        x = rules(top['diminishing'], 'diminishing', {'metrics', 'from', 'minFactor'})
        if not isinstance(x.get('metrics'), list) or not x['metrics'] or set(x['metrics']) - index: bad('diminishing.metrics must list 0~100 metrics')
        if not num(x.get('from')) or not 0 <= x['from'] < 100: bad('diminishing.from')
        if not num(x.get('minFactor')) or not 0 <= x['minFactor'] <= 1: bad('diminishing.minFactor')
    if 'eventGain' in top: amounts(rules(top['eventGain'], 'eventGain', {'fictional_system', 'historical_anchor'}), 'eventGain', {'fictional_system', 'historical_anchor'}, 0, 2)
    if 'expectations' in top:
        for k, v in rules(top['expectations'], 'expectations', index).items():
            if not isinstance(v, dict) or set(v) != {'target', 'rate'} or not num(v['target']) or not 0 <= v['target'] <= 100 or not num(v['rate']) or not 0 <= v['rate'] <= .2: bad(f'expectations.{k}')
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
      f'{len(d["goods"])} goods, {len(d["buildings"])} buildings ({sum(len(x["pm"]) for x in d["buildings"])} production methods, {sum("requires" in x for x in d["buildings"])} tied to terrain or resources), {len(d["laws"])} laws in {len(d["lawGroups"])} groups, {len(d["interestGroups"])} interest groups, '
      f'{len(d["edicts"])} regional edicts, {len(d["regions"])} regions, {len(d["traits"])} traits, {len(d["countries"])} countries, {len(d["advisers"])} advisers, {len(d["endings"])} endings'
      f', balance rules {", ".join(k for k in d["balance"] if k != "note")}.')
