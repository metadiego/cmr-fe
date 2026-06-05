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

## Pending / follow-on (BE ready)
- User personalization UI (`PUT /me/preferences`).
- Admin theme panel (system + per-center) and corporate **override** management (with vigencia).
- SSR injection of the effective theme to remove the first-paint flash for custom themes.
