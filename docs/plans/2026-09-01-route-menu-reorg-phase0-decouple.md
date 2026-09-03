# Route + Menu Reorg — Phase 0: Decouple (no renames) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an FE-owned `clave → route` manifest and a `routeForClave`
resolver, and route every sidebar link + the shell's section title through it —
so the FE stops rendering BE `menu_items.path` verbatim. The rendered menu is
**byte-identical to today, except it fixes the live `cambio-de-protocolo` 404**.

**Architecture:** New `lib/nav/manifest.ts` holds `NAV_MANIFEST` (one entry per
real menu `clave`, mapping to its current FE route) and
`routeForClave(clave, bePath?)`. Rules: (1) known clave → manifest route;
(2) unknown clave whose `bePath` starts with `/tablero/` → rewrite to `/boards/`;
(3) otherwise → `bePath` verbatim (or `"#"` if none). `buildNavGroups` grouping
is UNCHANGED (still nests by BE `parentClave`); only leaf `href`/active-matching
switch to the resolver. Group/order ownership is deferred to Phase 2.

**Tech Stack:** TypeScript, Next.js App Router, next-intl, `node:test`
(`node --test --experimental-strip-types "lib/**/*.test.ts"`, imports use `.ts`).

**Source spec:** `docs/specs/2026-09-01-route-menu-reorg-design.md` §4, §13 (Phase 0).
**Master plan:** `docs/plans/2026-09-01-route-menu-reorg-00-master.md`.

## Global Constraints

- Dev on **:8080** only. Verify build: `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy" NEXT_PUBLIC_API_BASE_URL="http://localhost:3000" npm run build` (63 pages — unchanged in Phase 0).
- `npm run typecheck` clean after every task.
- Unit tests: `npm test` (= `node --test --experimental-strip-types "lib/**/*.test.ts"`). Import local modules with the `.ts` extension (see existing `nav-groups.test.ts`).
- Do NOT touch `lib/api/*`. Do NOT change any `clave` or `permisoClave`. Do NOT rename any route folder in Phase 0.
- `npm run lint` has KNOWN unrelated failures (`cita-modal.tsx`, `clientes/page.tsx`, `tableros-list.tsx`) — ignore them; do not run `lint --fix` on unrelated files.
- Commit trailer: `Co-Authored-By: Claude …`. Branch off `main`; never merge to `main`.

## Scope boundary (what Phase 0 does NOT change)

- Grouping/order/labels: still BE-driven via `buildNavGroups` + BE `parentClave`/`orden`/`labelKey`/`labelCustom`. Phase 2 changes this.
- The admin-only dev buckets (`en-desarrollo`/`por-desarrollar` in `app-sidebar.tsx`, fed by `lib/nav-manifest.ts` `NAV_MANIFEST`): **left as-is**. They render `<Link href={c.path}>` directly. Their path strings are renamed in Phase 1, not here.
- Route folders, inline `<Link>`/`router.push` across feature components: untouched (Phase 1).

---

### Task 1: Create `lib/nav/manifest.ts` with the resolver + full manifest

**Files:**
- Create: `lib/nav/manifest.ts`
- Test: `lib/nav/manifest.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module — pure data + pure function).
- Produces:
  - `export type NavEntry = { clave: string; route: string }`
  - `export const NAV_MANIFEST: NavEntry[]`
  - `export function routeForClave(clave: string, bePath?: string): string`

**Manifest content rule (byte-identity):** every `route` equals the clave's
CURRENT BE seed path, EXCEPT `cambio-de-protocolo` which maps to the working FE
folder `/patients`… no — to the current working FE route `/pacientes/cambio-protocolo`
(the BE seeds `/pacientes/cambio-de-protocolo`, which 404s). Dead/orphan seeded
claves with no FE page (`caja` bare, `captacion-por-agente`, `ahora-mismo`) are
**omitted** — the resolver's fallback returns their BE path, preserving today's
(dead) behavior without asserting them as real FE routes.

- [ ] **Step 1: Write the failing test** — `lib/nav/manifest.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { routeForClave, NAV_MANIFEST } from "./manifest.ts";

// Rule 1: a known clave resolves to its manifest route (ignores bePath).
test("known clave resolves to its manifest route", () => {
  assert.equal(routeForClave("citas", "/ignored"), "/citas");
  assert.equal(routeForClave("inventario-existencias", undefined), "/inventario/existencias");
});

// Deliberate fix: cambio-de-protocolo points at the WORKING FE folder, not the
// broken BE seed path (/pacientes/cambio-de-protocolo 404s today).
test("cambio-de-protocolo resolves to the working FE route (fixes the 404)", () => {
  assert.equal(routeForClave("cambio-de-protocolo", "/pacientes/cambio-de-protocolo"), "/pacientes/cambio-protocolo");
});

// Rule 2: an UNKNOWN clave whose BE path is a dynamic board → /boards/ rewrite.
test("unknown /tablero/* clave is rewritten to /boards/*", () => {
  assert.equal(routeForClave("operaciones", "/tablero/operaciones"), "/boards/operaciones");
  assert.equal(routeForClave("some-new-board", "/tablero/foo"), "/boards/foo");
});

// Rule 3: unknown clave, non-board path → returned verbatim (never a dead link
// for a future BE item the FE doesn't know yet).
test("unknown clave falls back to the BE path verbatim", () => {
  assert.equal(routeForClave("future-thing", "/whatever"), "/whatever");
});

// Rule 3 edge: unknown clave, no bePath → safe non-navigating "#".
test("unknown clave with no bePath returns '#'", () => {
  assert.equal(routeForClave("nope", undefined), "#");
});

// Byte-identity guard: for every SEEDED clave that maps to a real FE route,
// the resolver returns exactly today's path (the fix is the sole exception).
// These pairs mirror cmr-be/src/scripts/menu-items.ts as of 2026-09-01.
test("byte-identity: seeded claves resolve to their current FE path", () => {
  const SEED: Array<[string, string]> = [
    ["citas", "/citas"],
    ["cupos", "/citas/agenda/cupos"],
    ["calendario", "/calendario"],
    ["atencion", "/tablero/atencion"],
    ["clientes", "/clientes"],
    ["comunicaciones", "/comunicaciones"],
    ["facturacion", "/facturacion"],
    ["consultas", "/consultas"],
    ["grupos-facturacion", "/facturacion/grupos"],
    ["facturacion-devoluciones", "/facturacion/devoluciones"],
    ["consultas-devoluciones", "/consultas/devoluciones"],
    ["consumo-insumos", "/facturacion/reportes/consumo-insumos"],
    ["caja-consulta", "/caja/consulta"],
    ["caja-general", "/caja/general"],
    ["precios", "/precios"],
    ["frontdesk", "/tablero/frontdesk"],
    ["servicios", "/tablero/servicios"],
    ["panel-enfermeria", "/panel/enfermeria"],
    ["config-formatos", "/configuracion/formatos"],
    ["estadisticas-servicios", "/estadisticas/servicios"],
    ["ventas-por-grupo", "/facturacion/ventas-por-grupo"],
    ["ventas-por-usuario", "/facturacion/ventas-por-usuario"],
    ["estadisticas-diarias", "/estadisticas/diarias"],
    ["inventario-index", "/inventario"],
    ["inventario-existencias", "/inventario/existencias"],
    ["inventario-viales", "/inventario/viales"],
    ["inventario-productos", "/inventario/productos"],
    ["inventario-proveedores", "/inventario/proveedores"],
    ["inventario-amp", "/inventario/presentaciones-proveedor"],
    ["inventario-recibir", "/inventario/recibir-compra"],
    ["inventario-recetas", "/inventario/recetas"],
    ["inventario-transferencias", "/inventario/transferencias"],
    ["configuracion-tableros", "/configuracion/tableros"],
    ["configuracion-modulos", "/settings/tablero-modulos"],
    ["mis-tableros", "/settings/tableros"],
    ["servicios-config", "/servicios"],
    ["config-factura", "/configuracion/factura"],
    ["config-requeridos", "/configuracion/requeridos"],
    ["config-datos-paciente", "/configuracion/datos-paciente"],
    ["configuracion-apariencia", "/configuracion/apariencia"],
    ["admin", "/admin"],
    ["personal", "/personal"],
    ["auditoria", "/auditoria"],
    ["home", "/"],
    ["dashboard", "/dashboard"],
    ["operaciones", "/boards/operaciones"], // via rule 2 (not seeded in manifest)
  ];
  for (const [clave, expected] of SEED) {
    assert.equal(routeForClave(clave, "/SENTINEL_BE_PATH"), expected, `clave ${clave}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './manifest.ts'` (module not created yet).

- [ ] **Step 3: Write minimal implementation** — `lib/nav/manifest.ts`

```ts
// lib/nav/manifest.ts
//
// FE-OWNED nav manifest: the single source of truth mapping a BE menu `clave`
// (GET /me/menu → lib/api/menu.ts MenuItem.clave) to the FE route it should link
// to. Introduced by the route-reorg Phase 0 to DECOUPLE the FE URL structure
// from BE `menu_items.path` — the FE no longer renders `path` verbatim.
//
// Phase 0 contract: every `route` here equals the clave's CURRENT path, so the
// rendered menu is byte-identical to before — EXCEPT `cambio-de-protocolo`,
// whose BE seed path (/pacientes/cambio-de-protocolo) 404s; we point it at the
// real FE folder (/pacientes/cambio-protocolo), fixing a live dead link.
// Later phases flip these `route` values to the new English paths, one category
// at a time; group/order ownership arrives in Phase 2.
//
// Dead/orphan seeded claves with no FE page (`caja` bare, `captacion-por-agente`,
// `ahora-mismo`) are intentionally ABSENT — the resolver's fallback returns their
// BE path so behavior is unchanged, without asserting them as real FE routes.

export type NavEntry = {
  clave: string; // matches BE menu_items.clave (stable join key; never user-visible)
  route: string; // FE-owned URL
};

export const NAV_MANIFEST: NavEntry[] = [
  // Agenda / pacientes
  { clave: "citas", route: "/citas" },
  { clave: "cupos", route: "/citas/agenda/cupos" },
  { clave: "calendario", route: "/calendario" },
  { clave: "atencion", route: "/tablero/atencion" },
  { clave: "clientes", route: "/clientes" },
  { clave: "cambio-de-protocolo", route: "/pacientes/cambio-protocolo" }, // FIX: BE seed 404s
  { clave: "comunicaciones", route: "/comunicaciones" },
  // Facturación / caja
  { clave: "facturacion", route: "/facturacion" },
  { clave: "consultas", route: "/consultas" },
  { clave: "grupos-facturacion", route: "/facturacion/grupos" },
  { clave: "facturacion-devoluciones", route: "/facturacion/devoluciones" },
  { clave: "consultas-devoluciones", route: "/consultas/devoluciones" },
  { clave: "consumo-insumos", route: "/facturacion/reportes/consumo-insumos" },
  { clave: "caja-consulta", route: "/caja/consulta" },
  { clave: "caja-general", route: "/caja/general" },
  // Servicios / boards / reportes
  { clave: "frontdesk", route: "/tablero/frontdesk" },
  { clave: "servicios", route: "/tablero/servicios" },
  { clave: "panel-enfermeria", route: "/panel/enfermeria" },
  { clave: "config-formatos", route: "/configuracion/formatos" },
  { clave: "estadisticas-servicios", route: "/estadisticas/servicios" },
  { clave: "estadisticas-diarias", route: "/estadisticas/diarias" },
  { clave: "ventas-por-grupo", route: "/facturacion/ventas-por-grupo" },
  { clave: "ventas-por-usuario", route: "/facturacion/ventas-por-usuario" },
  // Inventario
  { clave: "inventario-index", route: "/inventario" },
  { clave: "inventario-existencias", route: "/inventario/existencias" },
  { clave: "inventario-viales", route: "/inventario/viales" },
  { clave: "inventario-productos", route: "/inventario/productos" },
  { clave: "inventario-proveedores", route: "/inventario/proveedores" },
  { clave: "inventario-amp", route: "/inventario/presentaciones-proveedor" },
  { clave: "inventario-recibir", route: "/inventario/recibir-compra" },
  { clave: "inventario-recetas", route: "/inventario/recetas" },
  { clave: "inventario-transferencias", route: "/inventario/transferencias" },
  { clave: "precios", route: "/precios" },
  // Configuración / admin / staff / auditoría
  { clave: "configuracion-tableros", route: "/configuracion/tableros" },
  { clave: "configuracion-modulos", route: "/settings/tablero-modulos" },
  { clave: "mis-tableros", route: "/settings/tableros" },
  { clave: "servicios-config", route: "/servicios" },
  { clave: "config-factura", route: "/configuracion/factura" },
  { clave: "config-requeridos", route: "/configuracion/requeridos" },
  { clave: "config-datos-paciente", route: "/configuracion/datos-paciente" },
  { clave: "configuracion-apariencia", route: "/configuracion/apariencia" },
  { clave: "admin", route: "/admin" },
  { clave: "personal", route: "/personal" },
  { clave: "auditoria", route: "/auditoria" },
  // Raíces sueltas
  { clave: "home", route: "/" },
  { clave: "dashboard", route: "/dashboard" },
];

const BY_CLAVE: Map<string, string> = new Map(
  NAV_MANIFEST.map((e) => [e.clave, e.route]),
);

// Resolve a BE menu clave to its FE route.
//   1. Known clave → its manifest route.
//   2. Unknown clave whose BE path is a dynamic board → rewrite /tablero/* → /boards/*.
//   3. Otherwise → the BE path verbatim (never a dead link), or "#" if none.
export function routeForClave(clave: string, bePath?: string): string {
  const known = BY_CLAVE.get(clave);
  if (known) return known;
  if (bePath && bePath.startsWith("/tablero/")) {
    return "/boards/" + bePath.slice("/tablero/".length);
  }
  return bePath ?? "#";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 6 tests in `manifest.test.ts` green (existing `nav-groups.test.ts` also stays green).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/nav/manifest.ts lib/nav/manifest.test.ts
git commit -m "feat(nav): FE-owned clave→route manifest + routeForClave resolver (Phase 0)

Adds lib/nav/manifest.ts mapping each BE menu clave to its current FE route
plus a 3-rule resolver (known clave / /tablero→/boards rewrite / verbatim
fallback). Routes equal today's paths (byte-identical) except cambio-de-protocolo,
which is pointed at the working FE folder to fix a live 404. Not wired in yet.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Route the sidebar's domain-group links through the resolver

**Files:**
- Modify: `components/app-sidebar.tsx` (imports; `renderSub` leaf ~204-209; `renderTop` leaf ~245-256)

**Interfaces:**
- Consumes: `routeForClave` from Task 1.
- Produces: no new exports; sidebar leaf links now use `routeForClave(n.clave, n.path)`.

This changes ONLY the two domain-group leaf `<Link>` sites (and their
`isActive`). The dev-bucket links (`devGroups`, ~335) stay on `c.path` — those
are the admin catch-all handled in Phase 1. Because every domain clave's manifest
route equals its current `path` (Task 1), the rendered hrefs are unchanged.

- [ ] **Step 1: Add the import**

In the import block of `components/app-sidebar.tsx`, alongside `import { isActive } from "@/lib/nav";`, add:

```tsx
import { routeForClave } from "@/lib/nav/manifest";
```

- [ ] **Step 2: Switch the `renderSub` leaf link (currently ~lines 202-210)**

Find:

```tsx
      ) : (
        <SidebarMenuSubItem key={n.clave}>
          <SidebarMenuSubButton asChild isActive={isActive(pathname, n.path)}>
            <Link href={n.path}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ),
```

Replace the two `n.path` uses with the resolved route:

```tsx
      ) : (
        <SidebarMenuSubItem key={n.clave}>
          <SidebarMenuSubButton
            asChild
            isActive={isActive(pathname, routeForClave(n.clave, n.path))}
          >
            <Link href={routeForClave(n.clave, n.path)}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ),
```

- [ ] **Step 3: Switch the `renderTop` leaf link (currently ~lines 244-257)**

Find:

```tsx
      ) : (
        <SidebarMenuItem key={n.clave}>
          <SidebarMenuButton
            asChild
            isActive={isActive(pathname, n.path)}
            tooltip={labelOf(n)}
          >
            <Link href={n.path}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ),
```

Replace with:

```tsx
      ) : (
        <SidebarMenuItem key={n.clave}>
          <SidebarMenuButton
            asChild
            isActive={isActive(pathname, routeForClave(n.clave, n.path))}
            tooltip={labelOf(n)}
          >
            <Link href={routeForClave(n.clave, n.path)}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ),
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck`
Expected: no errors.
Run: `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy" NEXT_PUBLIC_API_BASE_URL="http://localhost:3000" npm run build`
Expected: 63 pages compile.

- [ ] **Step 5: Manual smoke on :8080**

Run `npm run dev` (port 8080). Confirm the sidebar renders the same items as before, every leaf still navigates to the same page, and the active-item highlight is unchanged. Confirm the **Patients → "Cambio de protocolo"** item now opens a live page (was 404 before).

- [ ] **Step 6: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat(nav): sidebar domain links resolve via routeForClave (Phase 0)

Both domain-group leaf links (renderSub/renderTop) now link + active-match on
routeForClave(n.clave, n.path) instead of the BE path verbatim. Byte-identical
today (manifest routes equal current paths); fixes the cambio-de-protocolo 404.
Dev-bucket catch-all links unchanged (handled in Phase 1).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Route the shell's section-title matching through the resolver

**Files:**
- Modify: `components/app-shell.tsx` (imports; `ShellChrome` active-item calc ~64-66)

**Interfaces:**
- Consumes: `routeForClave` from Task 1.
- Produces: none.

**Why:** `app-shell.tsx` derives the header section title from the active menu
item by matching `pathname` against BE `m.path`. Once Phase 1 renames a folder,
`pathname` becomes the new route but `m.path` (BE) stays old → the title would go
blank. Matching against `routeForClave(m.clave, m.path)` tracks the FE route, so
the title survives every rename. In Phase 0 the resolved route equals `m.path`
for all real items, so the title is unchanged today.

- [ ] **Step 1: Add the import**

In `components/app-shell.tsx`, next to `import { isActive } from "@/lib/nav";`, add:

```tsx
import { routeForClave } from "@/lib/nav/manifest";
```

- [ ] **Step 2: Resolve the active item by route (currently lines 64-67)**

Find:

```tsx
  const active = menu
    .filter((m) => !!m.path && m.path !== "#" && isActive(pathname, m.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const sectionTitle = active ? labelOf(active) : "";
```

Replace with:

```tsx
  // Match against the FE-owned resolved route (not the BE path), so the section
  // title survives route renames (Phase 1+). Most specific (longest) route wins.
  const active = menu
    .map((m) => ({ item: m, route: routeForClave(m.clave, m.path) }))
    .filter(({ route }) => !!route && route !== "#" && isActive(pathname, route))
    .sort((a, b) => b.route.length - a.route.length)[0]?.item;
  const sectionTitle = active ? labelOf(active) : "";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual smoke on :8080**

Navigate to several sections (Inventario, Facturación, Configuración). Confirm the header section title matches the active item exactly as before.

- [ ] **Step 5: Commit**

```bash
git add components/app-shell.tsx
git commit -m "feat(nav): shell section title matches resolved route (Phase 0)

app-shell derives the active section from routeForClave(m.clave, m.path) instead
of the BE path, so the header title tracks FE route renames. No visible change today.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Remove the dead `navManifest`/`routeForClave` scaffolding from `lib/nav.ts`

**Files:**
- Modify: `lib/nav.ts` (delete `NavManifestEntry`, `navManifest`, the old `routeForClave`; keep `isActive`)

**Interfaces:**
- Consumes: none.
- Produces: `lib/nav.ts` now exports only `isActive` (still imported by `app-sidebar.tsx` and `app-shell.tsx`).

The old `lib/nav.ts` `routeForClave(clave, fallback)` + `navManifest` (only
home/clientes/citas/admin) were never wired into rendering — superseded by
`lib/nav/manifest.ts`. Remove them so there is exactly one resolver.

- [ ] **Step 1: Verify nothing imports the dead symbols**

Run:
```bash
grep -rn "navManifest\|NavManifestEntry" app components lib hooks --include="*.ts" --include="*.tsx"
grep -rn "routeForClave" app components lib hooks --include="*.ts" --include="*.tsx" | grep -v "lib/nav/manifest"
```
Expected: the first prints only the definitions inside `lib/nav.ts`; the second prints only the Task 1/2/3 usages of `@/lib/nav/manifest` (i.e. NO import of `routeForClave` from `@/lib/nav`). If anything else imports them, STOP and reconcile before deleting.

- [ ] **Step 2: Reduce `lib/nav.ts` to just `isActive`**

Replace the entire file with:

```ts
// lib/nav.ts
//
// Route helpers for the app shell. The FE-owned `clave → route` mapping now
// lives in lib/nav/manifest.ts (routeForClave); this file keeps only the
// active-link predicate used by the sidebar and the shell header.

// "/" is active only on the exact root; every other item is active on an exact
// match or a nested sub-path (e.g. /clientes/123 keeps "Clientes" active).
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck`
Expected: no errors (confirms nothing referenced the deleted symbols).
Run: `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy" NEXT_PUBLIC_API_BASE_URL="http://localhost:3000" npm run build`
Expected: 63 pages compile.

- [ ] **Step 4: Commit**

```bash
git add lib/nav.ts
git commit -m "refactor(nav): drop dead navManifest/routeForClave from lib/nav.ts (Phase 0)

The clave→route mapping now lives solely in lib/nav/manifest.ts. lib/nav.ts keeps
only isActive (still used by the sidebar + shell header). No behavior change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 0 completion checklist

- [ ] `npm test` — `manifest.test.ts` + `nav-groups.test.ts` all pass.
- [ ] `npm run typecheck` — clean.
- [ ] Build gate — 63 pages.
- [ ] :8080 smoke — menu byte-identical; `cambio-de-protocolo` no longer 404s; section titles correct.
- [ ] Open the PR off `main` (see master §1 push mechanics). Title e.g. `feat(nav): decouple FE routes from BE menu paths (route-reorg Phase 0)`.

## Follow-on

After this merges, every later phase renames a route by editing ONE `route`
value per clave in `lib/nav/manifest.ts` (plus moving the folder + fixing inline
refs). Proceed to `…-phase1-renames.md`.
