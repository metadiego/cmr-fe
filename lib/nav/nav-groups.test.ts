import { test } from "node:test";
import assert from "node:assert/strict";

import { buildNavGroups, type NavMenuItem } from "./nav-groups.ts";

// The nav rail is driven by the BE menu (`GET /me/menu`, hooks/use-menu.ts →
// lib/api/menu.ts MenuItem). buildNavGroups reproduces the CURRENT shell's
// domain-group construction (components/site-header.tsx): a flat, permission-
// aware list of items is nested by `parentClave`, and only the group ROOTS
// (`tipo === "grupo"` OR a `g-` clave) that still have visible children are
// kept. An item is visible when it has no `permisoClave` OR `can(permisoClave)`.

test("hides items whose permiso the user lacks (empty group is dropped)", () => {
  const items: NavMenuItem[] = [
    { clave: "g-fac", labelKey: "nav.g_fac", tipo: "grupo", path: "#" },
    { clave: "fac-a", labelKey: "nav.a", path: "/facturacion/a", parentClave: "g-fac" },
    {
      clave: "fac-b",
      labelKey: "nav.b",
      path: "/facturacion/b",
      parentClave: "g-fac",
      permisoClave: "facturacion.b",
    },
  ];
  const groups = buildNavGroups(items, (p) => p !== "facturacion.b");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].clave, "g-fac");
  assert.deepEqual(
    groups[0].children.map((c) => c.path),
    ["/facturacion/a"],
  );
});

test("keeps items with no permiso requirement even when can() always denies", () => {
  const items: NavMenuItem[] = [
    { clave: "g-inv", labelKey: "nav.g_inv", tipo: "grupo", path: "#" },
    { clave: "inv-a", labelKey: "nav.a", path: "/inventario/a", parentClave: "g-inv" },
  ];
  const groups = buildNavGroups(items, () => false);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].children.map((c) => c.path),
    ["/inventario/a"],
  );
});

test("drops group roots that have no visible children", () => {
  const items: NavMenuItem[] = [
    { clave: "g-empty", labelKey: "nav.g_empty", tipo: "grupo", path: "#" },
    {
      clave: "child",
      labelKey: "nav.c",
      path: "/x",
      parentClave: "g-empty",
      permisoClave: "x.read",
    },
  ];
  const groups = buildNavGroups(items, () => false);
  assert.equal(groups.length, 0);
});

test("recognises group roots by tipo 'grupo' OR a 'g-' clave prefix", () => {
  const items: NavMenuItem[] = [
    // Legacy: no tipo, but the g- prefix marks it as a group.
    { clave: "g-legacy", labelKey: "nav.legacy", path: "#" },
    { clave: "leg-a", labelKey: "nav.a", path: "/legacy/a", parentClave: "g-legacy" },
    // A plain top-level item (not a group root) must NOT appear as a group.
    { clave: "solo", labelKey: "nav.solo", tipo: "item", path: "/solo" },
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(
    groups.map((g) => g.clave),
    ["g-legacy"],
  );
});

test("nests children by parentClave, preserving arrival order", () => {
  const items: NavMenuItem[] = [
    { clave: "g-a", labelKey: "nav.g_a", tipo: "grupo", path: "#" },
    { clave: "a1", labelKey: "nav.a1", path: "/a/1", parentClave: "g-a" },
    { clave: "a-sub", labelKey: "nav.a_sub", tipo: "grupo", path: "#", parentClave: "g-a" },
    { clave: "a2", labelKey: "nav.a2", path: "/a/2", parentClave: "a-sub" },
  ];
  const groups = buildNavGroups(items, () => true);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].children.map((c) => c.clave),
    ["a1", "a-sub"],
  );
  const sub = groups[0].children.find((c) => c.clave === "a-sub")!;
  assert.deepEqual(
    sub.children.map((c) => c.path),
    ["/a/2"],
  );
});
