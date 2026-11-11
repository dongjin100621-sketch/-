# 데이터 계약과 저장 구조

> **데이터 2.0.0 · 저장 형식 5부터** `factions`·`projects`와 정책의 `requiresBill`이 없어지고 상품·건물·법률·이해집단·시장 상수가 들어왔다. 맨 아래 "데이터 2.0.0" 절이 이 문서의 이전 절(사회 집단·사업·법안·저장 형식 1~4·고유 사업)보다 우선한다. 이전 형식의 저장은 변환하지 않고 거부한다.

`data/game.json`이 정본이다. 분리 JSON 18개(목록 16개와 `balance.json`·`economy.json`)는 같은 레코드를 읽기 편하게 제공하는 사본이며 엔진이 따로 병합하지 않는다. 변경 후 `python3 tools/validate_content.py --sync`로 사본을 갱신하고 검증한다. 선택지·정책·사업·국가·권역·출처 ID는 저장 호환성을 위해 임의로 바꾸지 않는다.

## 콘텐츠 레코드

| 종류 | 주요 필드 | 규칙 |
| --- | --- | --- |
| metric | id,label,unit,initial,min,max,higherIsBetter,description | initial은 범위 안의 유한수 |
| faction | id,name,initialSupport,weight,priorities | weight 합 1, priorities는 metric ID |
| region | id,name,mapCol,mapRow,initialDevelopment,slots | 슬롯 4, 좌표는 UI 도식 |
| country | id,name,initialRelation,description | 관계 0~100 |
| policy | id,name,category,cost,monthlyCost,unlockYear,effects,monthlyEffects,factionEffects,requiresBill | true이면 법안 절차를 경유 |
| project | id,name,cost,months,maintenance,income,effects,unlockYear | 공기는 양의 정수, 준공 효과 한 번 |
| adviser | id,name,role,fictional,cost,monthlyEffects,quote | 모두 fictional=true, 동시 2명 |
| event | id,title,body,choices,kind,art,date?,conditions,cooldown,sourceIds,context? | choices 3개, 최소 1개 무료 선택. context는 v1.1.0에서 추가 |
| ending | id,title,priority,conditions,text | 우선순위 내림차순 |
| source | id,title,institution,url,scope,accessed,type | 사실 확인 범위 명시 |

## 사건 조건과 선택

조건 배열의 모든 항목을 만족해야 표시된다. 지원 조건은 `{phaseIn:[...]}`, `{flag:'won1963',eq:true}`, `{yearGte:1963}`, `{yearLte:1979}`, `{metric:'liberty',gte:60,lte:100}`이다. 날짜는 YYYY-MM 형식. 날짜가 없는 사건은 현재 단계와 재등장 대기 개월 수에 따라 추첨한다. 정해진 달에 조건이 성립하지 않는 역사 사건은 자동 강제하지 않는다.

선택 필드: `id`, `label`, `effects`(metric ID→수치), `factionEffects`(faction ID→수치), `relations`(country ID→수치), `influence`, `setFlags`, `phase`, `delay:{months,effects,text}`, `special:'firstElection'`, `ending`. 새로운 특수 동작을 데이터 문자열만으로 실행하지 않는다. 미등록 함수나 eval을 허용하지 않는다.

**context (데이터 1.1.0)**: `[{conditions:[...], text}]`. 위의 조건 DSL을 쓰며, 조건이 맞는 첫 항목을 사건 문서의 '이 캠페인에서는 · 가상' 상자에 보여 준다. 실제 역사 문장(body)과 현재 경로의 대체역사 설명을 분리하기 위한 필드다. 역사 앵커 17개 모두에 있고 마지막 항목은 보통 조건 없는 기본값이다. 효과·분기를 바꾸지 않는 표시용이다.

사건 art는 cover/cabinet/industry/civic 중 하나. kind는 historical_anchor 또는 fictional_system. 역사 앵커의 sourceIds는 반드시 유효 출처를 가리킨다. 사건 본문의 실제 역사 문장과 선택 이후의 대체역사 결과를 분리한다.

## 엔진 인터페이스

`createState(data, seed)` → 신규 상태.

`dispatch(state, data, action)` → `{ok:true,state}` 또는 `{ok:false,state:original,error}`. 원본을 변경하지 않는다.

행동: choose(choiceId), prepare, policy(id), project(id,regionId), budget(budget), diplomacy(countryId,mode), adviser(id), repay(amount), endMonth. 외교 mode는 talk/technology/humanitarian.

v2(game/engine.mjs) 추가 인터페이스: `actionReason(state,data,action)`(빈 문자열이면 실행 가능, dispatch와 같은 판정), 행동별 사유 함수(`policyReason`, `projectReason`, `choiceReason`, `prepareReason`, `diplomacyReason`, `adviserReason`, `repayReason`, `budgetReason`, `endMonthReason`), 미리보기(`choicePreview`, `projectEffects`), 확률·일정(`billChance`, `billChanceParts`, `firstElectionChance`, `nextElectionTurn`, `electionExpectation`), 재정 내역(`financeDetail`), 경로 설명(`eventContext`), 저장 변환(`migrateSave`). 모두 상태를 바꾸지 않고 난수를 소비하지 않는다.

`exportSave(state)` → JSON 문자열. `importSave(raw,data)` → 검증된 상태 또는 Error. 두 함수는 저장 버전·게임/데이터 버전·수치 범위·ID·배열 크기·일부 구조적 일관성을 검사한다. 파일은 2MB 이하. 손상된 입력을 상태에 부분 반영하지 않는다. 서명된 경쟁 게임 저장이 아니므로 치트 방지나 서버 권위 검증을 보증하지 않는다.

## 저장 상태

**현재 형식: format=KOREA1960_SAVE, version=4, dataVersion=1.3.0.** 버전 4 state는 버전 3에 `edicts`(시행 중인 지역 시책 `{edictId, regionId, startedTurn}` 배열, 권역마다 하나, 시책의 지형·자원 조건을 만족해야 함)를 더한다. 연대기 항목은 `edictId`를 가질 수 있다. 버전 3 state는 버전 2에 `day`(그 달의 날짜, 1~말일 정수, 종료 상태는 1)를 더한다. 버전 2 state는 아래 버전 1의 필드에 `report`(월 결산, 없으면 null)와 `monthActions`(이번 달 외교 상대 기록)를 더한다. 연대기 항목은 선택적으로 `changes`(지표 변화), `eventId`·`choiceId`·`kind`·`sourceIds`, `policyId`·`projectId`·`regionId`·`countryId`를 갖고, 불러올 때 모두 ID·수치를 검사한다. `report`는 허용된 키만 받는다.

**버전 3 저장**(게임 2.2)은 `edicts: []`를 더해 버전 4로 바꾼다. 이미 `edicts`가 들어 있는 버전 3 파일은 거부한다. **버전 2 저장**(게임 2.0~2.1)은 `day: 1`과 `edicts: []`를 더해 버전 4로 바꾼다. 이미 `day`나 `edicts`가 들어 있는 버전 2 파일은 조작으로 보고 거부한다. **데이터 1.1.0·1.2.0의 저장**은 받아서 dataVersion만 1.3.0으로 바꾼다(`COMPATIBLE_DATA_VERSIONS`). 1.2.0은 `balance` 규칙만, 1.3.0은 지형·자원·고유 사업·지역 시책만 더했고 기존 ID는 그대로이므로, 불러온 뒤의 달부터 새 규칙으로 계산된다. 이미 쌓인 지표 값은 바꾸지 않는다. 그 밖의 데이터 버전(예: 1.1.1)은 거부한다.

버전 1(데이터 1.0.0) 저장은 `migrateSave`가 순수 변환한다: 버전·데이터 버전을 올리고 `report:null`, `monthActions:[]`, `day:1`, `edicts:[]`를 더한다. 콘텐츠 ID와 수치는 그대로이므로 안전하다. 그 밖의 버전, 데이터 버전이 다른 버전 1, 다른 게임 ID는 거부한다. 자동 저장은 브라우저 localStorage의 `korea1960.game.v2`에 두고, 예전 키 `korea1960.reference.v1`이 있으면 변환해 옮긴다. 읽지 못한 자동 저장은 지우지 않고 `korea1960.game.v2.unreadable`에 보관한다.

버전 1의 구조: format=KOREA1960_SAVE, version=1. state에는 version,gameId,dataVersion,turn,rng,phase,ap,influence,seats,stats,support,relations,budget,policies,bills,projects,advisers,flags,queue,lastEvents,delayed,history,log,ending,lastFinance,visited가 들어간다.

법안 상태: introduced/committee/legal_review/plenary/passed/failed. 사업 상태: building/complete. 대기 사건은 콘텐츠 ID 배열이며 결과 문구를 저장하지 않는다. 엔딩은 ID와 발생 턴으로 복원하므로 외부 JSON의 임의 제목을 신뢰하지 않는다. UI는 불러온 텍스트와 출처 설명을 HTML escape한다.

## 변경·마이그레이션

동일 콘텐츠 ID의 표시 문구만 수정하는 경우 저장 버전을 유지할 수 있다. 지표의 의미·사건 분기·ID·상태 구조를 바꾸면 dataVersion 또는 save version을 올리고, 구버전 파일을 안전하게 거부하거나 순수 변환 함수를 제공한다. 호환성 경고를 지우기 위해 버전 검사를 임의로 제거하지 않는다. 현재 예시는 다른 버전의 저장을 거부한다.

TypeScript 참고 타입은 data/types.d.ts에 있다. 스키마의 기본 형태는 data/game.schema.json, 실제 참조·의미 검증은 tools/validate_content.py와 테스트가 담당한다. 동작하는 정본 데이터를 검증하기 위한 스키마이지 모든 가상 확장 필드를 이미 지원한다는 뜻이 아니다.

## 밸런스 규칙 블록 (데이터 1.2.0)

`balance`는 선택 항목이다. 없으면 엔진은 데이터 1.1.0(제작 패키지 v1)과 같은 계산을 한다. 각 하위 블록은 `note`(설명 문자열)를 가질 수 있다. 모르는 키나 범위 밖 값은 `tools/validate_content.py`가 거부한다.

| 키 | 형태 | 검사 범위 |
| --- | --- | --- |
| `diminishing` | `{metrics:[지표 ID], from, minFactor}` | metrics는 0~100 지표만, 0 ≤ from < 100, 0 ≤ minFactor ≤ 1 |
| `eventGain` | `{fictional_system?, historical_anchor?}` | 0~2 |
| `expectations` | `{지표 ID: {target, rate}}` | 0~100 지표, target 0~100, rate 0~0.2 |
| `growthBase` | 숫자 | −0.01~0.012 |
| `militaryRule` | `{monthly: {지표 ID: 값}}` | ±2 |
| `authoritarian` | `{monthly, gainFactor?, support?, relations?}` | monthly ±2, gainFactor 0~1(0~100 지표), support는 집단 ID, relations는 외교 상대 ID, ±2 |

수식은 docs/SIMULATION_RULES.md "데이터 1.2.0 밸런스", 타입은 `data/types.d.ts`의 `BalanceRules`.

## 권역 지형·자원, 고유 사업, 지역 시책 (데이터 1.3.0)

* `traits`: `{id, kind: "terrain"|"resource", name, mark(지도 글자 1~2자), description}`. 지형 6개, 자원 11개.
* `regions[].terrain`, `regions[].resources`: 위 ID 배열(각각 1개 이상, 중복 없음, 종류가 맞아야 함).
* `projects[].requires`(선택): 지형·자원 ID 배열. 권역에 하나라도 있으면 착수할 수 있다. 어느 권역에도 맞지 않는 값은 검증에서 거부한다. `projects[].development`(선택, 0~30 정수): 준공 시 개발도 증가, 없으면 9.
* `edicts`: `{id, name, requires(빈 배열이면 어느 권역이나), maxDevelopment?, cost, monthlyCost, unlockYear, monthlyEffects, factionEffects?, buildDiscount?(0~0.5), description}`. 모르는 키는 거부한다.
* `achievements[].condition`에 `uniqueProjects`(고유 사업 준공 수), `edicts`(동시에 시행 중인 시책 수)를 쓸 수 있다.
* 엔진 인터페이스: 행동 `{type:'edict', id, regionId}`(AP 1), `{type:'revokeEdict', regionId}`(AP 없음). 읽기 함수 `regionTags`, `regionHas`, `edictCap`, `regionEdict`, `buildDiscount`, `projectCost`, `edictReason`, `revokeEdictReason`. `financeDetail().edictUpkeep`.
* 검증: `tools/validate_content.py`(참조·범위), `data/game.schema.json`(형태), `data/types.d.ts`(`TraitDef`, `RegionDef`, `EdictDef`, `ActiveEdict`, `SaveStateV4Extra`).

## 데이터 2.0.0: 상품·건물·법률·이해집단 (저장 형식 5)

| 종류 | 주요 필드 | 규칙 |
| --- | --- | --- |
| goods (19) | id,name,category(staple/industrial/luxury/military),price,need{q0,e},world{price,export,import,noTariff?,schedule?}\|null,mark,description | 기준가격 > 0. world가 null이면 교역하지 않는다(전력·운송·서비스). 나라 안에서 만들 수도, 수입할 수도 없는 상품은 없어야 한다 |
| buildings (30) | id,name,category,cost(건설점),infraUse,infraSupply?,trade?,owner(business/land/petite/state),tech?,skill?,development?,requires?,maxPerRegion?,cap?('arable'),unlockYear,pollution?,private?,gov?,construction?,monthlyEffects?,description,pm[] | 첫 생산방식은 조건 없이 열린다. state 소유와 gov 건물은 private:false. gov 건물은 시장 산출이 없다. 건설 부문(id `construction`)은 정확히 하나이고 생산방식마다 points·materials가 있다 |
| pm(생산방식) | id,name,jobs{계층:수},in{상품:양},out{상품:양},unlock{year?,metric{지표:값}}?,points?,materials?,pollution? | 수량은 한 단계·한 달 기준 |
| lawGroups (14) | id,name,column(power/economy/rights),interval(개월),description | 분류마다 initial 법이 정확히 하나, 법이 둘 이상 |
| laws (38) | id,group,name,unlockYear,initial?,cost,monthlyCost,effects,monthlyEffects,modifiers,stances{계층:−2~2},description | modifiers 키는 `game/economy.mjs`의 `MODIFIER_KEYS`. 조세 법은 tax{consumption,wage,profit,land}, 토지 법은 farmShare(합 1), 경제 체제는 privateShare, 무역은 tariff를 반드시 정한다 |
| interestGroups (6) | id,name,mark,cloutWeight,wage,invest,description,demands[{id,text,buildings,base,perYear,from,weight}],traits{unhappy,happy,loyal:{name,modifiers?,monthly?}} | ID와 순서는 workers,farmers,petite,business,landowners,military. 적어도 한 건물은 두 집단 이상의 요구에 함께 들어간다 |
| economy | 시장 상수 블록 | `docs/SIMULATION_RULES.md` "시장 경제" |
| regions | …, arable(농장 단계 한도), start{건물:단계} | 1960년 건물은 지형·자원·경지·권역 한도·연도 조건을 지킨다. `slots`는 없어졌다 |
| edicts | …, constructionBonus? (0~0.5) | `buildDiscount` 대신 그 권역의 공사 진행을 빠르게 한다 |
| 사건·정책·시책의 factionEffects | {이해집단 ID: 수} | 2.0.0 변환: students·civil·bureaucracy·opposition → petite(합산 후 ±8로 제한), 나머지는 같은 ID |
| achievements.condition | policies·lawsEnacted·built·regionsBuilt·resourceBuilt·edicts·tradeSurplus·happyGroups·noShortage·turn·ending·view·지표 | |

### 엔진 인터페이스(3.0.0에서 추가된 것)
* 행동: `build{id,regionId}`, `cancelBuild{index}`, `prioritize{index}`, `pm{id,regionId,pm}`, `subsidy{id,regionId}`, `privatize{id,regionId}`, `downsize{id,regionId}`, `enact{id}`, `cancelEnact`, `coalition{id}`. `policy`는 행정 정책만 다룬다. `project`는 없어졌다.
* 사유 함수: `buildReason`, `cancelBuildReason`, `prioritizeReason`, `pmReason`, `subsidyReason`, `privatizeReason`, `downsizeReason`, `enactReason`, `cancelEnactReason`, `coalitionReason`. 화면은 이 함수의 문장을 그대로 보여 준다.
* 미리보기·계산: `econ.compute(state,data)`(읽기 전용), `econ.prospect`, `econ.demandStatus`, `econ.approvalParts`, `econ.activeTraits`, `econ.modifiers`, `lawChance`/`lawChanceParts`, `lawPreference`, `governmentClout`, `coalitionLegitimacy`, `privatizePrice`, `edictCap(state,data)`. `finance(state,data)`는 `compute(...).finance`.

### 저장 상태(형식 5)
**format=KOREA1960_SAVE, version=5, dataVersion=2.0.0.** 형식 4에서 `projects`·`bills`가 빠지고 다음이 들어왔다.
* `buildings[]`: `{id,regionId,level,pm,staff,state,subsidy}` — 정확히 이 7개 키. 권역·건물 쌍이 유일, 0≤state≤level≤60, 0≤staff≤1, 지형·자원 조건, private:false 건물은 state=level.
* `construction[]`: `{id,regionId,progress,private}` — 정부 8건·민간 2건까지, 0≤progress<cost.
* `laws{분류: 법}`(분류마다 그 분류의 법), `enactment` null 또는 `{lawId,stage,wait,setbacks,bonus,startedTurn}`, `government[]`(1~3, 유일), `ig{계층:{mod,clout,vote}}`, `support{계층: 0~100}`.
* `econ{prices,short,wage,workforce,pool,dividends,sol,sol0,needBase,gdpUnit,cpi,hist,trade}`: 가격은 기준가격의 −60%~+90%, 부족 배율 0~0.5, 투자기금 0~60 등 범위를 검사한다.
* `counters{built,privateBuilt,resourceBuilt,lawsEnacted,lawsFailed,regions}`.
* `report`에는 `completed[{buildingId,regionId,private}]`, `started`, `laws[{lawId,result,chance}]`, `market{gdp,unemployment,cpi,exports,imports,points,used,pool}`가 들어간다. 연대기 항목은 `buildingId`·`lawId`·`igId`를 가질 수 있고 모두 등록된 ID여야 한다.
* 파일은 3MB 이하. 형식 1~4는 `migrateSave`가 "경제 구조가 달라 이어 할 수 없다"는 오류로 거부한다(변환하지 않는다).
