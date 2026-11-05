import { test } from "node:test";
import assert from "node:assert/strict";

import { needsConfirmAfterCreate } from "./requested-status.ts";

test("asked confirmada, got programada (reschedule into today): confirm it", () => {
  assert.equal(needsConfirmAfterCreate("confirmada", "programada"), true);
});

test("everything else is left as the BE answered", () => {
  assert.equal(needsConfirmAfterCreate("confirmada", "confirmada"), false);
  assert.equal(needsConfirmAfterCreate("confirmada", "presente"), false);
  assert.equal(needsConfirmAfterCreate(undefined, "programada"), false);
  assert.equal(needsConfirmAfterCreate("programada", "programada"), false);
});
