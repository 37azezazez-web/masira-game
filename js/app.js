/* واجهة اللعبة. كل النصوص تنحط بـ textContent (ما نستخدم innerHTML مع مدخلات المستخدم). */
(function () {
  "use strict";
  const { Game, pickPlayers, shuffle, MAX_HINTS } = window.Engine;
  const Music = window.Music;
  const GOALS = window.GOALS || [];
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  // ألوان الفرق: [اللون، لون النص فوقه]
  const TEAM_COLORS = [["#E03A2F", "#fff"], ["#2849D6", "#fff"], ["#FFC82E", "#15171A"], ["#1F9D55", "#fff"]];
  const DEFAULT_TEAMS = ["الصقور", "النمور", "الذيب", "الفهود"];

  // ===== تخزين آمن =====
  const store = {
    get(k, d) { try { const v = localStorage.getItem("intiqalat:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("intiqalat:" + k, JSON.stringify(v)); } catch { /* وضع خاص */ } },
  };

  // ===== مؤثرات صوتية واهتزاز =====
  let audioCtx;
  function beep(freq, ms, type = "sine", vol = 0.08) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
      o.stop(audioCtx.currentTime + ms / 1000);
    } catch { /* بدون صوت */ }
  }
  const sfx = {
    tick: () => beep(880, 70, "square", 0.035),
    right: () => { beep(660, 120); setTimeout(() => beep(990, 220), 110); },
    pass: () => beep(240, 200, "triangle", 0.07),
    hint: () => beep(520, 160, "triangle"),
    reveal: () => { beep(392, 90, "triangle"); setTimeout(() => beep(523, 90, "triangle"), 90); setTimeout(() => beep(784, 160, "triangle"), 180); },
  };
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* */ } };

  // ===== الموسيقى =====
  let musicOn = store.get("music", true);
  function syncMusicButtons() {
    document.querySelectorAll(".music-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(musicOn));
      b.setAttribute("aria-label", musicOn ? "إيقاف الموسيقى" : "تشغيل الموسيقى");
    });
  }
  document.querySelectorAll(".music-btn").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    musicOn = !musicOn;
    store.set("music", musicOn);
    syncMusicButtons();
    musicOn && !(typeof stage !== "undefined" && stage.isVideo) ? Music.start() : Music.stop();
  }));
  syncMusicButtons();
  // المتصفح ما يسمح بالصوت إلا بعد أول لمسة
  let unlocked = false;
  document.addEventListener("pointerdown", function first(e) {
    unlocked = true;
    if (musicOn && !e.target.closest(".music-btn") && !(typeof stage !== "undefined" && stage.isVideo)) Music.start();
    document.removeEventListener("pointerdown", first);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Music.stop(); else if (musicOn && unlocked && !(typeof stage !== "undefined" && stage.isVideo)) Music.start();
  });

  const ptsLabel = (n) => n === 1 ? "نقطة وحدة" : n === 2 ? "نقطتين" : `${AR(n)} نقاط`;

  // ===== التنقل =====
  function show(name) {
    if (name !== "game" && typeof stage !== "undefined") stage.stop();
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) show(go.dataset.go);
  });

  $("#home-count").textContent = `${AR(PLAYERS.length)} لاعب و${AR(GOALS.length)} هدف في المكتبة`;

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  // ===== الإعدادات =====
  const settings = Object.assign({ teams: DEFAULT_TEAMS.slice(0, 2), mode: "career", difficulty: "1", seconds: "30", rounds: "10" }, store.get("settings", {}));

  function renderTeams() {
    const list = $("#team-list");
    list.replaceChildren();
    settings.teams.forEach((name, i) => {
      const row = el("div", "team-row");
      const dot = el("span", "team-dot");
      dot.style.setProperty("background", TEAM_COLORS[i][0]);
      const input = el("input");
      input.value = name;
      input.maxLength = 18;
      input.id = `team-${i}`;
      input.setAttribute("aria-label", `اسم الفريق ${i + 1}`);
      input.addEventListener("input", () => { settings.teams[i] = input.value; });
      row.append(dot, input);
      if (settings.teams.length > 1) {
        const rm = el("button", "icon-btn", "−");
        rm.type = "button";
        rm.setAttribute("aria-label", `احذف ${name || "الفريق"}`);
        rm.addEventListener("click", () => { settings.teams.splice(i, 1); renderTeams(); });
        row.append(rm);
      }
      list.append(row);
    });
    $("#add-team").hidden = settings.teams.length >= 4;
  }
  $("#add-team").addEventListener("click", () => {
    if (settings.teams.length < 4) {
      settings.teams.push(DEFAULT_TEAMS.find((n) => !settings.teams.includes(n)) || `فريق ${settings.teams.length + 1}`);
      renderTeams();
    }
  });

  document.querySelectorAll(".chips").forEach((group) => {
    const key = group.dataset.name;
    const buttons = [...group.querySelectorAll("button")];
    const sync = () => buttons.forEach((b) => {
      const on = b.dataset.value === String(settings[key]);
      b.setAttribute("aria-checked", on);
      b.tabIndex = on ? 0 : -1;
    });
    buttons.forEach((b, idx) => {
      b.addEventListener("click", () => { settings[key] = b.dataset.value; sync(); if (key === "mode") syncMode(); });
      b.addEventListener("keydown", (e) => {
        const dir = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const nb = buttons[(idx + dir + buttons.length) % buttons.length];
        nb.click(); nb.focus();
      });
    });
    sync();
  });
  renderTeams();

  // ===== نوع التحدي ومقاطع المستخدم =====
  function syncMode() {
    const goals = settings.mode === "goals";
    $("#fs-diff").hidden = goals;
    $("#fs-clips").hidden = !goals;
    $("#rounds-legend").textContent = goals ? "عدد الأهداف في الجولة" : "عدد اللاعبين في الجولة";
  }
  syncMode();

  // المقاطع تبقى في ذاكرة الصفحة بس (رابط محلي blob)، ما تنحفظ ولا تنرفع
  const clips = [];
  let clipSeq = 0;
  function renderClips() {
    const list = $("#clip-list");
    list.replaceChildren();
    clips.forEach((c, i) => {
      const row = el("div", "clip-row");
      const v = el("video");
      v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = c.src + "#t=0.5";
      const input = el("input");
      input.value = c.name; input.maxLength = 30; input.placeholder = "مين سجّل الهدف؟";
      input.setAttribute("aria-label", `اسم صاحب الهدف في المقطع ${i + 1}`);
      input.addEventListener("input", () => { c.name = input.value; });
      const rm = el("button", "icon-btn", "−");
      rm.type = "button";
      rm.setAttribute("aria-label", "احذف المقطع");
      rm.addEventListener("click", () => { URL.revokeObjectURL(c.src); clips.splice(i, 1); renderClips(); });
      row.append(v, input, rm);
      list.append(row);
    });
  }
  $("#clip-file").addEventListener("change", (e) => {
    for (const f of e.target.files) {
      if (!f.type.startsWith("video/")) continue;
      if (clips.length >= 20) { toast("أقصى شي ٢٠ مقطع"); break; }
      clips.push({ id: `clip-${++clipSeq}`, kind: "clip", name: "", en: "", aliases: [], src: URL.createObjectURL(f) });
    }
    e.target.value = "";
    renderClips();
    const last = $("#clip-list .clip-row:last-child input");
    if (last) last.focus();
  });

  $("#setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const names = settings.teams.map((n) => n.trim().slice(0, 18));
    const err = $("#setup-error");
    if (names.some((n) => !n)) { err.textContent = "اكتب اسم لكل فريق."; err.hidden = false; return; }
    if (new Set(names).size !== names.length) { err.textContent = "أسماء الفرق لازم تكون مختلفة."; err.hidden = false; return; }
    if (settings.mode === "goals" && clips.some((c) => !c.name.trim())) { err.textContent = "اكتب اسم صاحب الهدف لكل مقطع."; err.hidden = false; return; }
    err.hidden = true;
    settings.teams = names;
    store.set("settings", settings);
    startGame();
  });

  // ===== اللعب =====
  let game, timerId, remaining, paused = true;

  function startGame() {
    const count = Number(settings.rounds);
    let items;
    if (settings.mode === "goals") {
      const seen = store.get("seenGoals", []);
      const mine = clips.map((c) => ({ ...c, name: c.name.trim().slice(0, 30) }));
      const built = pickPlayers(GOALS, "mix", Math.max(0, count - mine.length), seen);
      items = shuffle(mine.slice(0, count).concat(built));
      store.set("seenGoals", [...new Set([...built.map((g) => g.id), ...seen])].slice(0, Math.max(0, GOALS.length - 5)));
    } else {
      const seen = store.get("seen", []);
      const diff = settings.difficulty === "mix" ? "mix" : Number(settings.difficulty);
      items = pickPlayers(PLAYERS, diff, count, seen);
      store.set("seen", [...new Set([...items.map((p) => p.id), ...seen])].slice(0, PLAYERS.length - 10));
    }
    game = new Game({ teams: settings.teams, players: items, turnSeconds: Number(settings.seconds) });
    show("game");
    renderRound();
    handoff();
  }

  const teamColor = (i) => TEAM_COLORS[i % TEAM_COLORS.length];
  function paintTeam(node, i) {
    node.style.setProperty("--team-color", teamColor(i)[0]);
    node.style.setProperty("--team-ink", teamColor(i)[1]);
  }

  function renderScores() {
    const box = $("#scores");
    box.replaceChildren();
    game.teams.forEach((t, i) => {
      const s = el("div", "score" + (i === game.current && !game.roundDone ? " active" : ""));
      paintTeam(s, i);
      s.append(el("span", "sw"), el("span", "nm", t.name), el("span", "n", AR(t.score)));
      box.append(s);
    });
  }

  const stage = window.Pitch.create($("#stage"));
  // المقطع ما اشتغل وطلع الرسم بداله: نرجع الموسيقى
  stage.onFallback = () => { if (musicOn && unlocked) Music.start(); };
  const isGoal = (p) => p.kind === "goal" || p.kind === "clip";

  function renderRound() {
    const p = game.player;
    const goal = isGoal(p);
    $("#round-label").textContent = `${goal ? "الهدف" : "اللاعب"} ${AR(game.round + 1)} من ${AR(game.players.length)}`;
    $("#card-title").textContent = goal ? "مين سجّل الهدف؟" : "انتقالات اللاعب";
    $("#career").hidden = goal;
    $("#stage").hidden = !goal;
    if (goal) stage.show(p, 0); else stage.stop();
    if (!stage.isVideo && musicOn && unlocked && !document.hidden) Music.start();
    const list = $("#career");
    list.replaceChildren();
    if (goal) { renderHints(); renderTurn(); return; }
    p.career.forEach(([club, years], i) => {
      const li = el("li");
      li.style.setProperty("animation-delay", `${i * 60}ms`);
      li.append(el("span", "club", club), el("span", "years", years));
      list.append(li);
    });
    renderHints();
    renderTurn();
  }

  function renderHints(newIndex = -1) {
    const box = $("#hints");
    box.replaceChildren();
    const shown = game.revealedHints;
    for (let i = 0; i < MAX_HINTS; i++) {
      if (i < shown.length) {
        const h = el("div", "hint" + (i === newIndex ? " new" : ""));
        h.append(el("span", "l", shown[i].label), el("span", "v", shown[i].value));
        box.append(h);
      } else {
        box.append(el("div", "hint locked", `تلميح ${AR(i + 1)}`));
      }
    }
    $("#points-badge").textContent = ptsLabel(game.points);
  }

  function renderTurn() {
    $("#turn-team").textContent = game.team.name;
    paintTeam(document.documentElement, game.current);
    renderScores();
  }

  // ===== المؤقت =====
  function setTimerUI() {
    const frac = Math.max(0, remaining) / game.turnSeconds;
    $("#timer-text").textContent = AR(Math.max(0, remaining));
    $("#timer-ring").style.setProperty("stroke-dashoffset", String(119.4 * (1 - frac)));
    $("#timer").classList.toggle("low", remaining <= 5);
  }
  function startTimer() {
    remaining = game.turnSeconds;
    // المقاطع تشتغل بصوت التعليق بعد ضغطة «جاهزين»، والموسيقى توقف عشان ما تغطي عليه
    if (stage.isVideo) { Music.stop(); stage.start(); }
    runTimer();
  }
  function runTimer() {
    stopTimer();
    paused = false;
    setTimerUI();
    timerId = setInterval(() => {
      if (paused) return;
      remaining--;
      setTimerUI();
      if (remaining > 0 && remaining <= 5) { sfx.tick(); Music.duck(true); }
      if (remaining <= 0) { stopTimer(); handle(game.timeout()); }
    }, 1000);
  }
  function stopTimer() { clearInterval(timerId); timerId = null; paused = true; Music.duck(false); }
  document.addEventListener("visibilitychange", () => { if (timerId) paused = document.hidden; });

  // ===== نافذة تسليم الدور =====
  function overlay({ emoji, title, text, btn, onBtn, btn2, onBtn2 }) {
    stopTimer();
    $("#ov-emoji").textContent = emoji || "";
    $("#ov-title").textContent = title;
    $("#ov-text").textContent = text || "";
    const b = $("#ov-btn"), b2 = $("#ov-btn2");
    b.textContent = btn;
    b.onclick = () => { $("#overlay").hidden = true; onBtn && onBtn(); };
    b2.hidden = !btn2;
    if (btn2) { b2.textContent = btn2; b2.onclick = () => { $("#overlay").hidden = true; onBtn2 && onBtn2(); }; }
    $("#overlay").hidden = false;
    b.focus();
  }

  function handoff(prefix) {
    const one = game.teams.length === 1;
    overlay({
      emoji: prefix ? prefix.emoji : "⚽",
      title: one ? "جاهز؟" : `الدور على ${game.team.name}`,
      text: (prefix ? prefix.text + "\n" : "") + `عندكم ${AR(game.turnSeconds)} ثانية · ${ptsLabel(game.points)}`,
      btn: "جاهزين، ابدأ",
      onBtn: startTimer,
    });
  }

  // ===== بطاقة اللاعب =====
  const PHOTO_BG = ["#E03A2F", "#2849D6", "#1F9D55", "#15171A"];
  function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  const SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  /** صورة اللاعب: لو فيه صورة مرخّصة في البيانات نعرضها، وإلا نرسم بطاقة بقميص ورقم */
  function playerPhoto(p) {
    const box = $("#rv-photo");
    box.replaceChildren();
    const h = hash(p.id);
    box.style.setProperty("--photo-bg", PHOTO_BG[h % PHOTO_BG.length]);
    if (p.photo) {
      const img = el("img");
      img.src = p.photo; img.alt = p.name; img.loading = "lazy";
      box.append(img);
      return;
    }
    const shirt = ["#FFFFFF", "#FFC82E", "#FFFFFF", "#FFC82E"][h % 4];
    const num = String((h % 22) + 2);
    const svg = svgEl("svg", { viewBox: "0 0 240 180", "aria-hidden": "true" });
    svg.append(
      svgEl("circle", { cx: 120, cy: 210, r: 120, fill: "none", stroke: "rgba(255,255,255,.18)", "stroke-width": 3 }),
      svgEl("path", { d: "M120 0V180", stroke: "rgba(255,255,255,.18)", "stroke-width": 3 }),
      svgEl("path", { d: "M48 184 C52 132 84 116 120 116 C156 116 188 132 192 184 Z", fill: shirt, stroke: "#15171A", "stroke-width": 5 }),
      svgEl("path", { d: "M104 117 L120 136 L136 117", fill: "none", stroke: "#15171A", "stroke-width": 5, "stroke-linejoin": "round" }),
      svgEl("circle", { cx: 120, cy: 76, r: 32, fill: "#15171A" }),
      svgEl("rect", { x: 112, y: 100, width: 16, height: 18, fill: "#15171A" }),
    );
    const t = svgEl("text", { x: 120, y: 172, "text-anchor": "middle", "font-size": 34, "font-weight": 900, fill: "#15171A", "font-family": "Alexandria, sans-serif" });
    t.textContent = num;
    svg.append(t);
    box.append(svg);
  }

  function fillRevealInfo(p) {
    const desc = $("#rv-desc");
    desc.hidden = true;
    if (p.kind === "clip") {
      $("#rv-info").textContent = "من مقاطعك";
    } else if (p.kind === "goal") {
      $("#rv-info").textContent = `${p.team} ضد ${p.opp} · ${p.comp} ${AR(p.year)}`;
      desc.textContent = p.desc;
      desc.hidden = false;
    } else {
      $("#rv-info").textContent = `${p.flag} ${p.nat} · ${p.pos} · مواليد ${AR(p.born)}`;
    }
    if (stage.isVideo) stage.unveil();
  }

  function openReveal() {
    if (paused || game.roundDone) return;
    stopTimer();
    sfx.reveal(); buzz(30);
    const p = game.player;
    playerPhoto(p);
    $("#rv-name").textContent = p.name;
    $("#rv-en").textContent = p.en;
    fillRevealInfo(p);
    $("#rv-points").textContent = `+${AR(game.points)}`;
    const box = $("#rv-teams");
    box.replaceChildren();
    // الفريق اللي عليه الدور أول زر
    const order = game.teams.map((_, i) => (game.current + i) % game.teams.length);
    order.forEach((i) => {
      const b = el("button", "btn", `✓ ${game.teams[i].name}`);
      b.type = "button";
      paintTeam(b, i);
      b.addEventListener("click", () => closeReveal(game.award(i)));
      box.append(b);
    });
    $("#reveal").hidden = false;
    box.firstChild.focus();
  }
  function closeReveal(ev) {
    $("#reveal").hidden = true;
    handle(ev);
  }
  $("#rv-skip").addEventListener("click", () => closeReveal(game.skip()));

  function handle(ev) {
    renderScores();
    if (ev.type === "ignored") return;
    if (ev.type === "correct") {
      sfx.right(); buzz(40);
      toast(`+${AR(ev.points)} لـ ${game.teams[ev.team].name}`);
      return next();
    }
    if (ev.type === "reveal") {
      if (ev.reason !== "skip") {
        // خلصت التلميحات ومحد عرفه: نكشف اللاعب ونسجل تخطي
        openRevealAfterHints();
        return;
      }
      toast("محد عرفه، اللاعب اللي بعده");
      return next();
    }
    const why = { timeout: "خلص الوقت", pass: "مرّرتوا" }[ev.reason] || "";
    if (ev.type === "hint") {
      sfx.hint(); buzz(30);
      renderHints(game.hintLevel - 1);
      renderTurn();
      if (stage.isVideo) stage.setBlur(game.hintLevel);
      return handoff({ emoji: "💡", text: `${why}. ${game.teams.length > 1 ? "محد عرفه، " : ""}انكشف تلميح: ${ev.hint.label}` });
    }
    sfx.pass(); buzz(60);
    renderTurn();
    handoff({ emoji: "⏭️", text: `${why} من ${game.teams[ev.team].name}` });
  }

  // بعد آخر تلميح: نعرض البطاقة بدون أزرار الفرق
  function openRevealAfterHints() {
    const p = game.player;
    playerPhoto(p);
    $("#rv-name").textContent = p.name;
    $("#rv-en").textContent = p.en;
    fillRevealInfo(p);
    $(".rv-q").hidden = true;
    $("#rv-teams").replaceChildren();
    const skip = $("#rv-skip");
    const label = skip.textContent;
    skip.textContent = game.isLastRound ? "شوف النتيجة" : "اللاعب اللي بعده";
    $("#reveal").hidden = false;
    skip.onclick = () => { skip.onclick = null; skip.textContent = label; $(".rv-q").hidden = false; $("#reveal").hidden = true; next(); };
    skip.focus();
  }

  function next() {
    const ev = game.nextRound();
    if (ev.type === "gameover") return endGame();
    renderRound();
    handoff();
  }

  $("#reveal-btn").addEventListener("click", openReveal);
  $("#pass-btn").addEventListener("click", () => { if (!paused) handle(game.pass()); });
  $("#quit-btn").addEventListener("click", () => {
    const wasRunning = !paused;
    stopTimer();
    overlay({
      emoji: "🛑", title: "تنهي اللعبة؟", text: "النتيجة الحالية بتنعرض.",
      btn: "إيه، أنهِ", onBtn: endGame,
      btn2: "كمّل اللعب", onBtn2: () => (wasRunning ? runTimer() : handoff()),
    });
  });

  function endGame() {
    stopTimer();
    stage.stop();
    if (musicOn && unlocked) Music.start();
    const st = game.standings();
    const top = st[0];
    const tie = st.length > 1 && st[1].score === top.score;
    $("#winner").textContent = st.length === 1 ? `جمعت ${AR(top.score)} نقطة` : tie ? "تعادل! 🤝" : `🏆 ${top.name}`;
    const pod = $("#podium");
    pod.replaceChildren();
    st.forEach((t) => {
      const li = el("li");
      li.append(el("span", null, t.name), el("span", null, `${AR(t.score)} نقطة`));
      pod.append(li);
    });
    show("end");
  }
  $("#again-btn").addEventListener("click", startGame);

  // تشغيل بدون إنترنت (في المتصفح فقط)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
