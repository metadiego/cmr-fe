import { test } from "node:test";
import assert from "node:assert/strict";

import { differenceTone, originPrices, priceInvalid, priceOf, signedMoney } from "./protocol-change-simulation.ts";

const money = (v: number) => `$${v.toFixed(2)}`;

test("a price is a number >= 0; empty is not zero", () => {
  assert.equal(priceOf("100"), 100);
  assert.equal(priceOf(" $1,000 "), 1000);
  assert.equal(priceOf("0"), 0);
  assert.equal(priceOf(""), undefined);
  assert.equal(priceOf("-5"), undefined);
  assert.equal(priceOf("abc"), undefined);
  assert.equal(priceInvalid(""), false);
  assert.equal(priceInvalid("-5"), true);
  assert.equal(priceInvalid("12a"), true);
});

test("origin prices: only ticked packages with a typed price (billing clerk's 103120 case)", () => {
  assert.deepEqual(originPrices(["hilt", "mls", "emtt"], { hilt: "100", mls: "50", vitc: "9", emtt: "" }), [
    { paqueteId: "hilt", precioUnitario: 100 },
    { paqueteId: "mls", precioUnitario: 50 },
  ]);
});

test("difference: green at zero to the cent, amber with its sign otherwise", () => {
  assert.equal(differenceTone(0), "success");
  assert.equal(differenceTone(0.004), "success");
  assert.equal(differenceTone(-90), "warning");
  assert.equal(differenceTone(null), null);
  assert.equal(signedMoney(0.001, money), "$0.00");
  assert.equal(signedMoney(90, money), "+$90.00");
  assert.equal(signedMoney(-90, money), "-$90.00");
});
