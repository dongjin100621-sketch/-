'use strict';
/* 은빛 유랑기 — 추가 콘텐츠: 적·아이템, 지역별 탐험 사건, 길 위 사건, 지역 곁이야기(사이드 퀘스트)
   story.js / quests.js 다음에 불러와 기존 표에 더한다. */

/* ── 새 적 ── */
Object.assign(ENEMIES, {
  knightghost: { name: '옛 기사의 망령', hp: 22, ac: 14, hit: 4, dmg: '1d8+2', xp: 60, gold: [5, 15], sp: ['undead'], desc: '녹슨 갑옷 속에 푸른 불꽃만 남은 기사.' },
  sporeling:   { name: '포자 덩굴', hp: 24, ac: 12, hit: 4, dmg: '1d8+1', xp: 60, gold: [0, 6], sp: ['plant', 'poison'], desc: '숨 쉴 때마다 노란 포자를 뿜는 덩굴 덩어리.' },
  harpy:       { name: '절벽 하피', hp: 26, ac: 14, hit: 5, dmg: '1d8+2', xp: 75, gold: [5, 18], sp: ['multi'], desc: '해안 절벽에 둥지를 튼 날개 달린 약탈자.' },
  dokkaebi:    { name: '산도깨비', hp: 36, ac: 15, hit: 6, dmg: '1d10+3', xp: 105, gold: [15, 40], sp: ['heavy'], desc: '방망이를 든 외눈 도깨비. 내기를 좋아한다.' },
  icewyrm:     { name: '얼음 비룡', hp: 60, ac: 16, hit: 8, dmg: '2d8+3', xp: 190, gold: [20, 45], sp: ['ice', 'chill', 'heavy'], desc: '얼음 비늘을 두른 작은 용. 숨결이 칼날 같다.' },
  // 곁이야기 우두머리
  luteThief:   { name: '여우 가면 도둑', hp: 22, ac: 14, hit: 4, dmg: '1d8+1', xp: 90, gold: [20, 20], boss: true, sp: ['multi'], desc: '시인의 류트를 훔친 날랜 도둑.' },
  rotstag:     { name: '병든 사슴왕', hp: 34, ac: 13, hit: 5, dmg: '1d8+2', xp: 160, gold: [0, 0], boss: true, sp: ['plant', 'regen'], desc: '뿔에 검은 이끼가 자란 숲의 옛 왕.' },
  drownedcap:  { name: '익사한 선장', hp: 55, ac: 15, hit: 6, dmg: '2d6+3', xp: 230, gold: [80, 80], boss: true, sp: ['undead', 'drain'], desc: '침몰선과 함께 가라앉은 선장의 망령.' },
  koiwraith:   { name: '흐려진 잉어 정령', hp: 64, ac: 15, hit: 7, dmg: '2d6+3', xp: 280, gold: [0, 0], boss: true, sp: ['drain', 'heavy'], desc: '탁해진 연못에서 일어난 거대한 잉어.' },
  forgeguard:  { name: '용광로 골렘', hp: 85, ac: 16, hit: 8, dmg: '2d8+3', xp: 360, gold: [40, 40], boss: true, sp: ['heavy', 'regen'], desc: '꺼진 대장간을 지키는 쇳덩이 거인.' }
});
REGIONS.central.enemies.push('knightghost');
REGIONS.west.enemies.push('sporeling');
REGIONS.south.enemies.push('harpy');
REGIONS.east.enemies.push('dokkaebi');
REGIONS.north.enemies.push('icewyrm');

/* ── 새 아이템 ── */
Object.assign(ITEMS, {
  herbtea:    { name: '숲 허브차', type: 'use', price: 12, use: { heal: '1d6+2', mp: 3 }, desc: '체력 1d6+2, 마나 3 회복' },
  smokebomb:  { name: '연막탄', type: 'use', price: 18, use: { flee: true }, combatOnly: true, desc: '전투에서 반드시 도망친다 (우두머리 제외)' },
  whetstone:  { name: '룬 숫돌', type: 'use', price: 30, use: { sharpen: 2 }, combatOnly: true, desc: '이번 전투 동안 피해 +2' },
  silverlute: { name: '은줄 류트', type: 'acc', price: 0, bonus: { cha: 1, mp: 4 }, desc: '시인의 감사. 매력 +1, 마나 +4' },
  windfeather:{ name: '바람 깃털', type: 'acc', price: 0, bonus: { dex: 1, ac: 1 }, desc: '사슴왕의 깃털 장식. 민첩 +1, 방어도 +1' },
  tidering:   { name: '조류의 반지', type: 'acc', price: 0, bonus: { con: 1, hp: 8 }, desc: '침몰선의 보물. 체질 +1, 최대 체력 +8' },
  koipendant: { name: '잉어비늘 목걸이', type: 'acc', price: 0, bonus: { int: 1, mp: 6 }, desc: '정령의 비늘. 지능 +1, 마나 +6' },
  emberheart: { name: '잉걸불 심장', type: 'acc', price: 0, bonus: { str: 1, ac: 1, hp: 10 }, desc: '되살아난 용광로의 불씨. 힘 +1, 방어도 +1, 최대 체력 +10' },
  starchart:  { name: '별자리 지도', type: 'key', desc: '천문학자가 그린 다섯 지역의 별 지도' },
  fishscale:  { name: '금빛 잉어 비늘', type: 'key', desc: '연못 정령에게 돌려줄 비늘' },
  emberore:   { name: '잉걸 광석', type: 'key', desc: '식지 않는 붉은 광석' }
});
['central', 'west', 'south', 'east', 'north'].forEach(r => REGIONS[r].shop.splice(5, 0, 'smokebomb', 'whetstone'));
REGIONS.west.shop.splice(5, 0, 'herbtea');
REGIONS.east.shop.splice(5, 0, 'herbtea');

/* ── 탐험 사건 추가 ── */
EXPLORE.central.push(
  { id: 'c_knight', title: '폐허의 기사', text: '무너진 망루 아래에서 녹슨 갑옷이 삐걱이며 일어선다. 투구 속에 푸른 불꽃이 흔들린다. “…성은… 아직… 서 있는가….”',
    choices: [
      { t: '“왕도는 무사하다”고 답한다', check: ['cha', 12], ok: { text: '불꽃이 잦아들며 기사가 무릎을 꿇는다. 갑옷 틈에서 오래된 금화가 쏟아진다.', gold: 30, xp: 40 }, no: { text: '“거짓말!” 기사가 검을 든다.', fight: 'knightghost' } },
      { t: '검을 맞댄다', ok: { fight: 'knightghost', win: { text: '기사가 먼지로 흩어지며 마지막으로 경례한다.' } } }
    ] },
  { id: 'c_fair', title: '수확 축제', text: '밀밭 마을에 수확 축제가 열렸다. 씨름판, 사과 던지기, 노래 대회가 한창이다.',
    choices: [
      { t: '씨름판에 오른다', check: ['str', 13], ok: { text: '마을 장사를 넘어뜨렸다! 상품으로 밀빵 한 자루를 받았다.', rations: 4, xp: 30 }, no: { text: '모래판에 등을 대고 하늘을 봤다. 사람들이 웃으며 일으켜 준다.', hp: -2 } },
      { t: '사과 던지기를 한다', check: ['dex', 12], ok: { text: '과녁 정중앙! 상금을 받았다.', gold: 20, xp: 25 }, no: { text: '사과가 촌장 모자에 맞았다….' } },
      { t: '노래 대회에 나간다', check: ['cha', 13], ok: { text: '박수갈채 속에 꽃관을 썼다. 마음이 따뜻해진다.', mp: 99, gold: 15, xp: 30 }, no: { text: '음이 하나 나갔지만 다들 즐거워했다.', xp: 10 } }
    ] },
  { id: 'c_scholar', title: '왕립 도서관', text: '왕립 도서관 꼭대기 층, 늙은 천문학자가 별 지도를 펼쳐 놓고 한숨을 쉰다. “다섯 지역의 별이 한 줄로 서는 날이 머지않았는데….”',
    choices: [
      { t: '별 지도 계산을 돕는다', check: ['int', 13], ok: { text: '“바로 그거야!” 천문학자가 기뻐하며 별자리 지도를 나눠 준다. “길을 잃지 않을 걸세.”', item: 'starchart', xp: 50, once: true }, no: { text: '숫자가 머릿속에서 빙글빙글 돈다.', xp: 5 } },
      { t: '청령화 기록을 찾아본다', ok: { text: '먼지 쌓인 식물 도감에 청령화 그림이 있다. 가장자리에 낯익은 필체로 “다섯 바람”이라는 메모가… 어머니의 글씨다.', xp: 20, flag: 'mother_note' } }
    ] }
);
EXPLORE.west.push(
  { id: 'w_spore', title: '노란 안개', text: '숲 바닥에서 노란 포자가 피어오른다. 덩굴 덩어리가 꿈틀거린다.',
    choices: [
      { t: '숨을 참고 베어 낸다', check: ['con', 12], ok: { text: '포자를 견디며 덩굴의 심을 끊었다.', fight: 'sporeling' }, no: { text: '포자를 들이마셨다. 콜록!', hp: '-1d6', fight: 'sporeling' } },
      { t: '불을 놓는다', req: S => S.skills.includes('fireball') || G.has('bomb'), reqText: '화염구 또는 화염병', ok: { text: '불길이 덩굴을 삼켰다. 재 속에서 약초를 건졌다.', item: 'herbtea', xp: 45, fn: S => { if (!S.skills.includes('fireball')) G.take('bomb'); } } },
      { t: '돌아간다', ok: { text: '멀리 돌아갔다.', time: 1 } }
    ] },
  { id: 'w_elfruins', title: '이끼 덮인 석조 아치', text: '고목 사이에 이끼 덮인 석조 아치가 서 있다. 아치 안쪽 공기가 물결처럼 일렁인다.',
    choices: [
      { t: '아치 문자를 해독한다', check: ['int', 14], ok: { text: '“바람을 기억하는 자에게 쉼을.” 아치를 지나자 맑은 샘이 나왔다. 몸이 가벼워졌다.', hp: '3d6', mp: 8, xp: 50 }, no: { text: '아치가 웅웅 울리더니 처음 자리로 돌아왔다.', time: 1 } },
      { t: '그냥 지나간다', check: ['dex', 13], ok: { text: '일렁임 사이로 은화 몇 닢이 떨어져 있었다.', gold: 18, xp: 20 }, no: { text: '어지러움에 주저앉았다.', hp: '-1d4' } }
    ] },
  { id: 'w_owl', title: '수다쟁이 부엉이', text: '나뭇가지 위 커다란 부엉이가 고개를 180도 돌린다. “후우. 수수께끼 하나 풀면 비밀을 알려 주지.”',
    choices: [
      { t: '수수께끼를 듣는다', check: ['int', 12], ok: { text: '“밤에는 오고 낮에는 사라지는 것?” “별.” 부엉이가 숲속 보물 자리를 알려 준다.', gold: 25, item: 'potion', xp: 35 }, no: { text: '“후후, 틀렸어.” 부엉이가 날아가 버린다.' } },
      { t: '부엉이에게 노래를 불러 준다', check: ['cha', 13], ok: { text: '부엉이가 장단을 맞추다 반짝이는 깃털 하나를 떨군다. 마나가 차오른다.', mp: 8, xp: 30 }, no: { text: '부엉이가 귀를 막는 시늉을 한다.' } }
    ] }
);
EXPLORE.south.push(
  { id: 's_harpy', title: '절벽의 비명', text: '해안 절벽 위에서 날카로운 비명이 쏟아진다. 하피들이 짐꾼을 덮치고 있다!',
    choices: [
      { t: '짐꾼을 구한다', ok: { fight: 'harpy', win: { text: '짐꾼이 고맙다며 실어 나르던 물약을 나눠 준다.', item: ['potion', 'ether'] } } },
      { t: '돌을 던져 둥지를 떨어뜨린다', check: ['dex', 14], ok: { text: '둥지가 바다로 떨어지자 하피들이 허둥지둥 쫓아간다. 짐꾼이 무사하다.', gold: 20, xp: 50 }, no: { text: '빗나갔다. 하피가 이쪽을 노린다!', fight: 'harpy' } }
    ] },
  { id: 's_ruins', title: '바람에 드러난 유적', text: '밤새 모래폭풍이 지나간 자리에 고대 도시의 지붕이 드러났다.',
    choices: [
      { t: '유적 안으로 내려간다', check: ['dex', 13], ok: { text: '함정을 피해 보물 방에 닿았다. 금 장신구가 가득하다!', gold: 55, xp: 50 }, no: { text: '바닥이 꺼졌다! 간신히 기어 나왔다.', hp: '-2d6', gold: 10 } },
      { t: '벽화를 연구한다', check: ['int', 13], ok: { text: '벽화 속 모래벌레가 이마에 검은 쐐기를 단 모습이다. 누군가 오래전부터 재앙을 심었다.', xp: 60, flag: 's_mural' }, no: { text: '그림이 무엇을 뜻하는지 알 수 없다.' } }
    ] },
  { id: 's_pearl', title: '진주 잡이', text: '산호 해안의 아이들이 진주 잡이 내기를 한다. “여행자도 해 볼래요?”',
    choices: [
      { t: '깊이 잠수한다', check: ['con', 13], ok: { text: '숨을 오래 참고 커다란 진주를 건져 올렸다! 아이들이 환호한다.', gold: 45, xp: 40 }, no: { text: '물을 잔뜩 먹었다. 콜록콜록.', hp: '-1d4' } },
      { t: '아이들에게 바다 이야기를 들려준다', ok: { text: '아이들이 조개껍데기 목걸이를 걸어 준다. 기분이 좋아진다.', hp: '1d8', mp: 4 } }
    ] }
);
EXPLORE.east.push(
  { id: 'e_dokkaebi', title: '도깨비의 내기', text: '고갯마루에서 외눈 산도깨비가 방망이를 흔든다. “씨름이냐 수수께끼냐! 지면 가진 것 절반!”',
    choices: [
      { t: '씨름으로 붙는다', check: ['str', 15], ok: { text: '도깨비를 메다꽂았다! “허허, 졌다!” 도깨비가 금덩이를 내놓는다.', gold: 60, xp: 70 }, no: { text: '내동댕이쳐졌다. 도깨비가 금화를 챙겨 간다.', fn: S => { S.gold = Math.floor(S.gold * 0.75); }, hp: '-1d6' } },
      { t: '수수께끼로 붙는다', check: ['int', 15], ok: { text: '“다리 없이 산을 넘는 것은?” “구름.” 도깨비가 무릎을 친다. 방망이에서 물약이 쏟아진다.', item: ['hipotion', 'ether'], xp: 70 }, no: { text: '도깨비가 깔깔 웃으며 금화를 챙긴다.', fn: S => { S.gold = Math.floor(S.gold * 0.75); } } },
      { t: '방망이를 뺏으려 덤빈다', ok: { fight: 'dokkaebi' } }
    ] },
  { id: 'e_lanterns', title: '연등 강', text: '해 질 녘, 사람들이 소원을 적은 연등을 강물에 띄운다.',
    choices: [
      { t: '연등을 띄운다 (금화 3)', cost: 3, ok: { text: '“어머니를 만나게 해 주세요.” 연등이 강물 위에서 오래 빛났다. 이상하게 마음이 단단해진다.', mp: 99, hp: '2d6', xp: 25 } },
      { t: '연등 축제 일을 거든다', check: ['dex', 12], ok: { text: '연등 수백 개를 걸었다. 축제 주인이 품삯을 넉넉히 준다.', gold: 35, xp: 30 }, no: { text: '연등 하나를 태워 먹었다. 품삯이 깎였다.', gold: 10 } }
    ] },
  { id: 'e_hermit', title: '바위굴의 은자', text: '안개 속 바위굴에서 수염이 땅까지 닿은 은자가 눈을 뜬다. “검을 쥔 손이 떨리는구나.”',
    choices: [
      { t: '가르침을 청한다', check: ['con', 14], ok: { text: '하루 종일 폭포 아래 서 있었다. 몸 깊은 곳이 단단해졌다. (체질 +1)', fn: S => { S.st.con++; }, time: 2, xp: 60, once: true }, no: { text: '폭포에 휩쓸렸다. 은자가 혀를 찬다.', hp: '-1d8', time: 1 } },
      { t: '함께 차를 마신다', ok: { text: '말없이 차만 마셨다. 그것으로 충분했다.', hp: '2d6', mp: 6 } }
    ] }
);
EXPLORE.north.push(
  { id: 'n_wyrm', title: '얼음 비룡', text: '하늘에서 얼음 조각이 우박처럼 쏟아진다. 작은 얼음 비룡이 선회하며 내려온다!',
    choices: [
      { t: '맞선다', ok: { fight: 'icewyrm', win: { text: '비룡의 비늘을 팔면 좋은 값을 받겠다.', gold: 40 } } },
      { t: '바위 틈에 숨는다', check: ['dex', 15], ok: { text: '비룡이 포기하고 날아갔다.', xp: 50 }, no: { text: '숨결이 바위를 얼렸다!', hp: '-2d6', fight: 'icewyrm' } }
    ] },
  { id: 'n_hotspring', title: '눈 속의 온천', text: '김이 피어오르는 바위 웅덩이를 발견했다. 눈보라 속 온천이다.',
    choices: [
      { t: '몸을 담근다', ok: { text: '얼었던 손끝까지 피가 돈다. 이대로 잠들고 싶다.', hp: 99, mp: 6, time: 1 } },
      { t: '온천 바닥을 살핀다', check: ['int', 14], ok: { text: '온천물에 녹지 않는 붉은 광석이 반짝인다. 잉걸 광석이다!', item: 'emberore', xp: 40, once: true }, no: { text: '그냥 돌멩이뿐이다.' } }
    ] },
  { id: 'n_skald', title: '음유 전사의 노래', text: '하르그림 술집, 수염을 땋은 노전사가 옛 영웅의 노래를 부르다 술잔을 내민다. “노래로 겨뤄 보겠나?”',
    choices: [
      { t: '노래로 겨룬다', check: ['cha', 15], ok: { text: '술집이 떠나갈 듯 함성이 터졌다. 노전사가 자신의 전투 망토를 걸어 준다… 아니, 망토값을 대신 내 준다.', gold: 70, xp: 70 }, no: { text: '노전사가 껄껄 웃으며 술을 한 잔 더 시킨다.', hp: '1d6' } },
      { t: '팔씨름으로 겨룬다', check: ['str', 16], ok: { text: '탁자가 부서졌다! 북부 사람들이 존경의 눈빛을 보낸다.', gold: 50, xp: 70 }, no: { text: '팔이 저리다.', hp: -3 } }
    ] }
);

/* ── 길 위 사건 추가 ── */
ROAD.push(
  { id: 'r_storm', text: '갑자기 하늘이 어두워지며 폭풍우가 몰아친다.',
    choices: [
      { t: '근처 동굴로 피한다', check: ['int', 11], ok: { text: '마른 동굴에서 비를 피하며 쉬었다.', hp: '1d6' }, no: { text: '동굴인 줄 알았던 곳은 곰 굴이었다! 허둥지둥 빠져나왔다.', hp: '-1d6' } },
      { t: '비를 맞으며 강행한다', check: ['con', 12], ok: { text: '젖었지만 하루를 아꼈다.', xp: 15 }, no: { text: '감기에 걸렸다.', hp: '-1d6', mp: -2 } }
    ] },
  { id: 'r_star', text: '맑은 밤, 야영지에서 별을 올려다본다.',
    choices: [
      { t: '별자리 지도로 지름길을 찾는다', req: S => G.has('starchart'), reqText: '별자리 지도', ok: { text: '별을 따라 지름길로 들어섰다. 하루를 아꼈다.', fn: S => { S.day = Math.max(1, S.day - 1); }, xp: 20 } },
      { t: '일지를 펼쳐 본다', ok: { text: '어머니의 일지 한 구절: “길은 걷는 사람의 것이다.” 피로가 조금 풀린다.', mp: 4 } }
    ] },
  { id: 'r_wounded', text: '길가에 다친 순례자가 쓰러져 있다.',
    choices: [
      { t: '물약을 나눠 준다', req: S => G.has('potion'), reqText: '치유 물약', ok: { text: '순례자가 일어나 축복을 빌어 준다. “바람이 그대 편이기를.”', take: 'potion', xp: 40, gold: 10 } },
      { t: '상처를 돌본다', check: ['int', 12], ok: { text: '능숙하게 붕대를 감았다. 순례자가 말린 고기를 나눠 준다.', rations: 2, xp: 30 }, no: { text: '서툰 솜씨지만 마음은 전해졌다.', xp: 10 } },
      { t: '지나친다', ok: { text: '마음 한구석이 무겁다.' } }
    ] },
  { id: 'r_caravan', text: '거대한 대상 행렬과 길이 겹쳤다. 낙타 방울 소리가 끊이지 않는다.',
    choices: [
      { t: '대상과 함께 걷는다', ok: { text: '대상단의 모닥불 곁에서 따뜻한 밤을 보냈다. 상인들이 물건을 싸게 판다.', hp: '1d8', rations: 1 } },
      { t: '대상을 호위하고 품삯을 받는다', ok: { text: '밤중에 도적이 덮쳤다!', fightLv: true, win: { text: '대상단장이 넉넉한 품삯을 준다.', gold: 35 } } }
    ] }
);

/* ─────────────── 곁이야기 (지역 사이드 퀘스트) ───────────────
   S.side[지역] = 단계 (0~2 진행, 3 완료). 지역 이야기 1장 이후에 열린다. */
const SIDE_NAMES = { central: '도둑맞은 류트', west: '사슴왕의 뿔', south: '가라앉은 등대선', east: '연못의 금빛 잉어', north: '꺼진 용광로' };
const SIDE_HINTS = {
  central: ['광장 시인의 하소연을 듣자', '여우 가면 도둑의 흔적을 쫓자', '종탑 위 도둑과 마주하자'],
  west: ['사냥꾼 오두막을 찾아가자', '검은 이끼의 근원을 찾자', '병든 사슴왕을 쉬게 하자'],
  south: ['등대지기 노파의 부탁', '산호 동굴로 잠수하자', '침몰선의 선장과 마주하자'],
  east: ['연화성 연못이 흐려진 까닭', '금빛 비늘을 찾자', '연못 정령을 달래자'],
  north: ['꺼진 대장간의 늙은 대장장이', '식지 않는 불씨를 구하자', '용광로를 다시 지피자']
};
const SIDE = {
  central: [
    { title: '울먹이는 시인', text: '광장 분수대에 앉은 시인이 빈 류트 가방을 끌어안고 있다. “백 년 된 은줄 류트를 도둑맞았어요. 여우 가면을 쓴 놈이었어요….”',
      choices: [
        { t: '목격자를 찾아 광장을 돈다', check: ['cha', 12], ok: { text: '꽃 파는 소녀가 여우 가면이 종탑 쪽 골목으로 사라졌다고 알려 준다.', xp: 30, side: ['central', 1] }, no: { text: '아무도 보지 못했단다. 그래도 골목마다 발자국을 따라가 본다.', time: 1, side: ['central', 1] } },
        { t: '현장의 흔적을 읽는다', check: ['int', 12], ok: { text: '분수대 가장자리에 송진 가루가 묻어 있다. 류트 줄에 바르는 송진이다. 가루는 골목으로 이어진다.', xp: 30, side: ['central', 1] }, no: { text: '흔적이 너무 많다. 발로 뛰는 수밖에.', time: 1, side: ['central', 1] } }
      ] },
    { title: '지붕 위 추격', text: '골목 끝, 여우 가면이 지붕 위로 뛰어오른다. 손에 은빛 류트가 들려 있다!',
      choices: [
        { t: '지붕을 타고 쫓는다', check: ['dex', 13], ok: { text: '기왓장을 밟으며 따라붙었다. 도둑이 종탑으로 몰렸다.', xp: 40, side: ['central', 2] }, no: { text: '미끄러져 수레 위로 떨어졌다. 그래도 도둑이 종탑으로 들어가는 걸 봤다.', hp: '-1d6', side: ['central', 2] } },
        { t: '지름길로 앞질러 간다', check: ['int', 13], ok: { text: '골목 구조를 떠올려 종탑 입구를 먼저 막았다.', xp: 40, flag: 'sc_trap', side: ['central', 2] }, no: { text: '길을 잘못 들었다. 종탑으로 서둘러 간다.', side: ['central', 2] } }
      ] },
    { title: '종탑의 여우', text: S => `종탑 꼭대기. 여우 가면이 류트를 품에 안고 돌아선다.${S.flags.sc_trap ? ' 도망칠 길은 막혔다.' : ''} “이건 팔면 한 해를 먹고살 물건이라고!”`,
      choices: [
        { t: '“그 류트가 없으면 시인은 노래를 잃는다”', check: ['cha', 14], ok: { text: '가면 아래에서 앳된 얼굴이 드러난다. 소년이 류트를 내밀며 운다. “동생이 아파서….” 가진 금화로 약값을 쥐여 주었다.', gold: -10, xp: 80, go: 'side_central_end' }, no: { text: '“말로는 안 속아!”', fight: 'luteThief', win: { go: 'side_central_end' } } },
        { t: '붙잡는다', ok: { fight: 'luteThief', win: { go: 'side_central_end' } } }
      ] }
  ],
  west: [
    { title: '사냥꾼 오두막', text: '엘름우드 외곽 오두막의 늙은 사냥꾼 브란이 활을 손질한다. “숲의 왕, 흰 사슴이 병들었어. 뿔에 검은 이끼가 자라. 그대로 두면 숲의 짐승들이 다 미쳐 버릴 거야.”',
      choices: [
        { t: '사슴왕의 발자국을 쫓는다', check: ['dex', 13], ok: { text: '부러진 가지와 검은 이끼 조각을 따라 숲 깊은 곳으로 들어섰다.', xp: 50, side: ['west', 1] }, no: { text: '발자국을 놓쳤다가 하루를 헤매고야 다시 찾았다.', time: 2, side: ['west', 1] } }
      ] },
    { title: '검은 이끼 샘', text: '검은 이끼가 샘물 위를 뒤덮고 있다. 이끼 틈에서 포자 덩굴이 꿈틀거린다.',
      choices: [
        { t: '샘을 정화한다', check: ['int', 14], ok: { text: '이끼의 뿌리를 찾아 끊어 냈다. 샘물이 맑아진다. 사슴왕의 병도 약해졌을 것이다.', flag: 'sw_clean', xp: 60, side: ['west', 2] }, no: { text: '이끼가 다시 자라난다. 덩굴이 덮쳐 온다!', fight: 'sporeling', win: { text: '덩굴을 베어 냈지만 샘은 여전히 검다.', side: ['west', 2] }, flee: { text: '물러났다.' } } },
        { t: '덩굴을 베어 낸다', ok: { fight: 'sporeling', win: { text: '덩굴을 치웠다. 샘 너머로 사슴왕의 울음이 들린다.', side: ['west', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '흰 사슴왕', text: S => `달빛 공터. 거대한 흰 사슴이 검은 이끼에 뒤덮인 뿔을 흔들며 고통스럽게 운다.${S.flags.sw_clean ? ' 샘을 정화한 덕에 이끼가 조금 옅어져 있다.' : ''}`,
      choices: [
        { t: '노래로 사슴왕을 진정시킨다', check: ['cha', 15], bonus: S => S.flags.sw_clean ? 3 : 0, ok: { text: '사슴왕이 고개를 숙인다. 뿔의 이끼를 조심스레 걷어 냈다. 사슴이 깃털처럼 가벼운 장식 하나를 남기고 숲으로 사라진다.', go: 'side_west_end' }, no: { text: '사슴왕이 뿔을 겨누고 돌진한다!', fight: 'rotstag', weakFlag: 'sw_clean', win: { go: 'side_west_end' } } },
        { t: '이끼 낀 뿔을 꺾는다', ok: { fight: 'rotstag', weakFlag: 'sw_clean', win: { go: 'side_west_end' } } }
      ] }
  ],
  south: [
    { title: '등대지기 노파', text: '꺼진 등대 아래, 노파가 바다를 본다. “서른 해 전, 내 남편의 배가 산호 동굴 앞에서 가라앉았어. 밤마다 그 배에서 종소리가 들려. 그 사람을 쉬게 해 줄 수 있겠나?”',
      choices: [
        { t: '배가 가라앉은 자리를 묻는다', ok: { text: '노파가 낡은 해도를 내준다. 썰물 때만 동굴 입구가 드러난다고 한다.', side: ['south', 1] } }
      ] },
    { title: '산호 동굴', text: '썰물에 드러난 산호 동굴. 안쪽으로 갈수록 바닷물이 차오른다. 저 멀리 부서진 돛대가 보인다.',
      choices: [
        { t: '물속을 헤엄쳐 들어간다', check: ['con', 14], ok: { text: '숨을 참고 산호 사이를 지났다. 침몰선 갑판에 올라섰다.', xp: 70, side: ['south', 2] }, no: { text: '숨이 모자라 몇 번이나 되돌아 나왔다.', hp: '-2d4', side: ['south', 2] } },
        { t: '하피 둥지를 지나 절벽 길로 간다', ok: { fight: 'harpy', win: { text: '절벽 아래로 침몰선이 보인다.', side: ['south', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '등대선의 선장', text: '물에 잠긴 선실. 해초를 휘감은 선장의 망령이 종을 울린다. “…항구는… 불이 꺼졌어… 돌아갈 수 없어….”',
      choices: [
        { t: '“등대에 불을 켜고 아내가 기다린다”', check: ['cha', 15], ok: { text: '망령의 눈에 빛이 돈다. “…마리아가…?” 선장이 반지를 빼 내밀고, 물거품처럼 흩어진다.', go: 'side_south_end' }, no: { text: '“거짓말이야!” 망령이 덮쳐 온다.', fight: 'drownedcap', win: { go: 'side_south_end' } } },
        { t: '싸워서 저주를 끊는다', ok: { fight: 'drownedcap', win: { go: 'side_south_end' } } }
      ] }
  ],
  east: [
    { title: '흐려진 연못', text: '연화성 한가운데 연못이 흙탕물로 변했다. 아이들이 울상이다. “금빛 잉어 정령님이 화나셨어요. 누가 정령님 비늘을 훔쳐 갔대요.”',
      choices: [
        { t: '비늘 도둑을 수소문한다', check: ['cha', 14], ok: { text: '찻집 주인이 귀띔한다. 고갯마루 산도깨비가 반짝이는 걸 자랑하고 다닌다고.', xp: 70, side: ['east', 1] }, no: { text: '사람들이 말을 아낀다. 결국 고갯마루까지 직접 올라가기로 했다.', time: 1, side: ['east', 1] } }
      ] },
    { title: '도깨비의 보물', text: '고갯마루 도깨비 소굴. 도깨비가 금빛 비늘을 방망이에 붙이고 흥얼거린다. “이거 내 거다!”',
      choices: [
        { t: '다른 보물과 바꾸자고 한다 (금화 40)', cost: 40, ok: { text: '도깨비가 금화를 세며 비늘을 던져 준다. “거래 끝!”', item: 'fishscale', side: ['east', 2] } },
        { t: '내기로 따낸다', check: ['int', 15], ok: { text: '수수께끼 세 판을 내리 이겼다. 도깨비가 분해하며 비늘을 내준다.', item: 'fishscale', xp: 80, side: ['east', 2] }, no: { text: '“졌으니 싸우자!”', fight: 'dokkaebi', win: { item: 'fishscale', side: ['east', 2] }, flee: { text: '물러났다.' } } },
        { t: '힘으로 빼앗는다', ok: { fight: 'dokkaebi', win: { text: '방망이에서 비늘을 떼어 냈다.', item: 'fishscale', side: ['east', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '잉어 정령', text: '흙탕물이 소용돌이치며 집채만 한 잉어가 솟아오른다. 비늘 한 자리가 비어 있다.',
      choices: [
        { t: '비늘을 돌려준다', req: S => G.has('fishscale'), reqText: '금빛 잉어 비늘', ok: { text: '비늘이 제자리에 붙자 연못이 거울처럼 맑아진다. 정령이 고개를 숙이고 작은 비늘 목걸이를 내민다.', take: 'fishscale', go: 'side_east_end' } },
        { t: '성난 정령을 제압한다', ok: { fight: 'koiwraith', win: { take: 'fishscale', go: 'side_east_end' } } }
      ] }
  ],
  north: [
    { title: '꺼진 대장간', text: '하르그림 성 아래, 백 년 동안 꺼지지 않았다는 용광로가 차갑게 식어 있다. 늙은 대장장이 토르가 망치를 내려놓는다. “식지 않는 불씨, 잉걸 광석만 있으면 다시 지필 수 있어. 눈 속 온천 어딘가에 있을 거야.”',
      choices: [
        { t: '광석을 내놓는다', req: S => G.has('emberore'), reqText: '잉걸 광석 (북부 온천에서)', ok: { text: '“바로 이거야!” 토르의 눈이 빛난다.', side: ['north', 2] } },
        { t: '광석을 찾아 나선다', check: ['int', 15], ok: { text: '얼음 동굴 깊은 곳, 붉게 빛나는 광석을 캐냈다!', item: 'emberore', xp: 90, side: ['north', 1] }, no: { text: '동굴 속에서 얼음 비룡과 마주쳤다!', fight: 'icewyrm', win: { text: '비룡의 둥지에 붉은 광석이 박혀 있었다.', item: 'emberore', side: ['north', 1] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '광석을 든 귀환', text: '잉걸 광석을 품고 돌아왔다. 토르가 풀무를 잡는다. “불을 지피는 동안 용광로를 지키던 놈이 깨어날 거야. 버텨 줘!”',
      choices: [
        { t: '준비됐다', ok: { side: ['north', 2] } }
      ] },
    { title: '용광로 골렘', text: '광석이 용광로에 들어가자 쇳덩이 골렘이 붉게 달아오르며 일어선다. 백 년 묵은 녹이 비명을 지른다.',
      choices: [
        { t: '풀무질을 돕고 골렘을 막는다', check: ['str', 16], ok: { text: '풀무가 불을 키우자 골렘의 몸이 녹아내리기 시작한다!', flag: 'sn_weak', go: 'side_north_boss' }, no: { text: '풀무가 무겁다. 골렘이 다가온다.', go: 'side_north_boss' } },
        { t: '맞서 싸운다', ok: { go: 'side_north_boss' } }
      ] }
  ]
};
Object.assign(SCENES, {
  side_central_end: { title: '다시 울리는 류트', text: '은줄 류트를 받은 시인이 광장에서 노래를 부른다. 이번 노래의 주인공은 은빛 머리의 여행자다. 시인이 오래 쓰던 은줄 하나를 엮어 만든 장식을 건넨다.',
    choices: [{ t: '받는다', ok: { item: 'silverlute', xp: 60, side: ['central', 3], log: '시인의 류트를 되찾아 주었다' } }] },
  side_west_end: { title: '숲의 왕', text: '사슴왕의 뿔에서 검은 이끼가 떨어져 나가자, 공터의 풀꽃들이 다시 고개를 든다. 사냥꾼 브란이 모자를 벗는다. “숲이 그대를 기억할 거야.”',
    choices: [{ t: '깃털 장식을 받는다', ok: { item: 'windfeather', xp: 90, side: ['west', 3], log: '흰 사슴왕을 치유했다' } }] },
  side_south_end: { title: '다시 켜진 등대', text: '노파가 반지를 쥐고 등대 꼭대기에 불을 켠다. 서른 해 만에 사하렌 앞바다에 등대 불빛이 돈다. “이 반지는 그대가 가져가. 그 사람도 그걸 바랄 거야.”',
    choices: [{ t: '반지를 받는다', ok: { item: 'tidering', xp: 120, side: ['south', 3], log: '침몰선의 선장을 쉬게 했다' } }] },
  side_east_end: { title: '맑아진 연못', text: '연화성 연못 위로 연꽃이 다시 핀다. 아이들이 잉어 정령에게 떡을 던져 주며 웃는다.',
    choices: [{ t: '목걸이를 받는다', ok: { item: 'koipendant', xp: 150, side: ['east', 3], log: '연못의 잉어 정령을 달랬다' } }] },
  side_north_boss: { title: '용광로 골렘', text: '골렘이 붉은 주먹을 치켜든다.',
    choices: [{ t: '싸운다!', ok: { fight: 'forgeguard', weakFlag: 'sn_weak', noFlee: true, win: { go: 'side_north_end' } } }] },
  side_north_end: { title: '다시 타오르는 용광로', text: '골렘이 쇳물이 되어 용광로 속으로 녹아든다. 백 년 만의 불꽃이 하르그림 지하를 붉게 물들인다. 토르가 첫 쇳물로 작은 심장 모양 장신구를 빚어 건넨다. “식지 않는 불이야. 추운 길에서 그대를 지켜 줄 거다.”',
    choices: [{ t: '받는다', ok: { item: 'emberheart', xp: 180, side: ['north', 3], log: '하르그림의 용광로를 다시 지폈다' } }] }
});

/* 여관 주사위 내기: 2d6 대결 */
const DiceGame = {
  play(bet) {
    const S = G.S;
    if (S.gold < bet) return;
    const me = Dice.roll('2d6'), host = Dice.roll('2d6');
    UI.say(`▸ 금화 ${bet}을 걸고 주사위를 던진다`, 'me');
    UI.say(`나: <b>${me.rolls.join(' + ')} = ${me.total}</b> · 주인: <b>${host.rolls.join(' + ')} = ${host.total}</b>`);
    if (me.total > host.total) { S.gold += bet; UI.say(`이겼다! 금화 +${bet}`, 'gain'); }
    else if (me.total < host.total) { S.gold -= bet; UI.say(`졌다. 금화 -${bet}`, 'loss'); }
    else UI.say('비겼다. 판돈을 돌려받았다.');
    if (me.total === 12) { S.gold += bet; UI.say(`쌍육! 판돈을 한 번 더 받는다. 금화 +${bet}`, 'level'); }
  }
};
