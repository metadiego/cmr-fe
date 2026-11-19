// lib/personal/staff-name.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { staffFullName } from "./staff-name.ts";

test("name and last name, joined", () => {
  assert.equal(staffFullName({ name: "Emma", lastName: "Ríos" }), "Emma Ríos");
});

test("no last name: the name alone", () => {
  assert.equal(staffFullName({ name: "Emma", lastName: null }), "Emma");
  assert.equal(staffFullName({ name: "Emma" }), "Emma");
});
