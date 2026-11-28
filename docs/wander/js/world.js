'use strict';
/* 은빛 유랑기 — 넓어진 세계: 새 지역 3곳, 메인 이야기 확장(중앙 2부·군도·황무지·최종장 2부), 곁이야기 확장
   MAINS / SIDEQ 에 이야기 줄기를 모은다. 진행 단계는 S.quest[id], S.side[id]. */

/* ─────────────── 새 적 ─────────────── */
Object.assign(ENEMIES, {
  royalguard: { name: '타락한 근위병', hp: 34, ac: 15, hit: 6, dmg: '1d10+3', xp: 90, gold: [15, 30], desc: '은사자 문장을 검게 칠한 근위병.' },
  cedric:     { name: '부단장 세드릭', hp: 110, ac: 16, hit: 8, dmg: '2d6+4', xp: 380, gold: [120, 120], boss: true, sp: ['multi'], desc: '쌍검을 든 기사단 부단장. 눈동자에 공허가 일렁인다.' },
  gladiator:  { name: '검투사', hp: 40, ac: 15, hit: 6, dmg: '1d10+3', xp: 90, gold: [10, 20], desc: '그물과 삼지창을 든 검투사.' },
  champion:   { name: '사막의 챔피언 라즈', hp: 72, ac: 16, hit: 7, dmg: '2d6+4', xp: 300, gold: [60, 60], boss: true, sp: ['multi'], desc: '쉰 번을 이긴 사하렌 검투장의 왕.' },
  merrow:     { name: '심해 인어 전사', hp: 62, ac: 16, hit: 9, dmg: '2d6+4', xp: 150, gold: [10, 30], desc: '산호 창을 든 인어 전사. 눈이 검게 물들었다.' },
  reefcrab:   { name: '산호 거대게', hp: 80, ac: 17, hit: 8, dmg: '2d8+3', xp: 165, gold: [15, 35], sp: ['heavy'], desc: '등딱지에 산호초가 통째로 자란 게.' },
  siren:      { name: '검은 세이렌', hp: 58, ac: 15, hit: 9, dmg: '2d6+3', xp: 160, gold: [10, 30], sp: ['drain', 'chill'], desc: '노래로 뱃사람을 홀리는 바다의 요정.' },
  teus:       { name: '심연의 크라켄 테우스', hp: 240, ac: 17, hit: 11, dmg: '2d10+5', xp: 900, gold: [260, 260], boss: true, sp: ['multi', 'heavy'], desc: '눈에 공허의 결정이 박힌 거대한 크라켄.' },
  ashghoul:   { name: '재 구울', hp: 72, ac: 15, hit: 9, dmg: '2d8+3', xp: 175, gold: [10, 30], sp: ['undead', 'poison'], desc: '잿더미에서 기어 나온 굶주린 망자.' },
  cinderhound:{ name: '잿불 사냥개', hp: 68, ac: 16, hit: 10, dmg: '2d6+5', xp: 185, gold: [0, 15], sp: ['multi'], desc: '갈비뼈 사이로 불씨가 타오르는 사냥개.' },
  ironwraith: { name: '쇠망령', hp: 92, ac: 17, hit: 10, dmg: '2d8+4', xp: 210, gold: [20, 50], sp: ['undead', 'heavy'], desc: '녹아내린 갑옷에 깃든 옛 왕국의 병사.' },
  ashenbar:   { name: '재의 왕 아셴바르', hp: 320, ac: 18, hit: 12, dmg: '2d10+6', xp: 1100, gold: [320, 320], boss: true, sp: ['heavy', 'regen', 'undead'], desc: '불타 버린 왕국의 왕. 왕관 대신 공허가 타오른다.' },
  starwisp:   { name: '별빛 정령', hp: 90, ac: 17, hit: 11, dmg: '2d8+4', xp: 240, gold: [10, 30], sp: ['drain'], desc: '부서진 별 조각이 정령이 되었다.' },
  voidknight: { name: '공허 기사', hp: 125, ac: 18, hit: 11, dmg: '2d10+4', xp: 280, gold: [30, 60], sp: ['heavy'], desc: '이름을 빼앗긴 기사. 갑옷 속이 텅 비어 있다.' },
  skywyrm:    { name: '천공 비룡', hp: 125, ac: 17, hit: 12, dmg: '2d8+5', xp: 300, gold: [30, 70], sp: ['multi', 'chill'], desc: '구름 사이를 헤엄치는 은빛 비룡.' },
  voidlord:   { name: '공허의 군주 무명', hp: 520, ac: 19, hit: 14, dmg: '3d8+7', xp: 2000, gold: [800, 800], boss: true, sp: ['multi', 'drain', 'heavy'], desc: '다섯 바람을 삼키려는 별 없는 밤 그 자체.' }
});

/* ─────────────── 새 지역 ─────────────── */
Object.assign(REGIONS, {
  archi: {
    name: '산호 군도', land: '남동 산호 군도', town: '등대섬 펠로아', icon: '🐚', color: '#3E9C9A', lv: '6~9', inn: 18, x: 86, y: 86,
    desc: '사하렌에서 배로 사흘. 에메랄드빛 바다 위로 산호섬들이 흩어져 있다. 등대섬 펠로아의 하얀 종탑은 백 년째 울리지 않는다.',
    enemies: ['merrow', 'reefcrab', 'siren'],
    shop: ['potion', 'hipotion', 'megapotion', 'ether', 'hiether', 'antidote', 'ration', 'smokebomb', 'coralspear', 'tidebow', 'pearlstaff', 'sirenblade', 'coralmail', 'tiderobe', 'pearlhood', 'rune_frost', 'rune_wisdom', 'rune_life'],
    rumors: ['“종탑의 종이 바다로 떨어진 뒤로 인어들이 사나워졌어.”', '“크라켄의 눈에 검은 돌이 박혀 있다던데. 그게 다 이름 없는 자 짓이래.”', '“산호 미궁에선 숨을 오래 참을 수 있어야 해. 체질이 약하면 들어가지 마.”', '“예전에 은발의 여자 마법사가 이 섬에서 하늘을 보며 편지를 썼대. 병에 넣어 바다에 띄웠다지.”']
  },
  waste: {
    name: '잿빛 황무지', land: '북서 잿빛 황무지', town: '재의 요새 아셴', icon: '🌋', color: '#8C6E5A', lv: '7~10', inn: 20, x: 14, y: 14,
    desc: '하늘에서 별이 떨어졌다는 땅. 백 년 전 불타 버린 왕국의 폐허 위로 잿가루가 눈처럼 내린다. 재의 요새 아셴은 그 끝에 웅크린 마지막 성채다.',
    enemies: ['ashghoul', 'cinderhound', 'ironwraith'],
    shop: ['potion', 'hipotion', 'megapotion', 'ether', 'hiether', 'antidote', 'ration', 'smokebomb', 'whetstone', 'ashaxe', 'cinderbow', 'emberrod', 'ashrapier', 'ashplate', 'shadowcloak', 'ashhelm', 'rune_blood', 'rune_might', 'rune_void'],
    rumors: ['“공허가 처음 내려앉은 곳이 여기야. 무명이라는 자도 여기서 태어났다더군.”', '“황무지의 탑에 옛 궁정 천문학자의 서재가 남아 있대.”', '“재 구울에게 물리면 독이 올라. 해독제를 챙겨.”', '“재의 왕은 아직도 자기 왕국이 불타고 있다고 믿어.”']
  },
  sky: {
    name: '천공섬', land: '천공섬 아스트라', town: '별지기 야영지', icon: '🌌', color: '#7A6FB5', lv: '10~13', inn: 25, x: 74, y: 22,
    locked: S => S.quest.final < 1, lockText: '최종장 1부를 마치면 빛의 계단이 열린다',
    desc: '왕도 천문탑에서 이어진 빛의 계단 끝, 구름 위에 떠 있는 고대 섬 아스트라. 부서진 별 정원과 거대한 서고, 그리고 하늘 한가운데 검은 옥좌가 있다.',
    enemies: ['starwisp', 'voidknight', 'skywyrm'],
    shop: ['hipotion', 'megapotion', 'hiether', 'elixir', 'antidote', 'ration', 'stargreat', 'starbow', 'starrod', 'starrapier', 'starmail', 'starcrown', 'rune_star'],
    rumors: ['“(별지기 노인) 옥좌 아래 결정 속에 누군가 잠들어 있어. 은빛 머리였지.”', '“(별지기 노인) 공허는 이름을 먹고 자라. 기억을 지닌 자 앞에서는 약해지지.”', '“(별지기 노인) 서고의 별 지도는 너의 기억을 비춰 준단다.”']
  }
});
Object.assign(ROUTES.south, { archi: 3 });
Object.assign(ROUTES.east, { archi: 3 });
Object.assign(ROUTES.west, { waste: 3 });
Object.assign(ROUTES.north, { waste: 3 });
Object.assign(ROUTES.central, { sky: 1 });
ROUTES.archi = { south: 3, east: 3 };
ROUTES.waste = { west: 3, north: 3 };
ROUTES.sky = { central: 1 };

/* 기억 조각 */
Object.assign(ITEMS, {
  memory_crown: { name: '기억 조각: 은사자', type: 'key', desc: '어머니 아리엔은 천문 기사단의 마지막 기사였다' },
  memory_sea:   { name: '기억 조각: 바다의 편지', type: 'key', desc: '“아이야, 하늘로 가는 계단은 다섯 바람이 열어 준단다.”' },
  memory_ash:   { name: '기억 조각: 잿빛 맹세', type: 'key', desc: '어머니와 무명은 한때 같은 별을 보던 동료였다' }
});

/* ─────────────── 탐험 사건 ─────────────── */
EXPLORE.archi = [
  { id: 'a_merrow', title: '검은 물결', text: '얕은 산호초 위로 검은 눈의 인어 전사가 솟구친다. “뭍사람은 돌아가라!”',
    choices: [
      { t: '싸운다', ok: { fight: 'merrow' } },
      { t: '“종을 되찾으러 왔다”고 말한다', check: ['cha', 15], ok: { text: '인어가 창을 내린다. “…종을? 그렇다면 산호 미궁을 조심해라.” 그가 진주 하나를 던져 준다.', gold: 50, xp: 90 }, no: { text: '“거짓말!”', fight: 'merrow' } }
    ] },
  { id: 'a_crab', title: '움직이는 산호초', text: '산호초가 통째로 일어선다. 거대한 집게가 햇빛에 번쩍인다.',
    choices: [
      { t: '맞선다', ok: { fight: 'reefcrab', win: { text: '등딱지 산호 사이에서 룬석이 반짝인다.', item: 'rune_ward' } } },
      { t: '바위 사이로 피한다', check: ['dex', 16], ok: { text: '거대게가 엉뚱한 바위를 부순다.', xp: 80 }, no: { text: '집게에 걸렸다!', hp: '-2d8', fight: 'reefcrab' } }
    ] },
  { id: 'a_bottle', title: '유리병 편지', text: '파도에 밀려온 유리병 안에 누렇게 바랜 편지가 들어 있다.',
    choices: [
      { t: '편지를 읽는다', ok: { text: '“…하늘섬의 서고에 다섯 바람의 비밀이 있다. 나는 그곳에서 그를 멈추겠다.” 서명은 지워져 있다. 하지만 필체는 어머니의 것이다.', xp: 60, flag: 'bottle_letter' } }
    ] },
  { id: 'a_market', title: '수상 시장', text: '작은 배들이 모여 열린 수상 시장. 진귀한 바다 물건이 가득하다.',
    choices: [
      { t: '흥정한다', check: ['cha', 14], ok: { text: '반값에 상급 물약을 손에 넣었다.', item: ['megapotion'], gold: -30, xp: 40 }, no: { text: '바가지를 썼다.', gold: -20, item: 'hipotion' } },
      { t: '진주 잠수 내기에 나선다', check: ['con', 16], ok: { text: '커다란 흑진주를 건졌다!', gold: 120, xp: 80 }, no: { text: '숨이 막혀 올라왔다.', hp: '-1d8' } }
    ] }
];
EXPLORE.waste = [
  { id: 'x_ghoul', title: '잿더미 아래', text: '잿가루가 꿈틀거리더니 굶주린 구울들이 기어 나온다.',
    choices: [
      { t: '싸운다', ok: { fight: 'ashghoul' } },
      { t: '잿더미에 불을 붙인다', req: S => G.has('bomb') || S.skills.some(s => SKILLS[s].fire), reqText: '화염', ok: { text: '오래된 재가 다시 타오르며 구울들을 삼켰다.', xp: 120, fn: S => { if (!S.skills.some(s => SKILLS[s].fire)) G.take('bomb'); } } }
    ] },
  { id: 'x_hound', title: '불씨 사냥개', text: '먼 언덕 위에서 붉은 눈들이 반짝인다. 잿불 사냥개 무리다.',
    choices: [
      { t: '맞선다', ok: { fight: 'cinderhound' } },
      { t: '바람을 거슬러 냄새를 숨긴다', check: ['int', 15], ok: { text: '사냥개들이 엉뚱한 방향으로 달려갔다.', xp: 100 }, no: { text: '들켰다!', fight: 'cinderhound' } }
    ] },
  { id: 'x_crater', title: '별이 떨어진 자리', text: '거대한 분화구 한가운데 검은 결정이 박혀 있다. 가까이 가자 머릿속에 낯선 이름들이 속삭인다.',
    choices: [
      { t: '결정 조각을 캐낸다', check: ['con', 16], ok: { text: '속삭임을 견디며 결정을 깨냈다. 손안에서 공허가 차갑게 울린다.', item: 'voidshard', xp: 120, once: true }, no: { text: '이름이 잠시 기억나지 않았다… 정신을 차리니 손에 피가 흐른다.', hp: '-2d8', mp: -6 } },
      { t: '물러선다', ok: { text: '등 뒤에서 속삭임이 오래 따라왔다.' } }
    ] },
  { id: 'x_wraith', title: '녹아내린 성문', text: '불타 버린 왕국의 성문 앞, 녹아내린 갑옷이 일어선다. “왕을… 지켜라….”',
    choices: [
      { t: '맞선다', ok: { fight: 'ironwraith', win: { text: '갑옷 안에서 오래된 룬석이 굴러 나왔다.', item: 'rune_might' } } },
      { t: '“왕국은 끝났다. 쉬어라”', check: ['cha', 16], ok: { text: '쇠망령이 무너져 내린다. 마지막으로 성문 열쇠를 내민다. 성문 안 보물고에서 금화를 찾았다.', gold: 140, xp: 150 }, no: { text: '“거짓말!”', fight: 'ironwraith' } }
    ] }
];
EXPLORE.sky = [
  { id: 'k_wisp', title: '별빛 정원', text: '부서진 별 조각이 꽃처럼 피어난 정원. 정령이 빛을 흩뿌리며 다가온다.',
    choices: [
      { t: '싸운다', ok: { fight: 'starwisp' } },
      { t: '정령과 함께 노래한다', check: ['cha', 17], ok: { text: '정령이 노래에 맞춰 춤추다 빛 한 줌을 남긴다.', mp: 99, hp: '3d8', xp: 160 }, no: { text: '정령이 화를 낸다!', fight: 'starwisp' } }
    ] },
  { id: 'k_knight', title: '빈 갑옷의 기사', text: '구름다리 위, 속이 텅 빈 갑옷이 검을 뽑는다. “이름을… 내놓아라….”',
    choices: [
      { t: '맞선다', ok: { fight: 'voidknight', win: { text: '갑옷이 흩어지며 별 룬 하나를 떨어뜨렸다.', item: 'rune_star' } } },
      { t: '내 이름을 크게 외친다', check: ['con', 17], ok: { text: '“나는 여기 있다!” 공허 기사가 비틀거리며 사라진다.', xp: 200 }, no: { text: '이름이 목에 걸려 나오지 않는다!', fight: 'voidknight' } }
    ] },
  { id: 'k_wyrm', title: '구름 바다의 비룡', text: '구름 사이에서 은빛 비룡이 솟아오른다.',
    choices: [
      { t: '맞선다', ok: { fight: 'skywyrm' } },
      { t: '비룡 등에 올라탄다', check: ['dex', 18], ok: { text: '비룡의 목에 매달려 하늘을 한 바퀴 돌았다! 비룡이 인정한 듯 비늘 하나를 떨군다.', gold: 150, xp: 250 }, no: { text: '떨어졌다!', hp: '-3d6', fight: 'skywyrm' } }
    ] }
];

/* ─────────────── 메인 이야기: 중앙 2부 · 군도 · 황무지 · 천공섬 ─────────────── */
const QUESTS2 = {
  royal: [
    { title: '피 묻은 은사자', text: '왕도로 돌아온 밤, 대성당 앞이 소란하다. 기사단장 아델린이 피를 흘리며 쓰러져 있고, 검은 그림자가 지붕 위로 달아난다.',
      choices: [
        { t: '아델린을 치료한다', check: ['int', 13], ok: { text: '상처에서 검은 독을 빼냈다. 아델린이 숨을 고르며 속삭인다. “…기사단 안에… 배신자가….”', xp: 120, flag: 'r_saved', quest: ['royal', 1] }, no: { text: '서툰 손길에도 아델린은 버텨 냈다. “지하 감옥… 증인이….”', quest: ['royal', 1] } },
        { t: '자객을 쫓는다', check: ['dex', 14], ok: { text: '지붕 위에서 자객을 붙잡았다! 자객의 품에 기사단 부단장의 인장이 찍힌 명령서가 있다.', xp: 120, flag: 'r_order', quest: ['royal', 1] }, no: { text: '자객이 반격해 온다!', fight: 'shade', win: { text: '쓰러진 자객 곁에 지하 감옥 열쇠가 떨어져 있다.', quest: ['royal', 1] }, flee: { text: '놓쳤다.' } } }
      ] },
    { title: '지하 감옥의 증인', text: '왕궁 지하 감옥. 사슬에 묶인 늙은 기사가 고개를 든다. “부단장 세드릭이… 이름 없는 자와 거래했소. 기사단의 옛 기록 — 천문 기사단의 명부를 넘겼지.” 그때 복도 끝에서 근위병들의 발소리가 들린다.',
      choices: [
        { t: '증인을 데리고 숨는다', check: ['dex', 14], ok: { text: '그림자 속에 숨어 근위병들을 보냈다. 증인이 말을 잇는다. “천문 기사단의 마지막 기사는 은발의 여인, 아리엔이었소.” — 어머니의 이름이다.', xp: 150, flag: 'r_name', quest: ['royal', 2] }, no: { text: '들켰다!', fight: 'royalguard', win: { text: '근위병을 쓰러뜨렸다. 증인이 숨을 몰아쉬며 은사자 홀을 가리킨다.', quest: ['royal', 2] }, flee: { text: '물러났다.' } } },
        { t: '근위병과 맞선다', ok: { fight: 'royalguard', win: { text: '증인이 은사자 홀을 가리킨다. “세드릭은 거기 있소.”', xp: 30, quest: ['royal', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '은사자 홀', text: S => `기사단의 은사자 홀. 부단장 세드릭이 쌍검을 들고 돌아선다. 그의 눈동자 속에서 검은 별이 일렁인다.<br>“아리엔의 아이로군. 무명께서 너를 기다리신다. 다섯 바람을 모아 오면 하늘 문이 열리니까.”${S.flags.r_order ? '<br>(품속의 명령서가 그의 배신을 증명한다.)' : ''}`,
      choices: [
        { t: '명령서를 기사들 앞에 펼친다', req: S => S.flags.r_order, reqText: '자객의 명령서', ok: { text: '기사들이 세드릭을 둘러싼다. 궁지에 몰린 그가 이를 간다.', flag: 'r_weak', xp: 80, go: 'royal_boss' } },
        { t: '“공허가 당신 이름도 먹을 거다”', check: ['cha', 16], ok: { text: '세드릭의 손이 떨린다. “…내 이름…?” 그의 검이 무거워 보인다.', flag: 'r_weak', xp: 80, go: 'royal_boss' }, no: { text: '“닥쳐라!”', go: 'royal_boss' } },
        { t: '검을 겨눈다', ok: { go: 'royal_boss' } }
      ] }
  ],
  archi: [
    { title: '울리지 않는 종', text: '등대섬 펠로아. 촌장 나엘이 텅 빈 종탑을 올려다본다. “백 년 전, 이 종이 바다로 떨어진 뒤 인어들과의 맹약이 끊겼소. 요즘엔 크라켄까지 깨어나 배를 삼키지.”',
      choices: [
        { t: '종이 떨어진 바다를 조사한다', check: ['int', 15], ok: { text: '조류를 계산하니 종은 산호 미궁 깊은 곳으로 흘러갔다. 크라켄의 둥지 바로 옆이다.', xp: 160, quest: ['archi', 1] }, no: { text: '바다는 넓다. 결국 인어들의 땅, 산호 미궁으로 가 보기로 했다.', quest: ['archi', 1] } },
        { t: '인어들에게 사절로 간다', check: ['cha', 15], ok: { text: '인어 족장이 마지못해 길을 열어 준다. “크라켄을 잠재우면 맹약을 다시 생각해 보지.”', xp: 160, flag: 'a_pact', quest: ['archi', 1] }, no: { text: '인어 전사가 창을 겨눈다!', fight: 'merrow', win: { text: '물러난 인어들 너머로 미궁 입구가 보인다.', quest: ['archi', 1] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '산호 미궁', text: '물빛이 일렁이는 산호 미궁. 깊은 곳에서 노랫소리가 들린다. 바위 위에 검은 세이렌이 앉아 손짓한다.',
      choices: [
        { t: '노래에 맞서 귀를 막고 헤엄친다', check: ['con', 16], ok: { text: '노래를 뿌리치고 미궁 끝 둥지에 닿았다. 떨어진 종이 산호에 반쯤 묻혀 있다.', xp: 200, quest: ['archi', 2] }, no: { text: '정신이 흐려진다… 세이렌이 덮쳐 온다!', fight: 'siren', win: { text: '세이렌이 거품이 되어 사라지고 길이 열렸다.', quest: ['archi', 2] }, flee: { text: '물러났다.' } } },
        { t: '더 아름다운 노래로 답한다', check: ['cha', 17], ok: { text: '세이렌이 눈물을 흘리며 노래를 멈춘다. “…오랜만에 진짜 노래를 들었어.” 세이렌이 길을 안내한다.', xp: 220, flag: 'a_siren', quest: ['archi', 2] }, no: { text: '노래가 묻혔다.', fight: 'siren', win: { text: '길이 열렸다.', quest: ['archi', 2] }, flee: { text: '물러났다.' } } },
        { t: '세이렌과 싸운다', ok: { fight: 'siren', win: { text: '길이 열렸다.', xp: 40, quest: ['archi', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '심연의 둥지', text: S => `가라앉은 종 너머, 바다가 갑자기 어두워진다. 거대한 크라켄 <b>테우스</b>가 촉수를 펼친다. 한쪽 눈에 검은 결정이 박혀 있다.${S.flags.a_pact ? '<br>멀리서 인어 전사들이 창을 들고 모여든다.' : ''}${S.flags.a_siren ? '<br>세이렌이 노래로 크라켄의 촉수를 묶는다.' : ''}`,
      choices: [
        { t: '종을 울린다', check: ['str', 16], ok: { text: '가라앉은 종을 힘껏 내리쳤다. 백 년 만의 종소리에 크라켄이 몸부림친다!', flag: 'a_weak', xp: 120, go: 'archi_boss' }, no: { text: '종이 꿈쩍도 하지 않는다.', go: 'archi_boss' } },
        { t: '눈의 결정을 노린다', check: ['dex', 17], bonus: S => (S.flags.a_pact ? 2 : 0) + (S.flags.a_siren ? 2 : 0), ok: { text: '결정에 금이 갔다! 크라켄이 비명을 지른다.', flag: 'a_weak', xp: 120, go: 'archi_boss' }, no: { text: '촉수에 튕겨 났다.', hp: '-2d8', go: 'archi_boss' } },
        { t: '맞선다', ok: { go: 'archi_boss' } }
      ] }
  ],
  waste: [
    { title: '잿빛 순례자', text: '재의 요새 아셴. 수척한 성주 이네스가 잿빛 지도를 펼친다. “백 년 전, 하늘에서 검은 별이 떨어져 이 왕국이 불탔소. 그날 왕궁 천문학자 엘렌디르가 사라졌지. 사람들은 그가 이름을 버리고 무명이 되었다고 하오.”',
      choices: [
        { t: '천문학자의 탑 위치를 묻는다', ok: { text: '“황무지 한가운데, 무너진 탑이오. 다만 재의 왕이 그 길을 지키고 있지.”', xp: 120, quest: ['waste', 1] } },
        { t: '불탄 왕국의 기록을 뒤진다', check: ['int', 16], ok: { text: '기록에 따르면 엘렌디르에게는 동료가 있었다. 천문 기사 아리엔. 둘은 함께 “다섯 바람의 꽃”을 연구했다.', xp: 180, flag: 'w_record', quest: ['waste', 1] }, no: { text: '기록은 대부분 타 버렸다.', quest: ['waste', 1] } }
      ] },
    { title: '무너진 천문탑', text: '잿가루에 반쯤 묻힌 탑. 서재에는 별 지도와 일지가 흩어져 있다. 일지 마지막 장: <i>“아리엔은 꽃으로 공허를 닫으려 한다. 하지만 나는 공허를 다스릴 수 있다. 이름 따위는 버려도 좋다.”</i> 그때 바닥이 흔들리고 쇠망령들이 깨어난다.',
      choices: [
        { t: '일지를 챙겨 탑을 빠져나간다', check: ['dex', 16], ok: { text: '무너지는 계단을 뛰어 내려왔다. 일지 사이에 어머니와 무명이 나란히 별을 보는 그림이 끼워져 있다.', xp: 220, flag: 'w_diary', quest: ['waste', 2] }, no: { text: '출구가 막혔다!', fight: 'ironwraith', win: { text: '쇠망령을 쓰러뜨리고 탑을 빠져나왔다.', quest: ['waste', 2] }, flee: { text: '물러났다.' } } },
        { t: '쇠망령들과 싸운다', ok: { fight: 'ironwraith', win: { text: '탑이 다시 조용해졌다.', xp: 40, quest: ['waste', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '재의 옥좌', text: S => `불탄 왕궁의 옥좌. <b>재의 왕 아셴바르</b>가 타오르는 공허를 왕관처럼 쓰고 일어선다. “내 왕국은… 아직 불타고 있다… 끄지 마라….”${S.flags.w_record ? '<br>(기록에 따르면 왕은 마지막까지 백성을 지키려 했다.)' : ''}`,
      choices: [
        { t: '“당신의 백성은 이미 쉬고 있다”', check: ['cha', 17], bonus: S => S.flags.w_record ? 3 : 0, ok: { text: '왕의 불꽃이 잠시 흔들린다. “…쉬고 있다고…?” 공허의 왕관만이 그를 붙잡고 있다.', flag: 'x_weak', xp: 150, go: 'waste_boss' }, no: { text: '“거짓말!” 불꽃이 치솟는다.', go: 'waste_boss' } },
        { t: '공허의 왕관을 내려친다', check: ['str', 17], ok: { text: '왕관에 금이 갔다!', flag: 'x_weak', xp: 150, go: 'waste_boss' }, no: { text: '불꽃에 데었다.', hp: '-2d8', go: 'waste_boss' } },
        { t: '맞선다', ok: { go: 'waste_boss' } }
      ] }
  ],
  sky: [
    { title: '부서진 별 정원', text: S => `빛의 계단 끝, 구름 위의 섬 아스트라. 부서진 별 조각이 꽃처럼 피어 있다. 별지기 노인이 지팡이를 짚고 다가온다.<br>“무명은 옥좌로 갔다. 옥좌 아래 결정 속에는 은발의 여인이 잠들어 있지. 서두르게.”${S.inv.memory_crown || S.inv.memory_sea || S.inv.memory_ash ? '<br>품속의 기억 조각들이 따뜻해진다.' : ''}`,
      choices: [
        { t: '정원을 지키는 정령을 지난다', check: ['cha', 16], ok: { text: '정령들이 길을 비켜 준다. 서고로 가는 길이 열렸다.', xp: 250, quest: ['sky', 1] }, no: { text: '정령이 덤빈다!', fight: 'starwisp', win: { text: '길이 열렸다.', quest: ['sky', 1] }, flee: { text: '물러났다.' } } },
        { t: '구름다리를 건넌다', check: ['dex', 16], ok: { text: '무너지는 구름다리를 건넜다.', xp: 250, quest: ['sky', 1] }, no: { text: '비룡이 다리를 덮친다!', fight: 'skywyrm', win: { text: '길이 열렸다.', quest: ['sky', 1] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '별의 서고', text: S => {
      const n = ['memory_crown', 'memory_sea', 'memory_ash'].filter(id => G.has(id)).length;
      return `끝없는 서가 사이, 천장에 별 지도가 움직인다. 품속의 기억 조각이 빛나며 지도 위로 떠오른다. (기억 조각 ${n}/3)<br>${n >= 3
        ? '세 조각이 하나로 이어진다. 천문 기사 아리엔이 꽃으로 공허를 닫으려다 무명에게 붙잡혀 결정 속에 갇힌 장면. 그리고 그녀가 마지막으로 남긴 노래 — <b>“바람의 자장가”</b>. 그 노래라면 결정을 깨울 수 있다.'
        : '흐릿한 장면만 스친다. 은발의 여인이 결정 속으로 가라앉는다. 무언가가 빠져 있다. <span class="muted">(중앙 2부·산호 군도·잿빛 황무지의 이야기에서 기억 조각을 모을 수 있다.)</span>'}`;
    },
      choices: [
        { t: '서고를 지나 옥좌로', ok: { fn: S => { if (['memory_crown', 'memory_sea', 'memory_ash'].every(id => G.has(id))) S.flags.true_path = true; }, xp: 300, quest: ['sky', 2] } },
        { t: '서고를 더 뒤진다', check: ['int', 17], ok: { text: '무명의 약점이 적힌 쪽지를 찾았다: “그는 자신의 옛 이름, 엘렌디르를 두려워한다.”', flag: ['sky_name'], xp: 200 }, no: { text: '책이 너무 많다.', time: 1 } }
      ] },
    { title: '공허의 옥좌', text: S => `하늘 한가운데 떠 있는 검은 옥좌. 그 아래 거대한 결정 속에 은발의 여인이 잠들어 있다. — 어머니다.<br>옥좌 위의 <b>무명</b>이 천천히 일어선다. “다섯 바람을 가져와 줘서 고맙다. 이제 꽃을 꺾고, 이 하늘을 영원한 밤으로 만들겠다.”`,
      choices: [
        { t: '“바람의 자장가”를 부른다', req: S => S.flags.true_path, reqText: '기억 조각 3개', ok: { text: '노래가 울리자 결정에 금이 가고, 그 안에서 어머니의 목소리가 화음을 얹는다. 무명이 귀를 막으며 비틀거린다!', flag: 'sky_weak', go: 'sky_boss' } },
        { t: '“엘렌디르!” 옛 이름을 부른다', req: S => S.flags.sky_name || S.flags.w_diary, reqText: '무명의 옛 이름', check: ['cha', 17], ok: { text: '무명의 형체가 일그러진다. “…그 이름을… 부르지 마라….” 공허가 흔들린다.', flag: 'sky_weak', go: 'sky_boss' }, no: { text: '무명이 웃는다. “그 이름은 오래전에 버렸다.”', go: 'sky_boss' } },
        { t: '맞선다', ok: { go: 'sky_boss' } }
      ] }
  ]
};

Object.assign(SCENES, {
  /* 최종장 1부: 천문탑 결말을 바꾼다 — 무명은 하늘섬으로 달아난다 */
  final_boss: { title: '공허의 사도 무명', text: '“좋다. 직접 꺾어 주지.” 무명이 가면을 벗는다. 그 아래에는 얼굴이 없다. 오직 별 없는 밤뿐.',
    choices: [{ t: '다섯 바람이여!', ok: { text: '품속의 꽃잎 다섯 장이 빛나며 몸을 감싼다. (체력·마나 회복)', hp: 999, mp: 999, fight: 'nameless', noFlee: true, win: { go: 'tower_end' } } }] },
  tower_end: { title: '빛의 계단', text: '무명의 형체가 흩어지는가 싶더니, 검은 연기가 되어 천문탑 꼭대기의 하늘로 빨려 들어간다. 그 자리에 다섯 빛깔의 계단이 구름 위로 뻗어 오른다.<br>“하늘섬 아스트라에서 기다리지. 네 어머니와 함께.”<br>품속의 청령화가 아직 피지 않은 채 떨고 있다. 이야기는 아직 끝나지 않았다.',
    choices: [{ t: '빛의 계단을 올려다본다', ok: { quest: ['final', 1], xp: 300, log: '천문탑에서 무명을 물리쳤지만 그는 하늘섬으로 달아났다', fn: () => UI.toast('새 지역이 열렸다: 천공섬 아스트라') } }] },

  royal_boss: { title: '부단장 세드릭', text: '세드릭이 쌍검을 교차한다.',
    choices: [{ t: '싸운다!', ok: { fight: 'cedric', weakFlag: 'r_weak', noFlee: true, win: { go: 'royal_end' } } }] },
  royal_end: { title: '은사자의 맹세', text: '쓰러진 세드릭의 눈에서 검은 별이 빠져나간다. “…용서를….” 아델린이 붕대를 감은 채 홀에 들어선다. 그녀가 기사단의 낡은 명부를 건넨다. 마지막 장에 은발의 여기사 초상과 이름이 있다. <b>천문 기사 아리엔</b>.<br>“네 어머니는 우리 기사단의 자랑이었다. 이 투구를 받아라. 그녀가 쓰던 것이다.”',
    choices: [{ t: '투구와 기억을 받는다', ok: { item: ['knighthelm', 'memory_crown', 'rune_star'], gold: 200, xp: 400, quest: ['royal', 3], log: '배신자 세드릭을 쓰러뜨리고 어머니의 이름을 알았다' } }] },

  archi_boss: { title: '심연의 크라켄 테우스', text: '바다가 소용돌이친다.',
    choices: [{ t: '싸운다!', ok: { fight: 'teus', weakFlag: 'a_weak', noFlee: true, win: { go: 'archi_end' } } }] },
  archi_end: { title: '다시 울리는 종', text: '크라켄의 눈에서 검은 결정이 빠져나와 바스러진다. 크라켄은 조용히 심연으로 돌아간다. 인어들이 종을 끌어올려 백 년 만에 펠로아의 종탑에 건다. 종소리가 군도 전체에 울린다.<br>종 안쪽에 유리병 하나가 걸려 있다. 어머니의 편지다. <i>“아이야, 하늘로 가는 계단은 다섯 바람이 열어 준단다. 나는 먼저 가서 문을 지키고 있을게.”</i>',
    choices: [{ t: '편지와 보물을 받는다', ok: { item: ['memory_sea', 'tidecrown', 'krakenfang'], gold: 260, xp: 500, quest: ['archi', 3], log: '크라켄을 잠재우고 펠로아의 종을 되찾았다' } }] },

  waste_boss: { title: '재의 왕 아셴바르', text: '잿불이 폭풍처럼 일어선다.',
    choices: [{ t: '싸운다!', ok: { fight: 'ashenbar', weakFlag: 'x_weak', noFlee: true, win: { go: 'waste_end' } } }] },
  waste_end: { title: '꺼진 불', text: '공허의 왕관이 부서지자 재의 왕이 처음으로 웃는다. “…드디어 쉬는구나.” 그의 몸이 잿가루가 되어 바람에 흩어지고, 백 년 만에 황무지에 비가 내린다.<br>옥좌 뒤 벽에 새겨진 맹세: <i>“엘렌디르와 아리엔, 같은 별 아래서. 다섯 바람이 모이는 날, 공허를 닫으리라.”</i> 무명은 한때 어머니의 동료였다.',
    choices: [{ t: '왕의 심장과 기억을 받는다', ok: { item: ['memory_ash', 'ashenheart'], gold: 320, xp: 600, quest: ['waste', 3], log: '재의 왕을 쉬게 하고 무명의 과거를 알았다' } }] },

  sky_boss: { title: '공허의 군주 무명', text: '옥좌가 무너지며 별 없는 밤이 하늘을 덮는다.',
    choices: [{ t: '다섯 바람이여, 마지막으로!', ok: { text: '청령화의 다섯 꽃잎이 몸을 감싼다. (체력·마나 회복)', hp: 999, mp: 999, fight: 'voidlord', weakFlag: 'sky_weak', noFlee: true, win: { go: 'sky_end' } } }] },
  sky_end: { title: '청령화', text: S => S.flags.true_path
    ? `무명이 별 없는 밤처럼 흩어지다 멈춘다. 그 안에서 지친 노학자의 얼굴이 떠오른다. “…아리엔… 미안하다….” 엘렌디르는 그렇게 이름을 되찾고 바람 속으로 사라진다.<br><br>결정이 부서지고, 은발의 여인이 눈을 뜬다. 어머니 아리엔이 떨리는 손으로 당신의 뺨을 감싼다. “…많이 컸구나.”<br><br>두 사람이 함께 마른 청령화를 들자, 다섯 빛깔의 바람이 모여든다. 금빛, 초록, 주홍, 연분홍, 서리빛 꽃잎 사이로 푸른 종 모양의 꽃이 피어난다. 종소리가 대륙 끝까지 울리고, 하늘에 별이 하나둘 돌아온다.<br><br><b>진 결말 — 바람의 자장가.</b> <b>${esc(S.name)}</b>의 유람은 ${S.day}일, 레벨 ${S.lvl}로 마무리되었다. 어머니와 함께 걷는 길은 이제 시작이다.`
    : `무명이 별 없는 밤처럼 흩어진다. 결정 속의 여인은 깨어나지 않지만, 그녀의 입가에 희미한 미소가 떠오른 것 같았다.<br><br>마른 청령화 위로 다섯 바람이 모여 푸른 종 모양의 꽃이 피어난다. 종소리가 울리자 하늘에 별이 돌아온다. 어디선가 목소리가 들린다. <i>잘 왔구나.</i><br><br><b>결말 — 다섯 바람의 유랑자.</b> <b>${esc(S.name)}</b>의 유람은 ${S.day}일, 레벨 ${S.lvl}로 마무리되었다.<br><span class="muted">기억 조각 세 개를 모두 모으면 다른 결말을 볼 수 있다. (결정 속의 어머니는 아직 기다리고 있다)</span>`,
    choices: [{ t: '— 끝. 그리고 계속되는 여행 —', ok: { quest: ['sky', 3], log: '청령화를 피워 냈다', fn: S => { S.ended = true; S.flags[S.flags.true_path ? 'true_end' : 'normal_end'] = true; } } }] }
});

/* 메인 이야기 줄기 등록 */
const MAINS = {
  central: { region: 'central', name: QUEST_NAMES.central, hints: QUEST_HINTS.central, scenes: QUESTS.central },
  west: { region: 'west', name: QUEST_NAMES.west, hints: QUEST_HINTS.west, scenes: QUESTS.west },
  south: { region: 'south', name: QUEST_NAMES.south, hints: QUEST_HINTS.south, scenes: QUESTS.south },
  east: { region: 'east', name: QUEST_NAMES.east, hints: QUEST_HINTS.east, scenes: QUESTS.east },
  north: { region: 'north', name: QUEST_NAMES.north, hints: QUEST_HINTS.north, scenes: QUESTS.north },
  royal: { region: 'central', part: '중앙 2부', name: '왕도의 그림자', scenes: QUESTS2.royal, unlock: S => S.quest.central >= 3 && S.seals.length >= 2, lockText: '중앙 이야기를 마치고 인장 2개를 모으면 열린다',
    hints: ['습격당한 기사단장을 돕자', '지하 감옥의 증인을 만나자', '은사자 홀의 배신자와 마주하자'] },
  archi: { region: 'archi', name: '심해의 종', scenes: QUESTS2.archi, hints: ['등대섬 촌장 나엘을 만나자', '산호 미궁을 지나자', '심연의 둥지로'] },
  waste: { region: 'waste', name: '재의 왕관', scenes: QUESTS2.waste, hints: ['재의 요새 성주 이네스를 만나자', '무너진 천문탑을 조사하자', '재의 옥좌로'] },
  final: { region: 'central', part: '최종장 1부', name: QUEST_NAMES.final, scenes: QUESTS.final, unlock: S => S.seals.length >= 5, lockText: '다섯 지역의 인장을 모두 모으면 열린다', hints: ['왕도의 옛 천문탑으로'] },
  sky: { region: 'sky', part: '최종장 2부', name: '별 없는 하늘', scenes: QUESTS2.sky, unlock: S => S.quest.final >= 1, lockText: '최종장 1부를 마치면 열린다', hints: ['부서진 별 정원을 지나자', '별의 서고에서 기억을 비추자', '공허의 옥좌로'] }
};

/* ─────────────── 곁이야기 확장 ─────────────── */
const SIDE2 = {
  central2: [
    { title: '사라진 견습 기사', text: '기사단 훈련장의 교관이 머리를 감싼다. “견습 기사 토비가 옛 왕릉에 담력 시험을 하러 갔다가 돌아오지 않았어.”',
      choices: [
        { t: '왕릉으로 간다', check: ['int', 13], ok: { text: '왕릉 지도를 외워 지름길로 들어섰다. 안쪽에서 아이 울음소리가 들린다.', xp: 80, side: ['central2', 1] }, no: { text: '길을 헤매다 옛 기사의 망령과 마주쳤다!', fight: 'knightghost', win: { text: '망령이 쓰러지자 안쪽에서 울음소리가 들린다.', side: ['central2', 1] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '왕릉의 수호자', text: '관 뒤에 숨은 토비가 떨고 있다. 그 앞을 옛 기사의 망령이 막아선다. “…왕의 잠을… 깨운 자….”',
      choices: [
        { t: '토비 대신 사과한다', check: ['cha', 14], ok: { text: '망령이 고개를 끄덕이고 사라진다. 토비가 울며 매달린다. 교관이 감사의 표시로 룬석을 건넨다.', item: 'rune_might', gold: 60, xp: 120, side: ['central2', 3], log: '견습 기사 토비를 구했다' }, no: { text: '“용서는 없다!”', fight: 'knightghost', win: { text: '토비를 안고 왕릉을 빠져나왔다. 교관이 룬석을 건넨다.', item: 'rune_might', gold: 60, side: ['central2', 3], log: '견습 기사 토비를 구했다' } } },
        { t: '망령과 싸운다', ok: { fight: 'knightghost', win: { text: '토비를 안고 왕릉을 빠져나왔다. 교관이 룬석을 건넨다.', item: 'rune_might', gold: 60, side: ['central2', 3], log: '견습 기사 토비를 구했다' } } }
      ] }
  ],
  west2: [
    { title: '엘프 무덤의 노래', text: '숲 깊은 곳 이끼 낀 무덤에서 밤마다 노래가 들린다. 리오라가 말한다. “옛 숲의 가인 셀린의 무덤이에요. 노래가 끝나지 않으면 영혼이 떠나지 못한대요.”',
      choices: [
        { t: '노래의 마지막 구절을 찾는다', check: ['int', 14], ok: { text: '무덤 비석의 고대 문자에 마지막 구절이 숨어 있었다.', xp: 100, flag: 'w2_verse', side: ['west2', 1] }, no: { text: '구절을 찾지 못했다. 무덤 안으로 들어가 본다.', side: ['west2', 1] } }
      ] },
    { title: '끝나지 않는 노래', text: S => `무덤 안, 반투명한 엘프 가인이 같은 소절을 되풀이한다. 노래가 끝날 줄을 모른다.${S.flags.w2_verse ? ' (비석에서 찾은 마지막 구절이 떠오른다.)' : ''}`,
      choices: [
        { t: '마지막 구절을 함께 부른다', check: ['cha', 15], bonus: S => S.flags.w2_verse ? 4 : 0, ok: { text: '노래가 끝나자 가인이 미소 짓고 빛이 되어 사라진다. 무덤 위에 바람 룬과 지혜 룬이 남는다.', item: ['rune_wind', 'rune_wisdom'], xp: 160, side: ['west2', 3], log: '엘프 가인의 노래를 끝맺어 주었다' }, no: { text: '노래가 엇나가자 안개 망령들이 깨어난다!', fight: 'wisp', win: { text: '망령이 흩어진 뒤 가인이 조용히 노래를 끝맺었다. 룬석이 남았다.', item: ['rune_wind', 'rune_wisdom'], side: ['west2', 3], log: '엘프 가인의 노래를 끝맺어 주었다' } } }
      ] }
  ],
  south2: [
    { title: '사하렌 검투장', text: '사하렌 검투장 앞에 방이 붙었다. 「도전자 모집 — 챔피언 라즈를 꺾는 자에게 금화 200과 홍옥 반지」',
      choices: [
        { t: '예선에 나선다', ok: { fight: 'gladiator', win: { text: '관중이 함성을 지른다. 결승 진출이다!', side: ['south2', 1] }, flee: { text: '기권했다.' } } }
      ] },
    { title: '결승: 챔피언 라즈', text: '모래판 한가운데 쌍칼을 든 거구의 챔피언 라즈가 웃는다. “쉰한 번째 제물이로군.”',
      choices: [
        { t: '관중을 내 편으로 만든다', check: ['cha', 15], ok: { text: '관중이 내 이름을 연호한다. 라즈가 흔들린다!', flag: 's2_crowd', go: 'arena_final' }, no: { text: '야유가 쏟아진다.', go: 'arena_final' } },
        { t: '바로 싸운다', ok: { go: 'arena_final' } }
      ] }
  ],
  east2: [
    { title: '백 년의 바둑', text: '산중 찻집의 노승이 말한다. “백 년 전 산신과 두던 바둑이 아직 끝나지 않았소. 산신은 지금 도깨비 모습으로 고갯마루에 산다오. 대신 마무리해 주겠소?”',
      choices: [
        { t: '고갯마루로 간다', ok: { text: '고갯마루 바위에 반쯤 둔 바둑판이 놓여 있다. 산도깨비가 나타나 팔짱을 낀다.', side: ['east2', 1] } }
      ] },
    { title: '산신의 수', text: '“백 년 동안 기다렸다! 이번엔 내가 이긴다!” 도깨비가 돌을 놓는다.',
      choices: [
        { t: '수읽기로 맞선다', check: ['int', 16], ok: { text: '마지막 한 수로 반집을 이겼다! 도깨비가 껄껄 웃으며 옥 머리장식과 룬을 내놓는다. “백 년 체증이 내려가는구나!”', item: ['jadecrown', 'rune_luck'], xp: 220, side: ['east2', 3], log: '산신과의 백 년 바둑을 끝냈다' }, no: { text: '“이겼다! 그럼 이제 씨름이다!”', fight: 'dokkaebi', win: { text: '도깨비가 웃으며 상품을 내놓는다.', item: ['jadecrown', 'rune_luck'], side: ['east2', 3], log: '산신과의 백 년 바둑을 끝냈다' } } }
      ] }
  ],
  north2: [
    { title: '마지막 사냥', text: '하르그림의 늙은 사냥꾼 비요른이 활을 닦는다. “눈이 그쳤으니 마지막으로 얼음 비룡을 사냥하고 싶어. 같이 가겠나? 이제 혼자선 무리거든.”',
      choices: [
        { t: '함께 떠난다', check: ['con', 15], ok: { text: '오로라 아래 사흘을 걸어 비룡의 둥지를 찾았다.', xp: 150, side: ['north2', 1] }, no: { text: '혹한에 고생하며 둥지에 닿았다.', hp: '-2d6', side: ['north2', 1] } }
      ] },
    { title: '오로라 아래의 비룡', text: '얼음 둥지 위로 비룡이 날개를 편다. 비요른이 떨리는 손으로 화살을 메긴다. “…내가 미끼가 되지. 마지막 한 발은 네가 쏴.”',
      choices: [
        { t: '비요른을 지키며 싸운다', ok: { fight: 'icewyrm', win: { text: '비룡이 쓰러지자 비요른이 하늘을 보며 웃는다. “좋은 사냥이었어.” 그가 평생 아낀 룬 두 개를 건넨다.', item: ['rune_ward', 'rune_thorn'], gold: 100, xp: 150, side: ['north2', 3], log: '노사냥꾼 비요른의 마지막 사냥을 함께했다' } } }
      ] }
  ],
  archi2: [
    { title: '보물섬 지도', text: '선술집에서 외다리 선원이 지도를 흔든다. “해골섬의 보물! 반씩 나누자고!”',
      choices: [
        { t: '배를 빌려 해골섬으로', cost: 40, ok: { text: '해골 모양 바위섬에 닻을 내렸다. 동굴 입구가 보인다.', side: ['archi2', 1] } },
        { t: '지도가 진짜인지 따진다', check: ['int', 15], ok: { text: '진짜다. 선원이 감탄하며 배삯을 대신 낸다.', xp: 100, side: ['archi2', 1] }, no: { text: '판단이 서지 않는다. 일단 가 보자.', gold: -40, side: ['archi2', 1] } }
      ] },
    { title: '해골섬 동굴', text: '보물 상자 위에 거대한 게가 버티고 있다.',
      choices: [
        { t: '게를 처치한다', ok: { fight: 'reefcrab', win: { text: '상자 안에는 금화와 공허의 파편, 그리고 별 룬이 있었다!', item: ['voidshard', 'rune_edge'], gold: 220, xp: 150, side: ['archi2', 3], log: '해골섬의 보물을 찾았다' } } },
        { t: '몰래 상자만 연다', check: ['dex', 17], ok: { text: '게가 잠든 틈에 상자를 열었다!', item: ['voidshard', 'rune_edge'], gold: 220, xp: 200, side: ['archi2', 3], log: '해골섬의 보물을 찾았다' }, no: { text: '게가 깨어났다!', fight: 'reefcrab', win: { item: ['voidshard', 'rune_edge'], gold: 220, side: ['archi2', 3], log: '해골섬의 보물을 찾았다' } } }
      ] }
  ],
  waste2: [
    { title: '재 속의 대장장이', text: '요새 대장간 구석에서 반쯤 투명한 대장장이 혼령이 망치질을 한다. “…불이 모자라… 잿불 사냥개의 심장 불씨만 있으면 마지막 룬을 새길 수 있는데….”',
      choices: [
        { t: '불씨를 구해 온다', ok: { fight: 'cinderhound', win: { text: '사냥개의 가슴에서 꺼지지 않는 불씨를 꺼냈다.', side: ['waste2', 1] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '마지막 룬', text: '혼령이 불씨를 화로에 넣자 대장간이 백 년 만에 붉게 타오른다. “…고맙다. 내가 새긴 마지막 룬이다. 조심해서 다뤄.”',
      choices: [
        { t: '룬을 받는다', ok: { text: '혼령이 미소 지으며 불꽃 속으로 사라진다.', item: ['rune_void', 'rune_fire', 'rune_fire'], xp: 200, side: ['waste2', 3], log: '대장장이 혼령의 마지막 룬을 받았다' } }
      ] }
  ]
};
Object.assign(SCENES, {
  arena_final: { title: '챔피언 라즈', text: '징이 울린다.',
    choices: [{ t: '싸운다!', ok: { fight: 'champion', weakFlag: 's2_crowd', noFlee: true, win: { text: '모래판이 함성으로 뒤덮인다. 새 챔피언의 탄생이다!', item: 'rubyring', gold: 200, xp: 150, side: ['south2', 3], log: '사하렌 검투장의 챔피언이 되었다' } } }] }
});

/* 곁이야기 등록: 기존 5개 + 새 7개 */
const SIDEQ = {};
for (const r of ['central', 'west', 'south', 'east', 'north']) {
  SIDEQ[r] = { region: r, name: SIDE_NAMES[r], hints: SIDE_HINTS[r], scenes: SIDE[r], unlock: S => S.quest[r] >= 1, lockText: '지역 이야기 1장을 마치면 열린다' };
}
Object.assign(SIDEQ, {
  central2: { region: 'central', name: '사라진 견습 기사', scenes: SIDE2.central2, hints: ['훈련장 교관의 부탁', '왕릉에서 토비를 구하자'], unlock: S => S.seals.length >= 1, lockText: '인장 1개 이상' },
  west2: { region: 'west', name: '엘프 무덤의 노래', scenes: SIDE2.west2, hints: ['노래의 마지막 구절을 찾자', '가인의 노래를 끝맺자'], unlock: S => S.quest.west >= 2, lockText: '서부 이야기 2장 이후' },
  south2: { region: 'south', name: '사하렌 검투장', scenes: SIDE2.south2, hints: ['예선을 통과하자', '챔피언 라즈와 결승'], unlock: S => S.lvl >= 4, lockText: '레벨 4 이상' },
  east2: { region: 'east', name: '백 년의 바둑', scenes: SIDE2.east2, hints: ['노승의 부탁', '산신과의 대국'], unlock: S => S.quest.east >= 1, lockText: '동부 이야기 1장 이후' },
  north2: { region: 'north', name: '마지막 사냥', scenes: SIDE2.north2, hints: ['노사냥꾼 비요른과 떠나자', '얼음 비룡 사냥'], unlock: S => S.quest.north >= 1, lockText: '북부 이야기 1장 이후' },
  archi2: { region: 'archi', name: '해골섬의 보물', scenes: SIDE2.archi2, hints: ['외다리 선원의 지도', '해골섬 동굴'], unlock: () => true },
  waste2: { region: 'waste', name: '재 속의 대장장이', scenes: SIDE2.waste2, hints: ['잿불 사냥개의 불씨를 구하자', '마지막 룬'], unlock: () => true }
});
