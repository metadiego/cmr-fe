import { test } from "node:test";
import assert from "node:assert/strict";

import { reassignCheck, reassignOptions, staffName } from "./reassign-user-missing.ts";

test("reassignOptions keeps active staff, sorted by full name", () => {
  const out = reassignOptions([
    { id: "1", name: "Yashira", lastName: "Ruiz", active: true },
    { id: "2", name: "Ana", lastName: null, active: false },
    { id: "3", name: "Ángel", lastName: "Soto" },
    { id: "4", name: "Britalie", lastName: "Cruz", active: true },
  ]);
  assert.deepEqual(out.map((s) => s.id), ["3", "4", "1"]);
  assert.equal(staffName({ name: "Ana", lastName: null }), "Ana");
});

test("reassignCheck: nothing picked is missing; the same person is not a change", () => {
  assert.deepEqual(reassignCheck("", "a"), { filled: false, same: false });
  assert.deepEqual(reassignCheck("a", "a"), { filled: true, same: true });
  assert.deepEqual(reassignCheck("b", "a"), { filled: true, same: false });
  assert.deepEqual(reassignCheck("b", null), { filled: true, same: false });
});
