/*
 * مسرح «خمّن الهدف»: يرسم الهدف كنقاط متحركة على ملعب (SVG)،
 * أو يعرض مقطع المستخدم من جواله مظلل (بلور) ويخف التظليل مع كل تلميح.
 */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const YT_HOST = "https://www.youtube-nocookie.com";
  // تطبيق الآيفون يشتغل من capacitor:// ويوتيوب يرفضه، فنمر عبر صفحة وسيطة على GitHub Pages (yt.html)
  const RELAY_HOST = "https://37azezazez-web.github.io";
  const RELAY = RELAY_HOST + "/masira-game/yt.html";
  const DIRECT = /^https?:$/.test(location.protocol);
  const FRAME_HOST = DIRECT ? YT_HOST : RELAY_HOST;
  // صوت التعليق يشتغل أول كم ثانية بس، وبعدها ينكتم لين الكشف عشان المعلق ما يقول الاسم
  const SOUND_SECS = 10;
  const MAX_SKIP = 25; // المقدّم ما يقدر يقدّم المقطع أكثر من كذا
  const YT_TIMEOUT = 8000; // لو المشغل ما رد خلال هالوقت نطلع تنبيه
  const PAUSE = 1.6; // ثواني قبل ما يعيد اللقطة

  /** موقع عنصر في لحظة معينة بين نقطتين */
  function at(path, t) {
    if (t <= path[0][0]) return path[0];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if (t <= b[0]) {
        const k = (t - a[0]) / (b[0] - a[0]);
        const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65; // نعومة بسيطة
        return a.map((v, j) => (j === 0 ? t : v + (b[j] - v) * e));
      }
    }
    return path[path.length - 1];
  }

  function drawPitch(svg) {
    const line = { fill: "none", stroke: "rgba(255,255,255,.55)", "stroke-width": 0.5 };
    svg.append(
      svgEl("rect", { x: -60, y: -60, width: 240, height: 190, fill: "#1F9D55" }),
    );
    // خطوط قص العشب
    for (let x = 3; x < 105; x += 12) svg.append(svgEl("rect", { x, y: 0, width: 6, height: 68, fill: "rgba(255,255,255,.06)" }));
    svg.append(
      svgEl("rect", { x: 0, y: 0, width: 105, height: 68, ...line }),
      svgEl("line", { x1: 52.5, y1: 0, x2: 52.5, y2: 68, ...line }),
      svgEl("circle", { cx: 52.5, cy: 34, r: 9.15, ...line }),
      svgEl("rect", { x: 88.5, y: 13.84, width: 16.5, height: 40.32, ...line }),
      svgEl("rect", { x: 99.5, y: 24.84, width: 5.5, height: 18.32, ...line }),
      svgEl("circle", { cx: 94, cy: 34, r: 0.45, fill: "rgba(255,255,255,.7)" }),
      svgEl("path", { d: "M88.5 26.7 A9.15 9.15 0 0 0 88.5 41.3", ...line }),
      svgEl("rect", { x: 105, y: 30.34, width: 2.2, height: 7.32, fill: "rgba(255,255,255,.25)", stroke: "#fff", "stroke-width": 0.5 }),
    );
  }

  const LOG = [];
  root.PitchLog = LOG;
  function create(box) {
    let raf = 0, media = null, item = null, level = 0, pending = false;
    let ytFrame = null, ytList = [], ytIdx = 0, ytTimer = 0, ytOk = false, ytState = -1;
    let onFallback = null, revealed = false, silenced = false, muteTimer = 0;
    // كشف الإعلان: وقت المقطع الأصلي ما يتحرك والمشغل شغال = إعلان يوتيوب، فنغطيه ونكتمه لين يخلص
    // القاعدة: المقطع مغطى ومكتوم (adMode) لين نشوف وقت الهدف نفسه يتقدم فعلاً. أي توقف = نغطيه من جديد
    let lastT = -1, lastMove = 0, adMode = true, adTimer = 0, adSince = 0;
    const wantSound = () => !adMode && (revealed || !silenced);
    function applySound() {
      if (wantSound()) { ytCmd("unMute"); ytCmd("setVolume", [100]); } else ytCmd("mute");
    }
    function setAd(on) {
      if (adMode === on) return;
      adMode = on;
      box.classList.toggle("is-ad", on);
      if (on) adSince = Date.now();
      applySound();
    }

    /** نكتم الصوت بعد الثواني الأولى (أو حسب soundUntil لكل هدف) */
    function silence() {
      if (revealed || silenced) return;
      silenced = true;
      box.classList.add("is-silent");
      if (ytFrame) ytCmd("mute");
      else if (media && media.tagName === "VIDEO") media.muted = true;
    }
    const startAt = () => (item && item.start) || 0;
    // أهداف الروابط: تلميحات تزيد التعليق (item.extra = ثواني كل تلميح، والافتراضي ٥ لكل تلميح)
    const extraAt = (lv) => {
      if (!item || item.kind !== "ytlink" || lv <= 0) return 0;
      if (Array.isArray(item.extra)) return item.extra.slice(0, lv).reduce((a, b) => a + b, 0);
      return lv * 5;
    };
    const soundLimit = () => (item && item.soundUntil != null ? item.soundUntil : SOUND_SECS) + extraAt(level);

    function onMessage(e) {
      if (!ytFrame || e.source !== ytFrame.contentWindow) return;
      let d;
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!d || !d.event) return;
      // سجل تشخيص (آخر ٤٠٠ رسالة من المشغل) عشان نعرف شكل الإعلان
      {
        const inf = d.info && typeof d.info === "object" ? d.info : {};
        const keys = Object.keys(inf).sort().join(",");
        const vd = inf.videoData || {};
        const row = [Date.now() % 1e7, ytList[ytIdx], adMode ? 1 : 0, revealed ? 1 : 0, d.event, inf.playerState, inf.currentTime, inf.duration, vd.video_id, vd.title && vd.title.slice(0, 30), inf.muted];
        for (const k of Object.keys(inf)) if (/ad/i.test(k)) row.push(k + "=" + JSON.stringify(inf[k]).slice(0, 80));
        if (!LOG.keysSeen) LOG.keysSeen = {};
        if (!LOG.keysSeen[keys]) { LOG.keysSeen[keys] = 1; row.push("FULL=" + JSON.stringify(d).slice(0, 1500)); }
        LOG.push(row);
        if (LOG.length > 250) LOG.shift();
      }
      if (d.event === "onError") return nextYouTube();
      if (d.event === "onReady" || d.event === "infoDelivery" || d.event === "initialDelivery" || d.event === "onStateChange") {
        if (!ytOk) {
          ytOk = true; clearTimeout(ytTimer);
          const n = box.querySelector(".stage-note"); if (n) n.remove();
          if (wantSound()) { ytCmd("unMute"); ytCmd("setVolume", [100]); }
          // وصلنا المشغل: نعتمد على وقت المقطع نفسه بدل الساعة (الإعلان ما ياكل من ثواني التعليق)
          clearTimeout(muteTimer);
          lastMove = Date.now();
          clearInterval(adTimer);
          let warned = false;
          adTimer = setInterval(() => {
            if (!ytFrame) return clearInterval(adTimer);
            const fresh = lastT >= 0 && Date.now() - lastMove < 1500;
            if (!fresh && !adMode) setAd(true);
            // طوّل وهو مغطى: نطلع تنبيه للمقدّم
            if (adMode && !warned && Date.now() - adSince > 40000) {
              warned = true;
              const n = document.createElement("div");
              n.className = "stage-note";
              n.textContent = "المقطع ما اشتغل؟ اضغط «ورني الجواب» وبعدها «تخطي»";
              box.append(n);
            }
          }, 300);
          ytCmd("playVideo");
          // لو علّق وما بدأ، ندفه مرة ثانية
          setTimeout(() => { if (ytState !== 1 && ytFrame) ytCmd("playVideo"); }, 2500);
        }
        if (d.info && typeof d.info.playerState === "number") ytState = d.info.playerState;
        if (d.event === "onStateChange" && typeof d.info === "number") ytState = d.info;
        // نعيد المقطع إذا خلص
        if (d.info && d.info.playerState === 0) { ytCmd("seekTo", [startAt(), true]); ytCmd("playVideo"); }
        // المتصفح أحياناً يتجاهل أول أمر: كل ما وصل تحديث نتأكد إن الصوت والتشغيل مثل المطلوب
        const info = d.info && typeof d.info === "object" ? d.info : null;
        if (info) {
          if (typeof info.currentTime === "number") {
            if (Math.abs(info.currentTime - lastT) > 0.05) {
              const first = lastT < 0;
              const forward = !first && info.currentTime > lastT && info.currentTime - lastT < 3;
              lastT = info.currentTime;
              // نعتبره يمشي بس إذا تقدم شوي شوي (مو قفزة من seek)
              if (forward) { lastMove = Date.now(); if (adMode) setAd(false); }
            }
          }
          // مقطع غير اللي طلبناه = إعلان
          const vid = info.videoData && info.videoData.video_id;
          if (vid && ytList[ytIdx] && vid !== ytList[ytIdx]) setAd(true);
          const want = wantSound();
          if (want && info.muted === true) { ytCmd("unMute"); ytCmd("setVolume", [100]); }
          if (!want && info.muted === false) ytCmd("mute");
          if (info.playerState === 2 || info.playerState === 5 || info.playerState === -1) ytCmd("playVideo");
        }
        if (d.info && typeof d.info.currentTime === "number" && d.info.currentTime >= startAt() + soundLimit()) silence();
      }
    }
    window.addEventListener("message", onMessage);

    function ytCmd(func, args = []) {
      if (ytFrame && ytFrame.contentWindow) ytFrame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), FRAME_HOST);
    }

    function clear() {
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(ytTimer); clearTimeout(muteTimer); clearInterval(adTimer);
      adMode = true; lastT = -1; adSince = Date.now();
      revealed = false; silenced = false;
      if (media && media.tagName === "VIDEO") { media.pause(); media.removeAttribute("src"); media.load(); }
      media = null; ytFrame = null; ytOk = false; ytState = -1; pending = false;
      box.replaceChildren();
      box.classList.remove("is-clip", "is-drawn", "is-yt", "is-silent", "is-revealed", "is-ad");
    }

    /** غطاء قبل ما يبدأ الدور: المقطع ما يشتغل إلا لما الفريق يضغط «جاهزين» */
    function poster(text) {
      const p = document.createElement("div");
      p.className = "stage-poster";
      p.textContent = text;
      box.append(p);
    }

    /** غطا يخفي الصورة كاملة: الفرق تسمع التعليق بس. الضغط عليه يعيد المقطع من البداية بالصوت */
    function cover() {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "audio-cover";
      c.setAttribute("aria-label", "عيد التعليق من البداية");
      const bars = document.createElement("span");
      bars.className = "bars";
      bars.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 7; i++) bars.append(document.createElement("i"));
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = "اسمعوا التعليق 🎙️";
      const r = document.createElement("span");
      r.className = "r";
      r.textContent = "↻ ما تسمعون؟ اضغطوا هنا";
      c.append(bars, t, r);
      c.addEventListener("click", replay);
      return c;
    }

    /** أزرار المقدّم: يقدّم/يأخّر بداية المقطع لين أول صوت يكون المعلق. تنحفظ لهالهدف على الجهاز */
    function seekControls() {
      const w = document.createElement("div");
      w.className = "seek-ctl";
      const mk = (txt, d, label) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", label);
        b.addEventListener("click", (e) => { e.stopPropagation(); shiftStart(d); });
        return b;
      };
      w.append(mk("⏪ ٥", -5, "رجّع البداية ٥ ثواني"), mk("قدّم ٥ ⏩", 5, "قدّم البداية ٥ ثواني"));
      return w;
    }
    function shiftStart(d) {
      if (!item || revealed) return;
      // أقصى تقديم ٢٥ ثانية من أول المقطع
      const next = Math.min(MAX_SKIP, Math.max(0, (item.start || 0) + d));
      if (next === (item.start || 0)) { flash(d > 0 ? "أقصى تقديم ٢٥ ثانية" : "هذي بداية المقطع"); return; }
      item.start = next;
      const vid = item.yt && item.yt[0];
      if (vid) {
        try {
          const k = "intiqalat:goalStarts";
          const st = JSON.parse(localStorage.getItem(k) || "{}") || {};
          st[vid] = item.start;
          localStorage.setItem(k, JSON.stringify(st));
        } catch { /* */ }
      }
      flash(`يبدأ من 0:${String(item.start).padStart(2, "0")} · انحفظ`);
      replay();
    }
    function flash(text) {
      let n = box.querySelector(".seek-note");
      if (!n) { n = document.createElement("div"); n.className = "seek-note"; box.append(n); }
      n.textContent = text;
      clearTimeout(n._t); n._t = setTimeout(() => n.remove(), 2500);
    }

    /** يعيد المقطع من البداية، والصوت يشتغل أول الثواني من جديد */
    function replay() {
      if (revealed) return;
      silenced = false;
      if (ytFrame) { ytCmd("seekTo", [startAt(), true]); if (!adMode) { ytCmd("unMute"); ytCmd("setVolume", [100]); } ytCmd("playVideo"); }
      else if (media && media.tagName === "VIDEO") { media.currentTime = 0; media.muted = false; media.play().catch(() => {}); }
      box.classList.remove("is-silent");
      clearTimeout(muteTimer);
      if (!ytFrame || !ytOk) muteTimer = setTimeout(silence, (soundLimit() + 3) * 1000);
    }

    function startYouTube() {
      const id = ytList[ytIdx];
      box.replaceChildren();
      box.classList.add("is-clip", "is-yt");
      adMode = true; adSince = Date.now(); lastT = -1; box.classList.add("is-ad");
      const wrap = document.createElement("div");
      wrap.className = "yt-wrap";
      const f = document.createElement("iframe");
      const q = new URLSearchParams({
        // نبدأ مكتوم عشان المتصفح يسمح بالتشغيل التلقائي، وبعدها نطلع الصوت أول ما المشغل يجهز
        autoplay: "1", mute: "1", controls: "0", playsinline: "1", rel: "0", modestbranding: "1", iv_load_policy: "3",
        disablekb: "1", fs: "0", loop: "1", playlist: id, enablejsapi: "1", start: String(startAt()),
        origin: location.origin && location.origin !== "null" ? location.origin : "",
      });
      f.src = DIRECT ? `${YT_HOST}/embed/${encodeURIComponent(id)}?${q}` : `${RELAY}?v=${encodeURIComponent(id)}&start=${startAt()}`;
      f.title = "مقطع الهدف";
      f.allow = "autoplay; encrypted-media";
      f.referrerPolicy = "strict-origin-when-cross-origin";
      // نفس طريقة مكتبة يوتيوب الرسمية: نرسل «listening» لين يرد المشغل
      f.addEventListener("load", () => {
        const ping = setInterval(() => {
          if (ytOk || ytFrame !== f) return clearInterval(ping);
          try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), FRAME_HOST); } catch { /* */ }
        }, 250);
      });
      wrap.append(f);
      box.append(wrap, cover(), seekControls());
      ytFrame = f; media = wrap; ytOk = false;
      // احتياط لو ما وصلنا وقت المقطع: نكتم بعد المهلة + وقت التحميل
      clearTimeout(muteTimer);
      muteTimer = setTimeout(silence, (soundLimit() + 3) * 1000);
      setBlur(level);
      clearTimeout(ytTimer);
      // لو المشغل ما رد، نترك المقطع مكانه (يمكن شغال) ونطلع تنبيه صغير بس
      ytTimer = setTimeout(() => {
        if (ytOk || ytFrame !== f) return;
        const n = document.createElement("div");
        n.className = "stage-note";
        n.textContent = "ما اشتغل؟ تأكد من النت";
        box.append(n);
      }, YT_TIMEOUT);
    }

    function nextYouTube() {
      clearTimeout(ytTimer);
      ytIdx++;
      if (ytIdx < ytList.length) return startYouTube();
      // ولا رابط اشتغل: رسالة للمقدّم يتخطى
      clear();
      poster("المقطع ما اشتغل 😕 تأكد من النت، أو اضغط «ورني الجواب» وبعدها «تخطي».");
      if (onFallback) onFallback();
    }

    function playGoal(g) {
      clear();
      box.classList.add("is-drawn");
      // نقرّب الكاميرا على منطقة اللقطة
      const all = [...g.actors.flatMap(([, p]) => p), ...g.ball];
      const xs = all.map((p) => p[1]), ys = all.map((p) => p[2]);
      const x0 = Math.min(...xs) - 5, x1 = 108.5;
      const y0 = Math.min(Math.min(...ys), 26) - 5, y1 = Math.max(Math.max(...ys), 42) + 5;
      // حجم النقاط يتناسب مع قرب الكاميرا عشان ما تكبر زيادة
      const k = Math.min(1.3, Math.max(0.7, (x1 - x0) / 60));
      const svg = svgEl("svg", {
        viewBox: `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`,
        preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": "رسم متحرك للهدف",
      });
      drawPitch(svg);
      const trail = svgEl("polyline", { fill: "none", stroke: "rgba(255,255,255,.8)", "stroke-width": 0.45, "stroke-dasharray": "1 1", "stroke-linecap": "round" });
      svg.append(trail);
      const dots = g.actors.map(([side]) => {
        const c = svgEl("circle", {
          r: (1.55 * k).toFixed(2),
          class: "pl pl-" + side,
        });
        svg.append(c);
        return c;
      });
      const shadow = svgEl("ellipse", { rx: 0.9 * k, ry: 0.45 * k, fill: "rgba(0,0,0,.35)" });
      const ball = svgEl("circle", { r: 0.85, fill: "#fff", stroke: "#15171A", "stroke-width": 0.35 });
      svg.append(shadow, ball);
      box.append(svg);

      const end = Math.max(...g.actors.map(([, p]) => p[p.length - 1][0]), g.ball[g.ball.length - 1][0]);
      const total = end + PAUSE;
      let t0 = performance.now();
      const pts = [];
      const frame = (now) => {
        let t = (now - t0) / 1000;
        if (t > total) { t0 = now; t = 0; pts.length = 0; }
        const tt = Math.min(t, end);
        g.actors.forEach(([, path], i) => {
          const [, x, y] = at(path, tt);
          dots[i].setAttribute("cx", x.toFixed(2));
          dots[i].setAttribute("cy", y.toFixed(2));
        });
        const [, bx, by, bh = 0] = at(g.ball, tt);
        shadow.setAttribute("cx", bx.toFixed(2));
        shadow.setAttribute("cy", (by + 0.3).toFixed(2));
        ball.setAttribute("cx", bx.toFixed(2));
        ball.setAttribute("cy", (by - bh * 0.45).toFixed(2));
        ball.setAttribute("r", ((0.85 + bh * 0.04) * k).toFixed(2));
        pts.push(`${bx.toFixed(1)},${(by - bh * 0.45).toFixed(1)}`);
        if (pts.length > 400) pts.shift();
        trail.setAttribute("points", pts.join(" "));
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    function startClip(c) {
      box.replaceChildren();
      box.classList.add("is-clip");
      const v = document.createElement("video");
      v.loop = true; v.autoplay = true; v.muted = false;
      v.playsInline = true; v.setAttribute("playsinline", "");
      v.src = c.src;
      box.append(v, cover());
      media = v;
      setBlur(level);
      // لو المتصفح منع الصوت قبل لمسة، نشغله مكتوم والضغط على المقطع يطلع الصوت
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      v.addEventListener("timeupdate", () => { if (v.currentTime >= soundLimit()) silence(); });
    }

    function setBlur(lv) {
      const more = lv > level && lv >= 0 && extraAt(lv) > extraAt(level);
      level = lv;
      if (more && silenced && !revealed) replay();
      if (!media) return;
      // مستوى فلتر الرسم: ٠ خطوط بس، وكل تلميح يبين من الصورة أكثر
      media.dataset.sketch = lv < 0 ? "" : String(Math.min(lv, 4));
      media.classList.toggle("clear", lv < 0);
    }

    return {
      /** يجهز اللقطة. المقاطع تنتظر start() عشان تشتغل بالصوت بعد ضغطة الفريق */
      show(it, hintLevel = 0) {
        clear();
        item = it; level = hintLevel;
        if (it.kind === "clip" || (it.yt && it.yt.length)) {
          ytList = it.yt || []; ytIdx = 0; pending = true;
          poster("🎙️ التعليق يشتغل لما تضغطون «جاهزين»");
        } else {
          playGoal(it);
        }
      },
      start() {
        if (!pending) return;
        pending = false;
        item.kind === "clip" ? startClip(item) : startYouTube();
      },
      get isVideo() { return !!item && (item.kind === "clip" || !!(item.yt && item.yt.length)); },
      set onFallback(fn) { onFallback = fn; },
      setBlur,
      /** الكشف: المقطع يوضح ويرجع من البداية بالصوت كامل */
      unveil() {
        revealed = true; clearTimeout(muteTimer);
        setBlur(-1);
        box.classList.remove("is-silent");
        box.classList.add("is-revealed");
        // نكمل من قبل ما انكتم الصوت بثانيتين: المعلق يكمل كلامه ويقول الاسم
        const resume = Math.max(startAt(), startAt() + soundLimit() - 2);
        if (ytFrame) { if (!adMode) ytCmd("unMute"); ytCmd("seekTo", [resume, true]); ytCmd("playVideo"); }
        else if (media && media.tagName === "VIDEO") { media.muted = false; media.currentTime = Math.max(0, soundLimit() - 2); media.play().catch(() => {}); }
      },
      stop() { clear(); item = null; },
    };
  }

  root.Pitch = { create, at };
})(window);
