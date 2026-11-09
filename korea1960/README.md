# 대한민국 1960: 선택의 연대기

1960년 1월부터 1979년 12월까지 한 달을 한 턴(240턴)으로 진행하는 한국어 역사 정치·경제 시뮬레이션입니다. 플레이어는 박정희라는 역사적 출발점에서 시작하지만 1960년에는 대통령 권한이 없습니다. 관찰·사전 준비 → 1961년 통치 경로 분기(헌정/군정) → 1963년 가상 선거와 취임 → 국정 운영 → 정기 선거 또는 권력 집중의 비용 → 권한 이양·위기·1979년 평가로 이어집니다.

실제 역사는 출처와 함께 구분해 보여 주고, 모든 수치·선택 결과·가상 선거·자문위원은 창작입니다. 참조 게임의 코드·화면·대사·수치·이미지를 쓰지 않았습니다. 외부 AI API·로그인·서버·유료 서비스 없이 오프라인으로 실행됩니다.

현재 상태와 다음 작업은 **[CHECKPOINT.md](CHECKPOINT.md)**, 실제로 수행한 검증은 **[QA_REPORT.md](QA_REPORT.md)**에 있습니다.

## 실행 방법

| 방법 | 하는 일 |
| --- | --- |
| `KOREA1960.html` 더블클릭 | 설치 없이 바로 실행. 콘텐츠·삽화·글꼴이 모두 들어 있는 단일 파일(약 2.4MB). Windows는 `START_WINDOWS.bat`도 가능 |
| 웹 주소 | https://dongjin100621-sketch.github.io/-/korea1960/ (저장소의 `docs/korea1960/index.html`, 위와 같은 파일) |
| `python3 tools/serve.py` | 분리 소스(`game/`)를 127.0.0.1에서 실행. 개발할 때 사용. `--reference`는 v1 참조 구현 |

진행은 브라우저(localStorage)에 매 행동마다 자동 저장됩니다. 다른 기기로 옮기려면 기록실 → **저장 파일 내보내기**(JSON) → 다른 기기에서 **저장 파일 불러오기**. 검토용 저장 파일은 `game/saves/`에 있습니다.

## 게임의 한 달

1. **사건 결정** — 상황판의 사건 문서에서 선택지 하나를 고릅니다. 선택지마다 국고 비용, 지표의 결정 전→후 값, 지지·관계 변화, 지연 효과(몇 개월 뒤 어떤 효과), 선거 확률, 엔딩 여부를 미리 보여 줍니다. 역사 앵커는 ‘실제 역사(출처)’와 ‘이 캠페인에서는(가상)’을 나눠 보여 주고, 후자는 지금까지의 경로에 따라 달라집니다.
2. **행동점수 3** — 정책 시행·법안 발의·사업 착수·외교·자문 임명/해임·부채 상환·사전 준비에 1점씩. 비용을 쓰는 행동은 확인 창에서 비용, 즉시 효과, 매월 효과, 월 수지 변화, 준공·표결 시점을 확인한 뒤 확정합니다. 할 수 없는 버튼에는 사유가 붙습니다. 예산 배분 수정은 무료입니다.
3. **다음 달** — 월 결산 창이 열립니다. 재정 내역, 준공·표결·지연 효과·선거, 지표마다 원인별 기여(누르면 펼침), 지지 변화, 다음 달 사건을 보여 줍니다.

화면: 상황판 · 정책 · 의회 · 사업·권역 · 재정 · 외교 · 내각 자문 · 기록실(저장·연대기·출처·지표 정의·엔딩 규칙·권리 표기). 모든 화면이 같은 상태를 읽고, 오른쪽 브리핑(좁은 화면에서는 아래)과 하단 행동 막대(휴대폰)가 날짜·행동점수·국고·진행 중 법안·사업을 보여 줍니다.

## 폴더

| 경로 | 내용 |
| --- | --- |
| `game/engine.mjs` | 계산 엔진 v2. 의존성·DOM 없음. `example/engine.mjs`에서 발전시킴 |
| `game/app.mjs`, `game/style.css`, `game/index.html` | 화면 v2. 입력을 `dispatch`로 보내고 돌려받은 상태만 그림 |
| `game/saves/` | 검토용 저장(형식 2) 3개 |
| `data/game.json` | **모든 콘텐츠의 정본**. 분리본 `data/*.json` 11개는 읽기용 사본 |
| `data/game.schema.json`, `data/types.d.ts` | 구조 스키마·TypeScript 참고 타입 |
| `assets/art/` | 생성 삽화 원본 PNG 4장(보존) + 실행용 WebP 4장 |
| `assets/ui/` | SVG 아이콘 13개, 디자인 토큰 |
| `assets/fonts/` | Chronicle KR(Noto Sans KR 서브셋, OFL) |
| `example/` | 제작 패키지 v1 참조 구현과 버전 1 저장. **수정하지 않음**(회귀 비교 기준) |
| `tests/engine.test.mjs` | v1 원본 테스트 28개(참조 구현 대상, 수정하지 않음) |
| `tests/game.test.mjs` | v2 테스트 48개: 원본 28개 이식 + 새 규칙·저장 변환·v1 회귀 비교·자동 캠페인 불변식 |
| `tests/browser/e2e.cjs` | 실제 브라우저 검수(Playwright) |
| `tools/` | 빌드·검증·시뮬레이션·글꼴·패키징 도구 |
| `docs/` | 설계·수식·데이터 계약·미술·역사·검수 기준 |
| `KOREA1960.html` | 빌드된 단일 실행 파일 |
| `PLAYABLE_SAMPLE.html` | 제작 패키지 v1 샘플(참조용) |

## 데이터를 고치는 곳

* **콘텐츠(사건·정책·사업·권역·외교·자문·엔딩·출처·지표)**: `data/game.json`만 고칩니다. 그다음 `python3 tools/validate_content.py --sync`로 분리본을 다시 만들고 ID·참조·조건·무료 선택지·이미지를 검사합니다.
* **사건의 경로별 설명**: 사건의 `context` 배열. `{conditions:[...], text}` 중 조건이 맞는 첫 항목이 ‘이 캠페인에서는’ 상자에 나옵니다. 조건 문법은 `docs/DATA_CONTRACT.md`.
* **규칙·수식**: `game/engine.mjs` (문서는 `docs/SIMULATION_RULES.md`를 함께 고침). 화면에서 쓰는 설명 문구는 `game/app.mjs` 위쪽의 `METRIC_HELP`, `PHASE`.
* **ID는 바꾸지 않습니다.** 저장 파일이 ID로 상태를 복원합니다. 표시 문구만 고치면 저장 호환이 유지됩니다. 지표의 의미·사건 분기·상태 구조를 바꾸면 `meta.version`이나 `SAVE_VERSION`을 올리고 `migrateSave`에 변환을 추가합니다.
* 고친 뒤: `npm test` → `python3 tools/build_standalone.py --pages` → (글자가 새로 생겼으면) `tools/subset_font.py` → 다시 빌드.

## 저장 호환성

* 현재 저장 형식 **2**, 데이터 버전 **1.1.0**. 파일은 JSON(`format: "KOREA1960_SAVE"`)이며 2MB 이하만 받습니다.
* **버전 1(제작 패키지 v1, 데이터 1.0.0) 저장은 불러올 때 자동 변환**됩니다. 브라우저에 남은 v1 자동 저장도 처음 열 때 옮깁니다. 콘텐츠 ID·수치가 같아서 진행·난수·법안·사업·지연 효과가 그대로 이어집니다.
* 그 밖의 버전, 다른 데이터 버전의 버전 1, 다른 게임, 미등록 ID, 범위 밖 수치, 잘못된 자료형, 허용되지 않은 결산 필드는 **전부 거부**하고 현재 진행을 바꾸지 않습니다. 텍스트는 화면에서 HTML 이스케이프됩니다. 서명된 저장이 아니므로 치트 방지는 보장하지 않습니다.
* v2 저장은 v1 참조 구현에서 열 수 없습니다(버전 검사).

## 명령

```
npm test                          # 엔진 테스트 76개 (원본 28 + v2 48), 약 30초
CAMPAIGN_SEEDS=100 npm run test:game   # 자동 캠페인을 전략마다 100개로 늘린 확장 검사
npm run validate                  # 콘텐츠 검증   (python3 tools/validate_content.py)
npm run simulate                  # 전략별 엔딩 분포·최종 지표 평균 (node tools/simulate.mjs 40)
npm run build                     # KOREA1960.html 빌드
npm run build:pages               # 빌드 + docs/korea1960/index.html 복사
npm run test:browser              # 브라우저 검수 (Playwright 필요)
npm run package                   # dist/KOREA1960_v2.0.0.zip (전체 소스 + 단일 HTML)
npm start                         # 개발 서버
```

Node 20 이상(검증: Node 22.23.4), Python 3(검증: 3.13.18). npm 의존성이 없어 `npm install`이 필요 없습니다(`package-lock.json`은 빈 의존성 트리). 브라우저 검수에만 Playwright, 글꼴 재생성에만 fontTools가 필요합니다.
