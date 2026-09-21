# HANDOFF FE — Puente de citas del call-center (BE LISTO, solo pintar)

> El backend ya sincroniza automáticamente las citas MÉDICAS (consultas) que el call-center agenda en su
> sistema externo (Google Sheets) hacia nuestras propias citas — de mañana en adelante, cada 60s+ en horario
> laboral (lun–sáb 6am–6pm, configurable), incluyendo cancelaciones y reagendos que el call-center haga a
> mitad de semana. LASER/IV/OTRA quedan fuera a propósito (fase futura). Falta la pantalla de administración:
> ver el estado, prender/apagar por centro, y mapear nombres/códigos externos a personal real.
> Fecha: 2026-09-21. Spec BE completa: `cmr-be/docs/specs/scheduling-bridge-consultas.md`.

## Endpoints (`/api/v1/scheduling-bridge/...` y `/api/v2/scheduling-bridge/...`, mismo body)

Todos aceptan opcionalmente `?centerIds=<uuid>&centerIds=<uuid>` (array) para ver/editar más de un
centro a la vez sin cambiar el centro activo — si se omite, usa el centro activo (X-Tenant-ID).

- **GET `/scheduling-bridge/status`** (perm `scheduling-bridge.read`) → `{ reachable, clinics: [{ clinicId,
  enabled, externalClinicCode, pollIntervalSeconds, workDays, workStartTime, workEndTime, lastRun }] }`.
  `lastRun` es la última fila de `runs` (ver abajo) o `null` si nunca corrió.
- **GET `/scheduling-bridge/runs`** (perm `scheduling-bridge.read`) → últimas 50 corridas de sync, más
  reciente primero: `{ id, clinicId, startedAt, finishedAt, ok, created, updated, cancelled, error }`.
- **POST `/scheduling-bridge/run-now`** (perm `scheduling-bridge.run`) `{ clinicId, dates: ["YYYY-MM-DD"] }`
  → dispara una corrida fuera de horario (botón "sincronizar ahora" para QA / arreglar en caliente).
  Responde `{ ok: false, reason: "..." }` si el centro no tiene `externalClinicCode` configurado todavía.
- **GET/PUT `/scheduling-bridge/config`** (perm `scheduling-bridge.config`) — PUT es edición parcial
  (solo mandar lo que cambia): `{ enabled?, pollIntervalSeconds? (≥60), workDays? ([0-6]), workStartTime?
  ("HH:mm"), workEndTime? ("HH:mm"), externalClinicCode? ("BAYAMON"|"CAGUAS") }`.
- **GET/POST `/scheduling-bridge/doctor-mappings`**, **PUT/DELETE `/scheduling-bridge/doctor-mappings/:id`**
  (perm `scheduling-bridge.config`) — `{ id, clinicId, externalName, staffId, createdAt, updatedAt }`.
  `externalName` es el nombre del médico EXACTO como lo manda el sistema externo (ej. "DRA. SHEILA NIEVES").
- **GET/POST `/scheduling-bridge/agent-mappings`**, **PUT/DELETE `/scheduling-bridge/agent-mappings/:id`**
  (perm `scheduling-bridge.config`) — `{ id, clinicId, externalCode, staffId, createdAt, updatedAt }`.
  `externalCode` es el código de 2 letras del agente de call-center que agendó (ej. "SF"); resuelve la
  comisión de captación de paciente nuevo.
- MCP (segunda puerta, mismos permisos, mismos nombres en inglés): `scheduling_bridge_status`,
  `list_scheduling_bridge_runs`, `run_scheduling_bridge_now`, `get_scheduling_bridge_config`,
  `update_scheduling_bridge_config`, `list_doctor_mappings`, `create_doctor_mapping`,
  `update_doctor_mapping`, `delete_doctor_mapping`, `list_agent_mappings`, `create_agent_mapping`,
  `update_agent_mapping`, `delete_agent_mapping`.

## Modelo (para que la UI lo refleje, NO hardcodear)

- Un mapping de médico o de agente es **por centro**: el mismo código externo puede resolver a una
  persona distinta en Bayamón que en Caguas (ya pasa con "MR" e "IF" — dos personas reales distintas
  por centro). La UI nunca asume que un código es global.
- El estado `agendada` es lo único que el puente escribe hoy: el sistema externo no tiene todavía un
  estado "confirmada" propio. No pintar como si esa distinción existiera aún.
- Reagendo = mover la cita (nunca una fila cancelada + una nueva suelta): si el FE ve una cita con
  `reprogramadaDeId`, es un reagendo real capturado desde el call-center, con su historial completo en
  `GET /citas/:id/historial` (ya existente).
- **9 mapeos de agente YA sembrados, provisionales** (regla: primera letra del nombre + primera letra
  del apellido, contra `personal` real — no vinieron del sistema externo, que solo manda el código). El
  código "DJ" no tiene persona que calce en ningún centro y queda sin mapear a propósito: la UI debe
  poder mostrar "sin mapear" y dejar que alguien lo complete a mano cuando se sepa quién es.

## UI sugerida (layout moderno — buscar referencia actual de "integration status / sync health dashboard")

Pantalla **`/configuration/scheduling-bridge`** (menú: Configuración → Integraciones), gate con
`scheduling-bridge.read` para ver, `scheduling-bridge.config` para editar, `scheduling-bridge.run` para
el botón de sincronizar ahora:

1. **Cards de estado por centro** arriba: nombre del centro, punto verde/rojo (`reachable`), switch
   `enabled`, última corrida (`lastRun.finishedAt` + `ok`/`error` + contadores created/updated/cancelled),
   botón "Sincronizar ahora" (abre un date-range picker, llama `run-now`).
2. **Panel de configuración** (form): intervalo de sondeo (segundos, mínimo 60), días laborables
   (chips Lun–Sáb), ventana horaria (dos time-pickers), código de centro externo (select BAYAMON/CAGUAS).
   Guardado optimista con rollback si el PUT falla; toast de confirmación.
3. **Tabla de mapeo de médicos**: columnas nombre externo (texto, tal cual llega) / médico real
   (`<Select>` buscable sobre `personal` del centro, NUNCA texto libre) / acciones editar-eliminar. Fila
   "+ nuevo mapeo" arriba de la tabla.
4. **Tabla de mapeo de agentes**: mismo patrón — código externo / agente real (`<Select>` sobre
   `personal` del centro) / acciones. Marcar visualmente (badge amarillo, "provisional") los que vinieron
   del seed automático hasta que alguien los confirme o edite a mano.
5. **Log de corridas**: tabla colapsable con las últimas 50 (`GET /runs`), para diagnosticar sin tocar BE.
6. i18n en todos los labels (`labelKey`, nunca texto fijo); toda la pantalla usa el ancho completo,
   uniforme con el resto de Configuración.

## Nota de riesgo

Esto toca la agenda real de consultas y el pago de comisión por captación — no es una pantalla
cosmética. Probar con `/qa` contra un centro real antes de dar la pantalla por lista, y verificar en
pantalla (no solo con el JSON) que un reagendo hecho en el call-center se refleja como movimiento, no
como cita duplicada.
