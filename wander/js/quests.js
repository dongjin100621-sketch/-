'use strict';
/* 은빛 유랑기 — 지역 이야기(메인 퀘스트). 지역마다 3장, 마지막 장의 보스를 넘으면 유람 인장과 청령화 꽃잎을 얻는다.
   QUESTS[지역][단계] = 장면. 결과의 quest:[지역, 다음 단계] 로 진행한다. 단계 3 = 완료 */

const QUEST_NAMES = {
  central: '꺼진 새벽 등불', west: '시드는 숲의 노래', south: '모래 아래의 여왕',
  east: '끊긴 용맥', north: '얼어붙은 종소리', final: '다섯 바람이 만나는 곳'
};
const QUEST_HINTS = {
  central: ['대성당의 기사단장 아델린을 만나자', '왕도 지하 수로로 도둑의 흔적을 쫓자', '도적 길드 은신처에서 등불을 되찾자'],
  west: ['숲지기 리오라에게 고목의 병을 묻자', '안개 습지를 건너 병의 근원을 찾자', '세이렌나무 뿌리 깊은 곳으로'],
  south: ['대상단장 카심에게 실종 사건을 듣자', '태양의 무덤으로 향하자', '모래 아래 여왕의 둥지로'],
  east: ['연화사의 수도승 연수를 찾아가자', '천 개 계단 위 세 개의 문', '석룡 청운이 잠든 봉우리로'],
  north: ['하르그림 성주 브리엔을 만나자', '얼음 협곡을 건너자', '서리 거인 흐림달과 마주하자'],
  final: ['왕도 루멘하르트의 옛 천문탑으로']
};

const petalText = (color, region) => `보스가 쓰러진 자리에서 바람이 소용돌이친다. 품속의 마른 청령화 위로 <b>${color}</b> 빛이 스며들어, 꽃잎 하나가 새로 피어났다. ${region}의 바람이 대답한 것이다.`;

const QUESTS = {
  /* ═════ 중앙: 꺼진 새벽 등불 ═════ */
  central: [
    { title: '대성당의 빈 제단', text: '루멘하르트 대성당. 천 년 동안 꺼지지 않았다는 <b>새벽 등불</b>이 있던 제단이 텅 비어 있다. 은빛 갑옷의 기사단장 아델린이 지친 얼굴로 다가온다.<br>“여행자로군. 이 도시 사람들은 도둑맞았다는 사실조차 쉬쉬하지. 혹시… 도와줄 수 있겠나?”',
      choices: [
        { t: '제단을 조사한다', check: ['int', 12], ok: { text: '제단 위에 회색 재가 얇게 깔려 있다. 일반 재가 아니라, 손에 닿으면 차갑다. “재의 손 볼크… 도적 길드 놈들 짓이군.” 아델린이 이를 간다.', xp: 30, flag: 'c_ash', quest: ['central', 1] },
          no: { text: '특별한 건 보이지 않는다. 아델린이 한숨을 쉰다. “수로 쪽에서 수상한 자들을 봤다는 보고가 있었네.”', quest: ['central', 1] } },
        { t: '성당지기들에게 묻는다', check: ['cha', 11], ok: { text: '어린 수습 사제가 떨며 털어놓는다. “그날 밤, 검은 장갑을 낀 사람이 하수구 덮개로 들어가는 걸 봤어요. 장갑이 타고 있었어요….”', xp: 30, flag: 'c_witness', quest: ['central', 1] },
          no: { text: '사제들은 입을 다문다. 아델린이 대신 말한다. “지하 수로가 수상하네.”', quest: ['central', 1] } }
      ] },
    { title: '루멘하르트 지하 수로', text: '돌계단을 내려가자 썩은 물 냄새가 코를 찌른다. 횃불 빛 너머, 바닥에 가는 줄이 팽팽히 걸려 있다. 그 너머 어둠에서 사람 목소리가 웅성거린다.',
      choices: [
        { t: '함정을 해제하고 숨어든다', check: ['dex', 13], ok: { text: '줄을 조심스레 끊고, 그림자 사이를 지나 도적들의 대화를 엿들었다. “두목이 이름 없는 손님한테 등불을 넘긴대.” 은신처의 위치도 알아냈다.', xp: 50, flag: 'c_sneak', quest: ['central', 2] },
          no: { text: '딸깍. 종이 울리고 그림자 도적이 뛰어든다!', fight: 'shade', win: { text: '도적의 품에서 은신처 위치가 적힌 쪽지를 찾았다.', quest: ['central', 2] }, flee: { text: '물러섰다. 다시 와야 한다.' } } },
        { t: '정면으로 밀고 들어간다', ok: { text: '횃불을 높이 들고 성큼 들어섰다.', fight: 'shade', win: { text: '쓰러진 도적이 은신처 위치를 불었다.', xp: 20, quest: ['central', 2] }, flee: { text: '일단 물러났다.' } } },
        { t: '수로 구조를 추리한다', check: ['int', 13], ok: { text: '물 흐름을 따라가면 옛 왕실 저수조가 나온다. 은신처는 거기다. 경비 없는 길로 돌아 들어갔다.', xp: 50, flag: 'c_sneak', quest: ['central', 2] },
          no: { text: '길을 잃고 한참 헤매다 쥐왕과 마주쳤다!', fight: 'sewerrat', win: { text: '쥐왕 둥지 너머로 불빛이 보인다. 은신처다.', quest: ['central', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '재의 손', text: S => `옛 왕실 저수조. 촛불 수십 개 사이에서 <b>재의 손 볼크</b>가 꺼진 등불을 만지작거린다. 그의 장갑에서 연기가 피어오른다.<br>“${S.flags.c_sneak ? '어떻게 여기까지 조용히 왔지? 대단하군.' : '시끄럽게도 왔군.'} 이 등불은 이미 팔렸어. 이름 없는 손님한테.”`,
      choices: [
        { t: '“그 손님이 누구지?” 설득한다', check: ['cha', 15], ok: { text: '볼크가 잠시 망설인다. “…이름이 없어. 진짜로. 다섯 지역에 재앙을 하나씩 심고 다닌다더군. 나도 이제 그놈이 무섭다.” 그러나 그는 칼을 뽑는다. “그래도 거래는 거래다!” 그의 손이 떨린다.', flag: ['c_lore', 'c_weak'], xp: 40, go: 'central_boss' },
          no: { text: '“말이 많군.” 볼크가 단도를 뽑는다.', go: 'central_boss' } },
        { t: '등불을 향해 몸을 날린다', check: ['dex', 15], ok: { text: '번개처럼 등불을 낚아챘다! 볼크가 당황한 틈에 자세를 잡는다.', flag: 'c_weak', go: 'central_boss' }, no: { text: '볼크의 발길질에 나동그라졌다.', hp: '-1d6', go: 'central_boss' } },
        { t: '검을 겨눈다', ok: { go: 'central_boss' } }
      ] }
  ],
  /* ═════ 서부: 시드는 숲의 노래 ═════ */
  west: [
    { title: '검게 물든 고목', text: '엘름우드 한가운데, 마을 전체를 품은 고목 <b>세이렌나무</b>. 그 잎 끝이 잉크에 담근 듯 검게 물들어 간다. 숲지기 리오라가 뿌리를 쓰다듬고 있다.<br>“나무가 아파해요. 뿌리 깊은 곳에서 무언가가 독을 흘려보내고 있어요.”',
      choices: [
        { t: '병든 잎을 연구한다', check: ['int', 13], ok: { text: '잎맥을 따라 검은 독이 흐른다. 이건 병이 아니라 <b>주술</b>이다. 서쪽 안개 습지에서 흘러온 물에 섞여 있다.', xp: 50, flag: 'w_poison', quest: ['west', 1] }, no: { text: '알 수 없다. 리오라가 습지 쪽을 가리킨다. “물이 저쪽에서 와요.”', quest: ['west', 1] } },
        { t: '숲의 짐승들에게 묻는다', check: ['cha', 12], ok: { text: '늙은 사슴이 고개를 숙이며 길을 안내한다. 짐승들도 습지를 피한다고 한다.', xp: 50, flag: 'w_deer', quest: ['west', 1] }, no: { text: '짐승들은 겁에 질려 숨는다. 리오라가 습지 쪽을 가리킨다.', quest: ['west', 1] } }
      ] },
    { title: '안개 습지', text: '무릎까지 차오르는 검은 물. 안개 속에서 구슬픈 울음이 들린다. 습지에 갇힌 망령들이 길을 막는다.',
      choices: [
        { t: '진혼의 노래를 부른다', check: ['cha', 14], ok: { text: '노래가 안개를 타고 퍼지자 망령들이 하나둘 빛이 되어 사라진다. 그들 중 하나가 속삭인다. “뿌리… 드루이드 모르그….”', xp: 70, quest: ['west', 2] }, no: { text: '노래가 갈라졌다. 망령이 성나서 달려든다!', fight: 'wisp', win: { text: '안개가 걷히며 뿌리로 향하는 길이 드러났다.', quest: ['west', 2] }, flee: { text: '습지 밖으로 물러났다.' } } },
        { t: '결계를 그려 지나간다', check: ['int', 14], ok: { text: '물 위에 빛나는 원을 그리자 망령들이 다가오지 못한다. 무사히 건넜다.', xp: 70, quest: ['west', 2] }, no: { text: '결계가 깨졌다!', fight: 'wisp', win: { text: '길이 열렸다.', quest: ['west', 2] }, flee: { text: '물러났다.' } } },
        { t: '검을 들고 헤쳐 나간다', ok: { fight: 'wisp', win: { text: '마지막 망령이 흩어지며 길이 열렸다.', xp: 20, quest: ['west', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '썩은 뿌리', text: S => `세이렌나무 뿌리 아래 동굴. 뿌리와 살이 엉겨 붙은 드루이드 <b>모르그</b>가 눈을 뜬다.<br>“이 숲은 너무 오래 살았다. 이름 없는 분께서 말씀하셨지. 죽음도 숲의 일부라고.”${S.flags.w_poison ? '<br>(주술의 흐름이 보인다. 뿌리에 해독제를 부으면 그의 힘이 약해질 것이다.)' : ''}`,
      choices: [
        { t: '뿌리에 해독제를 붓는다', req: S => G.has('antidote'), reqText: '해독제', ok: { text: '해독제가 뿌리에 스며들자 모르그가 비명을 지른다. 그의 몸에서 검은 수액이 빠져나간다!', take: 'antidote', flag: 'w_weak', go: 'west_boss' } },
        { t: '“숲이 울고 있다” 설득한다', check: ['cha', 16], ok: { text: '모르그의 눈에 한순간 눈물이 맺힌다. 그러나 검은 뿌리가 그의 입을 막는다. 저항하는 그의 힘이 약해졌다.', flag: 'w_weak', xp: 40, go: 'west_boss' }, no: { text: '“늦었다!”', go: 'west_boss' } },
        { t: '싸운다', ok: { go: 'west_boss' } }
      ] }
  ],
  /* ═════ 남부: 모래 아래의 여왕 ═════ */
  south: [
    { title: '사라진 대상들', text: '사하렌 항, 대상단 숙소. 대상단장 카심이 지도를 내리친다.<br>“한 달 새 대상 셋이 사라졌어! 모두 태양의 무덤 근처를 지났지. 길을 아는 사람은 없고, 도굴꾼들은 겁에 질렸어.”',
      choices: [
        { t: '낡은 지도를 보여 준다', req: S => G.has('oldmap'), reqText: '낡은 사막 지도 (해적 선장에게서)', ok: { text: '카심이 눈을 크게 뜬다. “이건 무덤으로 가는 옛길이잖아! 이걸로 가면 사흘을 아끼겠어.”', xp: 60, flag: 's_map', quest: ['south', 1] } },
        { t: '별자리로 길을 계산한다', check: ['int', 14], ok: { text: '사라진 대상들의 마지막 야영지를 별자리로 이어 보니, 무덤 입구가 나왔다.', xp: 60, flag: 's_map', quest: ['south', 1] }, no: { text: '대략적인 방향만 알았다. 고생길이 될 것 같다.', quest: ['south', 1] } },
        { t: '대상단에 합류해 떠난다', ok: { text: '카심이 길잡이 하나를 붙여 준다. “조심해. 모래가 움직이거든.”', rations: 2, quest: ['south', 1] } }
      ] },
    { title: '태양의 무덤', text: S => `${S.flags.s_map ? '옛길을 따라 어렵지 않게' : '타는 듯한 사막을 이틀 동안 헤매고서야'} 반쯤 모래에 묻힌 피라미드에 다다랐다. 입구에 금빛 눈의 파수꾼이 서 있다. 그 너머, 사라진 대상들의 수레가 보인다.`,
      choices: [
        { t: '열기를 견디며 기다렸다가 몰래 들어간다', check: ['con', 13], ok: { text: '한낮의 열기를 버티고 파수꾼이 쉬는 틈에 안으로 들어갔다. 대상들의 흔적이 지하로 이어진다.', xp: 80, quest: ['south', 2] }, no: { text: '열기에 쓰러질 뻔했다. 파수꾼이 눈치챘다!', hp: '-1d8', fight: 'mummy', win: { text: '파수꾼이 모래로 무너졌다.', quest: ['south', 2] }, flee: { text: '사막으로 달아났다.' } } },
        { t: '상형문자를 해독해 문을 연다', check: ['int', 14], ok: { text: '“태양의 이름을 부르는 자에게 길이 열린다.” 숨겨진 문이 열렸다.', xp: 80, quest: ['south', 2] }, no: { text: '잘못된 문자를 눌렀다. 파수꾼이 깨어난다!', fight: 'mummy', win: { text: '길이 열렸다.', quest: ['south', 2] }, flee: { text: '달아났다.' } } },
        { t: '파수꾼과 싸운다', ok: { fight: 'mummy', win: { text: '파수꾼이 무너졌다.', xp: 20, quest: ['south', 2] }, flee: { text: '달아났다.' } } }
      ] },
    { title: '여왕의 둥지', text: '무덤 아래 거대한 공동. 사라진 대상들이 모래 고치 안에 잠들어 있다. 바닥이 융기하고, <b>모래 여왕 시라크</b>가 몸을 일으킨다. 그녀의 이마에 검은 쐐기가 박혀 있다.',
      choices: [
        { t: '먼저 대상들을 구해 낸다', check: ['str', 14], ok: { text: '고치를 찢어 사람들을 깨웠다. 카심의 부하들이 기둥 뒤로 피신하며 활로 엄호한다!', flag: 's_weak', xp: 60, go: 'south_boss' }, no: { text: '고치가 단단하다. 여왕이 덮쳐 온다!', go: 'south_boss' } },
        { t: '이마의 쐐기를 노린다', check: ['dex', 16], ok: { text: '단검을 던져 쐐기를 맞혔다. 여왕이 고통에 몸부림친다!', flag: 's_weak', xp: 40, go: 'south_boss' }, no: { text: '빗나갔다.', go: 'south_boss' } },
        { t: '정면으로 맞선다', ok: { go: 'south_boss' } }
      ] }
  ],
  /* ═════ 동부: 끊긴 용맥 ═════ */
  east: [
    { title: '연화사의 수도승', text: '연꽃 연못가 연화사. 젊은 수도승 연수가 갈라진 바닥을 가리킨다.<br>“산의 용맥이 끊겼습니다. 용맥을 지키던 석룡 청운께서 미쳐 날뛰시니, 땅이 우는 것이지요. 누군가 산꼭대기의 용맥석에 검은 못을 박았습니다.”',
      choices: [
        { t: '함께 명상하며 용맥을 느낀다', check: ['con', 13], ok: { text: '땅속 깊은 곳에서 고통스러운 맥박이 느껴진다. 맥은 천 개 계단 위로 이어진다.', xp: 80, flag: 'e_feel', quest: ['east', 1] }, no: { text: '다리가 저리기만 하다. 연수가 웃으며 길을 알려 준다.', quest: ['east', 1] } },
        { t: '사원의 고서를 읽는다', check: ['int', 14], ok: { text: '“수호룡이 노하면 그 이름을 세 번 부르고 진심을 전하라.” 중요한 단서를 얻었다.', xp: 80, flag: 'e_name', quest: ['east', 1] }, no: { text: '고어가 너무 어렵다.', quest: ['east', 1] } }
      ] },
    { title: '세 개의 문', text: '천 개 계단을 오르자 세 개의 문이 앞을 막는다. <b>힘의 문</b>은 거대한 돌로 막혀 있고, <b>지혜의 문</b>에는 수수께끼가, <b>마음의 문</b>에는 아무것도 없이 거울만 걸려 있다.',
      choices: [
        { t: '힘의 문: 돌을 민다', check: ['str', 15], ok: { text: '돌이 굉음을 내며 밀려났다.', xp: 100, quest: ['east', 2] }, no: { text: '돌이 꿈쩍도 않자, 문의 수호자가 깨어난다!', fight: 'guardian', win: { text: '수호자가 무너지며 문이 열렸다.', quest: ['east', 2] }, flee: { text: '계단을 뛰어 내려갔다.' } } },
        { t: '지혜의 문: 수수께끼를 푼다', check: ['int', 15], ok: { text: '“끊어져도 흐르는 것은?” — “바람.” 문이 열린다.', xp: 100, quest: ['east', 2] }, no: { text: '틀렸다. 수호자가 깨어난다!', fight: 'guardian', win: { text: '문이 열렸다.', quest: ['east', 2] }, flee: { text: '물러났다.' } } },
        { t: '마음의 문: 거울을 마주한다', check: ['cha', 15], ok: { text: '거울 속 은발의 여행자가 묻는다. “왜 걷지?” 대답하자, 거울이 물처럼 열렸다.', xp: 100, quest: ['east', 2] }, no: { text: '거울 속 자신이 뛰쳐나왔다… 아니, 수호자다!', fight: 'guardian', win: { text: '문이 열렸다.', quest: ['east', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '석룡의 봉우리', text: S => `구름 위 봉우리. 용맥석에 박힌 검은 못에서 연기가 피어오르고, 돌비늘의 거대한 용 <b>청운</b>이 고통에 울부짖는다.${S.flags.e_name ? '<br>(고서의 말이 떠오른다: 이름을 세 번 부르고 진심을 전하라.)' : ''}`,
      choices: [
        { t: '“청운, 청운, 청운.” 이름을 불러 달랜다', check: ['cha', 17], bonus: S => S.flags.e_name ? 4 : 0, ok: { text: '용의 눈에서 붉은빛이 걷힌다. 그 틈에 검은 못을 뽑아냈다. 청운이 고개를 숙인다. “고맙다, 작은 여행자여. 이것을 가져가라.”', fn: () => {}, go: 'east_peace' },
          no: { text: '목소리가 닿지 않는다. 청운이 포효한다!', go: 'east_boss' } },
        { t: '검은 못을 뽑으러 달려든다', check: ['str', 16], ok: { text: '못이 반쯤 뽑혔다! 청운이 비틀거린다.', flag: 'e_weak', xp: 50, go: 'east_boss' }, no: { text: '용의 꼬리에 튕겨 났다.', hp: '-2d6', go: 'east_boss' } },
        { t: '싸워서 쓰러뜨린다', ok: { go: 'east_boss' } }
      ] }
  ],
  /* ═════ 북부: 얼어붙은 종소리 ═════ */
  north: [
    { title: '눈보라의 성채', text: '하르그림 성 대전. 얼음 같은 눈빛의 성주 브리엔이 화로 앞에 서 있다.<br>“일 년째 눈보라가 그치지 않는다. 서리 거인 흐림달은 본래 우리와 맹약을 맺은 존재였지. 누군가 그에게 검은 왕관을 씌운 뒤로 미쳐 버렸어.”',
      choices: [
        { t: '맹약의 기록을 청한다', check: ['int', 14], ok: { text: '기록에 따르면 왕관을 부수면 거인이 제정신을 찾을 수 있다. 다만 왕관은 거인의 머리 위, 아득히 높은 곳에 있다.', xp: 100, flag: 'n_crown', quest: ['north', 1] }, no: { text: '기록은 얼어붙어 읽을 수 없었다.', quest: ['north', 1] } },
        { t: '병사들의 사기를 북돋는다', check: ['cha', 14], ok: { text: '병사들이 함성을 지른다. 브리엔이 성의 비상 식량과 물약을 내준다.', item: ['hipotion', 'hipotion'], rations: 3, xp: 80, quest: ['north', 1] }, no: { text: '병사들은 지쳐 고개만 숙인다.', quest: ['north', 1] } }
      ] },
    { title: '얼음 협곡', text: '거인의 거처로 가는 유일한 길, 얼음 협곡. 칼날 같은 바람이 몰아치고, 협곡 끝에서 설인이 길을 지킨다.',
      choices: [
        { t: '혹한을 견디며 설인을 우회한다', check: ['con', 15], ok: { text: '얼음벽에 몸을 붙이고 바람을 버텼다. 설인이 눈치채지 못했다.', xp: 120, quest: ['north', 2] }, no: { text: '추위에 손이 굳었다. 설인이 냄새를 맡았다!', hp: '-2d6', fight: 'yeti', win: { text: '설인이 쓰러졌다.', quest: ['north', 2] }, flee: { text: '협곡 밖으로 물러났다.' } } },
        { t: '얼음벽을 타고 넘는다', check: ['dex', 15], ok: { text: '얼음 틈을 디디며 협곡 위를 넘었다.', xp: 120, quest: ['north', 2] }, no: { text: '미끄러져 설인 앞에 떨어졌다!', hp: '-1d10', fight: 'yeti', win: { text: '길이 열렸다.', quest: ['north', 2] }, flee: { text: '물러났다.' } } },
        { t: '설인과 정면 대결', ok: { fight: 'yeti', win: { text: '설인이 쓰러졌다.', xp: 30, quest: ['north', 2] }, flee: { text: '물러났다.' } } }
      ] },
    { title: '서리 거인의 옥좌', text: S => `얼음 궁전의 옥좌. 탑만 한 서리 거인 <b>흐림달</b>이 머리를 감싸 쥐고 신음한다. 그의 이마에 검은 왕관이 뿌리처럼 박혀 있다.<br>“…아프다… 목소리가… 이름 없는 목소리가….”${S.flags.n_crown ? '<br>(왕관을 부수면 그가 정신을 차릴 것이다.)' : ''}`,
      choices: [
        { t: '거인의 팔을 타고 올라 왕관을 내려친다', check: ['str', 16], ok: { text: '왕관에 금이 갔다! 흐림달이 비틀거리며 무릎을 꿇는다.', flag: 'n_weak', xp: 80, go: 'north_boss' }, no: { text: '내동댕이쳐졌다.', hp: '-2d8', go: 'north_boss' } },
        { t: '왕관의 틈을 정확히 노린다', check: ['dex', 16], ok: { text: '화살처럼 날아간 일격이 왕관 이음매에 꽂혔다!', flag: 'n_weak', xp: 80, go: 'north_boss' }, no: { text: '빗나갔다.', go: 'north_boss' } },
        { t: '맹약의 말로 거인을 부른다', req: S => S.flags.n_crown, reqText: '맹약의 기록', check: ['cha', 15], ok: { text: '“흐림달, 하르그림의 벗이여!” 거인의 눈에 한순간 빛이 돌아온다. 저항이 약해졌다.', flag: 'n_weak', xp: 80, go: 'north_boss' }, no: { text: '목소리가 눈보라에 묻혔다.', go: 'north_boss' } }
      ] }
  ],
  /* ═════ 최종장 ═════ */
  final: [
    { title: '옛 천문탑', text: '다섯 개의 꽃잎을 품고 루멘하르트로 돌아온 밤. 왕도 외곽, 아무도 오르지 않는 옛 천문탑 꼭대기에서 다섯 빛깔의 바람이 소용돌이친다.<br>계단 끝에서 얼굴 없는 가면을 쓴 자가 기다리고 있다.<br>“기다렸다, 은빛 머리의 아이야. 네 어머니도 그 꽃을 찾다 여기서 멈췄지. 다섯 바람을 모아 줘서 고맙다. 이제 그 꽃잎을 내게.”',
      choices: [
        { t: '“어머니를 알고 있나?”', ok: { text: '“알다마다. 그녀는 꽃을 피워 이 대륙의 재앙을 걷어 내려 했지. 나는 재앙을 심어 그 꽃을 키웠다. 피어난 꽃을 내가 꺾으면, 다섯 바람이 모두 내 것이 된다.” 가면 아래에서 공허가 웃는다.', flag: 'f_truth', go: 'final_shadows' } },
        { t: '대답 대신 무기를 든다', ok: { go: 'final_shadows' } }
      ] }
  ]
};

/* 보스와 결말 장면 (quest 결과에서 go 로 부른다) */
const SCENES = {
  central_boss: { title: '재의 손', text: '볼크가 연기 나는 장갑을 움켜쥔다.',
    choices: [{ t: '싸운다!', ok: { fight: 'volk', weakFlag: 'c_weak', noFlee: true, win: { go: 'central_end' } } }] },
  central_end: { title: '다시 켜진 등불', text: S => `볼크가 무릎을 꿇었다. 되찾은 새벽 등불을 대성당 제단에 올리자, 꺼져 있던 심지에 저절로 불이 붙는다. 아델린이 고개를 숙인다. “기사단은 이 빚을 잊지 않겠네.”<br><br>${petalText('금빛', '중앙')}${S.flags.c_lore ? '<br><br>볼크의 말이 귀에 맴돈다. <i>이름 없는 손님… 다섯 지역에 재앙을 하나씩.</i>' : ''}`,
    choices: [{ t: '인장을 받는다', ok: { item: ['petal_central', 'dawnsigil', 'ashfang'], gold: 80, xp: 120, seal: 'central', quest: ['central', 3], log: '새벽 등불을 되찾았다' } }] },

  west_boss: { title: '썩은 뿌리 모르그', text: '뿌리가 꿈틀거리며 모르그가 일어선다.',
    choices: [{ t: '싸운다!', ok: { fight: 'morg', weakFlag: 'w_weak', noFlee: true, win: { go: 'west_end' } } }] },
  west_end: { title: '다시 푸르러진 숲', text: `모르그의 몸에서 검은 뿌리가 떨어져 나간다. 그는 마지막 숨으로 속삭인다. “…이름 없는 자가… 다음은 남쪽 모래라고….”<br>세이렌나무 잎이 하나둘 초록빛을 되찾는다. 리오라가 눈물을 닦으며 웃는다.<br><br>${petalText('초록', '서부')}`,
    choices: [{ t: '인장을 받는다', ok: { item: ['petal_west', 'rootheart'], gold: 100, xp: 200, seal: 'west', quest: ['west', 3], log: '세이렌나무를 되살렸다' } }] },

  south_boss: { title: '모래 여왕 시라크', text: '모래가 폭포처럼 쏟아지며 여왕이 입을 벌린다.',
    choices: [{ t: '싸운다!', ok: { fight: 'sirak', weakFlag: 's_weak', noFlee: true, win: { go: 'south_end' } } }] },
  south_end: { title: '돌아온 대상들', text: `여왕이 쓰러지며 이마의 검은 쐐기가 재가 되어 흩어진다. 고치에서 풀려난 상인들이 햇빛 아래로 걸어 나온다. 카심이 터번을 벗어 인사한다. “사하렌의 모든 항구가 그대에게 열려 있소.”<br><br>${petalText('주홍', '남부')}`,
    choices: [{ t: '인장을 받는다', ok: { item: ['petal_south', 'sunspear'], gold: 150, xp: 300, seal: 'south', quest: ['south', 3], log: '모래 여왕을 쓰러뜨리고 대상들을 구했다' } }] },

  east_boss: { title: '석룡 청운', text: '청운의 포효에 봉우리가 흔들린다.',
    choices: [{ t: '싸운다!', ok: { fight: 'cheongun', weakFlag: 'e_weak', noFlee: true, win: { go: 'east_end' } } }] },
  east_peace: { title: '잠잠해진 산', text: `검은 못이 뽑히자 끊어졌던 용맥이 다시 흐른다. 땅울림이 멎고, 청운이 구름 위로 날아오른다. 연수가 합장한다.<br><br>${petalText('연분홍', '동부')}`,
    choices: [{ t: '인장을 받는다', ok: { item: ['petal_east', 'dragonpearl'], gold: 120, xp: 800, seal: 'east', quest: ['east', 3], log: '석룡 청운을 싸우지 않고 달랬다' } }] },
  east_end: { title: '이어진 용맥', text: `쓰러진 청운의 몸에서 검은 못이 빠져나온다. 용은 희미하게 눈을 뜨고 말한다. “…고맙다. 정신이 맑아졌다.” 끊어졌던 용맥이 다시 흐른다.<br><br>${petalText('연분홍', '동부')}`,
    choices: [{ t: '인장을 받는다', ok: { item: ['petal_east', 'dragonpearl'], gold: 180, xp: 400, seal: 'east', quest: ['east', 3], log: '석룡 청운을 쓰러뜨리고 용맥을 이었다' } }] },

  north_boss: { title: '서리 거인 흐림달', text: '눈보라가 옥좌를 휘감는다.',
    choices: [{ t: '싸운다!', ok: { fight: 'hrimdal', weakFlag: 'n_weak', noFlee: true, win: { go: 'north_end' } } }] },
  north_end: { title: '그친 눈보라', text: `검은 왕관이 산산조각 난다. 흐림달이 무릎을 꿇은 채 오래 숨을 고른다. “…고맙다, 작은 이여. 일 년 만에 내 생각이 내 것이 되었다.” 하르그림의 종이 울리고, 일 년 만에 해가 뜬다.<br><br>${petalText('서리', '북부')}`,
    choices: [{ t: '인장을 받는다', ok: { item: 'petal_north', gold: 220, xp: 500, seal: 'north', quest: ['north', 3], log: '서리 거인을 저주에서 풀어 주었다' } }] },

  final_shadows: { title: '공허의 그림자', text: '가면의 자가 손을 들자 바닥에서 검은 그림자가 솟아오른다.',
    choices: [{ t: '그림자를 베어 낸다', ok: { fight: 'voidling', noFlee: true, win: { go: 'final_boss' } } }] },
  final_boss: { title: '공허의 사도 무명', text: '“좋다. 직접 꺾어 주지.” 무명이 가면을 벗는다. 그 아래에는 얼굴이 없다. 오직 별 없는 밤뿐.',
    choices: [{ t: '다섯 바람이여!', ok: { text: '품속의 꽃잎 다섯 장이 빛나며 몸을 감싼다. (체력·마나 회복)', hp: 999, mp: 999, fight: 'nameless', noFlee: true, win: { go: 'ending' } } }] },
  ending: { title: '청령화', text: S => `무명이 별 없는 밤처럼 흩어진다. 그가 심었던 다섯 재앙의 잔재가 바람에 실려 사라진다.<br><br>천문탑 꼭대기, 다섯 빛깔의 바람이 품속으로 모여든다. 마른 꽃이 천천히 고개를 든다. 금빛, 초록, 주홍, 연분홍, 서리빛 꽃잎 사이로 — 푸른 종 모양의 꽃이 피어난다. 바람이 종을 흔들자, 아주 작은 소리가 대륙 끝까지 울려 퍼진다.<br><br>어디선가, 어머니의 목소리가 들린 것 같았다. <i>잘 왔구나.</i><br><br><b>${S.name}</b>의 유람은 ${S.day}일 만에, 레벨 ${S.lvl}로 마무리되었다. 하지만 길은 아직 끝나지 않았다.`,
    choices: [{ t: '— 끝. 그리고 계속되는 여행 —', ok: { quest: ['final', 1], flag: 'ended', xp: 0, log: '청령화를 피워 냈다', fn: S => { S.ended = true; } } }] }
};
