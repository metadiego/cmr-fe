import { test } from "node:test";
import assert from "node:assert/strict";
import { blockColumns, hidePresente, notifyColumn } from "./patient-columns.ts";

const cols = [
  { clave: "fd_paciente" },
  { clave: "fd_record" },
  { clave: "fd_enfermera" },
  { clave: "fd_notificar", render: { kind: "notificar", panel: "enfermeria" } },
  { clave: "fd_dosis" },
];

test("a patient's service block drops name, record and the notify bell", () => {
  assert.deepEqual(blockColumns(cols).map((c) => c.clave), ["fd_enfermera", "fd_dosis"]);
});

test("the consultation board's own keys too", () => {
  assert.deepEqual(blockColumns([{ clave: "record" }, { clave: "paciente" }, { clave: "medico" }, { clave: "citas_notificar", render: { kind: "notificar" } }]).map((c) => c.clave), ["medico"]);
});

test("the notify column is found by its render kind, whatever its key", () => {
  assert.equal(notifyColumn(cols)?.clave, "fd_notificar");
  assert.equal(notifyColumn([{ clave: "x" }]), undefined);
});

test("hidePresente drops only the consultation's own presente column, keeps the rest in order", () => {
  const atencionCols = [
    { clave: "medico" },
    { clave: "presente" },
    { clave: "en_consulta" },
    { clave: "asistido" },
  ];
  assert.deepEqual(hidePresente(atencionCols).map((c) => c.clave), [
    "medico",
    "en_consulta",
    "asistido",
  ]);
});

test("hidePresente is a no-op when there is no presente column", () => {
  assert.deepEqual(hidePresente(cols).map((c) => c.clave), cols.map((c) => c.clave));
});
