# Module: design-system (tokens + theming por capas)

## Purpose
One uniform visual language so **nothing writes bespoke CSS**. Every color/font/radius/surface comes
from **tokens** (CSS variables). This is what makes the layered theming + **corporate override**
(#51/#34/#3) possible: show corporate branding on top of a user's personalization **without
destroying it**. If a component hardcodes a color, the override can't reach it — so it's a bug.

## The rule (tokens-only)
- Use Tailwind token classes: `bg-background`, `text-foreground`, `bg-primary`, `bg-success`,
  `bg-overlay`, `border-input`, `rounded-md`, etc.
- **Never** hardcode `bg-black/80`, `bg-emerald-500`, hex/rgb, or inline color styles in a component.
- Status colors use the semantic tokens below, not Tailwind palette colors.

## Tokens
- **Source of truth:** `app/globals.css` — `:root` (light) + `.dark`, all in **OKLCH**, mapped to
  Tailwind via `@theme inline`.
- **Core (shadcn):** `--background/-foreground`, `--card`, `--popover`, `--primary`, `--secondary`,
  `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, sidebar/chart.
- **Semantic (added):** `--success/-foreground`, `--warning/-foreground`, `--info/-foreground`,
  `--overlay` (modal backdrop; includes its own alpha → use `bg-overlay`, not `bg-overlay/80`).

## Theming por capas (#51)
- **BE `preferences` module (deployed)** stores config as a free JSONB blob per layer and returns the
  resolved **`effective`** by precedence `override → usuario → centro → sistema`. The FE only paints
  `effective`. Endpoints (via `lib/api/preferences.ts`): `GET /preferences/public` (anon),
  `GET /me/preferences` (`{effective, layers}`), `PUT /me/preferences` (`{config}`), admin
  `GET/PUT /preferences/system|/centro/:id`, override `POST/GET/DELETE /preferences/override`.
- **Token vocabulary = `lib/theme/config.ts`** (`ThemeConfig`). The FE owns the shape of `config`:
  `{ colors:{primary,background,…}, radius, font:{sans,heading} }`. `configToCssVars(config)` maps it
  to the CSS variables above.
- **`components/presentation-provider.tsx`** (mounted in `app/layout.tsx`) fetches the effective
  config (logged-in → `/me/preferences`, else `/preferences/public`) and sets those variables on
  `<html>` via `style.setProperty`. Inline vars on `<html>` override `:root`/`.dark`, so a custom
  theme wins; an empty config paints nothing (defaults stay). Failure → defaults. `next-themes` still
  owns light/dark.

## How to add a token
1. Add the variable to **both** `:root` and `.dark` in `app/globals.css` (OKLCH).
2. Map it in `@theme inline` (`--color-x: var(--x)`) so `bg-x`/`text-x` exist.
3. If it should be themeable from the BE, add the key to `ThemeConfig` + `COLOR_VAR` in
   `lib/theme/config.ts`.

## Decisions
- FE defines the token vocabulary; BE config is a free blob (no schema coupling).
- Provider paints client-side (brief default for custom themes; SSR injection = future optimization).
- Overlay token carries its own alpha so modal backdrops are themeable.

## Personalization UI (theming por capas)
Spec: `docs/specs/2026-06-05-theming-ui-design.md`. Reusable editor over `ThemeConfig`:
- `components/theme/theme-editor.tsx` — controlled editor (primary/accent/background color +
  radius preset) with **live preview** (writes the CSS vars on `<html>`); parent persists + reloads.
- **Part 1 (done):** `app/(app)/settings/appearance/page.tsx` — user layer: `getMyPreferences()`
  (`layers.usuario`) → edit → `updateMyPreferences(config)`; Reset saves `{}`. i18n `appearance.*`;
  link from the dashboard.
- **Part 2 (done):** `components/admin/theme-settings.tsx` — **Theme** tab in `/admin`. System layer
  (`/preferences/system`) + per-center (`/preferences/centro/:id`), reusing ThemeEditor via a keyed
  `LayerThemeForm` (remount per layer; no setState-in-effect). i18n `admin.theme.*`. BE GET/PUT return
  the layer's `config` blob; `lib/api/preferences.ts` has `get/updateSystemPreferences`,
  `get/updateCentroPreferences` (+ `listOverrides/createOverride/deleteOverride` for Part 3).

- **Part 3 (done):** `components/admin/override-settings.tsx` — corporate **override** (master/
  super_admin), rendered in the Theme tab only when `isMaster`. List (name · scope global/center ·
  vigencia) + remove; create dialog (ThemeEditor + name + scope select + vigencia date inputs) →
  `createOverride`. The BE resolves precedence so the effective wins without deleting lower layers.
  i18n `admin.override.*`.

## Pending / follow-on (BE ready)
- SSR injection of the effective theme to remove the first-paint flash for custom themes.
- ThemeEditor live-preview writes vars to `<html>` and doesn't revert on layer switch until reload
  (reload-on-save makes it authoritative).
