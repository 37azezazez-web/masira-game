// تشغيل: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const E = require("../js/engine.js");
const { PLAYERS } = require("../js/data.js");

const byId = (id) => PLAYERS.find((p) => p.id === id);

test("البيانات سليمة", () => {
  const ids = new Set();
  for (const p of PLAYERS) {
    assert.ok(!ids.has(p.id), `معرف مكرر ${p.id}`);
    ids.add(p.id);
    assert.ok([1, 2, 3].includes(p.level), p.id);
    for (const k of ["name", "en", "nat", "flag", "pos"]) assert.ok(p[k], `${p.id} ناقصه ${k}`);
    assert.ok(p.born > 1930 && p.born < 2010, p.id);
    assert.ok(p.career.length >= 1, p.id);
    for (const [club, years] of p.career) assert.ok(club && years, p.id);
  }
  for (const lvl of [1, 2, 3]) assert.ok(PLAYERS.filter((p) => p.level === lvl).length >= 10, `مستوى ${lvl} قليل`);
});

test("المطابقة تقبل الصيغ المختلفة", () => {
  const r = byId("ronaldo");
  for (const g of ["رونالدو", "رونلدو", "كريستيانو رونالدو", "CR7", " Cristiano  Ronaldo ", "كرستيانو"]) {
    assert.ok(E.isCorrect(g, r), g);
  }
  assert.ok(E.isCorrect("إبراهيموفيتش", byId("zlatan")));
  assert.ok(E.isCorrect("دوسري", byId("dawsari")));
  assert.ok(E.isCorrect("mbappe", byId("mbappe")));
  assert.ok(E.isCorrect("كلوزة", byId("klose")));
});

test("المطابقة ترفض الغلط", () => {
  const r = byId("ronaldo");
  for (const g of ["ميسي", "رو", "", "رونالدينيو", "a"]) assert.ok(!E.isCorrect(g, r), g);
  assert.ok(!E.isCorrect("بيلي", byId("bale")));
});

test("مسار الجولة: غلط ثم تلميح ثم صح", () => {
  const g = new E.Game({ teams: ["أ", "ب"], players: [byId("messi"), byId("salah")], turnSeconds: 30 });
  assert.equal(g.current, 0);
  assert.equal(g.guess("رونالدو").type, "next");
  assert.equal(g.current, 1);
  const ev = g.timeout();
  assert.equal(ev.type, "hint");
  assert.equal(g.hintLevel, 1);
  assert.equal(g.points, 4);
  const ok = g.guess("ميسي");
  assert.equal(ok.type, "correct");
  assert.equal(g.teams[0].score, 4);
  assert.equal(g.nextRound().type, "round");
  assert.equal(g.current, 1, "الجولة الثانية يبدأها الفريق الثاني");
  assert.equal(g.nextRound().type, "gameover");
});

test("لو محد عرف بعد كل التلميحات ينكشف اللاعب", () => {
  const g = new E.Game({ teams: ["solo"], players: [byId("klose")], turnSeconds: 10 });
  for (let i = 0; i < E.MAX_HINTS; i++) assert.equal(g.pass().type, "hint");
  assert.equal(g.pass().type, "reveal");
  assert.equal(g.guess("كلوزه").type, "ignored");
  assert.equal(g.teams[0].score, 0);
});

test("اختيار اللاعبين حسب الصعوبة وبدون تكرار", () => {
  const picked = E.pickPlayers(PLAYERS, 3, 5);
  assert.equal(picked.length, 5);
  assert.ok(picked.every((p) => p.level === 3));
  assert.equal(new Set(picked.map((p) => p.id)).size, 5);
  const seen = PLAYERS.filter((p) => p.level === 1).slice(0, 5).map((p) => p.id);
  const fresh = E.pickPlayers(PLAYERS, 1, 5, seen);
  assert.ok(fresh.every((p) => !seen.includes(p.id)), "يفضّل اللاعبين الجدد");
  assert.equal(E.pickPlayers(PLAYERS, "mix", 999).length, PLAYERS.length);
});

test("نظام ورني الجواب: نقاط للفريق المختار أو تخطي", () => {
  const g = new E.Game({ teams: ["أ", "ب", "ج"], players: [byId("messi"), byId("salah"), byId("kane")], turnSeconds: 30 });
  g.pass(); g.pass(); g.pass(); // كل الفرق مرّرت = تلميح
  assert.equal(g.hintLevel, 1);
  const ev = g.award(2);
  assert.equal(ev.type, "correct");
  assert.equal(g.teams[2].score, 4);
  assert.equal(g.award(0).type, "ignored", "ما ينفع نعطي نقاط مرتين");
  g.nextRound();
  const sk = g.skip();
  assert.equal(sk.type, "reveal");
  assert.equal(g.teams.reduce((a, t) => a + t.score, 0), 4);
  g.nextRound();
  assert.equal(g.award(9).type, "ignored", "فريق غير موجود");
});

test("بيانات الأهداف سليمة والتلميحات حقتها", () => {
  const { GOALS } = require("../js/goals.js");
  assert.ok(GOALS.length >= 12);
  const ids = new Set();
  for (const g of GOALS) {
    assert.ok(!ids.has(g.id), "معرف مكرر " + g.id); ids.add(g.id);
    assert.equal(g.kind, "goal");
    for (const k of ["name", "en", "nat", "flag", "team", "opp", "comp", "desc"]) assert.ok(g[k], `${g.id} ناقص ${k}`);
    assert.ok(g.year > 1950 && g.year <= 2026);
    assert.ok(g.actors.some(([s]) => s === "k"), g.id + " بدون حارس");
    const tracks = [...g.actors.map(([, p]) => p), g.ball];
    for (const path of tracks) {
      assert.ok(path.length >= 2);
      for (let i = 0; i < path.length; i++) {
        const [t, x, y] = path[i];
        assert.ok(x >= 30 && x <= 106 && y >= -1 && y <= 69, `${g.id} نقطة برا الملعب ${x},${y}`);
        if (i) assert.ok(t > path[i - 1][0], `${g.id} الوقت لازم يزيد`);
      }
    }
    // الكورة تخلص داخل المرمى
    const [, bx, by] = g.ball[g.ball.length - 1];
    assert.ok(bx >= 104.5 && by > 30.3 && by < 37.7, `${g.id} الكورة ما دخلت المرمى`);
  }
  const game = new E.Game({ teams: ["أ", "ب"], players: GOALS.slice(0, 2), turnSeconds: 30 });
  const ev = game.pass() && game.pass();
  assert.equal(ev.type, "hint");
  assert.equal(ev.hint.label, "البطولة");
  assert.match(ev.hint.value, /كأس العالم 1994/);
  assert.ok(E.isCorrect("العويران", GOALS[0]));
});
