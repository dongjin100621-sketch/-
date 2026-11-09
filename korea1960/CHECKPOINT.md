# CHECKPOINT — 작업 상태 (2026-11-09)

다음 작업자는 이 문서와 README.md, QA_REPORT.md를 먼저 읽고 실제 파일 상태에서 이어 간다. `prompts/STAGED_WORKFLOW.md`의 다섯 단계를 기준으로 기록한다.

## 지금 실행 가능한 상태

* `KOREA1960.html`을 더블클릭하면 1960-01부터 1979-12(또는 조기 엔딩)까지 실제로 끝까지 플레이할 수 있다. 저장소 GitHub Pages(`docs/korea1960/index.html`)에도 같은 파일을 둔다.
* 엔진·콘텐츠·저장 테스트 76개 통과, 콘텐츠 검증 통과, 데스크톱 1440×900·모바일 390×844 실제 브라우저 검수 통과(QA_REPORT.md).
* 버전: 게임 2.0.0 · 데이터 1.1.0 · 저장 형식 2(버전 1 자동 변환).

## 단계별 진행

| 단계 | 상태 | 한 일 |
| --- | --- | --- |
| 1. 패키지 인수와 실행 | 완료 | 원본 패키지를 수정 없이 커밋(비교 기준). v1 테스트 28개·콘텐츠 검증을 Node 22.23.4/Python 3.13.18에서 다시 실행해 통과 확인. 샘플 화면 확인. 문서와 데이터의 불일치 발견: 역사 앵커는 18개가 아니라 17개(문서 정정). |
| 2. 핵심 UI 완성 | 완료 | `game/`에 화면 v2를 새로 구성(아래). 8개 화면이 같은 상태를 공유. 비용·즉시/지연 효과 미리보기, 확인 창, 결정 후 변화 기록, 월 결산과 원인별 기여, 비활성 사유, 삽화 맥락 배치, 반응형·하단 행동 막대. |
| 3. 캠페인·분기 강화 | 일부 | 역사 앵커 17개에 경로별 ‘이 캠페인에서는’ 설명(context). 사전 준비 사건 문구 구분. 240턴 자동 진행 불변식 검사(3전략). **밸런스 조정과 새 사건 추가는 하지 않음.** |
| 4. 완성도와 접근성 | 일부 | 게임 방법 창, 지표 설명 창(계산 규칙+지난달 원인), 거래 확인/취소, 키보드 조작·초점 표시·모달 초점 가두기·Esc, 차트 대체 텍스트, 색 외 ▲▼·부호 표시, 44px 터치 대상, 저장 실패 안내, 손상 저장 거부. **단계별 튜토리얼, 스크린리더 전수 점검, 밝은 테마는 아직.** |
| 5. 납품·검수 | 일부 | QA_REPORT.md 갱신, 단일 HTML·ZIP 생성 도구. **실제 Windows 더블클릭, Safari/iOS는 검증하지 않음.** |

## 이번에 바꾼 파일

* 새 파일: `game/engine.mjs`, `game/app.mjs`, `game/style.css`, `game/index.html`, `game/saves/*`, `tests/game.test.mjs`, `tests/helpers/campaign.mjs`, `tests/browser/e2e.cjs`, `tests/fixtures/v1_*.json`, `tools/simulate.mjs`, `tools/subset_font.py`, `tools/package_zip.py`, `assets/fonts/ChronicleKR-{Regular,Bold}.woff2`, `README.md`, `CHECKPOINT.md`, `KOREA1960.html`, `package-lock.json`, 저장소의 `docs/korea1960/index.html`
* 고친 파일: `data/game.json`(1.1.0) 및 분리본 `data/events.json`, `data/game.schema.json`, `data/types.d.ts`, `tools/validate_content.py`, `tools/build_standalone.py`, `tools/make_sample_saves.mjs`, `tools/serve.py`, `package.json`, `START_WINDOWS.bat`, `assets/manifest.json`, `assets/fonts/README.md`, `docs/SIMULATION_RULES.md`, `docs/DATA_CONTRACT.md`, `docs/DEVELOPMENT_HANDOFF.md`, `CONTENT_INDEX.md`, `QA_REPORT.md`, `00_START_HERE.md`, `CLAUDE_CONTEXT.md`(맨 앞에 v2 안내), `RIGHTS_AND_ATTRIBUTION.md`
* 그대로 둔 파일: `example/*`(v1 참조 구현·버전 1 저장), `tests/engine.test.mjs`, `PLAYABLE_SAMPLE.html`, `assets/art/*.png|webp`, `assets/ui/*`, `assets/fonts/ChronicleKR-Regular.ttf`, `prompts/*`

## 엔진 v2 요약 (자세히: docs/SIMULATION_RULES.md "v2 변경")

* 수식은 v1과 같다. 회귀 테스트가 바뀐 규칙을 쓰지 않는 진행에서 v1과 v2의 상태가 240개월 동안 매달 같은지 3개 경로로 확인한다.
* 바뀐 규칙: 법안 확률에 종합 지지도 항, 외교는 상대마다 월 1회, 1979-12까지 못 끝내는 사업·법안 금지.
* 더한 것: 월 결산(`report`)과 지표별 원인(`ledger`), 연대기 항목의 `changes`, `actionReason`/사유 함수/미리보기/확률 함수, `migrateSave`, 검사 후 복제(실패한 시도가 상태를 복제하지 않음).
* 고친 v1 결함: 외교 방식에 프로토타입 키를 넣으면 국고가 NaN이 됨, 예산 행동에 배분이 없으면 예외.

## 남은 문제 (알려진 한계)

1. **밸런스**: 적극적인 플레이에서 자유·정당성·생활이 100으로 포화된다. 권력 집중 경로도 사건 보너스 때문에 정당성이 80대로 남는다. 자동 전략으로는 12개 엔딩 중 5개만 자연 도달(나머지는 조건 고정 상태로 선택 가능 확인). 원인: 사건 선택지 대부분이 비용 없이 +2~+3을 주고, 월 회귀 항이 약함.
2. **초반 반복**: 1960~63년의 준비 사건은 4종뿐이라(재등장 대기 18개월) 같은 사건이 여러 번 나온다. 문구는 사건마다 구분했지만 내용 추가가 필요하다.
3. 권역 특성(농업·항만 등)은 설명용이며 효과 배율로 쓰이지 않는다. 가상 의석은 정기 선거 때만 바뀐다.
4. 검토용 저장은 파일로만 제공한다(게임 안 목록 없음).
5. `__GAME_DEBUG__` 훅이 열려 있다(검토용, 배포판에서 지워도 됨).
6. 실제 Windows 더블클릭, Safari/iOS 파일 미리보기, 저사양 모바일 장시간 성능은 검증하지 않았다.
7. 음악·음성·튜토리얼 단계 안내·밝은 테마·동적 헌법·세부 거시경제는 범위 밖(구현했다고 소개하지 않는다).

## 다음 지시 (붙여 넣을 문장)

> 첨부된 현재 프로젝트와 CHECKPOINT.md를 먼저 읽고, 실제 파일의 상태를 기준으로 이어서 개발해. 이미 완료된 구현은 보존하고 3단계 ‘캠페인·분기 강화’의 밸런스 조정부터 시작해. `node tools/simulate.mjs`로 전략별 엔딩 분포를 측정하고, 사건 선택지의 무비용 보너스와 월 회귀 항을 조정해 자유·정당성·생활이 쉽게 100에 포화되지 않게 하되, 권력 집중 경로의 비용이 결과에 드러나게 해. 수식을 바꾸면 데이터 버전을 1.2.0으로 올리고 docs/SIMULATION_RULES.md와 회귀 테스트의 기대(어떤 규칙이 바뀌었는지)를 함께 고쳐. 그다음 1960~63년 준비 사건을 늘리고, 끝나면 `npm test`, `npm run test:browser`, 단일 HTML 빌드까지 실행해 QA_REPORT.md와 이 문서를 갱신해.
