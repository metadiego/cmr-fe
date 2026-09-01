# Design spec — cmr-fe navy design-system overhaul (PR1: foundation + flagship screens)

**Date:** 2026-08-31
**Status:** Approved (design), pending implementation plan
**Author:** Diego + Claude

## Goal

Bring cmr-fe up to a real, consistent design system modeled on the CMR Health **EHR**
app (`/Users/diegoolalde/Documents/Dev/cmr/ehr`, package `@workspace/ui`). Today cmr-fe
has self-consistent shadcn primitives but almost no adoption: no `Card` primitive, 39
hand-rolled tables, 46+ ad-hoc panels, 28 duplicated alert boxes, hundreds of hardcoded
`amber/emerald/sky/red` colors, no page wrapper, and a bland placeholder light theme.

This is a **standardization/adoption** effort, not a rebuild. PR1 establishes the system
(tokens + primitives + shell) and migrates 4 flagship screens to prove it. Later PRs sweep
the rest domain-by-domain.

### Hard constraints

- **Presentational only.** No changes to data, API calls, routing, business logic, or
  behavior. Diffs are markup/classes/tokens.
- **Preserve print styles** (`@media print`: `.recibo-print` thermal receipts,
  `.formato-print` medical formats, `.solo-print`) and `--app-bg-image` — do not touch.
- **Preserve permission gating** (`useCan`) and i18n (`next-intl` `t()` keys) everywhere.
- Icons stay **@hugeicons** (no churn to lucide).
- All work on a branch + PR. **Do not merge to `main`** (prod auto-deploys on push to main).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Brand color | **Navy — match EHR** (`#3a6ea5` primary, `#14294a` rail/text) |
| Themes | **Light-only** (`forcedTheme="light"`); dark mode retired |
| App shell | **Dark-navy sidebar rail** (match EHR's two-tone shell) |
| PR1 scope | **Foundation + flagship screens**; rest in follow-up sweep PRs |
| Flagship screens | Agenda/tablero (citas), Facturación (list+detail), Inventario (productos/existencias), Clientes/pacientes (list+sheet) |
| Font | Switch sans **Public Sans → Geist** (match EHR) |

## Current vs target (reference)

Stacks are close: both Tailwind v4 (CSS-first, no config file), shadcn on `radix-ui`
unified package, `next-themes`, cva/clsx/tailwind-merge. Differences: cmr-fe style is
`radix-maia` + hugeicons + Public Sans; EHR is `radix-nova` + lucide + Geist, in a
Turborepo `@workspace/ui` package. Porting EHR component source is straightforward
(adapt `cn` import path `@workspace/ui/lib/utils` → `@/lib/utils`, swap the few lucide
icons in the sidebar for hugeicons).

## Section 1 — Design tokens (`app/globals.css`)

Rewrite the `:root` light palette to the EHR navy values (OKLCH). Remove the `.dark`
block. Keep the existing extra semantic tokens (`--success`/`--warning`/`--info`/
`--overlay`) but give them real navy-system tint values.

### Light `:root` (target values, from EHR)

```
--background:        oklch(1 0 0);              /* white */
--foreground:        oklch(0.24 0.06 262);      /* #14294a navy text */
--card:              oklch(1 0 0);
--card-foreground:   oklch(0.24 0.06 262);
--popover:           oklch(1 0 0);
--popover-foreground:oklch(0.24 0.06 262);
--primary:           oklch(0.53 0.10 250);      /* #3a6ea5 */
--primary-foreground:oklch(1 0 0);
--secondary:         oklch(0.94 0.004 255);     /* #eceef1 */
--secondary-foreground: oklch(0.34 0.02 258);
--muted:             oklch(0.975 0.004 250);    /* #f5f7fa canvas */
--muted-foreground:  oklch(0.66 0.02 255);      /* #8a93a3 */
--accent:            oklch(0.94 0.03 255);       /* #e7eefa navy tint */
--accent-foreground: oklch(0.33 0.06 250);
--destructive:       oklch(0.577 0.245 27.325);  /* #dc2626 */
--border:            oklch(0.92 0.006 255);      /* #e6e9ef */
--input:             oklch(0.92 0.006 255);
--ring:              oklch(0.53 0.10 250);
--chart-1:           oklch(0.53 0.10 250);        /* navy ramp */
--chart-2:           oklch(0.47 0.09 252);
--chart-3:           oklch(0.40 0.08 255);
--chart-4:           oklch(0.33 0.06 250);
--chart-5:           oklch(0.24 0.06 262);
--radius:            0.5rem;                       /* was 0.625rem */
/* sidebar (dark navy rail) */
--sidebar:                 oklch(0.24 0.06 262);   /* #14294a */
--sidebar-foreground:      oklch(0.84 0.03 255);   /* #c9d5e8 */
--sidebar-primary:         oklch(0.53 0.10 250);   /* active */
--sidebar-primary-foreground: oklch(1 0 0);
--sidebar-accent:          oklch(1 0 0 / 6%);       /* hover */
--sidebar-accent-foreground: oklch(1 0 0);
--sidebar-border:          oklch(1 0 0 / 7%);
--sidebar-ring:            oklch(0.53 0.10 250);
```

### Status tint tokens (map existing → EHR-style tints)

```
--success:            oklch(0.95 0.03 150);  --success-foreground:  oklch(0.45 0.10 150);
--warning:            oklch(0.96 0.04 75);   --warning-foreground:  oklch(0.50 0.10 75);
--info:               oklch(0.94 0.03 255);  --info-foreground:     oklch(0.33 0.06 250);
```

### Card elevation

Single reusable shadow, applied by the `Card`/`DataTable` primitives:
`shadow-sm shadow-[rgba(16,32,64,0.06)]` (faint navy-tinted). Encode once (a utility or
just the Card class) so every surface elevates identically.

### Radius / typography

- `--radius: 0.5rem`; keep the derived `--radius-sm..4xl` scale. Convention: containers/
  cards `rounded-xl`, controls (button/input/tabs) `rounded-lg`, inner items `rounded-md`,
  badges `rounded-4xl` (pill).
- Font: **Geist** (sans) + keep Geist Mono. Update `app/layout.tsx`; `--font-sans` → Geist.
- Density: compact — controls ~`h-8`, table cells `p-2`, micro-labels `text-[11px]`.

### Dark-mode retirement

- `ThemeProvider`: set `forcedTheme="light"`, drop `defaultTheme="system"`/`enableSystem`.
- Remove the `d`-hotkey toggle and any theme-switch UI.
- Remove the `.dark { … }` block from `globals.css`. Keep `@custom-variant dark` only if a
  primitive references `dark:` classes harmlessly; otherwise remove.

## Section 2 — Primitives (`components/ui/`)

Port from EHR, adapting import paths/icons. Each is a small, independently testable unit.

1. **`card.tsx`** (NEW — none exists today). Root: `rounded-xl bg-card ring-1
   ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] text-sm`, `--card-spacing`
   (16px default, 12px `size="sm"`). Subcomponents: `CardHeader` (grid),
   `CardTitle` (`font-heading text-base font-medium`), `CardDescription`
   (`text-sm text-muted-foreground`), `CardAction`, `CardContent`, `CardFooter`
   (`border-t bg-muted/50`). **Replaces 46+ ad-hoc panels.**

2. **`page.tsx`** (NEW) — `PageContainer` (`flex flex-col gap-4`) + `PageHeader`
   (title `text-xl font-semibold` + optional muted `text-xs` subcount + `actions` slot on
   the right). Standardizes page scaffolding; kills scattered `max-w-*` widths.

3. **`data-table.tsx`** (NEW, lightweight presentational wrapper) — card frame
   (`overflow-hidden rounded-xl border bg-card` + card shadow) around the retuned `Table`,
   with built-in `TableEmpty` / `TableLoading` / `TableError` rows. NOT TanStack — consumers
   keep their existing data logic and just render `Table*` markup inside.

4. **Retune `table.tsx`** to EHR spec: `TableHead` = `h-10 px-2 text-xs uppercase
   tracking-wide text-muted-foreground font-semibold` (no header fill); `TableRow` hover =
   `hover:bg-accent/40`; `TableCell` = `p-2`.

5. **`sidebar.tsx`** (NEW) — port EHR's sidebar primitive: `SidebarProvider`, `Sidebar`
   (`collapsible="icon"`), `SidebarInset`, `SidebarMenu*`, `SidebarGroup*`, cookie-persisted
   state, `Cmd/Ctrl+B` toggle, `--sidebar*` tokens. Widths 16rem / 3rem icon.

6. **`badge.tsx`** — add `success` / `warning` / `info` tinted variants (EHR values above),
   keep existing variants. Mapping for sweeps: `amber→warning`, `emerald/green→success`,
   `sky/blue→info`, `red→destructive`.

7. **`alert.tsx`** — confirm/adjust `destructive` variant to match the box duplicated ×28
   (`border-destructive/30 bg-destructive/10 text-destructive`), ready to replace inline boxes.

8. **`empty-state.tsx`** + a small **segmented control** (agenda/frontdesk period/board
   switchers): `inline-flex gap-0.5 rounded-lg border bg-card p-0.5`, active =
   `bg-accent font-medium text-accent-foreground`.

## Section 3 — App shell (navy sidebar rail)

Replace the dual shell (`components/app-shell.tsx`'s `useNavVista()` switch between
`SiteHeader` default and beta `NavSidebar`) with a single sidebar shell:

```
SidebarProvider
  AppSidebar (dark navy rail, collapsible="icon")
    brand mark (primary tile + "CMR")
    grouped nav sections (from lib/nav-manifest.ts, permission-filtered via useCan)
    footer: locale select · me.email · roleName · sign-out
  SidebarInset
    header  (h-13, border-b bg-background px-5): SidebarTrigger · section title · Avatar (ml-auto)
    main    (flex-1 p-6): {children}
```

- `AppSidebar` is a new app component (`components/app-sidebar.tsx`) reusing the existing
  nav manifest + permission filtering + locale/sign-out logic; only the chrome changes.
- Remove `SiteHeader`, `NavSidebar`, and the `useNavVista` switch.
- Active state: `pathname.startsWith(href)`, `data-active` styling from the primitive.

## Section 4 — Flagship migrations

For each screen: ad-hoc panels → `Card`; hand-rolled `<table>` → `DataTable` + `Table*`;
inline error boxes → `Alert`; hardcoded status colors → tokens / `Badge` variants; page
wrapped in `PageContainer` + `PageHeader`. Data/logic untouched.

1. **Agenda / tablero (citas)** — board columns/cards, status `Badge`s, segmented control,
   the post-acción modal (`nueva-cita-modal.tsx`, already trimmed in the prescripción PR).
2. **Facturación** — list view (`facturas-list-view.tsx`, hand-rolled table → `DataTable`,
   empty/loading/error states, `PageHeader`) + invoice detail (`Card` layout, `Alert`).
3. **Inventario** — `productos-admin.tsx` + existencias viewer: the worst hand-rolled
   tables (sticky headers, semáforo colors) → `DataTable` + `Badge` status tokens.
4. **Clientes / pacientes** — list (`DataTable`, `PageHeader`) + `AccionesPacienteSheet`
   (`Sheet` + `Card` history panels).

## Section 5 — Out of scope (follow-up PRs)

Queued as mechanical, domain-grouped sweep PRs once primitives exist:

- Remaining ~35 hand-rolled tables → `DataTable`.
- Remaining ~40 ad-hoc panels → `Card`.
- Remaining ~24 inline alert boxes → `Alert`.
- Full hardcoded-color → token sweep across the other ~65 pages
  (amber→warning, emerald→success, sky→info, red→destructive).
- Dashboard/home build-out (currently near-empty) — stat tiles + section bands + charts.

Suggested sweep order (by surface area / traffic): inventario-rest → facturacion-rest →
configuracion → caja → estadisticas → remaining.

## Section 6 — Risks & verification

- **Prod auto-deploys on merge to `main`** → branch + PR only; do not merge here.
- **Shell swap touches every page's chrome** — single-component change; verify on the 4
  flagship screens + a spot-check of a few others.
- **Light-only removes dark mode** (intended) — remove the toggle to avoid a half-alive
  feature; confirm no component hard-depends on `.dark`.
- **Font swap** (Public Sans → Geist) — one file; verify weights load.
- **Verification gate:** `npm run typecheck` ✓, `npm run build` ✓ (with dummy Supabase env:
  `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`/`API_BASE_URL`), `npm run lint` (no new issues in
  touched files), + visual pass (dev server / screenshots) on the 4 flagship screens.
- **Repo push identity:** `metadiego/cmr-fe` requires `gh auth switch --user metadiego`
  for push/PR; restore `dolalde-sparkiq` after.

## Success criteria

- `Card`, `PageContainer`/`PageHeader`, `DataTable`, `Sidebar` primitives exist and are used.
- Navy light palette live; dark mode gone; Geist font active.
- The 4 flagship screens use only primitives + tokens (no hand-rolled tables, ad-hoc
  panels, inline alert boxes, or hardcoded status colors within them).
- Build/typecheck/lint green; flagship screens visually match the EHR language
  (navy rail, rounded-xl cards, compact tables, tinted badges).
- No behavioral/data diffs; print styles intact.
