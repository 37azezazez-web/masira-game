// صفحة فحص: تفتح كل مقطع مكتوم بمشغل يوتيوب وتشوف هل يشتغل أو يرفض
(function () {
  "use strict";
  var YT = "https://www.youtube-nocookie.com";
  var items = window.GOAL_LINKS || [];
  var list = document.getElementById("list"), slots = document.getElementById("slots"), sum = document.getElementById("sum");
  var ERR = { 2: "رابط غلط", 5: "ما يشتغل بالمتصفح", 100: "المقطع محذوف أو خاص", 101: "صاحبه منع تشغيله برا يوتيوب", 150: "صاحبه منع تشغيله برا يوتيوب", 153: "يوتيوب رفض التشغيل" };
  var rows = items.map(function (g) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "https://youtu.be/" + g.yt[0]; a.target = "_blank"; a.rel = "noopener";
    a.textContent = g.name + (g.opp ? " على " + g.opp : "");
    var s = document.createElement("span"); s.className = "wait"; s.textContent = " … ينتظر";
    li.append(a, s); list.append(li);
    return s;
  });
  var done = 0, bad = 0, next = 0;
  function finish(i, ok, msg) {
    if (rows[i].dataset.done) return;
    rows[i].dataset.done = "1";
    rows[i].className = ok ? "ok" : "bad";
    rows[i].textContent = ok ? " ✓ يشتغل" : " ✗ " + msg;
    done++; if (!ok) bad++;
    sum.textContent = done < items.length ? "فحصت " + done + " من " + items.length + "…" : (bad ? "خلص الفحص: " + bad + " مقطع ما يشتغل (بالأحمر)." : "خلص الفحص: كل المقاطع تشتغل ✓");
  }
  function run() {
    if (next >= items.length) return;
    var i = next++, id = items[i].yt[0];
    var f = document.createElement("iframe");
    f.allow = "autoplay; encrypted-media";
    f.src = YT + "/embed/" + id + "?autoplay=1&mute=1&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
    slots.append(f);
    var talk = setInterval(function () { if (f.contentWindow) f.contentWindow.postMessage('{"event":"listening","id":' + i + '}', YT); }, 400);
    function onMsg(e) {
      if (e.source !== f.contentWindow) return;
      var d; try { d = JSON.parse(e.data); } catch (_) { return; }
      if (d.event === "onError") end(false, ERR[d.info] || "خطأ " + d.info);
      var st = d.event === "onStateChange" ? d.info : d.info && d.info.playerState;
      if (st === 1 || (d.info && d.info.currentTime > 0.5)) end(true);
    }
    var timer = setTimeout(function () { end(false, "ما اشتغل خلال ٢٠ ثانية (جرّبه بنفسك)"); }, 20000);
    function end(ok, msg) {
      clearInterval(talk); clearTimeout(timer); window.removeEventListener("message", onMsg);
      finish(i, ok, msg); f.remove(); run();
    }
    window.addEventListener("message", onMsg);
  }
  for (var k = 0; k < 4; k++) run();
})();
