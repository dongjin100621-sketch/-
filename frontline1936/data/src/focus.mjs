/* 국가 중점. [id, 이름, 일수, 열, 행, 선행(둘 중 하나면 '|', 모두면 ','), 배타, 효과, 조건, 설명]
 * 효과 키: pp 정치력, stability·warSupport 비율(0.05 = 5%p), spirit/removeSpirit, research {cat, bonus, uses}, build [[건물, 단계, 위치]],
 * facility [[시설, 단계, 위치]], divisions [[편제, 수, 위치]], equipment {장비: 수}, manpower(천 명), popularity {이념: 비율},
 * faction 'join:진영' 또는 'create:진영', wargoal [나라], event 사건 ID, tech [기술], ships {배: 수}.
 * 위치: 'capital'(지도 위 수도) 또는 지역 ID. 조건: year(그해 이후), atWar(전쟁 중), war(그 나라와 전쟁 중), flag(사건이 남긴 표식), notFlag.
 * 이름과 설명은 이 게임을 위해 쓴 것이다. 역사적 사실과 가상 선택을 구분해 설명에 적었다. */
const F = (id, name, days, x, y, req, excl, fx, need, desc) => ({ id, name, days, x, y, req: req || '', excl: excl || '', fx: fx || {}, need: need || {}, desc });

export const FOCUS_TREES = {
  japan: [
    F('jp_cabinet', '군부 내각의 성립', 35, 3, 0, '', '', { pp: 60, stability: -.02 }, {}, '1936년 이후 군부의 발언권이 커진 내각. 정치력을 얻지만 안정도가 조금 내려간다.'),
    F('jp_army_first', '육군 우위', 70, 1, 1, 'jp_cabinet', 'jp_navy_first', { removeSpirit: 'army_navy_rivalry', research: { cat: 'land_doctrine', bonus: .5, uses: 2 }, divisions: [['jp_inf', 2, 'hsinking']] }, {}, '대륙 전략을 우선한다. 육해군의 대립을 끝내고 지상 교리 연구를 앞당긴다.'),
    F('jp_navy_first', '해군 우위', 70, 5, 1, 'jp_cabinet', 'jp_army_first', { removeSpirit: 'army_navy_rivalry', research: { cat: 'naval', bonus: .5, uses: 2 }, build: [['dock', 2, 'chugoku']] }, {}, '해양 전략을 우선한다. 육해군의 대립을 끝내고 조선소를 늘린다.'),
    F('jp_heavy_industry', '중공업 확충 계획', 70, 3, 1, 'jp_cabinet', '', { build: [['civ', 2, 'kanto'], ['steel', 1, 'kyushu']] }, {}, '민간 공장과 제철소를 늘린다.'),
    F('jp_manchuria_plan', '만주 산업 개발 5개년 계획', 70, 3, 2, 'jp_heavy_industry', '', { build: [['steel', 1, 'fengtian'], ['civ', 1, 'fengtian'], ['coal', 1, 'fengtian']], facility: [['infra', 1, 'fengtian'], ['infra', 1, 'harbin']] }, {}, '만주국에 제철·석탄·철도를 늘린다(만주국의 지역에도 일본이 짓는다).'),
    F('jp_north_korea_industry', '조선 북부 공업화', 70, 4, 3, 'jp_manchuria_plan', '', { build: [['chem', 1, 'hamgyong'], ['civ', 1, 'pyongan'], ['steel', 1, 'hamgyong']], facility: [['infra', 1, 'hamgyong']] }, {}, '흥남·청진 일대의 화학·제철 공장과 수력 발전. 식민지 공업화는 일본의 전쟁 경제에 맞춰졌다(역사).'),
    F('jp_synthetic_plan', '인조 석유 계획', 70, 2, 3, 'jp_manchuria_plan', '', { research: { cat: 'industry', bonus: 1, uses: 1 }, tech: ['synthetic_fuel'] }, { year: 1937 }, '석탄 액화 기술을 확보한다. 석유를 들여오기 어려워질 때를 대비한다.'),
    F('jp_north_china', '화북 분리 공작', 35, 1, 2, 'jp_army_first', '', { wargoal: ['china'], warSupport: .05 }, { year: 1937 }, '화북을 국민정부에서 떼어 내려는 공작. 국민정부에 대한 전쟁 명분을 얻는다.'),
    F('jp_kwantung_army', '관동군 증강', 70, 0, 3, 'jp_north_china', '', { divisions: [['jp_inf', 3, 'harbin']], equipment: { artillery: 300 } }, {}, '만주의 병력을 늘린다.'),
    F('jp_north_strike', '북진론', 70, 0, 4, 'jp_kwantung_army', 'jp_south_strike', { wargoal: ['ussr', 'mongolia'], research: { cat: 'armor', bonus: .5, uses: 2 } }, { year: 1939 }, '시베리아로 나아가자는 주장(가상 선택). 소련·몽골에 대한 전쟁 명분.'),
    F('jp_national_mobilization', '국가 총동원법', 35, 2, 4, 'jp_army_first|jp_navy_first', '', { spirit: 'total_war_mobilization', warSupport: .05 }, { atWar: true }, '1938년의 국가 총동원법. 인력·물자를 정부가 통제한다.'),
    F('jp_fleet_expansion', '해군 군비 보충 계획', 70, 5, 2, 'jp_navy_first', '', { ships: { carrier: 1, destroyer: 6 }, build: [['dock', 1, 'kanto']] }, {}, '항공모함과 구축함을 늘린다.'),
    F('jp_carrier_striking', '기동 부대 편성', 70, 6, 3, 'jp_fleet_expansion', '', { research: { cat: 'naval_doctrine', bonus: 1, uses: 1 }, tech: ['carrier1'] }, {}, '항공모함을 한데 모아 공격하는 교리.'),
    F('jp_south_seas_bases', '남양 기지 정비', 70, 5, 3, 'jp_fleet_expansion', '', { facility: [['port', 2, 'truk'], ['air', 2, 'saipan'], ['air', 2, 'palau'], ['air', 1, 'marshalls']] }, {}, '위임 통치령의 섬에 해군 기지와 비행장을 둔다.'),
    F('jp_south_strike', '남진론', 70, 5, 4, 'jp_south_seas_bases|jp_national_mobilization', 'jp_north_strike', { research: { cat: 'infantry', bonus: .5, uses: 2 }, tech: ['jungle_warfare'] }, { year: 1939 }, '동남아시아의 자원 지대로 나아가자는 주장.'),
    F('jp_taiwan_base', '타이완 남방 기지', 35, 6, 5, 'jp_south_strike', '', { facility: [['air', 3, 'taiwan'], ['port', 2, 'taiwan']] }, {}, '남방 작전을 위한 비행장과 항구.'),
    F('jp_tripartite', '삼국 동맹', 35, 3, 5, 'jp_national_mobilization|jp_south_strike', '', { faction: 'create:axis', warSupport: .05 }, { year: 1940 }, '독일·이탈리아와의 동맹(1940년 9월). 추축국 진영을 이끈다.'),
    F('jp_neutrality_pact', '일소 중립 조약', 35, 2, 5, 'jp_tripartite', '', { event: 'ev_neutrality_pact' }, { year: 1941 }, '북쪽을 안정시키는 중립 조약(1941년 4월).'),
    F('jp_southern_operation', '남방 작전 계획', 70, 4, 6, 'jp_tripartite', '', { wargoal: ['usa', 'uk', 'netherlands'], warSupport: .1, divisions: [['jp_inf', 6, 'taiwan'], ['jp_marine', 2, 'taiwan']] }, { flag: 'oil_embargo' }, '석유 금수에 맞서 미국·영국·네덜란드와의 전쟁을 준비한다(역사의 결정은 1941년 12월).'),
    F('jp_resource_development', '남방 자원 개발', 70, 4, 7, 'jp_southern_operation', '', { spirit: 'resource_mobilization', build: [['refinery', 1, 'palembang']] }, { controls: ['palembang'] }, '점령한 유전과 정유소를 다시 돌린다. 점령지의 생산은 저항과 손상으로 낮다.'),
    F('jp_air_expansion', '항공 병력 확충', 70, 1, 5, 'jp_national_mobilization', '', { build: [['arms', 2, 'chubu']], research: { cat: 'air', bonus: .5, uses: 2 } }, {}, '항공기 공장과 연구.'),
    F('jp_war_economy', '군수 생산 증강', 70, 2, 6, 'jp_air_expansion', '', { build: [['arms', 3, 'kansai']] }, { atWar: true }, '군수 공장을 늘린다.'),
    F('jp_home_defense', '본토 방위 태세', 70, 2, 7, 'jp_war_economy', '', { facility: [['fort', 3, 'kyushu'], ['fort', 3, 'kanto'], ['air', 2, 'kanto']], divisions: [['jp_inf', 4, 'kanto']] }, { year: 1943 }, '본토 상륙에 대비한 방어.')
  ],
  china: [
    F('cn_currency_reform', '법폐 개혁', 35, 3, 0, '', '', { stability: .05, pp: 40 }, {}, '1935년 시작된 화폐 개혁의 정착. 재정과 안정도가 나아진다.'),
    F('cn_central_army', '중앙군 정예화', 70, 1, 1, 'cn_currency_reform', '', { divisions: [['cn_central', 3, 'nanjing']], research: { cat: 'land_doctrine', bonus: .5, uses: 1 } }, {}, '독일 고문단의 도움으로 훈련한 사단을 늘린다.'),
    F('cn_yangtze_line', '장강 방어선', 70, 0, 2, 'cn_central_army', '', { facility: [['fort', 3, 'shanghai'], ['fort', 2, 'nanjing'], ['fort', 2, 'wuhan']] }, {}, '상하이에서 난징까지 방어 시설.'),
    F('cn_unify_warlords', '군벌 통합 교섭', 70, 3, 1, 'cn_currency_reform', '', { event: 'ev_warlord_talks', pp: -20 }, {}, '광시·윈난·산시의 군벌을 중앙에 끌어들이는 교섭. 결과는 사건에서 정해진다.'),
    F('cn_remove_fragmentation', '전국 통합', 70, 3, 2, 'cn_unify_warlords', '', { removeSpirit: 'warlord_fragmentation', stability: .05 }, { year: 1937 }, '군벌 할거의 약점을 줄인다.'),
    F('cn_inland_industry', '내륙 공업 이전', 70, 5, 1, 'cn_currency_reform', '', { build: [['civ', 2, 'chongqing'], ['arms', 1, 'chengdu']], facility: [['infra', 1, 'chongqing']] }, {}, '해안의 공장을 쓰촨으로 옮긴다(1937~38년의 공장 이전).'),
    F('cn_chongqing', '충칭 천도 준비', 35, 5, 2, 'cn_inland_industry', '', { facility: [['fort', 2, 'chongqing'], ['air', 2, 'chongqing']], flag: 'chongqing_ready' }, { atWar: true }, '수도를 내륙으로 옮길 준비. 난징을 잃으면 정부가 충칭으로 간다.'),
    F('cn_scorched_earth', '시간을 버는 전쟁', 35, 1, 3, 'cn_yangtze_line|cn_chongqing', '', { spirit: 'scorched_earth', warSupport: .05 }, { war: 'japan' }, '땅을 내주고 시간을 버는 지구전.'),
    F('cn_foreign_aid', '외국 원조 요청', 35, 4, 3, 'cn_remove_fragmentation|cn_chongqing', '', { event: 'ev_aid_china' }, { atWar: true }, '소련·미국·영국에 무기와 차관을 요청한다.'),
    F('cn_burma_road', '버마 루트 개통', 70, 5, 3, 'cn_chongqing', '', { spirit: 'burma_road', facility: [['infra', 2, 'dali'], ['infra', 1, 'kunming']] }, { year: 1938 }, '쿤밍에서 랑군으로 가는 보급로(1938년 개통).'),
    F('cn_air_force', '공군 재건', 70, 2, 4, 'cn_foreign_aid', '', { equipment: { fighter: 120 }, research: { cat: 'air', bonus: .5, uses: 1 } }, {}, '들여온 항공기로 공군을 다시 꾸린다.'),
    F('cn_conscription', '병역법 시행', 35, 0, 4, 'cn_scorched_earth', '', { manpower: 400, warSupport: .05 }, { atWar: true }, '징병을 넓혀 인력을 모은다.'),
    F('cn_volunteer_group', '미국 의용 항공대', 35, 2, 5, 'cn_air_force', '', { equipment: { fighter: 100 } }, { year: 1941 }, '미국인 조종사의 의용 항공대(1941년).'),
    F('cn_kpg', '대한민국 임시정부 지원', 35, 4, 4, 'cn_foreign_aid', '', { event: 'ev_korean_liberation_army' }, { year: 1940 }, '충칭의 대한민국 임시정부와 한국광복군(1940년 9월 창설)을 지원한다.'),
    F('cn_hump', '험프 공수로', 70, 5, 4, 'cn_burma_road', '', { spirit: 'hump_airlift' }, { year: 1942 }, '버마 루트가 끊기면 히말라야를 넘어 물자를 나른다.'),
    F('cn_x_force', '주인도 중국군', 70, 3, 5, 'cn_kpg|cn_hump', '', { divisions: [['cn_central', 3, 'kunming']], equipment: { artillery: 200, inf_eq: 3000 } }, { year: 1942 }, '인도에서 미국식으로 훈련한 사단.'),
    F('cn_cairo', '카이로 회담', 35, 4, 6, 'cn_x_force', '', { event: 'ev_cairo', stability: .05 }, { year: 1943 }, '1943년 11월의 미·영·중 정상 회담. 한국의 독립을 약속한 선언.'),
    F('cn_counteroffensive', '대반격', 70, 3, 7, 'cn_cairo|cn_conscription', '', { research: { cat: 'land_doctrine', bonus: 1, uses: 1 }, warSupport: .1, divisions: [['cn_central', 4, 'capital']] }, { year: 1944 }, '전쟁 말의 반격 준비.')
  ],
  ccp: [
    F('ccp_border_region', '산간닝 변구', 35, 2, 0, '', '', { build: [['farm', 1, 'yanan']], stability: .05 }, {}, '근거지의 행정과 생산을 정비한다.'),
    F('ccp_land_rent', '감조감식', 70, 1, 1, 'ccp_border_region', '', { manpower: 50, popularity: { communism: .05 } }, {}, '소작료와 이자를 낮추는 온건한 개혁(항일 시기의 정책).'),
    F('ccp_united_front', '항일 민족 통일 전선', 35, 3, 1, 'ccp_border_region', '', { pp: 30, warSupport: .05 }, {}, '국민당과 함께 일본에 맞서자는 노선. 시안 사건 뒤 국공 합작으로 이어졌다.'),
    F('ccp_eighth_route', '팔로군 개편', 70, 3, 2, 'ccp_united_front', '', { divisions: [['ccp_guerrilla', 3, 'yanan']] }, { flag: 'united_front' }, '홍군을 국민혁명군 제8로군으로 개편한다(1937년 8월).'),
    F('ccp_new_fourth', '신사군 창설', 70, 4, 3, 'ccp_eighth_route', '', { divisions: [['ccp_guerrilla', 2, 'capital']], manpower: 30 }, { atWar: true }, '강남의 유격대를 신사군으로 모은다.'),
    F('ccp_base_areas', '적후 근거지', 70, 2, 3, 'ccp_eighth_route', '', { flag: 'base_areas', divisions: [['ccp_guerrilla', 2, 'capital']] }, { war: 'japan' }, '일본군이 차지한 지역의 후방에 근거지를 만든다. 점령 지역의 일본 보급이 나빠진다.'),
    F('ccp_hundred_regiments', '백단 대전', 35, 2, 4, 'ccp_base_areas', '', { spirit: 'hundred_regiments', warSupport: .05 }, { year: 1940 }, '1940년 화북의 철도·거점에 대한 대규모 공격.'),
    F('ccp_production', '대생산 운동', 70, 1, 2, 'ccp_land_rent', '', { build: [['farm', 2, 'yanan'], ['light', 1, 'yanan']], stability: .05 }, {}, '봉쇄 속에서 식량과 생필품을 스스로 만든다.'),
    F('ccp_rectification', '정풍 운동', 70, 1, 3, 'ccp_production', '', { pp: 80, stability: .05 }, { year: 1942 }, '당의 조직과 노선을 정비한 운동.'),
    F('ccp_people_war', '인민 전쟁', 70, 0, 4, 'ccp_rectification|ccp_hundred_regiments', '', { research: { cat: 'land_doctrine', bonus: 1, uses: 1 }, tech: ['guerrilla2'] }, {}, '유격전 교리를 발전시킨다.'),
    F('ccp_soviet_aid', '소련의 지원', 35, 4, 1, 'ccp_border_region', '', { equipment: { inf_eq: 1500, artillery: 40 } }, {}, '소련에서 무기를 받는다.'),
    F('ccp_expand', '화북 확장', 70, 3, 4, 'ccp_base_areas|ccp_new_fourth', '', { divisions: [['ccp_guerrilla', 3, 'capital']], manpower: 80 }, { year: 1943 }, '전쟁 말 화북 농촌의 세력을 넓힌다.'),
    F('ccp_counteroffensive', '전면 반격', 70, 2, 5, 'ccp_expand|ccp_people_war', '', { warSupport: .1, equipment: { inf_eq: 2000 } }, { year: 1945 }, '1945년의 반격.')
  ],
  ussr: [
    F('su_far_east_army', '특별 극동군', 70, 3, 0, '', '', { divisions: [['su_rifle', 3, 'khabarovsk'], ['su_tank', 1, 'chita']], spirit: 'far_east_reserve' }, {}, '극동의 독립 군을 강화한다.'),
    F('su_trans_siberian', '시베리아 철도 복선화', 70, 1, 1, 'su_far_east_army', '', { facility: [['infra', 1, 'irkutsk'], ['infra', 1, 'chita'], ['infra', 1, 'khabarovsk'], ['infra', 1, 'novosibirsk']], removeSpirit: 'european_front_watch' }, {}, '철도를 넓혀 병력 이동을 빠르게 한다.'),
    F('su_kuzbass', '쿠즈바스 공업 기지', 70, 0, 2, 'su_trans_siberian', '', { build: [['civ', 2, 'kuzbass'], ['steel', 1, 'kuzbass'], ['arms', 1, 'novosibirsk']] }, {}, '우랄 너머의 공업 기지.'),
    F('su_mongolia_pact', '몽골 상호 원조 의정서', 35, 3, 1, 'su_far_east_army', '', { equipment: { inf_eq: 1000 }, pp: 20 }, {}, '1936년 3월의 상호 원조 의정서. 몽골은 이미 코민테른에 있다.'),
    F('su_aid_china', '중국 원조', 35, 4, 2, 'su_mongolia_pact', '', { event: 'ev_aid_china' }, { year: 1937 }, '항공기·무기·의용 조종사를 중국에 보낸다.'),
    F('su_sinkiang', '신장에 대한 영향력', 70, 5, 2, 'su_mongolia_pact', '', { event: 'ev_sinkiang_alignment' }, {}, '신장의 성스차이 정권과 협력한다.'),
    F('su_khalkhin_gol', '할힌골 대비', 70, 3, 3, 'su_mongolia_pact', '', { divisions: [['su_tank', 2, 'dornod']], research: { cat: 'armor', bonus: .5, uses: 2 } }, { year: 1938 }, '몽골 동부의 기갑 전력을 늘린다.'),
    F('su_officer_rehab', '장교단 복권', 70, 1, 4, 'su_kuzbass|su_khalkhin_gol', '', { removeSpirit: 'great_purge', research: { cat: 'land_doctrine', bonus: .5, uses: 1 } }, { year: 1939 }, '숙청된 장교 일부를 복귀시킨다.'),
    F('su_pacific_fleet', '태평양 함대 강화', 70, 5, 3, 'su_sinkiang|su_khalkhin_gol', '', { ships: { submarine: 8, destroyer: 2 }, build: [['dock', 1, 'vladivostok']] }, {}, '블라디보스토크의 잠수함 전력.'),
    F('su_neutrality', '일소 중립 조약', 35, 3, 4, 'su_khalkhin_gol', '', { event: 'ev_neutrality_pact' }, { year: 1941 }, '극동의 평화를 지키는 조약(1941년 4월).'),
    F('su_far_east_industry', '극동 공업 이전', 70, 2, 5, 'su_officer_rehab|su_neutrality', '', { build: [['arms', 2, 'novosibirsk'], ['civ', 2, 'krasnoyarsk']] }, { year: 1941 }, '서부의 공장 일부를 시베리아로 옮긴다.'),
    F('su_war_preparation', '대일 참전 준비', 70, 3, 6, 'su_far_east_industry', '', { divisions: [['su_rifle', 6, 'chita'], ['su_tank', 3, 'dornod']], equipment: { armor: 1500, motor: 3000 } }, { flag: 'yalta' }, '얄타 회담의 약속에 따라 병력을 극동으로 보낸다.'),
    F('su_manchurian_op', '만주 전략 공세', 35, 3, 7, 'su_war_preparation', '', { wargoal: ['japan', 'manchukuo', 'mengjiang'], research: { cat: 'land_doctrine', bonus: 1, uses: 1 } }, { flag: 'yalta' }, '1945년 8월의 만주 공세.')
  ],
  usa: [
    F('us_new_deal', '제2차 뉴딜', 70, 3, 0, '', '', { removeSpirit: 'depression_recovery', spirit: 'new_deal' }, {}, '공공사업과 고용 정책.'),
    F('us_vinson', '해군 확장법', 70, 5, 1, 'us_new_deal', '', { build: [['dock', 3, 'home_usa']], ships: { destroyer: 8 } }, { year: 1937 }, '1938년의 해군 확장법.'),
    F('us_pearl_harbor', '진주만 기지 강화', 70, 6, 2, 'us_vinson', '', { facility: [['port', 1, 'hawaii'], ['air', 3, 'hawaii'], ['fort', 2, 'hawaii']] }, {}, '하와이의 해군·항공 기지.'),
    F('us_guam_wake', '괌·웨이크·미드웨이 기지', 70, 5, 3, 'us_pearl_harbor', '', { facility: [['air', 2, 'wake'], ['air', 2, 'midway'], ['fort', 2, 'guam'], ['air', 2, 'guam']] }, {}, '중부 태평양의 전진 기지.'),
    F('us_philippine_defense', '필리핀 방위', 70, 4, 2, 'us_vinson', '', { divisions: [['ph_army', 3, 'manila']], facility: [['fort', 2, 'manila'], ['air', 2, 'manila']], equipment: { fighter: 60 } }, {}, '필리핀 연방군을 키우고 루손을 요새화한다.'),
    F('us_neutrality_acts', '중립법', 35, 1, 1, 'us_new_deal', '', { stability: .05, pp: 30 }, {}, '해외 분쟁에 끼지 않는다는 법. 고립주의 여론을 반영한다.'),
    F('us_cash_carry', '현금 구매 원칙', 35, 1, 2, 'us_neutrality_acts', '', { removeSpirit: 'isolationism', warSupport: .05 }, { year: 1939 }, '교전국이 현금으로 사서 가져가는 무기 판매. 고립주의가 약해진다.'),
    F('us_draft', '선택 징병법', 35, 0, 3, 'us_cash_carry', '', { warSupport: .05, manpower: 300 }, { year: 1940 }, '평시 징병(1940년 9월).'),
    F('us_two_ocean', '양대양 해군법', 70, 4, 4, 'us_guam_wake|us_philippine_defense', '', { build: [['dock', 5, 'home_usa']], ships: { carrier: 2, cruiser: 4 } }, { year: 1940 }, '1940년의 대규모 해군 증강.'),
    F('us_lend_lease', '무기 대여법', 35, 2, 3, 'us_cash_carry', '', { event: 'ev_lend_lease' }, { year: 1941 }, '중국·영국에 무기를 빌려준다(1941년 3월).'),
    F('us_embargo', '대일 금수', 35, 2, 4, 'us_lend_lease', '', { event: 'ev_oil_embargo' }, { flag: 'jp_indochina' }, '일본이 남부 인도차이나에 들어가면 석유·고철 수출을 막는다.'),
    F('us_arsenal', '민주주의의 병기창', 70, 1, 4, 'us_draft|us_lend_lease', '', { spirit: 'arsenal_of_democracy', build: [['arms', 6, 'home_usa'], ['civ', 4, 'home_usa']] }, { year: 1941 }, '민수 공장을 군수 생산으로 돌린다.'),
    F('us_war_production', '전시 생산국', 70, 1, 5, 'us_arsenal', '', { build: [['arms', 10, 'home_usa']], warSupport: .05 }, { atWar: true }, '전시 생산을 크게 늘린다.'),
    F('us_island_hopping', '징검다리 작전', 70, 3, 5, 'us_two_ocean', '', { tech: ['marines'], divisions: [['us_marine', 4, 'hawaii']], research: { cat: 'naval_doctrine', bonus: .5, uses: 1 } }, { atWar: true }, '요충지 섬만 골라 점령하며 나아간다.'),
    F('us_fast_carriers', '고속 항모 기동 부대', 70, 4, 6, 'us_island_hopping', '', { ships: { carrier: 4, destroyer: 12 }, tech: ['cv2'] }, { year: 1943 }, '새 항공모함으로 기동 부대를 꾸린다.'),
    F('us_strategic_bombing', '장거리 폭격기 계획', 70, 2, 6, 'us_war_production', '', { research: { cat: 'air', bonus: 1, uses: 2 }, tech: ['bomber2'] }, { year: 1943 }, '장거리 중폭격기 개발.')
  ],
  uk: [
    F('uk_rearmament', '재무장 계획', 70, 3, 0, '', '', { build: [['arms', 3, 'home_uk']], warSupport: .05 }, {}, '1936년 이후의 재무장.'),
    F('uk_singapore_base', '싱가포르 해군 기지 완공', 70, 5, 1, 'uk_rearmament', '', { facility: [['fort', 3, 'singapore'], ['port', 0, 'singapore'], ['air', 2, 'singapore']] }, {}, '1938년 완공된 싱가포르 해군 기지.'),
    F('uk_eastern_fleet', '동양 함대 편성', 70, 6, 2, 'uk_singapore_base', '', { ships: { battleship: 2, cruiser: 4, destroyer: 8 } }, { year: 1939 }, '극동에 함대를 둔다(본국의 사정이 허락하는 만큼).'),
    F('uk_malaya_defense', '말라야 방위', 70, 5, 2, 'uk_singapore_base', '', { divisions: [['in_div', 2, 'malaya_n']], facility: [['fort', 1, 'johor'], ['air', 1, 'malaya_n']] }, {}, '말라야 북부와 조호르의 방어.'),
    F('uk_hong_kong', '홍콩 방어', 35, 4, 2, 'uk_singapore_base', '', { facility: [['fort', 2, 'hongkong']], divisions: [['uk_inf', 1, 'hongkong']] }, {}, '홍콩의 진 드링커스 방어선.'),
    F('uk_indian_army', '인도군 확장', 70, 1, 1, 'uk_rearmament', '', { divisions: [['in_div', 4, 'delhi']], manpower: 200 }, {}, '인도군을 크게 늘린다(전쟁 중 200만 명 이상).'),
    F('uk_indian_industry', '인도 공업화', 70, 0, 2, 'uk_indian_army', '', { build: [['civ', 2, 'bengal'], ['arms', 2, 'bihar'], ['steel', 1, 'bihar']] }, {}, '캘커타·잠셰드푸르의 공업.'),
    F('uk_burma_defense', '버마 방위', 70, 2, 2, 'uk_indian_army', '', { divisions: [['in_div', 2, 'rangoon']], facility: [['infra', 1, 'mandalay'], ['air', 1, 'rangoon']] }, {}, '버마의 방어와 도로.'),
    F('uk_commonwealth', '영연방 결속', 35, 3, 2, 'uk_rearmament', '', { event: 'ev_commonwealth_call' }, { atWar: true }, '오스트레일리아·뉴질랜드에 참전과 지원을 요청한다.'),
    F('uk_radar', '레이더 방공망', 70, 3, 3, 'uk_commonwealth|uk_eastern_fleet', '', { tech: ['radar'], research: { cat: 'naval', bonus: .5, uses: 1 } }, { year: 1939 }, '레이더 연구.'),
    F('uk_jungle', '밀림 전투 훈련', 70, 2, 4, 'uk_burma_defense', '', { tech: ['jungle_warfare'], research: { cat: 'infantry', bonus: .5, uses: 1 } }, { year: 1942 }, '버마 전선의 교훈.'),
    F('uk_chindits', '장거리 침투 부대', 35, 1, 5, 'uk_jungle', '', { spirit: 'hundred_regiments' }, { atWar: true }, '적 후방의 보급로를 끊는 부대(가상 효과: 적 보급 감소).'),
    F('uk_fourteenth_army', '제14군', 70, 2, 6, 'uk_chindits|uk_jungle', '', { divisions: [['in_div', 5, 'imphal']], equipment: { artillery: 300, fighter: 120 } }, { year: 1943 }, '버마 탈환을 맡은 군.'),
    F('uk_british_pacific_fleet', '영국 태평양 함대', 70, 5, 6, 'uk_radar', '', { ships: { carrier: 3, battleship: 2, destroyer: 12 } }, { year: 1944 }, '유럽 전쟁이 끝나 가자 태평양으로 함대를 보낸다.')
  ],
  generic: [
    F('gen_industry', '공업 투자', 70, 1, 0, '', '', { build: [['civ', 1, 'capital']] }, {}, '민간 공장을 하나 짓는다.'),
    F('gen_infra', '도로·철도 정비', 70, 3, 0, '', '', { facility: [['infra', 1, 'capital']] }, {}, '기반 시설을 늘린다.'),
    F('gen_arms', '군수 공장', 70, 1, 1, 'gen_industry', '', { build: [['arms', 1, 'capital']] }, {}, '군수 공장을 하나 짓는다.'),
    F('gen_army', '군 확충', 70, 0, 2, 'gen_arms', '', { divisions: [['garrison_generic', 2, 'capital']], equipment: { inf_eq: 400 } }, {}, '병력을 늘린다.'),
    F('gen_research', '교육 투자', 70, 3, 1, 'gen_infra', '', { research: { cat: 'industry', bonus: .5, uses: 2 } }, {}, '연구를 앞당긴다.'),
    F('gen_defense', '수도 방위', 70, 2, 2, 'gen_arms|gen_research', '', { facility: [['fort', 2, 'capital']] }, {}, '수도에 방어 시설을 둔다.'),
    F('gen_stability', '내정 안정', 70, 4, 2, 'gen_research', '', { stability: .1 }, {}, '안정도를 높인다.'),
    F('gen_mobilize', '동원 준비', 35, 2, 3, 'gen_defense|gen_stability', '', { warSupport: .1, manpower: 30 }, {}, '전쟁 지지도와 인력.')
  ]
};
/* AI가 고르는 순서(앞에서부터 조건이 맞는 것). 없으면 트리 순서. */
export const AI_FOCUS_ORDER = {
  japan: ['jp_cabinet', 'jp_heavy_industry', 'jp_army_first', 'jp_north_china', 'jp_manchuria_plan', 'jp_national_mobilization', 'jp_kwantung_army', 'jp_synthetic_plan', 'jp_north_korea_industry', 'jp_air_expansion', 'jp_tripartite', 'jp_neutrality_pact', 'jp_war_economy', 'jp_southern_operation', 'jp_resource_development', 'jp_home_defense'],
  china: ['cn_currency_reform', 'cn_inland_industry', 'cn_central_army', 'cn_unify_warlords', 'cn_yangtze_line', 'cn_remove_fragmentation', 'cn_chongqing', 'cn_scorched_earth', 'cn_foreign_aid', 'cn_burma_road', 'cn_conscription', 'cn_air_force', 'cn_kpg', 'cn_volunteer_group', 'cn_hump', 'cn_x_force', 'cn_cairo', 'cn_counteroffensive'],
  ccp: ['ccp_border_region', 'ccp_united_front', 'ccp_soviet_aid', 'ccp_land_rent', 'ccp_eighth_route', 'ccp_production', 'ccp_base_areas', 'ccp_new_fourth', 'ccp_hundred_regiments', 'ccp_rectification', 'ccp_people_war', 'ccp_expand', 'ccp_counteroffensive'],
  ussr: ['su_far_east_army', 'su_mongolia_pact', 'su_trans_siberian', 'su_aid_china', 'su_kuzbass', 'su_khalkhin_gol', 'su_sinkiang', 'su_officer_rehab', 'su_neutrality', 'su_pacific_fleet', 'su_far_east_industry', 'su_war_preparation', 'su_manchurian_op'],
  usa: ['us_new_deal', 'us_neutrality_acts', 'us_vinson', 'us_pearl_harbor', 'us_philippine_defense', 'us_cash_carry', 'us_guam_wake', 'us_draft', 'us_two_ocean', 'us_lend_lease', 'us_embargo', 'us_arsenal', 'us_war_production', 'us_island_hopping', 'us_fast_carriers', 'us_strategic_bombing'],
  uk: ['uk_rearmament', 'uk_singapore_base', 'uk_indian_army', 'uk_malaya_defense', 'uk_hong_kong', 'uk_indian_industry', 'uk_burma_defense', 'uk_eastern_fleet', 'uk_commonwealth', 'uk_radar', 'uk_jungle', 'uk_chindits', 'uk_fourteenth_army', 'uk_british_pacific_fleet']
};
