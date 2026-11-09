# 한국어 실행 폰트

Noto Sans KR에서 이 게임에 쓰는 글자만 추출하고 Chronicle KR로 이름을 바꾼 서브셋이다. 원본은 @expo-google-fonts/noto-sans-kr 0.4.4 패키지의 TTF. 저작권 표기와 SIL Open Font License 1.1 전문은 OFL.txt에 보존했다.

| 파일 | 쓰는 곳 | 원본 |
| --- | --- | --- |
| ChronicleKR-Regular.ttf | example/ 참조 구현과 PLAYABLE_SAMPLE.html (제작 패키지 v1, 수정하지 않음) | NotoSansKR_400Regular.ttf |
| ChronicleKR-Regular.woff2 | game/ 현재 게임과 KOREA1960.html | NotoSansKR_400Regular.ttf |
| ChronicleKR-Bold.woff2 | game/ 현재 게임의 제목·강조 (브라우저 합성 굵기 대신) | NotoSansKR_700Bold.ttf |

WOFF2 두 파일은 `tools/subset_font.py`가 data/game.json과 game/의 소스에 실제로 쓰인 글자를 모아 만든다. 콘텐츠나 화면 문구를 바꾼 뒤 새 글자가 시스템 글꼴로 보이면 원본 TTF 경로를 넘겨 다시 실행한다(fontTools·brotli 필요, 게임 실행에는 필요 없음). 원본 글꼴에 없는 기호(예: ✕)는 시스템 글꼴로 대체된다. 이 파일들은 삽화 생성물과 별개의 공개 라이선스 폰트다.
