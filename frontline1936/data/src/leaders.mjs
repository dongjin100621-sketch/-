/* 장군과 제독. 실제 인물이며, note에는 역할만 사실대로 적는다(평가와 미화는 하지 않는다). 능력치는 게임 설계값이다.
 * kind: army(군을 지휘) | navy(함대를 지휘). skill 1~5, atk 공격, def 방어, plan 계획(조직력 회복), log 보급(보급 사용 감소) 1~5.
 * traits: jungle 밀림, mountain 산악, cold 혹한, armor 기갑, amphibious 상륙, offensive 공세, defensive 방어전, logistics 병참, guerrilla 유격, carrier 항모, surface 함대 결전, submarine 잠수함.
 * from/until: 쓸 수 있는 기간. flag: 그 표식이 생기면 쓸 수 있다. */
const L = (id, country, name, kind, skill, atk, def, plan, log, traits, note, more = {}) => ({ id, country, name, kind, skill, atk, def, plan, log, traits, note, ...more });
export const LEADERS = [
  // 일본
  L('terauchi', 'japan', '데라우치 히사이치', 'army', 3, 3, 2, 3, 3, ['offensive'], '북지나 방면군·남방군 총사령관.'),
  L('yamashita', 'japan', '야마시타 도모유키', 'army', 4, 4, 3, 3, 2, ['jungle', 'offensive'], '1941~42년 말레이·싱가포르 작전을 지휘했다. 전후 전범 재판에서 처형되었다.'),
  L('imamura', 'japan', '이마무라 히토시', 'army', 3, 3, 3, 3, 3, ['amphibious'], '1942년 자바 작전, 뒤에 라바울의 제8방면군을 지휘했다.'),
  L('honma', 'japan', '혼마 마사하루', 'army', 2, 2, 2, 3, 2, ['amphibious'], '1941~42년 필리핀 작전을 지휘했다. 전후 전범 재판에서 처형되었다.'),
  L('umezu', 'japan', '우메즈 요시지로', 'army', 3, 2, 4, 3, 3, ['cold', 'defensive'], '1939년부터 관동군 사령관, 1944년 참모총장.'),
  L('hata', 'japan', '하타 슌로쿠', 'army', 3, 3, 3, 3, 3, [], '1938년 중지나 파견군, 1941년 지나 파견군 총사령관.'),
  L('yamamoto', 'japan', '야마모토 이소로쿠', 'navy', 4, 4, 2, 4, 2, ['carrier'], '1939~43년 연합함대 사령장관.'),
  L('nagumo', 'japan', '나구모 주이치', 'navy', 3, 3, 2, 2, 3, ['carrier'], '1941~42년 제1항공함대(기동 부대) 사령장관.'),
  L('kondo', 'japan', '곤도 노부타케', 'navy', 3, 3, 3, 3, 2, ['surface'], '제2함대 사령장관.'),
  L('ozawa', 'japan', '오자와 지사부로', 'navy', 3, 3, 3, 3, 3, ['carrier'], '1942년 말부터 제3함대, 뒤에 제1기동함대를 지휘했다.', { from: '1941-10-01' }),
  // 중화민국
  L('chen_cheng', 'china', '천청', 'army', 3, 2, 4, 3, 3, ['defensive'], '우한 회전과 이창 방면에서 지휘했다.'),
  L('xue_yue', 'china', '쉐웨', 'army', 4, 3, 5, 3, 2, ['defensive', 'mountain'], '창사 회전(1939·1941·1942)에서 방어를 지휘했다.'),
  L('tang_enbo', 'china', '탕언보', 'army', 2, 3, 2, 2, 2, [], '타이얼좡 전투 등 화북·화중에서 지휘했다.'),
  L('sun_liren', 'china', '쑨리런', 'army', 3, 4, 3, 3, 3, ['jungle'], '신1군을 이끌고 버마 전선에서 싸웠다.', { from: '1941-06-01' }),
  L('wei_lihuang', 'china', '웨이리황', 'army', 2, 2, 3, 2, 3, [], '원정군(Y군)을 지휘했다.'),
  L('ji_cheongcheon', 'china', '지청천', 'army', 2, 2, 2, 3, 2, ['guerrilla'], '한국광복군 총사령관(1940~).', { flag: 'kpg' }),
  // 중국 공산당
  L('zhu_de', 'ccp', '주더', 'army', 3, 3, 3, 3, 3, ['guerrilla'], '팔로군 총사령관.'),
  L('peng_dehuai', 'ccp', '펑더화이', 'army', 4, 4, 3, 3, 2, ['guerrilla', 'offensive'], '팔로군 부총사령관, 1940년 백단 대전을 지휘했다.'),
  L('lin_biao', 'ccp', '린뱌오', 'army', 4, 4, 3, 4, 2, ['guerrilla', 'mountain'], '1937년 핑싱관 전투를 지휘했다.'),
  L('liu_bocheng', 'ccp', '류보청', 'army', 3, 3, 3, 4, 2, ['guerrilla', 'mountain'], '팔로군 129사 사단장.'),
  L('chen_yi', 'ccp', '천이', 'army', 3, 3, 3, 3, 3, ['guerrilla'], '신사군 지휘관.'),
  // 소련
  L('blyukher', 'ussr', '블류헤르', 'army', 3, 3, 3, 3, 3, ['cold'], '특별 극동군 사령관. 1938년 숙청되었다.', { until: '1938-10-22' }),
  L('zhukov', 'ussr', '주코프', 'army', 5, 5, 4, 4, 3, ['armor', 'offensive'], '1939년 할힌골 전투를 지휘했다.', { from: '1939-06-01', until: '1940-06-01' }),
  L('shtern', 'ussr', '시테른', 'army', 2, 2, 3, 2, 3, ['cold'], '1938년 장고봉, 1939년 극동 방면 지휘.', { until: '1941-06-07' }),
  L('apanasenko', 'ussr', '아파나센코', 'army', 3, 2, 4, 3, 3, ['cold', 'defensive'], '1941~43년 극동 전선 사령관.', { from: '1941-01-01' }),
  L('vasilevsky', 'ussr', '바실렙스키', 'army', 5, 4, 4, 5, 4, ['armor', 'cold'], '1945년 극동 소련군 총사령관.', { from: '1945-06-01' }),
  L('malinovsky', 'ussr', '말리놉스키', 'army', 4, 4, 3, 4, 3, ['armor'], '1945년 자바이칼 전선 사령관.', { from: '1945-06-01' }),
  L('meretskov', 'ussr', '메레츠코프', 'army', 3, 3, 3, 3, 3, ['cold'], '1945년 제1극동 전선 사령관.', { from: '1945-06-01' }),
  L('yumashev', 'ussr', '유마셰프', 'navy', 3, 3, 3, 3, 3, ['submarine'], '1939~47년 태평양 함대 사령관.', { from: '1939-03-01' }),
  // 미국
  L('macarthur', 'usa', '맥아더', 'army', 4, 4, 3, 3, 3, ['amphibious'], '필리핀 군사 고문, 1942년부터 남서태평양 지역 사령관.'),
  L('stilwell', 'usa', '스틸웰', 'army', 3, 3, 3, 3, 4, ['jungle', 'logistics'], '중국·버마·인도 전구 사령관.', { from: '1942-02-01' }),
  L('eichelberger', 'usa', '아이컬버거', 'army', 3, 3, 3, 3, 3, ['jungle'], '부나 전투, 뒤에 제8군 사령관.', { from: '1942-08-01' }),
  L('krueger', 'usa', '크루거', 'army', 3, 3, 3, 4, 3, ['amphibious'], '제6군 사령관.', { from: '1943-01-01' }),
  L('hsmith', 'usa', '홀랜드 스미스', 'army', 3, 4, 2, 3, 2, ['amphibious', 'offensive'], '태평양 해병대 상륙 부대 지휘관.', { from: '1942-01-01' }),
  L('nimitz', 'usa', '니미츠', 'navy', 5, 4, 4, 5, 4, ['carrier'], '1941년 12월부터 태평양 함대 사령관.', { from: '1941-12-17' }),
  L('spruance', 'usa', '스프루언스', 'navy', 4, 4, 4, 4, 3, ['carrier'], '미드웨이 해전에서 지휘했다.', { from: '1942-05-01' }),
  L('halsey', 'usa', '홀시', 'navy', 4, 5, 2, 3, 3, ['carrier'], '제3함대 사령관.'),
  L('kinkaid', 'usa', '킨케이드', 'navy', 3, 3, 3, 3, 3, ['surface'], '제7함대 사령관.', { from: '1943-01-01' }),
  L('lockwood', 'usa', '록우드', 'navy', 3, 3, 2, 3, 4, ['submarine'], '태평양 잠수함대 사령관.', { from: '1943-02-01' }),
  // 영국
  L('slim', 'uk', '슬림', 'army', 5, 4, 4, 4, 4, ['jungle', 'logistics'], '버마 군단, 1943년부터 제14군 사령관.', { from: '1942-03-01' }),
  L('wavell', 'uk', '웨이벨', 'army', 3, 3, 3, 3, 3, [], '1941년부터 인도 총사령관, ABDA 사령관.', { from: '1941-07-01' }),
  L('percival', 'uk', '퍼시벌', 'army', 2, 2, 3, 2, 3, ['defensive'], '말라야 사령관. 1942년 싱가포르에서 항복했다.', { from: '1941-04-01' }),
  L('wingate', 'uk', '윈게이트', 'army', 3, 4, 1, 3, 1, ['jungle', 'guerrilla'], '장거리 침투 부대(친디트)를 지휘했다.', { from: '1942-03-01', until: '1944-03-24' }),
  L('somerville', 'uk', '서머빌', 'navy', 3, 3, 3, 3, 3, ['carrier'], '1942~44년 동양 함대 사령관.', { from: '1942-02-01' }),
  L('fraser', 'uk', '프레이저', 'navy', 4, 4, 3, 4, 3, ['surface'], '1944년부터 영국 태평양 함대 사령관.', { from: '1944-11-01' }),
  L('phillips', 'uk', '필립스', 'navy', 2, 3, 1, 2, 2, ['surface'], '1941년 Z부대 사령관.', { from: '1941-10-01', until: '1941-12-11' }),
  // 다른 나라
  L('bai_chongxi', 'guangxi', '바이충시', 'army', 4, 4, 3, 4, 3, ['mountain'], '광시파의 지휘관, 국민정부 부참모총장.'),
  L('li_zongren', 'guangxi', '리쭝런', 'army', 3, 3, 3, 3, 3, [], '광시파 지도자, 1938년 타이얼좡 전투를 지휘했다.'),
  L('fu_zuoyi', 'shanxi', '푸쭤이', 'army', 3, 3, 4, 3, 3, ['cold'], '쑤이위안의 지휘관.'),
  L('ma_bufang', 'ma', '마부팡', 'army', 2, 3, 2, 2, 2, ['mountain'], '칭하이의 군벌.'),
  L('long_yun', 'yunnan', '룽윈', 'army', 2, 2, 3, 2, 3, ['mountain'], '윈난의 주석.'),
  L('choibalsan', 'mongolia', '초이발산', 'army', 2, 2, 2, 2, 3, ['cold'], '몽골 인민군 지도자.'),
  L('blamey', 'australia', '블레이미', 'army', 3, 3, 3, 3, 3, ['jungle'], '오스트레일리아 육군 사령관.'),
  L('ter_poorten', 'netherlands', '테르 포르턴', 'army', 2, 2, 3, 2, 2, ['jungle'], '동인도 육군 사령관.'),
  L('doorman', 'netherlands', '도르만', 'navy', 2, 2, 2, 2, 2, ['surface'], '1942년 자바해 해전의 연합 함대 지휘관.'),
  L('phibun', 'siam', '피분송크람', 'army', 2, 2, 2, 2, 2, [], '시암의 총리·군 지도자.')
];
export const TRAITS = {
  jungle: { name: '밀림 전문', desc: '밀림·습지에서 공격과 방어 +15%' },
  mountain: { name: '산악 전문', desc: '산악·구릉에서 공격과 방어 +15%' },
  cold: { name: '혹한 경험', desc: '눈·눈보라의 공격 불이익과 소모를 절반으로' },
  armor: { name: '기갑 지휘', desc: '전차·차량화 부대의 돌파 +15%' },
  amphibious: { name: '상륙 전문', desc: '상륙 공격의 불이익을 절반으로' },
  offensive: { name: '공세', desc: '공격 +10%, 방어 −5%' },
  defensive: { name: '방어전', desc: '방어 +10%, 요새 효과 +50%' },
  logistics: { name: '병참', desc: '보급 사용 −15%' },
  guerrilla: { name: '유격', desc: '보급 사용 −20%, 산악·삼림·밀림에서 +10%' },
  carrier: { name: '항모 운용', desc: '함재기 공격 +20%' },
  surface: { name: '함대 결전', desc: '포격·어뢰 +15%' },
  submarine: { name: '잠수함 운용', desc: '통상 파괴 +30%' }
};
