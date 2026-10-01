import { test } from "node:test";
import assert from "node:assert/strict";

import { normalize, suggestEhrRoleId } from "./ehr-role-suggestion.ts";
import type { EhrRole } from "../api/ehr-integration.ts";

function role(name: string, id = name.toLowerCase()): EhrRole {
  return { id, name, description: null, isSystem: true };
}

test("normalize: strips accents and lowercases", () => {
  assert.equal(normalize("Médico"), "medico");
  assert.equal(normalize("ENFERMERA"), "enfermera");
  assert.equal(normalize("  Técnico  "), "tecnico");
});

test("medico suggests Doctor when that role exists in the live list", () => {
  const roles = [role("Doctor"), role("Nurse"), role("waldemar")];
  assert.equal(suggestEhrRoleId("medico", roles), "doctor");
});

test("accented/cased job title still matches (normalized comparison)", () => {
  const roles = [role("Nurse")];
  assert.equal(suggestEhrRoleId("Enfermera", roles), "nurse");
});

test("tecnico is deliberately ambiguous (Therapist or Staff): never pre-marks", () => {
  const roles = [role("Therapist"), role("Staff")];
  assert.equal(suggestEhrRoleId("tecnico", roles), null);
});

test("no exact match in the live role list: null, never a guess", () => {
  // "medico" maps to "Doctor", but this center's EHR doesn't have that role today.
  const roles = [role("waldemar"), role("Admin")];
  assert.equal(suggestEhrRoleId("medico", roles), null);
});

test("unknown job title: null", () => {
  const roles = [role("Doctor"), role("Nurse")];
  assert.equal(suggestEhrRoleId("recepcionista", roles), null);
});

test("no job title on file: null", () => {
  assert.equal(suggestEhrRoleId(null, [role("Doctor")]), null);
  assert.equal(suggestEhrRoleId(undefined, [role("Doctor")]), null);
});
