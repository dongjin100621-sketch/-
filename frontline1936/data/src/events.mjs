/* 사건. date: 이 날 이후 조건이 맞으면 일어난다(한 번). to: 받는 나라. cond: 조건. options: 선택지(ai: AI가 고를 가중치).
 * 효과는 국가 중점과 같은 키에 더해: war [공격국, 대상국], peace [가, 나], nap [가, 나](불가침), embargo {by, on}, access [허락국, 받는 나라],
 * puppet [나라, 종주국], annex [나라 목록](받는 나라에 합친다), homelandLost 나라, ideology 이념, rename 이름, leaveFaction true, join 진영,
 * others {나라: 효과}, release 나라, removeDivisions {at: [지역], n}, endGame 이유.
 * history: 실제 역사(사실). 선택지의 '(역사)'는 실제로 일어난 쪽, '(가상)'은 이 게임의 가정이다.
 * 정치 폭력과 전쟁 범죄는 절차를 재현하지 않고 제도적 결과만 적는다. 민간인의 희생을 보상으로 쓰지 않는다. */
const E = o => o;
export const EVENTS = [
  E({ id: 'ev_226', date: '1936-02-26', to: 'japan', title: '2·26 사건', desc: '청년 장교들이 반란을 일으켜 도쿄 중심부를 점거했다. 반란은 나흘 만에 진압되었다.',
    history: '1936년 2월 26일. 진압 뒤 군부의 정치적 발언권이 오히려 커졌다.',
    options: [
      { name: '반란을 진압하고 군의 통제를 넓힌다(역사)', fx: { pp: 50, stability: -.03, popularity: { authoritarian: .05 } }, ai: 10 },
      { name: '의회가 군을 견제하게 한다(가상)', fx: { pp: -30, stability: -.05, warSupport: -.05, popularity: { democracy: .06 } }, ai: 0 }
    ] }),
  E({ id: 'ev_xian', date: '1936-12-12', to: 'china', title: '시안 사건', desc: '공산당 토벌을 지휘하던 장쉐량이 시안에서 장제스를 억류하고 내전 중지와 항일을 요구했다.',
    history: '1936년 12월. 이 사건 뒤 제2차 국공 합작으로 이어졌다.',
    options: [
      { name: '내전을 멈추고 함께 항일한다(역사)', fx: { flag: 'united_front', spirit: 'united_front', others: { ccp: { spirit: 'united_front', stability: .05 } } }, ai: 10 },
      { name: '토벌을 계속한다(가상)', fx: { stability: -.08, war: ['china', 'ccp'] }, ai: 0 }
    ] }),
  E({ id: 'ev_purge', date: '1937-06-11', to: 'ussr', title: '붉은 군대의 숙청', desc: '군 지휘부에 대한 대규모 숙청이 시작되었다.',
    history: '1937~38년. 많은 고위 장교가 숙청되어 지휘 체계가 약해졌다.',
    options: [{ name: '받아들인다', fx: { spirit: 'great_purge' }, ai: 10 }] }),
  E({ id: 'ev_marco_polo', date: '1937-07-07', to: 'japan', cond: { notWar: 'china' }, title: '루거우차오 사건', desc: '베이핑 근교 루거우차오에서 일본군과 중국군이 충돌했다.',
    history: '1937년 7월 7일. 이 충돌이 중일 전면 전쟁으로 번졌다.',
    options: [
      { name: '전면전으로 확대한다(역사)', fx: { war: ['japan', 'china'], warSupport: .05 }, ai: 10 },
      { name: '현지에서 수습한다(가상)', fx: { warSupport: -.05, pp: 40, flag: 'mp_delayed' }, ai: 0 }
    ] }),
  E({ id: 'ev_second_incident', date: '1937-11-01', to: 'japan', cond: { flag: 'mp_delayed', notWar: 'china' }, title: '화북의 긴장', desc: '화북에서 다시 충돌이 이어진다. 군부는 결단을 요구한다.',
    history: '가상 사건(루거우차오 사건을 수습한 경우).',
    options: [
      { name: '전쟁을 시작한다', fx: { war: ['japan', 'china'] }, ai: 10 },
      { name: '교섭을 계속한다', fx: { pp: -40, stability: -.05 }, ai: 0 }
    ] }),
  E({ id: 'ev_warlord_talks', to: 'china', title: '군벌과의 교섭', desc: '광시·윈난·산시의 지도자들이 항전과 자치를 두고 조건을 내걸었다.',
    history: '실제로 이들은 자치를 유지하며 국민정부의 항전에 참여했다.',
    options: [
      { name: '자치를 인정하고 군사 협력을 약속받는다(역사)', fx: { flag: 'warlord_pact', stability: .05 }, ai: 10 },
      { name: '광시와 윈난을 중앙에 합친다(가상)', fx: { annex: ['guangxi', 'yunnan'], stability: -.1, pp: -50 }, ai: 0 }
    ] }),
  E({ id: 'ev_changkufeng', date: '1938-07-29', to: 'japan', cond: { notWar: 'ussr' }, title: '장고봉 사건', desc: '조선·만주·소련의 국경이 만나는 장고봉에서 일본군과 소련군이 충돌했다.',
    history: '1938년 7~8월. 국경 분쟁으로 끝났다.', options: [{ name: '국경 분쟁으로 매듭짓는다(역사)', fx: { warSupport: -.02 }, ai: 10 }] }),
  E({ id: 'ev_nomonhan', date: '1939-05-11', to: 'japan', cond: { notWar: 'ussr' }, title: '할힌골(노몬한) 전투', desc: '만주국과 몽골의 국경에서 관동군과 소련·몽골군이 맞섰다. 소련 기갑 부대의 반격으로 관동군이 크게 졌다.',
    history: '1939년 5~9월. 이 패배는 일본이 북진보다 남진을 고르는 데 영향을 주었다.',
    options: [
      { name: '국경 분쟁으로 억제한다(역사)', fx: { warSupport: -.05, flag: 'nomonhan', others: { ussr: { warSupport: .05 } } }, ai: 10 },
      { name: '소련과 전면전을 벌인다(가상)', fx: { war: ['japan', 'ussr'] }, ai: 0 }
    ] }),
  E({ id: 'ev_europe_war', date: '1939-09-01', to: 'uk', title: '유럽 대전 발발', desc: '독일이 폴란드를 침공했다. 영국과 프랑스가 독일에 선전 포고했다.',
    history: '1939년 9월. 유럽의 전쟁은 이 게임의 지도 밖에서 추상화된다.',
    options: [{ name: '본국 방위를 우선한다', fx: { flag: 'europe_war', spirit: 'european_war', warSupport: .15, others: { france: { spirit: 'european_war', warSupport: .1 } } }, ai: 10 }] }),
  E({ id: 'ev_netherlands_falls', date: '1940-05-15', to: 'netherlands', cond: { flag: 'europe_war' }, title: '네덜란드 본국 함락', desc: '독일군이 네덜란드 본국을 점령했다. 정부는 런던으로 망명했다.',
    history: '1940년 5월. 동인도는 망명 정부 아래 계속 싸웠다.',
    options: [{ name: '망명 정부로 싸운다', fx: { homelandLost: 'netherlands', spirit: 'government_in_exile', join: 'allies', warSupport: .2 }, ai: 10 }] }),
  E({ id: 'ev_france_falls', date: '1940-06-22', to: 'france', cond: { flag: 'europe_war' }, title: '프랑스 항복', desc: '프랑스가 독일과 휴전했다. 남부에 비시 정부가 섰다.',
    history: '1940년 6월. 인도차이나 총독부는 비시 정부를 따랐다.',
    options: [{ name: '비시 정부를 따른다(역사)', fx: { homelandLost: 'france', ideology: 'authoritarian', rename: '비시 프랑스', leaveFaction: true, flag: 'vichy', removeSpirit: 'european_war' }, ai: 10 }] }),
  E({ id: 'ev_burma_road_closed', date: '1940-07-18', to: 'uk', cond: { war: ['japan', 'china'] }, title: '버마 루트 폐쇄 요구', desc: '일본이 버마를 거쳐 중국으로 가는 물자를 막으라고 요구한다.',
    history: '1940년 7월 영국은 버마 루트를 석 달 동안 닫았다.',
    options: [
      { name: '석 달 동안 닫는다(역사)', fx: { pp: 20, others: { china: { removeSpirit: 'burma_road', stability: -.03 } } }, ai: 10 },
      { name: '요구를 거절한다(가상)', fx: { warSupport: .05, others: { japan: { warSupport: .03 } } }, ai: 0 }
    ] }),
  E({ id: 'ev_indochina_north', date: '1940-09-22', to: 'france', cond: { flag: 'vichy', war: ['japan', 'china'] }, title: '북부 인도차이나 진주 요구', desc: '일본이 통킹에 군대를 두고 비행장을 쓰게 해 달라고 요구한다.',
    history: '1940년 9월 비시 정부는 요구를 받아들였다.',
    options: [
      { name: '받아들인다(역사)', fx: { access: ['france', 'japan'], flag: 'jp_north_indochina' }, ai: 10 },
      { name: '거부한다(가상)', fx: { war: ['japan', 'france'] }, ai: 0 }
    ] }),
  E({ id: 'ev_tripartite', date: '1940-09-27', to: 'japan', cond: { notFlag: 'axis_joined' }, title: '삼국 동맹 제안', desc: '독일과 이탈리아가 군사 동맹을 제안한다.',
    history: '1940년 9월 27일 체결.',
    options: [
      { name: '동맹을 맺는다(역사)', fx: { faction: 'create:axis', flag: 'axis_joined' }, ai: 10 },
      { name: '거절한다(가상)', fx: { pp: 30 }, ai: 0 }
    ] }),
  E({ id: 'ev_korean_liberation_army', to: 'china', title: '한국광복군 창설', desc: '충칭의 대한민국 임시정부가 한국광복군을 창설했다. 국민정부가 이를 지원한다.',
    history: '1940년 9월 17일 창설. 중국 각지에서 항일 활동을 했고 1945년 국내 진공 작전을 준비했다.',
    options: [{ name: '광복군을 지원한다(역사)', fx: { divisions: [['kla', 1, 'capital']], stability: .02, flag: 'kpg' }, ai: 10 }] }),
  E({ id: 'ev_neutrality_pact', to: 'japan', title: '일소 중립 조약', desc: '일본과 소련이 서로 공격하지 않기로 한다.',
    history: '1941년 4월 13일 체결. 1945년 8월 소련이 파기했다.',
    options: [{ name: '조약을 맺는다(역사)', fx: { nap: ['japan', 'ussr'], flag: 'neutrality_pact' }, ai: 10 }, { name: '맺지 않는다(가상)', fx: {}, ai: 0 }] }),
  E({ id: 'ev_barbarossa', date: '1941-06-22', to: 'ussr', cond: { flag: 'europe_war' }, title: '독소 전쟁 발발', desc: '독일이 소련을 침공했다. 서부 전선이 무너지고 있다.',
    history: '1941년 6월 22일. 그해 가을 시베리아의 사단 일부가 모스크바 방어에 투입되었다.',
    options: [
      { name: '극동 사단 일부를 서쪽으로 보낸다(역사)', fx: { removeDivisions: { from: ['khabarovsk', 'chita', 'vladivostok', 'amur', 'iman'], n: 6 }, spirit: 'great_patriotic_war', flag: 'barbarossa' }, ai: 10 },
      { name: '극동 전력을 그대로 둔다(가상)', fx: { stability: -.1, spirit: 'great_patriotic_war', flag: 'barbarossa' }, ai: 0 }
    ] }),
  E({ id: 'ev_indochina_south', date: '1941-07-24', to: 'japan', cond: { flag: 'jp_north_indochina' }, title: '남부 인도차이나 진주', desc: '남방 작전의 거점으로 사이공 일대에 군대를 보낼 수 있다. 미국과 영국이 강하게 반발할 것이다.',
    history: '1941년 7월 진주. 미국·영국·네덜란드의 자산 동결과 석유 금수로 이어졌다.',
    options: [
      { name: '진주한다(역사)', fx: { flag: 'jp_indochina', others: { usa: { warSupport: .05 } } }, ai: 10 },
      { name: '보류한다(가상)', fx: { pp: -30 }, ai: 0 }
    ] }),
  E({ id: 'ev_oil_embargo', date: '1941-08-01', to: 'japan', cond: { flag: 'jp_indochina', notFlag: 'oil_embargo' }, title: '석유 금수', desc: '미국·영국·네덜란드가 일본에 석유를 팔지 않기로 했다. 비축한 석유로 버틸 수 있는 시간은 길지 않다.',
    history: '1941년 8월. 일본 석유 수입의 대부분이 끊겼다.',
    options: [{ name: '받아들일 수 없다', fx: { spirit: 'oil_embargo', flag: 'oil_embargo', embargo: { by: ['usa', 'uk', 'netherlands'], on: 'japan' } }, ai: 10 }] }),
  E({ id: 'ev_hull_note', date: '1941-11-26', to: 'japan', cond: { flag: 'oil_embargo', notWar: 'usa' }, title: '헐 노트', desc: '미국이 중국과 인도차이나에서의 철수를 요구하는 문서를 보냈다.',
    history: '1941년 11월 26일. 일본 정부는 이를 최후통첩으로 받아들이고 개전을 결정했다.',
    options: [
      { name: '협상을 끝내고 개전을 준비한다(역사)', fx: { wargoal: ['usa', 'uk', 'netherlands'], flag: 'pacific_decision', warSupport: .1 }, ai: 10 },
      { name: '중국에서 물러나고 금수 해제를 구한다(가상)', fx: { peace: ['japan', 'china'], removeSpirit: 'oil_embargo', liftEmbargo: 'japan', stability: -.2, warSupport: -.2, flag: 'withdrawal' }, ai: 0 }
    ] }),
  E({ id: 'ev_pearl_harbor', to: 'usa', title: '태평양 전쟁', desc: '일본이 미국에 전쟁을 걸어 왔다. 고립주의 여론이 하룻밤 사이에 사라졌다.',
    history: '1941년 12월 7일(하와이 시간) 진주만 공습. 미국은 다음 날 선전 포고했다.',
    options: [{ name: '전쟁에 나선다', fx: { removeSpirit: 'isolationism', warSupport: .4, stability: .05, spirit: 'arsenal_of_democracy' }, ai: 10 }] }),
  E({ id: 'ev_lend_lease', to: 'usa', title: '무기 대여법', desc: '중국과 영국에 무기를 빌려줄 수 있게 되었다.',
    history: '1941년 3월 11일 성립.',
    options: [{ name: '중국과 영국에 보낸다(역사)', fx: { others: { china: { equipment: { inf_eq: 2500, artillery: 120, motor: 400, fighter: 80 } }, uk: { equipment: { fighter: 120, motor: 600 } } } }, ai: 10 }] }),
  E({ id: 'ev_aid_china', to: 'china', repeat: true, title: '외국의 원조', desc: '항공기와 무기가 들어온다.',
    history: '1937~41년 소련은 항공기와 의용 조종사를, 미국과 영국은 차관과 물자를 보냈다.',
    options: [{ name: '받는다', fx: { equipment: { fighter: 80, inf_eq: 1500, artillery: 60 } }, ai: 10 }] }),
  E({ id: 'ev_sinkiang_alignment', to: 'sinkiang', title: '소련과의 협력', desc: '소련이 고문과 무기를 보내며 협력을 제안한다.',
    history: '1930년대 신장의 성스차이 정권은 소련에 크게 기대었다.',
    options: [{ name: '협력한다(역사)', fx: { puppet: ['sinkiang', 'ussr'] }, ai: 10 }, { name: '거절한다(가상)', fx: {}, ai: 0 }] }),
  E({ id: 'ev_commonwealth_call', to: 'australia', title: '영연방의 요청', desc: '영국이 참전과 지원을 요청한다.',
    history: '오스트레일리아와 뉴질랜드는 1939년 9월 영국과 함께 참전했다.',
    options: [{ name: '함께 싸운다', fx: { warSupport: .2, joinWarsOf: 'uk', others: { nz: { warSupport: .2, joinWarsOf: 'uk' } } }, ai: 10 }] }),
  E({ id: 'ev_cairo', to: 'china', title: '카이로 선언', desc: '미국·영국·중국의 지도자가 일본이 빼앗은 영토의 반환과 한국의 독립을 선언했다.',
    history: '1943년 11월 27일 서명, 12월 1일 발표. 한국을 "적절한 시기에" 독립시킨다고 했다.',
    options: [{ name: '선언에 서명한다', fx: { flag: 'cairo', stability: .03 }, ai: 10 }] }),
  E({ id: 'ev_yalta', date: '1945-02-11', to: 'ussr', cond: { war: ['japan', 'usa'] }, title: '얄타 회담', desc: '독일이 항복한 뒤 석 달 안에 일본에 선전 포고하기로 약속했다.',
    history: '1945년 2월.', options: [{ name: '약속한다(역사)', fx: { flag: 'yalta' }, ai: 10 }, { name: '약속하지 않는다(가상)', fx: {}, ai: 0 }] }),
  E({ id: 'ev_germany_surrender', date: '1945-05-08', to: 'uk', cond: { flag: 'europe_war' }, title: '독일 항복', desc: '유럽의 전쟁이 끝났다. 본국의 병력과 함대를 태평양으로 돌릴 수 있다.',
    history: '1945년 5월 8일.', options: [{ name: '태평양으로', fx: { removeSpirit: 'european_war', flag: 'germany_surrendered', others: { ussr: { removeSpirit: 'great_patriotic_war' } } }, ai: 10 }] }),
  E({ id: 'ev_soviet_entry', date: '1945-08-08', to: 'ussr', cond: { flag: 'yalta', war: ['japan', 'usa'], notWar: 'japan' }, title: '대일 참전', desc: '중립 조약을 파기하고 일본에 선전 포고할 수 있다.',
    history: '1945년 8월 8일 선전 포고, 9일 만주 공세.',
    options: [{ name: '선전 포고한다(역사)', fx: { war: ['ussr', 'japan'] }, ai: 10 }, { name: '참전하지 않는다(가상)', fx: {}, ai: 0 }] })
];
/* 엔진이 상황에 따라 직접 일으키는 사건(조건이 날짜가 아니라 상태다): 수도 이전, 항복, 한국 해방. */
export const SYSTEM_EVENTS = {
  capital_moved: { title: '수도 이전', desc: '수도가 적에게 넘어가 정부가 옮겨 갔다.' },
  capitulation: { title: '항복', desc: '승점의 대부분을 잃고 저항할 힘이 다했다.' },
  korea_liberation: { title: '조선의 해방', desc: '일본의 식민 통치가 끝났다.', history: '1945년 8월 15일 일본의 항복으로 해방되었다. 그 뒤 북위 38도선을 경계로 미국과 소련이 나누어 점령했다.' }
};
