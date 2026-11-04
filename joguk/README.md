# 조국과 민족을 위하여 — 박정희 일대기

1917년 경북 선산 상모리에서 1979년 서울 궁정동까지. 박정희의 생애를 따라가며, 역사의 갈림길마다 직접 선택하는 픽셀 아트 역사 시뮬레이션입니다.

선택이 끝날 때마다 **역사 기록 카드**가 열려 실제로 무슨 일이 있었는지, 그 선택이 어떻게 평가되는지 보여 줍니다. 경제 성장과 그 대가(쿠데타, 장기 집권, 유신, 긴급조치, 노동 탄압, 인권 침해)를 함께 다루며, 특정 인물을 미화하거나 폄훼하지 않는 것을 원칙으로 했습니다.

## 바로 해 보기

- **웹**: `joguk/index.html`을 로컬 서버로 엽니다. (`cd joguk && python3 -m http.server 8080` → http://localhost:8080)
- **데스크톱(Steam 빌드)**: `cd joguk && npm install && npm start`

설치 없이 브라우저에서 돌아가는 HTML5 게임이고, Steam용 실행 파일은 같은 파일을 Electron으로 감싸서 만듭니다.

## 게임 내용

| 항목 | 내용 |
| --- | --- |
| 이야기 | 9개 장, 34개 사건 (1917 출생 → 만주군관학교 → 숙군 → 5·16 → 한일협정 → 베트남 파병 → 3선 개헌 → 새마을운동 → 전태일 → 유신 → 김대중 납치 → 긴급조치 → 8·15 저격 → 인혁당 → 수출 100억 달러 → YH·부마 → 10·26) |
| 지표 | 경제·민심·권력·자유 4가지. 경제·민심·권력 중 하나가 0이 되면 정권이 무너지고, 장이 바뀔 때마다 ‘시대의 흐름’이 반영됨 |
| 엔딩 | 12개. 역사의 결말 ‘10·26’ 하나와, 역사와 다른 결말 11개 (문경의 선생님, 회군, 약속, 두 번의 임기, 1971년의 패배, 마지막 임기, 하야, 또 다른 장군들, 광장, 빈 곳간 등) |
| 미니게임 | 경부고속도로 건설(타이밍·돌관 공사와 사고 위험), 수출 100억 달러(공장 증설·잔업과 파업). 설정에서 자동 진행 가능 |
| 기록 보관소 | 사건마다 역사 노트. 플레이하면서 열림 |
| 업적 | 9개 (Steam 업적과 연동) |
| 그림·소리 | 모든 장면(19종)을 코드로 그린 320×180 픽셀 아트, 모든 음악·효과음은 Web Audio로 실시간 합성 |

### 조작

| 키 | 동작 |
| --- | --- |
| Space / Enter / 클릭 | 대사 넘기기 |
| 1 ~ 4, ↑↓ + Enter | 선택지 고르기 (마우스를 올리면 움직일 지표가 점으로 표시) |
| Ctrl (누르는 동안) | 빨리 넘기기 |
| A / L | 자동 진행 / 지난 대사 |
| Esc | 일시 정지 메뉴 |
| F11 | 전체 화면 (데스크톱) |

진행 상황은 사건이 시작될 때마다 자동 저장되며, 타이틀의 ‘이어하기’로 이어집니다.

## 파일 구성

```
joguk/
├─ index.html            게임 화면
├─ css/style.css         UI 스타일
├─ js/story.js           이야기·엔딩·업적 데이터 (대사와 역사 노트는 모두 여기)
├─ js/game.js            진행 엔진 (대화, 선택, 지표, 저장, 메뉴)
├─ js/scenes.js          픽셀 아트 장면 렌더러
├─ js/audio.js           절차적 음악·효과음
├─ js/minigames.js       미니게임 2종
├─ assets/fonts/         갈무리 글꼴 (SIL OFL 1.1)
├─ electron/             데스크톱 실행 파일 (Steam 업적 연동)
├─ build/icon.png        앱 아이콘
├─ steam/app_build.vdf   SteamPipe 업로드 스크립트 템플릿
├─ steam/achievements.md Steamworks에 등록할 업적 목록
├─ steam/store/          스토어 캡슐 이미지·스크린샷
└─ tools/store-art.html  스토어 이미지 생성기
```

## Steam에 출시하기

1. **Steamworks 가입**: [partner.steamgames.com](https://partner.steamgames.com)에서 개발사로 가입하고, 앱 등록비(Steam Direct)를 내면 **App ID**와 **Depot ID**가 발급됩니다.
2. **App ID 넣기**: `electron/main.js`의 `STEAM_APP_ID`(지금은 테스트용 480)를 발급받은 번호로 바꿉니다.
3. **업적 등록**: `steam/achievements.md`의 API 이름 그대로 Steamworks에 업적을 만듭니다.
4. **빌드**: 각 운영체제에서 실행합니다.
   ```bash
   cd joguk
   npm install
   npm run dist:win     # dist/win-unpacked/
   npm run dist:linux   # dist/linux-unpacked/
   npm run dist:mac     # dist/mac-universal/ (macOS에서)
   ```
5. **업로드**: `steam/app_build.vdf`의 `YOUR_APP_ID`, `YOUR_*_DEPOT_ID`를 바꾼 뒤 Steamworks SDK의 steamcmd로 올립니다.
   ```bash
   steamcmd +login <계정> +run_app_build ../joguk/steam/app_build.vdf +quit
   ```
6. **실행 옵션**: Steamworks → 설치 → 일반 설치에서 실행 파일을 지정합니다. (Windows: `조국과 민족을 위하여.exe`)
7. **스토어 페이지**: `steam/store/`의 이미지를 올립니다. 이미지를 다시 만들려면 로컬 서버로 `tools/store-art.html`을 열고 각 요소를 그 크기 그대로 캡처하면 됩니다.

| 파일 | 크기 | 용도 |
| --- | --- | --- |
| `header_capsule.png` | 920×430 | 헤더 캡슐 |
| `small_capsule.png` | 462×174 | 소형 캡슐 |
| `main_capsule.png` | 1232×706 | 메인 캡슐 |
| `vertical_capsule.png` | 748×896 | 세로 캡슐 |
| `library_capsule.png` | 600×900 | 라이브러리 캡슐 |
| `library_header.png` | 920×430 | 라이브러리 헤더 |
| `library_hero.png` | 3840×1240 | 라이브러리 히어로 (글자 없음) |
| `logo.png` | 1280×720 | 라이브러리 로고 (투명 배경) |
| `page_background.png` | 1438×810 | 스토어 페이지 배경 |
| `screenshot_*.png` | 1920×1080 | 스크린샷 7장 |

> Steamworks의 이미지 규격·심사 절차·등록비는 바뀔 수 있으니 올리기 전에 Steamworks 문서에서 최신 기준을 확인하세요. 한국 출시 시 등급 분류가 필요한지도 함께 확인하세요.

## 역사 서술 원칙

- 각 사건의 날짜·수치는 공개된 자료(국사편찬위원회, 한국민족문화대백과사전, 국정원 과거사위 보고서, 재심 판결 등)를 따랐습니다. 자료마다 수치가 다르면 보수적으로 적거나 ‘약’을 붙였습니다.
- 기록으로 확인되는 발언(혁명공약, “다시는 이 나라에 본인과 같은 불운한 군인이 없도록”, 전태일, 김영삼, 김재규의 진술 등)은 그대로 쓰고, 그 밖의 대사는 각색임을 기록 카드에 밝혔습니다.
- 역사와 다른 선택의 결과는 모두 ‘(가정)’으로 표시했습니다.
- 사실 관계가 다투어지는 사건(예: 김대중 납치 사건의 지시 여부)은 어느 쪽도 ‘실제 역사’로 표시하지 않았습니다.

## 라이선스

- 갈무리 글꼴: © 이민서, SIL Open Font License 1.1 (`assets/fonts/Galmuri-LICENSE.txt`)
