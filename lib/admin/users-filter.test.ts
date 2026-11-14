import { test } from "node:test";
import assert from "node:assert/strict";

import { countByStatus, filterUsers, userInitials } from "./users-filter.ts";

const users = [
  { email: "ana@cmr.test", name: "Ana", lastName: "Ruiz", status: "aprobado", roles: [{ name: "Facturación" }], centers: [{ name: "CMR Caguas" }] },
  { email: "luis@cmr.test", name: "Luis", lastName: null, status: "suspendido", roles: [], centers: [{ name: "CMR Bayamon" }] },
  { email: "eva@cmr.test", name: null, lastName: null, status: "pendiente" },
];

test("filterUsers searches email, name, role and center, ignoring case", () => {
  assert.deepEqual(filterUsers(users, "factur", "all").map((u) => u.email), ["ana@cmr.test"]);
  assert.deepEqual(filterUsers(users, "BAYAMON", "all").map((u) => u.email), ["luis@cmr.test"]);
  assert.equal(filterUsers(users, "  ", "all").length, 3);
});

test("filterUsers combines the search with the status", () => {
  assert.deepEqual(filterUsers(users, "", "suspendido").map((u) => u.email), ["luis@cmr.test"]);
  assert.equal(filterUsers(users, "ana", "suspendido").length, 0);
});

test("countByStatus counts every status and the total", () => {
  assert.deepEqual(countByStatus(users), { all: 3, aprobado: 1, pendiente: 1, suspendido: 1, rechazado: 0 });
});

test("userInitials uses the name, else the email", () => {
  assert.equal(userInitials(users[0]), "AR");
  assert.equal(userInitials(users[1]), "L");
  assert.equal(userInitials(users[2]), "EV");
});
