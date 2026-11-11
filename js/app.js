/* واجهة اللعبة. كل النصوص تنحط بـ textContent (ما نستخدم innerHTML مع مدخلات المستخدم). */
(function () {
  "use strict";
  const { Game, pickPlayers, MAX_HINTS } = window.Engine;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const TEAM_COLORS = ["#C8F135", "#5CC8FF", "#FF8A5C", "#C792FF"];
  const DEFAULT_TEAMS = ["الصقور", "النمور", "الذيب", "الفهود"];

  // ===== تخزين آمن =====
  const store = {
    get(k, d) { try { const v = localStorage.getItem("masira:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("masira:" + k, JSON.stringify(v)); } catch { /* وضع خاص */ } },
  };

  // ===== صوت واهتزاز =====
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
    tick: () => beep(880, 80, "square", 0.04),
    right: () => { beep(660, 120); setTimeout(() => beep(990, 200), 110); },
    wrong: () => beep(180, 260, "sawtooth", 0.06),
    hint: () => beep(520, 160, "triangle"),
  };
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* */ } };

  // ===== التنقل =====
  function show(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) show(go.dataset.go);
  });

  $("#home-count").textContent = `${AR(PLAYERS.length)} لاعب في المكتبة`;

  // ===== الإعدادات =====
  const settings = Object.assign({ teams: DEFAULT_TEAMS.slice(0, 2), difficulty: "1", seconds: "30", rounds: "10" }, store.get("settings", {}));

  function renderTeams() {
    const list = $("#team-list");
    list.replaceChildren();
    settings.teams.forEach((name, i) => {
      const row = el("div", "team-row");
      const dot = el("span", "team-dot");
      dot.style.setProperty("background", TEAM_COLORS[i]);
      const input = el("input");
      input.value = name;
      input.maxLength = 18;
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
      b.addEventListener("click", () => { settings[key] = b.dataset.value; sync(); });
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

  $("#setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const names = settings.teams.map((n) => n.trim().slice(0, 18));
    const err = $("#setup-error");
    if (names.some((n) => !n)) { err.textContent = "اكتب اسم لكل فريق."; err.hidden = false; return; }
    if (new Set(names).size !== names.length) { err.textContent = "أسماء الفرق لازم تكون مختلفة."; err.hidden = false; return; }
    err.hidden = true;
    settings.teams = names;
    store.set("settings", settings);
    startGame();
  });

  // ===== اللعب =====
  let game, timerId, remaining, paused = true;

  function startGame() {
    const seen = store.get("seen", []);
    const diff = settings.difficulty === "mix" ? "mix" : Number(settings.difficulty);
    const players = pickPlayers(PLAYERS, diff, Number(settings.rounds), seen);
    game = new Game({ teams: settings.teams, players, turnSeconds: Number(settings.seconds) });
    store.set("seen", [...new Set([...players.map((p) => p.id), ...seen])].slice(0, PLAYERS.length - 5));
    show("game");
    renderRound();
    handoff();
  }

  function teamColor(i) { return TEAM_COLORS[i % TEAM_COLORS.length]; }

  function renderScores() {
    const box = $("#scores");
    box.replaceChildren();
    game.teams.forEach((t, i) => {
      const s = el("div", "score" + (i === game.current && !game.roundDone ? " active" : ""));
      s.style.setProperty("--team-color", teamColor(i));
      const nm = el("span", "nm", t.name);
      const n = el("span", "n", AR(t.score));
      n.style.setProperty("color", teamColor(i));
      s.append(nm, n);
      box.append(s);
    });
  }

  function renderRound() {
    const p = game.player;
    $("#round-label").textContent = `اللاعب ${AR(game.round + 1)} من ${AR(game.players.length)}`;
    const list = $("#career");
    list.replaceChildren();
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
        box.append(el("div", "hint locked", `🔒 تلميح ${AR(i + 1)}`));
      }
    }
    $("#points-badge").textContent = `${AR(game.points)} نقاط`;
  }

  function renderTurn() {
    const t = $("#turn-team");
    t.textContent = game.team.name;
    document.documentElement.style.setProperty("--team-color", teamColor(game.current));
    renderScores();
  }

  // ===== المؤقت =====
  function setTimerUI() {
    const total = game.turnSeconds;
    const frac = Math.max(0, remaining) / total;
    $("#timer-text").textContent = AR(Math.max(0, remaining));
    $("#timer-ring").style.setProperty("stroke-dashoffset", String(119.4 * (1 - frac)));
    $("#timer").classList.toggle("low", remaining <= 5);
  }
  function startTimer() {
    remaining = game.turnSeconds;
    runTimer();
  }
  // يشغّل المؤقت من الثانية الحالية (يُستخدم أيضًا بعد إلغاء الإنهاء)
  function runTimer() {
    stopTimer();
    paused = false;
    setTimerUI();
    timerId = setInterval(() => {
      if (paused) return;
      remaining--;
      setTimerUI();
      if (remaining > 0 && remaining <= 5) sfx.tick();
      if (remaining <= 0) { stopTimer(); handle(game.timeout()); }
    }, 1000);
  }
  function stopTimer() { clearInterval(timerId); timerId = null; paused = true; }

  // لو طلع من التطبيق نوقف الوقت
  document.addEventListener("visibilitychange", () => { if (timerId) paused = document.hidden; });

  // ===== النافذة =====
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
      text: (prefix ? prefix.text + "\n" : "") + `عندكم ${AR(game.turnSeconds)} ثانية · ${AR(game.points)} نقاط`,
      btn: "جاهزين، ابدأ",
      onBtn: () => { startTimer(); const i = $("#guess-input"); i.value = ""; i.focus(); },
    });
  }

  function careerSummary(p) { return `${p.flag} ${p.nat} · ${p.pos}`; }

  function handle(ev) {
    renderScores();
    if (ev.type === "ignored") return;
    if (ev.type === "correct") {
      sfx.right(); buzz(40);
      return overlay({
        emoji: "🎉", title: ev.player.name,
        text: `${careerSummary(ev.player)}\n${game.teams[ev.team].name} +${AR(ev.points)}`,
        btn: game.isLastRound ? "شوف النتيجة" : "اللاعب اللي بعده", onBtn: next,
      });
    }
    if (ev.type === "reveal") {
      sfx.wrong(); buzz([60, 40, 60]);
      return overlay({
        emoji: "😅", title: `كان ${ev.player.name}`, text: `${careerSummary(ev.player)}\nمحد عرفه هالمرة.`,
        btn: game.isLastRound ? "شوف النتيجة" : "اللاعب اللي بعده", onBtn: next,
      });
    }
    const why = { wrong: "جواب غلط", timeout: "خلص الوقت", pass: "مرّرتوا" }[ev.reason];
    if (ev.type === "hint") {
      sfx.hint(); buzz(30);
      renderHints(game.hintLevel - 1);
      renderTurn();
      return handoff({ emoji: "💡", text: `${why}. ${game.teams.length > 1 ? "محد عرفه، " : ""}انكشف تلميح: ${ev.hint.label}` });
    }
    // next
    sfx.wrong(); buzz(60);
    renderTurn();
    handoff({ emoji: "⏭️", text: `${why} من ${game.teams[ev.team].name}` });
  }

  function next() {
    const ev = game.nextRound();
    if (ev.type === "gameover") return endGame();
    renderRound();
    handoff();
  }

  $("#guess-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#guess-input");
    const v = input.value.trim();
    if (!v || paused) return;
    const ev = game.guess(v);
    if (ev.type !== "correct") {
      const f = $("#guess-form");
      f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
    }
    handle(ev);
  });
  $("#pass-btn").addEventListener("click", () => { if (!paused) handle(game.pass()); });
  $("#quit-btn").addEventListener("click", () => {
    const wasPaused = paused;
    paused = true;
    overlay({
      emoji: "🛑", title: "تنهي اللعبة؟", text: "النتيجة الحالية بتنعرض.",
      btn: "إيه، أنهِ", onBtn: endGame,
      btn2: "كمّل اللعب", onBtn2: () => (wasPaused ? handoff() : runTimer()),
    });
  });
  function endGame() {
    stopTimer();
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

  // تشغيل بدون إنترنت
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
