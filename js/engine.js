/*
 * منطق اللعبة الصافي (بدون واجهة) عشان نقدر نختبره لحاله.
 */
(function (root) {
  "use strict";

  // النقاط حسب عدد التلميحات المكشوفة: بدون تلميح 5، بعد أول تلميح 4 ... إلخ
  const POINTS = [5, 4, 3, 2, 1];
  const HINTS = [
    { key: "nat", label: "الجنسية", get: (p) => `${p.flag} ${p.nat}` },
    { key: "pos", label: "المركز", get: (p) => p.pos },
    { key: "born", label: "سنة الميلاد", get: (p) => String(p.born) },
    { key: "letter", label: "أول حرف وعدد الحروف", get: (p) => {
        const first = p.name.trim()[0];
        const len = p.name.replace(/\s/g, "").length;
        return `يبدأ بـ «${first}» و${len} حرف`;
      } },
  ];
  const letterHint = { key: "letter", label: "أول حرف وعدد الحروف", get: (p) => {
      const first = p.name.trim()[0];
      const len = p.name.replace(/\s/g, "").length;
      return `يبدأ بـ «${first}» و${len} حرف`;
    } };
  // تحدي «خمّن الهدف»: أهداف مرسومة من التطبيق
  const GOAL_HINTS = [
    { key: "comp", label: "البطولة", get: (g) => `${g.comp} ${g.year}` },
    { key: "match", label: "المباراة", get: (g) => `${g.team} ضد ${g.opp}` },
    { key: "nat", label: "جنسية الهداف", get: (g) => `${g.flag} ${g.nat}` },
    letterHint,
  ];
  // مقاطع المستخدم: ما عندنا غير اسم الهداف، فالتلميحات من الاسم نفسه
  const clean = (p) => p.name.replace(/\s/g, "");
  const CLIP_HINTS = [
    { key: "len", label: "عدد الحروف", get: (p) => `${clean(p).length} حرف` },
    { key: "last", label: "آخر حرف", get: (p) => `«${clean(p).slice(-1)}»` },
    { key: "first", label: "أول حرف", get: (p) => `«${clean(p)[0]}»` },
    { key: "half", label: "نص الاسم", get: (p) => p.name.trim().slice(0, Math.ceil(p.name.trim().length / 2)) + "…" },
  ];
  // أهداف يوتيوب بدون بيانات: كل تلميح يطوّل صوت التعليق
  const LISTEN_HINTS = [1, 2, 3, 4].map((n) => ({ key: "more" + n, label: "التعليق أطول", get: () => `+${n * 5} ثانية` }));
  // أهداف يوتيوب معروف هدافها: تعليق أطول مرة وحدة، بعدها على مين سجّل ثم من الاسم
  const NAMED_HINTS = [
    LISTEN_HINTS[0],
    { key: "opp", label: "سجّل على", get: (p) => p.opp },
    { key: "first", label: "أول حرف وعدد الحروف", get: (p) => `«${clean(p)[0]}» · ${clean(p).length} حرف` },
    { key: "half", label: "نص الاسم", get: (p) => p.name.trim().slice(0, Math.ceil(p.name.trim().length / 2)) + "…" },
  ];
  const hintsFor = (item) => item && item.kind === "ytlink" ? (item.name ? NAMED_HINTS : LISTEN_HINTS) : (item && item.kind === "goal" ? GOAL_HINTS : item && (item.kind === "clip" || item.kind === "ytuser") ? CLIP_HINTS : HINTS);
  const MAX_HINTS = HINTS.length;

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // تشكيل لاتيني
      .replace(/[ً-ٰٟـ]/g, "") // تشكيل عربي وتطويل
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[^a-z0-9ء-ي\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w.length > 4 && w.startsWith("ال") ? w.slice(2) : w))
      .join("");
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function allowedTypos(len) {
    if (len >= 9) return 2;
    if (len >= 5) return 1;
    return 0;
  }

  function isCorrect(guess, player) {
    const g = normalize(guess);
    if (g.length < 2) return false;
    const answers = [player.name, player.en, ...(player.aliases || [])].map(normalize).filter(Boolean);
    return answers.some((a) => a === g || levenshtein(a, g) <= allowedTypos(a.length));
  }

  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * يختار لاعبين حسب الصعوبة. difficulty: 1 | 2 | 3 | "mix"
   * seen: قائمة معرفات اللاعبين اللي طلعوا قبل، نحاول ما نكررهم.
   */
  function pickPlayers(all, difficulty, count, seen = [], rand = Math.random) {
    const pool = difficulty === "mix" ? all : all.filter((p) => p.level === Number(difficulty));
    const fresh = shuffle(pool.filter((p) => !seen.includes(p.id)), rand);
    const old = shuffle(pool.filter((p) => seen.includes(p.id)), rand);
    return fresh.concat(old).slice(0, Math.min(count, pool.length));
  }

  class Game {
    constructor({ teams, players, turnSeconds }) {
      if (!teams || !teams.length) throw new Error("لازم فريق واحد على الأقل");
      if (!players || !players.length) throw new Error("ما فيه لاعبين");
      this.teams = teams.map((name) => ({ name, score: 0 }));
      this.players = players;
      this.turnSeconds = turnSeconds;
      this.round = -1;
      this.over = false;
      this.nextRound();
    }

    get player() { return this.players[this.round]; }
    get team() { return this.teams[this.current]; }
    get points() { return POINTS[this.hintLevel]; }
    get revealedHints() {
      return hintsFor(this.player).slice(0, this.hintLevel).map((h) => ({ label: h.label, value: h.get(this.player) }));
    }
    get isLastRound() { return this.round >= this.players.length - 1; }

    nextRound() {
      if (this.isLastRound) { this.over = true; return { type: "gameover" }; }
      this.round++;
      this.hintLevel = 0;
      this.failed = 0;
      this.roundDone = false;
      // الفريق اللي يبدأ يتبدّل كل جولة عشان العدالة
      this.current = this.round % this.teams.length;
      return { type: "round", round: this.round };
    }

    guess(text) {
      if (this.roundDone || this.over) return { type: "ignored" };
      if (isCorrect(text, this.player)) {
        const pts = this.points;
        this.team.score += pts;
        this.roundDone = true;
        return { type: "correct", team: this.current, points: pts, player: this.player };
      }
      return this._fail("wrong");
    }

    /** نظام «ورني الجواب»: المقدم يحدد الفريق اللي جاوب صح بعد كشف الجواب */
    award(teamIndex) {
      if (this.roundDone || this.over) return { type: "ignored" };
      const t = this.teams[teamIndex];
      if (!t) return { type: "ignored" };
      const pts = this.points;
      t.score += pts;
      this.roundDone = true;
      return { type: "correct", team: teamIndex, points: pts, player: this.player };
    }

    /** محد عرفه: ينكشف اللاعب بدون نقاط */
    skip() {
      if (this.roundDone || this.over) return { type: "ignored" };
      this.roundDone = true;
      return { type: "reveal", reason: "skip", team: this.current, player: this.player };
    }

    timeout() { return this.roundDone ? { type: "ignored" } : this._fail("timeout"); }
    pass() { return this.roundDone ? { type: "ignored" } : this._fail("pass"); }

    _fail(reason) {
      const team = this.current;
      this.failed++;
      this.current = (this.current + 1) % this.teams.length;
      if (this.failed >= this.teams.length) {
        this.failed = 0;
        if (this.hintLevel >= MAX_HINTS) {
          this.roundDone = true;
          return { type: "reveal", reason, team, player: this.player };
        }
        this.hintLevel++;
        const h = hintsFor(this.player)[this.hintLevel - 1];
        return { type: "hint", reason, team, hint: { label: h.label, value: h.get(this.player) } };
      }
      return { type: "next", reason, team };
    }

    standings() {
      return this.teams.map((t, i) => ({ ...t, index: i })).sort((a, b) => b.score - a.score);
    }
  }

  const api = { LISTEN_HINTS, NAMED_HINTS, Game, normalize, levenshtein, isCorrect, pickPlayers, shuffle, POINTS, HINTS, GOAL_HINTS, CLIP_HINTS, hintsFor, MAX_HINTS };
  if (typeof module !== "undefined") module.exports = api;
  else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
