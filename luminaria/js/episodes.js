/* 루미나리아: Eight Fates — 추가 시나리오
 * 공통 이벤트(환영회 · 중간 시험 · 유적 합동 실습 · 축제 준비 · 전야 · 트루 엔딩),
 * 히로인별 주말 데이트 · 축제 전야 · 일상 대화 추가분, 장소 연출 정보.
 * 형식은 data.js 머리말 참고. 추가 지시어:
 *   {bgm:'곡'} {pt:'stars|motes|petals|rain|fireworks'|null} {fx:'flash|shake|white|black'}
 *   {tint:'am|pm|night'} {bg:'…', fade:true} {sfx:'heart'} {wait:ms}
 *   {if:(S)=>조건, go:[…], else:[…]}  {run: async (G) => …}
 */

/* 장소별 연출 */
Object.assign(LOCS.class, { bgm: 'daily' });
Object.assign(LOCS.library, { bgm: 'calm', pt: 'motes' });
Object.assign(LOCS.training, { bgm: 'daily', outdoor: true });
Object.assign(LOCS.outskirts, { bgm: 'battle', outdoor: true });
Object.assign(LOCS.lab, { bgm: 'daily' });
Object.assign(LOCS.chapel, { bgm: 'calm', outdoor: true, pt: 'petals' });
Object.assign(LOCS.market, { bgm: 'market', outdoor: true });
Object.assign(LOCS.dorm, { bgm: 'calm' });

const VISIT_LINES = {
  class: ['교수님의 분필이 칠판 위에서 마법진을 그려낸다. 오늘은 공명 이론 수업이다.', '천장까지 닿는 진열장 사이에서 고대 마도구 해설을 들었다.', '졸음을 참으며 필기를 했다. 무색 마력의 이론은 여전히 어렵다.'],
  library: ['먼지 냄새와 종이 냄새. 창으로 들어온 빛 속에 먼지가 금가루처럼 떠다닌다.', '서가 사이를 거닐며 마도서를 몇 권 골라 읽었다.', '창가 자리에서 조용히 자습했다. 시계 소리만 들린다.'],
  training: ['목검이 부딪히는 소리가 연병장에 울려 퍼진다.', '돌계단을 스무 번 오르내렸다. 다리가 후들거린다.', '기사학과 선배에게 방패 쓰는 법을 배웠다.'],
  outskirts: ['무너진 신전의 기둥 사이로 바람이 분다. 어딘가에서 오래된 마력이 느껴진다.', '유적 깊숙한 곳에서 낡은 금화 몇 닢을 주웠다.', '덩굴에 덮인 석상을 지나, 아무도 가지 않은 길을 걸었다.'],
  lab: ['플라스크 안에서 보랏빛 액체가 끓어오른다. 냄새가… 독특하다.', '톱니바퀴를 닦고 회로를 맞추는 일을 도왔다.', '「절대 만지지 마시오」라고 적힌 상자를 피해 조심조심 실험을 거들었다.'],
  chapel: ['회랑을 따라 걷자 정원의 꽃향기가 바람에 실려 왔다.', '분수 소리를 들으며 벤치에 앉아 눈을 감았다.', '아치 너머로 쏟아지는 빛 속에서, 마음이 조용히 가라앉는다.'],
  market: ['광장 분수 주변으로 노점이 빼곡하다. 상인들의 호객 소리가 활기차다.', '길드 창고에서 짐을 나르고 장부를 정리했다.', '향신료와 빵 굽는 냄새가 거리를 가득 채우고 있다.'],
  dorm: ['기숙사 창가에서 낮잠을 잤다. 꿈속에서 별등이 반짝였다.', '따뜻한 차를 마시며 하루를 정리했다.', '침대에 쓰러지듯 누웠다. 몸이 녹아내리는 것 같다.'],
};

const DAY_NEWS = {
  welcome: '목요일 저녁, 입학 환영회가 열린다',
  club: '토요일, 동아리 박람회가 열린다',
  exam: '수요일엔 중간 시험! 지력을 올려두자',
  ghost: '토요일 밤, 대도서관에 귀신이 나온다는 소문이…',
  field: '금요일, 유적 합동 실습. 체력과 용기가 필요하다',
  contest: '목요일, 학과 대항 마법제! 능력치를 골고루 올려두자',
  prep: '토요일, 축제 준비 위원회가 꾸려진다',
  finals: '목요일, 기말 실기 평가. 학원 평가 등급이 결과를 가른다',
};

const IDLE_LINES = {
  serena: ['…조용한 곳이 좋아. 그게 다야.', '오늘 읽을 책은 이미 정해 뒀어.', '차가 식기 전에 마셔야 하는데.'],
  luna: ['배고파~ 고기 냄새 어디서 나지?', '오늘은 어디로 탐험 갈까!', '바람 냄새가 좋은 날이야!'],
  camilla: ['훈련은 하루도 거르면 안 돼.', '…검 손질 끝나면 스튜 먹으러 갈까.', '자세가 흐트러지면 마음도 흐트러져.'],
  aria: ['정원의 백합이 피었어요.', '다치신 데는 없으세요?', '오늘도 모두 무사하기를.'],
  lizette: ['기록할 게 많은 하루야.', '…방금 그거, 적어둘게.', '시끄러운 곳은 피하고 싶은데.'],
  rose: ['새 발명품, 이번엔 진짜 안 터져!', '유적 지도에 새 표시를 했어!', '고글 어디 뒀더라…'],
  noelle: ['…비가 오면 좋겠다.', '금서고는 출입 금지야.', '홍차는 설탕 하나.'],
  beatrix: ['좋은 거래 없나~', '시간은 돈이야. 알지?', '오늘 장부는 흑자야. 기분 좋네.'],
};

/* 선물 설명 */
const ITEM_DESC = { tea: '북부 고원의 향긋한 찻잎', book: '먼 왕국의 고대 학술서', skewer: '광장 노점의 인기 메뉴', lily: '성당 정원 같은 순백의 꽃', whetstone: '기사들이 탐내는 숫돌',
  parts: '공방에서 귀한 톱니와 회로', map: '어딘가의 유적을 가리키는 조각', quill: '별빛을 머금은 깃털 펜', wine: '길드 창고의 숙성 와인', brooch: '세공이 섬세한 장신구' };
for (const [k, d] of Object.entries(ITEM_DESC)) ITEMS[k].desc = d;

/* ───────────────────────── 공통 이벤트 ───────────────────────── */
Object.assign(COMMON, {
  // 4일(목) 저녁: 입학 환영회
  welcome: [
    { bgm: 'market', bg: 'market', tint: 'pm' },
    ['', '목요일 저녁. 상인 길드가 후원하는 신입생·청강생 환영회가 광장에서 열렸다.'],
    ['', '분수 주위에 긴 식탁이 놓이고, 등불이 하나둘 켜지기 시작했다.'],
    ['beatrix', 'smirk', '오늘 음식값은 길드가 낸다. 대신 졸업하면 우리 고객이 되는 거야. 투자라고 생각해 둬.'],
    ['luna', 'smile', '고기 파이 세 번째! 너도 먹어봐, 바삭바삭해!'],
    ['camilla', 'serious', '…줄을 서, 루나. 질서가 무너지면 사고가 나.'],
    ['luna', 'tease', '에~ 카밀라는 환영회에서도 기사네.'],
    ['rose', 'smile', '자, 다들 주목~! 환영의 의미로 특제 축포를 쏘아 올립니다! 셋, 둘, 하나──'],
    { fx: 'flash' }, { fx: 'shake' }, { sfx: 'down' },
    ['', '콰앙! 축포는 하늘이 아니라 식탁 위에서 터졌다. 광장이 분홍색 연기로 뒤덮였다.'],
    ['aria', 'worry', '다치신 분 없으세요? …어머, 머리카락에 그을음이 묻으셨네요.'],
    ['serena', 'cold', '…그래서 이런 자리는 싫다고 했어.'],
    ['lizette', 'blank', '기록. 환영회 개시 47분 만에 폭발 1회. 예상보다 13분 늦음.'],
    ['noelle', 'normal', '…시끄러운 건 싫은데. 그래도 이런 날은, 기록할 가치가 있네.'],
    { hide: 1 },
    ['', '연기가 걷히자 다들 서로의 얼굴을 보고 웃음을 터뜨렸다. 누구와 함께 남은 시간을 보낼까?'],
    { choice: [
      { t: '세레나와 리제트 곁에서 조용히 차를 마신다', aff: { serena: 3, lizette: 3 }, stats: { int: 1 }, go: [
        ['serena', 'normal', '…여기 앉아. 저쪽은 시끄러우니까.'],
        ['lizette', 'smile', '차 온도 62도. 마시기에 적절해.'] ] },
      { t: '루나와 로제랑 남은 음식을 해치운다', aff: { luna: 3, rose: 3 }, stats: { str: 1 }, go: [
        ['rose', 'tease', '실험 실패의 아픔은 음식으로 달래는 거야!'],
        ['luna', 'smile', '역시 말이 통해! 이 소시지도 먹어!'] ] },
      { t: '카밀라와 아리아를 도와 뒷정리를 한다', aff: { camilla: 3, aria: 3 }, stats: { charm: 1 }, go: [
        ['camilla', 'smile', '…자진해서 돕는 사람은 드물어. 고마워.'],
        ['aria', 'smile', '덕분에 금방 끝났어요. 다음엔 제가 차를 대접할게요.'] ] },
      { t: '베아트릭스와 노엘에게 환영회의 유래를 묻는다', aff: { beatrix: 3, noelle: 3 }, stats: { charm: 1 }, go: [
        ['noelle', 'think', '…백 년마다 별등이 흔들리는 해엔, 유난히 성대하게 열렸대. 기록에 그렇게 적혀 있어.'],
        ['beatrix', 'smirk', '그리고 그해엔 길드 매출도 최고였지. 역사는 장부가 증명해.'] ] },
    ] },
    ['', '여덟 개의 빛. 그때의 나는 아직, 그 말의 무게를 알지 못했다.'],
  ],

  // 10일(수): 중간 시험
  exam: [
    { bgm: 'calm', bg: 'class', tint: 'am' },
    ['', '수요일 아침, 중간 시험. 강의동에는 펜 긁히는 소리만 가득했다.'],
    ['serena', 'normal', '…시작 전에 손이 떨리는 사람은 지금 나가는 게 좋아. 시험관은 그런 걸 다 봐.'],
    ['', '시험지가 넘어왔다. 첫 문제는 「무색 마력의 공명 조건을 서술하시오」.'],
    { if: (S) => S.stats.int >= 34, go: [
      ['', '…알고 있다. 도서관에서 밤새 읽은 내용이 그대로 떠오른다. 펜이 멈추지 않는다.'],
      { sfx: 'event' },
      ['', '【 결과: 학년 상위 5위 이내 】'],
      ['serena', 'smile', '…흥. 나와 2점 차이. 다음엔 안 봐줘.'],
      { aff: { serena: 3 }, stats: { gold: 80, charm: 2 } },
      ['', '장학금 80골드를 받았다. 복도에서 다른 학생들이 수군거린다. 「무색인데 상위권이래.」'],
    ], else: [
      { if: (S) => S.stats.int >= 20, go: [
        ['', '아는 문제와 모르는 문제가 반반. 어떻게든 답안지를 채웠다.'],
        ['', '【 결과: 학년 중간 】'],
        ['lizette', 'normal', '평균 근처. 데이터로서는 가장 흔한 결과야. 나쁘지 않아.'],
        { aff: { lizette: 2 }, stats: { gold: 40, int: 1 } },
      ], else: [
        ['', '…모르겠다. 문제를 읽는 것만으로도 머리가 지끈거린다.'],
        ['', '【 결과: 추가 과제 대상 】'],
        ['lizette', 'cold', '…내 노트 사본이야. 받아.'],
        ['lizette', 'soft', '기록은 공유할 때 가치가 생기니까. 다음엔 같이 공부해.'],
        { aff: { lizette: 4 }, stats: { int: 3 } },
      ] },
    ] },
  ],

  // 19일(금): 유적 합동 실습
  field: [
    { bgm: 'battle', bg: 'outskirts', tint: 'am' },
    ['', '기사학과·탐험학과·마법학과 합동 실습. 목적지는 북쪽 유적의 원형 신전.'],
    ['', '그런데 신전 중앙의 석상에 금이 가더니── 고대 골렘이 몸을 일으켰다!'],
    { fx: 'shake' }, { fx: 'flash' },
    ['교관', '전원 2인 1조로 흩어져! 핵을 노려라!'],
    { run: async (G) => {
      const S = G.S;
      const ids = G.replay ? [] : ORDER.filter((id) => S.intro[id]);
      let who = null;
      if (ids.length) {
        await G.say('', null, '함께 싸울 사람은──');
        const i = await G.choose([...ids.map((id) => ({ t: `${CHARS[id].name}에게 등을 맡긴다` })), { t: '혼자 해본다' }]);
        who = ids[i] || null;
      }
      if (who) {
        const [a, b] = FIELD_LINES[who];
        await G.play([{ show: who }, [who, a[0], a[1]]]);
      } else await G.say('me', null, '…혼자서라도, 해내야 해.');
      await G.play([{ fx: 'shake' }, ['', '골렘의 주먹이 땅을 내리친다. 흙먼지 속에서 핵의 빛이 번쩍였다!']]);
      const ok = S.stats.str + S.stats.brave + (S.skills.insight ? 10 : 0) >= 60;
      if (ok) await G.play([{ fx: 'flash' }, { sfx: 'event' }, ['', '무색의 마력을 담은 일격이 핵을 꿰뚫었다. 골렘이 천천히 무너져 내린다.'], ['', '【 실습 결과: 최우수 조 】'], { stats: { brave: 2, gold: 60 } }]);
      else await G.play([['', '핵에 닿지 못했다. 교관의 결계 덕분에 간신히 물러났지만, 둘 다 무사했다.'], ['', '【 실습 결과: 통과 】'], { stats: { brave: 1 } }]);
      if (who) { await G.play([{ show: who }, [who, FIELD_LINES[who][1][0], FIELD_LINES[who][1][1]]]); G.addAff(who, ok ? 7 : 5); }
    } },
    { hide: 1 },
    ['', '돌아오는 길, 무너진 골렘의 핵이 희미하게 별등과 같은 빛을 내고 있었다.'],
  ],

  // 27일(토): 축제 준비 위원회
  prep: [
    { bgm: 'market', bg: 'market', tint: 'pm' },
    ['', '별빛 축제까지 여드레. 광장에 축제 준비 위원회 모집 게시판이 붙었다.'],
    ['', '청강생인 나는 어느 위원회든 들어갈 수 있다. 어디를 도울까?'],
    { choice: [
      { t: '🎆 장식·불꽃 담당 (로제, 루나)', aff: { rose: 5, luna: 5 }, stats: { brave: 2 }, go: [
        { show: 'rose' }, ['rose', 'smile', '왔구나! 올해 불꽃은 내가 설계해. 루나는 높은 데 매다는 담당!'],
        ['luna', 'smile', '지붕 위는 내 구역이야! {P}, 등불 좀 던져줘!'],
        ['', '해 질 녘까지 광장 곳곳에 별 모양 등불을 매달았다.'] ] },
      { t: '🕊️ 성가대 반주 (아리아)', aff: { aria: 7 }, stats: { charm: 2 }, go: [
        { bg: 'church' }, { show: 'aria' }, ['aria', 'smile', '반주를 맡아주신다니 든든해요. 축제 날 밤, 별등을 위한 노래를 불러요.'],
        ['aria', 'fluster', '…연습 끝나고, 조금만 더 같이 있어도 될까요?'] ] },
      { t: '⚔️ 경비 계획 (카밀라)', aff: { camilla: 7 }, stats: { str: 2 }, go: [
        { bg: 'training' }, { show: 'camilla' }, ['camilla', 'serious', '인파가 몰리는 곳은 탑 계단과 광장 분수. 여기 두 곳에 인원을 집중한다.'],
        ['camilla', 'smile', '…네 의견, 꽤 날카로웠어. 축제 날엔 나랑 같은 조야.'] ] },
      { t: '📜 별등 기록 정리 (세레나, 리제트, 노엘)', aff: { serena: 4, lizette: 4, noelle: 4 }, stats: { int: 2 }, go: [
        { bg: 'library' }, ['noelle', 'think', '역대 별빛 축제의 기록이야. 백 년 전 것만, 이상하게 비어 있어.'],
        ['lizette', 'normal', '공백도 정보야. 무언가를 감추려 했다는 증거니까.'],
        ['serena', 'normal', '…셋이서 하면 오늘 안에 끝나. 집중해.'] ] },
      { t: '💰 물자 조달 (베아트릭스)', aff: { beatrix: 7 }, stats: { gold: 60 }, go: [
        { show: 'beatrix' }, ['beatrix', 'smirk', '등불 3천 개, 꽃 500다발, 와인은… 학생용이 아니니 넘어가고.'],
        ['beatrix', 'smile', '네 덕에 단가를 2할이나 깎았어. 이건 수고비. 받아 둬.'] ] },
    ] },
    { hide: 1 },
    ['', '광장의 등불이 하나둘 켜진다. 축제가, 바로 앞까지 와 있었다.'],
  ],

  eveAlone: [
    { bg: 'dorm', tint: 'night' },
    ['', '5월 4일, 축제 전날 밤.'],
    ['', '기숙사 창밖으로 탑 위의 별등이 보인다. 내일 밤, 저 불빛은 다시 타오를 것이다.'],
    ['', '…나는 누구의 곁에 서 있게 될까. 대답은 아직 오지 않았다.'],
  ],

  // 트루 엔딩: 여덟 명 모두와 함께
  trueEnd: [
    { bg: 'festival', pt: 'stars' },
    ['', '별등 앞으로 걸어가자, 그곳에 여덟 사람이 모여 있었다. 약속한 것도 아닌데.'],
    ['luna', 'smile', '헤헤, 다들 똑같은 생각이었나 봐!'],
    ['beatrix', 'smirk', '이 정도면 공동 투자라고 해야겠네.'],
    ['', '그때, 별등이 크게 흔들렸다. 꺼지기 직전의 촛불처럼.'],
    { fx: 'shake' },
    ['학원장', '……역시, 자네였군.'],
    ['', '어둠 속에서 학원장이 걸어 나왔다. 지팡이 끝에, 색이 없는 빛이 맺혀 있었다.'],
    ['학원장', '백 년 전, 나도 무색의 빛이었네. 그리고 단 한 사람만을 비췄지. 관측자 가문의 소녀였어.'],
    ['noelle', 'surprise', '…그럼, 찢겨나간 기록은.'],
    ['학원장', '내가 찢었네. 그녀를 지키려고. …하지만 한 사람만을 비춘 별등은, 백 년밖에 버티지 못했지.'],
    ['학원장', '자네는 달랐어. 여덟 개의 빛 모두와 마음을 나눴지. 이제 별등은── 여덟 색 모두로 타오를 걸세.'],
    { sfx: 'event' },
    ['', '나는 손을 내밀었다. 여덟 개의 손이, 하나씩 그 위에 겹쳐졌다.'],
    ['serena', 'soft', '…계산할 필요도 없네. 이게 정답이야.'],
    ['camilla', 'smile', '지키고 싶은 사람이, 이렇게 많아졌어.'],
    ['aria', 'smile', '혼자가 아니에요. 이제 아무도.'],
    ['lizette', 'soft', '기록할게. 오늘, 여덟 개의 빛이 하나가 되었다고.'],
    ['rose', 'smile', '최고의 실험이야! 폭발도 안 했고!'],
    { fx: 'white' },
    { pt: 'fireworks' },
    ['', '무색의 빛이 여덟 갈래로 퍼져, 은빛·금빛·붉은빛·흰빛·보랏빛·불꽃빛·검은빛·호박빛으로 피어났다.'],
    ['', '별등은 그 어느 때보다 밝게 타올랐다. 학원 전체가, 대낮처럼 환해졌다.'],
    ['학원장', '…고맙네, {P} 군. 다음 백 년은, 자네들의 몫일세.'],
    ['', '── TRUE END 「아홉 번째 빛」'],
  ],
});

/* 유적 합동 실습 대사 [전투 중, 전투 후] */
const FIELD_LINES = {
  serena: [['cold', '정령 결계 전개. 3초 벌어줄게. 네 마력으로 핵을 노려.'], ['shy', '…네 판단이 맞았어. 이번만은 칭찬해 줄게.']],
  luna: [['smile', '오른쪽은 내가! 넌 왼쪽! 하나, 둘──!'], ['soft', '헤헤… 우리 호흡, 꽤 잘 맞지 않아?']],
  camilla: [['serious', '내 뒤에 서. 내가 막는 동안 틈을 찾아.'], ['smile', '…등을 맡길 수 있는 사람이 있다는 건, 이런 느낌이구나.']],
  aria: [['serious', '다치면 바로 말해요. 제가 있는 한, 아무도 쓰러지지 않아요.'], ['smile', '…다행이에요. 당신이 무사해서, 정말로.']],
  lizette: [['cold', '룬 배열 분석 완료. 약점은 왼쪽 무릎 아래, 세 번째 문양.'], ['soft', '…기록할게. 「공동 작전 성공. 파트너 평가: 우수」.']],
  rose: [['provoke', '이럴 때 쓰라고 만든 거지! 특제 섬광탄, 간다~!'], ['smile', '봤어?! 폭발은 역시 예술이라니까!']],
  noelle: [['think', '…기록에 따르면 이 골렘은 소리에 반응해. 숨 참고, 따라와.'], ['fluster', '…관측자가 현장에 나서다니. 이건 기록에 안 남길 거야.']],
  beatrix: [['smirk', '길드 감사 차 따라왔더니 이게 무슨 일이람. 좋아, 투자 보호 차원에서 도와주지.'], ['smile', '훌륭한 성과야. 위험수당은 나중에 저녁으로 받을게.']],
};

/* ───────────────────────── 주말 데이트 ───────────────────────── */
const DATES = {
  serena: [
    { bg: 'market', tint: 'am' }, { show: 'serena' },
    ['', '주말 아침, 광장 시계탑 아래. 세레나는 약속 시간 10분 전에 와 있었다.'],
    ['serena', 'fluster', '…데이트가 아니라 서점 탐방이야. 착각하지 마.'],
    ['', '골목 안쪽의 오래된 서점. 그녀는 학술서 코너가 아니라, 구석의 연애 소설 서가 앞에서 멈췄다.'],
    ['serena', 'fluster', '……본 거 아니지? 이건, 그, 문학적 자료 조사야.'],
    { choice: [
      { t: '나도 그 시리즈 좋아해.', go: [['serena', 'shy', '…정말? 3권 결말, 어떻게 생각해? 아니, 진지하게 묻는 거야.'], ['', '그날 우리는 찻집에서 세 시간 동안 소설 이야기만 했다.']] },
      { t: '못 본 걸로 해줄게.', go: [['serena', 'smile', '…현명한 판단이야. 대신 차는 내가 살게.']] },
    ] },
    ['serena', 'soft', '…이상하네. 계획에 없던 하루였는데, 계산이 맞지 않아도 괜찮았어.'],
  ],
  luna: [
    { bg: 'sea', tint: 'pm' }, { show: 'luna' },
    ['luna', 'smile', '저게 바다야?! 진짜 끝이 안 보여!'],
    ['', '루나는 신발을 벗어 던지더니 파도를 향해 달려갔다. 꼬리가 미친 듯이 흔들리고 있었다.'],
    ['luna', 'fluster', '으앗, 짜! 바닷물 짜!'],
    ['luna', 'soft', '…숲에선 상상도 못 했어. 세상에 이렇게 큰 게 있다니.'],
    { choice: [
      { t: '다음엔 바다 건너편에 가보자.', go: [['luna', 'smile', '약속! 배 타는 법부터 배워야겠다!']] },
      { t: '루나가 웃는 걸 보니 나도 좋다.', go: [['luna', 'fluster', '…갑자기 그런 말 하면, 꼬리가 멈추질 않잖아.']] },
    ] },
    ['', '해가 질 때까지, 우리는 바위 위에 앉아 수평선을 바라보았다.'],
  ],
  camilla: [
    { bg: 'outskirts', tint: 'am' }, { show: 'camilla' },
    ['camilla', 'smile', '말 타본 적 없다고 했지? 오늘은 내가 가르쳐줄게. 이 애는 얌전하니까 겁먹지 마.'],
    ['', '카밀라의 말은 유적 너머 들판을 가볍게 달렸다. 나는 그 뒤를 비틀비틀 따라갔다.'],
    ['camilla', 'serious', '고삐를 너무 당기지 마. 말은 기수의 긴장을 그대로 느껴.'],
    ['camilla', 'soft', '…오빠랑 자주 이 길을 달렸어. 다시 올 수 있을 거라곤 생각 못 했는데.'],
    { choice: [
      { t: '그럼 이제 우리 길로 하자.', go: [['camilla', 'fluster', '…우리 길. 응. 그거, 좋다.']] },
      { t: '오빠분도 기뻐하실 거야.', go: [['camilla', 'smile', '…그래. 분명 웃고 있을 거야. 「드디어 쉬는 법을 배웠냐」면서.']] },
    ] },
    ['', '돌아오는 길, 그녀는 처음으로 리본을 반쯤 풀고 바람에 머리카락을 맡겼다.'],
  ],
  aria: [
    { bg: 'chapel', tint: 'am', pt: 'petals' }, { show: 'aria' },
    ['', '오늘은 내가 도시락을 싸 왔다. 성당 정원의 벤치에 보자기를 펼쳤다.'],
    ['aria', 'fluster', '제, 제가 대접받는 쪽이라니… 어떻게 앉아 있어야 할지 모르겠어요.'],
    ['me', '그냥 먹으면 돼. 오늘 아리아는 아무것도 안 해도 돼.'],
    ['aria', 'smile', '……맛있어요. 누가 만들어준 밥, 정말 오랜만이에요.'],
    { choice: [
      { t: '매주 만들어 올게.', go: [['aria', 'fluster', '매주요?! …그럼 저도 매주, 여기서 기다릴게요.']] },
      { t: '다음엔 같이 만들자.', go: [['aria', 'smile', '좋아요! 저, 수프는 자신 있어요.']] },
    ] },
    ['', '바람이 불자 하얀 꽃잎이 그녀의 머리 위로 내려앉았다. 아리아는 떼어내지 않고, 그냥 웃었다.'],
  ],
  lizette: [
    { bg: 'tower', tint: 'night', pt: 'stars' }, { show: 'lizette' },
    ['lizette', 'normal', '천체 관측. 오늘은 4월 중 대기가 가장 맑은 밤이야. 확률 87%.'],
    ['', '언덕 위에 천구의를 놓고, 그녀는 별의 위치를 하나하나 마도서에 적어 나갔다.'],
    ['lizette', 'blank', '……. 별똥별.'],
    ['', '펜을 쥔 손이 멈췄다. 그녀는 처음으로, 적지 않고 하늘을 올려다보았다.'],
    { choice: [
      { t: '안 적어도 돼?', go: [['lizette', 'soft', '…응. 오늘은 기억하고 싶어. 기록 말고, 기억으로.']] },
      { t: '소원 빌었어?', go: [['lizette', 'fluster', '…비과학적이야. …빌긴 했어. 내용은 비공개.']] },
    ] },
    ['lizette', 'soft', '너와 있으면, 기록하지 않아도 잊어버리지 않을 것 같아.'],
  ],
  rose: [
    { bg: 'lab', tint: 'pm' }, { show: 'rose' },
    ['rose', 'smile', '주말엔 공방이 비거든! 오늘은 축제용 불꽃 시제품 제작이야. 조수, 고글 써!'],
    ['', '화약 대신 연금 가루를 섞고, 무색의 마력을 조금 흘려 넣었다.'],
    ['rose', 'tease', '셋, 둘, 하나…!'],
    { fx: 'flash' }, { fx: 'shake' },
    ['', '퐁. 작은 불꽃이 공방 천장에서 장미 모양으로 피었다가 사라졌다. 그리고 둘의 얼굴은 검댕투성이가 되었다.'],
    ['rose', 'smile', '아하하하! 너 얼굴 봐! 너구리 같아!'],
    { choice: [
      { t: '너도 마찬가지거든.', go: [['rose', 'fluster', '에? 진짜? …그럼 우리 커플 너구리네. 아, 아니 방금 건 말실수!']] },
      { t: '그래도 예뻤어. 불꽃.', go: [['rose', 'fluster', '…응. 너랑 만든 거라서 더 예뻤던 것 같아.']] },
    ] },
  ],
  noelle: [
    { bg: 'library', tint: 'pm', pt: 'rain' }, { show: 'noelle' },
    ['', '폐관 시간. 창밖으로 비가 쏟아지고 있었다.'],
    ['noelle', 'blank', '…우산, 없지? 그럴 것 같았어.'],
    ['noelle', 'normal', '하나 있어. 둘이 쓰기엔 좁지만.'],
    { bg: 'market', fade: true },
    ['', '빗소리 가득한 광장. 작은 우산 아래, 어깨가 자꾸 닿았다.'],
    ['noelle', 'fluster', '…젖어. 더 붙어.'],
    { choice: [
      { t: '노엘 쪽으로 우산을 기울인다.', go: [['noelle', 'surprise', '…네 어깨가 다 젖잖아. 바보.'], ['noelle', 'smile', '…그래도, 고마워.']] },
      { t: '비 오는 날이 좋아졌어.', go: [['noelle', 'smile', '…그거, 내가 제일 좋아하는 날이야. 이제 둘이네.']] },
    ] },
    ['', '기숙사까지 가는 길이, 오늘따라 짧게 느껴졌다.'],
  ],
  beatrix: [
    { bg: 'market', tint: 'pm' }, { show: 'beatrix' },
    ['beatrix', 'smirk', '데이트? 아니, 시장 조사야. 경쟁 상단 가격을 확인하러 가는 거지. 넌 짐꾼.'],
    ['', '그녀는 노점마다 멈춰 서서 가격을 묻고, 웃으며 값을 반으로 깎아냈다.'],
    ['beatrix', 'normal', '…이거. 싸구려 유리 반지야. 원가는 동전 세 닢.'],
    ['beatrix', 'fluster', '두 개 샀어. 그, 시장 조사 기념품. 하나는 네 거.'],
    { choice: [
      { t: '평생 낄게.', go: [['beatrix', 'fluster', '…원가 동전 세 닢짜리를? …바보네. 그래서 좋지만.']] },
      { t: '이건 얼마로 쳐줄 거야?', go: [['beatrix', 'soft', '…값을 못 매기겠어. 장사꾼한텐 치명적인 일이지.']] },
    ] },
    ['', '노을 속에서 그녀는 장부 대신, 자기 손가락의 반지를 한참 바라보았다.'],
  ],
};

/* ───────────────────────── 축제 전야 (호감도 최고 히로인) ───────────────────────── */
const EVE = {
  serena: [
    { bg: 'library', tint: 'night', pt: 'motes' }, { show: 'serena' },
    ['', '축제 전날 밤. 도서관 불빛을 보고 들어가자, 세레나가 창가에 서 있었다.'],
    ['serena', 'normal', '…올 줄 알았어. 확률 계산은 안 했지만.'],
    ['serena', 'shy', '내일, 별등 앞에서 할 말이 있어. 그러니까── 오늘은 그냥, 같이 있어 줘.'],
    ['', '우리는 말없이 같은 책을 넘겼다. 페이지가 넘어가는 소리가, 이상하게 다정했다.'],
  ],
  luna: [
    { bg: 'tower', tint: 'night', pt: 'stars' }, { show: 'luna' },
    ['luna', 'smile', '{P}! 이쪽! 지붕 위에서 보는 별등이 제일 예쁘다구!'],
    ['', '기숙사 지붕 위. 루나는 무릎을 감싸 안고 앉아 있었다.'],
    ['luna', 'soft', '…있잖아. 늑대는 보름달 뜨는 밤에 제일 소중한 걸 생각한대.'],
    ['luna', 'fluster', '오늘은 반달이지만… 그래도 생각했어. 누구냐고? 내일 말해줄게!'],
  ],
  camilla: [
    { bg: 'training', tint: 'night' }, { show: 'camilla' },
    ['', '아무도 없는 훈련장. 카밀라가 검 대신 리본을 손에 쥐고 있었다.'],
    ['camilla', 'fluster', '…훈련하러 온 거 아니야. 그냥, 잠이 안 와서.'],
    ['camilla', 'soft', '내일은 경비 근무 끝나면 자유야. 그러니까… 별등 앞에서 기다려도 될까.'],
    ['', '그녀는 대답을 듣기도 전에, 붉어진 얼굴로 달아나 버렸다.'],
  ],
  aria: [
    { bg: 'church', tint: 'night', pt: 'motes' }, { show: 'aria' },
    ['', '밤의 성당. 아리아가 내일 부를 성가를 혼자 연습하고 있었다.'],
    ['aria', 'smile', '…들으셨어요? 부끄러워라.'],
    ['aria', 'normal', '내일은 별등을 위해 노래해요. 그런데… 한 소절만은, 당신을 생각하며 불러도 될까요.'],
    ['', '그녀의 노랫소리가 스테인드글라스를 지나 밤하늘로 흩어졌다.'],
  ],
  lizette: [
    { bg: 'class', tint: 'night' }, { show: 'lizette' },
    ['lizette', 'normal', '…마도서의 남은 페이지를 셌어. 정확히 한 장.'],
    ['lizette', 'blank', '무엇을 적을지, 하루 종일 고민했어. 이런 건 처음이야.'],
    ['lizette', 'soft', '내일 밤, 그 한 장을 채우러 갈게. …네 옆에서.'],
  ],
  rose: [
    { bg: 'lab', tint: 'night' }, { show: 'rose' },
    ['rose', 'serious', '…불꽃 최종 점검 끝. 이번엔 안 터져. 아니, 터지긴 하는데 하늘에서 터져.'],
    ['rose', 'fluster', '있잖아, 내일 마지막 불꽃은 내가 직접 쏠 거야. 장미 모양으로.'],
    ['rose', 'fluster', '…그거, 누구 보라고 쏘는 건지 알지? 모르면 바보야.'],
  ],
  noelle: [
    { bg: 'library', tint: 'night', pt: 'rain' }, { show: 'noelle' },
    ['', '축제 전날 밤인데도, 도서관에는 노엘 혼자였다. 밖에는 가랑비가 내렸다.'],
    ['noelle', 'think', '…내일은 맑대. 기록상 백 년 전 축제 날도 맑았어.'],
    ['noelle', 'fluster', '나, 관측자 기록을 오늘 밤 덮을 거야. 내일부터는── 기록 밖에서 살아볼래.'],
  ],
  beatrix: [
    { bg: 'market', tint: 'night' }, { show: 'beatrix' },
    ['', '불 꺼진 상인 길드. 베아트릭스가 장부를 덮고 와인잔 대신 찻잔을 들었다.'],
    ['beatrix', 'normal', '내일 축제 매출 예측치 계산 끝. …이상하게 집중이 안 되네.'],
    ['beatrix', 'soft', '숫자로 설명할 수 없는 게 생겼거든. 내일, 그걸 확인하러 갈 거야.'],
  ],
};

/* 노멀 엔딩에서 멀리서 건네는 한마디 */
const FRIEND_LINES = {
  serena: '…다음 학기에도, 질문은 정리해서 가져와.', luna: '다음 탐험 땐 꼭 같이 가자! 약속이다!', camilla: '좋은 축제였어. …내일 훈련, 늦지 마.',
  aria: '오늘도 무사해서 다행이에요. 또 정원에 놀러 오세요.', lizette: '오늘의 기록에, 너도 적어 둘게.', rose: '내년 불꽃은 더 크게 터뜨릴 거야! 기대해!',
  noelle: '…좋은 밤이네. 기록할 가치가 있어.', beatrix: '내년에도 길드 아르바이트, 잘 부탁해.',
};

const END_TITLES = {
  normal: '모두를 비추는 빛', true: '아홉 번째 빛',
  serena: '차가운 지성, 그 너머의 온기', luna: '세상 끝까지, 둘이서', camilla: '흔들리지 않는 검, 따뜻한 마음', aria: '곁을 비추는 조용한 빛',
  lizette: '세상을 기록하는 눈', rose: '불꽃 같은 호기심의 끝에서', noelle: '흩어진 세계를 손에 쥐는 검은 날개', beatrix: '세상을 움직이는 거래의 주인',
};
const END_HINTS = {
  normal: '특별한 누군가 없이, 무색의 빛 5장을 마치지 못한 채 축제를 맞이한다',
  true: '여덟 명 모두를 만나고 모두의 호감도를 40 이상으로. 그리고 무색의 빛 5장까지',
  solo: '무색의 빛 이야기를 5장까지 마치고, 축제의 밤 혼자 탑에 오른다',
  ...Object.fromEntries(ORDER.map((id) => [id, `이야기 3개를 모두 보고 호감도 80 이상 (${STATS[CHARS[id].req.stat]} ${CHARS[id].req.v} 필요)`])),
};

/* ───────────────────────── 일상 대화 추가분 ───────────────────────── */
const MORE_TALKS = {
  serena: [
    { q: [['serena', 'normal', '어제 도서관에서 졸던 거, 다 봤어.']], c: [
      ['…침 흘렸어?', 3, [['serena', 'smile', '…조금. 걱정 마, 기록은 안 했어. 리제트라면 했겠지만.']]],
      ['깨워주지 그랬어.', 3, [['serena', 'fluster', '…잘 자길래. 그, 그냥 그랬어.']]],
      ['세레나가 날 보고 있었다는 거네?', 5, [['serena', 'fluster', '……! 시야에 들어왔을 뿐이야. 의도적인 관찰이 아니야.']]],
    ] },
    { q: [['serena', 'cold', '정령은 계약자의 마음이 흔들리면 응답하지 않아. 그래서 난 흔들리지 않으려고 해.']], c: [
      ['흔들려도 괜찮아. 내가 잡아줄게.', 5, [['serena', 'shy', '…그런 말에 흔들리면 어떡하라고.']]],
      ['그럼 정령이랑은 친해?', 3, [['serena', 'smile', '내 바람의 정령은 꽤 수다스러워. 너에 대해서도 자주 물어.']]],
      ['피곤하겠다.', 2, [['serena', 'normal', '…익숙해. 피곤한 것도.']]],
    ] },
    { q: [['serena', 'normal', '이 문제, 답이 두 개 나와. 네 생각은?']], c: [
      ['둘 다 정답일 수도 있잖아.', 4, [['serena', 'smile', '…예외 해를 인정하자는 거네. 대담한데. 마음에 들어.']]],
      ['더 아름다운 쪽.', 4, [['serena', 'soft', '수식에도 아름다움이 있다는 걸 아는구나.']]],
      ['모르겠어.', 1, [['serena', 'normal', '모른다고 말할 줄 아는 건, 그래도 미덕이야.']]],
    ] },
    { q: [['serena', 'shy', '…너, 내 이름 부를 때 발음이 좀 이상해. 다시 불러봐.']], c: [
      ['세레나.', 5, [['serena', 'fluster', '……. 됐어. 이상한 거 아니었어. 내 귀가 이상했나 봐.']]],
      ['세레나 님?', 2, [['serena', 'cold', '…농담하지 마.']]],
      ['수석님.', 1, [['serena', 'normal', '…그렇게 부르는 사람은 많아.']]],
    ] },
  ],
  luna: [
    { q: [['luna', 'smile', '오늘 나무 위에서 다람쥐랑 눈싸움했다! 내가 이겼어!']], c: [
      ['다람쥐 상대로 진심이야?', 3, [['luna', 'tease', '사냥감 앞에선 언제나 진심이지!']]],
      ['나랑도 해볼래?', 4, [['luna', 'fluster', '…너, 너랑은 안 돼. 이상하게 내가 먼저 피할 것 같아.']]],
      ['대단하다!', 3, [['luna', 'smile', '헤헤, 칭찬 받았다~!']]],
    ] },
    { q: [['luna', 'normal', '수업 시간에 가만히 앉아 있으면 다리가 근질근질해.']], c: [
      ['끝나고 같이 뛰자.', 5, [['luna', 'smile', '진짜?! 학원 외벽 한 바퀴 경주다! 지는 쪽이 고기 사기!']]],
      ['조금만 참아.', 2, [['luna', 'normal', '…쳇. 네가 그러라면 참아볼게.']]],
      ['몰래 나가자.', 3, [['luna', 'tease', '오, 의외로 불량하네? 좋아!']]],
    ] },
    { q: [['luna', 'fluster', '…아, 냄새 맡고 있던 거 아니야! 그냥 바람 방향이 그쪽이었어!']], c: [
      ['무슨 냄새 나?', 4, [['luna', 'soft', '…햇빛 냄새. 너한텐 늘 그런 냄새가 나.']]],
      ['괜찮아, 실컷 맡아.', 3, [['luna', 'fluster', '실컷이라니?! 그, 그런 거 아니라니까!']]],
      ['좀 부끄럽다.', 2, [['luna', 'tease', '헤헤, 너도 부끄러워할 줄 아는구나.']]],
    ] },
    { q: [['luna', 'serious', '탐험학과 졸업하면 다들 길드 탐험대에 들어가. 근데 난 내 맘대로 가고 싶어.']], c: [
      ['자유로운 게 루나다워.', 4, [['luna', 'smile', '그치?! 역시 넌 알아주는구나!']]],
      ['그럼 나를 고용해.', 5, [['luna', 'fluster', '고용…? 아니, 넌 동료야. 그, 그 이상일 수도 있고.']]],
      ['안정적인 게 좋지 않아?', 1, [['luna', 'normal', '…그런 건 재미없어.']]],
    ] },
  ],
  camilla: [
    { q: [['camilla', 'serious', '오늘 후배가 울면서 훈련장을 나갔어. …내가 너무 엄했나.']], c: [
      ['내일 같이 사과하러 가자.', 5, [['camilla', 'soft', '…같이 가주는 거야? 고마워. 혼자선 말을 잘 못 해서.']]],
      ['카밀라는 옳았어.', 2, [['camilla', 'normal', '옳은 것과 좋은 건 다를 때가 있어.']]],
      ['원래 그런 거야.', 1, [['camilla', 'serious', '…그렇게 넘기고 싶진 않아.']]],
    ] },
    { q: [['camilla', 'normal', '검 손질하는 중이야. 날을 세우는 소리를 들으면 마음이 차분해져.']], c: [
      ['옆에서 들어도 돼?', 4, [['camilla', 'smile', '…조용히만 있으면. 아니, 가끔은 말 걸어도 돼.']]],
      ['나한테도 가르쳐줘.', 4, [['camilla', 'serious', '좋아. 숫돌 각도는 이십 도. 손목은 고정.']]],
      ['그 검 이름 있어?', 3, [['camilla', 'soft', '…「여명」. 오빠가 붙인 이름이야.']]],
    ] },
    { q: [['camilla', 'fluster', '어제 고양이한테 말 거는 거, 봤어?']], c: [
      ['귀여웠어.', 5, [['camilla', 'fluster', '귀, 귀엽다니! 기사한테 할 말이야?! …잊어. 당장.']]],
      ['못 봤어.', 2, [['camilla', 'normal', '…다행이다. 아니, 묻지 마.']]],
      ['고양이가 뭐래?', 4, [['camilla', 'smile', '…「밥」이래. 매일 같은 대답이야.']]],
    ] },
    { q: [['camilla', 'normal', '기사의 맹세는 세 가지야. 약자를 지키고, 거짓을 말하지 않으며, 등을 보이지 않는다.']], c: [
      ['카밀라는 다 지키고 있어.', 4, [['camilla', 'soft', '…세 번째는 가끔 어겨. 너한테서 도망칠 때.']]],
      ['나도 맹세할래.', 4, [['camilla', 'smile', '…청강생 기사라. 나쁘지 않네. 증인은 내가 될게.']]],
      ['어렵다.', 1, [['camilla', 'normal', '그래서 맹세라고 하는 거야.']]],
    ] },
  ],
  aria: [
    { q: [['aria', 'smile', '오늘은 정원에서 아기 새가 둥지를 떠났어요.']], c: [
      ['아리아가 지켜준 덕이네.', 4, [['aria', 'fluster', '저는 그냥 보고만 있었는걸요. …그래도, 기뻐요.']]],
      ['섭섭하지 않아?', 4, [['aria', 'sad', '…조금요. 그래도 날아가는 걸 보는 게, 지키는 사람의 몫이니까요.']]],
      ['새는 별로.', 0, [['aria', 'normal', '그러시군요…']]],
    ] },
    { q: [['aria', 'worry', '성녀 후보라서, 다들 저한테 고민을 털어놓아요. 그런데 저는… 누구한테 말하면 될까요.']], c: [
      ['나한테 말해.', 5, [['aria', 'sad', '…정말요? 그럼, 조금만.'], ['aria', 'smile', '…들어주셔서 고마워요. 가벼워졌어요.']]],
      ['신께 기도하면 되지 않아?', 1, [['aria', 'normal', '…그렇죠. 그렇게 하고 있어요.']]],
      ['일기를 써보는 건?', 3, [['aria', 'smile', '일기… 리제트 씨처럼요? 해볼게요.']]],
    ] },
    { q: [['aria', 'normal', '손이 차가우시네요. 잠깐만요.']], c: [
      ['…따뜻하다.', 5, [['aria', 'fluster', '치, 치유 마법이에요! 그냥 손을 잡은 게 아니라…!']]],
      ['괜찮아, 아리아 마력 아껴.', 3, [['aria', 'smile', '이 정도는 마법이 아니라 그냥 체온이에요.']]],
      ['원래 손이 차.', 2, [['aria', 'normal', '그럼 장갑을 떠드릴게요. 무슨 색이 좋아요?']]],
    ] },
    { q: [['aria', 'smile', '어릴 땐 성당 종을 치는 게 꿈이었어요. 지금은 매일 치지만요.']], c: [
      ['꿈을 이뤘네.', 3, [['aria', 'smile', '네. 그래서 지금은 새 꿈을 찾는 중이에요.']]],
      ['새 꿈은 뭐야?', 5, [['aria', 'fluster', '…비밀이에요. 하지만, 당신이랑 관련이 있을지도요.']]],
      ['나도 한 번 쳐보고 싶다.', 3, [['aria', 'smile', '그럼 내일 아침 6시에 오세요. 같이 쳐요!']]],
    ] },
  ],
  lizette: [
    { q: [['lizette', 'normal', '오늘 아침 식사. 빵 두 조각, 우유 한 잔. 너는?']], c: [
      ['그것도 기록해?', 3, [['lizette', 'normal', '전부. 기억이 사라져도, 내가 무엇으로 만들어졌는지 알 수 있게.']]],
      ['같은 메뉴였어.', 4, [['lizette', 'smile', '…공통점 발견. 기록해 둘게.']]],
      ['안 먹었어.', 2, [['lizette', 'cold', '비효율적이야. 이거, 먹어. …남아서 주는 거야.']]],
    ] },
    { q: [['lizette', 'blank', '…이 깃펜, 잉크가 거의 다 됐어. 아끼던 건데.']], c: [
      ['새 걸로 사줄게.', 4, [['lizette', 'fluster', '…그건, 선물이라는 행위야. 거절할 근거를 찾는 중이야.']]],
      ['아끼던 이유가 있어?', 4, [['lizette', 'soft', '…처음으로 너에 대해 적은 펜이라서. …방금 건 기록에서 지워줘.']]],
      ['잉크를 채우면 되지.', 2, [['lizette', 'normal', '…합리적이네.']]],
    ] },
    { q: [['lizette', 'cold', '감정은 관측 불가능한 변수야. 그런데 요즘 심박수가 불규칙해.']], c: [
      ['언제부터?', 5, [['lizette', 'fluster', '……네가 오고 나서부터. …아니, 이건 가설이야.']]],
      ['병원 가봐.', 1, [['lizette', 'blank', '…아리아에게 물어볼게.']]],
      ['나도 그래.', 4, [['lizette', 'soft', '…동일 증상. 공동 연구가 필요하겠네.']]],
    ] },
    { q: [['lizette', 'normal', '내 마도서, 「리제트 제7권」. 표지 색을 바꿔볼까 해.']], c: [
      ['보라색이 어울려.', 4, [['lizette', 'smile', '…눈 색이랑 같은 색. 그렇게 할게.']]],
      ['네가 좋아하는 색으로.', 3, [['lizette', 'blank', '좋아하는 색… 생각해본 적 없어. 숙제로 할게.']]],
      ['지금도 좋아.', 2, [['lizette', 'normal', '그럼 유지.']]],
    ] },
  ],
  rose: [
    { q: [['rose', 'smile', '방금 만든 발명품! 「자동 숙제 기계」! …아직 이름만 있어.']], c: [
      ['완성되면 나도 써도 돼?', 4, [['rose', 'tease', '흐흥, 사용료는 실험 조수 한 달!']]],
      ['그건 반칙 아니야?', 2, [['rose', 'provoke', '발명은 원래 반칙에서 시작하는 거야!']]],
      ['같이 만들자.', 5, [['rose', 'smile', '좋아, 공동 발명가! 특허는 반반이다!']]],
    ] },
    { q: [['rose', 'serious', '…가끔 생각해. 엄마가 남긴 지도, 사실 아무 의미 없는 거면 어쩌지.']], c: [
      ['의미는 우리가 만들면 돼.', 5, [['rose', 'smile', '…그 말, 엄마가 할 법한 말이야. 고마워.']]],
      ['분명 뭔가 있을 거야.', 4, [['rose', 'smile', '…응. 그렇게 믿을래!']]],
      ['그럼 그만둘래?', 0, [['rose', 'provoke', '그만두긴 누가! 그냥 해본 소리야!']]],
    ] },
    { q: [['rose', 'tease', '내 고글 써볼래? 세상이 분홍색으로 보여!']], c: [
      ['…로제도 분홍색이다.', 4, [['rose', 'fluster', '그, 그건 원래 내 볼이 빨개서… 아니, 고글 탓이야!']]],
      ['어지러워.', 2, [['rose', 'smile', '아하하! 초보자는 다 그래!']]],
      ['이거 갖고 싶다.', 3, [['rose', 'smile', '하나 더 만들어 줄게! 커플… 아니, 팀 고글로!']]],
    ] },
    { q: [['rose', 'normal', '연금술의 기본은 등가교환이래. 근데 난 그거 별로 안 믿어.']], c: [
      ['왜?', 3, [['rose', 'smile', '너랑 실험하면 넣은 것보다 더 많이 나오거든! 재미라든가!']]],
      ['나도 안 믿어.', 4, [['rose', 'tease', '오~ 반항아 동맹 결성이다!']]],
      ['원칙은 지켜야지.', 1, [['rose', 'provoke', '에이, 재미없어~']]],
    ] },
  ],
  noelle: [
    { q: [['noelle', 'think', '…이 책, 반납 기한이 87년 지났어. 대출자는 이미 이 세상 사람이 아니고.']], c: [
      ['연체료는 얼마야?', 3, [['noelle', 'smile', '…계산해보니 학원 하나 값. 농담이야.']]],
      ['그 사람이 궁금하다.', 4, [['noelle', 'normal', '…책 사이에 편지가 끼워져 있었어. 연애편지. 읽진 않았어. …조금만.']]],
      ['그냥 정리하면 되지.', 1, [['noelle', 'blank', '…그래.']]],
    ] },
    { q: [['noelle', 'blank', '…요즘 네가 오는 시간을 기다리게 돼. 업무에 방해야.']], c: [
      ['그럼 덜 올까?', 1, [['noelle', 'fluster', '…그런 뜻 아니야. 바보.']]],
      ['나도 기다려져.', 5, [['noelle', 'surprise', '……. 그럼, 서로 방해네. 공평하네.']]],
      ['매일 같은 시간에 올게.', 4, [['noelle', 'smile', '…그럼 그 시간엔 홍차를 두 잔 준비할게.']]],
    ] },
    { q: [['noelle', 'normal', '관측자의 규칙 첫 번째. 「보되, 닿지 말 것」.']], c: [
      ['힘들지 않아?', 4, [['noelle', 'fluster', '…요즘은 좀. 닿고 싶은 게 생겼거든.']]],
      ['나는 닿아도 돼.', 5, [['noelle', 'fluster', '…그런 말, 규칙 위반을 부추기는 거야. …알면서.']]],
      ['멋진 규칙이네.', 1, [['noelle', 'blank', '…그렇게 생각해?']]],
    ] },
    { q: [['noelle', 'think', '도서관 고양이가 네 의자에서만 자. 이유를 분석 중이야.']], c: [
      ['따뜻해서?', 3, [['noelle', 'smile', '…가설 1. 체온. 나도 그 가설을 지지해.']]],
      ['노엘도 앉아볼래?', 4, [['noelle', 'fluster', '…고양이랑 경쟁할 생각 없어. …나중에.']]],
      ['고양이가 있었어?', 2, [['noelle', 'normal', '항상 있었어. 넌 나만 보고 있었으니까 몰랐겠지. …방금 건 실언이야.']]],
    ] },
  ],
  beatrix: [
    { q: [['beatrix', 'smirk', '오늘 거래 하나 놓쳤어. 상대가 너무 정직해서, 깎을 수가 없더라.']], c: [
      ['좋은 사람을 만났네.', 4, [['beatrix', 'soft', '…그래. 손해 보는 장사였지만, 기분은 나쁘지 않았어.']]],
      ['베아트릭스답지 않네.', 3, [['beatrix', 'smile', '요즘 내가 나답지 않은 건, 누구 탓일까?']]],
      ['아깝다.', 1, [['beatrix', 'normal', '그렇지? 장부엔 손실로 남아.']]],
    ] },
    { q: [['beatrix', 'normal', '열여섯 살 때, 처음 맺은 계약이 뭐였는지 알아? 빵집 외상 장부였어.']], c: [
      ['그때부터 대단했구나.', 4, [['beatrix', 'smile', '대단하긴. 살아남으려고 했을 뿐이야.']]],
      ['힘들었겠다.', 5, [['beatrix', 'soft', '…그 말을 듣는 데 7년 걸렸네. 고마워.']]],
      ['빵 맛있었어?', 3, [['beatrix', 'smirk', '훗, 질문이 그거야? 맛있었어. 지금도 그 집 단골이야.']]],
    ] },
    { q: [['beatrix', 'smirk', '네 시간, 나한테 팔래? 한 시간에 금화 한 닢.']], c: [
      ['공짜로 줄게.', 5, [['beatrix', 'fluster', '…공짜는 제일 비싼 거야. 그걸 알고 하는 말이지?']]],
      ['두 닢이면.', 3, [['beatrix', 'smile', '협상할 줄 아네! 좋아, 한 닢 반.']]],
      ['안 팔아.', 1, [['beatrix', 'normal', '…아쉽네. 진심으로.']]],
    ] },
    { q: [['beatrix', 'normal', '길드 대표는 혼자 밥 먹는 날이 많아. 다들 날 어려워하거든.']], c: [
      ['오늘 같이 먹을래?', 5, [['beatrix', 'soft', '…좋아. 네가 사는 거야. 아니, 오늘은 내가 살게.']]],
      ['나도 좀 어려워.', 2, [['beatrix', 'smirk', '훗, 그래도 이렇게 말 걸잖아?']]],
      ['편하게 생각해.', 3, [['beatrix', 'smile', '그 말, 한 번 믿어볼게.']]],
    ] },
  ],
};
for (const [id, list] of Object.entries(MORE_TALKS)) STORY[id].talks.push(...list);

/* 배경 그림 출처 — tools/luminaria_bg.py 가 만든 img/CREDITS.json 과 같은 내용 */
const CREDITS_BG = /*CREDITS*/[{"bg": "class", "title": "Derbys First Exhibition 1839.jpg", "artist": "Samuel Rayner", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Derbys_First_Exhibition_1839.jpg"}, {"bg": "library", "title": "Charlotte Bosanquet - The Library at Dingestow - Google Art Project.jpg", "artist": "Charlotte Bosanquet (1790 - 1852)", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Charlotte_Bosanquet_-_The_Library_at_Dingestow_-_Google_Art_Project.jpg"}, {"bg": "training", "title": "Powis Castle, 1794.jpg", "artist": "John Ingleby", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Powis_Castle,_1794.jpg"}, {"bg": "outskirts", "title": "Hubert Robert - Landscape with the Ruins of the Round Temple, with a Statue of Venus and a Monument to Marcus Aurelius.jpg", "artist": "Hubert Robert", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Hubert_Robert_-_Landscape_with_the_Ruins_of_the_Round_Temple,_with_a_Statue_of_Venus_and_a_Monument_to_Marcus_Aurelius.jpg"}, {"bg": "lab", "title": "An alchemist in his laboratory. Oil painting by James Nasmyt Wellcome V0017640.jpg", "artist": "James Nasmyth", "license": "CC BY 4.0", "source": "https://commons.wikimedia.org/wiki/File:An_alchemist_in_his_laboratory._Oil_painting_by_James_Nasmyt_Wellcome_V0017640.jpg"}, {"bg": "chapel", "title": "Georg Pezolt Blick in den Klostergarten.jpg", "artist": "Georg Pezolt", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Georg_Pezolt_Blick_in_den_Klostergarten.jpg"}, {"bg": "church", "title": "Neeffs, Peeter the elder - Interior of a Gothic Church - Google Art Project.jpg", "artist": "Neeffs, Peeter the elder", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Neeffs,_Peeter_the_elder_-_Interior_of_a_Gothic_Church_-_Google_Art_Project.jpg"}, {"bg": "market", "title": "Domenico Quaglio Braunschweig Altstadtmarkt 1834.jpg", "artist": "Domenico Quaglio the Younger", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Domenico_Quaglio_Braunschweig_Altstadtmarkt_1834.jpg"}, {"bg": "dorm", "title": "Interior of a Library - Google Art Project.jpg", "artist": "Unknown author", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Interior_of_a_Library_-_Google_Art_Project.jpg"}, {"bg": "tower", "title": "Abraham Pether (1756-1812) - View of Pendragon Castle by Moonlight - 960239 - National Trust.jpg", "artist": "Abraham Pether", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Abraham_Pether_(1756-1812)_-_View_of_Pendragon_Castle_by_Moonlight_-_960239_-_National_Trust.jpg"}, {"bg": "festival", "title": "Oswald Achenbach Feuerwerk in Toree dell Annunziata.jpg", "artist": "Oswald Achenbach", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Oswald_Achenbach_Feuerwerk_in_Toree_dell_Annunziata.jpg"}, {"bg": "sea", "title": "Caspar David Friedrich - Mondaufgang am Meer - Google Art Project.jpg", "artist": "Caspar David Friedrich", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Mondaufgang_am_Meer_-_Google_Art_Project.jpg"}]/*END*/;
