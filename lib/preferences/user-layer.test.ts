import { test } from "node:test";
import assert from "node:assert/strict";

import { userLayerForPut } from "./user-layer.ts";

test("userLayerForPut writes the language back as idioma and keeps the rest", () => {
  assert.deepEqual(userLayerForPut({ tema: "claro", language: "es", reportColumns: { r: ["a"] } }), {
    tema: "claro",
    idioma: "es",
    reportColumns: { r: ["a"] },
  });
});

test("userLayerForPut: an explicit idioma wins over the stale English key; empty layers stay empty", () => {
  assert.deepEqual(userLayerForPut({ idioma: "en", language: "es" }), { idioma: "en" });
  assert.deepEqual(userLayerForPut(null), {});
  assert.deepEqual(userLayerForPut({ tema: "oscuro" }), { tema: "oscuro" });
});
