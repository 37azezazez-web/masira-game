// صفحة ضبط بداية المقاطع: المقدّم يحدد لحظة الهدف، والبداية = قبلها بـ١٠ ثواني
(function () {
  "use strict";
  var YT = "https://www.youtube-nocookie.com", KEY = "intiqalat:goalStarts", BEFORE = 10;
  var items = window.GOAL_LINKS || [];
  var starts = {};
  try { starts = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { starts = {}; }
  items.forEach(function (g) { if (starts[g.yt[0]] == null && g.start) starts[g.yt[0]] = g.start; });
  var $ = function (id) { return document.getElementById(id); };
  var f = $("f"), cur = null, t = 0, ping = 0;
  var fmt = function (s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(starts)); } catch (e) { /* */ }
    var n = Object.keys(starts).length;
    $("out").value = JSON.stringify(starts);
    $("done").textContent = "ضبطت " + n + " من " + items.length;
    render();
  }
  function cmd(func, args) { if (f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: "command", func: func, args: args || [] }), YT); }
  function open(g) {
    cur = g; t = 0;
    $("player").hidden = false;
    $("cur-name").textContent = g.name + (g.opp ? " على " + g.opp : "");
    $("saved").textContent = starts[g.yt[0]] != null ? "البداية الحالية: " + fmt(starts[g.yt[0]]) : "";
    f.src = YT + "/embed/" + g.yt[0] + "?autoplay=1&controls=1&playsinline=1&rel=0&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
    clearInterval(ping);
    ping = setInterval(function () { if (f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 3, channel: "widget" }), YT); }, 500);
    window.scrollTo(0, 0);
  }
  window.addEventListener("message", function (e) {
    if (e.source !== f.contentWindow) return;
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && d.info && typeof d.info.currentTime === "number") { t = d.info.currentTime; $("cur-time").textContent = fmt(t); }
  });
  $("mark").addEventListener("click", function () {
    if (!cur) return;
    starts[cur.yt[0]] = Math.max(0, Math.floor(t) - BEFORE);
    $("saved").textContent = "✓ الهدف عند " + fmt(t) + "، المقطع يبدأ من " + fmt(starts[cur.yt[0]]);
    save();
  });
  $("try").addEventListener("click", function () { if (cur) { cmd("seekTo", [starts[cur.yt[0]] || 0, true]); cmd("playVideo"); } });
  $("clear").addEventListener("click", function () { if (cur) { delete starts[cur.yt[0]]; $("saved").textContent = "انشال الوقت، يبدأ من أول المقطع"; save(); } });
  $("copy").addEventListener("click", function () {
    $("out").select();
    var done = function () { $("done").textContent = "✓ انسخت، الصقها لي في المحادثة"; };
    if (navigator.clipboard) navigator.clipboard.writeText($("out").value).then(done, function () { document.execCommand("copy"); done(); });
    else { document.execCommand("copy"); done(); }
  });
  function render() {
    var list = $("list"); list.replaceChildren();
    items.forEach(function (g) {
      var li = document.createElement("li");
      var has = starts[g.yt[0]] != null;
      li.className = has ? "set" : "";
      li.append(document.createTextNode(g.name + (g.opp ? " على " + g.opp : "") + (has ? " ✓ " + fmt(starts[g.yt[0]]) : "")));
      var b = document.createElement("button"); b.type = "button"; b.textContent = has ? "عدّل" : "اضبط";
      b.addEventListener("click", function () { open(g); });
      li.append(b); list.append(li);
    });
  }
  save();
})();
