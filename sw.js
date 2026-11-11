// تخزين ملفات اللعبة عشان تشتغل بدون إنترنت
const CACHE = "masira-v1";
const FILES = ["./", "index.html", "css/style.css", "js/data.js", "js/engine.js", "js/app.js", "assets/logo.svg", "assets/icon.svg", "manifest.webmanifest"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
