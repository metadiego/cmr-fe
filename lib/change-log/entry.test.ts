import { test } from "node:test";
import assert from "node:assert/strict";

import { canUndo, entryPatient, fieldChanges, valueText } from "./entry.ts";

// Trimmed from a real prod entry (Caguas, 10-nov 14:03, start_therapy).
const prod = {
  patient: null,
  changeSet: {
    fields: ["estado", "terapiaInEn"],
    before: { estado: "presente", terapiaInEn: null, paciente: { id: "p", record: "15973", nombre: "SOTO, RAFAEL" } },
    after: { estado: "en_terapia", terapiaInEn: "2026-11-10T18:03:27.300Z", paciente: { id: "p", record: "15973", nombre: "SOTO, RAFAEL" } },
  },
};

test("fieldChanges: one line per changed field, before → after", () => {
  assert.deepEqual(fieldChanges(prod), [
    { field: "estado", before: "presente", after: "en_terapia" },
    { field: "terapiaInEn", before: null, after: "2026-11-10T18:03:27.300Z" },
  ]);
  assert.deepEqual(fieldChanges({ changeSet: { fields: ["x"], before: null, after: null } }), []);
});

test("entryPatient: from the snapshot when the entry has no patient", () => {
  assert.deepEqual(entryPatient(prod), { name: "SOTO, RAFAEL", record: "15973" });
  assert.deepEqual(entryPatient({ patient: { name: "A", record: "1" }, changeSet: prod.changeSet }), { name: "A", record: "1" });
});

test("canUndo: needs the permission, not undone, not an undo itself", () => {
  assert.equal(canUndo({ undoneAt: null, undoesEntryId: null }, true), true);
  assert.equal(canUndo({ undoneAt: null, undoesEntryId: null }, false), false);
  assert.equal(canUndo({ undoneAt: "2026-11-10T19:00:00Z", undoesEntryId: null }, true), false);
  assert.equal(canUndo({ undoneAt: null, undoesEntryId: "e1" }, true), false);
});

test("valueText: names for ids, the center's clock for timestamps, a dash for empty", () => {
  assert.equal(valueText(null), "—");
  assert.equal(valueText("2026-11-10T18:03:27.300Z"), "14:03", "UTC stamp → Puerto Rico clock");
  assert.equal(valueText("nurse-1", (id) => (id === "nurse-1" ? "Glorimar Lebron" : undefined)), "Glorimar Lebron");
  assert.equal(valueText(2), "2");
});
