/* data/game.json(데이터 2.0.0)과 저장 상태(형식 5)의 형. 엔진은 game/engine.mjs·game/economy.mjs. */
export type Phase='prelude'|'civilian'|'transition'|'elected'|'governing';
export type MetricId='gdp'|'treasury'|'debt'|'reserves'|'inflation'|'unemployment'|'legitimacy'|'liberty'|'welfare'|'education'|'infrastructure'|'industry'|'agriculture'|'environment'|'stability'|'admin'|'equality'|'security';
/** 이해집단이자 인구 계층. */
export type GroupId='workers'|'farmers'|'petite'|'business'|'landowners'|'military';
export type Effects=Partial<Record<MetricId,number>>;
export type Quantities=Record<string,number>;
export type Condition={phaseIn?:Phase[];flag?:string;eq?:boolean|string;yearGte?:number;yearLte?:number;metric?:MetricId;gte?:number;lte?:number};
export interface Choice{id:string;label:string;effects:Effects;factionEffects?:Partial<Record<GroupId,number>>;relations?:Record<string,number>;influence?:number;setFlags?:Record<string,boolean|string>;phase?:Phase;delay?:{months:number;effects:Effects;text:string};special?:'firstElection';ending?:string;}
export interface EventContext{conditions:Condition[];text:string;}
export interface EventDef{id:string;title:string;body:string;choices:Choice[];kind:'historical_anchor'|'fictional_system';art:'cover'|'cabinet'|'industry'|'civic';date?:string;conditions:Condition[];cooldown:number;sourceIds:string[];context?:EventContext[];}
/** 행정 정책: 역량 지수를 올리는 프로그램. 제도는 법률(LawDef)로 바꾼다. */
export interface PolicyDef{id:string;name:string;category:string;cost:number;monthlyCost:number;unlockYear:number;effects:Effects;monthlyEffects:Effects;factionEffects:Partial<Record<GroupId,number>>;description:string;}
/** 상품. world가 null이면 교역하지 않는다. */
export interface GoodDef{id:string;name:string;category:'staple'|'industrial'|'luxury'|'military';price:number;need:{q0:number;e:number};world:null|{price:number;export:number;import:boolean;noTariff?:boolean;schedule?:[number,number][]};mark:string;description:string;}
/** 생산방식. 수량은 한 단계·한 달 기준. 건설 부문은 points(건설점)와 materials(점마다 드는 자재)를 가진다. */
export interface ProductionMethod{id:string;name:string;jobs:Partial<Record<GroupId,number>>;in:Quantities;out:Quantities;unlock?:{year?:number;metric?:Partial<Record<MetricId,number>>};points?:number;materials?:Quantities;pollution?:number;}
export interface BuildingDef{id:string;name:string;category:'agri'|'resource'|'manufacturing'|'infrastructure'|'service'|'government'|'military';cost:number;infraUse:number;infraSupply?:number;trade?:number;owner:'business'|'land'|'petite'|'state';tech?:'industry'|'agriculture'|'infrastructure';skill?:number;development?:number;requires?:string[];maxPerRegion?:number;cap?:'arable';unlockYear:number;pollution?:number;private?:boolean;gov?:boolean;construction?:boolean;monthlyEffects?:Effects;description:string;pm:ProductionMethod[];}
export interface LawGroupDef{id:string;name:string;column:'power'|'economy'|'rights';interval:number;description:string;}
/** 법률. 분류(group)마다 하나만 유효하다. modifiers의 키는 economy.mjs의 MODIFIER_KEYS. */
export interface LawDef{id:string;group:string;name:string;unlockYear:number;initial?:boolean;cost:number;monthlyCost:number;effects:Effects;monthlyEffects:Effects;modifiers:Record<string,unknown>;stances:Partial<Record<GroupId,-2|-1|1|2>>;description:string;}
export interface DemandDef{id:string;text:string;buildings:string[];base:number;perYear:number;from:number;weight:number;}
export interface TraitEffect{name:string;modifiers?:Record<string,number>;monthly?:Effects;}
export interface InterestGroupDef{id:GroupId;name:string;mark:string;cloutWeight:number;wage:number;invest:number;description:string;demands:DemandDef[];traits:{unhappy:TraitEffect;happy:TraitEffect;loyal:TraitEffect};}
export interface TraitDef{id:string;kind:'terrain'|'resource';name:string;mark:string;description:string;}
export interface RegionDef{id:string;name:string;mapCol:number;mapRow:number;initialDevelopment:number;agriculturePotential:number;specialties:string[];disclaimer:string;terrain:string[];resources:string[];arable:number;start:Record<string,number>;}
/** 지역 시책. 권역마다 하나. constructionBonus는 그 권역의 공사를 빠르게 하는 비율. */
export interface EdictDef{id:string;name:string;requires:string[];maxDevelopment?:number;cost:number;monthlyCost:number;unlockYear:number;monthlyEffects:Effects;factionEffects?:Partial<Record<GroupId,number>>;constructionBonus?:number;description:string;}
export type Action={type:'choose';choiceId:string}|{type:'prepare'}|{type:'policy';id:string}
  |{type:'build';id:string;regionId:string}|{type:'cancelBuild';index:number}|{type:'prioritize';index:number}
  |{type:'pm';id:string;regionId:string;pm:number}|{type:'subsidy';id:string;regionId:string}|{type:'privatize';id:string;regionId:string}|{type:'downsize';id:string;regionId:string}
  |{type:'enact';id:string}|{type:'cancelEnact'}|{type:'coalition';id:GroupId}
  |{type:'edict';id:string;regionId:string}|{type:'revokeEdict';regionId:string}
  |{type:'budget';budget:Record<'industry'|'agriculture'|'education'|'welfare'|'infrastructure'|'security',number>}|{type:'diplomacy';countryId:string;mode:'talk'|'technology'|'humanitarian'}|{type:'adviser';id:string}|{type:'repay';amount:number}|{type:'endMonth'}|{type:'tick'};

/* ---- 저장 상태(형식 5)의 경제 부분 ---- */
/** 권역의 건물 하나. state는 국영 단계 수, staff는 충원율(0~1), pm은 생산방식 번호. */
export interface BuildingState{id:string;regionId:string;level:number;pm:number;staff:number;state:number;subsidy:boolean;}
export interface QueueItem{id:string;regionId:string;progress:number;private:boolean;}
export interface Enactment{lawId:string;stage:number;wait:number;setbacks:number;bonus:number;startedTurn:number;}
export interface MarketState{prices:Quantities;short:Quantities;wage:number;workforce:number;pool:number;dividends:Record<GroupId,number>;sol:Record<GroupId,number>;sol0:Record<GroupId,number>;needBase:Quantities;gdpUnit:number;cpi:number;hist:Record<string,number[]>;trade:{exports:number;imports:number};}
export interface Counters{built:number;privateBuilt:number;resourceBuilt:number;lawsEnacted:number;lawsFailed:number;regions:string[];}
export interface MonthReport{turn:number;date:string;finance:{income:number;base:number;interest:number;upkeep:number;expense:number;balance:number};borrowed:number;completed:{buildingId:string;regionId:string;private:boolean}[];started:{buildingId:string;regionId:string}|null;laws:{lawId:string;result:'advance'|'enacted'|'debate'|'stall'|'failed';chance:number}[];followups:{text:string;effects:Effects}[];election:{share:number;transfer:boolean;seats:number}|null;events:string[];ending:string|null;market:{gdp:number;unemployment:number;cpi:number;exports:number;imports:number;points:number;used:number;pool:number};changes:Effects;support:Partial<Record<GroupId,number>>;relations:Record<string,number>;ledger:Partial<Record<MetricId,[string,number][]>>;}
/** 저장 형식 5의 상태에서 2.x와 달라진 필드. support는 이해집단 지지도(0~100). */
export interface SaveStateV5Extra{day:number;support:Record<GroupId,number>;ig:Record<GroupId,{mod:number;clout:number;vote:number}>;government:GroupId[];laws:Record<string,string>;enactment:Enactment|null;buildings:BuildingState[];construction:QueueItem[];econ:MarketState;counters:Counters;edicts:{edictId:string;regionId:string;startedTurn:number}[];report:MonthReport|null;monthActions:string[];}
/** 밸런스 규칙(game.json의 balance). */
export interface BalanceRules{note?:string;diminishing?:{note?:string;metrics:MetricId[];from:number;minFactor:number};eventGain?:{note?:string;fictional_system?:number;historical_anchor?:number};expectations?:{note?:string}&Partial<Record<MetricId,{target:number;rate:number}>>;militaryRule?:{note?:string;monthly:Effects};authoritarian?:{note?:string;monthly:Effects;gainFactor?:Effects;support?:Partial<Record<GroupId,number>>;relations?:Record<string,number>};}
/** projectEffects()의 항목. base는 체감·사건 배율로 실제 변화(delta)가 데이터 값과 다를 때만 있다. */
export interface ProjectedEffect{id:MetricId;delta:number;base?:number;before:number;after:number;}
