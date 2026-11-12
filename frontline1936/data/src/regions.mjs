/* 지역 표(1936년 1월 1일). tools/build_data.mjs가 읽어 data/game.json을 만든다.
 * 열: id | 이름 | 소유국 | 지형 | 승점 | 인구(10만 명) | 기반 시설(1~10) | 항구(0~10) | 비행장(0~10) | 자원 | 시작 건물
 * 지형: p 평야, h 구릉, m 산악, f 삼림, j 밀림, d 사막, s 습지, u 도시
 * 자원(채굴 건물의 상한 단계): coal 석탄, iron 철광석, oil 석유, rubber 고무, rare 희소 금속(텅스텐·주석)
 * 건물: civ 민간 공장, arms 군수 공장, dock 조선소, steel 제철소, tools 기계 공장, chem 화학 공장, light 경공업, refinery 정유소, farm 농장, 채굴은 자원 이름
 * 인구·생산 규모는 게임 설계용 근사값이다(1930년대 중반의 대략적 규모를 참고). 지역 경계는 지금의 행정구역을 묶은 근사다. */
export const REGION_TABLE = `
hokkaido|홋카이도|japan|f|3|30|5|3|2|coal3|civ1,coal3,farm3
tohoku|도호쿠|japan|m|3|80|5|2|1||civ1,light1,farm5
kanto|간토(도쿄)|japan|u|50|160|8|8|5||civ6,arms5,dock2,steel1,tools2,chem1,light4,refinery1,farm4
chubu|주부(나고야)|japan|m|10|110|7|3|3|oil1|civ3,arms3,dock1,tools1,light2,farm4,oil1
kansai|간사이(오사카)|japan|u|20|130|8|4|3||civ5,arms4,dock1,steel1,tools2,chem1,light4,farm3
chugoku|주고쿠(히로시마·구레)|japan|h|5|55|6|8|2||civ2,arms2,dock2,steel1,farm3
shikoku|시코쿠|japan|m|2|35|5|1|1||civ1,light1,farm2
kyushu|규슈(후쿠오카·사세보)|japan|h|10|100|6|6|3|coal4|civ3,arms2,dock1,steel2,chem1,coal4,farm4
ryukyu|류큐(오키나와)|japan|h|3|6|2|2|1||farm1
ogasawara|오가사와라·이오지마|japan|h|1|0.1|1|1|1||
karafuto|가라후토(남사할린)|japan|f|2|3|2|1|1|coal1|coal1
chishima|지시마(쿠릴)|japan|m|1|0.1|1|2|1||
gyeongseong|경기(경성)|japan|u|15|35|5|2|2||civ2,light2,farm3
gangwon|강원|japan|m|1|16|3|1|0|rare2,coal1|rare1,farm2
chungcheong|충청|japan|h|2|30|4|1|0||farm4
jeolla|전라|japan|p|2|45|4|2|1||light1,farm6
gyeongsang|경상(부산)|japan|h|5|50|4|4|1||civ1,light1,farm5
hwanghae|황해|japan|h|1|16|3|1|0|iron1|iron1,farm3
pyongan|평안(평양)|japan|h|5|18|4|2|1|coal2|civ1,arms1,coal2,light1,farm2
hamgyong|함경(흥남·청진)|japan|m|3|15|3|2|1|iron2,rare1|civ1,chem2,steel1,iron2,farm1
taiwan|타이완(타이베이)|japan|h|10|52|5|4|3||civ1,light1,farm4
fengtian|펑톈(선양·안산)|manchukuo|p|15|60|6|0|2|coal4,iron3|civ2,arms2,steel2,tools1,chem1,coal4,iron3,farm3
jinzhou|진저우|manchukuo|p|2|30|5|1|1|coal1|farm3
andong|안둥|manchukuo|h|2|25|4|1|0||light1,farm2
kwantung|관동주(다롄·뤼순)|japan|u|10|13|6|6|2||civ1,arms1,dock1,light1
hsinking|신징(창춘)|manchukuo|p|20|45|6|0|2||civ1,light1,farm4
jiandao|간도(옌지)|manchukuo|m|1|10|3|0|0||farm1
harbin|하얼빈|manchukuo|p|10|45|6|0|2||civ1,light1,farm5
qiqihar|치치하얼|manchukuo|p|3|25|4|0|1||farm4
heihe|헤이허|manchukuo|f|1|5|2|0|0||farm1
mudanjiang|무단장|manchukuo|f|2|15|4|0|1||farm2
jiamusi|자무쓰|manchukuo|s|1|12|3|0|0||farm3
hulunbuir|후룬베이얼(하이라얼)|manchukuo|p|2|5|3|0|1||farm1
xingan|싱안|manchukuo|h|1|10|2|0|0||farm2
jehol|러허(청더)|manchukuo|m|3|40|3|0|1|coal1|coal1,farm3
chahar|차하르|mengjiang|p|5|20|2|0|1||farm2
peiping|베이핑(베이징)|china|u|15|15|5|0|2||civ1,light1
tianjin|톈진|china|u|10|15|5|2|1||civ2,light3,farm1
hebei|허베이(바오딩)|china|p|3|250|4|0|1|coal2|coal2,farm8
kalgan|장자커우|china|m|2|20|3|0|0|iron2|farm1
jinan|지난(산둥)|china|p|5|250|4|0|1|coal2|civ1,coal2,farm8
qingdao|칭다오|china|h|5|120|4|4|1||civ1,light2,farm4
kaifeng|카이펑(정저우)|china|p|5|200|4|0|1|coal1|arms1,coal1,farm8
nanyang|난양|china|p|1|140|3|0|0||farm6
taiyuan|타이위안|shanxi|m|10|50|4|0|1|coal3|civ1,arms2,steel1,coal3,farm2
datong|다퉁|shanxi|m|2|25|3|0|0|coal4|coal2,farm1
shanxi_s|산시 남부(린펀)|shanxi|h|2|45|3|0|0|coal2|farm3
suiyuan|쑤이위안(구이쑤이)|shanxi|d|3|22|2|0|0||farm1
yanan|옌안(산베이)|ccp|h|15|15|2|0|0|oil1|arms1,farm1
xian|시안|china|h|10|60|3|0|1||civ1,farm3
hanzhong|한중|china|m|1|30|2|0|0||farm2
lanzhou|란저우|ma|m|5|40|2|0|1||farm2
hexi|허시 회랑|ma|d|1|10|1|0|0|oil1|farm1
alxa|알라산|ma|d|0|2|1|0|0||
yinchuan|닝샤(인촨)|ma|d|5|10|2|0|0||farm1
xining|시닝|ma|m|3|12|1|0|0||farm1
qinghai_w|칭하이 고원|ma|m|0|3|1|0|0||
urumqi|디화(우루무치)|sinkiang|d|10|15|2|0|1|oil1|farm1
kashgar|카슈가르|sinkiang|d|3|15|1|0|0||farm2
hami|하미|sinkiang|d|1|4|1|0|0||
khotan|호탄|sinkiang|d|1|8|1|0|0||farm1
lhasa|라싸|tibet|m|10|6|1|0|0||farm1
ngari|아리|tibet|m|0|1|1|0|0||
chamdo|창두|tibet|m|1|4|1|0|0||
chengdu|청두|china|p|10|300|3|0|1||civ1,light1,farm10
xikang|시캉|china|m|1|20|1|0|0||farm1
chongqing|충칭|china|h|15|180|3|0|1|coal1|arms1,coal1,farm6
kunming|쿤밍|yunnan|m|10|70|2|0|1|rare2|arms1,rare1,farm3
dali|다리|yunnan|m|2|50|1|0|0|rare1|farm3
guiyang|구이양|china|m|3|100|2|0|0||farm4
nanning|난닝|guangxi|h|5|60|2|0|1||farm3
guilin|구이린|guangxi|h|5|70|2|0|1||arms1,farm3
guangzhou|광저우|china|u|15|200|4|3|2|rare1|civ2,arms1,light3,farm7
shantou|산터우|china|h|2|80|3|1|0||farm3
leizhou|레이저우|china|p|1|40|2|1|0||farm2
guangzhouwan|광저우만|france|p|1|2|2|2|0||
hainan|하이난|china|j|2|22|1|2|0|iron1|farm1
hongkong|홍콩|uk|u|10|10|5|5|1||civ1,dock1,light1
macau|마카오|portugal|u|1|3|3|1|0||
fuzhou|푸저우|china|h|3|70|3|2|1||light1,farm3
xiamen|샤먼|china|h|2|50|3|2|0||farm2
nanchang|난창|china|h|5|120|3|0|1||farm5
ganzhou|간저우|china|m|2|30|2|0|0|rare4|rare2,farm1
hangzhou|항저우|china|h|5|140|4|1|1||civ1,light2,farm5
wenzhou|원저우|china|h|1|70|3|1|0||farm3
shanghai|상하이|china|u|20|35|6|4|2||civ4,arms1,dock1,tools1,chem1,light6
nanjing|난징|china|u|40|160|5|1|2||civ1,arms2,light1,farm6
xuzhou|쉬저우|china|p|3|120|4|0|1|coal1|coal1,farm5
anhui|안후이(안칭)|china|h|3|230|3|0|0|coal1|farm8
wuhan|우한|china|u|15|150|4|0|2|iron2|civ1,arms2,steel1,iron2,light2,farm5
yichang|이창|china|m|2|100|2|0|0||farm4
changsha|창사|china|h|5|180|3|0|1|rare1|farm7
hengyang|헝양|china|h|3|120|3|0|1|rare2,coal1|rare1,farm5
urga|울란바토르|mongolia|p|10|3|2|0|1||farm1
khovd|호브드|mongolia|m|1|2|1|0|0||
dornod|도르노드|mongolia|p|1|1.5|1|0|0||
gobi|고비|mongolia|d|0|1|1|0|0||
vladivostok|블라디보스토크|ussr|h|15|9|5|6|2||civ1,arms1,dock2,farm1
iman|이만|ussr|f|1|2|3|0|0||farm1
khabarovsk|하바롭스크|ussr|f|10|6|4|0|2||civ1,arms1
lower_amur|아무르강 하류|ussr|f|1|1|2|2|0||
okhotsk|오호츠크|ussr|f|0|0.5|1|1|0||
amur|아무르(블라고베셴스크)|ussr|f|3|5|3|0|1||farm1
chita|치타|ussr|m|5|9|4|0|1|coal1|coal1,farm1
ulanude|울란우데|ussr|m|3|5|3|0|0||farm1
irkutsk|이르쿠츠크|ussr|f|5|13|4|0|1|coal2|civ1,coal2,farm1
krasnoyarsk|크라스노야르스크|ussr|f|5|18|3|0|1||civ1,farm2
tuva|투바|ussr|m|1|1|1|0|0||
novosibirsk|노보시비르스크|ussr|p|10|15|5|0|2||civ2,arms2,tools1,farm2
altai|알타이(바르나울)|ussr|p|3|25|4|0|0||farm4
kuzbass|쿠즈바스|ussr|h|5|12|4|0|1|coal5,iron1|civ2,arms1,steel2,coal5,iron1
aldan|알단|ussr|f|0|1|1|0|0||
magadan|마가단|ussr|f|1|1|1|1|0||
kamchatka|캄차카|ussr|m|1|1|1|2|0||
nsakhalin|북사할린|ussr|f|1|1|2|1|0|oil1,coal1|oil1
almaty|알마아타|ussr|m|5|20|3|0|1|rare1|civ1,rare1,farm3
semipalatinsk|세미팔라틴스크|ussr|p|2|15|3|0|0|coal2|coal1,farm3
delhi|델리|uk|u|30|60|5|0|2||civ1,light1,farm4
punjab|펀자브|uk|p|5|150|4|0|1||farm10
rajputana|라지푸타나|uk|d|2|80|2|0|0||farm4
up|연합주(러크나우)|uk|p|5|550|4|0|1||light1,farm18
central_india|중앙주(나그푸르)|uk|h|3|300|3|0|0|coal1|coal1,farm10
hyderabad|하이데라바드|uk|h|5|250|3|0|1|coal1|farm10
madras|마드라스|uk|p|10|450|4|3|1||civ1,light2,farm12
mysore|마이소르|uk|h|3|200|3|1|0|iron1|light1,farm6
bihar|비하르(잠셰드푸르)|uk|p|5|350|4|0|0|coal3,iron2|steel2,coal3,iron2,farm10
orissa|오리사|uk|h|2|100|2|1|0|iron3|iron1,farm5
bengal|벵골(캘커타)|uk|u|20|300|5|4|2|coal2|civ2,arms1,dock1,light4,coal2,farm10
dacca|동벵골(다카)|uk|s|3|350|3|2|0||light1,farm14
assam|아삼|uk|j|2|90|2|0|1|oil1|oil1,farm3
imphal|마니푸르(임팔)|uk|m|2|15|1|0|0||farm1
ceylon|실론|uk|h|10|57|4|6|2|rubber3|rubber2,farm3
nepal|네팔|nepal|m|5|55|1|0|0||farm2
bhutan|부탄|bhutan|m|2|3|1|0|0||
rangoon|랑군|uk|s|15|50|4|3|1||civ1,light1,refinery1,farm6
mandalay|만달레이|uk|h|5|40|3|0|1|oil2|oil2,farm4
myitkyina|미치나|uk|j|1|8|1|0|0||farm1
arakan|아라칸|uk|j|1|12|1|1|0||farm1
tenasserim|테나세림|uk|j|1|12|1|1|0|rare2,rubber1|rare1,farm1
shan|샨|uk|m|1|20|1|0|0|rare1|farm1
bangkok|방콕|siam|p|20|50|4|2|1||civ1,light1,farm4
chiangmai|치앙마이|siam|j|2|25|2|0|0||farm2
korat|코랏|siam|p|2|45|2|0|0||farm4
siam_s|남부 시암|siam|j|1|20|2|1|0|rubber2,rare1|rubber1,farm1
tonkin|통킹(하노이)|france|h|10|85|4|2|1|coal2|civ1,coal2,light1,farm6
annam|안남(후에)|france|h|3|60|3|2|0||farm4
cochinchina|코친차이나(사이공)|france|s|10|50|4|4|1|rubber3|civ1,rubber2,light1,farm6
cambodia|캄보디아|france|p|3|30|2|0|0|rubber1|rubber1,farm3
laos|라오스|france|j|2|10|1|0|0||farm1
new_caledonia|누벨칼레도니|france|h|1|0.5|1|2|0|rare2|rare1
malaya_n|북말라야(페낭)|uk|j|3|15|3|2|1|rubber3,rare2,iron2|rubber2,rare1,farm1
kuala_lumpur|쿠알라룸푸르|uk|j|5|20|4|2|1|rubber4,rare1|rubber3,rare1
johor|조호르|uk|j|2|7|3|1|0|rubber3|rubber2
singapore|싱가포르|uk|u|20|6|5|10|3||civ1,dock2,light1
sarawak|사라왁|uk|j|1|5|1|1|0|oil2,rubber1|oil1
north_borneo|북보르네오|uk|j|1|3|1|1|0||
brunei|브루나이|uk|j|1|0.3|1|1|0|oil2|oil1
borneo_w|서보르네오|netherlands|j|1|8|1|1|0|rubber1|
borneo_e|동보르네오(발릭파판)|netherlands|j|5|4|2|2|1|oil3|oil2,refinery1
borneo_s|남보르네오|netherlands|j|1|10|1|1|0|rubber1|
batavia|바타비아|netherlands|u|20|150|5|4|2||civ1,light2,farm8
java_c|중부 자바|netherlands|h|3|180|4|1|0|oil1|oil1,light1,farm10
surabaya|수라바야|netherlands|u|10|160|5|6|2||civ1,dock1,light1,farm8
palembang|팔렘방|netherlands|j|5|15|3|1|1|oil3,rubber2,rare2|oil2,refinery1,rubber1,rare1
padang|파당|netherlands|m|1|25|2|1|0|rubber1,coal1|coal1,farm1
medan|메단|netherlands|j|3|30|3|2|1|rubber3,oil1|rubber2,oil1,farm2
makassar|마카사르|netherlands|j|3|40|2|2|0||farm2
manado|마나도|netherlands|j|1|10|1|1|0||farm1
ambon|암본|netherlands|j|1|5|1|2|0||
lesser_sunda|소순다 열도|netherlands|h|1|30|1|1|0||farm2
kupang|쿠팡(티모르)|netherlands|h|1|8|1|1|0||
vogelkop|포겔코프|netherlands|j|0|1|1|1|0|oil1|
hollandia|홀란디아|netherlands|j|1|2|1|1|0||
timor_p|동티모르|portugal|h|1|4|1|1|0||
manila|마닐라|usa|u|20|55|4|6|2||civ1,light1,farm4
luzon_n|북루손|usa|m|2|30|2|1|1|iron1|farm2
bicol|비콜|usa|j|1|20|2|1|0||farm2
visayas|비사야(세부)|usa|j|3|30|2|2|1||farm3
mindanao|민다나오|usa|j|2|15|1|2|0|rubber1|farm1
port_moresby|포트모르즈비|australia|j|3|2|1|2|1||
lae|라에|australia|j|1|3|1|1|0||
rabaul|라바울|australia|j|3|1.5|1|3|1||
bougainville|부갱빌|australia|j|1|0.5|1|1|0||
guadalcanal|과달카날|uk|j|1|1|1|1|0||
fiji|피지|uk|j|2|2|1|2|0||
darwin|다윈|australia|j|3|0.1|2|3|1||
outback|오스트레일리아 중부|australia|d|0|0.2|1|0|0||
kimberley|킴벌리|australia|d|0|0.3|1|1|0||
perth|퍼스|australia|p|5|4.5|3|3|1||farm2
adelaide|애들레이드|australia|p|5|6|3|2|1|iron2|iron1,farm2
queensland_n|북퀸즐랜드|australia|j|2|2|2|2|1||farm1
brisbane|브리즈번|australia|p|5|8.5|3|3|1|coal2|coal1,farm2
sydney|시드니|australia|u|20|27|5|8|2|coal4|civ3,arms1,dock1,steel1,coal3,light2,farm3
melbourne|멜버른|australia|u|15|19|5|4|2||civ2,arms1,light2,farm3
tasmania|태즈메이니아|australia|f|1|2.3|2|1|0||farm1
north_island|뉴질랜드 북섬|nz|h|10|9|3|4|1||light1,farm2
south_island|뉴질랜드 남섬|nz|m|2|6|2|2|0||farm2
guam|괌|usa|j|2|0.2|1|2|1||
saipan|사이판|japan|j|2|0.5|1|2|1||
palau|팔라우|japan|j|1|0.3|1|2|1||
truk|트루크|japan|j|3|0.4|1|6|1||
marshalls|마셜 제도|japan|j|2|0.1|1|3|1||
wake|웨이크|usa|p|2|0|1|1|1||
midway|미드웨이|usa|p|3|0|1|2|1||
hawaii|하와이(진주만)|usa|h|15|4|4|10|3||dock1
aleutians|알류샨 열도|usa|m|1|0.1|1|2|0||
alaska|알래스카|usa|f|1|0.5|1|1|0||
gilberts|길버트 제도|uk|p|1|0.3|1|1|0||
`;

/* 지도 밖 본국: 경제와 병력 모집만 있고 지도에 그리지 않는다. 지도의 진입점(해역 또는 지역)으로 병력을 보낸다. */
export const HOMELAND_TABLE = `
home_usa|미국 본토|usa|p|0|1280|8|10|5|coal8,iron6,oil10|civ40,arms6,dock12,steel12,tools10,chem5,light24,refinery6,farm30,coal8,iron6,oil10
home_uk|영국 본국|uk|p|0|470|8|10|5|coal6,iron2|civ22,arms10,dock12,steel6,tools6,chem3,light12,refinery2,farm6,coal6,iron2
home_france|프랑스 본국|france|p|0|420|7|8|4|coal3,iron4|civ18,arms10,dock6,steel4,tools4,chem2,light10,farm14,coal3,iron4
home_netherlands|네덜란드 본국|netherlands|p|0|85|8|6|2|coal1|civ5,arms2,dock3,steel1,tools1,chem1,light3,farm3,coal1
home_ussr|소련 유럽부|ussr|p|0|1500|5|4|4|coal8,iron8,oil8|civ32,arms30,dock4,steel12,tools8,chem4,light12,refinery4,farm40,coal8,iron8,oil8
`;
export const HOMELAND_LINKS = {
  home_usa: { sea: 'pacific_ne', port: 'hawaii', days: 18 },
  home_uk: { sea: 'laccadive', port: 'ceylon', days: 35 },
  home_france: { sea: 'indian_n', port: 'cochinchina', days: 40 },
  home_netherlands: { sea: 'indian_se', port: 'batavia', days: 42 },
  home_ussr: { land: ['novosibirsk', 'almaty', 'semipalatinsk'], days: 20 }
};
/* 지도가 이어 주지 않는 땅의 연결(해협 건너기, 둑길, 지도 가장자리에서 끊긴 반도). */
export const EXTRA_LINKS = [['kyushu', 'chugoku'], ['singapore', 'johor'], ['macau', 'guangzhou'], ['kamchatka', 'magadan'], ['hongkong', 'guangzhou'], ['kwantung', 'andong'], ['guangzhouwan', 'leizhou']];
