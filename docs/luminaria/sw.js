'use strict';
/* 한 번 열어 두면 오프라인에서도 플레이할 수 있게 파일을 보관한다.
   목록과 VERSION 은 tools/build_pwa.py 가 갱신한다. */
const VERSION = 'luminaria-f4bbf023';
const SHELL = ["./", "index.html", "manifest.webmanifest", "css/style.css", "js/audio.js", "js/data.js", "js/episodes.js", "js/fx.js", "js/game.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "img/aria_chibi.png", "img/aria_e0.jpg", "img/aria_e1.jpg", "img/aria_e2.jpg", "img/aria_e3.jpg", "img/aria_e4.jpg", "img/aria_e5.jpg", "img/aria_key.jpg", "img/beatrix_chibi.png", "img/beatrix_e0.jpg", "img/beatrix_e1.jpg", "img/beatrix_e2.jpg", "img/beatrix_e3.jpg", "img/beatrix_e4.jpg", "img/beatrix_e5.jpg", "img/beatrix_key.jpg", "img/bg_chapel.jpg", "img/bg_church.jpg", "img/bg_class.jpg", "img/bg_dorm.jpg", "img/bg_festival.jpg", "img/bg_lab.jpg", "img/bg_library.jpg", "img/bg_market.jpg", "img/bg_outskirts.jpg", "img/bg_sea.jpg", "img/bg_tower.jpg", "img/bg_training.jpg", "img/camilla_chibi.png", "img/camilla_e0.jpg", "img/camilla_e1.jpg", "img/camilla_e2.jpg", "img/camilla_e3.jpg", "img/camilla_e4.jpg", "img/camilla_e5.jpg", "img/camilla_key.jpg", "img/lizette_chibi.png", "img/lizette_e0.jpg", "img/lizette_e1.jpg", "img/lizette_e2.jpg", "img/lizette_e3.jpg", "img/lizette_e4.jpg", "img/lizette_e5.jpg", "img/lizette_key.jpg", "img/luna_chibi.png", "img/luna_e0.jpg", "img/luna_e1.jpg", "img/luna_e2.jpg", "img/luna_e3.jpg", "img/luna_e4.jpg", "img/luna_e5.jpg", "img/luna_key.jpg", "img/noelle_chibi.png", "img/noelle_e0.jpg", "img/noelle_e1.jpg", "img/noelle_e2.jpg", "img/noelle_e3.jpg", "img/noelle_e4.jpg", "img/noelle_e5.jpg", "img/noelle_key.jpg", "img/rose_chibi.png", "img/rose_e0.jpg", "img/rose_e1.jpg", "img/rose_e2.jpg", "img/rose_e3.jpg", "img/rose_e4.jpg", "img/rose_e5.jpg", "img/rose_key.jpg", "img/serena_chibi.png", "img/serena_e0.jpg", "img/serena_e1.jpg", "img/serena_e2.jpg", "img/serena_e3.jpg", "img/serena_e4.jpg", "img/serena_e5.jpg", "img/serena_key.jpg"];
const FONTS = /^fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((f) => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && !FONTS.test(url.hostname)) return;
  const isImg = same && /\/img\//.test(url.pathname);
  const put = (r) => { if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; };
  if (isImg || !same) {
    // 그림·글꼴: 보관본 우선
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then(put).catch(() => m)));
  } else {
    // 코드: 네트워크 우선, 오프라인이면 보관본
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('index.html'))));
  }
});
