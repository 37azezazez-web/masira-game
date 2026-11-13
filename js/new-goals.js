// صفحة اعتماد الأهداف المقترحة: Aziz يشغّل كل مقطع ويضغط ✓ أو ✗، والنتيجة تنحفظ بالجهاز وتنسخ
(function () {
  "use strict";
  var KEY = "intiqalat.newGoals";
  var list = document.getElementById("cands"), frame = document.getElementById("frame"), out = document.getElementById("out");
  var picks = {};
  try { picks = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { picks = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch (_) {} render(); }
  function play(id) {
    frame.hidden = false;
    frame.textContent = "";
    var f = document.createElement("iframe");
    f.allow = "autoplay; encrypted-media; fullscreen";
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
    frame.append(f);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function btn(text, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = text; b.addEventListener("click", fn); return b; }
  function render() {
    list.textContent = "";
    window.GOAL_CANDIDATES.forEach(function (c) {
      var ids = c[0], key = ids[0], p = picks[key];
      var li = document.createElement("li");
      var t = document.createElement("strong");
      t.textContent = c[1] + " على " + c[2];
      var d = document.createElement("div");
      d.textContent = c[6] + (p ? (p.ok ? " · ✓ معتمد (رابط " + (p.alt + 1) + ")" : " · ✗ مرفوض") : "");
      if (p) li.className = p.ok ? "set" : "bad";
      var row = document.createElement("div"); row.className = "trow";
      ids.forEach(function (id, i) { row.append(btn("▶ رابط " + (i + 1), function () { play(id); })); });
      ids.forEach(function (id, i) { row.append(btn("✓ " + (ids.length > 1 ? "رابط " + (i + 1) : "صالح"), function () { picks[key] = { ok: true, alt: i }; save(); })); });
      row.append(btn("✗ ما يصلح", function () { picks[key] = { ok: false }; save(); }));
      li.append(t, d, row);
      list.append(li);
    });
    var lines = window.GOAL_CANDIDATES.map(function (c) {
      var p = picks[c[0][0]];
      return p ? (p.ok ? "✓ " + c[0][p.alt] : "✗ " + c[0][0]) + " " + c[1] + " على " + c[2] : null;
    }).filter(Boolean);
    out.value = "أهداف جديدة:\n" + lines.join("\n");
  }
  document.getElementById("copy").addEventListener("click", function () {
    out.select();
    var done = function () { document.getElementById("copied").textContent = "انسخت ✓ الصقها لي في المحادثة"; };
    if (navigator.clipboard) navigator.clipboard.writeText(out.value).then(done, function () { document.execCommand("copy"); done(); });
    else { document.execCommand("copy"); done(); }
  });
  render();
})();
