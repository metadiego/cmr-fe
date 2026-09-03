# Route + Menu Reorg — Phase 1: Rename routes (one category per PR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. **Each Task below is one category = one PR off `main`.** Merge a category's PR before starting the next. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rename every spanglish route to its English target (master §8 table),
one category at a time. The menu never goes dead: after Phase 0, links resolve
through `routeForClave`, so each category cutover = flip the manifest `route`
value(s) + `git mv` the folder(s) + fix that category's inline refs.

**Architecture:** Hard cutover (no redirects; old paths 404). Per category:
(1) move folders with `git mv` (preserves history), (2) flip `route` in
`lib/nav/manifest.ts`, (3) update every inline `<Link>`/`router.push`/`redirect`
+ central table for that category (exact file:line list per task, from the
blast-radius audit), (4) run the category grep gate to prove zero old segments
remain.

**Tech Stack:** Next.js App Router, TypeScript, next-intl.

**Prereq:** Phase 0 merged (`lib/nav/manifest.ts` + resolver wired into sidebar & shell).
**Master plan:** `docs/plans/2026-09-01-route-menu-reorg-00-master.md` (§8 = full old→new table, authoritative).

## Global Constraints

- Dev :8080. Build gate: `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy" NEXT_PUBLIC_API_BASE_URL="http://localhost:3000" npm run build`.
- `npm run typecheck` clean + `npm test` green after each category.
- NEVER touch `lib/api/*`. NEVER change `clave`/`permisoClave`. Don't rename auth/shell routes (`/login`, `/auth`, `/pending`, `/change-password`, `/dashboard`, `/`).
- Do NOT change menu **grouping** here — Phase 2 owns groups. Phase 1 only changes route *strings* + folder locations. The manifest keeps its Phase-0 `NavEntry = { clave, route }` shape.
- Commit trailer `Co-Authored-By: Claude …`; branch off `main`; never merge to `main`.

## The rename recipe (applied per category)

For a category with folder move `OLD → NEW` and inline refs `R`:

1. **Move folders:** `git mv "app/(app)/OLD" "app/(app)/NEW"` (repeat for each folder; create intermediate dirs as needed — see per-task exact commands). Dynamic segments (`[id]`, `[clave]`) move with the folder.
2. **Flip the manifest:** edit the affected `route` values in `lib/nav/manifest.ts` to the new paths.
3. **Fix inline refs:** apply every edit in the task's ref list (each is `file:line` — replace the old route substring with the new one; keep query strings / template `${…}` intact).
4. **Update central tables** that name this category's paths: `components/app-sidebar.tsx` `REAL_ROUTES`, `lib/nav-manifest.ts` `NAV_MANIFEST` rows, and any hub table (`inventario-index` SECTIONS, `configuracion` SECCIONES, `user-menu` links).
5. **Typecheck + build + test.**
6. **Grep gate** (prove the old prefix is gone from links, excluding `lib/api`):
   ```bash
   grep -rnE "(href|push|replace|redirect|permanentRedirect)\([^)]*<OLD_PREFIXES>" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"
   ```
   Expected: zero hits (comments/placeholders may be updated separately — see notes).
7. **:8080 smoke:** every renamed menu item + inline link opens a live page; deep links (`[id]`, `[clave]`) work; section title correct.
8. **Commit + open the category PR.**

> **Note on `lib/nav-manifest.ts`:** this is the admin-only dev-bucket catch-all
> (path+labelKey). Its rows for a category MUST be flipped in the same PR (they
> feed `hasPage`/dev buckets and would otherwise point at 404s for admins).

---

### Task 1 (PR 1): billing — `/facturacion` + `/consultas` + `/caja` → `/billing/*`

Densest category — validates the recipe. Master §8 "Billing".

**Files — folder moves:**
```bash
mkdir -p "app/(app)/billing"
git mv "app/(app)/facturacion" "app/(app)/billing/invoices"
git mv "app/(app)/consultas" "app/(app)/billing/consultations"
git mv "app/(app)/caja" "app/(app)/billing/cash"
# invoices/general is the "new invoice" entry → rename folder to invoices/new
git mv "app/(app)/billing/invoices/general" "app/(app)/billing/invoices/new"
# billing/invoices/grupos → billing/groups ; billing/invoices/devoluciones → billing/returns
git mv "app/(app)/billing/invoices/grupos" "app/(app)/billing/groups"
git mv "app/(app)/billing/invoices/devoluciones" "app/(app)/billing/returns"
# consultations/devoluciones → consultations/returns
git mv "app/(app)/billing/consultations/devoluciones" "app/(app)/billing/consultations/returns"
# invoice return sub-tree: [id]/devolver → [id]/return ; [id]/devoluciones → [id]/returns
git mv "app/(app)/billing/invoices/[id]/devolver" "app/(app)/billing/invoices/[id]/return"
git mv "app/(app)/billing/invoices/[id]/devoluciones" "app/(app)/billing/invoices/[id]/returns"
# recibo leaf → receipt (path: [id]/returns/[devId]/recibo → .../[returnId]/receipt — rename recibo only; keep [devId] segment name, it's internal)
git mv "app/(app)/billing/invoices/[id]/returns/[devId]/recibo" "app/(app)/billing/invoices/[id]/returns/[devId]/receipt"
# reports pieces leave billing in Task 5 (reports). Cash summary:
git mv "app/(app)/billing/cash/cuadre-general" "app/(app)/billing/cash/summary"
```
> The `[division]` folder stays named `[division]` (dynamic segment); only its
> accepted VALUES change (decision #2, see below). `facturacion/reportes` and
> `ventas-por-*` move to `/reports` in Task 5 — leave them under billing for now
> OR move them here and set their manifest route in Task 5; **recommended: move
> them in Task 5** to keep PRs category-clean. They currently live at
> `app/(app)/billing/invoices/reportes/…` and `app/(app)/billing/invoices/ventas-por-*`
> after the `facturacion→invoices` move — Task 5 relocates them to `/reports`.

**Files — manifest flips (`lib/nav/manifest.ts`):**
```ts
{ clave: "facturacion", route: "/billing/invoices" },
{ clave: "consultas", route: "/billing/consultations" },
{ clave: "grupos-facturacion", route: "/billing/groups" },
{ clave: "facturacion-devoluciones", route: "/billing/returns" },
{ clave: "consultas-devoluciones", route: "/billing/consultations/returns" },
{ clave: "caja-consulta", route: "/billing/cash/consultation" },   // decision #2: English value
{ clave: "caja-general", route: "/billing/cash/general" },
// consumo-insumos / ventas-por-grupo / ventas-por-usuario → flipped in Task 5 (reports)
```

**Files — `[division]` English values (decision #2):**
- `app/(app)/billing/cash/[division]/page.tsx:9,17` — change `const DIVISIONES: CajaDivision[] = ["consulta", "general"];` → `["consultation", "general"];` and update the `CajaDivision` type accordingly. Update any downstream logic that branches on `"consulta"` for this route param.

**Files — inline ref edits (base `/facturacion` → `/billing/invoices`, `/consultas` → `/billing/consultations`):**
- `components/facturacion/factura-row-actions.tsx:65` — `/facturacion/${facturaId}` → `/billing/invoices/${facturaId}`
- `components/facturacion/factura-row-actions.tsx:66` — `/facturacion/${facturaId}/devolver` → `/billing/invoices/${facturaId}/return`
- `components/facturacion/resumen-paciente-panel.tsx:109` — `/facturacion/${f.id}` → `/billing/invoices/${f.id}`
- `components/facturacion/devoluciones-list-view.tsx:93` — `esConsulta ? "/consultas" : "/facturacion"` → `esConsulta ? "/billing/consultations" : "/billing/invoices"`
- `components/facturacion/devoluciones-list-view.tsx:94` — `/facturacion/${fid}` → `/billing/invoices/${fid}`
- `components/facturacion/devoluciones-list-view.tsx:188` — `/facturacion/${d.facturaId}/devoluciones/${d.id}/recibo` → `/billing/invoices/${d.facturaId}/returns/${d.id}/receipt`
- `components/facturacion/facturas-list-view.tsx:152` — `esConsulta ? "/consultas/devoluciones" : "/facturacion/devoluciones"` → `esConsulta ? "/billing/consultations/returns" : "/billing/returns"`
- `components/facturacion/facturas-list-view.tsx:153` — `/facturacion/${fid}` → `/billing/invoices/${fid}`
- `components/facturacion/facturas-list-view.tsx:179` — `/facturacion/general?nuevo=1…` → `/billing/invoices/new?nuevo=1…`
- `components/facturacion/venta-general.tsx:41` — `/facturacion` → `/billing/invoices`
- `components/facturacion/venta-general.tsx:141` — `/facturacion/${f.id}` → `/billing/invoices/${f.id}`
- `components/clientes/acciones-paciente-sheet.tsx:131` — `/facturacion/${f.id}` → `/billing/invoices/${f.id}`
- `components/tablero/acciones-modal.tsx:74` — `/facturacion/${id}${q}` → `/billing/invoices/${id}${q}`
- `app/(app)/billing/invoices/new/page.tsx` (was `facturacion/general/page.tsx`):14 — `redirect(`/facturacion…`)` → `redirect(`/billing/invoices…`)`
- `app/(app)/billing/invoices/[id]/return/page.tsx` (was `[id]/devolver`):77 — `backHref = /facturacion/${id}…` → `/billing/invoices/${id}…`
- `app/(app)/billing/invoices/[id]/page.tsx:193` — `"/facturacion"` → `"/billing/invoices"`
- `app/(app)/billing/invoices/[id]/page.tsx:404` — `esGeneral ? "/facturacion" : "/tablero/atencion"` → `esGeneral ? "/billing/invoices" : "/tablero/atencion"` (the `/tablero/atencion` half is fixed in Task 7)
- `app/(app)/inventario/viales/page.tsx:301` — `/facturacion/${c.facturaId}` → `/billing/invoices/${c.facturaId}` (lives in inventory folder but is a billing link)
- `components/facturacion/facturas-list-view.tsx:176` — `/facturacion/reportes/consumo-insumos` → **flipped in Task 5** (reports). Leave for now (it 404s only if reports not yet done; if Task 5 follows immediately, acceptable — OR set to `/reports/supply-consumption` now and land the folder in Task 5. Recommended: change the string here now to `/reports/supply-consumption` and note the target lands in Task 5.)

**Files — central tables:**
- `components/app-sidebar.tsx:109` — `REAL_ROUTES` entry `"/facturacion"` → `"/billing"`
- `lib/nav-manifest.ts:29-37` — flip the billing rows:
  - `/facturacion` → `/billing/invoices`
  - `/facturacion/general` → `/billing/invoices/new`
  - `/facturacion/grupos` → `/billing/groups`
  - `/facturacion/devoluciones` → `/billing/returns`
  - `/consultas` → `/billing/consultations`
  - `/consultas/devoluciones` → `/billing/consultations/returns`
  - (`/facturacion/reportes/consumo-insumos`, `/facturacion/ventas-por-grupo`, `/facturacion/ventas-por-usuario` → Task 5)
- `lib/nav-manifest.ts:42-44` — `/caja/consulta` → `/billing/cash/consultation`; `/caja/general` → `/billing/cash/general`; `/caja/cuadre-general` → `/billing/cash/summary`
- `lib/nav/nav-groups.test.ts:16,20,30` — test fixtures use `/facturacion/a`,`/facturacion/b` as arbitrary paths; these are fixtures, not real routes — **leave unchanged** (they test grouping logic, not real routes) OR update to `/billing/*` for tidiness (optional).

**Verify:**
- [ ] `npm run typecheck` clean; `npm test` green; build gate 63 pages.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect)\([^)]*/(facturacion|consultas|caja)\b" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits.
- [ ] :8080 smoke: invoices list, invoice detail (`[id]`), return flow, groups, returns, consultations, cash `[division]` (consultation/general), cash summary all open.
- [ ] Commit + PR: `feat(routes): billing → /billing/* English routes (route-reorg Phase 1)`.

---

### Task 2 (PR 2): inventory — `/inventario` + `/precios` → `/inventory/*`

Master §8 "Inventory".

**Folder moves:**
```bash
git mv "app/(app)/inventario" "app/(app)/inventory"
git mv "app/(app)/inventory/existencias" "app/(app)/inventory/stock"
git mv "app/(app)/inventory/viales" "app/(app)/inventory/vials"
git mv "app/(app)/inventory/productos" "app/(app)/inventory/products"
git mv "app/(app)/inventory/proveedores" "app/(app)/inventory/suppliers"
git mv "app/(app)/inventory/presentaciones-proveedor" "app/(app)/inventory/supplier-presentations"
git mv "app/(app)/inventory/recibir-compra" "app/(app)/inventory/receive-purchase"
git mv "app/(app)/inventory/recepcion-factura" "app/(app)/inventory/invoice-reception"
git mv "app/(app)/inventory/recetas" "app/(app)/inventory/recipes"
git mv "app/(app)/inventory/transferencias" "app/(app)/inventory/transfers"
git mv "app/(app)/inventory/transfers/nueva" "app/(app)/inventory/transfers/new"
git mv "app/(app)/inventory/planificacion" "app/(app)/inventory/planning"
git mv "app/(app)/precios" "app/(app)/inventory/prices"
```

**Manifest flips (`lib/nav/manifest.ts`):**
```ts
{ clave: "inventario-index", route: "/inventory" },
{ clave: "inventario-existencias", route: "/inventory/stock" },
{ clave: "inventario-viales", route: "/inventory/vials" },
{ clave: "inventario-productos", route: "/inventory/products" },
{ clave: "inventario-proveedores", route: "/inventory/suppliers" },
{ clave: "inventario-amp", route: "/inventory/supplier-presentations" },
{ clave: "inventario-recibir", route: "/inventory/receive-purchase" },
{ clave: "inventario-recetas", route: "/inventory/recipes" },
{ clave: "inventario-transferencias", route: "/inventory/transfers" },
{ clave: "precios", route: "/inventory/prices" },
```

**Inline ref edits:**
- `components/inventario/inventario-index.tsx:13-23` — `SECTIONS` hrefs: `/inventario/existencias`→`/inventory/stock`, `/inventario/viales`→`/inventory/vials`, `/inventario/productos`→`/inventory/products`, `/inventario/recibir-compra`→`/inventory/receive-purchase`, `/inventario/planificacion`→`/inventory/planning`, `/inventario/recepcion-factura`→`/inventory/invoice-reception`, `/inventario/transferencias`→`/inventory/transfers`, `/inventario/recetas`→`/inventory/recipes`, `/inventario/proveedores`→`/inventory/suppliers`, `/inventario/presentaciones-proveedor`→`/inventory/supplier-presentations`, `/precios`→`/inventory/prices`.
- `components/inventario/transferencias/transferencia-nueva.tsx:105,114` — `/inventario/transferencias` → `/inventory/transfers`
- `components/inventario/transferencias/transferencia-recibir.tsx:136,150,171` — `/inventario/transferencias` → `/inventory/transfers`
- `components/inventario/transferencias/transferencias-list.tsx:82` — `/inventario/transferencias/nueva` → `/inventory/transfers/new`
- `components/inventario/transferencias/transferencias-list.tsx:129,202` — `/inventario/transferencias/${tr.id}` → `/inventory/transfers/${tr.id}`
- `components/inventario/productos-admin.tsx:274` — `/inventario/recetas?compuestoId=${p.id}` → `/inventory/recipes?compuestoId=${p.id}`
- `lib/nav/nav-groups.test.ts:37,43` — `/inventario/a` fixtures — leave (grouping test data) or update (optional).

**Central tables:**
- `components/app-sidebar.tsx:106,111-116` — `REAL_ROUTES`: `/inventario`→`/inventory`, `/inventario/productos`→`/inventory/products`, `/inventario/proveedores`→`/inventory/suppliers`, `/inventario/presentaciones-proveedor`→`/inventory/supplier-presentations`, `/inventario/recibir-compra`→`/inventory/receive-purchase`, `/inventario/recetas`→`/inventory/recipes`, `/precios`→`/inventory/prices`.
- `lib/nav-manifest.ts:46-56,58` — flip all `/inventario/*` rows + `/precios` per the manifest map above (this file also has `/inventario/existencias`,`/inventario/viales`,`/inventario/planificacion` which mirror the same targets).

**Verify:**
- [ ] typecheck/test/build.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect)\([^)]*/(inventario|precios)\b" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits.
- [ ] :8080 smoke: inventory hub + every section + transfers (list/new/`[id]`), prices.
- [ ] Commit + PR: `feat(routes): inventory → /inventory/* English routes (Phase 1)`.

---

### Task 3 (PR 3): scheduling — `/citas` + `/calendario` → `/scheduling/*`

Master §8 "Scheduling".

**Folder moves:**
```bash
mkdir -p "app/(app)/scheduling"
git mv "app/(app)/citas" "app/(app)/scheduling/appointments"
git mv "app/(app)/scheduling/appointments/agenda/[fecha]" "app/(app)/scheduling/appointments/[date]"  # flatten agenda/[fecha] → [date]
git mv "app/(app)/scheduling/appointments/agenda/cupos" "app/(app)/scheduling/slots"
git mv "app/(app)/calendario" "app/(app)/scheduling/calendar"
# citas/config/columnas → configuration/boards/columns is handled in Task 6 (configuration); move it there.
```
> `citas/agenda/` had children `[fecha]` and `cupos`. After moving `citas →
> scheduling/appointments`, relocate `appointments/agenda/[fecha]` →
> `appointments/[date]` and `appointments/agenda/cupos` → `scheduling/slots`,
> then remove the now-empty `agenda/` dir. `citas/config/columnas` moves to
> configuration in Task 6.

**Manifest flips:**
```ts
{ clave: "citas", route: "/scheduling/appointments" },
{ clave: "cupos", route: "/scheduling/slots" },
{ clave: "calendario", route: "/scheduling/calendar" },
```

**Inline ref edits:**
- `components/agenda/agenda-config.tsx:27` — `/citas` → `/scheduling/appointments`
- `components/agenda/dia-view.tsx:125` — `/citas` → `/scheduling/appointments`
- `components/agenda/dia-view.tsx:165` — `/citas/agenda/cupos` → `/scheduling/slots`
- `components/agenda/medicas-calendar.tsx:184` — `/citas/agenda/${iso}` → `/scheduling/appointments/${iso}`
- `components/agenda/medicas-calendar.tsx:187` — `/citas/agenda/${c ? c.fecha : ""}` → `/scheduling/appointments/${c ? c.fecha : ""}`
- `components/tablero/tablero-editor.tsx:51` — `/citas` → `/scheduling/appointments`
- `components/frontdesk/frontdesk-board.tsx:185` — `/citas?tab=servicios&volver=…` → `/scheduling/appointments?tab=servicios&volver=…`

**Central tables:**
- `components/app-sidebar.tsx:108` — `REAL_ROUTES` `"/citas"` → `"/scheduling"`
- `lib/nav-manifest.ts:14,16,17` — `/citas`→`/scheduling/appointments`, `/calendario`→`/scheduling/calendar`, `/citas/agenda/cupos`→`/scheduling/slots`. (Line 18 `/citas/config/columnas` → Task 6 configuration.)

**Verify:**
- [ ] typecheck/test/build.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect)\([^)]*/(citas|calendario)\b" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits (except the `/citas/config/columnas` manifest row deferred to Task 6 — track it).
- [ ] :8080 smoke: appointments, day agenda `[date]`, slots, calendar.
- [ ] Commit + PR: `feat(routes): scheduling → /scheduling/* English routes (Phase 1)`.

---

### Task 4 (PR 4): patients — `/clientes` + `/pacientes` → `/patients/*`

Master §8 "Patients". Note the `cambio-de-protocolo` manifest route was already
fixed in Phase 0 to `/pacientes/cambio-protocolo`; here it moves to
`/patients/protocol-change`.

**Folder moves:**
```bash
git mv "app/(app)/clientes" "app/(app)/patients"
git mv "app/(app)/pacientes/cambio-protocolo" "app/(app)/patients/protocol-change"
git mv "app/(app)/pacientes/disponibilidad-legado" "app/(app)/patients/legacy-availability"
git mv "app/(app)/patients/legacy-availability/preparacion" "app/(app)/patients/legacy-availability/preparation"
rmdir "app/(app)/pacientes" 2>/dev/null || true  # now empty
```
> `/clientes/[id]` moves with the folder → `/patients/[id]`.

**Manifest flips:**
```ts
{ clave: "clientes", route: "/patients" },
{ clave: "cambio-de-protocolo", route: "/patients/protocol-change" },
```

**Inline ref edits:**
- `app/(app)/patients/[id]/page.tsx:63,83` — `router.push("/clientes")` → `router.push("/patients")`
- `app/(app)/patients/page.tsx:185` — `/clientes/${p.id}` → `/patients/${p.id}`
- `app/(app)/patients/page.tsx:245` — `/clientes/${saved.id}` → `/patients/${saved.id}`
- `app/(app)/inventory/viales/page.tsx:280` (path after Task 2: `app/(app)/inventory/vials/page.tsx`) — `/clientes/${c.pacienteId}` → `/patients/${c.pacienteId}`
- `app/(app)/patients/legacy-availability/preparation/page.tsx:118` — `/pacientes/disponibilidad-legado…` → `/patients/legacy-availability…`
- Placeholders (user-facing example text, cosmetic — update for polish): `components/admin/menu-admin.tsx:225` `placeholder="/pacientes"` → `"/patients"`; `components/configuracion/column-config-dialog.tsx:434` `placeholder="/clientes/:pacienteId"` → `"/patients/:pacienteId"`.

**Central tables:**
- `components/app-sidebar.tsx:107` — `REAL_ROUTES` `"/clientes"` → `"/patients"`
- `lib/nav-manifest.ts:22-25` — `/clientes`→`/patients`, `/pacientes/disponibilidad-legado`→`/patients/legacy-availability`, `/pacientes/cambio-protocolo`→`/patients/protocol-change`, `/pacientes/disponibilidad-legado/preparacion`→`/patients/legacy-availability/preparation`.

**Verify:**
- [ ] typecheck/test/build.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect)\([^)]*/(clientes|pacientes)\b" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits.
- [ ] :8080 smoke: patients list, patient detail `[id]`, protocol-change (no 404), legacy-availability + preparation.
- [ ] Commit + PR: `feat(routes): patients → /patients/* English routes (Phase 1)`.

---

### Task 5 (PR 5): reports — `/estadisticas` + billing reportes → `/reports/*`

Master §8 "Reports". Pulls report pages OUT of `/estadisticas` and out of the
old `/facturacion` tree (now under `/billing/invoices/…` after Task 1).

**Folder moves:**
```bash
mkdir -p "app/(app)/reports"
git mv "app/(app)/estadisticas/servicios" "app/(app)/reports/services"
git mv "app/(app)/estadisticas/diarias" "app/(app)/reports/daily"
rmdir "app/(app)/estadisticas" 2>/dev/null || true
# these moved under billing/invoices in Task 1; relocate to reports now:
git mv "app/(app)/billing/invoices/reportes/consumo-insumos" "app/(app)/reports/supply-consumption"
git mv "app/(app)/billing/invoices/ventas-por-grupo" "app/(app)/reports/sales-by-group"
git mv "app/(app)/billing/invoices/ventas-por-usuario" "app/(app)/reports/sales-by-user"
rmdir "app/(app)/billing/invoices/reportes" 2>/dev/null || true
```
> If Task 1 chose NOT to move `reportes`/`ventas-*` under billing, adjust the
> source paths to `app/(app)/facturacion/…` accordingly.

**Manifest flips:**
```ts
{ clave: "estadisticas-servicios", route: "/reports/services" },
{ clave: "estadisticas-diarias", route: "/reports/daily" },
{ clave: "consumo-insumos", route: "/reports/supply-consumption" },
{ clave: "ventas-por-grupo", route: "/reports/sales-by-group" },
{ clave: "ventas-por-usuario", route: "/reports/sales-by-user" },
```

**Inline ref edits:**
- `components/facturacion/facturas-list-view.tsx:176` — `/facturacion/reportes/consumo-insumos` → `/reports/supply-consumption` (if not already changed in Task 1).

**Central tables:**
- `lib/nav-manifest.ts:39,40,33,34,35` — `/estadisticas/servicios`→`/reports/services`, `/estadisticas/diarias`→`/reports/daily`, `/facturacion/reportes/consumo-insumos`→`/reports/supply-consumption`, `/facturacion/ventas-por-grupo`→`/reports/sales-by-group`, `/facturacion/ventas-por-usuario`→`/reports/sales-by-user`.

**Verify:**
- [ ] typecheck/test/build.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect)\([^)]*/(estadisticas|facturacion/reportes|facturacion/ventas)" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits.
- [ ] :8080 smoke: all 5 report pages open.
- [ ] Commit + PR: `feat(routes): reports → /reports/* English routes (Phase 1)`.

---

### Task 6 (PR 6): configuration — `/configuracion` + `/auditoria` + `/settings/*` + `/servicios` + `/personal` (staff) → `/configuration/*`

Master §8 "Configuration". Folds in **staff** (decision #5: `/personal` →
`/configuration/staff`) and the scheduling-owned `citas/config/columnas`. `/admin`
stays TOP-LEVEL (decision #1) — path UNCHANGED here.

**Folder moves:**
```bash
git mv "app/(app)/configuracion" "app/(app)/configuration"
git mv "app/(app)/configuration/apariencia" "app/(app)/configuration/appearance"
git mv "app/(app)/configuration/tableros" "app/(app)/configuration/boards"
git mv "app/(app)/configuration/factura" "app/(app)/configuration/invoice"
git mv "app/(app)/configuration/numeracion" "app/(app)/configuration/numbering"
git mv "app/(app)/configuration/formatos" "app/(app)/configuration/formats"
git mv "app/(app)/configuration/datos-paciente" "app/(app)/configuration/patient-fields"
git mv "app/(app)/configuration/requeridos" "app/(app)/configuration/required-fields"
git mv "app/(app)/configuration/panel-enfermeria" "app/(app)/configuration/nursing-panel"
git mv "app/(app)/servicios" "app/(app)/configuration/services"
git mv "app/(app)/auditoria" "app/(app)/configuration/audit"
git mv "app/(app)/personal" "app/(app)/configuration/staff"
# scheduling-owned board columns → configuration/boards/columns
mkdir -p "app/(app)/configuration/boards"
git mv "app/(app)/scheduling/appointments/config/columnas" "app/(app)/configuration/boards/columns" 2>/dev/null \
  || git mv "app/(app)/citas/config/columnas" "app/(app)/configuration/boards/columns"
# personal appearance (avatar) → configuration/preferences/appearance
mkdir -p "app/(app)/configuration/preferences"
git mv "app/(app)/settings/appearance" "app/(app)/configuration/preferences/appearance"
# admin board-modules → configuration/board-modules
git mv "app/(app)/settings/tablero-modulos" "app/(app)/configuration/board-modules"
# orphan /settings/tableros → DELETE in Phase 3 (leave for now)
```

**Manifest flips:**
```ts
{ clave: "configuracion-apariencia", route: "/configuration/appearance" },
{ clave: "configuracion-tableros", route: "/configuration/boards" },
{ clave: "config-factura", route: "/configuration/invoice" },
{ clave: "config-formatos", route: "/configuration/formats" },
{ clave: "config-datos-paciente", route: "/configuration/patient-fields" },
{ clave: "config-requeridos", route: "/configuration/required-fields" },
{ clave: "servicios-config", route: "/configuration/services" },
{ clave: "auditoria", route: "/configuration/audit" },
{ clave: "personal", route: "/configuration/staff" },
{ clave: "configuracion-modulos", route: "/configuration/board-modules" },
// admin stays: { clave: "admin", route: "/admin" }  ← UNCHANGED (decision #1)
```

**Inline ref edits:**
- `components/user-menu.tsx:48` — gate `startsWith("/configuracion/")` → `startsWith("/configuration/")`
- `components/user-menu.tsx:134` — `/configuracion` → `/configuration`
- `components/user-menu.tsx:144` — `/settings/tablero-modulos` → `/configuration/board-modules`
- `components/user-menu.tsx:155` — `/settings/appearance` → `/configuration/preferences/appearance`
- `app/(app)/configuration/page.tsx:19-27` — `SECCIONES` hrefs: `/configuracion/apariencia`→`/configuration/appearance`, `/configuracion/menu`→`/configuration/menu`, `/configuracion/tableros`→`/configuration/boards`, `/configuracion/factura`→`/configuration/invoice`, `/configuracion/numeracion`→`/configuration/numbering`, `/configuracion/formatos`→`/configuration/formats`, `/configuracion/datos-paciente`→`/configuration/patient-fields`, `/configuracion/requeridos`→`/configuration/required-fields`, `/configuracion/panel-enfermeria`→`/configuration/nursing-panel`.
- `app/(app)/configuration/page.tsx:35` — the `SECCIONES.filter((s) => rutasDelMenu.has(s.href))` compares hrefs against BE menu paths. Since the BE still emits old paths, this gate must compare against the RESOLVED route. Change to resolve menu items via `routeForClave` before building `rutasDelMenu` (import `routeForClave`, `useMenu`), OR compare `s.href` against `routeForClave(m.clave, m.path)`. Concretely: build `const rutasDelMenu = new Set(menu.map((m) => routeForClave(m.clave, m.path)));`.
- `components/configuracion/tableros-list.tsx:71` — `/configuracion/tableros/${r.clave}` → `/configuration/boards/${r.clave}`
- `components/configuracion/tablero-editor-admin.tsx:72` — `/configuracion/tableros` → `/configuration/boards`

**Central tables:**
- `components/app-sidebar.tsx:117,120,121` — `REAL_ROUTES`: `/servicios`→`/configuration/services`, `/configuracion/tableros`→`/configuration/boards`, `/settings`→`/configuration` (the `/settings` prefix is gone after moves — replace with `/configuration`).
- `lib/nav-manifest.ts:18` — `/citas/config/columnas` → `/configuration/boards/columns`
- `lib/nav-manifest.ts:59,62-70,72-74` — flip all configuration rows: `/servicios`→`/configuration/services`, `/configuracion/factura`→`/configuration/invoice`, `/configuracion/numeracion`→`/configuration/numbering`, `/configuracion/requeridos`→`/configuration/required-fields`, `/configuracion/formatos`→`/configuration/formats`, `/configuracion/tableros`→`/configuration/boards`, `/configuracion/menu`→`/configuration/menu`, `/configuracion/panel-enfermeria`→`/configuration/nursing-panel`, `/configuracion/datos-paciente`→`/configuration/patient-fields`, `/auditoria`→`/configuration/audit`, `/settings/appearance`→`/configuration/preferences/appearance`, `/settings/tablero-modulos`→`/configuration/board-modules`, `/settings/tableros`→(orphan; delete Phase 3 — leave the manifest row, it's admin-catch-all, but note it 404s until deleted). Also add `/personal`→`/configuration/staff` (row at `lib/nav-manifest.ts:15`).

**Verify:**
- [ ] typecheck/test/build.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect)\([^)]*/(configuracion|auditoria|servicios|personal|settings)\b" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits (except the intentional `/settings/tableros` orphan row + auth `/settings`? there is no auth /settings — all /settings is config). `/servicios` must be gone; watch for false-positives on `servicios` substrings inside `/tablero/servicios` (that's Task 7) — scope the regex to a leading `/servicios\b`.
- [ ] :8080 smoke: configuration hub + every section; avatar menu (Configuración, board-modules, personal appearance); audit; staff; board columns.
- [ ] Commit + PR: `feat(routes): configuration (+staff, +audit) → /configuration/* (Phase 1)`.

---

### Task 7 (PR 7): services / boards — `/panel` + `/tablero` + `/atencion` + `/frontdesk` → `/services/*` + `/boards/*`

Master §8 "Services / Boards". The `/atencion` and `/frontdesk` redirect stubs
are DELETED in Phase 3 — here we only repoint their targets and the board space.

**Folder moves:**
```bash
mkdir -p "app/(app)/services"
git mv "app/(app)/panel/enfermeria" "app/(app)/services/nursing-panel"
rmdir "app/(app)/panel" 2>/dev/null || true
git mv "app/(app)/tablero" "app/(app)/boards"   # /tablero/[clave] → /boards/[clave]
```
> `/atencion` and `/frontdesk` folders (redirect stubs) are left in place until
> Phase 3 deletes them; but their redirect TARGETS change below.

**Manifest flips:**
```ts
{ clave: "panel-enfermeria", route: "/services/nursing-panel" },
{ clave: "atencion", route: "/boards/atencion" },
{ clave: "frontdesk", route: "/boards/frontdesk" },
{ clave: "servicios", route: "/boards/servicios" },
```
> Note: `atencion`/`frontdesk`/`servicios` are dynamic boards. Their manifest
> route now points at `/boards/*`. Any OTHER dynamic board not individually
> seeded (e.g. `operaciones`) is handled by the resolver's `/tablero/* → /boards/*`
> fallback automatically — no manifest entry needed.

**Inline ref edits (board base `/tablero/${clave}` → `/boards/${clave}`, and fixed targets):**
- `app/(app)/atencion/page.tsx:8` — `redirect("/tablero/atencion")` → `redirect("/boards/atencion")` (stub deleted Phase 3, but keep valid meanwhile)
- `app/(app)/frontdesk/page.tsx:7` — `permanentRedirect("/tablero/frontdesk")` → `permanentRedirect("/boards/frontdesk")`
- `app/(app)/boards/[clave]/page.tsx:17` (was `tablero/[clave]`) — `if (clave === "servicios") redirect("/tablero/frontdesk")` → `redirect("/boards/frontdesk")`
- `app/(app)/billing/invoices/[id]/page.tsx:404` — the `"/tablero/atencion"` half → `"/boards/atencion"`
- `components/configuracion/tableros-list.tsx:68` — `r.ruta ?? /tablero/${r.clave}` → `r.ruta ?? /boards/${r.clave}`
- `components/configuracion/tablero-editor-admin.tsx:323` — `const path = /tablero/${clave}` → `/boards/${clave}`

**Central tables:**
- `components/app-sidebar.tsx:110` — `REAL_ROUTES` `"/tablero"` → `"/boards"`
- `lib/nav-manifest.ts:61` — `/panel/enfermeria` → `/services/nursing-panel`

**Verify:**
- [ ] typecheck/test/build.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect|permanentRedirect)\([^)]*/(panel|tablero)\b" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits.
- [ ] :8080 smoke: nursing panel; boards (atencion, frontdesk, servicios, operaciones via fallback) all open at `/boards/*`; the old `/atencion` and `/frontdesk` stubs still redirect (until Phase 3 deletes them).
- [ ] Commit + PR: `feat(routes): services + boards → /services/*, /boards/* (Phase 1)`.

---

### Task 8 (PR 8): communications — `/comunicaciones` → `/communications`

Master §8 "Communications". Small.

**Folder moves:**
```bash
git mv "app/(app)/comunicaciones" "app/(app)/communications"
```

**Manifest flips:**
```ts
{ clave: "comunicaciones", route: "/communications" },
```

**Inline ref edits:**
- `components/comunicaciones/alertas-bell.tsx:164` — `router.push("/comunicaciones")` → `router.push("/communications")`

**Central tables:**
- `components/app-sidebar.tsx:118` — `REAL_ROUTES` `"/comunicaciones"` → `"/communications"`
- `lib/nav-manifest.ts:27` — `/comunicaciones` → `/communications`

**Verify:**
- [ ] typecheck/test/build.
- [ ] Grep gate: `grep -rnE "(href|push|replace|redirect)\([^)]*/comunicaciones\b" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"` → zero hits.
- [ ] :8080 smoke: alert bell → communications page.
- [ ] Commit + PR: `feat(routes): communications → /communications (Phase 1)`.

---

## Phase 1 completion checklist

- [ ] All 8 category PRs merged.
- [ ] Full grep gate (master §6) across ALL old prefixes → zero hits outside `lib/api/*`.
- [ ] `/admin` still top-level and working (path unchanged).
- [ ] Build gate: page count unchanged (renames don't add/remove pages; the `general→new` rename keeps its page).
- [ ] `cambio-de-protocolo` opens at `/patients/protocol-change`.
- [ ] Proceed to `…-phase2-groups.md` (FE-owned grouping) — grouping is still BE-driven until then.

## Notes / gotchas

- **Grep false positives:** `servicios` appears both as `/servicios` (config) and `/tablero/servicios` (board). Anchor category greps to a leading `/servicios\b` vs `/tablero/servicios` to avoid cross-hits.
- **`facturas-list-view.tsx:176`** (consumo-insumos) spans billing→reports; decide in Task 1 whether to point it at `/reports/supply-consumption` immediately (recommended) or after Task 5.
- **`configuracion/page.tsx:35` menu gate** compares hub hrefs against BE menu paths — it MUST resolve via `routeForClave` after the rename, else the config hub hides all sections. This is the one non-mechanical edit in Task 6.
- **Test fixtures** in `nav-groups.test.ts` use `/facturacion/*`, `/inventario/*` as arbitrary strings — they exercise grouping logic, not real routes; leaving them is fine.
- **BE seed paths stay old** (no migration). The resolver bridges old BE paths → new FE routes for every known clave; unknown/dynamic covered by fallback. This is exactly why Phase 0 came first.
