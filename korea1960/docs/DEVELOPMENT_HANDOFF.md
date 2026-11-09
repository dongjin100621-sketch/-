# 개발 인수 메모

## v2 (현재)

현재 게임은 `game/`(engine.mjs·app.mjs·style.css·index.html)이고 `example/`은 v1 참조 구현으로 수정하지 않는다. 명령은 README.md의 '명령' 절, 작업 상태는 CHECKPOINT.md를 따른다.

* `npm test` — `tests/engine.test.mjs`(v1 원본 28개, example/ 대상) + `tests/game.test.mjs`(v2 48개)
* `node tools/simulate.mjs [시드 수] [전략]` — constitutional/military/random 전략의 엔딩 분포와 최종 지표
* `node tests/browser/e2e.cjs` — Playwright로 단일 HTML을 file://로 열어 데스크톱·모바일 전체 흐름 검수
* `python3 tools/build_standalone.py [--pages|--reference]` — 단일 HTML 빌드
* `python3 tools/subset_font.py <Regular.ttf> <Bold.ttf>` — 글꼴 서브셋 재생성(fontTools 필요)
* `python3 tools/package_zip.py` — dist/에 전체 소스 ZIP

파일 경계는 아래 v1 원칙을 그대로 따른다. game/app.mjs는 비용·결과를 직접 계산해 상태를 바꾸지 않고, 버튼의 비활성 사유도 엔진의 사유 함수(`actionReason` 등)를 그대로 쓴다. 미리보기 함수(`choicePreview`, `projectEffects`, `billChance` …)는 상태를 바꾸지 않고 난수를 소비하지 않는다. 빌더는 엔진의 export를 지우고 네임스페이스 `E`로 감싸므로, app.mjs는 `import * as E from './engine.mjs'` 한 줄만 import한다.

## v1 (제작 패키지 원문)

이 프로젝트는 플랫폼 계정·API 키·AI 추론·데이터베이스 없이 실행하는 로컬 예시다. 클로드는 추론 호출을 게임의 매턴 진행에 붙일 필요가 없다. 고정 콘텐츠·순수 엔진으로 결과를 재현하고, 필요한 창작 확장은 개발 단계에서 작성한다.

## 명령

* `node --test tests/engine.test.mjs` : 핵심 엔진 검증
* `python3 tools/validate_content.py` : 정본/분리본·참조·무료 선택지·이미지 누락 검사
* `python3 tools/validate_content.py --sync` : 정본에서 분리본 재생성 후 검사
* `python3 tools/build_standalone.py` : 단일 HTML 재생성
* `python3 tools/serve.py` : 127.0.0.1에서 분리 소스 실행
* `node tools/make_sample_saves.mjs` : 검토용 저장 두 개 재생성

테스트에는 최근 Node의 내장 node:test만 필요하고 별도 npm 설치는 없다. Python 도구도 표준 라이브러리만 사용한다. 이미지를 다시 압축하려면 별도 이미지 도구가 필요하지만 기본 실행·빌드에는 필요 없다. 개발 환경은 Node 24.22.1 / Python 3.12.14에서 확인했다. 사용자의 런타임 버전이 다르면 현재 검증 결과를 그대로 적용한다고 가정하지 않는다.

## 파일 경계

engine.mjs는 DOM·localStorage·네트워크를 사용하지 않는다. app.mjs는 입력을 dispatch로 보내고 반환된 상태만 그린다. UI 안에서 비용이나 결과를 따로 계산해 상태를 수정하지 않는다. 단, `visited`만 화면 방문 기록으로 UI가 갱신한다. __GAME_DEBUG__는 검토용으로 상태 복사본과 dispatch를 노출하며 경쟁·서비스 배포에서는 제거할 수 있다.

빌더는 엔진의 export와 앱의 import를 제거해 같은 내용을 인라인 module로 묶고 이미지·아이콘·JSON을 데이터로 내장한다. HTML을 직접 고치면 분리 소스에 반영되지 않는다. 수정은 engine/app/style/game.json에서 하고 다시 빌드한다.

## 다음 개발 우선순위

1. 실제 브라우저의 첫 플레이와 좁은 화면의 가독성을 확인한다.
2. 초반과 후반을 포함한 사용자 플레이테스트로 진행 속도와 난이도를 조정한다.
3. 정책별 지연 효과와 집단 반응을 UI에서 더 비교하기 쉽게 만든다.
4. TypeScript로 옮길 경우 기존 엔진과 동일 입력·동일 결과 회귀 검사를 유지한다.
5. 실제 통계나 동적 헌법·복잡한 통화정책을 추가한다면 별도 설계·출처·저장 마이그레이션을 만든다.

## 알려진 단순화

초반 국가 지표는 관찰 모형이며 플레이어가 조작하는 예산이 아니다. 1963년 선거와 취임은 사건으로 압축한다. 후속 정기 선거는 역사적 일정과 달리 48개월 주기로 단순화한다. 권역 특성은 설명용이며 생산성 배율로 반영하지 않는다. 자문위원은 이니셜로 표시한다. 배경음·음성·전투·지도 전선·실제 정당별 의석 모델은 없다. 모든 엔딩의 조건 검증은 실제 자연 플레이에서 고르게 등장한다는 뜻이 아니다.
