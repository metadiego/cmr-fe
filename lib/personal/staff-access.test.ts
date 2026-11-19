import { test } from "node:test";
import assert from "node:assert/strict";

import { accessOf, countByAccess, filterByAccess } from "./staff-access.ts";

const people = [
  { id: "a", profileId: "pa" },
  { id: "b", profileId: "pb" },
  { id: "c", profileId: null },
  { id: "d", profileId: "pd" },
];
const profiles = new Map([
  ["pa", { status: "aprobado" }],
  ["pb", { status: "suspendido" }],
  ["pd", { status: "pendiente" }],
]);

test("accessOf: no login, or the login's status", () => {
  assert.equal(accessOf(people[0], profiles), "active");
  assert.equal(accessOf(people[1], profiles), "suspended");
  assert.equal(accessOf(people[2], profiles), "none");
  assert.equal(accessOf(people[3], profiles), "pending");
});

test("accessOf without the profiles (not an admin): a login counts as active", () => {
  assert.equal(accessOf(people[1]), "active");
});

test("filterByAccess: with access includes suspended and pending logins", () => {
  assert.deepEqual(filterByAccess(people, "withAccess", profiles).map((p) => p.id), ["a", "b", "d"]);
  assert.deepEqual(filterByAccess(people, "noAccess", profiles).map((p) => p.id), ["c"]);
  assert.deepEqual(filterByAccess(people, "suspended", profiles).map((p) => p.id), ["b"]);
  assert.equal(filterByAccess(people, "all", profiles).length, 4);
});

test("countByAccess counts every filter", () => {
  assert.deepEqual(countByAccess(people, profiles), { all: 4, withAccess: 3, noAccess: 1, suspended: 1 });
  assert.deepEqual(countByAccess(people), { all: 4, withAccess: 3, noAccess: 1, suspended: 0 });
});
