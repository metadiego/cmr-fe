// lib/nav/screen-access.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { menuItemForPath, needsOtherCenter } from "./screen-access.ts";

const item = (slug: string, path: string, permissionSlug: string | null = null) => ({
  id: slug, slug, labelKey: `nav.${slug}`, path, permissionSlug, visible: true, sortOrder: 0,
});
const MENU = [
  item("home", "/dashboard"),
  item("inventory", "/inventory", "inventory.read"),
  item("stock", "/inventory/stock", "stock.read"),
  item("group", "#"),
];

test("menuItemForPath: the longest menu route the URL is, or holds a record of", () => {
  assert.equal(menuItemForPath(MENU, "/inventory/stock/123")?.slug, "stock");
  // A sub-page that is not a record may need another permission: not judged by the parent's.
  assert.equal(menuItemForPath(MENU, "/inventory/adjustments"), null);
  assert.equal(menuItemForPath(MENU, "/inventory")?.slug, "inventory");
  assert.equal(menuItemForPath(MENU, "/inventoryx"), null);
  assert.equal(menuItemForPath(MENU, "/patients"), null);
});

test("needsOtherCenter: only a screen with a permission the active center lacks", () => {
  const stock = MENU[2];
  assert.equal(needsOtherCenter(stock, ["stock.read"]), false);
  assert.equal(needsOtherCenter(stock, ["*"]), false);
  assert.equal(needsOtherCenter(stock, ["inventory.read"]), true);
  assert.equal(needsOtherCenter(MENU[0], []), false);
  assert.equal(needsOtherCenter(null, []), false);
});

// Real rows as GET /me/menu sends them (cmr-be src/scripts/menu-items.ts): Spanish BE paths, mapped to
// FE routes by the same routeForClave the sidebar uses (review of 26-nov: matching the BE path missed
// almost every screen).
const REAL = [
  item("home", "/"),
  item("facturacion", "/facturacion", "invoice.read"),
  item("clientes", "/clientes", "patients.read"),
  item("citas", "/citas", "appointments.read"),
];

test("menuItemForPath maps BE rows to FE routes like the sidebar", () => {
  assert.equal(menuItemForPath(REAL, "/billing/invoices")?.slug, "facturacion");
  assert.equal(menuItemForPath(REAL, "/patients")?.slug, "clientes");
  assert.equal(menuItemForPath(REAL, "/scheduling/appointments")?.slug, "citas");
  assert.equal(menuItemForPath(REAL, "/facturacion"), null);
});

test("menuItemForPath: a record under a screen counts; any other sub-page does not; never '/'", () => {
  assert.equal(menuItemForPath(REAL, "/billing/invoices/8f1c2a3b-0000-4000-8000-000000000001")?.slug, "facturacion");
  assert.equal(menuItemForPath(REAL, "/patients/12345/history")?.slug, "clientes");
  assert.equal(menuItemForPath(REAL, "/billing/invoices/settings"), null);
  assert.equal(menuItemForPath(REAL, "/configuration/preferences"), null);
});
