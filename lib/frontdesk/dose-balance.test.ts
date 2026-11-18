import test from "node:test";
import assert from "node:assert/strict";

import { doseBalanceForRow, patientsNeedingDoseBalance } from "./dose-balance.ts";

test("patientsNeedingDoseBalance: nada cuando el servicio no tiene columna de dosis", () => {
  const ids = patientsNeedingDoseBalance(["r1", "r2"], () => "p1", false);
  assert.deepEqual(ids, []);
});

test("patientsNeedingDoseBalance: un paciente repetido en varias filas se pide UNA sola vez", () => {
  const byRow: Record<string, string> = { r1: "p1", r2: "p1", r3: "p1" };
  const ids = patientsNeedingDoseBalance(["r1", "r2", "r3"], (id) => byRow[id], true);
  assert.deepEqual(ids, ["p1"]);
});

test("patientsNeedingDoseBalance: dos pacientes distintos → dos ids, en orden de primera aparición, sin filas sin paciente", () => {
  const byRow: Record<string, string | undefined> = { r1: "p1", r2: "p2", r3: "p1", r4: undefined };
  const ids = patientsNeedingDoseBalance(["r1", "r2", "r3", "r4"], (id) => byRow[id], true);
  assert.deepEqual(ids, ["p1", "p2"]);
});

test("doseBalanceForRow: cada fila ve SOLO el saldo de SU paciente, nunca el de otro", () => {
  const byPatient = { p1: [{ nombre: "A", n: 3 }], p2: [{ nombre: "B", n: 9 }] };
  assert.deepEqual(doseBalanceForRow(byPatient, "p1"), [{ nombre: "A", n: 3 }]);
  assert.deepEqual(doseBalanceForRow(byPatient, "p2"), [{ nombre: "B", n: 9 }]);
  // Ni cruzado ni mezclado: el saldo de p1 nunca aparece al pedir el de p2.
  assert.notDeepEqual(doseBalanceForRow(byPatient, "p1"), doseBalanceForRow(byPatient, "p2"));
});

test("doseBalanceForRow: paciente sin entrada en el mapa o sin resolver → vacío, nunca el de otro", () => {
  const byPatient = { p1: [{ nombre: "A", n: 3 }] };
  assert.deepEqual(doseBalanceForRow(byPatient, "p2"), []);
  assert.deepEqual(doseBalanceForRow(byPatient, null), []);
  assert.deepEqual(doseBalanceForRow(byPatient, undefined), []);
});

// patient-desk SIN REGRESIÓN: sus `sessionIds` ya vienen filtrados a UN solo paciente (groupByPatient,
// hooks/use-patient-day.ts), así que el caso real ahí es "varias filas, un mismo patientId" — el mapa
// por paciente debe colapsar exactamente al viejo comportamiento de un solo fetch con un solo arreglo
// que llega IGUAL a cada fila, antes y después de este cambio (cmr-fe #139).
test("caso patient-desk (un solo paciente): exactamente UN id a pedir, pase lo que pase con el número de filas", () => {
  const byRow: Record<string, string> = { laser1: "p1", laser2: "p1", laser3: "p1" };
  const ids = patientsNeedingDoseBalance(Object.keys(byRow), (id) => byRow[id], true);
  assert.equal(ids.length, 1, "patient-desk solo debe disparar UN getPendingDeliveries, como antes");
  assert.deepEqual(ids, ["p1"]);
});

test("caso patient-desk (un solo paciente): el MISMO saldoDosis llega a cada fila del paciente", () => {
  const byRow: Record<string, string> = { laser1: "p1", laser2: "p1", laser3: "p1" };
  const saldo = [{ nombre: "Dosis A", n: 4 }];
  const byPatient = { p1: saldo };
  const porFila = Object.keys(byRow).map((rowId) => doseBalanceForRow(byPatient, byRow[rowId]));
  for (const recibido of porFila) assert.deepEqual(recibido, saldo);
});
