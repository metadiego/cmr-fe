# Route + Menu Reorg — MASTER Plan (overview & index)

> **For agentic workers:** This is the OVERVIEW. Each phase has its own detailed
> plan (linked in §7). Execute one phase per PR, in order. Use
> superpowers:subagent-driven-development or superpowers:executing-plans to run
> each phase plan task-by-task.

**Goal:** Make every user-facing route fully English and nested under a coherent
category prefix, with the menu structure mirroring the route structure — while
decoupling the FE's URL structure from BE `menu_items.path` data so the two can
never drift again.

**Architecture:** Introduce an FE-owned nav manifest (`lib/nav/manifest.ts`)
that maps each BE `menu_items.clave` → `{ route, group, order, labelKey }`. A
`routeForClave(clave, bePath)` resolver returns the FE route for known claves,
rewrites `/tablero/* → /boards/*` for dynamic boards, and falls back to the BE
path for unknown items (never a dead link). BE keeps access/visibility + label
overrides; FE owns route + structure + order. **No BE migration.**

**Tech Stack:** Next.js App Router (`app/(app)/…`), TypeScript, next-intl,
Radix/shadcn sidebar primitives, `node:test` for unit tests.

**Source spec:** `docs/specs/2026-09-01-route-menu-reorg-design.md` (read it —
this plan set implements it, with the review decisions in §2 below applied).

---

## 1. Global Constraints

- **Dev port 8080 only** (BE CORS allows 8080). `npm run dev`; stale build → `rm -rf .next && npm run dev`.
- **Typecheck must stay clean** after every task: `npm run typecheck`.
- **Build gate** (63 pages today; count shifts only when routes are added/removed, not renamed):
  `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy" NEXT_PUBLIC_API_BASE_URL="http://localhost:3000" npm run build`
- **`npm run lint` has KNOWN pre-existing failures** (`cita-modal.tsx`, `clientes/page.tsx`, `tableros-list.tsx`) — NOT ours. Do not "fix" unrelated lint; do not let lint --fix rewrite unrelated files.
- **NEVER touch `lib/api/*`** — those are BE endpoint paths, not routes. They share vocabulary (`/citas`, `/inventario`) by coincidence.
- **NEVER change `clave` values** — the stable join key between BE menu rows and the FE manifest. Internal, never user-visible.
- **NEVER change `permisoClave` (RBAC keys)** — path-independent.
- **Auth/shell routes are frozen**: `/login`, `/pending`, `/change-password`, `/auth/set-password`, `/dashboard`, root `/`. Hardcoded in `app-shell.tsx` `BARE_PREFIXES`, `session-gate.tsx`, `recovery-redirect.tsx`. Do not rename; re-verify they still match after each phase.
- **Unit tests** run with `node --test` via the repo's test runner (see `lib/nav/nav-groups.test.ts` — `node:test` + `node:assert/strict`, imported with `.ts` extension).
- **Commits:** every commit ends with the `Co-Authored-By: Claude …` trailer. Repo remote is `metadiego/cmr-fe`; pushes require `gh auth switch --user metadiego` then restore `dolalde-sparkiq` (see handoff §0). **NEVER merge to `main`** (prod auto-deploys).

---

## 2. Locked decisions (from spec §15 review)

| # | Decision | Choice | Effect on plan |
|---|----------|--------|----------------|
| 1 | `/admin` location | **Keep TOP-LEVEL `/admin`** (not nested) | `admin` is its own top-level group/route; NOT folded into configuration. |
| 2 | `[division]` param values | **Translate → `consultation` \| `general`** | `/billing/cash/consultation`, `/billing/cash/general`; update the 2–3 link builders + the `[division]` route folder acceptance. |
| 3 | Legacy deletes (§10) | **Delete ALL THREE** | Delete `/atencion` + `/frontdesk` stubs AND orphan `/settings/tableros`. (Phase 3.) |
| 4 | Old-URL strategy (§11) | **Hard cutover** | No redirects; old paths 404. No `next.config` redirect entries. |
| 5 | `staff` location | **Nest under configuration** → `/configuration/staff` | `staff` is NOT a top-level group; `/personal` → `/configuration/staff` in the configuration group. |

**Resulting top-level taxonomy (9 groups):**
`scheduling`, `patients`, `services`, `billing`, `reports`, `inventory`,
`communications`, `admin`, `configuration`.
(Spec's original list had `staff` top-level and `admin` nested; decisions #1 and
#5 swap them: `staff` moves into `configuration`, `admin` becomes top-level.)

`NavGroupKey` union (used across phase plans):
```ts
export type NavGroupKey =
  | "scheduling" | "patients" | "services" | "billing" | "reports"
  | "inventory" | "communications" | "admin" | "configuration";
```
Plus `/boards/[clave]` — the dynamic-board exception (prefix ≠ group; surfaced
under scheduling/services but always lives at `/boards/*`).

---

## 3. Phasing & PR strategy

Each phase is a **separate PR off `main`**, merged before the next starts.

| Phase | PR(s) | Deliverable | Independently shippable? |
|-------|-------|-------------|--------------------------|
| **0 — Decouple** | 1 PR | `lib/nav/manifest.ts` + `routeForClave` resolver; sidebar & app-shell resolve href via resolver. Manifest routes = **current** paths → menu renders **byte-identical**. | Yes — pure architecture, zero user-visible change. |
| **1 — Rename routes** | **1 PR per category** (9 PRs) | Move folders, update all inline links/guards, flip manifest `route` values to new English paths. Order by blast density. | Yes — each category is a self-contained cutover; menu stays live throughout via the resolver. |
| **2 — FE-owned groups** | 1 PR | Populate `NAV_GROUPS` + `group`/`order`; rework `buildNavGroups` to group by FE structure; add 9 group label keys. | Yes — menu regroups to mirror prefixes. |
| **3 — Cleanup** | 1 PR | Delete `/atencion`, `/frontdesk`, `/settings/tableros`; menu-editor follow-up; optional BE seed tidy note. | Yes. |

**Why Phase 0 first and alone:** it isolates the architecture change (resolver +
link indirection) from rename churn. After Phase 0 merges, the sidebar reads
`routeForClave(clave)` everywhere, so every later phase changes routes by editing
ONE manifest value per clave + moving the folder + fixing inline refs — the menu
never goes dead because unknown/old are covered by the fallback.

**Why grouping is deferred to Phase 2 (not done in Phase 0 as spec §13 lists):**
Phase 0's contract is a **byte-identical menu**. Grouping today is BE-driven
(nest by `parentClave`, order by `orden`, group roots are `g-*`/`tipo:grupo`).
Switching to FE-owned `group`/`order` in Phase 0 would change the rendered
grouping and break byte-identity. So Phase 0 keeps `buildNavGroups` grouping
untouched and only adds route resolution; the grouping rework lands in Phase 2.
This is a deliberate deviation from the spec's phase-boundary wording, keeping
each phase's verification crisp.

---

## 4. Phase 1 category order (by blast density)

Rename one category per PR, densest first (validate the recipe on the hardest
one). Exact per-category file lists live in the Phase 1 plan (grounded in the
blast-radius audit).

1. **billing** — `/facturacion`, `/consultas`, `/caja` → `/billing/*` (invoices, consultations, groups, returns, cash). Densest.
2. **inventory** — `/inventario`, `/precios` → `/inventory/*`.
3. **scheduling** — `/citas`, `/calendario` → `/scheduling/*`.
4. **patients** — `/clientes`, `/pacientes` → `/patients/*` (fixes the `cambio-protocolo` 404 latent bug).
5. **reports** — `/estadisticas` + `facturacion/reportes|ventas-*` → `/reports/*`.
6. **configuration** — `/configuracion`, `/auditoria`, `/settings/*`, `/servicios`, `/personal` (staff), `/admin`* → `/configuration/*` (+ top-level `/admin`).
7. **services / boards** — `/panel`, `/tablero`, `/atencion`, `/frontdesk` → `/services/*` + `/boards/*`.
8. **staff** — folded into configuration (see #6); no standalone PR if done there.
9. **communications** — `/comunicaciones` → `/communications` (thin).

\* `/admin` stays top-level per decision #1 — renamed only in spelling terms it
already is English; its group placement changes in Phase 2, not its path.

---

## 5. Key files (the leverage points, all phases)

Central constant tables (each enumerates most of the route set):
- `lib/nav.ts` — dead `navManifest`/`routeForClave` → superseded by `lib/nav/manifest.ts` (Phase 0). `isActive` stays (still used by sidebar).
- `lib/nav-manifest.ts` — `NAV_MANIFEST` admin dev catch-all (path+labelKey) → route values flip per category in Phase 1.
- `lib/nav/nav-groups.ts` + `.test.ts` — `buildNavGroups` (grouping) → reworked in Phase 2.
- `components/app-sidebar.tsx` — `REAL_ROUTES` (17), `hasPage`, 3 `<Link>` sites → resolver in Phase 0, prefixes in Phase 1.
- `components/inventario/inventario-index.tsx` — `SECTIONS` hrefs (Phase 1: inventory).
- `app/(app)/configuracion/page.tsx` — `SECCIONES` hrefs + `startsWith("/configuracion/")` (Phase 1: configuration).
- `components/user-menu.tsx` — avatar links + `startsWith("/configuracion/")` gate (Phase 1: configuration).

Full inline-ref list (per category) is baked into the Phase 1 plan from the audit.

---

## 6. Verification (every phase)

- `npm run typecheck` — clean.
- Build gate (§1) — all pages compile.
- `node --test lib/nav/*.test.ts` — resolver + grouping unit tests pass.
- Manual smoke on **:8080** — every menu item navigates to a live page; active
  section highlight correct; no dead links; dynamic boards still open.
- **Grep gate (Phase 1+):** no remaining spanglish route segments in
  `<Link href>` / `router.push` / `redirect` (excluding `lib/api/*`):
  ```bash
  grep -rnE '(href|push|replace|redirect)\([^)]*/(citas|clientes|pacientes|facturacion|consultas|caja|inventario|precios|estadisticas|configuracion|auditoria|servicios|personal|comunicaciones|panel|tablero|atencion|frontdesk)\b' \
    app components --include=*.tsx --include=*.ts | grep -v '/lib/api/'
  ```
  (Scope the prefix list to the category being cut over; expect zero hits for it
  after its PR.)

---

## 7. Phase plans (detailed, TDD)

- **Phase 0:** `docs/plans/2026-09-01-route-menu-reorg-phase0-decouple.md`
- **Phase 1:** `docs/plans/2026-09-01-route-menu-reorg-phase1-renames.md`
- **Phase 2:** `docs/plans/2026-09-01-route-menu-reorg-phase2-groups.md`
- **Phase 3:** `docs/plans/2026-09-01-route-menu-reorg-phase3-cleanup.md`

---

## 8. Complete route mapping (old → new) — applied decisions

Authoritative table for Phase 1 (spec §6 with decisions #1/#2/#5 applied).

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
| `/pacientes/cambio-protocolo` | `/patients/protocol-change` | cambio-de-protocolo (fixes 404) |
| `/pacientes/disponibilidad-legado` | `/patients/legacy-availability` | — |
| `/pacientes/disponibilidad-legado/preparacion` | `/patients/legacy-availability/preparation` | — |

### Services / Boards
| Old | New | clave |
|---|---|---|
| `/panel/enfermeria` | `/services/nursing-panel` | panel-enfermeria |
| `/tablero/[clave]` | `/boards/[clave]` | — |
| `/tablero/atencion` | `/boards/atencion` (surfaced in Scheduling) | atencion |
| `/tablero/frontdesk` | `/boards/frontdesk` (Services) | frontdesk |
| `/tablero/servicios` | `/boards/servicios` (Services) | servicios |
| `/frontdesk` (stub) | **DELETE** (Phase 3) | — |
| `/atencion` (stub) | **DELETE** (Phase 3) | — |

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

**Decision #2:** `[division]` values `consulta`/`general` → `consultation`/`general`.
Manifest routes for the caja claves become `/billing/cash/consultation` and
`/billing/cash/general`; update the 2–3 links that build them.

### Reports
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

### Communications
| Old | New | clave |
|---|---|---|
| `/comunicaciones` | `/communications` | comunicaciones |

### Admin (TOP-LEVEL per decision #1)
| Old | New | clave |
|---|---|---|
| `/admin` | `/admin` (unchanged path; top-level group) | admin |

### Configuration (corporate + personal + staff + audit)
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
| `/auditoria` | `/configuration/audit` | — |
| `/personal` (staff, decision #5) | `/configuration/staff` | — |
| `/settings/appearance` (personal) | `/configuration/preferences/appearance` | — (avatar link) |
| `/settings/tablero-modulos` (admin) | `/configuration/board-modules` | configuracion-modulos |
| `/settings/tableros` (orphan) | **DELETE** (Phase 3) | mis-tableros |
