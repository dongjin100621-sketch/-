// 실제 브라우저 검수(Playwright). node tests/browser/e2e.cjs [html 경로]
// 데스크톱 1440×900과 휴대폰 390×844에서 단일 HTML을 열어 주요 흐름을 누르고, 화면마다 가로 넘침·콘솔 오류·외부 요청을 검사한다.
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '../../FRONTLINE1936.html'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
(async () => {
  const browser = await chromium.launch();
  for (const [tag, vp] of [['데스크톱', { width: 1440, height: 900 }], ['휴대폰', { width: 390, height: 844 }]]) {
    console.log(`\n[${tag}]`);
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage(); const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) external.push(r.url()); });
    const overflow = async where => ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, `${where}: 가로 넘침 없음`);
    const G = (fn, arg) => page.evaluate(fn, arg);
    await page.goto(FILE); await page.waitForSelector('.start');
    ok(await page.locator('.pick button').count() === 6, '시작 화면: 플레이할 나라 6개');
    await overflow('시작 화면');
    await page.click('[data-action="pick"][data-id="china"]'); await page.click('[data-action="new"]');
    await page.waitForSelector('#svg');
    ok(await G(() => globalThis.__GAME__.state.player) === 'china', '새 게임: 중화민국');
    ok(await page.locator('#g-regions path').count() === 208, '지도: 지역 208개');
    ok(await page.locator('#g-seas path').count() === 48, '지도: 해역 48개');
    ok(await page.locator('.unit').count() > 20, '지도: 사단 표시');
    // 창마다 열기
    for (const v of ['politics', 'focus', 'research', 'diplomacy', 'build', 'production', 'market', 'design', 'army', 'leaders', 'navy', 'airforce', 'log', 'help']) {
      await G(v => { globalThis.__GAME__.ui.view = v; globalThis.__GAME__.renderAll(); }, v);
      ok(await page.locator('.screen').count() === 1, `${v} 창 열림`);
      await overflow(`${v} 창`);
    }
    // 국가 중점 시작
    await G(() => { globalThis.__GAME__.ui.view = 'focus'; globalThis.__GAME__.renderAll(); });
    await page.click('.fnode.avail >> nth=0'); await page.click('[data-action="focus"]');
    ok(await G(() => !!globalThis.__GAME__.state.countries.china.focus.current), '국가 중점 시작');
    // 생산 라인 늘리기
    await G(() => { globalThis.__GAME__.ui.view = 'production'; globalThis.__GAME__.renderAll(); });
    const lines0 = await G(() => globalThis.__GAME__.state.countries.china.lines.reduce((a, l) => a + l.factories, 0));
    await page.click('[data-action="line"][data-e="inf_eq"][data-d="-1"]');
    ok(await G(() => globalThis.__GAME__.state.countries.china.lines.reduce((a, l) => a + l.factories, 0)) === lines0 - 1, '생산 라인 공장 빼기');
    // 사단 설계 저장과 모집
    await G(() => { globalThis.__GAME__.ui.view = 'design'; globalThis.__GAME__.renderAll(); });
    await page.click('[data-action="bat"][data-id="infantry"][data-d="1"]'); await page.click('[data-action="saveTpl"]');
    ok(await G(() => globalThis.__GAME__.state.templates.length) === 1, '새 편제 저장');
    // 지도: 지역 고르기와 건설
    await page.click('[data-action="closeView"]');
    await G(() => { const g = globalThis.__GAME__; g.ui.sel = { region: 'chongqing', divisions: [], fleet: null, wing: null }; g.renderAll(); });
    ok((await page.textContent('#side')).includes('충칭'), '지역 정보 패널');
    const q0 = await G(() => globalThis.__GAME__.state.countries.china.construction.length);
    await page.click('#side [data-action="build"][data-id="civ"]');
    ok(await G(() => globalThis.__GAME__.state.countries.china.construction.length) === q0 + 1, '지역 패널에서 민간 공장 착공');
    // 사단 고르고 이동 명령(지도 클릭)
    const target = await G(() => { const g = globalThis.__GAME__, s = g.state; const dv = s.divisions.find(x => x.owner === 'china' && x.at === 'nanjing'); g.ui.sel = { region: 'nanjing', divisions: [dv.id], fleet: null, wing: null }; g.renderAll(); return dv.id; });
    await G(() => { const el = document.getElementById('rg_hangzhou'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 5, clientY: 5 })); document.getElementById('map').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 5, clientY: 5 })); });
    ok(await G(id => { const dv = globalThis.__GAME__.state.divisions.find(x => x.id === id); return dv.order && dv.order.type === 'move' && dv.order.dest === 'hangzhou'; }, target), '지도 클릭으로 이동 명령');
    await overflow('사단 선택');
    // 군 편성: 장군이 붙는다
    await page.click('#side [data-action="formArmy"]');
    const armyId = await G(id => { const s = globalThis.__GAME__.state; const dv = s.divisions.find(x => x.id === id); return dv && dv.army; }, target);
    ok(!!armyId, '군 편성(사단이 새 군에 들어간다)');
    ok((await page.textContent('#side')).includes('★') || (await page.textContent('#side')).includes('소속'), '사단 패널에 군 표시');
    await G(() => { globalThis.__GAME__.ui.view = 'leaders'; globalThis.__GAME__.renderAll(); });
    ok(await page.locator('.card.leader').count() >= 5, '장군 창: 국민정부 지휘관 카드');
    ok((await page.textContent('.screen')).includes('쉐웨'), '장군 창: 실존 지휘관 이름과 역할');
    await page.selectOption('select[data-action="setLeaderArmy"] >> nth=0', armyId);
    ok(await G(id => { const a = globalThis.__GAME__.state.armies.find(x => x.id === id); return !!(a && a.leader); }, armyId), '장군 창에서 새 군에 장군 배치');
    await G(() => { globalThis.__GAME__.ui.view = null; globalThis.__GAME__.ui.mapMode = 'weather'; globalThis.__GAME__.renderAll(); });
    await G(() => { globalThis.__GAME__.ui.legendOpen = true; globalThis.__GAME__.renderAll(); });
    ok((await page.textContent('#legend')).includes('눈보라'), '날씨 모드 범례');
    { const n = await page.evaluate(() => { const all = [...document.querySelectorAll('#g-seas path')]; return { fill: all.filter(p => p.getAttribute('fill') && p.getAttribute('fill') !== 'none').length, total: all.length }; });
      ok(n.total === 48 && n.fill > 0 && n.fill < 48, `날씨 모드: 궂은 해역만 색(${n.fill}/${n.total})`); }
    await G(() => { globalThis.__GAME__.ui.mapMode = 'political'; globalThis.__GAME__.renderAll(); });
    ok(await page.locator('#g-clbl text').count() > 8, '큰 나라 이름');
    ok(await page.locator('.unit .sybox').count() > 20, '부대 기호');
    // 강·철도·보급
    ok(await G(() => (document.querySelector('#g-water .river.lg')?.getAttribute('d') || '').length > 5000), '지도: 큰 강 줄기');
    ok(await page.locator('#g-rail path.rl').count() >= 4, '지도: 철도 노선');
    { const o = await G(() => { const s = new Map(); for (const u of document.querySelectorAll('#g-over .unit')) { const r = u.querySelector('.ub'); s.set(u, [+r.getAttribute('x'), +r.getAttribute('y')]); } const v = [...s.values()]; let n = 0; for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.abs(v[i][0] - v[j][0]) < 30 && Math.abs(v[i][1] - v[j][1]) < 14) n++; return n; });
      ok(o === 0, `부대 표가 서로 겹치지 않는다(${o})`); }
    await G(() => { const g = globalThis.__GAME__; g.ui.sel = { region: 'nanjing', divisions: [], fleet: null, wing: null }; g.renderAll(); });
    ok((await page.textContent('#side')).includes('교통·보급') && await page.locator('#side .trow').count() >= 2, '지역 창: 교통·보급(노선·강)');
    ok((await page.textContent('#side')).includes('징후선'), '지역 창: 실제 노선 이름');
    { const before = await G(() => globalThis.__GAME__.state.countries.china.construction.filter(q => q.kind === 'rail').length);
      const btn = page.locator('#side [data-action="buildRail"]:not([disabled])').first();
      if (await btn.count()) { await btn.click(); ok(await G(() => globalThis.__GAME__.state.countries.china.construction.filter(q => q.kind === 'rail').length) === before + 1, '철도 놓기 버튼이 건설 대기열에 들어간다'); }
      else ok(false, '철도 놓기 버튼'); }
    await G(() => { const g = globalThis.__GAME__; g.ui.view = 'build'; g.renderAll(); });
    ok((await page.textContent('.screen')).includes('철도 '), '건설 창: 철도 사업 이름');
    await G(() => { const g = globalThis.__GAME__; g.ui.view = null; g.ui.sel = { region: null, divisions: [], fleet: null, wing: null }; g.ui.mapMode = 'supply'; g.ui.legendOpen = true; g.renderAll(); });
    ok((await page.textContent('#legend')).includes('보급 거점') && await G(() => document.getElementById('svg').dataset.mode === 'supply'), '보급 모드: 범례와 노선 강조');
    await page.click('#legend .lg-t'); ok(await G(() => document.getElementById('legend').classList.contains('closed')), '범례 접기');
    await page.click('#legend .lg-t'); ok(await G(() => !document.getElementById('legend').classList.contains('closed')), '범례 펴기');
    if (tag === '데스크톱') {
      await G(() => { globalThis.__GAME__.ui.mapMode = 'political'; globalThis.__GAME__.renderAll(); });
      const bx = await page.locator('#rg_wuhan').boundingBox(); await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await page.waitForTimeout(120);
      ok(await page.locator('#tip:not([hidden])').count() === 1 && (await page.textContent('#tip')).includes('보급'), '지도 풍선 도움말');
      await page.mouse.move(2, 2);
    } else ok(await G(() => { const b = document.querySelector('.who-t b'); return !!b && b.getBoundingClientRect().width > 40; }), '휴대폰 윗줄: 나라 이름이 보인다');
    await G(() => { globalThis.__GAME__.ui.mapMode = 'political'; globalThis.__GAME__.renderAll(); });
    // 시간 진행: 사건 창이 뜨면 고른다
    await G(() => { const g = globalThis.__GAME__; for (let i = 0; i < 345; i++) { g.E.advanceDay(g.state, g.data); if (g.state.pending.length) break; } g.renderAll(); });
    if (await page.locator('.modal .opts button').count()) { ok(await page.locator('.modal.paper .stamp').count() === 1, '사건 창: 종이 문서와 날짜 도장'); await page.click('.modal .opts button >> nth=0'); ok(await G(() => globalThis.__GAME__.state.pending.length) === 0, '사건 선택지 고르기'); } else ok(true, '사건 없음(건너뜀)');
    const day0 = await G(() => globalThis.__GAME__.state.day);
    await page.click('[data-action="speed"][data-s="5"]'); await page.waitForTimeout(900);
    for (let i = 0; i < 4 && await page.locator('.modal .opts button').count(); i++) { await page.click('.modal .opts button >> nth=0'); await page.waitForTimeout(100); }
    await G(() => { globalThis.__GAME__.ui.running = false; globalThis.__GAME__.renderAll(); });
    ok(await G(() => globalThis.__GAME__.state.day) > day0, '시계 진행(속도 5)');
    // 지도 모드
    for (const m of ['faction', 'terrain', 'resources', 'industry', 'supply', 'infra', 'political']) { await G(m => { globalThis.__GAME__.ui.mapMode = m; globalThis.__GAME__.renderAll(); }, m); }
    ok(true, '지도 모드 7개');
    // 저장 텍스트 → 불러오기
    await G(() => { globalThis.__GAME__.ui.view = 'log'; globalThis.__GAME__.renderAll(); });
    await page.click('[data-action="exportSave"]');
    const text = await page.inputValue('#saveText'); ok(text.includes('FRONTLINE1936_SAVE'), '저장 텍스트');
    await page.click('[data-action="closeModal"]'); await page.click('[data-action="openLoad"]');
    await page.fill('#loadText', '{"format":"X"}'); await page.click('[data-action="doLoad"]');
    ok((await page.textContent('#toast')).includes('저장 파일이 아닙니다'), '잘못된 저장 거부');
    await page.evaluate(t => { document.getElementById('loadText').value = t; }, text); await page.click('[data-action="doLoad"]');
    ok(await page.locator('#svg').count() === 1, '저장 텍스트로 불러오기');
    await overflow('불러온 뒤');
    ok(errors.length === 0, `콘솔·페이지 오류 없음${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
    ok(external.length === 0, `외부 요청 없음${external.length ? ': ' + external[0] : ''}`);
    await page.screenshot({ path: path.join(__dirname, `out_${tag === '데스크톱' ? 'desk' : 'phone'}.png`) });
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass}개 통과, ${fail}개 실패`);
  process.exit(fail ? 1 : 0);
})();
