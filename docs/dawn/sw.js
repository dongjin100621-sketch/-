'use strict';
/* 한 번 열어 두면 오프라인에서도 플레이할 수 있게 파일을 보관한다.
   목록과 VERSION 은 tools/build_pwa.py 가 갱신한다. */
const VERSION = 'dawn-9a1a7167';
const SHELL = ["./", "index.html", "manifest.webmanifest", "css/style.css", "js/battle.js", "js/bview.js", "js/data.js", "js/field.js", "js/gfx.js", "js/main.js", "js/maps.js", "js/party.js", "js/props.js", "js/sound.js", "js/sprites.js", "js/story.js", "js/ui.js", "js/world.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "fonts/galmuri11-bold.woff2", "fonts/galmuri11.woff2"];

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
  if (url.origin !== location.origin) return;
  const put = (r) => { if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; };
  if (/\/(fonts|icons)\//.test(url.pathname)) {
    // 글꼴·아이콘: 보관본 우선
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then(put)));
  } else {
    // 코드: 네트워크 우선, 오프라인이면 보관본
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('index.html'))));
  }
});
