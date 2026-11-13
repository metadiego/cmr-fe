import { test } from "node:test";
import assert from "node:assert/strict";

import { hasRole, isAdmin, isAdminRole, isAssignablePermission, roleKey } from "./role-keys.ts";

test("roleKey maps every legacy key to its new key and leaves the rest alone", () => {
  assert.equal(roleKey("gerente"), "manager");
  assert.equal(roleKey("atencion"), "frontdesk");
  assert.equal(roleKey("recepcion"), "frontdesk");
  assert.equal(roleKey("citas"), "appointments");
  assert.equal(roleKey("cc_operator"), "appointments");
  assert.equal(roleKey("facturacion"), "billing");
  assert.equal(roleKey("facturador_consulta"), "billing");
  assert.equal(roleKey("enfermeria"), "nursing");
  assert.equal(roleKey("inventarios"), "inventory");
  assert.equal(roleKey("solo_lectura"), "read_only");
  assert.equal(roleKey("admin"), "admin");
  assert.equal(roleKey("manager"), "manager");
  assert.equal(roleKey("something_new"), "something_new");
});

test("hasRole matches old and new keys on either side", () => {
  assert.equal(hasRole(["gerente"], "manager"), true, "before the release");
  assert.equal(hasRole(["manager"], "gerente"), true, "after the release, old key asked");
  assert.equal(hasRole(["manager"], "manager"), true);
  assert.equal(hasRole(["billing"], "manager"), false);
  assert.equal(hasRole(undefined, "admin"), false);
});

test("isAdmin: isAdmin wins when the API sends it (after #557)", () => {
  assert.equal(isAdmin({ isAdmin: true, isMaster: false, roles: [] }), true);
  assert.equal(isAdmin({ isAdmin: false, isMaster: false, roles: ["admin"] }), false, "a center-scoped admin role is not full access");
});

test("isAdmin: before #557, master, admin access mode or the admin role", () => {
  assert.equal(isAdmin({ isMaster: true, roles: [] }), true);
  assert.equal(isAdmin({ isMaster: false, accessMode: "admin", roles: [] }), true);
  assert.equal(isAdmin({ isMaster: false, accessMode: "operativo", roles: ["admin"] }), true);
  assert.equal(isAdmin({ isMaster: false, accessMode: "gerencial", roles: ["gerente"] }), false);
  assert.equal(isAdmin(null), false);
});

test("the admin role is fixed and '*' is never offered", () => {
  assert.equal(isAdminRole({ slug: "admin" }), true);
  assert.equal(isAdminRole({ slug: "manager" }), false);
  assert.equal(isAdminRole(null), false);
  assert.equal(isAssignablePermission("*"), false);
  assert.equal(isAssignablePermission("profiles.read"), true);
});
