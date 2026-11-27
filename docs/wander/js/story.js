'use strict';
/* 은빛 유랑기 — 대륙 에이렌의 다섯 지역, 탐험 사건, 지역 이야기(메인 퀘스트), 길 위 사건
   사건 형식: { id, title, once, text, choices: [{ t, check:[능력치, DC], ok, no, req(S), reqText, cost }] }
   결과 형식은 engine.js G.apply 참고. go: 다음 장면, fight: 전투 */

const REGIONS = {
  central: {
    name: '중앙', land: '아르센 평원', town: '왕도 루멘하르트', icon: '👑', color: '#C9973B', lv: '1~3',
    inn: 8, x: 50, y: 50,
    desc: '끝없는 밀밭 한가운데, 하얀 성벽의 왕도 루멘하르트가 서 있다. 대륙의 모든 길은 이 성문 앞에서 만난다.',
    enemies: ['dogs', 'bandit', 'shade', 'sewerrat'],
    shop: ['potion', 'hipotion', 'ether', 'antidote', 'ration', 'bomb', 'longsword', 'huntbow', 'rapier', 'oakstaff', 'greatsword', 'starstaff', 'leather', 'chain', 'luckcoin'],
    rumors: [
      '“대성당의 새벽 등불이 꺼진 뒤로 밤마다 성벽 밖 개들이 더 사납게 짖어.”',
      '“북부 하르그림은 한여름에도 눈이 그치지 않는다더군. 두꺼운 망토 없이 갔다간 얼어 죽지.”',
      '“남부 사하렌으로 가는 대상들이 줄줄이 사라졌대. 모래 속에 뭔가 있다는 소문이야.”',
      '“서부 숲 사람들은 나무랑 이야기를 한다더라. 엘름우드 고목이 병들었다는 얘기도 들었고.”',
      '“동부 연화성 쪽은 요즘 땅이 자꾸 흔들린대. 산의 용이 화가 났다나.”',
      '“처음 길을 떠난다면 서부부터 가 봐. 중앙 다음으로 덜 험하니까.”'
    ]
  },
  west: {
    name: '서부', land: '속삭임 숲', town: '숲마을 엘름우드', icon: '🌲', color: '#5E9A6B', lv: '2~4',
    inn: 10, x: 16, y: 50,
    desc: '하늘을 가린 고목들 사이로 안개가 흐른다. 나무 위에 지은 마을 엘름우드에서는 바람 소리가 노래처럼 들린다.',
    enemies: ['thornwolf', 'wisp', 'mossgolem'],
    shop: ['potion', 'hipotion', 'ether', 'antidote', 'ration', 'elmbow', 'elfsilk', 'bellcharm'],
    rumors: [
      '“세이렌나무의 잎이 검게 물들고 있어. 숲지기 리오라가 밤새 뿌리 곁을 지킨대.”',
      '“안개 습지의 망령은 노래를 들으면 잠잠해진다고, 할머니가 그러셨어.”',
      '“가시덩굴 늑대는 불을 싫어해. 화염병 하나쯤 챙겨 가.”',
      '“숲의 장인이 깎은 장궁은 바람을 가른다지. 값이 좀 나가지만.”'
    ]
  },
  south: {
    name: '남부', land: '황금 사구와 산호 해안', town: '항구도시 사하렌', icon: '🏜️', color: '#D97757',
    lv: '3~5', inn: 12, x: 50, y: 85,
    desc: '붉은 사구가 바다와 맞닿는 곳. 흰 돛과 향신료 냄새로 가득한 항구도시 사하렌이 햇볕 아래 반짝인다.',
    enemies: ['scorpion', 'raider', 'mummy'],
    shop: ['potion', 'hipotion', 'ether', 'antidote', 'ration', 'bomb', 'scimitar', 'lute_blade', 'desertmail', 'ironring'],
    rumors: [
      '“사막 한가운데 태양의 무덤이 있어. 들어간 도굴꾼은 아무도 못 나왔지.”',
      '“모래 전갈의 독은 해독제 없으면 하루를 못 넘겨.”',
      '“한낮의 사막을 걸으려면 체질이 좋아야 해. 아니면 물이라도 넉넉히.”',
      '“해적 선장 마르셀라는 금화보다 이야기를 좋아한대. 재미있는 얘기를 들려주면 뭐든 알려 준다나.”'
    ]
  },
  east: {
    name: '동부', land: '청운 산맥', town: '산성도시 연화성', icon: '⛰️', color: '#C2668A',
    lv: '4~6', inn: 14, x: 84, y: 50,
    desc: '구름 위로 솟은 봉우리마다 붉은 기와 사원이 걸려 있다. 연꽃 연못을 품은 산성도시 연화성은 요즘 땅울림에 잠을 이루지 못한다.',
    enemies: ['ronin', 'foxwisp', 'guardian'],
    shop: ['potion', 'hipotion', 'ether', 'antidote', 'ration', 'elixir', 'jade_sword', 'jade_staff', 'lotusrobe', 'plate'],
    rumors: [
      '“산의 용맥이 끊겼대. 그래서 땅이 우는 거야.”',
      '“천 개 계단 위 사원에는 세 개의 문이 있어. 힘, 지혜, 마음. 하나만 골라 들어갈 수 있지.”',
      '“석룡 청운은 원래 이 산을 지키던 수호룡이었어. 싸우기보다 달래는 게 옳을지도 몰라.”',
      '“여우령은 홀린 사람의 기운을 빨아먹어. 정신 단단히 차려.”'
    ]
  },
  north: {
    name: '북부', land: '서리관 고원', town: '빙성 하르그림', icon: '❄️', color: '#5F8FBF',
    lv: '5~8', inn: 16, x: 50, y: 15,
    desc: '얼어붙은 호수 위로 푸른 오로라가 흐른다. 검은 돌로 쌓은 성채 하르그림은 그치지 않는 눈보라 속에서 종을 울린다.',
    enemies: ['frostwolf', 'icedead', 'yeti'],
    shop: ['potion', 'hipotion', 'ether', 'antidote', 'ration', 'elixir', 'frostbrand', 'frostbow', 'wolfcloak', 'plate'],
    rumors: [
      '“눈보라는 서리 거인 흐림달이 부르는 거야. 그 녀석 머리에 검은 왕관이 씌워진 뒤로 말이지.”',
      '“얼음 협곡은 체질이 약하면 반나절도 못 버텨.”',
      '“화염 마법은 북부 괴물들에게 특히 잘 듣지.”',
      '“성의 종이 세 번 울리면 문을 걸어 잠가. 늑대 떼가 온다는 뜻이니까.”'
    ]
  }
};

/* 지역 사이 길: 이동 일수 */
const ROUTES = {
  central: { west: 2, south: 3, east: 3, north: 3 },
  west: { central: 2, north: 4, south: 4 },
  south: { central: 3, west: 4, east: 4 },
  east: { central: 3, south: 4, north: 4 },
  north: { central: 3, west: 4, east: 4 }
};

/* ─────────────── 탐험 사건 ─────────────── */
const EXPLORE = {
  central: [
    { id: 'c_merchant', title: '부서진 수레', text: '밀밭 사이 길가에 바퀴가 빠진 수레가 기울어 있다. 늙은 상인이 땀을 흘리며 손을 흔든다.',
      choices: [
        { t: '수레를 들어 올린다', check: ['str', 11], ok: { text: '끙, 하고 수레를 들어 바퀴를 끼웠다. 상인이 고맙다며 물약을 쥐여 준다.', item: 'potion', xp: 15 }, no: { text: '허리가 삐끗했다. 결국 둘이서 한참을 낑낑댄 끝에 고쳤다.', hp: '-1d4', xp: 5 } },
        { t: '바퀴 축을 살펴 고친다', check: ['int', 11], ok: { text: '쐐기 하나만 빠져 있었다. 상인이 감탄하며 금화를 건넨다.', gold: 12, xp: 15 }, no: { text: '축을 만지작거리다 손만 더러워졌다.', time: 1 } },
        { t: '갈 길을 간다', ok: { text: '미안한 마음을 뒤로하고 걸음을 옮겼다.' } }
      ] },
    { id: 'c_dogs', title: '밤의 들개', text: '해가 기울자 덤불 너머에서 낮게 으르렁거리는 소리가 들린다.',
      choices: [
        { t: '맞서 싸운다', ok: { fight: 'dogs', win: { text: '들개들이 깨갱거리며 달아났다.' } } },
        { t: '횃불을 휘둘러 쫓는다', check: ['cha', 12], ok: { text: '기세에 눌린 들개들이 꼬리를 말고 물러났다.', xp: 20 }, no: { text: '들개들이 오히려 달려든다!', fight: 'dogs' } }
      ] },
    { id: 'c_bard', title: '광장의 시인', text: '왕도 광장에서 떠돌이 시인이 다섯 바람의 노래를 부른다. “다섯 바람이 한곳에 모이면 푸른 종꽃이 핀다네…”',
      choices: [
        { t: '노래에 대해 묻는다', check: ['cha', 10], ok: { text: '“청령화 말이오? 다섯 지역의 바람을 한 꽃잎씩 담아야 한다지. 지역마다 큰 재앙을 걷어 내면 바람이 답을 준다더군.”', xp: 20, flag: 'heard_song' }, no: { text: '시인은 노래만 부를 뿐 대답하지 않는다.' } },
        { t: '함께 연주한다', req: S => S.cls === 'bard', reqText: '음유시인', ok: { text: '두 사람의 화음에 군중이 모여들었다. 모자 가득 동전이 쌓인다.', gold: 25, xp: 25, flag: 'heard_song' } },
        { t: '동전을 던져 준다 (금화 2)', cost: 2, ok: { text: '시인이 윙크하며 마지막 소절을 불러 준다. 마음이 가벼워졌다.', mp: 3 } }
      ] },
    { id: 'c_bandits', title: '검문소의 강도', text: '버려진 검문소에 노상강도가 자리를 잡고 통행료를 뜯고 있다.',
      choices: [
        { t: '검을 뽑는다', ok: { fight: 'bandit', win: { text: '강도는 쓰러지고 빼앗긴 통행료 꾸러미가 남았다.', gold: [5, 15] } } },
        { t: '기사단을 사칭한다', check: ['cha', 13], ok: { text: '“왕도 기사단이다!” 강도가 혼비백산 달아났다.', xp: 25 }, no: { text: '“기사단이 그런 옷을 입고 다니냐?” 강도가 칼을 겨눈다.', fight: 'bandit' } },
        { t: '통행료를 낸다 (금화 5)', cost: 5, ok: { text: '강도가 비웃으며 길을 비켜 준다.' } }
      ] },
    { id: 'c_shrine', title: '들판의 작은 사당', text: '이름 모를 여신의 작은 돌 사당. 이끼 낀 제단 위에 시든 꽃이 놓여 있다.',
      choices: [
        { t: '기도한다', ok: { text: '바람이 머리카락을 쓸고 지나간다. 몸이 가벼워졌다.', hp: '1d6+2', mp: 3 } },
        { t: '제단 아래를 살핀다', check: ['dex', 12], ok: { text: '돌 틈에서 누군가 숨겨 둔 행운의 동전을 찾았다.', item: 'luckcoin', xp: 10, once: true }, no: { text: '손가락을 돌 틈에 찧었다.', hp: -2 } }
      ] },
    { id: 'c_rats', title: '창고의 쥐', text: '곡물 창고 주인이 울상이다. “쥐들이 낟알을 다 갉아먹어요. 지하에 왕쥐가 있다니까요!”',
      choices: [
        { t: '지하로 내려간다', ok: { fight: 'sewerrat', win: { text: '창고 주인이 연신 고개를 숙이며 사례를 한다.', gold: 15 } } },
        { t: '쥐덫을 설계해 준다', check: ['int', 12], ok: { text: '기발한 덫에 쥐들이 줄줄이 걸렸다.', gold: 10, xp: 25 }, no: { text: '덫에 걸린 건 내 소매였다.' } }
      ] }
  ],
  west: [
    { id: 'w_wolf', title: '가시덩굴 늑대', text: '덤불이 바스락거리더니 가시로 뒤덮인 늑대가 튀어나온다.',
      choices: [
        { t: '싸운다', ok: { fight: 'thornwolf' } },
        { t: '불씨를 던져 쫓는다', req: S => G.has('bomb'), reqText: '화염병', ok: { text: '화염병이 터지자 늑대가 비명을 지르며 달아났다.', take: 'bomb', xp: 40 } },
        { t: '나무 위로 피한다', check: ['dex', 13], ok: { text: '가지를 타고 늑대가 지칠 때까지 기다렸다.', xp: 20, time: 1 }, no: { text: '가지가 부러졌다!', hp: '-1d6', fight: 'thornwolf' } }
      ] },
    { id: 'w_fairy', title: '반딧불 고리', text: '버섯이 둥글게 자란 자리 위로 반딧불이 춤을 춘다. 작은 웃음소리가 들린다.',
      choices: [
        { t: '고리 안으로 들어간다', check: ['cha', 12], ok: { text: '작은 정령들이 머리카락에 꽃을 꽂아 준다. 마음이 맑아진다.', mp: 6, hp: '1d8', xp: 30 }, no: { text: '정령들이 장난으로 물건을 훔쳐 갔다!', gold: -8 } },
        { t: '정령 언어로 인사한다', req: S => S.cls === 'mage' || S.cls === 'ranger', reqText: '마법사·순찰자', ok: { text: '정령들이 반갑게 인사하며 청령화 부적을 선물한다.', item: 'bellcharm', xp: 30, once: true } },
        { t: '조용히 지나친다', ok: { text: '반딧불 불빛이 등 뒤에서 오래 따라왔다.' } }
      ] },
    { id: 'w_golem', title: '움직이는 바위', text: '쉬려고 앉은 바위가 꿈틀거린다. 이끼 골렘이 잠에서 깼다!',
      choices: [
        { t: '맞서 싸운다', ok: { fight: 'mossgolem', win: { text: '골렘이 무너진 자리에서 반짝이는 원석을 주웠다.', gold: [20, 35] } } },
        { t: '도망친다', check: ['dex', 12], ok: { text: '느린 골렘을 따돌렸다.' }, no: { text: '골렘의 주먹이 등을 스쳤다.', hp: '-1d8' } }
      ] },
    { id: 'w_hunter', title: '덫에 걸린 사냥꾼', text: '곰 덫에 다리가 낀 엘름우드 사냥꾼이 이를 악물고 있다.',
      choices: [
        { t: '덫을 푼다', check: ['dex', 12], ok: { text: '찰칵, 덫이 열렸다. 사냥꾼이 사냥한 고기를 나눠 준다.', rations: 3, xp: 30 }, no: { text: '덫이 다시 튀어 손을 긁었다. 그래도 겨우 풀어 주었다.', hp: '-1d4', rations: 2, xp: 15 } },
        { t: '덫을 힘으로 벌린다', check: ['str', 13], ok: { text: '강철 이빨을 맨손으로 벌렸다. 사냥꾼이 경외의 눈으로 본다.', rations: 3, xp: 30 }, no: { text: '역부족이다. 결국 도구를 찾아 오래 걸렸다.', time: 1, xp: 10 } }
      ] },
    { id: 'w_wisp', title: '안개 속 목소리', text: '안개 속에서 누군가 이름을 부른다. 돌아보면 아무도 없다.',
      choices: [
        { t: '목소리를 따라간다', ok: { fight: 'wisp' } },
        { t: '귀를 막고 버틴다', check: ['con', 12], ok: { text: '목소리가 멀어졌다.', xp: 20 }, no: { text: '머리가 어지럽다. 망령이 기운을 빨아갔다.', mp: -4, hp: -3 } }
      ] }
  ],
  south: [
    { id: 's_scorp', title: '모래 속 집게', text: '발밑의 모래가 꺼지며 거대한 집게가 솟아오른다!',
      choices: [
        { t: '싸운다', ok: { fight: 'scorpion' } },
        { t: '옆으로 몸을 날린다', check: ['dex', 13], ok: { text: '간발의 차로 피했다. 전갈은 다시 모래 속으로 사라졌다.', xp: 25 }, no: { text: '꼬리 끝이 어깨를 스쳤다.', hp: '-1d8', fight: 'scorpion' } }
      ] },
    { id: 's_oasis', title: '신기루', text: '지평선에 야자수와 맑은 물이 아른거린다.',
      choices: [
        { t: '오아시스로 향한다', check: ['int', 12], ok: { text: '태양의 각도로 보아 진짜다! 시원한 물로 몸을 씻었다.', hp: '2d6', mp: 4, xp: 20 }, no: { text: '걸어도 걸어도 멀어지기만 한다. 신기루였다.', hp: '-1d6', time: 1 } },
        { t: '체력을 아끼며 그늘에서 쉰다', check: ['con', 11], ok: { text: '해가 질 때까지 버텼다.', time: 1 }, no: { text: '열기에 정신이 아찔하다.', hp: '-1d4', time: 1 } }
      ] },
    { id: 's_pirate', title: '항구의 해적 선장', text: '선술집 구석, 붉은 모자의 해적 선장 마르셀라가 술잔을 흔든다. “여행자, 재미있는 이야기 하나 있나?”',
      choices: [
        { t: '여행담을 들려준다', check: ['cha', 13], ok: { text: '마르셀라가 배를 잡고 웃는다. “좋아! 이건 선물이야.” 그녀가 낡은 지도를 던진다.', item: 'oldmap', xp: 30, once: true, flag: 'marcela' }, no: { text: '“지루하군.” 마르셀라가 하품을 한다.' } },
        { t: '팔씨름을 청한다', check: ['str', 14], ok: { text: '선원들이 환호한다. 판돈을 모두 챙겼다!', gold: 40, xp: 25 }, no: { text: '팔이 꺾였다. 판돈을 잃었다.', gold: -10 } }
      ] },
    { id: 's_raider', title: '모래폭풍 속 약탈자', text: '모래폭풍을 뚫고 약탈자들이 말을 몰아온다.',
      choices: [
        { t: '맞선다', ok: { fight: 'raider', win: { text: '약탈자의 안장주머니에서 물자를 챙겼다.', rations: 2 } } },
        { t: '모래언덕 뒤에 숨는다', check: ['dex', 13], ok: { text: '약탈자들이 그냥 지나갔다.', xp: 25 }, no: { text: '들켰다!', fight: 'raider' } }
      ] },
    { id: 's_market', title: '향신료 시장', text: '사하렌 시장에서 상인들이 목청을 높인다. 이국의 물건들이 눈을 사로잡는다.',
      choices: [
        { t: '흥정해서 물약을 산다 (금화 20)', cost: 20, check: ['cha', 12], ok: { text: '반값에 두 병을 샀다!', item: ['potion', 'potion'], gold: 10 }, no: { text: '제값을 다 주고 한 병을 샀다.', item: 'potion' } },
        { t: '수상한 점술가에게 간다', ok: { text: '“너의 꽃은 다섯 바람이 만나야 피어난다. 그리고… 이름 없는 자를 조심해.”', xp: 15, flag: 'fortune' } }
      ] }
  ],
  east: [
    { id: 'e_ronin', title: '다리 위의 무사', text: '흔들다리 한가운데 떠돌이 무사가 칼을 짚고 서 있다. “지나가려면 실력을 보여라.”',
      choices: [
        { t: '결투를 받아들인다', ok: { fight: 'ronin', win: { text: '무사가 무릎을 꿇는다. “훌륭한 솜씨.” 그가 노잣돈을 건넨다.', gold: 20 } } },
        { t: '선문답으로 응한다', check: ['int', 14], ok: { text: '“칼이 아니라 길을 묻는구나.” 무사가 웃으며 길을 비켰다.', xp: 50 }, no: { text: '“말장난은 됐다!” 무사가 칼을 뽑는다.', fight: 'ronin' } }
      ] },
    { id: 'e_fox', title: '푸른 불 여우', text: '대나무 숲에서 꼬리마다 푸른 불을 단 여우가 고개를 갸웃한다.',
      choices: [
        { t: '베어 낸다', ok: { fight: 'foxwisp' } },
        { t: '유부를 건넨다 (식량 1)', req: S => G.has('ration'), reqText: '여행 식량', ok: { text: '여우가 식량을 물고 사라지며 꼬리 하나를 남겼다. 꼬리가 마나 물약으로 변했다.', take: 'ration', item: 'ether', xp: 30 } },
        { t: '정신을 다잡는다', check: ['con', 14], ok: { text: '홀림을 떨쳐 냈다. 여우가 흥미를 잃고 사라졌다.', xp: 35 }, no: { text: '정신이 몽롱하다…', mp: -5, fight: 'foxwisp' } }
      ] },
    { id: 'e_tea', title: '산중 찻집', text: '구름 사이 찻집에서 노승이 차를 따른다. “쉬어 가시게.”',
      choices: [
        { t: '차를 마신다 (금화 5)', cost: 5, ok: { text: '향긋한 차가 온몸을 데운다.', hp: '3d6', mp: 8 } },
        { t: '노승과 바둑을 둔다', check: ['int', 15], ok: { text: '“허허, 졌구먼.” 노승이 청령 영약을 내민다.', item: 'elixir', xp: 50, once: true }, no: { text: '완패했다. 노승이 껄껄 웃는다.', xp: 10 } }
      ] },
    { id: 'e_quake', title: '땅울림', text: '산이 울부짖듯 땅이 흔들리고 머리 위로 바위가 쏟아진다!',
      choices: [
        { t: '바위를 피해 달린다', check: ['dex', 14], ok: { text: '먼지 속을 뚫고 빠져나왔다.', xp: 30 }, no: { text: '돌에 맞았다.', hp: '-2d6' } },
        { t: '바위를 막아 낸다', check: ['str', 15], ok: { text: '떨어지는 바위를 어깨로 받아 넘겼다. 길 가던 아이가 무사하다.', xp: 50, gold: 15 }, no: { text: '바위에 짓눌릴 뻔했다.', hp: '-2d8' } }
      ] },
    { id: 'e_statue', title: '부서진 석상', text: '길가의 돌 사자상이 눈을 번뜩이며 일어선다.',
      choices: [
        { t: '맞선다', ok: { fight: 'guardian', win: { text: '부서진 석상 안에서 오래된 공양물을 찾았다.', gold: [30, 50] } } },
        { t: '고대 주문을 읽는다', check: ['int', 15], ok: { text: '받침돌에 새겨진 주문을 외자 석상이 다시 잠들었다.', xp: 60 }, no: { text: '주문이 틀렸다!', fight: 'guardian' } }
      ] }
  ],
  north: [
    { id: 'n_wolves', title: '서리 늑대 떼', text: '눈보라 사이로 푸른 눈동자가 하나, 둘… 늑대 떼다.',
      choices: [
        { t: '싸운다', ok: { fight: 'frostwolf' } },
        { t: '불을 피워 버틴다', check: ['int', 14], ok: { text: '젖은 나무로도 불을 살려 냈다. 늑대들이 다가오지 못한다.', xp: 50, time: 1 }, no: { text: '불이 꺼졌다!', fight: 'frostwolf' } }
      ] },
    { id: 'n_cold', title: '혹한', text: '눈보라가 거세진다. 손끝의 감각이 사라져 간다.',
      choices: [
        { t: '이를 악물고 걷는다', check: ['con', 14], ok: { text: '얼어붙은 길을 견뎌 냈다.', xp: 40 }, no: { text: '동상이 생겼다.', hp: '-2d6' } },
        { t: '눈 동굴을 판다', check: ['str', 13], ok: { text: '눈 동굴 안은 의외로 따뜻했다.', hp: '1d8', time: 1, xp: 30 }, no: { text: '동굴이 무너졌다.', hp: '-1d8', time: 1 } }
      ] },
    { id: 'n_dead', title: '얼음 속 병사', text: '호수 얼음 아래, 갑옷 입은 병사가 눈을 뜨고 있다. 얼음이 갈라진다.',
      choices: [
        { t: '맞선다', ok: { fight: 'icedead' } },
        { t: '안식의 기도를 한다', check: ['cha', 15], ok: { text: '병사의 눈이 감긴다. 얼음 위에 그의 금화 주머니가 떠올랐다.', gold: 40, xp: 60 }, no: { text: '병사가 얼음을 깨고 나온다!', fight: 'icedead' } }
      ] },
    { id: 'n_hunter', title: '북부의 사냥꾼', text: '털가죽을 두른 사냥꾼이 모닥불 옆자리를 내준다. “설인을 쫓고 있어. 같이 가겠나?”',
      choices: [
        { t: '함께 사냥한다', ok: { fight: 'yeti', win: { text: '사냥꾼이 설인 가죽값을 나눠 준다.', gold: 50, rations: 3 } } },
        { t: '불만 쬐고 간다', ok: { text: '따뜻한 고기 수프를 얻어먹었다.', hp: '2d6', rations: 1 } }
      ] },
    { id: 'n_aurora', title: '오로라 아래에서', text: '눈보라가 잠시 걷히고 하늘에 푸른 오로라가 흐른다. 품속의 청령화가 희미하게 빛난다.',
      choices: [
        { t: '오로라를 바라본다', ok: { text: '마음 깊은 곳이 고요해진다. 어머니의 목소리가 들린 것 같았다.', mp: 99, hp: '2d8', xp: 30 } }
      ] }
  ]
};

/* ─────────────── 길 위 사건 ─────────────── */
const ROAD = [
  { id: 'r_quiet', text: '바람이 순하고 하늘이 맑다. 아무 일 없이 길을 걸었다.', choices: [{ t: '계속 간다', ok: { text: '발걸음이 가볍다.' } }] },
  { id: 'r_peddler', text: '방랑 행상이 짐을 풀어놓는다. “물약 싸게 드려요, 둘에 25!”',
    choices: [
      { t: '산다 (금화 25)', cost: 25, ok: { item: ['potion', 'potion'] } },
      { t: '지나친다', ok: { text: '행상이 아쉬운 듯 손을 흔든다.' } }
    ] },
  { id: 'r_ambush', text: '길가 덤불에서 도적들이 뛰쳐나온다!',
    choices: [
      { t: '싸운다', ok: { fightLv: true } },
      { t: '먼저 알아채고 피한다', check: ['dex', 12], ok: { text: '도적들을 따돌렸다.', xp: 20 }, no: { text: '포위당했다!', fightLv: true } }
    ] },
  { id: 'r_pilgrim', text: '청령화를 찾는다는 늙은 순례자를 만났다. “젊은이도 그 꽃을 찾는구먼. 바람을 따라가게.”',
    choices: [{ t: '함께 밤을 보낸다', ok: { text: '순례자가 나눠 준 차를 마시고 푹 잤다.', hp: '2d6', mp: 4, xp: 10 } }] },
  { id: 'r_river', text: '불어난 강이 길을 끊었다.',
    choices: [
      { t: '헤엄쳐 건넌다', check: ['str', 12], ok: { text: '물살을 가르고 건넜다.', xp: 15 }, no: { text: '떠내려가다 겨우 기어 나왔다. 짐이 젖었다.', hp: '-1d6', rations: -1 } },
      { t: '돌아간다 (반나절)', ok: { text: '먼 길로 돌아갔다.', time: 2 } }
    ] },
  { id: 'r_cart', text: '같은 방향으로 가는 짐마차를 만났다. 마부가 타라고 손짓한다.',
    choices: [
      { t: '얻어 탄다', ok: { text: '덜컹거리는 짐칸에서 편히 쉬었다.', hp: '1d8', mp: 2 } },
      { t: '마부에게 노래를 불러 준다', req: S => S.cls === 'bard', reqText: '음유시인', ok: { text: '마부가 기분이 좋아져 식량을 나눠 준다.', rations: 2, hp: '1d8' } }
    ] }
];
