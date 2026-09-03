import { test } from "node:test";
import assert from "node:assert/strict";

import { buildNavGroups, type NavMenuItem } from "./nav-groups.ts";

// Phase 2: buildNavGroups groups by the FE manifest (lib/nav/manifest.ts),
// NOT by BE parentSlug. It keeps the permission filter, drops BE group headers
// + separators + loose roots (home/dashboard), and drops empty groups.

test("groups destinations by their manifest group, in NAV_GROUPS order", () => {
  const items: NavMenuItem[] = [
    // arrive out of order + across BE parents; the FE manifest decides grouping/order
    { slug: "precios", labelKey: "nav.precios", path: "/x", parentSlug: "g-facturacion" },
    { slug: "facturacion", labelKey: "nav.facturacion", path: "/x", parentSlug: "g-facturacion" },
    { slug: "citas", labelKey: "nav.citas", path: "/x", parentSlug: "g-agenda" },
  ];
  const groups = buildNavGroups(items, () => true);
  // scheduling before billing before inventory (NAV_GROUPS order); precios lands in inventory
  assert.deepEqual(groups.map((g) => g.slug), ["scheduling", "billing", "inventory"]);
  assert.deepEqual(
    groups.find((g) => g.slug === "inventory")!.children.map((c) => c.slug),
    ["precios"],
  );
});

test("orders items within a group by manifest order", () => {
  const items: NavMenuItem[] = [
    { slug: "consultas", labelKey: "n", path: "/x", parentSlug: "g-facturacion" }, // billing order 2
    { slug: "facturacion", labelKey: "n", path: "/x", parentSlug: "g-facturacion" }, // billing order 1
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(groups[0].children.map((c) => c.slug), ["facturacion", "consultas"]);
});

test("permission filter still applies (empty group dropped)", () => {
  const items: NavMenuItem[] = [
    { slug: "facturacion", labelKey: "n", path: "/x", parentSlug: "g-facturacion", permissionSlug: "factura.read" },
  ];
  assert.equal(buildNavGroups(items, () => false).length, 0);
});

test("drops BE group-header rows and separators", () => {
  const items: NavMenuItem[] = [
    { slug: "g-facturacion", labelKey: "n", type: "grupo", path: "#" },
    { slug: "facturacion", labelKey: "n", path: "/x", parentSlug: "g-facturacion" },
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(groups.map((g) => g.slug), ["billing"]);
});

test("does not surface home/dashboard as domain leaves", () => {
  const items: NavMenuItem[] = [
    { slug: "home", labelKey: "nav.home", path: "/" },
    { slug: "dashboard", labelKey: "nav.dashboard", path: "/dashboard" },
    { slug: "facturacion", labelKey: "n", path: "/x", parentSlug: "g-facturacion" },
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(groups.map((g) => g.slug), ["billing"]);
  assert.deepEqual(groups[0].children.map((c) => c.slug), ["facturacion"]);
});

test("unknown clave falls back to a BE-parent group (nothing lost)", () => {
  const items: NavMenuItem[] = [
    { slug: "g-monitoreo", labelKey: "nav.grupo.monitoreo", type: "grupo", path: "#" },
    { slug: "operaciones", labelKey: "nav.operaciones", path: "/boards/operaciones", parentSlug: "g-monitoreo" },
  ];
  const groups = buildNavGroups(items, () => true);
  // one fallback group, keyed by the BE parent, carrying the unknown board
  assert.equal(groups.length, 1);
  assert.equal(groups[0].slug, "g-monitoreo");
  assert.deepEqual(groups[0].children.map((c) => c.slug), ["operaciones"]);
});
