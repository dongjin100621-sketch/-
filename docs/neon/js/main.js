'use strict';
/* 시작: 글꼴·그림을 불러오고 무대를 화면에 맞춘다 */
(function () {
  const stage = document.getElementById('stage');
  const fit = () => {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    document.getElementById('rotHint').style.display = window.innerHeight > window.innerWidth * 1.1 ? 'block' : 'none';
  };
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  fit();
  const font = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('16px Galmuri11'), document.fonts.load('bold 16px Galmuri11')]).catch(() => {}) : Promise.resolve();
  Promise.all([font, SPR.load()]).then(() => {
    document.getElementById('loading').remove();
    HUD.init(document.getElementById('cv'));
    UI.init();
    INPUT.init(stage);
    UI.title();
    requestAnimationFrame((t) => G.loop(t));
  }).catch((e) => { document.getElementById('loading').textContent = '불러오지 못했습니다: ' + e; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.started) G.save(true); });
})();
