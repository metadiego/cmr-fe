# Theming UI (personalización por capas) — Design

**Date:** 2026-06-05 · **Status:** Approved (Part 1)

## Goal
Pantallas para gestionar el theming por capas (#51) que el BE ya resuelve. Un **editor de tema
reutilizable** alimenta 3 consumidores con distinto privilegio:
1. **Usuario** — personaliza su propio tema (`PUT /me/preferences`).
2. **Admin** — default del sistema y por centro (`GET/PUT /preferences/system`, `/preferences/centro/:id`).
3. **Master** — override corporativo con vigencia/alcance (`POST/GET/DELETE /preferences/override`).

El BE devuelve el `effective` resuelto (override→usuario→centro→sistema); el `PresentationProvider`
(ya existe) lo pinta. Aquí construimos las pantallas que **escriben** cada capa.

## Vocabulario (ya definido)
`lib/theme/config.ts` (`ThemeConfig` + `configToCssVars`). Las capas guardan un blob `config` libre;
el FE define la forma. v1 editable: `colors.{primary,accent,background}` + `radius`. Los colores se
guardan como CSS válido (hex del color-picker; el sistema base usa OKLCH, ambos conviven).

## Approach
- **`components/theme/theme-editor.tsx`** (reusable): inputs de color (primary/accent/background) +
  `radius` (presets) + **preview en vivo** (escribe las CSS vars en `<html>` al editar) + reset.
  Props `{ value: ThemeConfig, onChange }`.
- **`app/(app)/settings/appearance/page.tsx`** (Part 1): carga `getMyPreferences()` (capa `usuario`),
  edita con el editor, **Guardar** → `updateMyPreferences(config)`; **Restablecer** → guarda `{}`
  (limpia la capa del usuario, vuelve a las de abajo). Tras guardar, `router.refresh()`.
- **`lib/api/preferences.ts`**: añadir `getSystemPreferences/updateSystemPreferences`,
  `getCentroPreferences/updateCentroPreferences`, `listOverrides/createOverride/deleteOverride`
  (se usan en Parts 2–3).
- Acceso: link "Apariencia" en el dashboard (luego entrará al menú dinámico RBAC).
- Tokens-only, i18n claves inglés, doc de módulo.

## Plan
- **Part 1 (ahora):** editor reutilizable + pantalla de usuario (personalización) + i18n + acceso.
- **Part 2:** panel admin de tema (sistema + por centro) reusando el editor.
- **Part 3:** override corporativo del master (config + alcance + vigencia + activar/quitar).

## Verify
Local: `/settings/appearance` con sesión master → cambiar primary/accent/background/radius → preview
en vivo → Guardar → recargar → persiste (BE `effective` lo trae). Restablecer → vuelve al default.
typecheck/lint/build verdes; tokens-only; ES/EN traducido.
