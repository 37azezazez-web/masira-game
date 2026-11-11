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
  // تظليل المقطع حسب عدد التلميحات (بكسل)
  const BLUR = [20, 14, 9, 5, 5];
  const YT_HOST = "https://www.youtube-nocookie.com";
  const YT_TIMEOUT = 7000; // لو المشغل ما رد خلال هالوقت (غالبًا ما فيه نت) نعرض الرسم
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

  function create(box) {
    let raf = 0, media = null, item = null, level = 0, pending = false;
    let ytFrame = null, ytList = [], ytIdx = 0, ytTimer = 0, ytOk = false;
    let onFallback = null;

    function onMessage(e) {
      if (!ytFrame || e.source !== ytFrame.contentWindow) return;
      let d;
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!d || !d.event) return;
      if (d.event === "onError") return nextYouTube();
      if (d.event === "onReady" || d.event === "infoDelivery" || d.event === "initialDelivery") {
        if (!ytOk) { ytOk = true; clearTimeout(ytTimer); }
        // نعيد المقطع إذا خلص
        if (d.info && d.info.playerState === 0) { ytCmd("seekTo", [0, true]); ytCmd("playVideo"); }
      }
    }
    window.addEventListener("message", onMessage);

    function ytCmd(func, args = []) {
      if (ytFrame && ytFrame.contentWindow) ytFrame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), YT_HOST);
    }

    function clear() {
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(ytTimer);
      if (media && media.tagName === "VIDEO") { media.pause(); media.removeAttribute("src"); media.load(); }
      media = null; ytFrame = null; ytOk = false; pending = false;
      box.replaceChildren();
      box.classList.remove("is-clip", "is-drawn", "is-yt");
    }

    /** غطاء قبل ما يبدأ الدور: المقطع ما يشتغل إلا لما الفريق يضغط «جاهزين» */
    function poster(text) {
      const p = document.createElement("div");
      p.className = "stage-poster";
      p.textContent = text;
      box.append(p);
    }

    /** طبقة فوق المقطع تمنع الضغط على المشغل (عشان ما يبين العنوان)، والضغط عليها يشغل الصوت */
    function shield() {
      const sh = document.createElement("button");
      sh.type = "button";
      sh.className = "stage-shield";
      sh.setAttribute("aria-label", "شغّل المقطع بالصوت");
      sh.addEventListener("click", () => {
        if (ytFrame) { ytCmd("unMute"); ytCmd("playVideo"); }
        else if (media) { media.muted = false; media.play().catch(() => {}); }
      });
      return sh;
    }

    function startYouTube() {
      const id = ytList[ytIdx];
      box.replaceChildren();
      box.classList.add("is-clip", "is-yt");
      const wrap = document.createElement("div");
      wrap.className = "yt-wrap";
      const f = document.createElement("iframe");
      const q = new URLSearchParams({
        autoplay: "1", controls: "0", playsinline: "1", rel: "0", modestbranding: "1", iv_load_policy: "3",
        disablekb: "1", fs: "0", loop: "1", playlist: id, enablejsapi: "1",
        origin: location.origin && location.origin !== "null" ? location.origin : "",
      });
      f.src = `${YT_HOST}/embed/${encodeURIComponent(id)}?${q}`;
      f.title = "مقطع الهدف";
      f.allow = "autoplay; encrypted-media";
      f.referrerPolicy = "strict-origin-when-cross-origin";
      // نفس طريقة مكتبة يوتيوب الرسمية: نرسل «listening» لين يرد المشغل
      f.addEventListener("load", () => {
        const ping = setInterval(() => {
          if (ytOk || ytFrame !== f) return clearInterval(ping);
          try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YT_HOST); } catch { /* */ }
        }, 250);
      });
      wrap.append(f);
      box.append(wrap, shield());
      ytFrame = f; media = wrap; ytOk = false;
      setBlur(level);
      clearTimeout(ytTimer);
      ytTimer = setTimeout(() => { if (!ytOk) { ytIdx = ytList.length; nextYouTube(); } }, YT_TIMEOUT);
    }

    function nextYouTube() {
      clearTimeout(ytTimer);
      ytIdx++;
      if (ytIdx < ytList.length) return startYouTube();
      // ما اشتغل ولا رابط (بدون نت مثلًا): نعرض الرسم المتحرك
      const g = item;
      clear();
      if (g && g.actors) { playGoal(g); if (onFallback) onFallback(); }
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
      box.append(v, shield());
      media = v;
      setBlur(level);
      // لو المتصفح منع الصوت قبل لمسة، نشغله مكتوم والضغط على المقطع يطلع الصوت
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    }

    function setBlur(lv) {
      level = lv;
      if (!media) return;
      media.style.setProperty("--blur", (lv < 0 ? 0 : BLUR[Math.min(lv, BLUR.length - 1)]) + "px");
      media.classList.toggle("clear", lv < 0);
    }

    return {
      /** يجهز اللقطة. المقاطع تنتظر start() عشان تشتغل بالصوت بعد ضغطة الفريق */
      show(it, hintLevel = 0) {
        clear();
        item = it; level = hintLevel;
        if (it.kind === "clip" || (it.yt && it.yt.length)) {
          ytList = it.yt || []; ytIdx = 0; pending = true;
          poster("🎬 المقطع يشتغل لما تضغطون «جاهزين»");
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
      unveil() { setBlur(-1); if (ytFrame) ytCmd("unMute"); },
      stop() { clear(); item = null; },
    };
  }

  root.Pitch = { create, at };
})(window);
