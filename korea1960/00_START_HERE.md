# 클로드 제작 패키지 · 시작 안내

> **현재 게임 3.0.0 (2026-11-11).** 지금 플레이할 파일은 `KOREA1960.html`, 현재 소스는 `game/`(시장 모형은 `game/economy.mjs`), 작업 상태는 `CHECKPOINT.md`, 실행·데이터·저장 안내는 `README.md`를 본다. 아래는 제작 패키지 v1의 원래 안내이며 `example/`·`PLAYABLE_SAMPLE.html`은 비교 기준으로 남겨 두었다.

게임명(독자 제작용): **대한민국 1960: 선택의 연대기**

첨부한 Steam 게임과 같은 역사 정치·경제 시뮬레이션을 만들기 위한 프롬프트·설계·가상 콘텐츠·전용 이미지·동작하는 예시다. 원작의 전체 데이터나 내부 소스를 확보한 복제본은 아니다. 패키지에 들어 있는 문구·수치·기획·삽화는 이 제작을 위해 새로 구성했다.

## 클로드에 전달하는 방법

1. ZIP을 압축 해제한다. 클로드가 파일을 읽고 수정할 수 있는 프로젝트 폴더로 연다.
2. `prompts/CLAUDE_MASTER_PROMPT.md` 전체를 첫 메시지로 붙여 넣는다.
3. 첨부 개수·용량 제한이 있으면 먼저 `CLAUDE_CONTEXT.md`, `data/game.json`, `example/engine.mjs`, `example/app.mjs`, `example/style.css`와 실행용 WebP 4장을 전달한다. 폴더 작업이 가능한 환경에서는 전체 폴더가 가장 간단하다.
4. 한 번에 끝내기 어렵다면 `prompts/STAGED_WORKFLOW.md`를 순서대로 사용한다.

## 먼저 샘플 확인하기

`PLAYABLE_SAMPLE.html`을 브라우저로 열면 설치 없이 실행된다. Windows에서는 더블클릭, 모바일에서는 HTML 실행을 지원하는 브라우저/파일 환경을 사용한다. iOS 파일 미리보기에서는 스크립트 실행이 제한될 수 있으므로 개발 단계에서는 PC 브라우저가 편하다.

개발용 분리 파일을 실행하려면 터미널에서 `python3 tools/serve.py`를 실행하고 표시되는 로컬 주소를 연다. Windows에서 `python3` 명령이 없으면 `py tools/serve.py`를 사용한다. `START_WINDOWS.bat`도 포함한다. Python은 분리 소스의 로컬 서버에만 필요하고 단일 HTML에는 필요 없다.

## 주요 파일

| 파일·폴더 | 용도 |
| --- | --- |
| prompts/CLAUDE_MASTER_PROMPT.md | 처음 붙여 넣는 지시문 |
| CLAUDE_CONTEXT.md | 핵심 설계·수식·계약을 합친 대체 전달본 |
| docs/ | 게임 설계·수식·데이터 계약·미술·역사·검수 |
| data/game.json | 모든 콘텐츠의 정본 |
| data/*.json | 정본에서 추출한 읽기용 분리본 |
| assets/art/ | 원본 PNG 4장과 실행용 WebP 4장 |
| assets/ui/ | SVG 13개와 디자인 토큰 |
| assets/ART_PROMPTS.md | 삽화 생성 지시문 |
| example/ | 의존성 없는 계산 엔진과 동작 UI |
| tools/ | 실행 서버·단일 HTML 빌더·콘텐츠 검증 |
| tests/engine.test.mjs | 핵심 계산과 저장·진행 테스트 |
| QA_REPORT.md | 이번 납품의 실제 검증 결과 |

정확한 콘텐츠 수와 범위는 CONTENT_INDEX.md에 있다. 상용 수준의 정밀 거시경제·동적 헌법 전문·음악·실제 지역별 통계는 제공 범위 밖이다. 샘플은 완성 게임 개발의 기준점이다.
