/* Original, dependency-free reference simulation. All numbers are fictional. */
export const SAVE_VERSION = 1;
export const BUDGET_KEYS = ['industry','agriculture','education','welfare','infrastructure','security'];
const clone = x => JSON.parse(JSON.stringify(x));
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const finite = v => typeof v === 'number' && Number.isFinite(v);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export function calendar(turn) { return {year:1960+Math.floor(turn/12),month:turn%12+1}; }
export function dateLabel(turn) {const d=calendar(turn);return `${d.year}-${String(d.month).padStart(2,'0')}`;}
export function random(s) {let x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function normalize(s,d){for(const m of d.metrics)s.stats[m.id]=clamp(s.stats[m.id],m.min,m.max);for(const f of d.factions)s.support[f.id]=clamp(s.support[f.id],0,100);for(const n of d.countries)s.relations[n.id]=clamp(s.relations[n.id],0,100);s.influence=clamp(s.influence,0,999);s.seats=clamp(s.seats,.05,.95);}
function log(s,type,text,extra={}) {s.log.push({turn:s.turn,date:dateLabel(Math.min(s.turn,239)),type,text,...extra});}
function apply(s,effects={}) {for(const [k,v] of Object.entries(effects)){if(!Object.hasOwn(s.stats,k)||!finite(v))throw new Error(`미등록 효과: ${k}`);s.stats[k]+=v;}}
function faction(s,e={}){for(const [k,v] of Object.entries(e))s.support[k]=clamp(s.support[k]+v,0,100);}
function setEnding(s,d,id){if(s.ending)return;const e=d.endings.find(x=>x.id===id);if(!e)throw new Error('엔딩 ID 오류');s.ending={id:e.id,title:e.title,text:e.text,turn:s.turn};s.queue=[];log(s,'ending',e.title);}
export function matches(s,conditions=[]){return conditions.every(c=>{
 if(c.phaseIn&&!c.phaseIn.includes(s.phase))return false;
 if(c.flag&&s.flags[c.flag]!==c.eq)return false;
 if(c.yearGte&&calendar(s.turn).year<c.yearGte)return false;
 if(c.yearLte&&calendar(s.turn).year>c.yearLte)return false;
 if(c.metric){const v=s.stats[c.metric];if(c.gte!==undefined&&v<c.gte)return false;if(c.lte!==undefined&&v>c.lte)return false;}
 return true;
});}
function queueMonth(s,d){
 const fixed=d.events.filter(e=>e.date===dateLabel(s.turn)&&matches(s,e.conditions));
 let events=fixed;
 if(!events.length){
   let pool=d.events.filter(e=>!e.date&&matches(s,e.conditions)&&(s.lastEvents[e.id]===undefined||s.turn-s.lastEvents[e.id]>=e.cooldown));
   if(!pool.length)pool=d.events.filter(e=>!e.date&&matches(s,e.conditions));
   events=pool.length?[pool[Math.floor(random(s)*pool.length)]]:[];
 }
 s.queue=events.map(e=>e.id);
 for(const e of events)s.lastEvents[e.id]=s.turn;
}
export function createState(d,seed=196001){
 const s={version:SAVE_VERSION,gameId:d.meta.id,dataVersion:d.meta.version,turn:0,rng:(Number(seed)>>>0)||196001,phase:'prelude',ap:3,influence:20,seats:.48,stats:Object.fromEntries(d.metrics.map(m=>[m.id,m.initial])),support:Object.fromEntries(d.factions.map(f=>[f.id,f.initialSupport])),relations:Object.fromEntries(d.countries.map(n=>[n.id,n.initialRelation])),budget:{industry:22,agriculture:18,education:16,welfare:16,infrastructure:16,security:12},policies:[],bills:[],projects:[],advisers:[],flags:{},queue:[],lastEvents:{},delayed:[],history:[],log:[],ending:null,lastFinance:null,visited:[]};
 log(s,'start','1960년 1월. 국정 지표를 관찰하며 공적 역할의 원칙을 준비한다.');queueMonth(s,d);snapshot(s);return s;
}
function snapshot(s){s.history.push({turn:s.turn,gdp:s.stats.gdp,inflation:s.stats.inflation,liberty:s.stats.liberty,legitimacy:s.stats.legitimacy,welfare:s.stats.welfare,environment:s.stats.environment});}
export function supportAverage(s,d){return d.factions.reduce((v,f)=>v+s.support[f.id]*f.weight,0);}
function baseReason(s,{ap=true,government=true,parliament=false}={}){if(s.ending)return '캠페인이 종료되었습니다.';if(s.queue.length)return '이번 달 사건을 먼저 결정하세요.';if(ap&&s.ap<1)return '행동점수가 부족합니다.';if(government&&!['transition','governing'].includes(s.phase))return '현재 단계에는 국정 집행 권한이 없습니다.';if(parliament&&s.phase!=='governing')return '민정 취임 이후 정규 의회에서 발의할 수 있습니다.';return '';}
function fundsReason(s,cost){return s.stats.treasury<cost?'국고가 부족합니다.':'';}
export function governmentReason(s,cost=0,ap=true){return baseReason(s,{ap})||fundsReason(s,cost);}
export function policyReason(s,d,id){
 const p=d.policies.find(x=>x.id===id);if(!p)return '알 수 없는 정책입니다.';
 return baseReason(s,{parliament:p.requiresBill})||(calendar(s.turn).year<p.unlockYear?`${p.unlockYear}년부터 검토할 수 있습니다.`:'')||(s.policies.includes(id)?'이미 시행 중입니다.':'')||(s.bills.some(b=>b.policyId===id&&!['passed','failed'].includes(b.status))?'이미 심의 중입니다.':'')||fundsReason(s,p.cost);
}
export function projectReason(s,d,id,regionId){
 const p=d.projects.find(x=>x.id===id),r=d.regions.find(x=>x.id===regionId);if(!p||!r)return '알 수 없는 사업 또는 권역입니다.';
 return baseReason(s)||(calendar(s.turn).year<p.unlockYear?`${p.unlockYear}년부터 착수할 수 있습니다.`:'')||(s.projects.filter(x=>x.regionId===regionId).length>=r.slots?'이 권역의 사업 슬롯이 모두 찼습니다.':'')||(s.projects.some(x=>x.regionId===regionId&&x.projectId===id)?'이 권역에 같은 사업이 있습니다.':'')||fundsReason(s,p.cost);
}
export function choiceReason(s,d,choiceId){const e=d.events.find(x=>x.id===s.queue[0]),c=e?.choices.find(x=>x.id===choiceId);if(s.ending)return '캠페인이 종료되었습니다.';if(!c)return '현재 사건의 선택지가 아닙니다.';const cost=Math.max(0,-(c.effects?.treasury||0));return fundsReason(s,cost);}
function activate(s,p){s.policies.push(p.id);apply(s,p.effects);faction(s,p.factionEffects);}
function firstElection(s,d){
 const probability=clamp(35+s.influence*.18+(s.stats.legitimacy-45)*.25+(supportAverage(s,d)-45)*.15,25,90);
 const roll=random(s)*100;
 log(s,'election',`1963년 가상 선거: 당선 확률 ${probability.toFixed(1)}%, ${roll<probability?'당선':'낙선'}.`,{probability,roll});
 if(roll<probability){s.flags.won1963=true;s.phase='elected';s.seats=clamp(.42+supportAverage(s,d)*.003,.35,.8);}
 else setEnding(s,d,'peaceful_transfer');
}
function genericEndingCondition(s,conditions){return Object.entries(conditions).every(([key,rule])=>{
 if(key==='explicit')return false;
 const v=s.stats[key];return Object.entries(rule).every(([op,n])=>op==='gte'?v>=n:op==='lte'?v<=n:op==='lt'?v<n:false);
});}
export function evaluateEnding(s,d,final=false){
 if(s.ending)return s.ending;
 const all=[...d.endings].sort((a,b)=>b.priority-a.priority);
 const options=final?all:all.filter(e=>['fiscal_crisis','legitimacy_crisis','rights_crisis'].includes(e.id));
 const found=options.find(e=>genericEndingCondition(s,e.conditions));
 if(found)setEnding(s,d,found.id);return s.ending;
}
export function finance(s,d){
 const active=s.policies.map(id=>d.policies.find(p=>p.id===id));
 const completed=s.projects.filter(x=>x.status==='complete').map(x=>d.projects.find(p=>p.id===x.projectId));
 const income=11+s.stats.gdp*.035+completed.reduce((a,p)=>a+p.income,0);
 const base=10+s.stats.gdp*.014;
 const interest=s.stats.debt*.003;
 const upkeep=active.reduce((a,p)=>a+p.monthlyCost,0)+completed.reduce((a,p)=>a+p.maintenance,0)+s.advisers.length*.15;
 return {income,base,interest,upkeep,expense:base+interest+upkeep,balance:income-base-interest-upkeep};
}
function month(s,d){
 const f=finance(s,d);s.stats.treasury+=f.balance;s.lastFinance={...f,turn:s.turn};
 if(s.stats.treasury<0){const borrowing=-s.stats.treasury;s.stats.debt+=borrowing;s.stats.treasury=0;log(s,'finance',`부족분 ${borrowing.toFixed(1)} 재정점을 부채로 조달했다.`);}
 const k=s.stats,b=s.budget,executive=['transition','governing'].includes(s.phase);
 // Early budget is an observed national baseline, not player-controlled spending.
 const rate=clamp(.0025+k.industry*.00003+k.education*.000012+k.infrastructure*.000018-Math.max(0,k.inflation-12)*.00015-k.unemployment*.00004,-.01,.012);
 k.gdp*=1+rate;
 for(const key of BUDGET_KEYS)k[key]+=(b[key]-12)*.006;
 k.inflation+=(8-k.inflation)*.012+Math.max(0,k.debt-220)*.0001;
 k.unemployment+=(12-k.unemployment)*.012-k.industry*.0003;
 k.environment-=k.industry*.00035;
 k.stability+=(k.legitimacy-k.stability)*.008+(k.welfare-45)*.0008;
 k.legitimacy+=((k.liberty-50)*.0008+(k.welfare-45)*.0005);
 k.equality+=(k.welfare-k.equality)*.002;
 if(s.flags.authoritarian){k.liberty-=.3;k.legitimacy-=.10;}
 if(executive){
   for(const id of s.policies)apply(s,d.policies.find(x=>x.id===id).monthlyEffects);
   for(const id of s.advisers)apply(s,d.advisers.find(x=>x.id===id).monthlyEffects);
 }
 for(const p of s.projects){if(p.status==='complete')continue;p.remaining--;if(p.remaining<=0){p.remaining=0;p.status='complete';p.completedTurn=s.turn;const def=d.projects.find(x=>x.id===p.projectId);apply(s,def.effects);log(s,'construction',`${d.regions.find(x=>x.id===p.regionId).name} · ${def.name} 준공.`);}}
 for(const bill of s.bills){
   if(['passed','failed'].includes(bill.status))continue;bill.remaining--;
   const progress=bill.total-bill.remaining;
   bill.status=progress<=1?'introduced':progress<=3?'committee':bill.remaining>0?'legal_review':'plenary';
   if(bill.remaining<=0){
    bill.remaining=0;const p=d.policies.find(x=>x.id===bill.policyId);
    const chance=clamp(.15+s.seats*.75+(k.legitimacy-50)*.002+(k.stability-50)*.001,.15,.95);
    bill.probability=chance;bill.roll=random(s);bill.status=bill.roll<chance?'passed':'failed';
    if(bill.status==='passed'&&!s.policies.includes(p.id))activate(s,p);
    log(s,'bill',`${p.name}: ${bill.status==='passed'?'가결':'부결'} (가상 통과 확률 ${(chance*100).toFixed(1)}%).`);
   }
 }
 for(const x of s.delayed.filter(x=>x.due<=s.turn+1)){apply(s,x.effects);log(s,'followup',x.text);}
 s.delayed=s.delayed.filter(x=>x.due>s.turn+1);
 normalize(s,d);
 for(const fct of d.factions){const desired=fct.priorities.reduce((a,id)=>a+k[id],0)/fct.priorities.length;s.support[fct.id]+=(desired-s.support[fct.id])*.025;}
 normalize(s,d);snapshot(s);s.turn++;s.ap=3;
 if(s.turn>=240){evaluateEnding(s,d,true);return;}
 if(s.phase==='governing'&&!s.flags.authoritarian&&s.turn>=94&&(s.turn-94)%48===0){
  const share=clamp(supportAverage(s,d)*.65+k.legitimacy*.35+(random(s)-.5)*12,0,100);
  s.seats=clamp(share/100,.15,.85);log(s,'election',`가상 정기 선거 득표 지표 ${share.toFixed(1)}. 실제 역사 득표율이 아님.`);
  if(share<45)setEnding(s,d,'peaceful_transfer');
 }
 evaluateEnding(s,d);
 if(!s.ending)queueMonth(s,d);
}
export function dispatch(current,d,action){
 if(!object(action)||typeof action.type!=='string')return {ok:false,state:current,error:'잘못된 행동입니다.'};
 if(current.ending)return {ok:false,state:current,error:'캠페인이 종료되었습니다.'};
 const s=clone(current);let reason='';
 switch(action.type){
  case 'choose':{
   reason=choiceReason(s,d,action.choiceId);if(reason)break;
   const e=d.events.find(x=>x.id===s.queue[0]),c=e.choices.find(x=>x.id===action.choiceId);
   apply(s,c.effects);faction(s,c.factionEffects);
   for(const [id,v]of Object.entries(c.relations||{}))s.relations[id]+=v;
   Object.assign(s.flags,c.setFlags||{});if(c.phase)s.phase=c.phase;s.influence+=c.influence||0;
   if(c.delay)s.delayed.push({due:s.turn+c.delay.months,...clone(c.delay)});
   log(s,'event',`${e.title} — ${c.label}`,{eventId:e.id,choiceId:c.id,kind:e.kind,sourceIds:e.sourceIds});s.queue.shift();
   if(c.special==='firstElection')firstElection(s,d);
   if(c.ending)setEnding(s,d,c.ending);
   break;
  }
  case 'prepare':{
   reason=baseReason(s,{government:false})||(!['prelude','civilian','elected'].includes(s.phase)?'이 단계에서는 국정 행동을 선택하세요.':'');if(reason)break;
   s.ap--;s.influence+=3;log(s,'preparation','공개 자료를 검토하고 정책·연합 준비를 진전시켰다. 영향력 +3.');break;
  }
  case 'policy':{
   reason=policyReason(s,d,action.id);if(reason)break;const p=d.policies.find(x=>x.id===action.id);s.ap--;s.stats.treasury-=p.cost;
   if(p.requiresBill){const total=5+Math.floor(random(s)*3);s.bills.push({policyId:p.id,total,remaining:total,status:'introduced',startedTurn:s.turn});log(s,'bill',`${p.name} 발의. 예상 심의 ${total}개월.`);}
   else{activate(s,p);log(s,'policy',`${p.name} 시행. ${p.cost} 재정점 지출.`);}break;
  }
  case 'project':{
   reason=projectReason(s,d,action.id,action.regionId);if(reason)break;const p=d.projects.find(x=>x.id===action.id);s.ap--;s.stats.treasury-=p.cost;s.projects.push({projectId:p.id,regionId:action.regionId,remaining:p.months,status:'building',startedTurn:s.turn});log(s,'construction',`${d.regions.find(x=>x.id===action.regionId).name} · ${p.name} 착수 (${p.months}개월).`);break;
  }
  case 'budget':{
   reason=baseReason(s,{ap:false});if(reason)break;const b=action.budget;
   if(!object(b)||Object.keys(b).length!==6||BUDGET_KEYS.some(k=>!finite(b[k])||b[k]<0||b[k]>100)||Math.abs(BUDGET_KEYS.reduce((a,k)=>a+b[k],0)-100)>.001){reason='예산은 여섯 분야의 0~100 숫자이며 합계 100이어야 합니다.';break;}
   s.budget=clone(b);log(s,'budget','다음 월의 예산 배분을 수정했다.');break;
  }
  case 'diplomacy':{
   reason=baseReason(s);if(reason)break;const country=d.countries.find(x=>x.id===action.countryId);const options={talk:{cost:4,relation:4,effects:{security:1}},technology:{cost:7,relation:3,effects:{education:2,reserves:-1}},humanitarian:{cost:5,relation:5,effects:{legitimacy:1,welfare:1}}};const o=options[action.mode];
   if(!country||!o){reason='외교 상대 또는 방식이 잘못되었습니다.';break;}reason=fundsReason(s,o.cost);if(reason)break;s.ap--;s.stats.treasury-=o.cost;s.relations[country.id]+=o.relation;apply(s,o.effects);log(s,'diplomacy',`${country.name} · ${action.mode==='talk'?'정례 대화':action.mode==='technology'?'기술 교류':'인도적 협력'} (${o.cost} 재정점).`);break;
  }
  case 'adviser':{
   reason=baseReason(s);if(reason)break;const a=d.advisers.find(x=>x.id===action.id);if(!a){reason='알 수 없는 자문위원입니다.';break;}
   if(s.advisers.includes(a.id)){s.advisers=s.advisers.filter(x=>x!==a.id);s.ap--;log(s,'cabinet',`${a.name} 자문위원 해임.`);break;}
   if(s.advisers.length>=2){reason='자문위원은 동시에 두 명까지 임명할 수 있습니다.';break;}reason=fundsReason(s,a.cost);if(reason)break;s.ap--;s.stats.treasury-=a.cost;s.advisers.push(a.id);log(s,'cabinet',`${a.name} 자문위원 임명 (가상 인물).`);break;
  }
  case 'repay':{
   reason=baseReason(s);if(reason)break;const amount=action.amount;if(!finite(amount)||amount<=0||amount>s.stats.debt){reason='상환액이 부채보다 크거나 잘못되었습니다.';break;}reason=fundsReason(s,amount);if(reason)break;s.ap--;s.stats.treasury-=amount;s.stats.debt-=amount;log(s,'finance',`부채 ${amount.toFixed(1)} 재정점 상환.`);break;
  }
  case 'endMonth':reason=baseReason(s,{ap:false,government:false});if(!reason)month(s,d);break;
  default:reason='지원하지 않는 행동입니다.';
 }
 if(reason)return {ok:false,state:current,error:reason};normalize(s,d);if(!s.ending)evaluateEnding(s,d);return {ok:true,state:s};
}
export function exportSave(s){return JSON.stringify({format:'KOREA1960_SAVE',version:SAVE_VERSION,state:s},null,2);}
export function importSave(raw,d){
 if(typeof raw!=='string'||raw.length>2000000)throw new Error('저장 파일 크기 또는 형식이 잘못되었습니다.');
 let parsed;try{parsed=JSON.parse(raw);}catch{throw new Error('읽을 수 없는 JSON입니다.');}
 if(!object(parsed)||parsed.format!=='KOREA1960_SAVE'||parsed.version!==SAVE_VERSION)throw new Error('지원하지 않는 저장 형식 또는 버전입니다.');
 const s=parsed.state;const fail=()=>{throw new Error('저장 데이터의 구조·ID·값이 올바르지 않습니다.');};
 if(!object(s)||s.version!==SAVE_VERSION||s.gameId!==d.meta.id||s.dataVersion!==d.meta.version)fail();
 if(!Number.isInteger(s.turn)||s.turn<0||s.turn>240||!Number.isInteger(s.rng)||s.rng<0||s.rng>4294967295||!Number.isInteger(s.ap)||s.ap<0||s.ap>3||!finite(s.influence)||s.influence<0||s.influence>999||!finite(s.seats)||s.seats<.05||s.seats>.95)fail();
 if(!['prelude','civilian','transition','elected','governing'].includes(s.phase))fail();
 if(!object(s.stats)||Object.keys(s.stats).length!==d.metrics.length||d.metrics.some(m=>!finite(s.stats[m.id])||s.stats[m.id]<m.min||s.stats[m.id]>m.max))fail();
 if(!object(s.support)||Object.keys(s.support).length!==d.factions.length||d.factions.some(f=>!finite(s.support[f.id])||s.support[f.id]<0||s.support[f.id]>100))fail();
 if(!object(s.relations)||Object.keys(s.relations).length!==d.countries.length||d.countries.some(n=>!finite(s.relations[n.id])||s.relations[n.id]<0||s.relations[n.id]>100))fail();
 if(!object(s.budget)||Object.keys(s.budget).length!==6||BUDGET_KEYS.some(k=>!finite(s.budget[k])||s.budget[k]<0||s.budget[k]>100)||Math.abs(BUDGET_KEYS.reduce((a,k)=>a+s.budget[k],0)-100)>.001)fail();
 const validId=(key,id)=>d[key].some(x=>x.id===id),unique=arr=>new Set(arr).size===arr.length;
 for(const [key,max]of [['policies',24],['advisers',2],['queue',10],['bills',1000],['projects',40],['delayed',1000],['history',241],['log',10000],['visited',10]])if(!Array.isArray(s[key])||s[key].length>max)fail();
 if(!unique(s.policies)||s.policies.some(id=>!validId('policies',id))||!unique(s.advisers)||s.advisers.some(id=>!validId('advisers',id))||s.queue.some(id=>!validId('events',id)))fail();
 if(s.bills.some(b=>!object(b)||!validId('policies',b.policyId)||!d.policies.find(p=>p.id===b.policyId).requiresBill||!Number.isInteger(b.total)||b.total<5||b.total>7||!Number.isInteger(b.remaining)||b.remaining<0||b.remaining>b.total||!['introduced','committee','legal_review','plenary','passed','failed'].includes(b.status)||!Number.isInteger(b.startedTurn)||b.startedTurn<0||b.startedTurn>s.turn))fail();
 if(!unique(s.bills.filter(b=>!['passed','failed'].includes(b.status)).map(b=>b.policyId)))fail();
 if(s.projects.some(p=>!object(p)||!validId('projects',p.projectId)||!validId('regions',p.regionId)||!Number.isInteger(p.remaining)||p.remaining<0||p.remaining>d.projects.find(x=>x.id===p.projectId).months||!['building','complete'].includes(p.status)||!Number.isInteger(p.startedTurn)||p.startedTurn<0||p.startedTurn>s.turn||(p.status==='complete'&&p.remaining!==0)))fail();
 if(!unique(s.projects.map(p=>p.regionId+':'+p.projectId))||d.regions.some(r=>s.projects.filter(p=>p.regionId===r.id).length>r.slots))fail();
 if(!object(s.flags)||Object.entries(s.flags).some(([k,v])=>!['route','won1963','constitutionalLimit','authoritarian'].includes(k)||!['string','boolean'].includes(typeof v)))fail();
 if(!object(s.lastEvents)||Object.entries(s.lastEvents).some(([k,v])=>!validId('events',k)||!Number.isInteger(v)||v<0||v>s.turn))fail();
 const validEffects=e=>object(e)&&Object.entries(e).every(([k,v])=>d.metrics.some(m=>m.id===k)&&finite(v)&&Math.abs(v)<10000);
 if(s.delayed.some(x=>!object(x)||!Number.isInteger(x.due)||x.due<0||x.due>300||!validEffects(x.effects)||typeof x.text!=='string'||x.text.length>1000))fail();
 if(s.history.some(h=>!object(h)||!Number.isInteger(h.turn)||h.turn<0||h.turn>240||['gdp','inflation','liberty','legitimacy','welfare','environment'].some(k=>!finite(h[k]))))fail();
 if(s.log.some(l=>!object(l)||!Number.isInteger(l.turn)||l.turn<0||l.turn>240||typeof l.date!=='string'||l.date.length>20||typeof l.type!=='string'||l.type.length>40||typeof l.text!=='string'||l.text.length>2000))fail();
 if(s.visited.some(x=>typeof x!=='string'||!['overview','policy','assembly','build','budget','diplomacy','cabinet','archive'].includes(x)))fail();
 if(s.lastFinance!==null&&(!object(s.lastFinance)||['income','base','interest','upkeep','expense','balance','turn'].some(k=>!finite(s.lastFinance[k]))))fail();
 if(s.ending!==null){if(!object(s.ending)||!validId('endings',s.ending.id)||!Number.isInteger(s.ending.turn)||s.ending.turn<0||s.ending.turn>240)fail();const e=d.endings.find(x=>x.id===s.ending.id);s.ending={id:e.id,title:e.title,text:e.text,turn:s.ending.turn};}
 if(s.turn===240&&!s.ending)fail();
 return clone(s);
}
export function regionDevelopment(s,d,id){const r=d.regions.find(x=>x.id===id);return clamp(r.initialDevelopment+s.projects.filter(p=>p.regionId===id&&p.status==='complete').length*9,0,100);}
export function achievements(s,d){return d.achievements.filter(a=>Object.entries(a.condition).every(([k,v])=>k==='policies'?s.policies.length>=v:k==='passedBills'?s.bills.filter(x=>x.status==='passed').length>=v:k==='completedProjects'?s.projects.filter(x=>x.status==='complete').length>=v:k==='regionsBuilt'?new Set(s.projects.filter(x=>x.status==='complete').map(x=>x.regionId)).size>=v:k==='turn'?s.turn>=v:k==='ending'?!!s.ending:k==='view'?s.visited.includes(v):s.stats[k]>=v));}
