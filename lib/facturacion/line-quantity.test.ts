import { test } from "node:test";
import assert from "node:assert/strict";

import { effectiveQuantity, lineLegend, lineMultipliers, lineQuantityBreakdown } from "./line-quantity.ts";

const label = (key: string) =>
  ({ "fac.col.dias": "Días", "fac.col.areas": "Áreas", "fac.breakdown.sessions": "Sesiones", "fac.breakdown.therapies": "Terapias" })[key] ?? key;

test("sin multiplicadores ni breakdown: nada que mostrar", () => {
  assert.equal(lineMultipliers({ quantity: 1 }), null);
  assert.equal(lineQuantityBreakdown({ quantity: 1 }), null);
  assert.equal(lineLegend({ quantity: 1 }, label), null);
  assert.equal(effectiveQuantity({ quantity: 3 }), 3);
});

test("con multiplicadores (legacy): cantidad efectiva y leyenda × ", () => {
  const it = { quantity: 1, meta: { multiplicadores: { dias: 12, areas: 2 } } };
  assert.equal(effectiveQuantity(it), 24);
  assert.equal(lineLegend(it, label), "12 Días × 2 Áreas");
});

test("quantityBreakdown (BE #619) sustituye la leyenda de multiplicadores", () => {
  const it = {
    quantity: 1,
    meta: { multiplicadores: { dias: 4 } },
    quantityBreakdown: {
      factors: [{ key: "dias", labelKey: "fac.breakdown.sessions", value: 4 }],
      total: 4,
      totalLabelKey: "fac.breakdown.therapies",
    },
  };
  assert.equal(lineLegend(it, label), "4 Sesiones = 4 Terapias");
});
