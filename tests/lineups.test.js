const test = require("node:test");
const assert = require("node:assert");
const { LINEUPS } = require("../js/lineups.js");
const Engine = require("../js/engine.js");

test("أكثر من ٤٠ تشكيلة، كل وحدة ١١ لاعب ومخفي موجود", () => {
  assert.ok(LINEUPS.length > 40);
  for (const l of LINEUPS) {
    assert.strictEqual(l.players.length, 11, l.title);
    assert.ok(l.hidden >= 0, "المخفي مو موجود: " + l.title);
    assert.ok([1, 2, 3].includes(l.level), l.title);
    assert.strictEqual(l.extra.length, 2, l.title);
    assert.ok(l.club, "بدون نادي: " + l.title);
    assert.ok(!l.extra.some(([k]) => k === "جنسيته"), "تلميح جنسية مكرر: " + l.title);
    assert.strictEqual(new Set(l.players.map((p) => p.name)).size, 11, "اسم مكرر: " + l.title);
    for (const p of l.players) assert.ok(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100, l.title);
  }
});

test("كل الصعوبات وكل الحقب موجودة", () => {
  for (const lv of [1, 2, 3]) assert.ok(LINEUPS.filter((l) => l.level === lv).length >= 10);
  assert.ok(new Set(LINEUPS.map((l) => Math.floor(l.year / 10))).size >= 6);
});

test("تلميحات التشكيلة: النادي، تلميحين، أول حرف", () => {
  const l = LINEUPS[0];
  const g = new Engine.Game({ teams: ["أ"], players: [l], turnSeconds: 30 });
  for (let i = 0; i < 4; i++) g.pass();
  const h = g.revealedHints;
  assert.strictEqual(h.length, 4);
  assert.strictEqual(h[0].label, "ناديه وقتها");
  assert.strictEqual(h[0].value, "وست هام");
  assert.strictEqual(h[1].label, l.extra[0][0]);
  assert.strictEqual(h[2].value, l.extra[1][1]);
  assert.strictEqual(h[3].label, "أول حرف");
});

test("تشكيلة نادي: التلميح الأول منتخبه", () => {
  const l = LINEUPS.find((x) => x.name === "بيكهام");
  const h = Engine.hintsFor(l)[0];
  assert.strictEqual(h.label, "منتخبه");
  assert.strictEqual(h.get(l), "إنجلترا");
});

test("تشكيلات الكرة السعودية موجودة", () => {
  assert.ok(LINEUPS.filter((l) => l.saudi).length >= 10);
});
