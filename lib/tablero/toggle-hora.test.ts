import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveToggle } from "./toggle-hora.ts";
import type { Transicion } from "@/lib/api/tablero";

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

const base = { kind: "medical" as const, transiciones };

test("«Presente» sobre una cita confirmada: avanza a presente", () => {
  const r = resolveToggle({ ...base, row: { estado: "confirmada" }, forwardSlug: "presente" });
  assert.equal(r.checked, false);
  assert.equal(r.canCheck, true);
  assert.equal(r.action, "presente");
});

test("EL BUG: «En consulta» con la fila en `presente` avanza a en_consulta, nunca deshace «Presente»", () => {
  const r = resolveToggle({ ...base, row: { estado: "presente" }, forwardSlug: "consulta" });
  assert.equal(r.checked, false);
  assert.equal(r.action, "consulta");
  assert.notEqual(r.action, "volver_confirmada");
});

test("EL BUG blindado: «En consulta» evaluada checked por un glitch NO manda el back de «Presente» (no-op)", () => {
  // optimistic:true fuerza checked aunque el estado siga en `presente` (no es la última etapa).
  const r = resolveToggle({ ...base, row: { estado: "presente" }, forwardSlug: "consulta", optimistic: true });
  assert.equal(r.checked, true);
  assert.equal(r.canUncheck, false); // no es la última etapa (estado=presente ≠ en_consulta)
  assert.equal(r.action, null); // NO manda volver_confirmada ni nada
});

test("«Presente» marcada se desmarca a confirmada (su propio back), estando la fila en presente", () => {
  const r = resolveToggle({ ...base, row: { estado: "presente" }, forwardSlug: "presente" });
  assert.equal(r.checked, true);
  assert.equal(r.canUncheck, true);
  assert.equal(r.action, "volver_confirmada");
});

test("«En consulta» marcada (fila en en_consulta) se desmarca a presente, no a confirmada", () => {
  const r = resolveToggle({ ...base, row: { estado: "en_consulta" }, forwardSlug: "consulta" });
  assert.equal(r.checked, true);
  assert.equal(r.canUncheck, true);
  assert.equal(r.action, "volver_presente");
});

// Piece 4a: the row's `allowedActions` narrows what the box may do (the backend's own decision).
test("allowedActions: the box advances only when its action is listed", () => {
  const listed = resolveToggle({ ...base, row: { estado: "confirmada" }, forwardSlug: "presente", allowed: ["check_in"] });
  assert.equal(listed.action, "presente");
  assert.equal(listed.disabled, false);
  // a future-dated row: the backend leaves check_in out → the box is a no-op
  const notListed = resolveToggle({ ...base, row: { estado: "confirmada" }, forwardSlug: "presente", allowed: ["cancel"] });
  assert.equal(notListed.action, null);
  assert.equal(notListed.disabled, true);
});

test("allowedActions: the box undoes only when its reverse is listed", () => {
  const r = resolveToggle({ ...base, row: { estado: "presente" }, forwardSlug: "presente", allowed: ["undo_check_in"] });
  assert.equal(r.action, "volver_confirmada");
  const refused = resolveToggle({ ...base, row: { estado: "presente" }, forwardSlug: "presente", allowed: ["start_triage"] });
  assert.equal(refused.action, null);
  assert.equal(refused.checked, true);
});

test("allowedActions: no list on the row keeps today's rule", () => {
  const r = resolveToggle({ ...base, row: { estado: "confirmada" }, forwardSlug: "presente", allowed: null });
  assert.equal(r.action, "presente");
});

// Piece 6b: the box reads stage groups, under both definition shapes.

// The 6b backend serves the same transitions with their groups.
const GROUP: Record<string, string> = {
  programada: "booked", confirmada: "confirmed", presente: "waiting", triage: "triage", en_consulta: "in_consultation",
  atendida: "done", pendiente: "upcoming", en_terapia: "in_therapy", asistido: "done", cancelada: "cancelled_or_not_served",
};
const with6b = (ts: Transicion[]): Transicion[] =>
  ts.map((t) => ({ ...t, fromGroups: t.fromStatuses.map((w) => GROUP[w]), toGroup: t.toStatus ? GROUP[t.toStatus] : null }));
const medical6b = with6b([...transiciones, tr("cancelar", ["presente", "triage"], "cancelada")]);

const notServed = { estado: "cancelada", bookingStatus: "arrived", careStatus: "not_served" } as const;

for (const [shape, ts] of [["6a", [...transiciones, tr("cancelar", ["presente", "triage"], "cancelada")]], ["6b", medical6b]] as const) {
  test(`not served (${shape}): «Presente» stays checked (the patient came), «En consulta» and «Asistido» do not`, () => {
    const presente = resolveToggle({ kind: "medical", transiciones: ts, row: notServed, forwardSlug: "presente" });
    assert.equal(presente.checked, true);
    assert.equal(presente.action, null); // closed: nothing to undo from here
    for (const slug of ["consulta", "atender"]) {
      const r = resolveToggle({ kind: "medical", transiciones: ts, row: notServed, forwardSlug: slug });
      assert.equal(r.checked, false, slug);
      assert.equal(r.action, null, slug);
    }
  });

  test(`cancel is never a box's back (${shape}): it leaves the flow`, () => {
    const r = resolveToggle({ kind: "medical", transiciones: ts, row: { estado: "presente" }, forwardSlug: "presente" });
    assert.equal(r.action, "volver_confirmada");
  });
}

const therapy = [
  tr("presente", ["pendiente"], "presente"),
  tr("en_terapia", ["presente"], "en_terapia"),
  tr("asistido", ["en_terapia"], "asistido"),
  tr("volver_pendiente", ["presente"], "pendiente"),
  tr("volver_presente", ["en_terapia"], "presente"),
];
const called = { estado: "presente", bookingStatus: "arrived", careStatus: "called" } as const;

for (const [shape, ts] of [["6a", therapy], ["6b", with6b(therapy)]] as const) {
  test(`therapy called (${shape}): «Presente» is checked and last, «En terapia» advances`, () => {
    const presente = resolveToggle({ kind: "therapy", transiciones: ts, row: called, forwardSlug: "presente", allowed: ["undo_check_in"] });
    assert.equal(presente.checked, true);
    assert.equal(presente.action, "volver_pendiente");
    const terapia = resolveToggle({ kind: "therapy", transiciones: ts, row: called, forwardSlug: "en_terapia", allowed: ["start_therapy"] });
    assert.equal(terapia.checked, false);
    assert.equal(terapia.action, "en_terapia");
  });
}

test("a board of no lifecycle kind leaves the box inert", () => {
  const r = resolveToggle({ kind: null, transiciones, row: { estado: "confirmada" }, forwardSlug: "presente" });
  assert.equal(r.disabled, true);
  assert.equal(r.action, null);
});
