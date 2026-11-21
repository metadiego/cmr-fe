import { test } from "node:test";
import assert from "node:assert/strict";

import type { PanelWorkRow } from "../api/paneles.ts";
import { claimPayloadFor, rowsForSection, rowsForStaff, unclaimedRows } from "./panel-trabajo.ts";

const rows: PanelWorkRow[] = [
  { sectionKey: "glp1", kind: "session", sessionId: "s1", staffId: null, patientName: "Ana" },
  { sectionKey: "glp1", kind: "session", sessionId: "s2", staffId: "n1", patientName: "Beto" },
  { sectionKey: "vitales", kind: "appointment", appointmentId: "a1", staffId: null, patientName: "Caro" },
  { sectionKey: "vitales", kind: "appointment", appointmentId: "a2", staffId: "n1", patientName: "Deni" },
];

test("rowsForSection: solo las filas de esa sección", () => {
  assert.deepEqual(rowsForSection(rows, "glp1").map((r) => r.patientName), ["Ana", "Beto"]);
  assert.deepEqual(rowsForSection(rows, "nope"), []);
});

test("unclaimedRows: staffId null, sin importar la sección", () => {
  assert.deepEqual(unclaimedRows(rows).map((r) => r.patientName), ["Ana", "Caro"]);
});

test("rowsForStaff: las que ya son de esa persona", () => {
  assert.deepEqual(rowsForStaff(rows, "n1").map((r) => r.patientName), ["Beto", "Deni"]);
  assert.deepEqual(rowsForStaff(rows, "n2"), []);
});

test("claimPayloadFor: sessionId para una sesión, appointmentId para una cita — nunca ambos", () => {
  assert.deepEqual(claimPayloadFor(rows[0], "n9"), { sectionKey: "glp1", staffId: "n9", sessionId: "s1" });
  assert.deepEqual(claimPayloadFor(rows[2], "n9"), { sectionKey: "vitales", staffId: "n9", appointmentId: "a1" });
});
