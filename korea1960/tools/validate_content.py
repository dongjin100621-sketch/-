"""Validate IDs, references, no-cost choices and the canonical split files."""
from pathlib import Path
import json,sys,argparse
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--sync',action='store_true');a=p.parse_args()
d=json.loads((root/'data/game.json').read_text(encoding='utf-8'))
errors=[]
keys=['metrics','factions','regions','countries','policies','projects','advisers','events','endings','achievements','sources']
for k in keys:
 ids=[x['id'] for x in d[k]]
 if len(ids)!=len(set(ids)):errors.append(f'duplicate {k} ID')
 split=root/f'data/{k}.json'
 if a.sync:split.write_text(json.dumps(d[k],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 if json.loads(split.read_text(encoding='utf-8'))!=d[k]:errors.append(f'split mismatch: {k}')
metrics={x['id'] for x in d['metrics']};sources={x['id'] for x in d['sources']};factions={x['id'] for x in d['factions']};countries={x['id'] for x in d['countries']};endings={x['id'] for x in d['endings']};all_choices=[]
def check_effects(effects,allowed,where):
 for k,v in effects.items():
  if k not in allowed or not isinstance(v,(float,int)) or isinstance(v,bool):errors.append(f'invalid effect {where}: {k}')
for e in d['events']:
 if len(e['choices'])!=3:errors.append('choice count '+e['id'])
 if not any(c.get('effects',{}).get('treasury',0)>=0 for c in e['choices']):errors.append('no free choice '+e['id'])
 if e['kind']=='historical_anchor' and not e['sourceIds']:errors.append('history source missing '+e['id'])
 if any(s not in sources for s in e['sourceIds']):errors.append('source ref '+e['id'])
 if e['art'] not in ['cover','cabinet','industry','civic']:errors.append('art ref '+e['id'])
 for c in e['choices']:
  all_choices.append(c['id']);check_effects(c.get('effects',{}),metrics,c['id']);check_effects(c.get('factionEffects',{}),factions,c['id']);check_effects(c.get('relations',{}),countries,c['id'])
  if 'delay'in c:check_effects(c['delay']['effects'],metrics,c['id'])
  if 'ending'in c and c['ending']not in endings:errors.append('ending ref '+c['id'])
for k in ['policies','projects','advisers']:
 for x in d[k]:
  check_effects(x.get('effects',{}),metrics,x['id']);check_effects(x.get('monthlyEffects',{}),metrics,x['id']);check_effects(x.get('factionEffects',{}),factions,x['id'])
if len(all_choices)!=len(set(all_choices)):errors.append('duplicate choice ID')
if abs(sum(x['weight'] for x in d['factions'])-1)>.000001:errors.append('faction weights must sum to 1')
for asset in json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))['assets']:
 if not (root/asset['path']).is_file():errors.append('missing asset '+asset['path'])
if errors:
 print('\n'.join(errors));sys.exit(1)
print(f'Content OK: {len(d["events"])} events, {len(all_choices)} choices, {len(d["policies"])} policies, {len(d["projects"])} projects, {len(d["endings"])} endings.')
