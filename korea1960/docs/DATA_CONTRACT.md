# 데이터 계약과 저장 구조

`data/game.json`이 정본이다. 분리 JSON 11개는 같은 레코드를 읽기 편하게 제공하는 사본이며 엔진이 따로 병합하지 않는다. 변경 후 `python3 tools/validate_content.py --sync`로 사본을 갱신하고 검증한다. 선택지·정책·사업·국가·권역·출처 ID는 저장 호환성을 위해 임의로 바꾸지 않는다.

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

**현재 형식: format=KOREA1960_SAVE, version=2, dataVersion=1.1.0.** 버전 2 state는 아래 버전 1의 필드에 `report`(월 결산, 없으면 null)와 `monthActions`(이번 달 외교 상대 기록)를 더한다. 연대기 항목은 선택적으로 `changes`(지표 변화), `eventId`·`choiceId`·`kind`·`sourceIds`, `policyId`·`projectId`·`regionId`·`countryId`를 갖고, 불러올 때 모두 ID·수치를 검사한다. `report`는 허용된 키만 받는다.

버전 1(데이터 1.0.0) 저장은 `migrateSave`가 순수 변환한다: 버전·데이터 버전을 올리고 `report:null`, `monthActions:[]`를 더한다. 콘텐츠 ID와 수치는 그대로이므로 안전하다. 그 밖의 버전, 데이터 버전이 다른 버전 1, 다른 게임 ID는 거부한다. 자동 저장은 브라우저 localStorage의 `korea1960.game.v2`에 두고, 예전 키 `korea1960.reference.v1`이 있으면 변환해 옮긴다. 읽지 못한 자동 저장은 지우지 않고 `korea1960.game.v2.unreadable`에 보관한다.

버전 1의 구조: format=KOREA1960_SAVE, version=1. state에는 version,gameId,dataVersion,turn,rng,phase,ap,influence,seats,stats,support,relations,budget,policies,bills,projects,advisers,flags,queue,lastEvents,delayed,history,log,ending,lastFinance,visited가 들어간다.

법안 상태: introduced/committee/legal_review/plenary/passed/failed. 사업 상태: building/complete. 대기 사건은 콘텐츠 ID 배열이며 결과 문구를 저장하지 않는다. 엔딩은 ID와 발생 턴으로 복원하므로 외부 JSON의 임의 제목을 신뢰하지 않는다. UI는 불러온 텍스트와 출처 설명을 HTML escape한다.

## 변경·마이그레이션

동일 콘텐츠 ID의 표시 문구만 수정하는 경우 저장 버전을 유지할 수 있다. 지표의 의미·사건 분기·ID·상태 구조를 바꾸면 dataVersion 또는 save version을 올리고, 구버전 파일을 안전하게 거부하거나 순수 변환 함수를 제공한다. 호환성 경고를 지우기 위해 버전 검사를 임의로 제거하지 않는다. 현재 예시는 다른 버전의 저장을 거부한다.

TypeScript 참고 타입은 data/types.d.ts에 있다. 스키마의 기본 형태는 data/game.schema.json, 실제 참조·의미 검증은 tools/validate_content.py와 테스트가 담당한다. 동작하는 정본 데이터를 검증하기 위한 스키마이지 모든 가상 확장 필드를 이미 지원한다는 뜻이 아니다.
