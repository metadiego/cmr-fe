# Navy Design-System Overhaul — Implementation Plan (PR1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give cmr-fe a real, EHR-style navy design system — cohesive tokens, a set of missing primitives (Card, PageContainer/PageHeader, DataTable, Sidebar), a dark-navy sidebar shell, and 4 flagship screens migrated onto them — with zero behavioral change.

**Architecture:** Rewrite the light-theme tokens in `app/globals.css` to EHR's navy OKLCH palette and retire dark mode. Add the missing shadcn primitives (ported/adapted from the EHR `@workspace/ui` package) plus app-level wrappers. Replace the dual `SiteHeader`/`NavSidebar` shell with one navy sidebar shell. Migrate 4 flagship screens onto the primitives. Everything is presentational — markup/classes/tokens only.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind v4 (CSS-first, no config file), shadcn/ui on the `radix-ui` unified package, `class-variance-authority`, `next-themes`, `@hugeicons/react`, `next-intl`, Geist font.

## Global Constraints

- **Presentational only.** No changes to data, API calls, routing, business logic, or component behavior. Diffs are markup, class strings, tokens, and the shell wiring.
- **Preserve `@media print` blocks** (`.recibo-print`, `.formato-print`, `.solo-print`) and `--app-bg-image` in `app/globals.css` — never touch them.
- **Preserve `useCan()` permission gating and `next-intl` `t()` keys** in every file touched.
- **Icons stay `@hugeicons`** — do not introduce `lucide-react`. When porting EHR components that use lucide, swap to the hugeicons equivalent or an inline SVG.
- **Branch base:** work on `feat/design-system-navy`. It is branched off `origin/main` and does NOT contain the prescripción cleanup (PR #41). PR #41 and Task 13 (Agenda) both edit `components/tablero/nueva-cita-modal.tsx`. **Before starting Task 13, rebase this branch on `main` once PR #41 is merged** (or, if #41 is still open, rebase onto `cleanup/remove-prescripcion-fe`). Resolve the trivial overlap then.
- **Do NOT merge to `main`** (prod auto-deploys on push to main). Push + PR only. Pushing `metadiego/cmr-fe` requires `gh auth switch --user metadiego`; restore `dolalde-sparkiq` after.
- **Brand values (verbatim, use exactly):** primary `oklch(0.53 0.10 250)` (#3a6ea5), foreground/rail `oklch(0.24 0.06 262)` (#14294a), border `oklch(0.92 0.006 255)`, card shadow `shadow-sm shadow-[rgba(16,32,64,0.06)]`, radius `0.5rem`.
- **EHR source to port from:** `/Users/diegoolalde/Documents/Dev/cmr/ehr/cmr-ehr-fe/packages/ui/src/components/*` and `app/(app)/layout.tsx`. Adapt import `@workspace/ui/lib/utils` → `@/lib/utils`.

### Verification cycle "V" (run at each task's end unless noted)

```bash
# from repo root: /Users/diegoolalde/Documents/Dev/cmr/cmr-app/cmr-fe
npm run typecheck                              # tsc --noEmit — expect no errors
npm run lint                                   # eslint — expect NO NEW findings in files you touched
                                               # (pre-existing errors in cita-modal.tsx / clientes/page.tsx /
                                               #  tableros-list.tsx are known and NOT yours)
NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy-anon-key" \
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000" \
  npm run build                                # next build — expect "Compiled successfully" + route table
```

Visual pass (Tasks 9–14): run the dev server and eyeball the screen.
```bash
NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy-anon-key" \
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000" npm run dev   # http://localhost:8080
```

**Prerequisite:** run `npm ci` once before Task 1 (node_modules is not committed).

---

## File Structure

**Tokens / theme**
- `app/globals.css` — rewrite `:root`, delete `.dark`, add status tints (Task 1)
- `components/theme-provider.tsx` — force light, drop hotkey (Task 2)
- `app/layout.tsx` — Geist font (Task 3)

**New/updated primitives** (`components/ui/`)
- `card.tsx` (new, Task 4)
- `page.tsx` — `PageContainer`, `PageHeader` (new, Task 5)
- `table.tsx` (retune, Task 6) + `data-table.tsx` (new, Task 6)
- `badge.tsx` (status variants, Task 7)
- `alert.tsx` (verify, Task 7)
- `empty-state.tsx` + `segmented.tsx` (new, Task 7)
- `sidebar.tsx` (port from EHR, Task 8)

**App shell**
- `components/app-sidebar.tsx` (new, Task 9)
- `components/app-shell.tsx` (rewrite to single shell, Task 9)
- delete/retire `components/site-header.tsx`, `components/nav-sidebar.tsx`, the `useNavVista` hook

**Flagship migrations**
- Agenda/tablero (Task 13) · Facturación (Task 11) · Inventario (Task 12) · Clientes (Task 10)

Task order runs primitives → shell → simplest migration (Clientes) → up to the most entangled (Agenda, which needs the #41 rebase).

---

## Task 1: Navy tokens + retire dark CSS

**Files:**
- Modify: `app/globals.css` (the `:root` color block, the `.dark {…}` block, `--radius`)

**Interfaces:**
- Produces: the CSS custom properties every primitive consumes (`--primary`, `--card`, `--border`, `--sidebar*`, `--success/--warning/--info`, `--radius`).

- [ ] **Step 1:** Read `app/globals.css` in full. Identify: the `@custom-variant dark` line, the `@theme inline` block (keep as-is), the `:root { … }` color declarations, the `.dark { … }` block, the `@media print` blocks and `--app-bg-image` (KEEP untouched).

- [ ] **Step 2:** Replace the color declarations inside `:root` with these exact values (keep any non-color `:root` entries like `--app-bg-image`; keep the radius scale `--radius-sm..4xl` lines, only change the base `--radius`):

```css
  --radius: 0.5rem;

  --background: oklch(1 0 0);
  --foreground: oklch(0.24 0.06 262);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.24 0.06 262);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.24 0.06 262);
  --primary: oklch(0.53 0.10 250);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.94 0.004 255);
  --secondary-foreground: oklch(0.34 0.02 258);
  --muted: oklch(0.975 0.004 250);
  --muted-foreground: oklch(0.66 0.02 255);
  --accent: oklch(0.94 0.03 255);
  --accent-foreground: oklch(0.33 0.06 250);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.92 0.006 255);
  --input: oklch(0.92 0.006 255);
  --ring: oklch(0.53 0.10 250);

  --success: oklch(0.95 0.03 150);
  --success-foreground: oklch(0.45 0.10 150);
  --warning: oklch(0.96 0.04 75);
  --warning-foreground: oklch(0.50 0.10 75);
  --info: oklch(0.94 0.03 255);
  --info-foreground: oklch(0.33 0.06 250);

  --chart-1: oklch(0.53 0.10 250);
  --chart-2: oklch(0.47 0.09 252);
  --chart-3: oklch(0.40 0.08 255);
  --chart-4: oklch(0.33 0.06 250);
  --chart-5: oklch(0.24 0.06 262);

  --sidebar: oklch(0.24 0.06 262);
  --sidebar-foreground: oklch(0.84 0.03 255);
  --sidebar-primary: oklch(0.53 0.10 250);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(1 0 0 / 6%);
  --sidebar-accent-foreground: oklch(1 0 0);
  --sidebar-border: oklch(1 0 0 / 7%);
  --sidebar-ring: oklch(0.53 0.10 250);
```

Preserve the existing `--overlay` token if present (keep its current value). If `@theme inline` maps `--color-success`/`--color-warning`/`--color-info` etc., leave those mappings — they now resolve to the new tints.

- [ ] **Step 3:** Delete the entire `.dark { … }` block. If `@custom-variant dark (&:is(.dark *))` remains referenced by primitives' `dark:` classes, leaving it is harmless (no `.dark` element will exist); prefer to leave the `@custom-variant` line so ported components with `dark:` utilities still parse.

- [ ] **Step 4:** Run verification cycle V. Expect build to succeed. (No visual yet — the shell/font come later.)

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): paleta navy en :root y retiro de dark theme"
```

---

## Task 2: Force light theme, remove dark toggle

**Files:**
- Modify: `components/theme-provider.tsx`
- Search-and-remove: any `d`-hotkey listener and theme-toggle UI (grep first)

- [ ] **Step 1:** `grep -rn "useTheme\|setTheme\|next-themes" app components hooks --include='*.tsx' --include='*.ts'` to find every theme consumer (the `d`-hotkey handler, any toggle button/menu item).

- [ ] **Step 2:** In `components/theme-provider.tsx`, set the provider to force light and stop reacting to system:

```tsx
<NextThemesProvider
  attribute="class"
  forcedTheme="light"
  enableSystem={false}
  disableTransitionOnChange
  {...props}
>
  {children}
</NextThemesProvider>
```

- [ ] **Step 3:** Remove the `d`-hotkey keydown listener and any theme-switch control found in Step 1 (buttons, dropdown items calling `setTheme`). Delete now-unused imports. Do NOT delete unrelated keyboard handlers.

- [ ] **Step 4:** Run verification cycle V.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(design): forzar tema claro y quitar el toggle de dark mode"
```

---

## Task 3: Switch sans font to Geist

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1:** In `app/layout.tsx`, replace the Public Sans import/instantiation with Geist (keep Geist Mono as-is). Reference: EHR does exactly this.

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
```

- [ ] **Step 2:** Update the `<body>` (or `<html>`) className to use `geistSans.variable` in place of the old Public Sans variable. Keep `geistMono.variable`. Remove the `Public_Sans` import.

- [ ] **Step 3:** Run verification cycle V. Then start `npm run dev` and confirm the app renders in Geist (body text visibly changes weight/shape).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(design): fuente sans Geist (paridad con EHR)"
```

---

## Task 4: Card primitive

**Files:**
- Create: `components/ui/card.tsx`

**Interfaces:**
- Produces: `Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter` — consumed by Tasks 6 (DataTable frame), 10–13.

- [ ] **Step 1:** Create `components/ui/card.tsx` with the EHR-parity card (navy shadow, `ring-1` border, `--card-spacing`, muted footer):

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing)",
        "text-sm text-card-foreground ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]",
        "[--card-spacing:--spacing(4)] data-[size=sm]:[--card-spacing:--spacing(3)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-(--card-spacing)",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-title" className={cn("font-heading text-base font-medium leading-snug", className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t bg-muted/50 px-(--card-spacing) pt-(--card-spacing) [.border-t]:mt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };
```

Note: `font-heading` resolves via `@theme inline` (Task 1 leaves it aliased to sans). If `--font-heading` is not defined in this repo's `@theme`, add `--font-heading: var(--font-sans);` to the `@theme inline` block in `globals.css`.

- [ ] **Step 2:** Create a throwaway probe page to render a Card (or temporarily drop `<Card>…</Card>` into an existing page) and run `npm run dev`; confirm rounded-xl, faint navy shadow, ring border. Remove the probe.

- [ ] **Step 3:** Run verification cycle V.

- [ ] **Step 4: Commit**

```bash
git add components/ui/card.tsx app/globals.css
git commit -m "feat(ui): primitivo Card (paridad EHR)"
```

---

## Task 5: PageContainer + PageHeader

**Files:**
- Create: `components/ui/page.tsx`

**Interfaces:**
- Produces: `PageContainer({children, className, gap?})`, `PageHeader({title, count?, actions?, className})` — consumed by Tasks 10–13.

- [ ] **Step 1:** Create `components/ui/page.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function PageContainer({
  className,
  gap = "md",
  ...props
}: React.ComponentProps<"div"> & { gap?: "md" | "lg" }) {
  return (
    <div
      data-slot="page-container"
      className={cn("flex flex-col", gap === "lg" ? "gap-6" : "gap-4", className)}
      {...props}
    />
  );
}

function PageHeader({
  title,
  count,
  actions,
  className,
}: {
  title: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="page-header" className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-baseline gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {count != null && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageContainer, PageHeader };
```

- [ ] **Step 2:** Run verification cycle V.

- [ ] **Step 3: Commit**

```bash
git add components/ui/page.tsx
git commit -m "feat(ui): PageContainer + PageHeader"
```

---

## Task 6: Retune Table + DataTable wrapper

**Files:**
- Modify: `components/ui/table.tsx`
- Create: `components/ui/data-table.tsx`

**Interfaces:**
- Produces: retuned `Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption`; new `DataTable`, `TableEmpty`, `TableLoading`, `TableError` — consumed by Tasks 10–12.

- [ ] **Step 1:** In `components/ui/table.tsx`, update three class strings to the EHR compact spec (leave the component structure/exports intact):
  - `TableHead`: `"h-10 px-2 text-left align-middle whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0"`
  - `TableRow`: `"border-b transition-colors hover:bg-accent/40 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted"`
  - `TableCell`: `"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0"`

- [ ] **Step 2:** Create `components/ui/data-table.tsx` (card frame + standard states). It re-exports the table parts so callers import from one place:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { Table, TableRow, TableCell } from "@/components/ui/table";

// Card-framed wrapper for a data table. Put <TableHeader>/<TableBody> inside.
function DataTable({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table"
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm shadow-[rgba(16,32,64,0.06)]",
        className,
      )}
      {...props}
    >
      <Table>{children}</Table>
    </div>
  );
}

// Standard full-width states. `colSpan` must match the table's column count.
function TableState({ colSpan, children, tone }: { colSpan: number; children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={cn("h-24 whitespace-normal p-6 text-center text-sm", tone === "error" ? "text-destructive" : "text-muted-foreground")}>
        {children}
      </TableCell>
    </TableRow>
  );
}
const TableEmpty = ({ colSpan, children }: { colSpan: number; children: React.ReactNode }) => <TableState colSpan={colSpan} tone="muted">{children}</TableState>;
const TableLoading = ({ colSpan, children }: { colSpan: number; children: React.ReactNode }) => <TableState colSpan={colSpan} tone="muted">{children}</TableState>;
const TableError = ({ colSpan, children }: { colSpan: number; children: React.ReactNode }) => <TableState colSpan={colSpan} tone="error">{children}</TableState>;

export { DataTable, TableEmpty, TableLoading, TableError };
```

- [ ] **Step 3:** Run verification cycle V. The 6 existing `ui/table` consumers must still build (they use the same exports; only styling changed).

- [ ] **Step 4: Commit**

```bash
git add components/ui/table.tsx components/ui/data-table.tsx
git commit -m "feat(ui): tabla compacta EHR + wrapper DataTable con estados"
```

---

## Task 7: Badge status variants, Alert check, EmptyState + Segmented

**Files:**
- Modify: `components/ui/badge.tsx`, `components/ui/alert.tsx`
- Create: `components/ui/empty-state.tsx`, `components/ui/segmented.tsx`

**Interfaces:**
- Produces: Badge variants `success|warning|info`; `EmptyState`; `Segmented`.

- [ ] **Step 1:** In `components/ui/badge.tsx`, add three variants to the cva `variants.variant` map (keep existing ones):

```ts
success: "bg-success text-success-foreground",
warning: "bg-warning text-warning-foreground",
info: "bg-info text-info-foreground",
```

(These map to the Task 1 tint tokens. If the badge uses raw `bg-[var(--…)]`, use `bg-success`/`text-success-foreground` — `@theme inline` exposes them as utilities.)

- [ ] **Step 2:** Open `components/ui/alert.tsx`. Confirm a `destructive` variant renders as `border-destructive/30 bg-destructive/10 text-destructive` (the shape of the ×28 inline box). If the current destructive variant differs, adjust it to that. No new file.

- [ ] **Step 3:** Create `components/ui/empty-state.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 p-8 text-center", className)}>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-prose text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export { EmptyState };
```

- [ ] **Step 4:** Create `components/ui/segmented.tsx` (the EHR segmented control):

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function Segmented({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="tablist" className={cn("inline-flex gap-0.5 rounded-lg border bg-card p-0.5", className)} {...props} />;
}

function SegmentedButton({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Segmented, SegmentedButton };
```

- [ ] **Step 5:** Run verification cycle V.

- [ ] **Step 6: Commit**

```bash
git add components/ui/badge.tsx components/ui/alert.tsx components/ui/empty-state.tsx components/ui/segmented.tsx
git commit -m "feat(ui): variantes de estado en Badge, Alert destructive, EmptyState, Segmented"
```

---

## Task 8: Sidebar primitive (port from EHR)

**Files:**
- Create: `components/ui/sidebar.tsx`
- Possibly create: `hooks/use-mobile.ts` (if not present — the sidebar needs it)

**Interfaces:**
- Produces: `SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarSeparator, SidebarHeader, SidebarFooter, SidebarContent, SidebarRail` (whatever the EHR file exports) — consumed by Task 9.

- [ ] **Step 1:** Check for a mobile hook: `ls hooks/use-mobile.ts`. If absent, copy `/Users/diegoolalde/Documents/Dev/cmr/ehr/cmr-ehr-fe/packages/ui/src/hooks/use-mobile.ts` to `hooks/use-mobile.ts` (adjust import paths to `@/`).

- [ ] **Step 2:** Copy `/Users/diegoolalde/Documents/Dev/cmr/ehr/cmr-ehr-fe/packages/ui/src/components/sidebar.tsx` to `components/ui/sidebar.tsx`. Then adapt:
  - `@workspace/ui/lib/utils` → `@/lib/utils`
  - `@workspace/ui/hooks/use-mobile` → `@/hooks/use-mobile`
  - `@workspace/ui/components/*` (button, separator, sheet, tooltip, input, skeleton) → `@/components/ui/*`. If it imports `separator`/`skeleton`/`tooltip`/`input`/`sheet` that don't exist here, either add that primitive via `npx shadcn@latest add <name>` OR inline-replace the small usages. `sheet`, `tooltip`, `input` already exist in this repo. `separator` and `skeleton` are likely missing — add them: `npx shadcn@latest add separator skeleton`.
  - Any `lucide-react` icon (e.g. `PanelLeft` in `SidebarTrigger`) → a hugeicons equivalent: `import { SidebarLeft01Icon } from "@hugeicons/core-free-icons"; <HugeiconsIcon icon={SidebarLeft01Icon} />`. Keep the exact same class names/sizes.

- [ ] **Step 3:** Run verification cycle V. The sidebar tokens from Task 1 (`--sidebar*`) are already present, so it should build.

- [ ] **Step 4: Commit**

```bash
git add components/ui/sidebar.tsx hooks/use-mobile.ts components/ui/separator.tsx components/ui/skeleton.tsx
git commit -m "feat(ui): primitivo Sidebar (port desde EHR, iconos hugeicons)"
```

---

## Task 9: Navy sidebar shell (AppSidebar + app-shell rewrite)

**Files:**
- Create: `components/app-sidebar.tsx`
- Modify: `components/app-shell.tsx` (rewrite to single shell)
- Delete: `components/site-header.tsx`, `components/nav-sidebar.tsx`, the `useNavVista` hook (grep for its file)
- Test: `lib/nav/nav-groups.test.ts` (real unit test — the nav-filtering logic)

**Interfaces:**
- Consumes: sidebar primitive (Task 8); `lib/nav-manifest.ts` nav items; `useCan()`.
- Produces: `AppSidebar`; a single `AppShell` rendering `SidebarProvider → AppSidebar → SidebarInset → header → main`.

- [ ] **Step 1:** Read `components/app-shell.tsx`, `components/site-header.tsx`, `components/nav-sidebar.tsx`, `lib/nav-manifest.ts`, and the `useNavVista` hook. Catalogue what the current shell provides: nav item list + grouping, permission filtering, brand mark, section-title logic, locale select, `me.email`/role display, sign-out. These must all survive into `AppSidebar`.

- [ ] **Step 2 (real test — nav grouping is logic):** If nav grouping/permission-filtering is inline in the shell, extract a pure helper `buildNavGroups(items, can)` into `lib/nav/nav-groups.ts` and write `lib/nav/nav-groups.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNavGroups } from "./nav-groups";

test("hides items whose permiso the user lacks", () => {
  const items = [
    { path: "/a", labelKey: "a", group: "main" },
    { path: "/b", labelKey: "b", group: "main", permiso: "b.read" },
  ];
  const groups = buildNavGroups(items, (p) => p !== "b.read");
  assert.deepEqual(groups.main.map((i) => i.path), ["/a"]);
});

test("keeps items with no permiso requirement", () => {
  const items = [{ path: "/a", labelKey: "a", group: "main" }];
  const groups = buildNavGroups(items, () => false);
  assert.deepEqual(groups.main.map((i) => i.path), ["/a"]);
});
```

- [ ] **Step 3:** Run `npm test` → expect FAIL (module not found).

- [ ] **Step 4:** Implement `lib/nav/nav-groups.ts` `buildNavGroups(items, can)` matching the shape the current shell uses (group key → filtered items; an item is visible when it has no `permiso` or `can(permiso)` is true). Run `npm test` → expect PASS.

- [ ] **Step 5:** Create `components/app-sidebar.tsx` — the navy rail. Skeleton (fill nav groups from `buildNavGroups`, icons from hugeicons, active = `pathname.startsWith(href)`):

```tsx
"use client";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Stethoscope02Icon } from "@hugeicons/core-free-icons";
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useCan } from "@/hooks/use-can";
import { NAV_ITEMS } from "@/lib/nav-manifest";
import { buildNavGroups } from "@/lib/nav/nav-groups";
// … locale select + sign-out reused from the current shell

export function AppSidebar() {
  const pathname = usePathname();
  const { can } = useCan();
  const groups = buildNavGroups(NAV_ITEMS, can);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <HugeiconsIcon icon={Stethoscope02Icon} className="size-4" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">CMR</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {Object.entries(groups).map(([group, items]) => items.length > 0 && (
          <SidebarGroup key={group}>
            {group !== "main" && <SidebarGroupLabel>{/* t(`nav.group.${group}`) */}</SidebarGroupLabel>}
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.path}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(it.path)}>
                    <Link href={it.path}>{/* icon + t(it.labelKey) */}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>{/* locale select · me.email · role · sign-out (reuse from old shell) */}</SidebarFooter>
    </Sidebar>
  );
}
```

Port the exact nav labels/icons/locale/sign-out markup from the files read in Step 1 — do not invent new items. Icon mapping: the nav manifest stores icon keys; reuse the existing key→hugeicon lookup the old shell used.

- [ ] **Step 6:** Rewrite `components/app-shell.tsx` to the single shell (drop `useNavVista`):

```tsx
"use client";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useSectionTitle } from "@/hooks/…"; // reuse existing section-title source
// … Avatar import from existing header

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-13 shrink-0 items-center gap-3 border-b bg-background px-5">
          <SidebarTrigger />
          <span className="text-sm font-semibold">{/* current section title */}</span>
          <div className="ml-auto">{/* existing Avatar */}</div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

Reuse the current section-title logic and Avatar markup from `site-header.tsx` before deleting it.

- [ ] **Step 7:** Delete `components/site-header.tsx`, `components/nav-sidebar.tsx`, and the `useNavVista` hook file. Fix any remaining imports (`grep -rn "site-header\|nav-sidebar\|useNavVista"` → resolve all).

- [ ] **Step 8:** Run verification cycle V, then `npm run dev` and confirm: dark-navy rail on the left, collapse toggle (Cmd/Ctrl+B) works, nav items appear per permissions, header shows section title + avatar, content sits in `p-6`. Check a couple of routes.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(shell): shell único con rail navy (AppSidebar), retiro de SiteHeader/NavSidebar"
```

---

## Task 10: Migrate Clientes / pacientes (list + Acciones sheet)

**Files:**
- Modify: `app/(app)/clientes/page.tsx`
- Modify: `components/clientes/acciones-paciente-sheet.tsx` (panels → Card)
- Modify: the patient list table component (identify via grep)

- [ ] **Step 1:** Read `app/(app)/clientes/page.tsx` and the list/table it renders. Note current width wrapper (e.g. `mx-auto max-w-5xl px-6 py-12`), the hand-rolled table, any inline error/empty/loading strings, and hardcoded status colors.

- [ ] **Step 2:** Replace the page wrapper with `PageContainer` + `PageHeader` (title from the existing i18n key, `count` = result count, `actions` = the existing primary button). Remove the ad-hoc `max-w-*/px-*/py-*` wrapper — the shell's `p-6` handles padding.

- [ ] **Step 3:** Convert the hand-rolled `<table>` to `DataTable` + `Table*` parts. Header cells → `<TableHead>`, rows → `<TableRow>`/`<TableCell>`. Replace the inline loading/empty/error `<td>` strings with `<TableLoading colSpan={N}>`, `<TableEmpty colSpan={N}>`, `<TableError colSpan={N}>`. Keep all data logic, links, and click handlers exactly as-is.

- [ ] **Step 4:** In `acciones-paciente-sheet.tsx`, replace each ad-hoc `rounded-xl border … p-… shadow…` panel with `<Card>`/`<CardHeader>`/`<CardContent>`. Map any hardcoded status colors (`text-amber-*`, `text-emerald-*`, etc.) to `<Badge variant="warning|success|info|destructive">` or the semantic token classes.

- [ ] **Step 5:** Run verification cycle V + visual pass on `/clientes` and the Acciones sheet: card-framed table, uppercase muted headers, `accent/40` row hover, Card panels, tinted badges. Confirm the patient list + sheet still open and paginate.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(clientes): migrar lista + sheet a Card/DataTable/PageHeader"
```

---

## Task 11: Migrate Facturación (list + detail)

**Files:**
- Modify: `components/facturacion/facturas-list-view.tsx` (+ `devoluciones-list-view.tsx` if it shares the pattern)
- Modify: `app/(app)/facturacion/[id]/page.tsx` (detail)
- Modify: `app/(app)/facturacion/page.tsx` / `app/(app)/consultas/page.tsx` wrappers as needed

- [ ] **Step 1:** Read `facturas-list-view.tsx`. It has (audit): `<table className="w-full text-sm">`, `<thead className="bg-muted/60">`, header `text-[11px] uppercase tracking-wide`, row `cursor-pointer hover:bg-muted/30`, cells `px-3 py-2`, and inline loading/empty/error `<td>` at ~lines 264–270.

- [ ] **Step 2:** Convert the table to `DataTable` + `Table*`. Keep the row `onClick` navigation and `cursor-pointer` (add it on `<TableRow>`). Replace the 3 inline state `<td>`s with `<TableLoading/Empty/Error colSpan={N}>`.

- [ ] **Step 3:** Wrap the list page in `PageContainer` + `PageHeader` (title, count, the existing actions). Replace any inline destructive error box (`border-destructive/30 bg-destructive/10 …`) with `<Alert variant="destructive">`.

- [ ] **Step 4:** In the invoice detail page, group the detail sections into `<Card>`s (header/content), map hardcoded status colors to Badge variants/tokens, and wrap in `PageContainer`/`PageHeader`. Keep all totals/line-item logic intact.

- [ ] **Step 5:** Run verification cycle V + visual pass on the facturación list and one invoice detail. Confirm navigation into detail still works, empty/loading render, totals unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(facturacion): migrar lista + detalle a Card/DataTable/Alert/PageHeader"
```

---

## Task 12: Migrate Inventario (productos + existencias)

**Files:**
- Modify: `components/inventario/productos-admin.tsx`
- Modify: `app/(app)/inventario/existencias/page.tsx` (+ its table component)

- [ ] **Step 1:** Read `productos-admin.tsx` (audit: `<thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">`, header `text-[11px] uppercase tracking-wide text-muted-foreground`, cells `px-3 py-2`) and the existencias viewer (semáforo colors — likely hardcoded `bg-emerald/amber/red`).

- [ ] **Step 2:** Convert both tables to `DataTable` + `Table*`. Preserve the **sticky header** need: if a table body scrolls, keep sticky by adding `className="sticky top-0 z-10 bg-card"` on the `<TableHeader>` (the DataTable frame already has the card bg). Keep column definitions/data logic.

- [ ] **Step 3:** Map the semáforo status colors to `Badge` variants: green→`success`, amber→`warning`, red→`destructive`. Where the semáforo is a dot/cell tint rather than a badge, use the semantic token classes (`bg-success/text-success-foreground`, etc.) instead of raw `emerald/amber/red`.

- [ ] **Step 4:** Wrap both pages in `PageContainer`/`PageHeader`; replace inline error boxes with `<Alert variant="destructive">`.

- [ ] **Step 5:** Run verification cycle V + visual pass on `/inventario/productos` and `/inventario/existencias`. Confirm sticky headers still stick, semáforo reads correctly, filters/inputs still work.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(inventario): migrar productos + existencias a DataTable + tokens de estado (semáforo)"
```

---

## Task 13: Migrate Agenda / tablero (citas)

> **Rebase first.** Before this task, ensure PR #41 is merged and this branch is rebased on `main` (see Global Constraints). Then `components/tablero/nueva-cita-modal.tsx` is already free of PrescripcionGrid.

**Files:**
- Modify: the tablero board page + board/column components (identify via grep under `app/(app)/tablero`, `components/tablero`, `components/agenda`)
- Modify: `components/tablero/nueva-cita-modal.tsx` (panels → Card, colors → tokens; keep all logic)

- [ ] **Step 1:** Read the tablero board page and its column/card components. Note ad-hoc card panels, status color usage on cards/badges, and any segmented/period switcher.

- [ ] **Step 2:** Replace board column/card panels with `<Card>` (or the existing structure restyled with the card classes if a full Card is too heavy for a dense board cell — prefer `Card` where it's a real panel). Map status colors to `Badge` `success|warning|info|destructive`.

- [ ] **Step 3:** Replace any board/period switcher built from raw buttons with `<Segmented>` + `<SegmentedButton active=…>`. Keep the switch handlers.

- [ ] **Step 4:** In `nueva-cita-modal.tsx`, keep the dialog logic; restyle the hero/timeline/quick-schedule sections to use tokens (no raw `emerald/amber`) and `Card` where a bordered panel is used. Do not reintroduce any prescripción code.

- [ ] **Step 5:** Run verification cycle V + visual pass on the tablero and the post-acción modal (mark a row asistido → modal opens, schedule flow works). Confirm SSE/board updates still render.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tablero): migrar board + modal post-acción a Card/Badge/Segmented"
```

---

## Task 14: Final sweep, PR

**Files:** none (verification + PR)

- [ ] **Step 1:** Full verification: run cycle V once more clean. Confirm lint shows only the known pre-existing findings (not in your files).

- [ ] **Step 2:** `grep -rn "text-amber-\|text-emerald-\|bg-emerald-\|bg-amber-\|\.dark\b" app/\(app\)/clientes app/\(app\)/facturacion app/\(app\)/inventario components/tablero components/clientes components/facturacion components/inventario` — confirm the flagship files no longer use hardcoded status colors or dark classes. (Out-of-scope files may still; that's fine.)

- [ ] **Step 3:** Visual pass across all 4 flagship screens + spot-check 2 unrelated pages (e.g. `/personal`, a settings page) to confirm the shell/tokens didn't break them.

- [ ] **Step 4:** Push + open PR (metadiego identity):

```bash
gh auth switch --user metadiego
git push -u origin feat/design-system-navy
gh pr create --repo metadiego/cmr-fe --base main \
  --title "feat(design): sistema de diseño navy (EHR-like) — fundación + pantallas flagship" \
  --body "<summary: tokens navy + light-only, Card/PageHeader/DataTable/Sidebar, shell navy, 4 pantallas migradas; sweeps de dominios restantes en PRs siguientes>"
gh auth switch --user dolalde-sparkiq
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** tokens (T1), light-only+toggle (T2), Geist (T3), Card (T4), PageContainer/Header (T5), Table+DataTable (T6), Badge/Alert/EmptyState/Segmented (T7), Sidebar (T8), navy shell (T9), 4 flagship screens (T10–13), scope boundary honored (only 4 screens migrated), risks/verification baked into cycle V + T14. ✓
- **Placeholders:** primitive tasks carry full source; port tasks (T8 sidebar, T9 shell) give exact source paths + adaptations + skeletons because the final content depends on reading the current cmr-fe files — the transformations are concrete, not vague. Migration tasks (T10–13) are transformation checklists against files that must be read first (their final source can't be authored blind); each lists the exact class-string swaps and state-component replacements. ✓
- **Type consistency:** `buildNavGroups(items, can)`, `DataTable`, `TableEmpty/Loading/Error(colSpan)`, `PageContainer/PageHeader`, Card subcomponents, Badge variant names (`success|warning|info`) are referenced consistently across tasks. ✓
