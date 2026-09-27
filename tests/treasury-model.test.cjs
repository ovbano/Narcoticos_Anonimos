const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../tesoreria/model");
test("exact integer cents, comma, zero and invalid input", () => {
  assert.equal(M.cents("12,50"), 1250);
  assert.equal(M.cents("0.01"), 1);
  assert.equal(M.cents("0"), 0);
  assert.equal(M.cents("", true), null);
  for (const s of ["", "-1", "1.001", "1e3", "NaN", "12,2,2", "1000001"])
    assert.throws(() => M.cents(s));
});
test("separate funds and carryover are not monthly income", () => {
  assert.deepEqual(
    M.totals({
      funds: [
        { opening: 14465, income: 18670, expense: 19486, closing: 13649 },
        { opening: 0, income: 0, expense: 0, closing: 0 },
      ],
    }),
    { opening: 14465, income: 18670, expense: 19486, closing: 13649 },
  );
});
test("dues: partial, full and advance; no rounding ambiguity", () => {
  assert.equal(M.dueStatus({ paid: 600, expected: 1200 }), "Parcial");
  assert.equal(M.dueStatus({ paid: 1200, expected: 1200 }), "Completo");
  assert.equal(
    M.dueStatus({ paid: 2400, expected: 1200 }),
    "Anticipo / excedente",
  );
  assert.equal(M.dueStatus({ paid: 0, expected: 1200 }), "Pendiente");
});
test("untrusted labels escaped and Ecuador date stable", () => {
  assert.equal(
    M.esc('<img src=x onerror="bad">'),
    "&lt;img src=x onerror=&quot;bad&quot;&gt;",
  );
  assert.match(M.today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(M.date("2026-09-01"), "01/09/2026");
});
