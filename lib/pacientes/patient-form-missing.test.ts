import { test } from "node:test";
import assert from "node:assert/strict";

import { PATIENT_FORM_FIELDS, patientFormBlock, patientFormMissing } from "./patient-form-missing.ts";

const full: Record<string, string> = {
  nombres: "Ana",
  apellidos: "Rivera",
  docId: "123",
  sexo: "femenino",
  fechaNacimiento: "1980-05-01",
  nacionalidad: "PR",
  telefono: "787",
  whatsapp: "787",
  email: "a@b.co",
  zipcode: "00961",
  direccion: "Calle 1",
  record: "R1",
  aseguradora: "Triple S",
  medicoId: "doc-1",
};
const everything = [...PATIENT_FORM_FIELDS];

test("patientFormMissing: blank first name → listed even when the config requires nothing", () => {
  assert.deepEqual(patientFormMissing({ form: { ...full, nombres: "  " }, required: [], clinicMissing: false }), [
    "nombres",
  ]);
});
for (const f of PATIENT_FORM_FIELDS) {
  test(`patientFormMissing: required ${f} blank → listed`, () => {
    assert.deepEqual(patientFormMissing({ form: { ...full, [f]: " " }, required: everything, clinicMissing: false }), [f]);
  });
}
test("patientFormMissing: a blank field the config does not require is not listed", () => {
  assert.deepEqual(patientFormMissing({ form: { ...full, docId: "" }, required: ["apellidos"], clinicMissing: false }), []);
});
test("patientFormMissing: unknown config fields are ignored", () => {
  assert.deepEqual(patientFormMissing({ form: full, required: ["notAField"], clinicMissing: false }), []);
});
test("patientFormMissing: clinic picker empty → clinic listed first", () => {
  assert.deepEqual(patientFormMissing({ form: { ...full, nombres: "" }, required: [], clinicMissing: true }), [
    "clinic",
    "nombres",
  ]);
});
test("patientFormMissing: empty form → every required field in on-screen order", () => {
  assert.deepEqual(patientFormMissing({ form: {}, required: ["medicoId", "telefono", "apellidos"], clinicMissing: false }), [
    "nombres",
    "apellidos",
    "telefono",
    "medicoId",
  ]);
});
test("patientFormMissing: all present → []", () => {
  assert.deepEqual(patientFormMissing({ form: full, required: everything, clinicMissing: false }), []);
});

const ok = { clinicsLoading: false, birthDate: "1980-05-01", today: "2026-11-16", duplicateRecord: false, checkingRecord: false };
test("patientFormBlock: nothing wrong → null (blank or today's birth date included)", () => {
  assert.equal(patientFormBlock(ok), null);
  assert.equal(patientFormBlock({ ...ok, birthDate: "" }), null);
  assert.equal(patientFormBlock({ ...ok, birthDate: "2026-11-16" }), null);
});
test("patientFormBlock: each cause on its own", () => {
  assert.equal(patientFormBlock({ ...ok, clinicsLoading: true }), "clinicsLoading");
  assert.equal(patientFormBlock({ ...ok, birthDate: "2026-11-17" }), "futureBirthDate");
  assert.equal(patientFormBlock({ ...ok, duplicateRecord: true }), "duplicateRecord");
  assert.equal(patientFormBlock({ ...ok, checkingRecord: true }), "checkingRecord");
});
