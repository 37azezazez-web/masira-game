const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
test("sw.js يعرّف CACHE وكل الملفات موجودة", () => {
  const src = fs.readFileSync(__dirname + "/../sw.js", "utf8");
  const ctx = { self: { addEventListener() {} }, caches: {}, location: { origin: "x" }, fetch() {} };
  vm.runInNewContext(src + ";this.__c=CACHE;this.__f=FILES;", ctx);
  assert.match(ctx.__c, /^intiqalat-v\d+$/);
  for (const f of ctx.__f) if (f !== "./") assert.ok(fs.existsSync(__dirname + "/../" + f), f);
});
