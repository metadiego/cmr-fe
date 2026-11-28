import { test } from "node:test";
import assert from "node:assert/strict";

import { currentStaffId, reassignCheck, reassignOptions, staffName } from "./reassign-user-missing.ts";

test("reassignOptions keeps active staff, sorted by full name", () => {
  const out = reassignOptions([
    { id: "1", name: "Yashira", lastName: "Ruiz", active: true },
    { id: "2", name: "Ana", lastName: null, active: false },
    { id: "3", name: "Ángel", lastName: "Soto" },
    { id: "4", name: "Britalie", lastName: "Cruz", active: true },
  ]);
  assert.deepEqual(out.map((s) => s.id), ["3", "4", "1"]);
  assert.equal(staffName({ name: "Ana", lastName: null }), "Ana");
  assert.deepEqual(reassignOptions([{ id: "2", name: "Ana", active: false }], "2").map((s) => s.id), ["2"]);
});

test("reassignCheck: nothing picked is missing; the same person is not a change", () => {
  assert.deepEqual(reassignCheck("", "a"), { filled: false, same: false });
  assert.deepEqual(reassignCheck("a", "a"), { filled: true, same: true });
  assert.deepEqual(reassignCheck("b", "a"), { filled: true, same: false });
  assert.deepEqual(reassignCheck("b", null), { filled: true, same: false });
});

test("currentStaffId: matches the invoice's person by staff id or by profile id", () => {
  const staff = [
    { id: "s1", name: "Wilma", profileId: "p1" },
    { id: "s2", name: "Edgardo", profileId: "p2" },
  ];
  assert.equal(currentStaffId(staff, { id: "s2" }), "s2");
  assert.equal(currentStaffId(staff, { id: "u-unknown", profileId: "p1" }), "s1");
  assert.equal(currentStaffId(staff, { profileId: "p9" }), null);
  assert.equal(currentStaffId(staff, null), null);
});
