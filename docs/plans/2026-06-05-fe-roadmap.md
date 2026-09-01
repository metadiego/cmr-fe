# cmr-fe — Roadmap de desarrollo (flujo coherente)

**Date:** 2026-06-05 · **Status:** Proposed

Plan ordenado para el desarrollo del frontend. Precisión: distingo **código** (compila: typecheck/
lint/build) de **verificado** (probado en navegador contra el BE en vivo) y de **commiteado**.

## Estado actual (preciso)
Rama `feat/login-i18n`; commit `d15f9a0` = login + i18n. El resto está **sin commitear**.

| Bloque | Código | Verificado (navegador) | Commiteado |
|---|---|---|---|
| Login + sesión + protección de rutas | ✅ | ⚠️ parcial (curl) | ✅ `d15f9a0` |
| i18n es/en | ✅ | ✅ (curl ES/EN) | ✅ `d15f9a0` |
| Cimiento de diseño (tokens-only + PresentationProvider) | ✅ | ❌ | ❌ |
| Panel alta invite-first (invitar/asignar/centros) | ✅ | ❌ | ❌ |
| Ciclo invitado (compuerta estado + cambio contraseña) | ✅ | ❌ | ❌ |
| Selector de centro (X-Tenant-ID dinámico) | ✅ | ❌ | ❌ |
| Aprobar/rechazar pendientes (punto 7) | ✅ (UI vieja) | ❌ | ❌ | (decisión diferida) |
| Branding/preferences — pantallas de control | ❌ NO construido | — | — |

## Reglas transversales (aplican a TODO módulo)
API-First (solo `lib/api/`) · **tokens-only** (cero CSS suelto) · i18n con **claves en inglés** ·
Server Component por defecto · **spec→plan antes de codear** · **doc por módulo** en `docs/modules/` ·
reporte preciso (código ≠ verificado ≠ commiteado). Ver `.personal/CONSIDERACIONES-FE.md`.

---

## El flujo (etapas en orden, con razón)

### Etapa 1 — Estabilizar la base (ANTES de construir más)
Razón: no apilar features nuevas sobre código sin verificar ni commitear.
1. **Verificar en navegador** con el master los puntos 1–6: invitar → ver tempPassword → asignar →
   crear centro; simular un invitado para `/change-password` y `/pending`; selector con operativo N.
2. **Corregir** lo que aparezca.
3. **Header con sesión:** mostrar email + logout cuando hay sesión (hoy el header no refleja login).
4. **Commit + push** del bloque completo → preview/deploy en Vercel. Base limpia.

### Etapa 2 — Branding / preferences (el sistema transversal; BE ya desplegado)
Razón: construir del consumidor al privilegio, para ejercitar el vocabulario de tokens antes de los
controles de admin/override.
1. **Personalización del usuario** — pantalla para que el usuario edite su tema (`PUT /me/preferences`),
   consumiendo `ThemeConfig` (`lib/theme/config.ts`); el `PresentationProvider` ya pinta el efectivo.
2. **Panel admin de tema** — default del sistema + por centro (`GET/PUT /preferences/system`,
   `/preferences/centro/:id`). Solo admin/master.
3. **Override corporativo (master)** — crear/listar/quitar con vigencia y alcance (global/centro/…)
   (`POST/GET/DELETE /preferences/override`). El "día de socios": prevalece sin borrar lo del usuario.
4. **Inyección SSR** del tema efectivo en el layout (quitar el flash de primer pintado).

### Etapa 3 — Decisiones y limpieza
1. **Punto 7** (aprobar/rechazar pendientes): decidir ocultar-como-respaldo vs quitar, tras operación.
2. **Dedupe `/auth/me`**: un `MeProvider` (contexto) — hoy lo piden gate + header + dashboard +
   selector por separado.
3. **Paginación** en tablas (hoy solo página 1) · **"olvidé contraseña"** (necesita SMTP en Supabase).

### Etapa 4 — Módulos de dominio (futuro)
Clientes, citas, expedientes, etc. Cada uno: spec→plan + patrón uniforme + doc de módulo. Fuera del
alcance actual; listado para coherencia del flujo.

## Definition of done (por etapa/módulo)
código verde **+** verificado en navegador **+** doc de módulo **+** bitácora `.personal/` **+** commit.

## Dependencias / notas
- BE: todos los endpoints de Etapas 1–3 están **desplegados** (auth/me, invite, centros, preferences,
  override). No se toca `cmr-be`.
- Fase 3 (RBAC fino) y MCP son del BE — fuera de este roadmap del FE.
