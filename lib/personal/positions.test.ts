// lib/personal/positions.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPositionsBody,
  centersOf,
  chipState,
  effectivePrimary,
  gridFromStaff,
  positionLabel,
  sameGrid,
  togglePosition,
  type PositionGrid,
  type Translator,
} from "./positions.ts";
import type { Position } from "../api/positions.ts";

const pos = (slug: string, permissions: number, fullAccess = false): Position => ({
  id: `id-${slug}`, slug, name: slug.toUpperCase(), labelKey: `positions.${slug}`, allCenters: fullAccess, permissions, fullAccess,
});
const ADMIN = pos("admin", 999, true);
const MANAGER = pos("manager", 40);
const DOCTOR = pos("doctor", 0);
const NURSE = pos("nurse", 0);
const CATALOG = [ADMIN, MANAGER, DOCTOR, NURSE];

function fakeT(messages: Record<string, string>): Translator {
  const t = ((key: string) => messages[key] ?? key) as Translator;
  t.has = (key: string) => key in messages;
  return t;
}

const empty: PositionGrid = { admin: false, byCenter: {} };
const base = { position: DOCTOR, centerId: "BAY", grid: empty, viewerIsAdmin: false, hasLogin: false, canEditCenter: true };

test("positionLabel: positions key, then cargo key, then name, then slug", () => {
  const t = fakeT({ "positions.manager": "Gerente", "personal.cargo.medico": "Médico" });
  assert.equal(positionLabel("manager", t), "Gerente");
  assert.equal(positionLabel("medico", t), "Médico");
  assert.equal(positionLabel("new_one", t, "Nuevo"), "Nuevo");
  assert.equal(positionLabel("new_one", t), "new_one");
});

test("gridFromStaff: admin becomes the switch; centerIds null on a normal position spreads to every center", () => {
  const g = gridFromStaff({ primary: "doctor", positions: [
    { position: "admin", labelKey: null, permissions: 999, centerIds: null },
    { position: "doctor", labelKey: null, permissions: 0, centerIds: ["BAY"] },
    { position: "nurse", labelKey: null, permissions: 0, centerIds: null },
  ] }, CATALOG, ["BAY", "CAG"]);
  assert.deepEqual(g, { admin: true, byCenter: { BAY: ["doctor", "nurse"], CAG: ["nurse"] } });
});

test("gridFromStaff: a center outside the given list is kept, so saving never drops it", () => {
  const g = gridFromStaff({ primary: null, positions: [
    { position: "doctor", labelKey: null, permissions: 0, centerIds: ["OTHER"] },
  ] }, CATALOG, ["BAY"]);
  assert.deepEqual(g.byCenter, { OTHER: ["doctor"] });
});

test("togglePosition adds and removes, keeping lists sorted and dropping empty centers", () => {
  let g = togglePosition(empty, "BAY", "nurse");
  g = togglePosition(g, "BAY", "doctor");
  assert.deepEqual(g.byCenter, { BAY: ["doctor", "nurse"] });
  g = togglePosition(togglePosition(g, "BAY", "doctor"), "BAY", "nurse");
  assert.deepEqual(g.byCenter, {});
});

test("centersOf: the centers with at least one position, sorted", () => {
  assert.deepEqual(centersOf({ admin: false, byCenter: { CAG: ["nurse"], BAY: ["doctor"] } }), ["BAY", "CAG"]);
});

test("buildPositionsBody: one entry per position with its centers; admin without centerIds", () => {
  const body = buildPositionsBody({ admin: true, byCenter: { BAY: ["doctor", "manager"], CAG: ["manager"] } }, "manager", CATALOG);
  assert.deepEqual(body, { positions: [
    { position: "admin" },
    { position: "doctor", centerIds: ["BAY"] },
    { position: "manager", centerIds: ["BAY", "CAG"] },
  ], primary: "manager" });
});

test("buildPositionsBody: a primary no longer held falls to the first held, or is omitted", () => {
  assert.equal(buildPositionsBody({ admin: false, byCenter: { BAY: ["nurse"] } }, "doctor", CATALOG).primary, "nurse");
  assert.equal("primary" in buildPositionsBody(empty, "doctor", CATALOG), false);
});

test("effectivePrimary: kept while held; admin counts as held", () => {
  assert.equal(effectivePrimary("doctor", { admin: false, byCenter: { BAY: ["doctor"] } }, CATALOG), "doctor");
  assert.equal(effectivePrimary("admin", { admin: true, byCenter: {} }, CATALOG), "admin");
  assert.equal(effectivePrimary(null, { admin: false, byCenter: { BAY: ["nurse"] } }, CATALOG), "nurse");
  assert.equal(effectivePrimary("admin", empty, CATALOG), null);
});

test("sameGrid compares content, not identity", () => {
  assert.equal(sameGrid({ admin: false, byCenter: { BAY: ["doctor"] } }, { admin: false, byCenter: { BAY: ["doctor"] } }), true);
  assert.equal(sameGrid({ admin: true, byCenter: {} }, empty), false);
  assert.equal(sameGrid({ admin: false, byCenter: { BAY: ["doctor"] } }, { admin: false, byCenter: { CAG: ["doctor"] } }), false);
});

test("chipState: a position with permissions is admin-only", () => {
  assert.equal(chipState({ ...base, position: MANAGER, viewerIsAdmin: false }), "carriesPermissions");
  assert.equal(chipState({ ...base, position: MANAGER, viewerIsAdmin: true }), null);
});

test("chipState: with a login, a non-admin cannot add the first or remove the last position of a center", () => {
  const grid = { admin: false, byCenter: { BAY: ["doctor"] } };
  assert.equal(chipState({ ...base, grid, hasLogin: true, centerId: "BAY", position: DOCTOR }), "loginCenterNeedsAdmin");
  assert.equal(chipState({ ...base, grid, hasLogin: true, centerId: "CAG", position: DOCTOR }), "loginCenterNeedsAdmin");
  assert.equal(chipState({ ...base, grid, hasLogin: true, centerId: "BAY", position: NURSE }), null);
  assert.equal(chipState({ ...base, grid, hasLogin: false, centerId: "CAG", position: DOCTOR }), null);
  assert.equal(chipState({ ...base, grid, hasLogin: true, centerId: "CAG", position: DOCTOR, viewerIsAdmin: true }), null);
});

test("chipState: a center without staff.update is read-only, even for an admin", () => {
  assert.equal(chipState({ ...base, canEditCenter: false, viewerIsAdmin: true }), "noCenterAccess");
});
