import { test } from "node:test";
import assert from "node:assert/strict";

import { holdsPermission, permissionAliases } from "./permission-aliases.ts";

test("an old key and its new key are the same permission, both ways", () => {
  assert.deepEqual(new Set(permissionAliases("factura.read")), new Set(["factura.read", "invoice.read"]));
  assert.deepEqual(new Set(permissionAliases("invoice.read")), new Set(["invoice.read", "factura.read"]));
});

test("a merged key is held by whoever holds the key it went into, and the other way round", () => {
  assert.equal(holdsPermission(["billing.update"], "cash.write"), true);
  assert.equal(holdsPermission(["cash.write"], "billing.update"), true);
  assert.equal(holdsPermission(["caja.update"], "cash.write"), true);
});

test("works with today's BE (old keys) and with the next one (new keys)", () => {
  assert.equal(holdsPermission(["factura.read"], "invoice.read"), true);
  assert.equal(holdsPermission(["invoice.read"], "factura.read"), true);
  assert.equal(holdsPermission(["invoice.read"], "invoice.void"), false);
});

test("the wildcard holds everything; an empty list holds nothing", () => {
  assert.equal(holdsPermission(["*"], "anything.at_all"), true);
  assert.equal(holdsPermission([], "invoice.read"), false);
});

test("still matches across casing and separators (normalizarPermiso)", () => {
  assert.equal(holdsPermission(["pacientes.prioridad_flags.write"], "pacientes.prioridadFlags.write"), true);
  assert.equal(holdsPermission(["patients.priority_flags.write"], "pacientes.prioridadFlags.write"), true);
});
