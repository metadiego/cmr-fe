import { test } from "node:test";
import assert from "node:assert/strict";

import { pickableMethods } from "./payment-methods.ts";

test("Exonerada (carriesMoney:false) and inactive methods are not offered", () => {
  const list = [
    { slug: "efectivo", active: true, carriesMoney: true },
    { slug: "exonerada", active: true, carriesMoney: false },
    { slug: "cheque", active: false, carriesMoney: true },
    { slug: "visa", active: true },
  ];
  assert.deepEqual(pickableMethods(list).map((m) => m.slug), ["efectivo", "visa"]);
});
