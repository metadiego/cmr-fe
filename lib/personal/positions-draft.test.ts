// lib/personal/positions-draft.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { draftOnLoad, draftOnSave, isDraftDirty, withoutPermissionPositions } from "./positions-draft.ts";
import type { Position, StaffPositions } from "../api/positions.ts";

const pos = (slug: string, permissions: number, fullAccess = false): Position => ({
  id: `id-${slug}`, slug, name: slug, labelKey: null, allCenters: fullAccess, permissions, fullAccess,
});
const CATALOG = [pos("admin", 999, true), pos("manager", 40), pos("doctor", 0), pos("nurse", 0)];
const CENTERS = ["BAY", "CAG"];
const held = (positions: StaffPositions["positions"], primary: string | null = null): StaffPositions => ({ primary, positions });
const A = held([{ position: "doctor", labelKey: null, permissions: 0, centerIds: ["BAY"] }], "doctor");
const B = held([
  { position: "doctor", labelKey: null, permissions: 0, centerIds: ["BAY"] },
  { position: "nurse", labelKey: null, permissions: 0, centerIds: ["CAG"] },
], "doctor");

test("draftOnLoad seeds once per loaded object and keeps the draft when the same object comes back", () => {
  const d = draftOnLoad(null, A, CATALOG, CENTERS);
  assert.deepEqual(d.grid.byCenter, { BAY: ["doctor"] });
  assert.equal(draftOnLoad(d, A, CATALOG, CENTERS), d);
});

test("after a save, re-rendering with the pre-save load does not bring the old positions back", () => {
  const loaded = draftOnLoad(null, A, CATALOG, CENTERS);
  const saved = draftOnSave(loaded, B, CATALOG, CENTERS);
  const rerender = draftOnLoad(saved, A, CATALOG, CENTERS); // heldRes still holds A
  assert.deepEqual(rerender.grid.byCenter, { BAY: ["doctor"], CAG: ["nurse"] });
  assert.equal(isDraftDirty(rerender, CATALOG), false);
});

test("a new load (another object) replaces the draft", () => {
  const d = draftOnSave(draftOnLoad(null, A, CATALOG, CENTERS), B, CATALOG, CENTERS);
  const fresh = held([{ position: "nurse", labelKey: null, permissions: 0, centerIds: ["BAY"] }]);
  assert.deepEqual(draftOnLoad(d, fresh, CATALOG, CENTERS).grid.byCenter, { BAY: ["nurse"] });
});

test("null load (a new person) gives an empty draft", () => {
  const d = draftOnLoad(null, null, CATALOG, CENTERS);
  assert.deepEqual(d.grid, { admin: false, byCenter: {} });
  assert.equal(draftOnLoad(d, null, CATALOG, CENTERS), d);
});

test("isDraftDirty: an edit to the grid or the primary is dirty", () => {
  const d = draftOnLoad(null, B, CATALOG, CENTERS);
  assert.equal(isDraftDirty({ ...d, grid: { admin: false, byCenter: { BAY: ["doctor"] } } }, CATALOG), true);
  assert.equal(isDraftDirty({ ...d, primary: "nurse" }, CATALOG), true);
});

test("withoutPermissionPositions drops what cmr-be drops when a record gets a login", () => {
  const h = held([
    { position: "admin", labelKey: null, permissions: 999, centerIds: null },
    { position: "manager", labelKey: null, permissions: 40, centerIds: ["BAY"] },
    { position: "doctor", labelKey: null, permissions: 0, centerIds: ["BAY"] },
  ], "manager");
  assert.deepEqual(withoutPermissionPositions(h).positions.map((p) => p.position), ["doctor"]);
  const d = draftOnLoad(null, withoutPermissionPositions(h), CATALOG, CENTERS);
  assert.deepEqual(d.grid, { admin: false, byCenter: { BAY: ["doctor"] } });
  assert.equal(d.primary, "doctor");
});
