import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveToggle, type EstadoLite } from "./toggle-hora.ts";
import type { Transicion } from "@/lib/api/tablero";

// Catálogo real del tablero `atencion` (verificado contra prod 2026-09-16).
const estados: EstadoLite[] = [
  { clave: "programada", orden: 1 },
  { clave: "confirmada", orden: 2 },
  { clave: "presente", orden: 3 },
  { clave: "triage", orden: 4 },
  { clave: "en_consulta", orden: 5 },
  { clave: "atendida", orden: 6 },
];

// Factory: solo importan slug/fromStatuses/toStatus para la lógica; el resto se rellena.
function tr(slug: string, fromStatuses: string[], toStatus: string | null): Transicion {
  return {
    id: slug,
    slug,
    labelKey: slug,
    fromStatuses,
    toStatus,
    method: "POST",
    path: null,
    action: null,
    permissionSlug: null,
    formFields: [],
    requiresConfirmation: false,
    sortOrder: 0,
    active: true,
  };
}

const transiciones: Transicion[] = [
  tr("confirmar", ["programada"], "confirmada"),
  tr("presente", ["programada", "confirmada"], "presente"),
  tr("triage", ["presente"], "triage"),
  tr("consulta", ["presente"], "en_consulta"),
  tr("atender", ["en_consulta"], "atendida"),
  tr("volver_confirmada", ["presente"], "confirmada"),
  tr("volver_presente", ["triage", "en_consulta"], "presente"),
  tr("volver_triage", ["en_consulta"], "triage"),
];

const base = { transiciones, estados };

test("«Presente» sobre una cita confirmada: avanza a presente", () => {
  const r = resolveToggle({ ...base, estado: "confirmada", forwardSlug: "presente" });
  assert.equal(r.checked, false);
  assert.equal(r.canCheck, true);
  assert.equal(r.action, "presente");
});

test("EL BUG: «En consulta» con la fila en `presente` avanza a en_consulta, nunca deshace «Presente»", () => {
  const r = resolveToggle({ ...base, estado: "presente", forwardSlug: "consulta" });
  assert.equal(r.checked, false);
  assert.equal(r.action, "consulta");
  assert.notEqual(r.action, "volver_confirmada");
});

test("EL BUG blindado: «En consulta» evaluada checked por un glitch NO manda el back de «Presente» (no-op)", () => {
  // optimistic:true fuerza checked aunque el estado siga en `presente` (no es la última etapa).
  const r = resolveToggle({ ...base, estado: "presente", forwardSlug: "consulta", optimistic: true });
  assert.equal(r.checked, true);
  assert.equal(r.canUncheck, false); // no es la última etapa (estado=presente ≠ en_consulta)
  assert.equal(r.action, null); // NO manda volver_confirmada ni nada
});

test("«Presente» marcada se desmarca a confirmada (su propio back), estando la fila en presente", () => {
  const r = resolveToggle({ ...base, estado: "presente", forwardSlug: "presente" });
  assert.equal(r.checked, true);
  assert.equal(r.canUncheck, true);
  assert.equal(r.action, "volver_confirmada");
});

test("«En consulta» marcada (fila en en_consulta) se desmarca a presente, no a confirmada", () => {
  const r = resolveToggle({ ...base, estado: "en_consulta", forwardSlug: "consulta" });
  assert.equal(r.checked, true);
  assert.equal(r.canUncheck, true);
  assert.equal(r.action, "volver_presente");
});
