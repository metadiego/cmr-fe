// lib/personal/access-roles.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { RETIRED_ACCESS_ROLES, accessRoleCatalog, hiddenHeldPositions, primaryIsHidden, withHiddenPositions } from "./access-roles.ts";
import type { Position, StaffPositionsBody } from "../api/positions.ts";

const pos = (slug: string, permissions: number, fullAccess = false): Position => ({
  id: `id-${slug}`, slug, name: slug, labelKey: null, allCenters: fullAccess, permissions, fullAccess,
});
const catalog = [
  pos("admin", 99, true), pos("manager", 40), pos("clinical", 0), pos("technician", 0), pos("doctor", 0),
  pos("read_only", 3), pos("facturacion-inventario", 8),
];
const functionSlugs = ["doctor", "technician", "nurse", "front_desk"];
const RETIRED = ["read_only", "facturacion-inventario"];
const heldOf = (primary: string | null, slugs: string[]) => ({
  primary,
  positions: slugs.map((s) => ({ position: s, labelKey: null, permissions: 0, centerIds: ["bay"] })),
});

test("access roles: no job positions (0 permissions and a function of the same slug); clinical stays", () => {
  const slugs = accessRoleCatalog(catalog, functionSlugs, RETIRED, []).map((p) => p.slug);
  assert.deepEqual(slugs, ["admin", "manager", "clinical"]);
});

test("retired roles only show while the person still holds them", () => {
  const slugs = accessRoleCatalog(catalog, functionSlugs, RETIRED, ["read_only"]).map((p) => p.slug);
  assert.deepEqual(slugs, ["admin", "manager", "clinical", "read_only"]);
});

test("a job position with permissions is an access role, not hidden", () => {
  const c = [pos("doctor", 5)];
  assert.deepEqual(accessRoleCatalog(c, functionSlugs, RETIRED, []).map((p) => p.slug), ["doctor"]);
});

test("hidden held positions are re-sent untouched in the complete-list body", () => {
  const held = {
    primary: "technician",
    positions: [
      { position: "technician", labelKey: null, permissions: 0, centerIds: ["bay", "cag"] },
      { position: "manager", labelKey: null, permissions: 40, centerIds: ["bay"] },
    ],
  };
  const shown = accessRoleCatalog(catalog, functionSlugs, RETIRED, []);
  const hidden = hiddenHeldPositions(held, shown);
  assert.deepEqual(hidden, [{ position: "technician", centerIds: ["bay", "cag"] }]);
  const body: StaffPositionsBody = { positions: [{ position: "manager", centerIds: ["cag"] }], primary: "manager" };
  assert.deepEqual(withHiddenPositions(body, hidden), {
    positions: [{ position: "manager", centerIds: ["cag"] }, { position: "technician", centerIds: ["bay", "cag"] }],
    primary: "manager",
  });
});

test("a hidden primary survives when no shown role is held", () => {
  const hidden = [{ position: "technician", centerIds: ["bay"] }];
  assert.deepEqual(withHiddenPositions({ positions: [] }, hidden, "technician"), {
    positions: [{ position: "technician", centerIds: ["bay"] }],
    primary: "technician",
  });
});

test("a hidden job-position primary wins over the picker's primary while still held", () => {
  const hidden = [{ position: "technician", centerIds: ["bay"] }];
  const body: StaffPositionsBody = { positions: [{ position: "clinical", centerIds: ["bay"] }], primary: "clinical" };
  assert.equal(withHiddenPositions(body, hidden, "technician").primary, "technician");
  assert.equal(withHiddenPositions(body, [], "technician").primary, "clinical");
});

test("primaryIsHidden: only when the primary is held and not shown", () => {
  const shown = accessRoleCatalog(catalog, functionSlugs, RETIRED, []);
  assert.equal(primaryIsHidden(heldOf("technician", ["technician", "clinical"]), shown), true);
  assert.equal(primaryIsHidden(heldOf("clinical", ["technician", "clinical"]), shown), false);
  assert.equal(primaryIsHidden(heldOf(null, ["technician"]), shown), false);
});

test("retired roles (owner, 28-nov): Otro and the nursing roles merged into Clínico are no longer offered", () => {
  for (const slug of ["other", "nursing", "nursing_panel", "read_only", "facturacion-inventario"]) {
    assert.ok((RETIRED_ACCESS_ROLES as readonly string[]).includes(slug), slug);
  }
  assert.ok(!(RETIRED_ACCESS_ROLES as readonly string[]).includes("clinical"));
});
