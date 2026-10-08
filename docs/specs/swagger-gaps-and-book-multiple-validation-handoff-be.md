# Handoff BE — book-multiple acepta pacientes/servicios inexistentes + 2 huecos de Swagger

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-08 · **Prioridad:** el punto 1 es un fallo de datos;
el 2 y el 3 son de contrato (el FE ya los rodea, documentado).

## 1. `POST /frontdesk/sessions/book-multiple` crea sesiones con paciente y servicio que NO existen

**Verificado en prod (Caguas, 2026-10-08 13:38 AST)** — por error del FE al sondear el contrato:

```
POST /api/v2/frontdesk/sessions/book-multiple
X-Tenant-ID: 5f98ef29-5b71-4fc4-8291-0ca3ff50bc7d
{ "patientId": "00000000-0000-0000-0000-000000000000",
  "serviceId": "00000000-0000-0000-0000-000000000000",
  "fechas": ["2099-01-01"], "time": "09:00" }
→ 200, creadas: [ { id: "42f0e8dc-462e-4970-b8b4-f2b746b0d1d5", patientId: "0000…", serviceId: "0000…", date: "2099-01-01" … } ]
```

Se borró en el acto con `DELETE /api/v2/frontdesk/sessions/42f0e8dc-…` (200 `eliminada: true`) y se
confirmó vacío con `GET /frontdesk/sessions?desde=2099-01-01&hasta=2099-01-01` → `[]`.

**Lo que se pide:** antes de crear, comprobar que el paciente y cada servicio existen **en el centro
del tenant** y responder 404/400 con `labelKey` (p. ej. `frontdesk.patientNotFound`,
`frontdesk.serviceNotFound`) — o una FK en la tabla si no la hay. Revisar si `agendar-multiple` y el
alta de sesión simple tienen el mismo hueco. Con test.

## 2. `GET /doctors/schedules` no declara su respuesta en Swagger

Tras a5914ad (22-sep, horarios genéricos a cualquier personal) el Swagger ya no trae ningún schema de
respuesta para esa ruta (antes: `HorarioMedicoEntity`). El FE la tipa a mano desde la respuesta real:
`{ id, clinicId, createdAt, updatedAt, staffId, doctorId, dayOfWeek, startTime, endTime, active }`.
**Pedido:** `@ApiOkResponse({ type: [StaffScheduleEntity] })` (o el DTO que corresponda) en GET/POST/PUT,
para que `gen:api` lo genere y el FE borre su tipo a mano (`lib/api/disponibilidad.ts`).

## 3. `frontdeskConsultationOrder` acepta `null` pero el Swagger dice solo `number`

`PUT /centers/:id/tax-details`: el FE manda `null` para "la pestaña Consulta al final" (la propia
descripción del campo lo dice) y el BE lo acepta (`@IsOptional` + se aplica si `!== undefined`).
**Pedido:** `@ApiPropertyOptional({ nullable: true, … })` y tipo `number | null` en
`update-datos-fiscales.dto.ts`, para que el FE quite su ampliación a mano (`lib/api/centers.ts`).

## Contexto: por qué salió esto

`lib/api/schema.d.ts` no se regeneraba desde el 3-sep. Al regenerarlo hoy contra prod salieron 8
errores de tipos; ninguno rompía prod (verificado). El FE ya: manda `dates` (en vez de `fechas`) a
book-multiple/agendar-multiple, `staffId` (en vez del `doctorId` deprecado) al crear horario, y
regenera con `--default-non-nullable false` (los campos opcionales con `default`, como `alcance` de
servicios, salían como obligatorios por el generador, no por el BE).
