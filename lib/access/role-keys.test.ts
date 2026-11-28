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
  assert.equal(roleKey("enfermeria"), "clinical");
  assert.equal(roleKey("nursing"), "clinical");
  assert.equal(roleKey("nursing_panel"), "clinical");
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

test("isAdmin: only the isAdmin flag the API sends counts (cmr-be #557 is live)", () => {
  assert.equal(isAdmin({ isAdmin: true }), true);
  assert.equal(isAdmin({ isAdmin: false }), false, "a center-scoped admin role is not full access");
  assert.equal(isAdmin(null), false);
});

test("isAdmin: the pre-#557 signals (master, admin access mode, admin role) no longer count alone", () => {
  assert.equal(isAdmin({ isMaster: true } as { isAdmin?: boolean }), false);
  assert.equal(isAdmin({ accessMode: "admin" } as { isAdmin?: boolean }), false);
  assert.equal(isAdmin({ roles: ["admin"] } as { isAdmin?: boolean }), false);
  assert.equal(isAdmin({}), false, "no flag, no full access");
});

test("the admin role is fixed and '*' is never offered", () => {
  assert.equal(isAdminRole({ slug: "admin" }), true);
  assert.equal(isAdminRole({ slug: "manager" }), false);
  assert.equal(isAdminRole(null), false);
  assert.equal(isAssignablePermission("*"), false);
  assert.equal(isAssignablePermission("profiles.read"), true);
});
