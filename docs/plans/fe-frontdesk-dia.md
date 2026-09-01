# FE — Frontdesk del día (F4)

Vista diaria de sesiones de servicio (reemplaza el legacy /frontdesk): tabs por servicio + KPIs-filtro +
tabla dinámica con flujo Presente → En terapia → Asistido (sello de hora) + búsqueda con dictado por voz +
SSE en vivo. Patrón UI: clinic operations board 2026 (stat-tiles filtro, pipeline por fila, tabs con color
del dato, línea Linear/Vercel; tokens-only).

## Contratos (verificados en vivo, PROD)
- Tabs: `GET /servicios` (clave/nombre/color/orden/activo). 13 en prod.
- Filas: `GET /frontdesk/tablero?servicio=<clave>&fecha=YYYY-MM-DD` → {columnas, filas} (proyección BE).
- Sellos de hora + pacienteId: `GET /frontdesk/sesiones?desde&hasta&servicioId` (entity: presenteEn/
  terapiaInEn/asistidoEn/datos) — JOIN client-side por id (no recalcula nada, solo une datos del BE).
- Estados con color/labelKey: `GET /tablero/definicion?tablero=servicios` (data-driven).
- Transiciones: `POST /frontdesk/sesiones/:id/{presente|en-terapia|asistido}` (TransicionSesionDto),
  `/cancelar` (motivo), `/reparar` (motivo+estado…, RBAC).
- Disponibilidad X/Y + saldo: `GET /frontdesk/servicios/:servicioId/disponibilidad?pacienteId=` (lazy, popover).
- Medición (PR #136): col tipo `medicion` render {dato,unidadKey,min,max,paso} → input numérico →
  `POST /frontdesk/sesiones/:id/acciones` (GuardarDatosDto, merge de sesion.datos). Sin semillas aún → se
  activa solo cuando el BE las cree (data-driven).
- Realtime: bus único `/tablero/stream` filtrado por entidad `sesion` (useCitaStream). `entrega_sin_saldo`
  → alerta roja + toast.
- Nurse status: `GET /frontdesk/nurse-status?fecha` + `/tipos` (botón de header, panel).

## Reglas del dueño → decisión
1. Rango 2 fechas solo gerente → **GAP BE**: `/frontdesk/tablero` solo acepta `fecha`. 1 fecha por ahora;
   nota a BE (desde/hasta en tablero).
2. Buscar nombre/record/tel + dictado → filtro client-side por nombre + `buscar-paciente` para record/tel;
   mic con Web Speech API (`useDictado`).
3. Botón estatus enfermera → header, panel read-only (actuales+tipos). **GAP BE**: POST set sin DTO en Swagger.
4. UN botón Citar → `/citas?tab=servicios` (deep-link; se agrega soporte `?tab=` a la página de citas).
5. Tab "Todos" (por paciente) → **GAP BE** declarado en handoff: chip deshabilitado con tooltip.
6. Nada hardcodeado: tabs/columnas/estados/transiciones del API.
7. Reparar siempre visible para admin: menú por fila gated `can('frontdesk.reparar')` (BE = autoridad).

## TDD
- `lib/frontdesk/search.ts`: `normaliza` (acentos/case) + `coincide` — tests primero.
- Reuso: useCentroGate, useCitaStream, getDefinicion, listServicios, buscarPaciente, formatFechaSolo.
