import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createState,dispatch,exportSave,importSave} from '../example/engine.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const d=JSON.parse(fs.readFileSync(path.join(root,'data/game.json'),'utf8'));
let s=createState(d,20261110);
function action(a){const r=dispatch(s,d,a);if(!r.ok)throw Error(r.error);s=r.state;}
function solve(){while(s.queue.length&&!s.ending){const e=d.events.find(e=>e.id===s.queue[0]);const c=e.choices.find(c=>!c.ending&&(c.effects.treasury||0)>=0&&!c.setFlags?.authoritarian&&c.phase!=='transition')||e.choices[0];action({type:'choose',choiceId:c.id});}}
function until(turn){while(s.turn<turn&&!s.ending){solve();if(s.ending)break;while(['prelude','civilian','elected'].includes(s.phase)&&s.ap>0)action({type:'prepare'});action({type:'endMonth'});}if(s.ending)throw Error('Sample seed ended before target');}
function write(name){const p=path.join(root,'example/saves',name);fs.mkdirSync(path.dirname(p),{recursive:true});const raw=exportSave(s);importSave(raw,d);fs.writeFileSync(p,raw+'\n');console.log(name,s.turn,s.phase);}
until(48);solve();action({type:'policy',id:'press_freedom'});action({type:'project',id:'rural_clinic',regionId:'jeonnam'});action({type:'adviser',id:'min'});write('1964_governing.json');
until(156);write('1973_policy_choices.json');
