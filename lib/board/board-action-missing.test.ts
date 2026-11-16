import { test } from "node:test";
import assert from "node:assert/strict";

import { boardActionMissing } from "./board-action-missing.ts";

const fields = ["motivo", "fecha", "hora", "enfermeraId"];
const full = { motivo: "late", fecha: "2026-11-20", hora: "09:30", enfermeraId: "n1" };

test("boardActionMissing: blank motivo → listed", () => {
  assert.deepEqual(boardActionMissing(fields, { ...full, motivo: "  " }), ["motivo"]);
});
test("boardActionMissing: blank fecha → listed", () => {
  assert.deepEqual(boardActionMissing(fields, { ...full, fecha: "" }), ["fecha"]);
});
test("boardActionMissing: blank hora → listed", () => {
  assert.deepEqual(boardActionMissing(fields, { ...full, hora: "" }), ["hora"]);
});
test("boardActionMissing: absent enfermeraId → listed", () => {
  const rest: Record<string, string> = { ...full };
  delete rest.enfermeraId;
  assert.deepEqual(boardActionMissing(fields, rest), ["enfermeraId"]);
});
test("boardActionMissing: empty form → all, in the transition's order", () => {
  assert.deepEqual(boardActionMissing(fields, {}), fields);
});
test("boardActionMissing: all present → []", () => {
  assert.deepEqual(boardActionMissing(fields, full), []);
});
test("boardActionMissing: confirm-only transition (no fields) → []", () => {
  assert.deepEqual(boardActionMissing([], {}), []);
});
