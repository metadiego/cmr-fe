# Site navbar — design

**Date:** 2026-06-02
**Repo:** `cmr-fe`
**Status:** Approved (brainstorming) — pending implementation plan

## Goal

Add a basic, responsive top navigation bar to `cmr-fe`, rendered globally so every page shows
it. Provide the shadcn setup (one new primitive) the bar needs. This is the first shared layout
chrome in the app; it should be a clean base to extend, not a finished product.

## Scope

In scope:
- A sticky top navbar with the CMR brand, primary nav links, and a visible theme toggle.
- Responsive behavior: inline links on `md+`, a hamburger + Sheet drawer below `md`.
- Active-link highlighting based on the current path.
- Wiring the navbar into the root layout.

Out of scope (YAGNI for now):
- Auth / user-account UI (avatar, sign-in) — no auth UI exists in the app yet.
- Dropdown sub-menus, command palette, search.
- A `system` option in the theme toggle — keep the existing light↔dark behavior the `d`
  hotkey already provides.
- Building the destination pages — `/clientes` and `/citas` will 404 until built; that is
  expected and acceptable.

## Behavior

- **Layout:** sticky (`top-0`), full-width, bottom border, app background. Height ~`h-14`.
- **Left:** `⬡ CMR` brand (hugeicons mark + wordmark) linking to `/`.
- **Links** (single source of truth, see `lib/nav.ts`):
  - Inicio → `/`
  - Clientes → `/clientes`
  - Citas → `/citas`
- **Active link:** compared against `usePathname()`. `/` matches only exact `/`; other items
  match when the pathname equals or starts with the item's `href`. Active link gets a
  foreground/emphasis style; inactive links are muted.
- **Theme toggle (right):** icon button (sun in light, moon in dark) that flips
  `next-themes` between `light` and `dark` via `setTheme(resolvedTheme === "dark" ? "light" : "dark")`
  — the same state the existing `d` hotkey drives, so the two stay in sync. Includes an
  accessible label (`sr-only` "Toggle theme").
- **Responsive:**
  - `md+`: links render inline; hamburger hidden.
  - `< md`: links hidden; a hamburger button opens a shadcn Sheet from the left containing the
    same links (closing on navigation). Brand and theme toggle stay visible at all widths.

## Components & files

| File | Type | Responsibility |
|------|------|----------------|
| `components/ui/sheet.tsx` | added via `npx shadcn@latest add sheet` | Mobile drawer primitive (`button` already installed). |
| `lib/nav.ts` | module | Exports `navItems: { href: string; label: string }[]` — the one place links are defined. |
| `components/mode-toggle.tsx` | `"use client"` | Icon button toggling light/dark via `next-themes`. |
| `components/site-header.tsx` | `"use client"` | Composes brand, desktop nav, mobile Sheet (open state + `usePathname` for active state), and `<ModeToggle/>`. |
| `app/layout.tsx` | edit | Render `<SiteHeader />` above page content; wrap `{children}` in `<main>`. |

`site-header.tsx` and `mode-toggle.tsx` are client components because they use `usePathname`,
Sheet open state, and `useTheme`. Icons come from `@hugeicons/react` (the configured
`iconLibrary`). Styling uses existing shadcn tokens (`border`, `bg-background`,
`text-muted-foreground`, `cn` from `@/lib/utils`) and Button `ghost` variants for links.

## Constraints / repo notes

- **Next.js 16:** per `cmr-fe/AGENTS.md`, APIs may differ from older Next. Confirm `Link`
  (`next/link`) and `usePathname` (`next/navigation`) usage against `node_modules/next/dist/docs/`
  before coding.
- **shadcn config:** `radix-maia` style, `hugeicons` icon library, aliases `@/components`,
  `@/components/ui`, `@/lib` (see `components.json`). Use `npx shadcn@latest add sheet` so the
  generated file matches the configured style.

## Verification

`cmr-fe` has **no test runner** configured (no jest/vitest in `package.json`), so there is no
unit-test/TDD loop for this work. Verify with:

1. `npm run typecheck` — clean.
2. `npm run lint` — clean.
3. `npm run build` — succeeds.
4. `npm run dev` (port 8080) — visual check: navbar visible on `/`, links present, active link
   highlighted, theme toggle flips light/dark and stays in sync with the `d` hotkey, hamburger
   Sheet opens/closes below `md`.
