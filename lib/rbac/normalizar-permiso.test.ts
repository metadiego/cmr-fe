import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarPermiso } from "./normalizar-permiso.ts";

test("normalizarPermiso matches camelCase against the real snake_case key", () => {
  assert.equal(normalizarPermiso("pacientes.prioridadFlags.write"), normalizarPermiso("pacientes.prioridad_flags.write"));
});

test("normalizarPermiso matches case-only differences", () => {
  assert.equal(normalizarPermiso("Pacientes.Prioridad_Flags.Write"), normalizarPermiso("pacientes.prioridad_flags.write"));
});

test("normalizarPermiso does not collapse genuinely different permissions", () => {
  assert.notEqual(normalizarPermiso("pacientes.read"), normalizarPermiso("pacientes.write"));
});
