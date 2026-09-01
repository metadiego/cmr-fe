# Site Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive top navbar (brand, links, theme toggle) to `cmr-fe`, rendered globally in the root layout.

**Architecture:** A single `SiteHeader` client component composes a brand link, desktop inline nav, a mobile Sheet drawer, and a `ModeToggle`. Nav links live in one module (`lib/nav.ts`). Active state is derived from `usePathname()`. The header is mounted once in `app/layout.tsx`, inside the existing `ThemeProvider`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn/ui (`radix-maia` style), `next-themes`, `@hugeicons/react`.

> **Note on testing:** `cmr-fe` has **no test runner** configured (no jest/vitest in `package.json`), so this plan does **not** follow a unit-test-first TDD loop. Each task is verified with `npm run typecheck` + `npm run lint`; the final task adds `npm run build` and a manual `npm run dev` visual check. This matches the spec's Verification section.

> **Working directory:** all paths are relative to `cmr-fe/`. `cd` into `cmr-fe` first. Work happens on the existing `feat/site-navbar` branch.

---

### Task 1: Add the shadcn Sheet primitive

The mobile drawer uses shadcn's `sheet`. Only `button` is installed so far. Generate `sheet` with the CLI so it matches the configured `radix-maia` style and `components.json` aliases.

**Files:**
- Create (via CLI): `components/ui/sheet.tsx`

- [ ] **Step 1: Add the component**

Run:
```bash
npx shadcn@latest add sheet
```
Expected: creates `components/ui/sheet.tsx` (and pulls any needed `radix-ui` Dialog deps). If it prompts to overwrite anything, decline — only `sheet` should be new.

- [ ] **Step 2: Confirm the expected exports exist**

Run:
```bash
grep -oE "Sheet(Trigger|Content|Header|Title|Description|Close)?" components/ui/sheet.tsx | sort -u
```
Expected output includes at least: `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`. These are the names `site-header.tsx` will import in Task 4. If the generated names differ, note them and use the actual names in Task 4.

- [ ] **Step 3: Verify it compiles and lints**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/ui/sheet.tsx package.json package-lock.json
git commit -m "feat: add shadcn sheet primitive for mobile nav"
```

---

### Task 2: Define nav items + active-link helper

Single source of truth for links and the active-state rule, so the header stays declarative and both desktop/mobile reuse it.

**Files:**
- Create: `lib/nav.ts`

- [ ] **Step 1: Create the module**

```ts
// lib/nav.ts
export type NavItem = {
  href: string;
  label: string;
};

// Single source of truth for primary navigation links.
// Destination routes may not exist yet (they will 404 until built).
export const navItems: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/clientes", label: "Clientes" },
  { href: "/citas", label: "Citas" },
];

// "/" is active only on the exact root; every other item is active on an exact
// match or a nested sub-path (e.g. /clientes/123 keeps "Clientes" active).
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/nav.ts
git commit -m "feat: add nav items config and active-link helper"
```

---

### Task 3: Build the theme toggle button

A visible icon button that flips `next-themes` between light and dark — the same state the existing `d` hotkey in `components/theme-provider.tsx` drives, so they stay in sync. Icons are rendered with CSS `dark:` variants (not a JS branch on `resolvedTheme`) to avoid a hydration mismatch on first paint.

**Files:**
- Create: `components/mode-toggle.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/mode-toggle.tsx
"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Sun shows in dark mode (click → go light); Moon shows in light mode. */}
      <HugeiconsIcon icon={Sun03Icon} className="hidden dark:block" />
      <HugeiconsIcon icon={Moon02Icon} className="block dark:hidden" />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/mode-toggle.tsx
git commit -m "feat: add theme mode-toggle button"
```

---

### Task 4: Build the SiteHeader

Composes brand + desktop nav + mobile Sheet + `ModeToggle`. Client component because it uses `usePathname`, Sheet open state, and (transitively) `useTheme`.

**Files:**
- Create: `components/site-header.tsx`
- Reference: `node_modules/next/dist/docs/` (Next 16 API check)

- [ ] **Step 1: Confirm Next 16 client-nav APIs**

Per `cmr-fe/AGENTS.md`, verify `Link`/`usePathname` before coding:
```bash
grep -rl "usePathname" node_modules/next/dist/docs/ | head
```
Expected: `usePathname` is still exported from `next/navigation` and `Link` is the default export of `next/link` (the standard App Router client APIs). If the docs show a renamed/moved API, adapt the imports below accordingly.

- [ ] **Step 2: Create the component**

```tsx
// components/site-header.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { isActive, navItems } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        {/* Mobile menu (hidden on md+) */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Abrir menú"
            >
              <HugeiconsIcon icon={Menu01Icon} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetHeader>
              <SheetTitle asChild>
                <Link href="/" onClick={() => setOpen(false)}>
                  CMR
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-2 flex flex-col gap-1 px-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(pathname, item.href)
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
            ⬡
          </span>
          <span>CMR</span>
        </Link>

        {/* Desktop nav (hidden below md) */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(
                isActive(pathname, item.href)
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Verify it compiles and lints**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: both exit 0. (If Task 1 reported different Sheet export names, reconcile the imports here first.)

- [ ] **Step 4: Commit**

```bash
git add components/site-header.tsx
git commit -m "feat: add responsive site header with brand, nav, mobile sheet"
```

---

### Task 5: Mount SiteHeader in the root layout

Render the header once, inside `ThemeProvider` (so `useTheme` works) and above page content; wrap children in `<main>`.

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the import**

In `app/layout.tsx`, add to the import block (next to the existing `ThemeProvider` import):
```tsx
import { SiteHeader } from "@/components/site-header";
```

- [ ] **Step 2: Render the header and wrap children**

Replace this block:
```tsx
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
```
with:
```tsx
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main>{children}</main>
        </ThemeProvider>
      </body>
```

- [ ] **Step 3: Verify it compiles and lints**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: mount site header in root layout"
```

---

### Task 6: Full build + manual verification

No automated UI tests exist, so confirm the real build and behavior.

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run:
```bash
npm run build
```
Expected: build completes with no type or lint errors.

- [ ] **Step 2: Manual visual check**

Run `npm run dev` and open `http://localhost:8080`. Confirm:
- Navbar is visible and sticky at the top of `/`.
- Brand `⬡ CMR` and links **Inicio / Clientes / Citas** render on a wide viewport.
- On `/`, "Inicio" is highlighted (foreground) and the others are muted.
- The theme toggle flips light↔dark, and pressing `d` produces the same result (shared state).
- Narrow the window below `md`: inline links disappear, the hamburger appears, and it opens a left Sheet with the same links that closes on selection.

- [ ] **Step 3: (If any tweak was needed) commit**

```bash
git add -A
git commit -m "fix: site navbar adjustments from manual verification"
```
(Skip if nothing changed.)

---

## Notes for the implementer

- **Icons:** `@hugeicons/react` exports a single `HugeiconsIcon` component; pass an icon object via the `icon` prop (e.g. `icon={Menu01Icon}`), imported from `@hugeicons/core-free-icons`. The Button base styles size bare `svg` children to `size-4` automatically.
- **Sheet a11y:** Radix Dialog (under the Sheet) warns without a title — that's why `SheetHeader`/`SheetTitle` are present. Keep them.
- **No `clinicId`/auth here:** this is presentational chrome only; do not add auth, user menus, or tenant logic in this work.
