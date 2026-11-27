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

test("menuItemForPath: the longest menu path the URL starts with, on a segment boundary", () => {
  assert.equal(menuItemForPath(MENU, "/inventory/stock/123")?.slug, "stock");
  assert.equal(menuItemForPath(MENU, "/inventory/adjustments")?.slug, "inventory");
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
