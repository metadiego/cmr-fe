import { test } from "node:test";
import assert from "node:assert/strict";

import { sentenceCase } from "./text.ts";

test("raises only the first letter", () => {
  assert.equal(sentenceCase("octubre de 2026", "es"), "Octubre de 2026");
  assert.equal(sentenceCase("jueves, 8 de octubre de 2026", "es"), "Jueves, 8 de octubre de 2026");
});

test("leaves empty and already-cased strings alone", () => {
  assert.equal(sentenceCase("", "es"), "");
  assert.equal(sentenceCase("October 2026", "en"), "October 2026");
});
