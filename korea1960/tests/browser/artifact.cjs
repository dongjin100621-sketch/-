/* 웹 링크(Claude 아티팩트)용 판 검수. 실행: node tests/browser/artifact.cjs   (Playwright 필요)
 * tools/build_standalone.py --artifact로 만든 판에 게시 때와 같은 문서 골격을 씌워, sandbox iframe(스크립트·폼만 허용:
 * 같은 출처 아님 → localStorage 차단, 다운로드 차단, 클립보드 차단)에서 실행한다. 실제 보기 화면보다 엄격한 조건이다.
 * 확인: 실행·글꼴·진행, 내보내기가 '저장 텍스트' 창으로 열림, 복사 안내, 붙여넣기로 복원, 가로 넘침·콘솔 오류·외부 요청 없음. */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), SP = path.join(__dirname, 'out');
fs.mkdirSync(path.join(SP, 'artifact'), { recursive: true });
// ARTIFACT_PAGE=<게시된 페이지 파일>: 게시 서버에서 받은 실제 페이지(골격 포함)를 그대로 검사한다.
const published = process.env.ARTIFACT_PAGE;
if (!published) execFileSync('python3', [path.join(ROOT, 'tools/build_standalone.py'), '--artifact', '--output', path.join(SP, 'artifact/korea1960.html')], { stdio: 'inherit' });
const src = published ? '' : fs.readFileSync(path.join(SP, 'artifact/korea1960.html'), 'utf8');
const doc = published ? fs.readFileSync(published, 'utf8') : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + src + '</body></html>';
fs.writeFileSync(path.join(SP, 'artifact/host.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts allow-forms" id="f"></iframe><script>document.getElementById('f').srcdoc=${JSON.stringify(doc).replace(/<\/script/g, '<\\/script')};</script>`);
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fails++; };
  for (const [tag, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    console.log('##', tag);
    const page = await b.newPage({ viewport: vp }); const errors = [], external = [];
    const policy = []; page.on('console', m => { if (m.type() !== 'error') return; (/Permissions policy violation/.test(m.text()) ? policy : errors).push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!/^(file|data|about|blob):/.test(r.url())) external.push(r.url()); });
    let downloads = 0; page.on('download', () => downloads++);
    await page.goto('file://' + path.join(SP, 'artifact/host.html'));
    const f = await (await page.waitForSelector('#f')).contentFrame();
    await f.waitForSelector('.title-screen'); ok(true, '타이틀 표시');
    ok(await f.evaluate(() => { try { localStorage.getItem('x'); return 'ok'; } catch { return 'blocked'; } }) === 'blocked', '저장소가 막힌 환경(불투명 출처)에서 실행');
    const info = await f.evaluate(async () => { await document.fonts.ready; return { lang: document.documentElement.lang, font: getComputedStyle(document.querySelector('.title-card h1') || document.body).fontFamily, loaded: [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family + ' ' + x.weight) }; });
    ok(info.lang === 'ko' && info.loaded.some(x => x.includes('Chronicle')), `언어 ko·내장 글꼴 적용 (${info.lang}, ${info.loaded.join(', ')})`);
    await f.click('[data-action="newgame"]'); await f.fill('#seed-input', '20261110'); await f.click('[data-action="startNew"]'); await f.waitForSelector('.shell');
    const S = () => f.evaluate(() => window.__GAME_DEBUG__.getState());
    let s = await S(); ok(s.turn === 0 && s.queue[0] === 'opening', '새 게임 1960-01');
    for (let i = 0; i < 90; i++) {
      s = await S(); if (s.ending) break;
      if (s.queue.length) { await f.click('.choice:not([aria-disabled="true"]) >> nth=0'); continue; }
      if (['prelude', 'civilian', 'elected'].includes(s.phase) && s.ap > 0) { await f.evaluate(() => window.__GAME_DEBUG__.dispatch({ type: 'prepare' })); continue; }
      await f.evaluate(() => window.__GAME_DEBUG__.dispatch({ type: 'endMonth' })); await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    }
    s = await S(); ok(s.turn >= 8 && !s.ending, `여러 달 진행 (${s.turn}개월)`);
    await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await f.click('[data-action="nav"][data-view="archive"]');
    ok((await f.textContent('main')).includes('파일 다운로드를 막습니다'), '기록실에 보기 화면 안내');
    await f.click('main [data-action="export"]'); await f.waitForSelector('#save-text');
    const text = await f.inputValue('#save-text'); ok(JSON.parse(text).state.turn === s.turn && downloads === 0, '내보내기가 저장 텍스트 창으로 열림(다운로드 시도 없음)');
    await f.click('[data-action="copySave"]'); await f.waitForSelector('[role="dialog"] [role="status"]');
    const status = await f.textContent('[role="dialog"] [role="status"]'); ok(/복사했습니다|선택했습니다/.test(status), `복사 버튼 결과 안내: ${status.trim().slice(0, 30)}`);
    await f.press('#save-text', 'Escape');
    await f.click('main [data-action="newgame"]'); await f.click('[data-action="startNew"]'); await f.waitForSelector('.shell');
    ok((await S()).turn === 0, '새 게임으로 바꿈');
    await f.click('[data-action="nav"][data-view="archive"]');
    await f.click('main [data-action="pasteImport"]'); await f.fill('#paste-text', text); await f.click('[data-action="importText"]'); await f.click('[data-action="acceptImport"]');
    ok(JSON.stringify(await S()) === JSON.stringify(JSON.parse(text).state), '붙여 넣은 저장 텍스트로 이전 진행 복원');
    const overflow = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(overflow <= 0, '가로 넘침 없음');
    await page.screenshot({ path: path.join(SP, `artifact/${tag}.png`) });
    ok(errors.length === 0, `콘솔 오류 없음${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`); if (policy.length) console.log('  · 브라우저 권한 정책 알림(게임 오류 아님):', policy[0].slice(0, 90)); ok(external.length === 0, `외부 요청 없음${external.length ? ': ' + external[0] : ''}`);
    await page.close();
  }
  await b.close(); console.log(fails ? `실패 ${fails}건` : '아티팩트 환경 검사 모두 통과'); process.exit(fails ? 1 : 0);
})();
