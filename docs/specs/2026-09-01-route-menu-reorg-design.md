# DESIGN — English route reorganization + FE‑owned menu structure (cmr-fe)

**Date:** 2026-09-01
**Repo:** `/Users/diegoolalde/Documents/Dev/cmr/cmr-app/cmr-fe` (BE at `../cmr-be`)
**Status:** Draft for review

## 1. Problem

App routes are spanglish and incoherently organized. The route *prefix* and the
navigation *menu group* are badly misaligned: one menu group ("Services",
`g-servicios`) contains routes living under six different prefixes
(`/tablero`, `/panel`, `/configuracion`, `/estadisticas`, `/facturacion`,
`/pacientes`). Menu **labels are already English** (via i18n) — only the URLs are
spanglish.

Root cause of the fragility: the BE `menu_items` table stores the literal
Next.js route `path`, and the FE renders it verbatim as `<Link href>` with **no
mapping layer** (`components/app-sidebar.tsx:141`). So the frontend's URL
structure is duplicated into backend data and the two drift — `lib/nav-manifest.ts`
already contains *both* old (`/configuracion/factura`) and new
(`/settings/appearance`) spellings of the same routes. Renaming a folder today
leaves dead menu links until a DB migration updates every tenant.

## 2. Goals

1. Every user‑facing route is **fully English** and nested under a **coherent
   category prefix**.
2. The **menu structure mirrors the route structure**: a route `/<category>/X`
   appears under the `<category>` menu group.
3. Categories **coincide with the BE domain modules** (one domain → one route
   prefix → one menu group).
4. Clean separation of concerns going forward:
   - **BE owns access & visibility** — which `clave`s a principal may see
     (`permisoClave`, `visible`, per‑`centro` scope), and optional per‑center
     label overrides.
   - **FE owns order & structure** — each item's route, its group, its order,
     its label key, its icon.

## 3. Non‑goals (out of scope)

- Renaming `clave` values. `clave` is the stable join key between BE menu rows
  and the FE manifest; it stays as‑is (internal, never user‑visible). No BE data
  migration is required for correctness.
- Changing `lib/api/*` fetch paths. Those are **BE endpoints** that happen to
  share vocabulary (`/citas`, `/inventario`, …); they are governed by the
  backend and must NOT be touched.
- Changing RBAC permission keys (`permisoClave`) — path‑independent.
- Auth/shell routes (`/login`, `/pending`, `/change-password`,
  `/auth/set-password`, `/dashboard`, root `/`). Already English; hardcoded in
  guards (`app-shell.tsx` `BARE_PREFIXES`, `session-gate.tsx`,
  `recovery-redirect.tsx`). Left unchanged.
- Print/thermal templates, data‑driven colors (per prior design‑system handoff).

## 4. Chosen architecture — decouple via an FE nav manifest

### 4.1 Today (to be replaced)
- `useMenu()` → `GET /me/menu` returns `MenuItem[]` with `{ clave, labelKey,
  labelCustom, tipo, path, icon, parentClave, orden, permisoClave, visible,
  centroId }`.
- `buildNavGroups(items, can)` (`lib/nav/nav-groups.ts`) nests by BE
  `parentClave`, orders by BE `orden`, filters by `can(permisoClave)`.
- Sidebar renders `<Link href={n.path}>` using the BE `path` verbatim.
- `lib/nav.ts` already contains a **dead** `navManifest` + `routeForClave`
  (`clave → route`) — the pattern someone started and never wired in.

### 4.2 Target
Introduce a single source of truth in FE code:

```ts
// lib/nav/manifest.ts  (new — replaces the dead lib/nav.ts scaffolding)
export type NavGroupKey =
  | "scheduling" | "patients" | "services" | "billing" | "reports"
  | "inventory" | "communications" | "staff" | "configuration";

export interface NavEntry {
  clave: string;          // matches BE menu_items.clave
  route: string;          // FE-owned URL, e.g. "/billing/invoices"
  group: NavGroupKey;     // which menu group it belongs to
  order: number;          // order within the group (FE-owned)
  labelKey: string;       // i18n key (unchanged from today's values)
  icon?: string;
}

export const NAV_MANIFEST: NavEntry[];              // the whole app
export const NAV_GROUPS: { key: NavGroupKey; labelKey: string; order: number }[];

// Resolver: clave -> route, with fallbacks for items not in the manifest.
export function routeForClave(clave: string, bePath?: string): string;
```

**Resolver rules** (`routeForClave`):
1. If `clave` is in `NAV_MANIFEST` → return its `route`.
2. Else if `bePath` starts with `/tablero/` → rewrite to `/boards/…`
   (covers admin‑created **dynamic boards** that have no static manifest entry).
3. Else return `bePath` verbatim (safety fallback for any future BE item the FE
   doesn't know yet — never a dead link).

**`buildNavGroups` reworked** to merge BE visibility with FE structure:
- Input: BE `MenuItem[]` (the visible set) + `can`.
- For each visible BE item, look up its `NavEntry` by `clave` to get
  `{route, group, order, labelKey}`; fall back to BE fields when absent.
- Group by `NavEntry.group`, order by `NavEntry.order`, render group headers
  from `NAV_GROUPS`. Permission filter (`can(permisoClave)`) unchanged.
- Label resolution unchanged: `labelCustom` (BE per‑center override) still wins,
  else `t(labelKey)`.

**Sidebar change:** `components/app-sidebar.tsx` renders
`<Link href={routeForClave(n.clave, n.path)}>` instead of `<Link href={n.path}>`
(3 sites: `:141`, `:170`, `:221`). `app-shell.tsx` section‑title matching uses
the resolved route the same way.

**Consequence:** BE `menu_items.path`, `parentClave`, and `orden` become
**advisory / vestigial** for items the FE knows. No BE migration needed. The
admin menu‑editor's free‑text `path` and manual reorder lose effect for
manifest‑known items (acceptable per the agreed tradeoff; see §9). Dynamic
boards and unknown future items still work via the fallback rules.

## 5. Category taxonomy (9 top‑level)

Each row is simultaneously a **route prefix** and a **menu group**, aligned to a
BE domain module.

| Group (prefix)     | BE module(s)                       | Contents |
|--------------------|------------------------------------|----------|
| `/scheduling`      | citas, calendario                  | appointments, calendar, slots |
| `/patients`        | pacientes, disponibilidad          | list+detail, protocol‑change, legacy‑availability |
| `/services`        | frontdesk, paneles                 | nursing panel (+ board items surfaced here) |
| `/billing`         | facturacion, caja                  | invoices, consultations, groups, returns, cash |
| `/reports`         | estadisticas                       | service/daily stats, sales‑by‑group/user, supply‑consumption |
| `/inventory`       | inventario, precios                | stock/products/…/transfers, prices |
| `/communications`  | comunicaciones, alertas            | communications |
| `/staff`           | personal                           | staff |
| `/configuration`   | formatos, tableros, preferences, rbac, menu, centros | corporate config + personal prefs + admin |

**Boards are an intentional exception.** Operational boards are one dynamic
component (`tablero` module) keyed per‑center. They live under a single
`/boards/[clave]` space regardless of which menu group surfaces them (Scheduling
surfaces "Attention", Services surfaces "Frontdesk"/"Services"). Forcing them
under domain prefixes is impossible with one dynamic segment. This is the sole
place where prefix ≠ group, and it's inherent to boards being a cross‑cutting
surface.

## 6. Complete route mapping (old → new)

Legend: `clave` = BE menu key (unchanged) where one exists.

### Scheduling
| Old | New | clave |
|---|---|---|
| `/citas` | `/scheduling/appointments` | citas |
| `/citas/agenda/[fecha]` | `/scheduling/appointments/[date]` | — |
| `/citas/agenda/cupos` | `/scheduling/slots` | cupos |
| `/calendario` | `/scheduling/calendar` | calendario |

### Patients
| Old | New | clave |
|---|---|---|
| `/clientes` | `/patients` | clientes |
| `/clientes/[id]` | `/patients/[id]` | — |
| `/pacientes/cambio-protocolo` | `/patients/protocol-change` | cambio-de-protocolo* |
| `/pacientes/disponibilidad-legado` | `/patients/legacy-availability` | — |
| `/pacientes/disponibilidad-legado/preparacion` | `/patients/legacy-availability/preparation` | — |

\* NOTE latent bug: BE seed path is `/pacientes/cambio-de-protocolo` but the FE
folder is `cambio-protocolo` — the menu link currently 404s. Decoupling fixes it
(clave → `/patients/protocol-change`).

### Services / Boards
| Old | New | clave |
|---|---|---|
| `/panel/enfermeria` | `/services/nursing-panel` | panel-enfermeria |
| `/tablero/[clave]` | `/boards/[clave]` | — |
| `/tablero/atencion` (via clave) | `/boards/atencion` (surfaced in Scheduling) | atencion |
| `/tablero/frontdesk` (via clave) | `/boards/frontdesk` (Services) | frontdesk |
| `/tablero/servicios` (via clave) | `/boards/servicios` (Services) | servicios |
| `/frontdesk` (redirect stub) | **DELETE** | — |
| `/atencion` (redirect stub) | **DELETE** | — |

### Billing
| Old | New | clave |
|---|---|---|
| `/facturacion` | `/billing/invoices` | facturacion |
| `/facturacion/[id]` | `/billing/invoices/[id]` | — |
| `/facturacion/[id]/devolver` | `/billing/invoices/[id]/return` | — |
| `/facturacion/[id]/devoluciones/[devId]/recibo` | `/billing/invoices/[id]/returns/[returnId]/receipt` | — |
| `/facturacion/general` | `/billing/invoices/new` (thin redirect page) | — |
| `/facturacion/grupos` | `/billing/groups` | grupos-facturacion |
| `/facturacion/devoluciones` | `/billing/returns` | facturacion-devoluciones |
| `/consultas` | `/billing/consultations` | consultas |
| `/consultas/devoluciones` | `/billing/consultations/returns` | consultas-devoluciones |
| `/caja/[division]` | `/billing/cash/[division]` | caja / caja-consulta / caja-general |
| `/caja/cuadre-general` | `/billing/cash/summary` | — |

`[division]` param values `consulta`/`general` → `consultation`/`general`
(update the 2–3 links that build them).

### Reports (pulled out of billing/services)
| Old | New | clave |
|---|---|---|
| `/estadisticas/servicios` | `/reports/services` | estadisticas-servicios |
| `/estadisticas/diarias` | `/reports/daily` | estadisticas-diarias |
| `/facturacion/reportes/consumo-insumos` | `/reports/supply-consumption` | consumo-insumos |
| `/facturacion/ventas-por-grupo` | `/reports/sales-by-group` | ventas-por-grupo |
| `/facturacion/ventas-por-usuario` | `/reports/sales-by-user` | ventas-por-usuario |

### Inventory
| Old | New | clave |
|---|---|---|
| `/inventario` | `/inventory` | inventario-index |
| `/inventario/existencias` | `/inventory/stock` | inventario-existencias |
| `/inventario/viales` | `/inventory/vials` | inventario-viales |
| `/inventario/productos` | `/inventory/products` | inventario-productos |
| `/inventario/proveedores` | `/inventory/suppliers` | inventario-proveedores |
| `/inventario/presentaciones-proveedor` | `/inventory/supplier-presentations` | inventario-amp |
| `/inventario/recibir-compra` | `/inventory/receive-purchase` | inventario-recibir |
| `/inventario/recepcion-factura` | `/inventory/invoice-reception` | — |
| `/inventario/recetas` | `/inventory/recipes` | inventario-recetas |
| `/inventario/transferencias` | `/inventory/transfers` | inventario-transferencias |
| `/inventario/transferencias/nueva` | `/inventory/transfers/new` | — |
| `/inventario/transferencias/[id]` | `/inventory/transfers/[id]` | — |
| `/inventario/planificacion` | `/inventory/planning` | — |
| `/precios` | `/inventory/prices` | precios |

### Communications / Staff
| Old | New | clave |
|---|---|---|
| `/comunicaciones` | `/communications` | comunicaciones |
| `/personal` | `/staff` | — |

### Configuration (corporate + personal + admin)
| Old | New | clave |
|---|---|---|
| `/configuracion` | `/configuration` | — |
| `/configuracion/apariencia` | `/configuration/appearance` | configuracion-apariencia |
| `/configuracion/menu` | `/configuration/menu` | — |
| `/configuracion/tableros` | `/configuration/boards` | configuracion-tableros |
| `/configuracion/tableros/[clave]` | `/configuration/boards/[clave]` | — |
| `/citas/config/columnas` | `/configuration/boards/columns` | — |
| `/configuracion/factura` | `/configuration/invoice` | config-factura |
| `/configuracion/numeracion` | `/configuration/numbering` | — |
| `/configuracion/formatos` | `/configuration/formats` | config-formatos |
| `/configuracion/datos-paciente` | `/configuration/patient-fields` | config-datos-paciente |
| `/configuracion/requeridos` | `/configuration/required-fields` | config-requeridos |
| `/configuracion/panel-enfermeria` | `/configuration/nursing-panel` | — |
| `/servicios` | `/configuration/services` | servicios-config |
| `/admin` | `/configuration/admin` | admin |
| `/auditoria` | `/configuration/audit` | — |
| `/settings/appearance` (personal) | `/configuration/preferences/appearance` | — (avatar link) |
| `/settings/tablero-modulos` (admin) | `/configuration/board-modules` | configuracion-modulos |
| `/settings/tableros` (orphan) | **DELETE** | mis-tableros |

## 7. FE blast radius (what to update, from the reference audit)

Central constant tables (each enumerates most of the route set — highest
leverage):
- `lib/nav.ts` — dead `navManifest`/`routeForClave` → replaced by
  `lib/nav/manifest.ts`.
- `lib/nav-manifest.ts` — `NAV_MANIFEST` (admin dev catch‑all) → regenerate from
  the new manifest (routes only for pages not yet in BE menu).
- `components/app-sidebar.tsx` — `REAL_ROUTES` (17) and `hasPage` logic →
  update to new prefixes; switch links to `routeForClave`.
- `components/inventario/inventario-index.tsx` — `SECTIONS` (11 hrefs).
- `app/(app)/configuracion/page.tsx` — `SECCIONES` (9 hrefs) + the
  `startsWith("/configuracion/")` filter.
- `components/user-menu.tsx` — avatar links (`/configuracion`,
  `/settings/*`, `/change-password`) + the `startsWith("/configuracion/")` gate
  (`:48`).

Inline references: ~40 `<Link href>` sites and ~30 `router.push`/`redirect`
sites across `components/facturacion/*`, `components/inventario/*`,
`components/agenda/*`, `components/tablero/*`, `components/clientes/*`, and page
files — all enumerated in the reference audit. Data‑driven hrefs
(`acciones-modal`, alert links) build from `/facturacion/${id}` base strings →
update the base.

Guards that hardcode paths (must NOT break): `app-shell.tsx` `BARE_PREFIXES`,
`session-gate.tsx`, `recovery-redirect.tsx` — these reference only
auth/shell routes which are **unchanged**, so no edits, but re‑verify.

## 8. BE‑side impact (minimal, migration‑free)

- **No migration required.** With decoupling, the FE ignores `menu_items.path`
  for known `clave`s. Existing prod rows keep their old paths harmlessly.
- **Optional cleanup (low priority, separate PR):** update `cmr-be`
  `src/scripts/menu-items.ts` seed `path` values to the new routes and rename
  the group `clave`s (`g-agenda` → `g-scheduling`, …) for tidiness. Because the
  FE now owns structure, this is cosmetic. If done, it's a plain seed edit +
  optional idempotent data‑fix script — no schema change.
- **Menu‑editor (`components/configuracion/menu-editor.tsx`,
  `components/admin/menu-admin.tsx`):** the free‑text `path` field and manual
  reorder no longer drive manifest‑known items. Follow‑up: relabel these
  controls or hide them for known items; keep them for dynamic/board items.
  Not blocking the rename.

## 9. Tradeoffs accepted

- Admins lose the ability to point a menu item at an arbitrary hand‑typed FE
  path, and to reorder/regroup the core menu from the BE editor. This is the
  point of "structure in the FE" and was explicitly agreed. Per‑center **label
  overrides** and **visibility/permission** remain BE‑controlled.

## 10. Legacy cleanup (pending confirmation at review)

- **Delete** `/atencion` and `/frontdesk` redirect stubs (menu now points
  straight at `/boards/*`). Recommended.
- **Delete** orphan `/settings/tableros` (`PersonalizarTablero` unused
  elsewhere). Recommended — confirm the personal board‑personalization feature
  is truly unwanted first.

## 11. Old‑URL strategy

**Hard cutover** (recommended): no redirects; old paths 404. Navigation is
menu‑driven and the menu regenerates to new routes; internal ERP with no
SEO/external links. Users re‑navigate once. (Alternative: temporary
`next.config` redirects for a grace period — more files, remove later. Decide at
review.)

## 12. i18n

- Leaf **label keys are unchanged** (path‑independent). No leaf translation work.
- **New group label keys** needed for the 9 groups (`nav.grupo.scheduling`,
  `…patients`, `…services`, `…billing`, `…reports`, `…inventory`,
  `…communications`, `…staff`, `…configuration`) in `messages/en.json` and
  `messages/es.json`. Reuse existing where present (billing, inventory,
  configuration already exist).

## 13. Rollout (phased — details in the implementation plan)

- **Phase 0 — Decouple, no renames.** Add `lib/nav/manifest.ts` mapping every
  `clave` to its *current* path; rework `buildNavGroups`; switch sidebar to
  `routeForClave`. Verify the menu renders byte‑identical to today. This isolates
  the architecture change from rename churn and is independently shippable.
- **Phase 1 — Rename routes, one category per PR.** Move folders, update all
  inline links/guards, flip the manifest `route` values to the new paths.
  Order by blast density: billing, inventory, scheduling, patients, reports,
  configuration, services/boards, staff, communications.
- **Phase 2 — FE‑owned groups.** Populate `NAV_GROUPS` + `group`/`order` in the
  manifest so the menu mirrors the prefixes; add group label keys.
- **Phase 3 — Cleanup.** Delete legacy redirects + orphan; optional BE seed
  tidy; menu‑editor follow‑up.

## 14. Verification

- `npm run typecheck` clean after each phase.
- `NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… NEXT_PUBLIC_API_BASE_URL=… npm run build` — all pages compile (count changes as routes move).
- `buildNavGroups` unit tests (`lib/nav/nav-groups.test.ts`) extended for the
  manifest merge + resolver fallbacks (board rewrite, unknown‑clave passthrough).
- Manual smoke on :8080: every menu item navigates to a live page; section title
  correct; no dead links; dynamic boards still open.
- Grep gate: no remaining spanglish route segments in `<Link>`/`router.push`
  (excluding `lib/api/*`).

## 15. Open decisions to confirm

1. `/admin` → `/configuration/admin` (nest) vs keep top‑level `/admin`. Spec
   assumes nest, honoring "configuration includes admin."
2. `[division]` values `consulta|general` → English `consultation|general`
   (spec assumes yes).
3. Legacy deletes in §10 (assume yes).
4. Hard cutover vs temporary redirects in §11 (assume hard cutover).
5. `staff` top‑level vs under configuration (spec keeps it top‑level per the
   10‑domain granularity).
