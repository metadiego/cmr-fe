// The clinic a new record is created in (lib/create-clinic.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { createClinicOf } from "./create-clinic.ts";

test("exactly one clinic ticked in the filter: the record is created there", () => {
  assert.equal(createClinicOf(["cag"], ["bay", "cag"], "bay", "bay"), "cag");
});

test("every clinic (null) or several ticked: the top bar's clinic", () => {
  assert.equal(createClinicOf(null, ["bay", "cag"], "cag", "bay"), "cag");
  assert.equal(createClinicOf(["bay", "cag"], ["bay", "cag"], "cag", "bay"), "cag");
});

test("no top bar clinic: the session's, else the first one the person may create in", () => {
  assert.equal(createClinicOf(null, ["bay", "cag"], null, "bay"), "bay");
  assert.equal(createClinicOf(null, ["bay", "cag"], null, null), "bay");
});

test("a ticked or active clinic without the create permission is skipped", () => {
  assert.equal(createClinicOf(["cag"], ["bay"], "cag", "cag"), "bay");
});

test("nowhere to create: empty", () => {
  assert.equal(createClinicOf(["cag"], [], "cag", "cag"), "");
});

test("top bar on «Ambos» and two clinics to create in: nothing picked, the form asks", () => {
  assert.equal(createClinicOf(["bay", "cag"], ["bay", "cag"], "cag", "bay", true), "");
  // …but one clinic to create in is not a question.
  assert.equal(createClinicOf(["bay", "cag"], ["bay"], "cag", "bay", true), "bay");
});
