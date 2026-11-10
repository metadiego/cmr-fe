import { test } from "node:test";
import assert from "node:assert/strict";

import { revenueLines, showReturned } from "./daily-revenue.ts";

test("Caguas, 10-nov: bruto 6260.71, devoluciones −6960, neto −699.29 as the headline", () => {
  assert.deepEqual(revenueLines({ grossRevenue: 6260.71, refunds: 6960, netRevenue: -699.29 }), [
    { key: "gross", amount: 6260.71, headline: false },
    { key: "refunds", amount: -6960, headline: false },
    { key: "net", amount: -699.29, headline: true },
  ]);
});

test("no refunds: bruto and neto only; an older BE without neto: bruto as the headline", () => {
  assert.deepEqual(revenueLines({ grossRevenue: 100, refunds: 0, netRevenue: 100 }).map((l) => l.key), ["gross", "net"]);
  assert.deepEqual(revenueLines({ grossRevenue: 100 }), [{ key: "gross", amount: 100, headline: true }]);
});

test("Devueltos column only when a service had sessions given back", () => {
  assert.equal(showReturned({ services: [{ returned: 0 }, {}] }), false);
  assert.equal(showReturned({ services: [{ returned: 2 }] }), true);
});
