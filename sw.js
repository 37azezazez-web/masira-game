// تخزين ملفات اللعبة عشان تشتغل بدون إنترنت
const CACHE = "intiqalat-v41";
const FILES = ["./", "index.html", "css/style.css", "css/fonts.css", "assets/fonts/Alexandria-800-arabic.woff2", "assets/fonts/Alexandria-800-latin.woff2", "assets/fonts/Alexandria-900-arabic.woff2", "assets/fonts/Alexandria-900-latin.woff2", "assets/fonts/ReadexPro-400-arabic.woff2", "assets/fonts/ReadexPro-400-latin.woff2", "assets/fonts/ReadexPro-600-arabic.woff2", "assets/fonts/ReadexPro-600-latin.woff2", "assets/fonts/ReadexPro-700-arabic.woff2", "assets/fonts/ReadexPro-700-latin.woff2", "js/data.js", "js/lineups.js", "js/goals.js", "js/engine.js", "js/pitch.js", "js/music.js", "js/app.js", "assets/logo.svg", "assets/icon.svg", "assets/wordmark-light.svg", "assets/wordmark-dark.svg", "assets/symbol-light.svg", "assets/icon-180.png", "manifest.webmanifest"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // الصوت والفيديو يطلبون أجزاء (Range): نخليها للمتصفح مباشرة عشان سفاري يشغلها
  if (e.request.headers.has("range") || e.request.destination === "audio" || e.request.destination === "video") return;
  // الشبكة أول عشان التحديثات توصل على طول، والتخزين للعب بدون نت
  e.respondWith(
    // no-cache: نتأكد من السيرفر كل مرة بدل ما نعتمد على كاش المتصفح (قيت هوب يخليه ١٠ دقايق)
    (new URL(e.request.url).origin === location.origin ? fetch(e.request.url, { cache: "no-cache" }) : fetch(e.request))
      .then((r) => {
        if (r.ok && r.status === 200 && new URL(e.request.url).origin === location.origin) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      })
      // بدون نت: من التخزين. ولو ما لقينا شي نرجع للطلب الأصلي بدل صفحة خطأ
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((r) => r || (e.request.mode === "navigate" ? caches.match("index.html") : undefined))
        .then((r) => r || fetch(e.request)))
  );
});
