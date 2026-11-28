import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeResponsibilities,
  responsibilityOptions,
  sameResponsibilities,
  showsConsultaPreferences,
  showsSpecialty,
} from "./responsibilities.ts";

test("normalizeResponsibilities merges cc_operator into operadora and drops duplicates", () => {
  assert.deepEqual(normalizeResponsibilities(["cc_operator", "operadora", "cajero"]), ["operadora", "cajero"]);
  assert.deepEqual(normalizeResponsibilities(["cc_operator"]), ["operadora"]);
  assert.deepEqual(normalizeResponsibilities(null), []);
  assert.deepEqual(normalizeResponsibilities([" tecnico ", ""]), ["tecnico"]);
});

test("sameResponsibilities ignores order and old spellings", () => {
  assert.equal(sameResponsibilities(["cc_operator", "operadora"], ["operadora"]), true);
  assert.equal(sameResponsibilities(["medico", "tecnico"], ["tecnico", "medico"]), true);
  assert.equal(sameResponsibilities(["medico"], ["medico", "tecnico"]), false);
});

test("responsibilityOptions lists every tag in use once, sorted", () => {
  const people = [{ capabilities: ["tecnico", "cc_operator"] }, { capabilities: ["operadora"] }, { capabilities: null }];
  assert.deepEqual(responsibilityOptions(people), ["operadora", "tecnico"]);
});

test("showsSpecialty only for doctors (the doctor function), or when already filled", () => {
  assert.equal(showsSpecialty(true, null), true);
  assert.equal(showsSpecialty(false, ""), false);
  assert.equal(showsSpecialty(false, null), false);
  assert.equal(showsSpecialty(false, "Dermatología"), true);
});

test("showsConsultaPreferences for front desk (the front_desk function), or when a preference is set", () => {
  assert.equal(showsConsultaPreferences(true, {}), true);
  assert.equal(showsConsultaPreferences(false, {}), false);
  assert.equal(showsConsultaPreferences(false, { consultationBoardInitialTab: "presente" }), true);
  assert.equal(showsConsultaPreferences(false, { frontdeskStartsOnConsultation: true }), true);
  assert.equal(showsConsultaPreferences(false, { frontdeskStartsOnConsultation: false, consultationBoardInitialTab: null }), false);
});
