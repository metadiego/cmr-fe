import { test } from "node:test";
import assert from "node:assert/strict";

import { fieldFilled, planTransitionFields, type TransitionField } from "./transition-fields.ts";

const laser: TransitionField[] = [{ clave: "aplicadas", requerido: true, en: "asistido" }];

test("a visible proposal counts: saved first, nothing missing", () => {
  const plan = planTransitionFields(laser, "asistido", {}, {}, { aplicadas: { column: "fd_aplicadas", value: 2 } });
  assert.deepEqual(plan.missing, []);
  assert.deepEqual(plan.toSave, [{ clave: "aplicadas", column: "fd_aplicadas", value: 2 }]);
});

test("neither saved nor proposed: the field blocks", () => {
  const plan = planTransitionFields(laser, "asistido", {}, {}, {});
  assert.deepEqual(plan.toSave, []);
  assert.deepEqual(plan.missing.map((f) => f.clave), ["aplicadas"]);
});

test("an already saved value wins: nothing to save, nothing missing", () => {
  const plan = planTransitionFields(laser, "asistido", { aplicadas: 3 }, {}, { aplicadas: { column: "c", value: 2 } });
  assert.deepEqual(plan, { toSave: [], missing: [] });
});

test("zero is a real value, NaN is not", () => {
  assert.deepEqual(planTransitionFields(laser, "asistido", { aplicadas: 0 }, {}, {}), { toSave: [], missing: [] });
  const nan = planTransitionFields(laser, "asistido", {}, {}, { aplicadas: { column: "c", value: Number.NaN } });
  assert.equal(nan.missing.length, 1);
});

test("only fields required for THAT state are considered", () => {
  const fields: TransitionField[] = [...laser, { clave: "dosis", requerido: true, en: "presente" }, { clave: "x", en: "asistido" }];
  assert.deepEqual(planTransitionFields(fields, "presente", {}, {}, {}).missing.map((f) => f.clave), ["dosis"]);
  assert.deepEqual(planTransitionFields(fields, "asistido", {}, {}, {}).missing.map((f) => f.clave), ["aplicadas"]);
});

test("row selects count as filled (label or __valor), a dash does not", () => {
  assert.equal(fieldFilled("dosis", {}, { fd_dosis__valor: "id-1" }), true);
  assert.equal(fieldFilled("dosis", {}, { fd_dosis: "—" }), false);
});

// Piece 6b: services.form_acciones `en` may hold the step's new name (check_in / start_therapy / finish,
// accepted by the backend from 6b on); the old names stay what the app writes.
test("a moment under its new name is asked at the same step as its old name", () => {
  const fields: TransitionField[] = [
    { clave: "aplicadas", requerido: true, en: "finish" },
    { clave: "dosis", requerido: true, en: "check_in" },
    { clave: "area", requerido: true, en: "start_therapy" },
  ];
  assert.deepEqual(planTransitionFields(fields, "asistido", {}, {}, {}).missing.map((f) => f.clave), ["aplicadas"]);
  assert.deepEqual(planTransitionFields(fields, "presente", {}, {}, {}).missing.map((f) => f.clave), ["dosis"]);
  assert.deepEqual(planTransitionFields(fields, "en_terapia", {}, {}, {}).missing.map((f) => f.clave), ["area"]);
});

test("an unknown moment is asked at no step", () => {
  const fields: TransitionField[] = [{ clave: "x", requerido: true, en: "later" }];
  assert.deepEqual(planTransitionFields(fields, "asistido", {}, {}, {}).missing, []);
});
