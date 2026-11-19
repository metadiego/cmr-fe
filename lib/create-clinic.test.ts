// The clinic a new record is created in (lib/create-clinic.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { createClinicOf, createClinicReady, formCreateClinic } from "./create-clinic.ts";

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

test("form: a pick wins, then the clinic the form was opened in", () => {
  const base = { active: "bay", centers: ["bay", "cag"], viewAll: true };
  assert.equal(formCreateClinic({ ...base, picked: "cag", given: "bay" }), "cag");
  assert.equal(formCreateClinic({ ...base, given: "cag" }), "cag");
});

test("form: one clinic in the top bar → that one, as before", () => {
  assert.equal(formCreateClinic({ active: "cag", centers: ["bay", "cag"], viewAll: false }), "cag");
  assert.equal(formCreateClinic({ active: null, centers: ["bay", "cag"], viewAll: false }), "");
});

test("form: «Ambos» with several clinics → empty, the form asks (never the working clinic)", () => {
  assert.equal(formCreateClinic({ active: "bay", centers: ["bay", "cag"], viewAll: true }), "");
  // Clinics still loading on «Ambos»: still empty, not the working clinic.
  assert.equal(formCreateClinic({ active: "bay", centers: [], viewAll: true }), "");
});

test("form: only one clinic → that one, even on «Ambos»", () => {
  assert.equal(formCreateClinic({ active: "bay", centers: ["cag"], viewAll: true }), "cag");
});

test("ready: a clinic is always enough", () => {
  assert.equal(createClinicReady("bay", 2, true), true);
});

test("ready: no clinic on «Ambos» is never enough (it would land in the working clinic)", () => {
  assert.equal(createClinicReady("", 2, true), false);
  assert.equal(createClinicReady("", 0, true), false);
});

test("ready: no clinic outside «Ambos» only when there is nothing to choose", () => {
  assert.equal(createClinicReady("", 1, false), true);
  assert.equal(createClinicReady("", 0, false), true);
  assert.equal(createClinicReady("", 2, false), false);
});
