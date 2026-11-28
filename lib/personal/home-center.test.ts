// lib/personal/home-center.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { homeCenterChoice } from "./home-center.ts";

const centers = [
  { id: "bay", name: "Bayamón", active: true },
  { id: "cag", name: "Caguas", active: true },
  { id: "old", name: "Viejo", active: false },
];

test("editable when the viewer has staff.update at the current home; options = active centers they can edit + current", () => {
  const c = homeCenterChoice(centers, "bay", new Set(["bay", "cag", "old"]));
  assert.equal(c.blocked, null);
  assert.deepEqual(c.options.map((o) => o.id), ["bay", "cag"]);
});

test("blocked without staff.update at the current home", () => {
  const c = homeCenterChoice(centers, "bay", new Set(["cag"]));
  assert.equal(c.blocked, "noUpdateAtCurrent");
  assert.deepEqual(c.options.map((o) => o.id), ["bay"]);
});

test("blocked when there is no other center to move to", () => {
  assert.equal(homeCenterChoice(centers, "bay", new Set(["bay"])).blocked, "noOtherCenter");
});
