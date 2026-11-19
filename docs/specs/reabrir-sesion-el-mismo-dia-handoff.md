# Handoff FE — Reabrir una sesión cancelada el mismo día · Cancelar todas · Reabrir todas

**BE:** cmr-be PR #508 · spec `cmr-be/docs/specs/reabrir-sesion-el-mismo-dia.md` · 2026-11-07

## Por qué

El 6-nov en Caguas una paciente eligió ondas de choque en vez de láser; se canceló el láser y luego
cambió de opinión. Nadie pudo reabrirlo ni darle otro láser ese día: los formatos salieron del legado.

Lo que vimos en producción (solo lectura):
- el BE **no** bloqueaba agendar otra sesión del mismo servicio ese día, y no hay ningún error de
  frontdesk registrado para esa paciente después de la cancelación: el intento no llegó al BE;
- ya existía la acción del tablero `reactivar`, pero las canceladas están **ocultas** por defecto en el
  tablero (`frontdesk-board.tsx` ~l.408) y la acción solo aparece en el menú de la fila si se filtra por
  el KPI «Cancelada» (`row-menu.tsx`). Nadie la encontró.

## Lo que hay que construir

### 1. Botón «Reabrir» en una sesión cancelada de HOY

- Mostrarlo en la fila cancelada (tablero de servicio y vista del día del paciente) **solo si la fecha de
  la sesión es hoy** (zona del centro). Otro día no se ofrece.
- Las canceladas de hoy tienen que **verse** sin filtrar por el KPI (atenuadas, al final, con su marca de
  cancelada), para poder reabrirlas. Las de días pasados pueden seguir ocultas.
- Llamada: `POST /api/v2/frontdesk/sesiones/:id/reabrir` (o `/frontdesk/sessions/:id/reopen`), cuerpo
  opcional `{ "reason": "…" }`. Devuelve la sesión.
- Vuelve a donde estaba: `presente` si había llegado, `en_terapia` si había empezado (también si estaba
  asistida: hay que volver a marcarla asistida para que descargue), `pendiente` si nunca llegó. Conserva
  dosis, técnico, formularios y formatos: la impresión vuelve a funcionar igual.
- Toast «Sesión reabierta». Errores (409, mostrar el mensaje por `labelKey`):
  - `FRONTDESK_REOPEN_ONLY_TODAY` → `frontdesk.error.reopenOnlyToday` («Solo se puede reabrir el mismo
    día»);
  - `FRONTDESK_REOPEN_PACKAGE_CLOSED` → `frontdesk.error.reopenPackageClosed` («El paquete ya no está
    activo: factura anulada, devuelta o protocolo cambiado»);
  - `FRONTDESK_SESSION_SAME_DAY` → `frontdesk.error.sessionSameDay` (ya existe: ya tiene otra viva de
    ese servicio hoy);
  - `SHEET_SLOT_TAKEN` → ya existe (la hoja no tiene hueco).
  - 400 `FRONTDESK_REOPEN_NOT_CANCELLED` → `frontdesk.error.reopenNotCancelled`.

### 2. «Cancelar todas» junto al «Cancelar» de siempre

- El botón «Cancelar» de una sesión se queda **igual**.
- Variante nueva «Cancelar todas» (en la vista del día del paciente y en el menú de la fila): pide un
  motivo, uno para todas.
- Llamada: `POST /api/v2/frontdesk/pacientes/:patientId/dia/cancelar` (o
  `/frontdesk/patients/:patientId/day/cancel`), cuerpo `{ "reason": "se tuvo que ir", "date"?: "YYYY-MM-DD",
  "centerId"?: "<uuid>" }`. Sin `date` = hoy en el centro.
- Cancela las del paciente ese día que estén `pendiente`, `presente` o `en_terapia`. Las `asistido` **no**
  se tocan.
- Respuesta: `{ cancelled: Sesion[], count: number }`. Toast «N sesiones canceladas».

### 3. «Reabrir todas»

- Donde el paciente tenga alguna cancelada **hoy**.
- Llamada: `POST /api/v2/frontdesk/pacientes/:patientId/dia/reabrir` (o
  `/frontdesk/patients/:patientId/day/reopen`), cuerpo `{ "centerId"?: "<uuid>" }`. Siempre hoy.
- Reabre **solo** las canceladas de hoy. Las que ya están abiertas (`pendiente`, `presente`,
  `en_terapia`, `asistido`) no se tocan: ni cambio, ni evento, ni error.
- Respuesta: `{ reopened: Sesion[], skipped: [{ id, code }] }`. Si `skipped` no está vacío, decir cuáles no
  volvieron y por qué (mismo mapeo de `code` → `labelKey` que arriba).

### 4. Historial

Evento nuevo en el historial de la sesión: `reopened` (payload `{ antes: "cancelada", despues: <estado> }`).
`labelKey` sugerido: `frontdesk.evento.reopened` («Reabierta»). Actualizar el tipo en `lib/api/schema.d.ts`
(`npm run gen:api` o equivalente).

### 5. La acción `reactivar` del tablero

Sigue existiendo y ahora pasa por la MISMA regla (solo hoy, vuelve a donde estaba). Si se muestra el
botón «Reabrir» del punto 1, se puede ocultar `reactivar` del menú para no tener dos botones que hacen lo
mismo.

## Permisos

`frontdesk.update` (el mismo que cancelar). Para mostrar los botones, usar la misma condición que ya usa
«Cancelar».

## i18n

`frontdesk.reopen`, `frontdesk.cancelAll`, `frontdesk.reopenAll`, `frontdesk.error.reopenOnlyToday`,
`frontdesk.error.reopenPackageClosed`, `frontdesk.error.reopenNotCancelled`, `frontdesk.evento.reopened`.
