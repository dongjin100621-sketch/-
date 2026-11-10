# CHECKPOINT — 작업 상태 (2026-11-10)

다음 작업자는 이 문서와 README.md, QA_REPORT.md를 먼저 읽고 실제 파일 상태에서 이어 간다. `prompts/STAGED_WORKFLOW.md`의 다섯 단계를 기준으로 기록한다.

## 지금 실행 가능한 상태

* `KOREA1960.html`을 더블클릭하면 1960-01부터 1979-12(또는 조기 엔딩)까지 실제로 끝까지 플레이할 수 있다. 저장소 GitHub Pages(`docs/korea1960/index.html`)에도 같은 파일을 둔다.
* 엔진·콘텐츠·저장 테스트 82개 통과, 자동 캠페인 900판(전략 8×100 + 시드 100) 불변식 통과, 콘텐츠 검증 통과, 데스크톱 1440×900·모바일 390×844 실제 브라우저 검수 126개 통과, 웹 링크판 sandbox 검수 26개 통과(QA_REPORT.md).
* 웹 링크: Claude 아티팩트로 게시한 판(소유자 비공개, 공유는 페이지의 Share 메뉴). GitHub Pages(`docs/korea1960/`)는 이 브랜치를 main에 병합해야 열린다.
* 버전: 게임 2.2.0 · 데이터 1.2.0(밸런스 규칙) · 저장 형식 3(날짜 포함, 형식 1·2 자동 변환).
* 시간: 한 틱 = 하루(실제 달력), 국정 결산은 매달 말일. 진행·일시정지·배속(×1·×2·×4·×8)·건너뛰기. 사건이 오면 시계가 멈추고 결정하면 다시 흐른다.

## 단계별 진행

| 단계 | 상태 | 한 일 |
| --- | --- | --- |
| 1. 패키지 인수와 실행 | 완료 | 원본 패키지를 수정 없이 커밋(비교 기준). v1 테스트 28개·콘텐츠 검증을 Node 22.23.4/Python 3.13.18에서 다시 실행해 통과 확인. 샘플 화면 확인. 문서와 데이터의 불일치 발견: 역사 앵커는 18개가 아니라 17개(문서 정정). |
| 2. 핵심 UI 완성 | 완료 | `game/`에 화면 v2를 새로 구성(아래). 8개 화면이 같은 상태를 공유. 비용·즉시/지연 효과 미리보기, 확인 창, 결정 후 변화 기록, 월 결산과 원인별 기여, 비활성 사유, 삽화 맥락 배치, 반응형·하단 행동 막대. |
| 3. 캠페인·분기 강화 | 대부분 | 역사 앵커 17개에 경로별 ‘이 캠페인에서는’ 설명(context). 사전 준비 사건 문구 구분. **데이터 1.2.0 밸런스**: 체감·높아진 기대·가상 사건 보너스 축소·기본 성장률 인하·군정/권력 집중 비용, 권력 집중 엔딩 우선순위 조정. 자동 전략 8개(헌정·군정·복지·환경·강경·성장·소극·무작위)로 측정해 자동 도달 엔딩 5/12 → 10/12, 지표 100 포화 없음. **1960~63년 준비 사건 추가는 아직.** |
| 4. 완성도와 접근성 | 일부 | 게임 방법 창, 지표 설명 창(계산 규칙+지난달 원인), 거래 확인/취소, 키보드 조작·초점 표시·모달 초점 가두기·Esc, 차트 대체 텍스트, 색 외 ▲▼·부호 표시, 44px 터치 대상, 저장 실패 안내, 손상 저장 거부. **단계별 튜토리얼, 스크린리더 전수 점검, 밝은 테마는 아직.** |
| 5. 납품·검수 | 일부 | QA_REPORT.md 갱신, 단일 HTML·ZIP 생성 도구. **실제 Windows 더블클릭, Safari/iOS는 검증하지 않음.** |

## 2.2.0 이후: 화면 한가운데 지도

* `assets/map/korea_map.json`(새로 생성), `tools/make_map.py`(Natural Earth 10m → 권역 10개 경로·북한·일본 해안·군사분계선·도시·경위선), `assets/ui/map.svg`, `assets/manifest.json`.
* `game/app.mjs`·`game/style.css`: 지도 화면(기본 화면, 메뉴 ‘지도’), 권역 색(개발도·농업 잠재력·사업 슬롯), 사업 표식, 권역 정보 카드, 지도 위 사건 문서(접기), 끌기·휠·버튼 확대, 키보드 선택. 휴대폰은 지도 아래로 문서·카드가 이어진다.
* `game/engine.mjs`: 방문 화면 목록에 `map` 추가(저장 검증). `tools/build_standalone.py`: 지도 자료 내장.
* 테스트: 엔진 +1(지도 방문 저장), 브라우저 지도 검사(권역 10개·선택·색 바꾸기·확대·끌기·키보드·넘침).

## 2.2.0(하루 단위 시계·화면 배치)에서 바꾼 파일

* `game/engine.mjs`: `tick`, `day`, `daysInMonth`, `dayLabel`, 저장 형식 3과 형식 2 변환. 결산 수식은 그대로.
* `game/app.mjs`·`game/style.css`: 시계(타이머·자동 멈춤·재개·배속·스페이스/숫자 키), 위쪽 지표 막대(평가 네 축+재정), 묶인 메뉴, ‘이번 달 업무’, 연대기 막대, 날마다 바뀌는 진행 막대.
* 테스트: `tests/game.test.mjs`(+5), `tests/helpers/campaign.mjs`(날짜 불변식), `tests/browser/e2e.cjs`(시계 검사), `tests/browser/artifact.cjs`(시계).
* `data/types.d.ts`, `game/saves/*`(형식 3), 문서(README, SIMULATION_RULES '하루 단위 시계', DATA_CONTRACT, QA_REPORT), `package.json` 2.2.0.
* 화면 참고: 사용자가 보낸 참고작 화면은 원작 화면 복제 금지 원칙에 따라 배치·문구·인물 사진을 옮기지 않았다. 전략 게임에서 흔한 구성 요소(지표 막대, 시계, 메뉴 묶음, 할 일 목록, 소식 막대)만 이 게임의 색·문서 양식으로 만들었다.

## 2.1.0(데이터 1.2.0)에서 바꾼 파일

* `data/game.json`(balance 블록, meta 1.2.0, authoritarian 우선순위 82)과 분리본 `data/endings.json`, 새 분리본 `data/balance.json`, `data/game.schema.json`, `data/types.d.ts`
* `game/engine.mjs`(`gainScale`, `COMPATIBLE_DATA_VERSIONS`, 월 처리의 새 원인 항목, `projectEffects`의 `base`), `game/app.mjs`(지표 설명을 데이터 규칙에서 생성, 미리보기 ‘기본’ 값, 체감 안내, 게임 방법 단락)
* `tests/game.test.mjs`(+6), `tests/helpers/campaign.mjs`(전략 5개 추가), `tests/fixtures/v2_data110_1964_bills_and_projects.json`(1.1.0 저장 호환 검사용), `tests/browser/e2e.cjs`(첫 선택 기록 값 기대)
* `tools/validate_content.py`(balance 검사, 분리본 12개), `game/saves/*`(1.2.0으로 재생성), `KOREA1960.html`, `docs/korea1960/index.html`
* 웹 링크판: `tools/build_standalone.py --artifact`, 저장 텍스트 복사·붙여넣기(`game/app.mjs`, `game/style.css`), `tests/browser/artifact.cjs`, `package.json`의 `build:artifact`·`test:artifact`
* 문서: `docs/SIMULATION_RULES.md`(데이터 1.2.0 밸런스), `docs/DATA_CONTRACT.md`, `README.md`, `QA_REPORT.md`, `CLAUDE_CONTEXT.md`, 이 문서. `package.json` 2.1.0

## 2.0.0에서 바꾼 파일

* 새 파일: `game/engine.mjs`, `game/app.mjs`, `game/style.css`, `game/index.html`, `game/saves/*`, `tests/game.test.mjs`, `tests/helpers/campaign.mjs`, `tests/browser/e2e.cjs`, `tests/fixtures/v1_*.json`, `tools/simulate.mjs`, `tools/subset_font.py`, `tools/package_zip.py`, `assets/fonts/ChronicleKR-{Regular,Bold}.woff2`, `README.md`, `CHECKPOINT.md`, `KOREA1960.html`, `package-lock.json`, 저장소의 `docs/korea1960/index.html`
* 고친 파일: `data/game.json`(1.1.0) 및 분리본 `data/events.json`, `data/game.schema.json`, `data/types.d.ts`, `tools/validate_content.py`, `tools/build_standalone.py`, `tools/make_sample_saves.mjs`, `tools/serve.py`, `package.json`, `START_WINDOWS.bat`, `assets/manifest.json`, `assets/fonts/README.md`, `docs/SIMULATION_RULES.md`, `docs/DATA_CONTRACT.md`, `docs/DEVELOPMENT_HANDOFF.md`, `CONTENT_INDEX.md`, `QA_REPORT.md`, `00_START_HERE.md`, `CLAUDE_CONTEXT.md`(맨 앞에 v2 안내), `RIGHTS_AND_ATTRIBUTION.md`
* 그대로 둔 파일: `example/*`(v1 참조 구현·버전 1 저장), `tests/engine.test.mjs`, `PLAYABLE_SAMPLE.html`, `assets/art/*.png|webp`, `assets/ui/*`, `assets/fonts/ChronicleKR-Regular.ttf`, `prompts/*`

## 엔진 v2 요약 (자세히: docs/SIMULATION_RULES.md "v2 변경")

* 수식은 v1과 같다. 회귀 테스트가 바뀐 규칙을 쓰지 않는 진행에서 v1과 v2의 상태가 240개월 동안 매달 같은지 3개 경로로 확인한다.
* 바뀐 규칙: 법안 확률에 종합 지지도 항, 외교는 상대마다 월 1회, 1979-12까지 못 끝내는 사업·법안 금지.
* 더한 것: 월 결산(`report`)과 지표별 원인(`ledger`), 연대기 항목의 `changes`, `actionReason`/사유 함수/미리보기/확률 함수, `migrateSave`, 검사 후 복제(실패한 시도가 상태를 복제하지 않음).
* 고친 v1 결함: 외교 방식에 프로토타입 키를 넣으면 국고가 NaN이 됨, 예산 행동에 배분이 없으면 예외.

## 남은 문제 (알려진 한계)

1. **밸런스(1.2.0에서 조정, 남은 점)**: 포화와 ‘소극 플레이도 최고 엔딩’ 문제는 해결했다(QA_REPORT.md). 남은 점: ① 재정 위기·신뢰 붕괴 엔딩은 자동 전략으로 나오지 않는다(부채가 300대에서 멈춤). ② 군정 경로는 1963년 첫 선거(당선 약 70%)와 1967·1971년 정기 선거에서 자주 낙선해, 군정 전략 100판 중 51판이 권한 이양으로 끝난다. ③ 기술 교류 외교 반복으로 교육이 99 가까이 오른다. ④ 사람의 플레이테스트로 체감 난이도를 확인하지 않았다.
2. **초반 반복**: 1960~63년의 준비 사건은 4종뿐이라(재등장 대기 18개월) 같은 사건이 여러 번 나온다. 문구는 사건마다 구분했지만 내용 추가가 필요하다.
3. 권역 특성(농업·항만 등)은 설명용이며 효과 배율로 쓰이지 않는다. 가상 의석은 정기 선거 때만 바뀐다.
4. 검토용 저장은 파일로만 제공한다(게임 안 목록 없음).
5. `__GAME_DEBUG__` 훅이 열려 있다(검토용, 배포판에서 지워도 됨).
6. 실제 Windows 더블클릭, Safari/iOS 파일 미리보기, 저사양 모바일 장시간 성능은 검증하지 않았다.
7. 음악·음성·튜토리얼 단계 안내·밝은 테마·동적 헌법·세부 거시경제는 범위 밖(구현했다고 소개하지 않는다).

## 다음 지시 (붙여 넣을 문장)

> 첨부된 현재 프로젝트와 CHECKPOINT.md를 먼저 읽고, 실제 파일의 상태를 기준으로 이어서 개발해. 이미 완료된 구현은 보존해. 밸런스는 데이터 1.2.0의 `balance` 블록으로 조정되어 있으니 수치를 바꿀 때는 `npm run simulate`로 전략 8개의 엔딩 분포를 다시 재고 QA_REPORT.md 표를 갱신해. 다음 작업은 3단계의 남은 부분인 1960~63년 사전 준비 사건 추가(지금 4종이라 반복됨)야. 새 사건은 `data/game.json`에만 넣고 ID를 기존과 겹치지 않게 하며, 실제 역사가 아니라 가상 사건임을 표시해. 끝나면 `python3 tools/validate_content.py --sync`, `npm test`, `npm run test:browser`, `npm run build:pages`까지 실행해 QA_REPORT.md와 이 문서를 갱신해.
