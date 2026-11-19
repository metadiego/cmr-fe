import { test } from "node:test";
import assert from "node:assert/strict";

import { quantityBreakdownText } from "./receipt-format.ts";

const label = (key: string) =>
  ({ "fac.breakdown.sessions": "Sesiones", "fac.col.areas": "Áreas", "fac.breakdown.therapies": "Terapias" })[key] ?? key;

test("joins factors by × and the total by =", () => {
  const qb = {
    factors: [
      { key: "dias", labelKey: "fac.breakdown.sessions", value: 12 },
      { key: "areas", labelKey: "fac.col.areas", value: 2 },
    ],
    total: 24,
    totalLabelKey: "fac.breakdown.therapies",
  };
  assert.equal(quantityBreakdownText(qb, label), "12 Sesiones × 2 Áreas = 24 Terapias");
});

test("a single factor still gets its own total", () => {
  const qb = { factors: [{ key: "dias", labelKey: "fac.breakdown.sessions", value: 4 }], total: 4, totalLabelKey: "fac.breakdown.therapies" };
  assert.equal(quantityBreakdownText(qb, label), "4 Sesiones = 4 Terapias");
});
