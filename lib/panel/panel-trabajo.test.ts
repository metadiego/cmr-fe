import { test } from "node:test";
import assert from "node:assert/strict";

import type { PanelWorkRow } from "../api/paneles.ts";
import { claimPayloadFor, freeRowsForSection, rowsForStaffInSection, sectionVisibleForStaff } from "./panel-trabajo.ts";

const rows: PanelWorkRow[] = [
  { sectionKey: "glp1", kind: "session", sessionId: "s1", staffId: null, patientName: "Ana" },
  { sectionKey: "glp1", kind: "session", sessionId: "s2", staffId: "n1", patientName: "Beto" },
  { sectionKey: "vitales", kind: "appointment", appointmentId: "a1", staffId: null, patientName: "Caro" },
  { sectionKey: "vitales", kind: "appointment", appointmentId: "a2", staffId: "n1", patientName: "Deni" },
  { sectionKey: "intravenoso", kind: "session", sessionId: "s3", staffId: "n2", patientName: "Eva" },
];

test("freeRowsForSection: solo las sin tomar de esa sección, sin importar de quién", () => {
  assert.deepEqual(freeRowsForSection(rows, "glp1").map((r) => r.patientName), ["Ana"]);
  assert.deepEqual(freeRowsForSection(rows, "intravenoso"), []);
});

test("rowsForStaffInSection: solo las de esa enfermera, en esa sección", () => {
  assert.deepEqual(rowsForStaffInSection(rows, "vitales", "n1").map((r) => r.patientName), ["Deni"]);
  assert.deepEqual(rowsForStaffInSection(rows, "glp1", "n2"), []);
});

test("sectionVisibleForStaff: se muestra si hay libres (para cualquiera) o si ella ya tiene ahí", () => {
  assert.equal(sectionVisibleForStaff(rows, "glp1", "n2"), true, "hay un récord libre, aunque n2 no tenga nada ahí");
  assert.equal(sectionVisibleForStaff(rows, "intravenoso", "n2"), true, "nada libre pero n2 ya tiene 1 ahí");
  assert.equal(sectionVisibleForStaff(rows, "intravenoso", "n1"), false, "nada libre y n1 no tiene nada ahí");
});

test("claimPayloadFor: sessionId para una sesión, appointmentId para una cita — nunca ambos", () => {
  assert.deepEqual(claimPayloadFor(rows[0], "n9"), { sectionKey: "glp1", staffId: "n9", sessionId: "s1" });
  assert.deepEqual(claimPayloadFor(rows[2], "n9"), { sectionKey: "vitales", staffId: "n9", appointmentId: "a1" });
});
