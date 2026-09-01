# Handoff FE — Comunicaciones: ruta única `/comunicaciones` (fusión alertas + notificaciones)

> **De:** BE (cmr-be). **Para:** cmr-fe. **Fecha:** 2026-07-13. **BE en prod.**
> **Decisión del dueño:** un solo dominio y **una sola ruta `/comunicaciones`** (no confundir con dos), extensible
> a otros tipos de comunicación. Las rutas viejas `/alertas` y `/notificaciones` quedan como **ALIAS DEPRECADOS**
> (siguen funcionando; no se rompe nada), pero el FE debe **migrar a `/comunicaciones/*`** y dejar de usar las viejas.

## Superficie canónica (usar estas)
Prefijo `/api/v1/comunicaciones`. Mismo contrato/DTOs que antes; solo cambia el prefijo.

**Canal interno (alertas / campana):**
- `GET /comunicaciones/alertas/stream` — SSE (campana en vivo). ← antes `/alertas/stream`
- `GET /comunicaciones/alertas` — mis alertas activas + `noLeidas`. ← `/alertas`
- `POST /comunicaciones/alertas` — crear (perm `alertas.create`).
- `POST /comunicaciones/alertas/:id/leer` · `/acusar` · `/resolver` (perm `alertas.resolver`) · `/descartar` (perm `alertas.resolver`).
- Catálogo (admin): `GET/POST /comunicaciones/tipos-alerta`, `PUT /comunicaciones/tipos-alerta/:id`. ← antes `/alertas/tipos`

**Canales salientes (notificaciones):**
- `POST /comunicaciones/notificaciones/enviar` (perm `notificaciones.create`). ← `/notificaciones/enviar`
- `GET /comunicaciones/notificaciones?citaId=` (perm `notificaciones.read`). ← `/notificaciones`
- `GET /comunicaciones/notificaciones/plantillas` · `POST /comunicaciones/notificaciones/plantillas` (admin). ← `/notificaciones/plantillas`

## Qué cambia en el FE
1. **Repuntar las llamadas** de `lib/api/alertas*` y `lib/api/notificaciones*` al prefijo `/comunicaciones` (solo el
   path; payloads y respuestas idénticos). No dupliques clientes — cambia la base en el `lib/api` existente.
2. **Menú:** una sola entrada **"Comunicaciones"** (en vez de dos: alertas + notificaciones). Data-driven por RBAC.
3. **RBAC simétrico:** ahora ambos usan permisos finos (`alertas.*` y `notificaciones.*`); usa `can(perm)` para
   mostrar/ocultar (antes notificaciones iba por rol).
4. La **campana** sigue igual (SSE), solo el endpoint cambia a `/comunicaciones/alertas/stream`.

## Notas
- Tipos de alerta ahora son **dato** (catálogo `tipos-alerta`, i18n por `labelKey`): la UI puede pintar
  severidad/label/icono desde el catálogo en vez de hardcodear.
- Las rutas viejas seguirán respondiendo un tiempo (alias deprecado); se retirarán en un PR aparte tras confirmar
  que el FE migró. No construyas nada nuevo sobre `/alertas` o `/notificaciones`.
- Si algo falta, mini-handoff al BE.
