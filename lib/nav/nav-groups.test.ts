import { test } from "node:test";
import assert from "node:assert/strict";

import { buildNavGroups, type NavMenuItem } from "./nav-groups.ts";

// Phase 2: buildNavGroups groups by the FE manifest (lib/nav/manifest.ts),
// NOT by BE parentClave. It keeps the permission filter, drops BE group headers
// + separators + loose roots (home/dashboard), and drops empty groups.

test("groups destinations by their manifest group, in NAV_GROUPS order", () => {
  const items: NavMenuItem[] = [
    // arrive out of order + across BE parents; the FE manifest decides grouping/order
    { clave: "precios", labelKey: "nav.precios", path: "/x", parentClave: "g-facturacion" },
    { clave: "facturacion", labelKey: "nav.facturacion", path: "/x", parentClave: "g-facturacion" },
    { clave: "citas", labelKey: "nav.citas", path: "/x", parentClave: "g-agenda" },
  ];
  const groups = buildNavGroups(items, () => true);
  // scheduling before billing before inventory (NAV_GROUPS order); precios lands in inventory
  assert.deepEqual(groups.map((g) => g.clave), ["scheduling", "billing", "inventory"]);
  assert.deepEqual(
    groups.find((g) => g.clave === "inventory")!.children.map((c) => c.clave),
    ["precios"],
  );
});

test("orders items within a group by manifest order", () => {
  const items: NavMenuItem[] = [
    { clave: "consultas", labelKey: "n", path: "/x", parentClave: "g-facturacion" }, // billing order 2
    { clave: "facturacion", labelKey: "n", path: "/x", parentClave: "g-facturacion" }, // billing order 1
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(groups[0].children.map((c) => c.clave), ["facturacion", "consultas"]);
});

test("permission filter still applies (empty group dropped)", () => {
  const items: NavMenuItem[] = [
    { clave: "facturacion", labelKey: "n", path: "/x", parentClave: "g-facturacion", permisoClave: "factura.read" },
  ];
  assert.equal(buildNavGroups(items, () => false).length, 0);
});

test("drops BE group-header rows and separators", () => {
  const items: NavMenuItem[] = [
    { clave: "g-facturacion", labelKey: "n", tipo: "grupo", path: "#" },
    { clave: "facturacion", labelKey: "n", path: "/x", parentClave: "g-facturacion" },
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(groups.map((g) => g.clave), ["billing"]);
});

test("does not surface home/dashboard as domain leaves", () => {
  const items: NavMenuItem[] = [
    { clave: "home", labelKey: "nav.home", path: "/" },
    { clave: "dashboard", labelKey: "nav.dashboard", path: "/dashboard" },
    { clave: "facturacion", labelKey: "n", path: "/x", parentClave: "g-facturacion" },
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(groups.map((g) => g.clave), ["billing"]);
  assert.deepEqual(groups[0].children.map((c) => c.clave), ["facturacion"]);
});

test("unknown clave falls back to a BE-parent group (nothing lost)", () => {
  const items: NavMenuItem[] = [
    { clave: "g-monitoreo", labelKey: "nav.grupo.monitoreo", tipo: "grupo", path: "#" },
    { clave: "operaciones", labelKey: "nav.operaciones", path: "/boards/operaciones", parentClave: "g-monitoreo" },
  ];
  const groups = buildNavGroups(items, () => true);
  // one fallback group, keyed by the BE parent, carrying the unknown board
  assert.equal(groups.length, 1);
  assert.equal(groups[0].clave, "g-monitoreo");
  assert.deepEqual(groups[0].children.map((c) => c.clave), ["operaciones"]);
});
