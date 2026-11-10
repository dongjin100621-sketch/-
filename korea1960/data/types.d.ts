export type Phase='prelude'|'civilian'|'transition'|'elected'|'governing';
export type MetricId='gdp'|'treasury'|'debt'|'reserves'|'inflation'|'unemployment'|'legitimacy'|'liberty'|'welfare'|'education'|'infrastructure'|'industry'|'agriculture'|'environment'|'stability'|'admin'|'equality'|'security';
export type Effects=Partial<Record<MetricId,number>>;
export type Condition={phaseIn?:Phase[];flag?:string;eq?:boolean|string;yearGte?:number;yearLte?:number;metric?:MetricId;gte?:number;lte?:number};
export interface Choice{id:string;label:string;effects:Effects;factionEffects?:Record<string,number>;relations?:Record<string,number>;influence?:number;setFlags?:Record<string,boolean|string>;phase?:Phase;delay?:{months:number;effects:Effects;text:string};special?:'firstElection';ending?:string;}
export interface EventContext{conditions:Condition[];text:string;}
export interface EventDef{id:string;title:string;body:string;choices:Choice[];kind:'historical_anchor'|'fictional_system';art:'cover'|'cabinet'|'industry'|'civic';date?:string;conditions:Condition[];cooldown:number;sourceIds:string[];context?:EventContext[];}
export interface PolicyDef{id:string;name:string;category:string;cost:number;monthlyCost:number;unlockYear:number;effects:Effects;monthlyEffects:Effects;factionEffects:Record<string,number>;description:string;requiresBill:boolean;}
export interface ProjectDef{id:string;name:string;cost:number;months:number;maintenance:number;income:number;effects:Effects;unlockYear:number;description:string;}
export type Action={type:'choose';choiceId:string}|{type:'prepare'}|{type:'policy';id:string}|{type:'project';id:string;regionId:string}|{type:'budget';budget:Record<'industry'|'agriculture'|'education'|'welfare'|'infrastructure'|'security',number>}|{type:'diplomacy';countryId:string;mode:'talk'|'technology'|'humanitarian'}|{type:'adviser';id:string}|{type:'repay';amount:number}|{type:'endMonth'}|{type:'tick'};

/* 저장 버전 2(game/engine.mjs)에서 추가된 상태 필드 */
export interface MonthReport{turn:number;date:string;finance:{income:number;base:number;interest:number;upkeep:number;expense:number;balance:number};borrowed:number;completed:{projectId:string;regionId:string}[];bills:{policyId:string;status:'passed'|'failed';probability:number}[];followups:{text:string;effects:Effects}[];election:{share:number;transfer:boolean;seats:number}|null;events:string[];ending:string|null;changes:Effects;support:Record<string,number>;relations:Record<string,number>;ledger:Partial<Record<MetricId,[string,number][]>>;}
export interface SaveStateV2Extra{report:MonthReport|null;monthActions:string[];}
/** 데이터 1.2.0 밸런스 규칙(game.json의 balance). 없으면 1.1.0 계산. */
export interface BalanceRules{note?:string;diminishing?:{note?:string;metrics:MetricId[];from:number;minFactor:number};eventGain?:{note?:string;fictional_system?:number;historical_anchor?:number};expectations?:{note?:string}&Partial<Record<MetricId,{target:number;rate:number}>>;growthBase?:number;growthNote?:string;militaryRule?:{note?:string;monthly:Effects};authoritarian?:{note?:string;monthly:Effects;gainFactor?:Effects;support?:Record<string,number>;relations?:Record<string,number>};}
/** projectEffects()의 항목. base는 체감·사건 배율로 실제 변화(delta)가 데이터 값과 다를 때만 있다. */
export interface ProjectedEffect{id:MetricId;delta:number;base?:number;before:number;after:number;}
/** 저장 형식 3: 그 달의 날짜(1~말일). tick 행동이 하루씩 넘기고 말일 다음 틱에 월 결산. */
export interface SaveStateV3Extra extends SaveStateV2Extra{day:number;}
