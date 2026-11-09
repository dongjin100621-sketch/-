/* 실제 브라우저 검수 (Playwright 필요: 게임 실행에는 필요 없음).
 *   node tests/browser/e2e.cjs [KOREA1960.html 경로] [스크린샷 폴더]
 * 데스크톱 1440×900과 모바일 390×844에서 file://로 단일 HTML을 열고, 실제 클릭·파일 입력으로
 * 새 게임→사건→준비→월 종료→결산→버전 1 저장 불러오기→정책·법안·사업·외교·자문·예산·상환→
 * 저장 내보내기·다시 불러오기→손상 저장 거부→8개 화면→엔딩까지 진행한다.
 * 화면마다 가로 넘침, 44px 미만 터치 대상, 콘솔·페이지 오류, 실패한 요청을 검사한다. 실패하면 종료 코드 1. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const html = path.resolve(process.argv[2] || path.join(root, 'KOREA1960.html'));
const out = path.resolve(process.argv[3] || path.join(root, 'tests/browser/out'));
fs.mkdirSync(out, { recursive: true });
const fixture = path.join(root, 'tests/fixtures/v1_1964_governing.json');
const problems = [];
const check = (ok, msg) => { if (!ok) { problems.push(msg); console.log('  ✗', msg); } else console.log('  ✓', msg); };

async function audit(page, tag) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const small = [...document.querySelectorAll('button, .btn, input, select, summary, a.btn, .choice, .region, .kpi')]
      .filter(el => { const b = el.getBoundingClientRect(); const st = getComputedStyle(el); return b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && !el.closest('.toast') && el.type !== 'file' && el.type !== 'range' && b.height < 36; })
      .map(el => `${el.tagName.toLowerCase()}.${el.className}:${Math.round(el.getBoundingClientRect().height)}px`);
    const wide = [...document.querySelectorAll('body *')].filter(el => { const b = el.getBoundingClientRect(); return b.right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.sidebar') && !el.closest('.sr-only'); }).slice(0, 5).map(el => el.tagName + '.' + el.className);
    return { overflow: doc.scrollWidth > doc.clientWidth, wide, small: small.slice(0, 8) };
  });
  check(!r.overflow && !r.wide.length, `${tag}: 가로 넘침 없음 ${r.wide.join(',')}`);
  check(!r.small.length, `${tag}: 36px 미만 상호작용 요소 없음 ${r.small.join(' ')}`);
}
const S = page => page.evaluate(() => window.__GAME_DEBUG__.getState());

async function run(viewport, tag) {
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
  s = await S(page); check(s.queue.length === 0 && s.log.some(l => l.type === 'event' && l.choiceId === 'opening_1' && l.changes?.admin === 1), '키보드 Enter로 선택, 연대기에 변화 기록');
  for (let i = 0; i < 3; i++) await page.click('.calm [data-action="prepare"]');
  s = await S(page); check(s.ap === 0 && s.influence === 31, `사전 준비 3회: AP 0, 영향력 ${s.influence}`);
  check(await page.isDisabled('.calm [data-action="prepare"]'), 'AP 0이면 준비 버튼 비활성');
  await page.click(viewport.width < 760 ? '.bottombar [data-action="endMonth"]' : '.topbar [data-action="endMonth"]');
  await page.waitForSelector('[role="dialog"]'); await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}/${tag}_03_report.png` }); await audit(page, '월 결산');
  s = await S(page); check(s.turn === 1 && s.ap === 3 && s.report?.turn === 0, '월 종료: 1960-02, AP 3, 결산 기록');
  const focusedInDialog = await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')); check(focusedInDialog, '결산 창이 키보드 초점을 받음');
  await page.keyboard.press('Escape'); check(!(await page.$('[role="dialog"]')), 'Esc로 결산 창 닫기');

  // 버전 1 저장 파일 불러오기 (실제 파일 입력)
  await page.click('[data-action="nav"][data-view="archive"]');
  await page.setInputFiles('[data-input="import"]', fixture); await page.waitForSelector('[role="dialog"]');
  check((await page.textContent('[role="dialog"]')).includes('버전 1 → 2로 변환'), '버전 1 저장 → 변환 안내');
  await page.click('[data-action="acceptImport"]'); await page.waitForTimeout(100);
  s = await S(page); check(s.version === 2 && s.phase === 'governing' && s.turn === 48, `저장 불러오기: ${s.turn} ${s.phase}`);
  if (s.queue.length) { await page.click('.choice:not([aria-disabled="true"]) >> nth=0'); s = await S(page); }
  check(s.ap === 0, '검토용 저장은 AP를 모두 쓴 상태(버튼 비활성 사유 확인)');
  await page.click('[data-action="nav"][data-view="policy"]'); await page.click('[data-action="policyStatus"][data-id="open"]');
  check((await page.textContent('main')).includes('행동점수가 부족합니다'), 'AP 0일 때 시행 가능 목록이 비어 있는 이유 표시');
  await page.click('[data-action="policyStatus"][data-id="all"]');
  check((await page.textContent('main .cards')).includes('사유: 행동점수가 부족합니다'), '정책 카드마다 비활성 사유 표시');
  await page.click(viewport.width < 760 ? '.bottombar [data-action="endMonth"]' : '.topbar [data-action="endMonth"]'); await page.click('[role="dialog"] [data-action="closeModal"]');
  s = await S(page); if (s.queue.length) { await page.click('[data-action="nav"][data-view="overview"]'); await page.click('.choice:not([aria-disabled="true"]) >> nth=0'); s = await S(page); }
  check(s.turn === 49 && s.ap === 3, `1964-02 진행, AP 3`);

  // 정책 (확인 창)
  await page.click('[data-action="nav"][data-view="policy"]'); await page.click('[data-action="policyStatus"][data-id="open"]');
  await page.screenshot({ path: `${out}/${tag}_04_policy.png`, fullPage: true }); await audit(page, '정책');
  const treasury0 = s.stats.treasury, ap0 = s.ap;
  await page.click('button[data-action="askPolicy"]:not([disabled]) >> nth=0'); await page.waitForSelector('[role="dialog"]');
  await page.screenshot({ path: `${out}/${tag}_05_confirm.png` });
  await page.click('[data-action="confirm"]'); s = await S(page);
  check(s.ap === ap0 - 1 && s.stats.treasury < treasury0 && s.policies.length >= 1, `정책 시행: AP ${ap0}→${s.ap}, 국고 ${treasury0.toFixed(1)}→${s.stats.treasury.toFixed(1)}`);
  check(await page.$('.toast') !== null, '결정 후 변화 알림 표시');
  // 의회
  await page.click('[data-action="nav"][data-view="assembly"]'); await page.screenshot({ path: `${out}/${tag}_06_assembly.png`, fullPage: true }); await audit(page, '의회');
  const billBtn = await page.$('button[data-action="askPolicy"]:not([disabled])');
  if (billBtn) { await billBtn.click(); await page.click('[data-action="confirm"]'); s = await S(page); check(s.bills.filter(b => !['passed', 'failed'].includes(b.status)).length >= 2, '법안 발의: 심의 중 2건 이상'); }
  // 사업
  await page.click('[data-action="nav"][data-view="build"]'); await page.click('[data-action="region"][data-id="jeju"]');
  await page.screenshot({ path: `${out}/${tag}_07_build.png`, fullPage: true }); await audit(page, '사업·권역');
  const projBtn = await page.$('button[data-action="askProject"]:not([disabled])');
  if (projBtn) { await projBtn.click(); await page.click('[data-action="confirm"]'); s = await S(page); check(s.projects.some(p => p.regionId === 'jeju' && p.status === 'building'), '제주 사업 착수'); }
  else check(false, '착수 가능한 사업 버튼');
  s = await S(page); check(s.ap === 0, `AP 소진: ${s.ap}`);
  check(await page.isDisabled('button[data-action="askProject"] >> nth=0'), 'AP 0이면 착수 버튼 비활성');
  // 다음 달로
  await page.click(viewport.width < 760 ? '.bottombar [data-action="endMonth"], .bottombar [data-action="gotoEvent"]' : '.topbar [data-action="endMonth"], .topbar [data-action="gotoEvent"]');
  if (await page.$('[role="dialog"]')) await page.click('[role="dialog"] [data-action="closeModal"]');
  s = await S(page); if (s.queue.length) { await page.click('[data-action="nav"][data-view="overview"]'); await page.click('.choice:not([aria-disabled="true"]) >> nth=0'); }
  // 외교
  await page.click('[data-action="nav"][data-view="diplomacy"]');
  await page.click('button[data-action="askDiplomacy"][data-id="usa"][data-mode="talk"]'); await page.click('[data-action="confirm"]');
  s = await S(page); check(s.monthActions.includes('diplomacy:usa'), '미국 정례 대화');
  check(await page.isDisabled('button[data-action="askDiplomacy"][data-id="usa"][data-mode="humanitarian"]'), '같은 달 같은 상대 두 번째 외교는 비활성');
  await page.screenshot({ path: `${out}/${tag}_08_diplomacy.png`, fullPage: true }); await audit(page, '외교');
  // 내각
  await page.click('[data-action="nav"][data-view="cabinet"]'); await page.screenshot({ path: `${out}/${tag}_09_cabinet.png`, fullPage: true }); await audit(page, '내각');
  const adv = await page.$('button[data-action="askAdviser"]:not([disabled]):not(.danger)');
  if (adv) { await adv.click(); await page.click('[data-action="confirm"]'); s = await S(page); check(s.advisers.length === 2, `자문 임명: ${s.advisers.join(',')}`); }
  // 재정: 예산 프리셋 적용, 잘못된 합계 거부, 상환
  await page.click('[data-action="nav"][data-view="budget"]');
  await page.fill('#b-industry', '90'); await page.dispatchEvent('#b-industry', 'change');
  check(await page.isDisabled('[data-action="applyBudget"]'), '예산 합계가 100이 아니면 적용 버튼 비활성');
  await page.click('[data-action="preset"][data-id="3"]'); await page.click('[data-action="applyBudget"]');
  s = await S(page); check(s.budget.education === 30 && s.budget.industry === 16, '예산 프리셋(인재 우선) 적용');
  await page.screenshot({ path: `${out}/${tag}_10_budget.png`, fullPage: true }); await audit(page, '재정');
  const repay = await page.$('button[data-action="askRepay"][data-id="10"]:not([disabled])');
  if (repay) { const debt = s.stats.debt; await repay.click(); await page.click('[data-action="confirm"]'); s = await S(page); check(Math.abs(s.stats.debt - (debt - 10)) < 1e-9, '부채 10 상환'); }
  // 기록실: 내보내기 → 다시 불러오기, 손상 파일 거부
  await page.click('[data-action="nav"][data-view="archive"]'); s = await S(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('main [data-action="export"]')]);
  const savePath = path.join(out, `${tag}_export.json`); await download.saveAs(savePath);
  const exported = JSON.parse(fs.readFileSync(savePath, 'utf8')); check(exported.version === 2 && exported.state.turn === s.turn, '저장 파일 내보내기 (버전 2)');
  await page.setInputFiles('[data-input="import"]', savePath); await page.click('[data-action="acceptImport"]');
  const s2 = await S(page); check(JSON.stringify(s2) === JSON.stringify(s), '내보낸 파일을 다시 불러오면 상태가 같음');
  await page.click('[data-action="nav"][data-view="archive"]');
  const bad = path.join(out, `${tag}_bad.json`); exported.state.stats.gdp = 'NaN'; exported.state.queue = ['<img src=x onerror=alert(1)>']; fs.writeFileSync(bad, JSON.stringify(exported));
  await page.setInputFiles('[data-input="import"]', bad); await page.waitForSelector('.toast.bad');
  const s3 = await S(page); check(JSON.stringify(s3) === JSON.stringify(s), '손상된 저장은 거부하고 현재 상태 유지');
  await page.click('[data-action="logFilter"][data-id="law"]');
  await page.screenshot({ path: `${out}/${tag}_11_archive.png`, fullPage: true }); await audit(page, '기록실');
  s = await S(page); check(s.visited.includes('archive'), '기록실 방문 기록');
  // 지표 설명 창
  await page.click('[data-action="nav"][data-view="overview"]'); await page.click('.kpi[data-id="gdp"]');
  check((await page.textContent('[role="dialog"]')).includes('성장률'), '지표 설명 창'); await page.keyboard.press('Escape');
  await page.screenshot({ path: `${out}/${tag}_12_overview_governing.png`, fullPage: true }); await audit(page, '상황판(국정)');

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
  if (await page.$('[role="dialog"]')) { await page.screenshot({ path: `${out}/${tag}_13a_final_report.png` }); await page.keyboard.press('Escape'); }
  await page.click('[data-action="nav"][data-view="overview"]'); await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}/${tag}_13_ending.png`, fullPage: true }); await audit(page, '엔딩');
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
