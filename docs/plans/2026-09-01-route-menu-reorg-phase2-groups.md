# Route + Menu Reorg — Phase 2: FE-owned menu groups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. One PR off `main`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the menu STRUCTURE FE-owned: group + order come from the manifest
(mirroring the route prefixes), not from BE `parentClave`/`orden`. After this,
`/<category>/X` appears under the `<category>` menu group.

**Architecture:** Extend `NavEntry` with `group` + `order`; add `NavGroupKey`
and `NAV_GROUPS` (9 groups, ordered) to `lib/nav/manifest.ts`. Rework
`buildNavGroups` to bucket visible destination items by their manifest `group`
(sorted by manifest `order`), emit groups in `NAV_GROUPS` order, and fall back
to the BE parent group for any item the manifest doesn't know (dynamic boards,
future items) so nothing is lost. Add 9 group label keys to `messages/{en,es}.json`.

**Tech Stack:** TypeScript, next-intl, `node:test`.

**Prereq:** Phase 1 merged (all routes English; manifest routes flipped).
**Master plan:** `docs/plans/2026-09-01-route-menu-reorg-00-master.md` (§2 taxonomy).

## Global Constraints

- Dev :8080. Build gate + `npm run typecheck` + `npm test` after each task.
- `NavGroupKey` (master §2): `scheduling | patients | services | billing | reports | inventory | communications | admin | configuration`.
- Permission filter (`can(permisoClave)`) and label resolution (`labelCustom ?? t(labelKey)`) semantics UNCHANGED.
- Do NOT change routes here (Phase 1 did). Do NOT change `clave`/`permisoClave`.
- Commit trailer `Co-Authored-By: Claude …`; branch off `main`; never merge to `main`.

---

### Task 1: Extend the manifest with groups + order

**Files:**
- Modify: `lib/nav/manifest.ts` (add `NavGroupKey`, `NAV_GROUPS`, `group`/`order` on `NavEntry`, `groupForClave`/`orderForClave` helpers)
- Test: `lib/nav/manifest.test.ts` (extend)

**Interfaces:**
- Consumes: existing `NAV_MANIFEST`, `routeForClave`.
- Produces:
  - `export type NavGroupKey = "scheduling" | "patients" | "services" | "billing" | "reports" | "inventory" | "communications" | "admin" | "configuration"`
  - `export type NavEntry = { clave: string; route: string; group: NavGroupKey; order: number }`
  - `export interface NavGroupDef { key: NavGroupKey; labelKey: string; order: number }`
  - `export const NAV_GROUPS: NavGroupDef[]`
  - `export function groupForClave(clave: string): NavGroupKey | undefined`
  - `export function orderForClave(clave: string): number` (returns `Number.MAX_SAFE_INTEGER` when unknown, so unknowns sort last)

- [ ] **Step 1: Write the failing test** — append to `lib/nav/manifest.test.ts`

```ts
import { NAV_GROUPS, groupForClave, orderForClave, type NavGroupKey } from "./manifest.ts";

test("every manifest entry declares a valid group", () => {
  const valid = new Set(NAV_GROUPS.map((g) => g.key));
  for (const e of NAV_MANIFEST) {
    assert.ok(valid.has(e.group), `${e.clave} has invalid group ${e.group}`);
  }
});

test("groupForClave / orderForClave resolve known claves", () => {
  assert.equal(groupForClave("facturacion"), "billing");
  assert.equal(groupForClave("inventario-existencias"), "inventory");
  assert.equal(groupForClave("personal"), "configuration"); // staff folded in (decision #5)
  assert.equal(groupForClave("admin"), "admin");            // top-level (decision #1)
  assert.equal(typeof orderForClave("facturacion"), "number");
});

test("unknown clave has no group and sorts last", () => {
  assert.equal(groupForClave("operaciones"), undefined);
  assert.equal(orderForClave("operaciones"), Number.MAX_SAFE_INTEGER);
});

test("NAV_GROUPS is the 9-group taxonomy in order", () => {
  assert.deepEqual(
    NAV_GROUPS.map((g) => g.key),
    ["scheduling", "patients", "services", "billing", "reports", "inventory", "communications", "admin", "configuration"],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `NAV_GROUPS`/`groupForClave` not exported.

- [ ] **Step 3: Implement** — edit `lib/nav/manifest.ts`

Add the group types + table (place above `NAV_MANIFEST`):

```ts
export type NavGroupKey =
  | "scheduling" | "patients" | "services" | "billing" | "reports"
  | "inventory" | "communications" | "admin" | "configuration";

export interface NavGroupDef {
  key: NavGroupKey;
  labelKey: string; // i18n key (messages/*.json)
  order: number;    // top-level display order
}

// The 9-group taxonomy (route prefix = menu group). Order = top-to-bottom in the rail.
export const NAV_GROUPS: NavGroupDef[] = [
  { key: "scheduling", labelKey: "nav.grupo.scheduling", order: 1 },
  { key: "patients", labelKey: "nav.grupo.patients", order: 2 },
  { key: "services", labelKey: "nav.grupo.services", order: 3 },
  { key: "billing", labelKey: "nav.grupo.billing", order: 4 },
  { key: "reports", labelKey: "nav.grupo.reports", order: 5 },
  { key: "inventory", labelKey: "nav.grupo.inventory", order: 6 },
  { key: "communications", labelKey: "nav.grupo.communications", order: 7 },
  { key: "admin", labelKey: "nav.grupo.admin", order: 8 },
  { key: "configuration", labelKey: "nav.grupo.configuration", order: 9 },
];
```

Change the `NavEntry` type + add `group`/`order` to EVERY entry:

```ts
export type NavEntry = {
  clave: string;
  route: string;
  group: NavGroupKey;
  order: number; // order WITHIN the group
};
```

Populate each `NAV_MANIFEST` row with `group` + `order` (grouped by taxonomy; order is 1-based within the group). Full table:

```ts
export const NAV_MANIFEST: NavEntry[] = [
  // scheduling
  { clave: "citas", route: "/scheduling/appointments", group: "scheduling", order: 1 },
  { clave: "cupos", route: "/scheduling/slots", group: "scheduling", order: 2 },
  { clave: "calendario", route: "/scheduling/calendar", group: "scheduling", order: 3 },
  { clave: "atencion", route: "/boards/atencion", group: "scheduling", order: 4 }, // board surfaced in scheduling
  // patients
  { clave: "clientes", route: "/patients", group: "patients", order: 1 },
  { clave: "cambio-de-protocolo", route: "/patients/protocol-change", group: "patients", order: 2 },
  // services (boards + nursing)
  { clave: "frontdesk", route: "/boards/frontdesk", group: "services", order: 1 },
  { clave: "servicios", route: "/boards/servicios", group: "services", order: 2 },
  { clave: "panel-enfermeria", route: "/services/nursing-panel", group: "services", order: 3 },
  // billing
  { clave: "facturacion", route: "/billing/invoices", group: "billing", order: 1 },
  { clave: "consultas", route: "/billing/consultations", group: "billing", order: 2 },
  { clave: "grupos-facturacion", route: "/billing/groups", group: "billing", order: 3 },
  { clave: "facturacion-devoluciones", route: "/billing/returns", group: "billing", order: 4 },
  { clave: "consultas-devoluciones", route: "/billing/consultations/returns", group: "billing", order: 5 },
  { clave: "caja-consulta", route: "/billing/cash/consultation", group: "billing", order: 6 },
  { clave: "caja-general", route: "/billing/cash/general", group: "billing", order: 7 },
  // reports
  { clave: "estadisticas-servicios", route: "/reports/services", group: "reports", order: 1 },
  { clave: "estadisticas-diarias", route: "/reports/daily", group: "reports", order: 2 },
  { clave: "consumo-insumos", route: "/reports/supply-consumption", group: "reports", order: 3 },
  { clave: "ventas-por-grupo", route: "/reports/sales-by-group", group: "reports", order: 4 },
  { clave: "ventas-por-usuario", route: "/reports/sales-by-user", group: "reports", order: 5 },
  // inventory
  { clave: "inventario-index", route: "/inventory", group: "inventory", order: 1 },
  { clave: "inventario-existencias", route: "/inventory/stock", group: "inventory", order: 2 },
  { clave: "inventario-productos", route: "/inventory/products", group: "inventory", order: 3 },
  { clave: "inventario-proveedores", route: "/inventory/suppliers", group: "inventory", order: 4 },
  { clave: "inventario-amp", route: "/inventory/supplier-presentations", group: "inventory", order: 5 },
  { clave: "inventario-recibir", route: "/inventory/receive-purchase", group: "inventory", order: 6 },
  { clave: "inventario-recetas", route: "/inventory/recipes", group: "inventory", order: 7 },
  { clave: "inventario-transferencias", route: "/inventory/transfers", group: "inventory", order: 8 },
  { clave: "inventario-viales", route: "/inventory/vials", group: "inventory", order: 9 },
  { clave: "precios", route: "/inventory/prices", group: "inventory", order: 10 },
  // communications
  { clave: "comunicaciones", route: "/communications", group: "communications", order: 1 },
  // admin (top-level, decision #1)
  { clave: "admin", route: "/admin", group: "admin", order: 1 },
  // configuration (+ staff, decision #5; + audit)
  { clave: "configuracion-tableros", route: "/configuration/boards", group: "configuration", order: 1 },
  { clave: "configuracion-modulos", route: "/configuration/board-modules", group: "configuration", order: 2 },
  { clave: "servicios-config", route: "/configuration/services", group: "configuration", order: 3 },
  { clave: "config-factura", route: "/configuration/invoice", group: "configuration", order: 4 },
  { clave: "config-requeridos", route: "/configuration/required-fields", group: "configuration", order: 5 },
  { clave: "config-datos-paciente", route: "/configuration/patient-fields", group: "configuration", order: 6 },
  { clave: "config-formatos", route: "/configuration/formats", group: "configuration", order: 7 },
  { clave: "configuracion-apariencia", route: "/configuration/appearance", group: "configuration", order: 8 },
  { clave: "auditoria", route: "/configuration/audit", group: "configuration", order: 9 },
  { clave: "personal", route: "/configuration/staff", group: "configuration", order: 10 },
  // loose roots (not shown as a domain group leaf; home/dashboard render elsewhere)
  { clave: "home", route: "/", group: "configuration", order: 99 },
  { clave: "dashboard", route: "/dashboard", group: "configuration", order: 98 },
];
```
> **Omitted claves:** `mis-tableros` (orphan, deleted in Phase 3), `caja` (bare,
> no FE page), `captacion-por-agente`, `ahora-mismo`, `operaciones` are
> intentionally NOT in the manifest. Until Phase 3 removes them from the BE
> seed, they resolve via the `routeForClave` fallback and appear under a
> BE-parent fallback group (Task 2) — not the 9 FE groups. This is expected and
> self-heals when the BE seed is tidied.

> `home`/`dashboard` keep a nominal group so the type is satisfied; they are not
> surfaced as domain-group leaves in practice (the sidebar renders the logo/home
> link separately, and `dashboard` is admin-dev-only). If they should be hidden
> from the grouped rail entirely, filter them in `buildNavGroups` (Task 2 note).

Add the helper functions (near `routeForClave`):

```ts
const GROUP_BY_CLAVE: Map<string, NavGroupKey> = new Map(
  NAV_MANIFEST.map((e) => [e.clave, e.group]),
);
const ORDER_BY_CLAVE: Map<string, number> = new Map(
  NAV_MANIFEST.map((e) => [e.clave, e.order]),
);

export function groupForClave(clave: string): NavGroupKey | undefined {
  return GROUP_BY_CLAVE.get(clave);
}

export function orderForClave(clave: string): number {
  return ORDER_BY_CLAVE.get(clave) ?? Number.MAX_SAFE_INTEGER;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (manifest tests + the new group tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/nav/manifest.ts lib/nav/manifest.test.ts
git commit -m "feat(nav): manifest owns group + order (9-group taxonomy) (Phase 2)

Extends NavEntry with group/order, adds NAV_GROUPS + groupForClave/orderForClave.
Not consumed yet (buildNavGroups rework is next).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rework `buildNavGroups` to group by the FE manifest

**Files:**
- Modify: `lib/nav/nav-groups.ts`
- Test: `lib/nav/nav-groups.test.ts` (rewrite for FE grouping)

**Interfaces:**
- Consumes: `NAV_GROUPS`, `groupForClave`, `orderForClave` from Task 1; `NavMenuItem`/`NavNode` (unchanged types).
- Produces: `buildNavGroups(items, can): NavNode[]` — same SIGNATURE and return shape (array of synthetic group-root `NavNode`s with `children` leaves), so `components/app-sidebar.tsx` needs NO change. Now groups by FE manifest instead of BE `parentClave`.

**Design:**
- Filter by permission (unchanged).
- Keep only real destinations (`tipo !== "grupo" && tipo !== "separador" && path !== "#"`). BE group-header rows are discarded — the FE owns headers now.
- Bucket each destination by `groupForClave(clave)`. Unknown claves (no manifest group) fall back to a synthetic bucket keyed by their BE `parentClave`, labeled from the BE parent row — so dynamic boards (`operaciones`) and future items still appear, under their BE group, appended after the 9 FE groups.
- Sort within each FE bucket by `orderForClave`; unknown-bucket items keep BE arrival order.
- Emit FE groups in `NAV_GROUPS` order (non-empty only), then any fallback buckets.

- [ ] **Step 1: Rewrite the test** — `lib/nav/nav-groups.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildNavGroups, type NavMenuItem } from "./nav-groups.ts";

// Phase 2: buildNavGroups groups by the FE manifest (lib/nav/manifest.ts),
// NOT by BE parentClave. It keeps the permission filter and drops empty groups.

test("groups destinations by their manifest group, in NAV_GROUPS order", () => {
  const items: NavMenuItem[] = [
    // arrive out of order + across BE parents; FE manifest decides grouping/order
    { clave: "precios", labelKey: "nav.precios", path: "/x", parentClave: "g-facturacion" },
    { clave: "facturacion", labelKey: "nav.facturacion", path: "/x", parentClave: "g-facturacion" },
    { clave: "citas", labelKey: "nav.citas", path: "/x", parentClave: "g-agenda" },
  ];
  const groups = buildNavGroups(items, () => true);
  // scheduling before billing before inventory (NAV_GROUPS order); precios lands in inventory
  assert.deepEqual(groups.map((g) => g.clave), ["scheduling", "billing", "inventory"]);
  assert.deepEqual(groups.find((g) => g.clave === "inventory")!.children.map((c) => c.clave), ["precios"]);
});

test("orders items within a group by manifest order", () => {
  const items: NavMenuItem[] = [
    { clave: "consultas", labelKey: "n", path: "/x", parentClave: "g-facturacion" }, // order 2
    { clave: "facturacion", labelKey: "n", path: "/x", parentClave: "g-facturacion" }, // order 1
  ];
  const groups = buildNavGroups(items, () => true);
  assert.deepEqual(groups[0].children.map((c) => c.clave), ["facturacion", "consultas"]);
});

test("permission filter still applies", () => {
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

test("unknown clave falls back to a BE-parent group (nothing lost)", () => {
  const items: NavMenuItem[] = [
    { clave: "g-monitoreo", labelKey: "nav.grupo.monitoreo", tipo: "grupo", path: "#" },
    { clave: "operaciones", labelKey: "nav.operaciones", path: "/boards/operaciones", parentClave: "g-monitoreo" },
  ];
  const groups = buildNavGroups(items, () => true);
  // one fallback group, keyed by the BE parent, carrying the unknown board
  assert.equal(groups.length, 1);
  assert.equal(groups[0].children.map((c) => c.clave).join(","), "operaciones");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (current buildNavGroups groups by parentClave / returns `g-*` roots).

- [ ] **Step 3: Implement** — replace the body of `lib/nav/nav-groups.ts` (keep the file header + `NavMenuTipo`/`NavMenuItem`/`NavNode` types; replace `isGroupRoot` + `buildNavGroups`)

```ts
import { NAV_GROUPS, groupForClave, orderForClave } from "./manifest.ts";

// ... keep NavMenuTipo, NavMenuItem, NavNode types above ...

// Build the nav rail's groups from the FE manifest (lib/nav/manifest.ts).
// Grouping/order are FE-OWNED: each visible destination is bucketed by its
// manifest group and sorted by its manifest order. BE group-header rows and
// separators are discarded (the FE owns headers). Items the manifest doesn't
// know (dynamic boards, future BE items) fall back to a synthetic group keyed
// by their BE parentClave so they are never dropped. Permission filter (belt-
// and-suspenders; BE already filtered) is preserved.
export function buildNavGroups(
  items: NavMenuItem[],
  can: (permiso: string) => boolean,
): NavNode[] {
  const visible = items.filter((i) => !i.permisoClave || can(i.permisoClave));

  // Real destinations only (drop group headers + separators + path-less rows).
  const destinations = visible.filter(
    (i) => i.tipo !== "grupo" && i.tipo !== "separador" && !!i.path && i.path !== "#",
  );

  // BE parent rows (for labeling fallback groups).
  const beParents = new Map<string, NavMenuItem>();
  for (const i of visible) {
    if (i.tipo === "grupo" || i.clave.startsWith("g-")) beParents.set(i.clave, i);
  }

  // Bucket by FE group; unknown → synthetic `be:<parentClave>` bucket.
  const buckets = new Map<string, NavNode[]>();
  const push = (key: string, node: NavNode) => {
    const arr = buckets.get(key);
    if (arr) arr.push(node);
    else buckets.set(key, [node]);
  };
  for (const i of destinations) {
    const feGroup = groupForClave(i.clave);
    const key = feGroup ?? (i.parentClave ? `be:${i.parentClave}` : "be:_orphan");
    push(key, { ...i, children: [] });
  }

  // Sort inside FE buckets by manifest order (unknown buckets keep arrival order).
  for (const [key, arr] of buckets) {
    if (!key.startsWith("be:")) {
      arr.sort((a, b) => orderForClave(a.clave) - orderForClave(b.clave));
    }
  }

  const groupRoot = (clave: string, labelKey: string, children: NavNode[]): NavNode => ({
    clave,
    labelKey,
    tipo: "grupo",
    path: "#",
    children,
  });

  const out: NavNode[] = [];
  // FE groups first, in taxonomy order, non-empty only.
  for (const g of NAV_GROUPS) {
    const children = buckets.get(g.key);
    if (children && children.length > 0) out.push(groupRoot(g.key, g.labelKey, children));
  }
  // Fallback BE-parent groups (dynamic boards, unknowns) appended after.
  for (const [key, children] of buckets) {
    if (!key.startsWith("be:") || children.length === 0) continue;
    const parentClave = key.slice("be:".length);
    const parent = beParents.get(parentClave);
    out.push(groupRoot(parentClave, parent?.labelKey ?? parentClave, children));
  }
  return out;
}
```
> The synthetic FE group root's `clave` is the `NavGroupKey` string and its
> `labelKey` is the group label key — `components/app-sidebar.tsx` already renders
> `labelOf(group)` (which does `t(labelKey)`), so no sidebar change is needed.
> Leaf links already resolve via `routeForClave(n.clave, n.path)` (Phase 0).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (rewritten nav-groups tests + manifest tests).

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck` → clean.
Run: build gate → all pages compile.

- [ ] **Step 6: Commit**

```bash
git add lib/nav/nav-groups.ts lib/nav/nav-groups.test.ts
git commit -m "feat(nav): buildNavGroups groups by FE manifest, not BE parentClave (Phase 2)

Destinations are bucketed by manifest group + order (9-group taxonomy) and
emitted in NAV_GROUPS order; BE group headers/separators dropped; unknown claves
fall back to a BE-parent group so dynamic boards are never lost. Sidebar unchanged
(same synthetic group-root shape).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add the 9 group label keys to i18n

**Files:**
- Modify: `messages/en.json` (`nav.grupo.*`)
- Modify: `messages/es.json` (`nav.grupo.*`)

**Interfaces:**
- Consumes: the `labelKey` values in `NAV_GROUPS` (Task 1).
- Produces: `nav.grupo.{scheduling,patients,services,billing,reports,inventory,communications,admin,configuration}` in both locales.

Existing `nav.grupo.*` keys are the 6 BE-group labels (`agenda`, `facturacion`,
`servicios`, `inventario`, `configuracion`, `monitoreo`). Leave them (still used
by fallback BE-parent groups). ADD the 9 new keys.

- [ ] **Step 1: Add keys to `messages/en.json`** under `nav.grupo`:

```json
"scheduling": "Scheduling",
"patients": "Patients",
"services": "Services",
"billing": "Billing",
"reports": "Reports",
"inventory": "Inventory",
"communications": "Communications",
"admin": "Admin",
"configuration": "Configuration"
```

- [ ] **Step 2: Add keys to `messages/es.json`** under `nav.grupo`:

```json
"scheduling": "Agenda",
"patients": "Pacientes",
"services": "Servicios",
"billing": "Facturación",
"reports": "Reportes",
"inventory": "Inventario",
"communications": "Comunicaciones",
"admin": "Administración",
"configuration": "Configuración"
```

- [ ] **Step 3: Verify JSON validity + key parity**

Run:
```bash
python3 -c "import json; en=json.load(open('messages/en.json')); es=json.load(open('messages/es.json')); ek=set(en['nav']['grupo']); sk=set(es['nav']['grupo']); print('EN-only:', ek-sk); print('ES-only:', sk-ek)"
```
Expected: both empty (perfect parity), and the 9 new keys present.

- [ ] **Step 4: Typecheck (JSON imports) + smoke**

Run: `npm run typecheck` → clean.
Run `npm run dev` (:8080). Confirm the rail now shows the 9 English group headers in taxonomy order (Scheduling, Patients, Services, Billing, Reports, Inventory, Communications, Admin, Configuration), each with the right items; permission-hidden items still hidden; any dynamic board (operaciones) appears under its fallback BE group.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n(nav): add 9 FE menu-group labels (en/es) (Phase 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 completion checklist

- [ ] `npm test` — manifest + nav-groups tests pass.
- [ ] `npm run typecheck` clean; build gate green.
- [ ] :8080 smoke — 9 groups in order; items under the correct group; empty groups hidden; permission filter intact; dynamic boards preserved via fallback.
- [ ] PR off `main`: `feat(nav): FE-owned menu groups mirroring route prefixes (route-reorg Phase 2)`.
- [ ] Proceed to `…-phase3-cleanup.md`.

## Notes

- **home/dashboard:** given a nominal `configuration` group + high order so they
  don't intrude; if the rail shows an unwanted "Home"/"Dashboard" leaf, add a
  filter in `buildNavGroups` (`destinations.filter(i => i.clave !== "home" && i.clave !== "dashboard")`) — decide at smoke.
- **Fallback groups** (BE-parent) render with the BE group label (e.g.
  "Monitoring"). If the product wants monitoring folded elsewhere, add those
  claves to the manifest with a real `group` — the fallback is only a safety net.
- **Admin group** contains a single item (`admin`); it renders as a one-item
  group. If a bare top-level link is preferred over a group header, that's a
  sidebar-render tweak, out of scope here.
