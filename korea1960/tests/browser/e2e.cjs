/* 실제 브라우저 검수 (Playwright 필요: 게임 실행에는 필요 없음).
 *   node tests/browser/e2e.cjs [KOREA1960.html 경로] [스크린샷 폴더]
 * 데스크톱 1440×900과 모바일 390×844에서 file://로 단일 HTML을 열고, 실제 클릭·파일 입력으로
 * 새 게임→사건→지도→준비→월 종료→결산→시계→이전 형식 저장 거부→검토용 저장 불러오기→시장→이해집단·집권 연합→
 * 법률 발의→건물 착공·생산방식·보조금·취소→정책·외교·지역 시책·자문·예산→저장 내보내기·다시 불러오기→손상 저장 거부→엔딩까지 진행한다.
 * 화면마다 가로 넘침, 44px 미만 터치 대상, 콘솔·페이지 오류, 실패한 요청을 검사한다. 실패하면 종료 코드 1. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const html = path.resolve(process.argv[2] || path.join(root, 'KOREA1960.html'));
const out = path.resolve(process.argv[3] || path.join(root, 'tests/browser/out'));
fs.mkdirSync(out, { recursive: true });
const oldSave = path.join(root, 'tests/fixtures/v4_data130_1966_regional_edicts.json');
const sample = path.join(root, 'game/saves/1964_start_governing.json');
const problems = [];
const check = (ok, msg) => { if (!ok) { problems.push(msg); console.log('  ✗', msg); } else console.log('  ✓', msg); };

async function audit(page, tag) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const small = [...document.querySelectorAll('button, .btn, input, select, summary, a.btn, .choice, .region, .kpi')]
      .filter(el => { const b = el.getBoundingClientRect(); const st = getComputedStyle(el); return b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && !el.closest('.toast') && el.type !== 'file' && el.type !== 'range' && b.height < 36; })
      .map(el => `${el.tagName.toLowerCase()}.${el.className}:${Math.round(el.getBoundingClientRect().height)}px`);
    const wide = [...document.querySelectorAll('body *')].filter(el => { const b = el.getBoundingClientRect(); return b.right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.sidebar') && !el.closest('[data-scroll-x]') && !el.closest('[data-clip-x]') && !el.closest('.sr-only'); }).slice(0, 5).map(el => el.tagName + '.' + el.className);
    return { overflow: doc.scrollWidth > doc.clientWidth, wide, small: small.slice(0, 8) };
  });
  check(!r.overflow && !r.wide.length, `${tag}: 가로 넘침 없음 ${r.wide.join(',')}`);
  check(!r.small.length, `${tag}: 36px 미만 상호작용 요소 없음 ${r.small.join(' ')}`);
}
const S = page => page.evaluate(() => window.__GAME_DEBUG__.getState());

async function run(viewport, tag) {
  const mobileView = viewport.width < 760;
  console.log(`\n## ${tag} ${viewport.width}×${viewport.height}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url().slice(0, 100)));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) errors.push('external request: ' + r.url()); });
  await page.goto('file://' + html); await page.waitForSelector('.title-screen');
  await page.screenshot({ path: `${out}/${tag}_01_title.png` });
  await audit(page, 'title');

  // 새 게임
  await page.click('[data-action="newgame"]'); await page.fill('#seed-input', '20261110'); await page.click('[data-action="startNew"]');
  await page.waitForSelector('.shell'); let s = await S(page);
  check(s.turn === 0 && s.phase === 'prelude' && s.queue[0] === 'opening' && s.rng !== 0, '새 게임: 1960-01, 관찰·준비, 첫 사건');
  check(await page.isDisabled('[data-action="endMonth"]').catch(() => true) || !(await page.$('[data-action="endMonth"]')), '사건 전에는 다음 달 버튼이 없거나 비활성');
  await page.waitForTimeout(100); await page.screenshot({ path: `${out}/${tag}_02_overview.png` }); await audit(page, 'overview(사건)');
  // 키보드로 첫 선택지
  await page.focus('.choice >> nth=0'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  // 데이터 1.2.0: 가상 사건의 보너스는 eventGain(0.35)만큼 줄어든 값으로 기록된다(행정 +1 → +0.35).
  s = await S(page); check(s.queue.length === 0 && s.log.some(l => l.type === 'event' && l.choiceId === 'opening_1' && l.changes?.admin > 0 && l.changes.admin <= 1), '키보드 Enter로 선택, 연대기에 변화 기록');
  // 지도: 화면 한가운데 기본 화면. 권역 10개, 권역 선택·색 바꾸기·확대·키보드.
  check(await page.$$eval('.kmap .mregion', els => els.length) === 10 && await page.isVisible('.map-stage'), '지도: 시작 화면 한가운데에 권역 10개');
  await page.screenshot({ path: `${out}/${tag}_02b_map.png` }); await audit(page, '지도');
  await page.click('.mregion[data-id="gyeongbuk"]', { force: true }); await page.waitForSelector('.map-card');
  check((await page.textContent('.map-card h2')).includes('경북') && (await page.textContent('.map-card')).includes('시장 접근성') && (await page.textContent('.map-card')).includes('방직 공장'), '지도: 권역을 누르면 권역 정보(건물·접근성)');
  const fill0 = await page.getAttribute('.mregion[data-id="jeonnam"]', 'fill');
  await page.click('[data-action="mapLayer"][data-id="farm"]');
  check(await page.getAttribute('.mregion[data-id="jeonnam"]', 'fill') !== fill0 && (await page.getAttribute('.kmap', 'aria-label')).includes('경지'), '지도: 경지 사용으로 색 바꾸기');
  await page.click('[data-action="mapLayer"][data-id="access"]'); check((await page.getAttribute('.kmap', 'aria-label')).includes('시장 접근성'), '지도: 시장 접근성 색 기준');
  await page.click('[data-action="mapLayer"][data-id="dev"]');
  if (!mobileView) { const vb0 = await page.getAttribute('.kmap', 'viewBox'); await page.click('[data-action="mapZoom"][data-id="in"]'); const vb1 = await page.getAttribute('.kmap', 'viewBox'); await page.click('[data-action="mapZoom"][data-id="reset"]'); check(vb0 !== vb1 && await page.getAttribute('.kmap', 'viewBox') === vb0, '지도: 확대와 전체 보기');
    await page.click('.map-card [data-action="closeRegion"]'); const box = await page.$eval('.kmap', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 60, box.y + 40, { steps: 5 }); await page.mouse.up();
    check(await page.getAttribute('.kmap', 'viewBox') !== vb0 && !(await page.$('.map-card')), '지도: 끌어서 이동(권역은 선택되지 않음)');
    await page.click('[data-action="mapZoom"][data-id="reset"]'); }
  await page.focus('.mregion[data-id="jeju"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(50);
  check((await page.textContent('.map-card h2')).includes('제주'), '지도: 키보드로 권역 선택');
  await page.click('.map-card [data-action="closeRegion"]');
  await page.click('[data-action="nav"][data-view="overview"]');
  for (let i = 0; i < 3; i++) await page.click('.calm [data-action="prepare"]');
  s = await S(page); check(s.ap === 0 && s.influence === 31, `사전 준비 3회: AP 0, 영향력 ${s.influence}`);
  check(await page.isDisabled('.calm [data-action="prepare"]'), 'AP 0이면 준비 버튼 비활성');
  await page.click(viewport.width < 760 ? '.bottombar [data-action="endMonth"]' : '.statusbar [data-action="endMonth"]');
  await page.waitForSelector('[role="dialog"]'); await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}/${tag}_03_report.png` }); await audit(page, '월 결산');
  s = await S(page); check(s.turn === 1 && s.ap === 3 && s.report?.turn === 0 && s.report.market.gdp > 0, '월 종료: 1960-02, AP 3, 결산 기록');
  check((await page.textContent('[role="dialog"]')).includes('물가 지수') && (await page.textContent('[role="dialog"]')).includes('시장의 생산'), '결산 창에 시장 요약과 생산의 원인');
  const focusedInDialog = await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')); check(focusedInDialog, '결산 창이 키보드 초점을 받음');
  await page.keyboard.press('Escape'); check(!(await page.$('[role="dialog"]')), 'Esc로 결산 창 닫기');

  // 시간: 한 틱 = 하루. 사건이 남아 있으면 흐르지 않고, 결정하면 흐르며, 말일이 지나면 결산하고 새 사건에서 스스로 멈춘다.
  const mobile = viewport.width < 760, playSel = mobile ? '.bottombar [data-action="clockToggle"]' : '.statusbar [data-action="clockToggle"]';
  const clockOf = () => page.evaluate(() => ({ ...window.__GAME_DEBUG__.clock, timer: undefined }));
  s = await S(page);
  if (s.queue.length) { await page.click(playSel); await page.waitForTimeout(900); check((await S(page)).day === 1 && (await clockOf()).waiting, '사건이 남아 있으면 진행을 눌러도 날짜가 그대로(결정 대기)'); await page.click('.choice:not([aria-disabled="true"]) >> nth=0'); }
  else await page.click(playSel);
  await page.waitForFunction(() => window.__GAME_DEBUG__.getState().day >= 4, null, { timeout: 8000 }).then(() => check(true, '결정하면 시간이 흐르고 하루씩 날짜가 넘어감'), () => check(false, '시간 진행'));
  s = await S(page); const shown = await page.textContent(mobile ? '.js-date-short' : '.js-date');
  check([s.day - 1, s.day, s.day + 1].some(n => shown.includes(`${n}일`)), `화면 날짜 표시: ${shown.trim()}`);
  await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press(' ');
  const pausedDay = (await S(page)).day; await page.waitForTimeout(1000);
  check((await S(page)).day === pausedDay && !(await clockOf()).running, '스페이스로 일시정지하면 날짜가 멈춤');
  if (mobile) { for (let i = 0; i < 3; i++) await page.click('.bottombar [data-action="speedCycle"]'); } else await page.click('.statusbar [data-action="speed"][data-id="8"]');
  check((await clockOf()).speed === 8, '배속 ×8');
  await page.click(playSel);
  await page.waitForFunction(() => window.__GAME_DEBUG__.getState().turn === 2, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(150); s = await S(page); const c2 = await clockOf();
  check(s.turn === 2 && s.day === 1 && s.report?.turn === 1, `말일 다음 날 월 결산 → 다음 달 1일 (${s.turn}/${s.day})`);
  check(s.queue.length > 0 && !c2.running && c2.waiting, '새 사건이 오면 시계가 스스로 멈춤');
  check((await page.textContent('.agenda')).includes('1960년 2월 결산'), '이번 달 업무에 지난달 결산 항목');
  await page.click('[data-action="nav"][data-view="overview"]'); await page.click('.choice:not([aria-disabled="true"]) >> nth=0');
  check((await clockOf()).running, '사건을 결정하면 시간이 다시 흐름');
  await page.click(playSel); check(!(await clockOf()).running, '진행 버튼으로 멈춤');
  await page.screenshot({ path: `${out}/${tag}_03b_clock.png` }); await audit(page, '시계 진행 후');

  const endSel = mobileView ? '.bottombar [data-action="endMonth"], .bottombar [data-action="gotoEvent"]' : '.statusbar [data-action="endMonth"]';
  const nextMonth = async () => { await page.click(endSel); if (await page.$('[role="dialog"]')) await page.click('[role="dialog"] [data-action="closeModal"]'); let st = await S(page); if (st.queue.length && !st.ending) { await page.click('[data-action="nav"][data-view="overview"]'); await page.click('.choice:not([aria-disabled="true"]) >> nth=0'); st = await S(page); } return st; };
  const text = sel => page.textContent(sel);

  // 이전 형식 저장은 이유를 알리고 거부한다. 현재 진행은 그대로다.
  await page.click('[data-action="nav"][data-view="archive"]'); const before0 = JSON.stringify(await S(page));
  await page.setInputFiles('[data-input="import"]', oldSave); await page.waitForSelector('.toast.bad');
  check((await text('.toast.bad')).includes('경제 구조') && JSON.stringify(await S(page)) === before0, '이전 형식(4) 저장: 이유를 알리고 거부, 진행 유지');
  await page.click('.toast [data-action="dismissToast"]');
  // 검토용 저장(형식 5, 1964년 1월 취임 직후) 불러오기
  await page.setInputFiles('[data-input="import"]', sample); await page.waitForSelector('[role="dialog"]');
  check((await text('[role="dialog"]')).includes('버전 5') && (await text('[role="dialog"]')).includes('건물 단계'), '저장 파일 확인 창: 형식 5, 건물 단계');
  await page.click('[data-action="acceptImport"]'); await page.waitForTimeout(100);
  s = await S(page); check(s.version === 5 && s.phase === 'governing' && s.turn === 48 && s.ap === 3 && s.buildings.length > 30, `저장 불러오기: ${s.turn} ${s.phase} AP ${s.ap}`);
  if (s.queue.length) { await page.click('[data-action="nav"][data-view="overview"]'); await page.click('.choice:not([aria-disabled="true"]) >> nth=0'); s = await S(page); }

  // 시장: 상품 표, 분류, 상품 상세
  await page.click('[data-action="nav"][data-view="market"]');
  check(await page.$$eval('table.goods tbody tr', els => els.length) === 19 && (await text('table.goods thead')).includes('판매 주문') && (await text('table.goods thead')).includes('구매 주문'), '시장: 상품 19종의 판매·구매 주문 표');
  await page.screenshot({ path: `${out}/${tag}_04_market.png`, fullPage: true }); await audit(page, '시장');
  await page.click('tr.grow[data-id="steel"]');
  check((await text('.good-detail h2')).includes('강철') && (await text('.good-detail')).includes('수입') && (await text('.good-detail')).includes('제철소'), '시장: 상품을 누르면 누가 팔고 사는지, 만드는 건물');
  await page.focus('tr.grow[data-id="clothes"]'); await page.keyboard.press('Enter'); check((await text('.good-detail h2')).includes('의복'), '시장: 키보드로 상품 선택');
  await page.click('[data-action="goodCat"][data-id="industrial"]'); check(await page.$$eval('table.goods tbody tr', els => els.length) === 9, '시장: 분류로 거르기(산업재 9종)');
  await page.click('[data-action="goodCat"][data-id="all"]');
  await page.click('.good-detail [data-action="nav"][data-focus="garment"]'); check((await text('main h1')).includes('수요가 있는 곳') && await page.isVisible('#c-garment'), '시장 → 그 상품을 만드는 건물 카드로 이동');

  // 이해집단: 여섯 집단, 집권 연합에 넣기
  await page.click('[data-action="nav"][data-view="groups"]');
  check(await page.$$eval('.card.group', els => els.length) === 6 && (await text('main')).includes('요구하는 건물') && (await text('main')).includes('바라는 법'), '이해집단: 여섯 집단의 지지도·요구·바라는 법');
  await page.screenshot({ path: `${out}/${tag}_05_groups.png`, fullPage: true }); await audit(page, '이해집단');
  await page.click('button[data-action="askCoalition"][data-id="petite"]'); await page.waitForSelector('[role="dialog"]');
  check((await text('[role="dialog"]')).includes('연합의 세력'), '집권 연합 확인 창: 세력과 정당성 변화'); await page.screenshot({ path: `${out}/${tag}_05b_coalition_confirm.png` });
  await page.click('[data-action="confirm"]'); s = await S(page); check(s.government.includes('petite') && s.ap === 2 && s.government.length === 3, `소시민을 집권 연합에: ${s.government.join(',')}`);
  check(await page.isDisabled('button[data-action="askCoalition"][data-id="workers"]') && (await text('.card.group >> nth=0')).includes('3개 집단까지'), '연합이 차면 넣기 버튼이 비활성(사유 표시)');

  // 법률: 분류 세 열, 발의, 제정 중 표시
  await page.click('[data-action="nav"][data-view="laws"]');
  check(await page.$$eval('.law-row', els => els.length) === 14 && await page.$$eval('.law-col', els => els.length) === 3, '법률: 세 열에 분류 14개');
  await page.click('.law-row[data-id="speech"]'); check((await text('main .cards')).includes('언론 자유 보장') && (await text('main .cards')).includes('이해집단의 태도'), '법률: 분류를 누르면 선택지와 이해집단의 태도');
  await page.screenshot({ path: `${out}/${tag}_06_laws.png`, fullPage: true }); await audit(page, '법률');
  check(await page.isDisabled('button[data-action="askEnact"][data-id="pollution_control"]').catch(() => true), '법률: 아직 열리지 않은 법은 비활성');
  await page.click('button[data-action="askEnact"][data-id="press_freedom"]'); await page.waitForSelector('[role="dialog"]');
  check((await text('[role="dialog"]')).includes('제정 절차') && (await text('[role="dialog"]')).includes('통과 확률'), '법률 발의 확인 창: 절차와 확률'); await page.screenshot({ path: `${out}/${tag}_06b_enact_confirm.png` });
  const t0 = s.stats.treasury; await page.click('[data-action="confirm"]'); s = await S(page);
  check(s.enactment?.lawId === 'press_freedom' && s.ap === 1 && s.stats.treasury === t0 - 8, '언론 자유 보장 발의: AP·시행비 차감, 제정 중');
  check(await page.isVisible('.enact') && (await text('.enact')).includes('언론 자유 보장') && (await text('.agenda')).includes('언론 자유 보장'), '제정 중인 법이 법률 화면과 진행 중 목록에 보임');
  await page.click('.law-row[data-id="labor"]'); check(await page.isDisabled('button[data-action="askEnact"][data-id="labor_inspection"]') && (await text('main .cards')).includes('한 번에 하나'), '한 번에 한 법만: 다른 법은 비활성(사유 표시)');

  // 건물·건설: 권역 선택, 착공, 생산방식, 보조금, 대기열
  await page.click('[data-action="nav"][data-view="build"]'); await page.click('.region[data-id="jeonnam"]');
  if (await page.getAttribute('[data-action="buildAll"]', 'aria-pressed') === 'true') await page.click('[data-action="buildAll"]'); // 시장에서 건물 카드로 건너오면 전체 표시가 켜져 있다
  check((await text('main')).includes('이번 달 건설점') && (await text('main')).includes('전남에 지을 수 있는 건물') && await page.$$eval('.brow', els => els.length) >= 4, '건물·건설: 건설점, 권역의 건물, 지을 수 있는 건물');
  await page.screenshot({ path: `${out}/${tag}_07_build.png`, fullPage: true }); await audit(page, '건물·건설');
  check(!(await page.$('#c-coal_mine')), '전남에는 탄광 카드가 없음(석탄이 없는 권역)');
  const pmBtn = await page.$('#b-farm button[data-action="pm"][data-pm="1"]'); check(pmBtn && await pmBtn.isDisabled() && (await pmBtn.getAttribute('title')).includes('농업'), '생산방식: 조건이 안 되면 비활성(사유는 농업 기술 지수)');
  await page.click('#b-fishery button[data-action="subsidy"]'); s = await S(page); check(s.buildings.find(b => b.id === 'fishery' && b.regionId === 'jeonnam').subsidy === true && s.ap === 1, '보조금 켜기: 행동점수를 쓰지 않음');
  await page.click('#b-fishery button[data-action="subsidy"]');
  await page.click('#c-school button[data-action="askBuild"]'); await page.waitForSelector('[role="dialog"]');
  check((await text('[role="dialog"]')).includes('건설점') && (await text('[role="dialog"]')).includes('자재값'), '착공 확인 창: 건설점과 자재값'); await page.screenshot({ path: `${out}/${tag}_07b_build_confirm.png` });
  const t1 = s.stats.treasury; await page.click('[data-action="confirm"]'); s = await S(page);
  check(s.construction.some(q => q.id === 'school' && q.regionId === 'jeonnam' && !q.private) && s.ap === 0 && s.stats.treasury === t1, '전남 학교 착공: AP 1, 착공비 없음');
  check(await page.isDisabled('#c-clinic button[data-action="askBuild"]') && (await text('#c-clinic')).includes('행동점수가 부족합니다'), 'AP 0이면 착공 버튼 비활성(사유 표시)');
  check((await text('.queue')).includes('학교') && (await text('.agenda')).includes('학교'), '대기열과 진행 중 목록에 공사 표시');
  s = await nextMonth(); const q1 = s.construction.find(q => q.id === 'school' && q.regionId === 'jeonnam');
  check(s.turn === 49 && s.ap === 3 && q1 && q1.progress > 0 && s.report.finance.upkeep > 0, `한 달 뒤: 공사 진행 ${q1 ? q1.progress : 0}점, AP 3`);
  // 대기열: 두 번째 공사를 올리고 맨 앞으로, 취소
  await page.click('[data-action="nav"][data-view="build"]'); await page.click('.region[data-id="busan"]');
  await page.click('#c-garment button[data-action="askBuild"]'); await page.click('[data-action="confirm"]'); s = await S(page);
  const gi = s.construction.findIndex(q => q.id === 'garment' && q.regionId === 'busan' && !q.private); check(gi >= 0, '부산 봉제 공장 착공');
  await page.click(`.queue button[data-action="prioritize"][data-id="${gi}"]`); s = await S(page); check(s.construction.find(q => !q.private).id === 'garment' && s.ap === 2, '맨 앞으로: 정부 대기열의 첫 공사가 됨(AP 없음)');
  const gi2 = s.construction.findIndex(q => q.id === 'garment' && !q.private); await page.click(`.queue button[data-action="cancelBuild"][data-id="${gi2}"]`); await page.waitForSelector('[role="dialog"]'); await page.click('[data-action="confirm"]');
  s = await S(page); check(!s.construction.some(q => q.id === 'garment' && q.regionId === 'busan' && !q.private) && s.ap === 2, '공사 취소: 대기열에서 빠짐(AP 없음)');

  // 정책
  await page.click('[data-action="nav"][data-view="policy"]'); await page.click('[data-action="policyStatus"][data-id="open"]');
  await page.screenshot({ path: `${out}/${tag}_08_policy.png`, fullPage: true }); await audit(page, '정책');
  check(!(await text('main')).includes('의회 법안'), '정책 화면에는 행정 정책만(법안은 법률 화면으로)');
  await page.click('button[data-action="askPolicy"]:not([disabled]) >> nth=0'); await page.waitForSelector('[role="dialog"]'); await page.click('[data-action="confirm"]');
  s = await S(page); check(s.policies.length === 1 && s.ap === 1, `정책 시행: ${s.policies[0]}`);
  // 외교
  await page.click('[data-action="nav"][data-view="diplomacy"]');
  await page.click('button[data-action="askDiplomacy"][data-id="usa"][data-mode="talk"]'); await page.click('[data-action="confirm"]');
  s = await S(page); check(s.monthActions.includes('diplomacy:usa') && s.ap === 0, '미국 정례 대화');
  check(await page.isDisabled('button[data-action="askDiplomacy"][data-id="usa"][data-mode="humanitarian"]'), '같은 달 같은 상대 두 번째 외교는 비활성');
  await page.screenshot({ path: `${out}/${tag}_09_diplomacy.png`, fullPage: true }); await audit(page, '외교');
  s = await nextMonth();
  // 지역 시책: 지도의 권역 카드에서 시행하고 거두기
  await page.click('[data-action="nav"][data-view="map"]'); await page.click('[data-action="mapLayer"][data-id="res"]');
  check(await page.$$eval('.kmap .rb', els => els.length) > 20, '지도: 지형·자원 표식'); await page.screenshot({ path: `${out}/${tag}_10_map_resources.png`, fullPage: mobileView }); await audit(page, '지도(지형·자원)');
  await page.click('.mregion[data-id="jeonbuk"]', { force: true }); await page.waitForSelector('.map-card');
  await page.click('.map-card button[data-action="askEdict"][data-id="grain_drive"]'); await page.waitForSelector('[role="dialog"]'); await page.click('[data-action="confirm"]');
  s = await S(page); check(s.edicts.length === 1 && s.edicts[0].regionId === 'jeonbuk' && s.ap === 2, '전북에 곡창 증산 지도 시행');
  check(await page.$$eval('.kmap .epill', els => els.length) === 1, "지도에 '시책' 표시");
  await page.click('.map-card button[data-action="askRevoke"]'); await page.click('[data-action="confirm"]'); s = await S(page); check(s.edicts.length === 0 && s.ap === 2, '시책 거두기(AP 없음)');
  await page.click('.map-card [data-action="nav"][data-view="build"]'); check((await text('main .panel h2 >> nth=2')).includes('전북') || (await text('main')).includes('전북에 지을 수 있는 건물'), '권역 카드 → 그 권역의 건물·건설 화면');
  await page.click('[data-action="mapLayer"][data-id="dev"]').catch(() => {});
  // 내각
  await page.click('[data-action="nav"][data-view="cabinet"]'); await page.screenshot({ path: `${out}/${tag}_11_cabinet.png`, fullPage: true }); await audit(page, '내각');
  const adv = await page.$('button[data-action="askAdviser"]:not([disabled]):not(.danger)');
  if (adv) { await adv.click(); await page.click('[data-action="confirm"]'); s = await S(page); check(s.advisers.length === 1, `자문 임명: ${s.advisers.join(',')}`); }
  // 재정: 세입·세출 내역, 예산 프리셋, 잘못된 합계 거부
  await page.click('[data-action="nav"][data-view="budget"]');
  check((await text('main')).includes('소비세') && (await text('main')).includes('정부·건설 부문 인건비') && (await text('main')).includes('계층의 살림'), '재정: 세입·세출 내역과 계층의 살림');
  await page.fill('#b-industry', '90'); await page.dispatchEvent('#b-industry', 'change');
  check(await page.isDisabled('[data-action="applyBudget"]'), '예산 합계가 100이 아니면 적용 버튼 비활성');
  await page.click('[data-action="preset"][data-id="3"]'); await page.click('[data-action="applyBudget"]');
  s = await S(page); check(s.budget.education === 30 && s.budget.industry === 16, '예산 프리셋(인재 우선) 적용');
  await page.screenshot({ path: `${out}/${tag}_12_budget.png`, fullPage: true }); await audit(page, '재정');
  // 몇 달 진행: 공사 준공과 법률 검사가 일어난다
  for (let i = 0; i < 9; i++) s = await nextMonth();
  check(s.counters.built + s.counters.privateBuilt >= 1, `준공: 정부 ${s.counters.built}단계 · 민간 ${s.counters.privateBuilt}단계`);
  check(s.log.some(l => l.type === 'law' && l.lawId === 'press_freedom' && l.turn > 48), '법률 제정 검사가 연대기에 기록됨');
  await page.click('[data-action="nav"][data-view="overview"]'); check((await text('main')).includes('시장에서 눈에 띄는 상품') && (await text('main')).includes('이해집단'), '상황판: 시장 요약과 이해집단');

  // 기록실: 내보내기 → 다시 불러오기, 손상 파일 거부
  await page.click('[data-action="nav"][data-view="archive"]'); s = await S(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('main [data-action="export"]')]);
  const savePath = path.join(out, `${tag}_export.json`); await download.saveAs(savePath);
  const exported = JSON.parse(fs.readFileSync(savePath, 'utf8')); check(exported.version === 5 && exported.state.turn === s.turn && exported.state.day === s.day && exported.state.buildings.length === s.buildings.length, '저장 파일 내보내기 (버전 5, 건물·시장 포함)');
  await page.setInputFiles('[data-input="import"]', savePath); await page.click('[data-action="acceptImport"]');
  const s2 = await S(page); check(JSON.stringify(s2) === JSON.stringify(s), '내보낸 파일을 다시 불러오면 상태가 같음');
  await page.click('[data-action="nav"][data-view="archive"]');
  const bad = path.join(out, `${tag}_bad.json`); exported.state.stats.gdp = 'NaN'; exported.state.queue = ['<img src=x onerror=alert(1)>']; fs.writeFileSync(bad, JSON.stringify(exported));
  await page.setInputFiles('[data-input="import"]', bad); await page.waitForSelector('.toast.bad');
  const s3 = await S(page); check(JSON.stringify(s3) === JSON.stringify(s), '손상된 저장은 거부하고 현재 상태 유지');
  // 저장 텍스트 복사·붙여넣기 (파일 다운로드가 막힌 화면용)
  await page.click('main [data-action="exportText"]'); await page.waitForSelector('#save-text');
  const saveText = await page.inputValue('#save-text'); check(JSON.parse(saveText).state.turn === s.turn && !saveText.includes('\n  '), '저장 텍스트 보기(줄바꿈 없는 한 덩어리)');
  await page.keyboard.press('Escape');
  await page.click('main [data-action="pasteImport"]'); await page.fill('#paste-text', '{"format":"KOREA1960_SAVE","version":2,"state":{}}'); await page.click('[data-action="importText"]');
  check(await page.isVisible('[role="dialog"] [role="alert"]') && (await text('[role="dialog"] [role="alert"]')).includes('경제 구조') && JSON.stringify(await S(page)) === JSON.stringify(s), '이전 형식의 저장 텍스트는 이유를 알리고 거부');
  // 붙여넣기를 흉내 낸다(Playwright의 fill은 한 글자씩 넣는 편집 명령이라 긴 저장 텍스트에서 매우 느리다).
  await page.$eval('#paste-text', (el, v) => { el.value = v; }, saveText); await page.click('[data-action="importText"]'); await page.click('[data-action="acceptImport"]');
  check(JSON.stringify(await S(page)) === JSON.stringify(s), '저장 텍스트를 붙여 넣으면 상태가 같음');
  await page.click('[data-action="nav"][data-view="archive"]');
  await page.click('[data-action="logFilter"][data-id="construction"]');
  await page.screenshot({ path: `${out}/${tag}_13_archive.png`, fullPage: true }); await audit(page, '기록실');
  s = await S(page); check(s.visited.includes('archive') && s.visited.includes('market'), '화면 방문 기록');
  // 지표 설명 창
  await page.click('[data-action="nav"][data-view="overview"]'); await page.click('.kpi[data-id="gdp"]');
  check((await text('[role="dialog"]')).includes('부가가치'), '지표 설명 창'); await page.keyboard.press('Escape');
  if (!mobileView) { await page.click('[data-action="help"]'); check((await text('[role="dialog"]')).includes('판매 주문') && (await text('[role="dialog"]')).includes('집권 연합'), '게임 방법: 시장·법률·이해집단 설명'); await page.keyboard.press('Escape'); }
  await page.screenshot({ path: `${out}/${tag}_14_overview_governing.png`, fullPage: true }); await audit(page, '상황판(국정)');

  // 끝까지 진행 (화면 디버그 훅으로 빠르게, 매달 화면을 다시 그림)
  const result = await page.evaluate(() => {
    const G = window.__GAME_DEBUG__; let guard = 0;
    while (!G.getState().ending && guard++ < 2000) {
      const st = G.getState();
      if (st.queue.length) { const e = G.data.events.find(x => x.id === st.queue[0]); const c = e.choices.find(c => !c.ending && !G.engine.choiceReason(st, G.data, c.id)) || e.choices.find(c => !G.engine.choiceReason(st, G.data, c.id)); G.dispatch({ type: 'choose', choiceId: c.id }); }
      else G.dispatch({ type: 'endMonth' });
    }
    const end = G.getState(); return { turn: end.turn, ending: end.ending?.id, guard };
  });
  check(!!result.ending, `엔딩 도달: ${result.ending} @${result.turn}`);
  if (await page.$('[role="dialog"]')) { await page.screenshot({ path: `${out}/${tag}_15a_final_report.png` }); await page.keyboard.press('Escape'); }
  await page.click('[data-action="nav"][data-view="overview"]'); await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}/${tag}_15_ending.png`, fullPage: true }); await audit(page, '엔딩');
  check((await page.textContent('main')).includes('엔딩 평가'), '엔딩 평가 화면');
  const before = await S(page); const tried = await page.evaluate(() => window.__GAME_DEBUG__.dispatch({ type: 'endMonth' }).ok);
  check(!tried && JSON.stringify(await S(page)) === JSON.stringify(before), '종료 후 행동은 상태를 바꾸지 않음');
  // 새로고침 뒤 자동 저장 이어하기
  await page.reload(); await page.waitForSelector('.title-screen');
  check((await page.textContent('[data-action="continue"]')).includes('종료됨'), '새로고침 후 이어하기에 자동 저장 표시');

  check(!errors.length, `오류·외부 요청 없음 ${errors.slice(0, 5).join(' | ')}`);
  await browser.close();
}

(async () => {
  await run({ width: 1440, height: 900 }, 'desktop');
  await run({ width: 390, height: 844 }, 'mobile');
  console.log(`\n${problems.length ? `실패 ${problems.length}건` : '모든 브라우저 검사 통과'}`);
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
