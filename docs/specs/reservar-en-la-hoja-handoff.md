# Handoff FE — la rejilla y el agendado leen la hoja del call center (BE #521)

**Para:** cmr-fe. **De:** cmr-be. **Fecha:** 10-nov-2026.
**Spec BE:** `cmr-be/docs/specs/reservar-en-la-hoja-antes-de-agendar.md` (anexo 10-nov).

## Qué cambió en el BE

En un centro con la reserva encendida (`reverse_sync_enabled`; **hoy está APAGADA en los dos
centros**, el dueño decide cuándo se enciende), cada cita de Láser, Intravenoso, Vit C y cada consulta
NUEVO/SEGUIMIENTO **toma su asiento en la hoja antes de guardarse**. La rejilla ya enseña lo que queda
en la hoja. Con la reserva apagada, todo responde igual que antes y `sheet` llega `null`.

Intravenoso y Vit C del mismo paciente a la misma hora **comparten un asiento** (misma vía): no hay
nada que hacer en pantalla, el BE lo resuelve.

## Lo verificado contra producción (10-nov, Caguas, reserva encendida 11 minutos con un paciente de prueba)

### 1. Rejilla de una terapia — `GET /api/v2/resources/availability?date&serviceId[&patientId]`

Respuesta real (`data`): `configured`, `minutes`, `resource`, `slots`, **`sheet`**.

- `slots[]`: `{ time, fits, freeStations, reasonKey? }`. Con la hoja:
  - `freeStations` ya es `min(nuestros, hoja)`;
  - hora llena en la hoja → `fits: false`, `freeStations: 0`, `reasonKey: 'therapies.sheetFull'`;
  - una hora que la hoja no tiene (p. ej. `07:30` en LASER) también sale `therapies.sheetFull`.
- `sheet`: `{ checkedAt, ok }` o `null` (no se leyó: servicio sin sección o centro apagado).
  - `ok: false` = la hoja no respondió. Con la política `block` todas las horas salen
    `reasonKey: 'sheet.unavailable'`.

Ejemplo real (Láser, 12-nov):
`07:00 fits 2 · 07:30 sheetFull · 11:00 sheetFull · 13:00 fits 3 · 15:00 fits 4`.

### 2. Selector de «Nueva cita» — `GET /api/v2/appointments/available-slots?fecha&tipoCitaId`

Respuesta real (`data`): `date`, `appointmentTypeId`, `durationMinutes`, `franjas`, **`sheet`**.

- `franjas[]`: `{ time, capacity, free, cappedBy }`.
- **Valor nuevo de `cappedBy`:** `'hoja'` = la franja está topada por la hoja; `'cupo'` = por los
  cupos nuestros; `null` = quedan huecos.
- **Ejemplo real** (SEGUIMIENTO, 12-nov): `09:00 capacity 5, free 0, cappedBy 'hoja'`.

### 3. Agendar a una hora llena en la hoja → **409**

Cuerpo real (v1, `POST /frontdesk/sesiones`):
`{ code: 'SHEET_SLOT_TAKEN', labelKey: 'sheet.slotTaken', message, hora, fecha }`. **No se guarda
nada.** Mismo 409 en: cita, reagendo de cita, sesión, `agenda` (reagendar sesión), reabrir, tren y
serie del tren.

### 4. Serie (`POST /frontdesk/sesiones/agendar-multiple`)

Respuesta real (v1): `data.creadas[]` (cada una con su `sheetSlotId`), `data.sinAsiento:
[{ servicioId, fecha }]` (los días saltados porque la hoja estaba llena), `data.omitidas`. La serie
**no se cae** por un día lleno.

## Lo NO verificado contra una respuesta real (sacado del código)

- **503** `{ code: 'SHEET_UNAVAILABLE', labelKey: 'sheet.unavailable' }`: la hoja no responde y la
  política es `block`. No se agenda nada.
- **Avisos no bloqueantes** en **`meta.advertencias`**, cada uno `{ code, labelKey }`:
  - `sheet.noOwnerCode`: el paciente no tiene dueño de cartera con código;
  - `sheet.ownerNoteFailed`;
  - `sheet.unavailable`, con la política `allow`.

  En la prueba no se disparó ninguno.
- `sheet` en el tren (`POST /resources/patient-train` y la serie del tren): mismo `{ checkedAt, ok }`.
- Los nombres en v2 de `sinAsiento`, `hora` y `fecha` del 409: en la prueba solo se capturó v1.
  **Antes de codificar, copiarlos de una respuesta v2 real.**

## Lo que pide la pantalla

1. **Rejilla de Atención (agendar sesiones) y tren:**
   - una hora con `reasonKey: 'therapies.sheetFull'` se pinta **llena** y con el motivo «Lleno en la
     hoja del call center»;
   - el `freeStations` ya viene topado.
2. **Si `sheet.ok === false`**, una franja de aviso: «La hoja del call center no responde: la
   disponibilidad puede no estar al día».
3. **Selector de «Nueva cita»:** `cappedBy === 'hoja'` se pinta como lleno, con el texto «Lleno en la
   hoja».
4. **409 `sheet.slotTaken`:** un toast con el `labelKey` («Esa hora ya no tiene asiento en la hoja del
   call center»), y se refresca la rejilla, porque alguien la tomó entre que se pintó y se pulsó.
5. **503 `sheet.unavailable`:** un toast «La hoja del call center no responde; no se agendó».
6. **Serie:** si `sinAsiento` trae días, se dicen: «Sin asiento en la hoja: 12-nov».
7. **`meta.advertencias`:** un toast informativo con cada `labelKey`; no bloquea.
8. **i18n:** las claves nuevas son `therapies.sheetFull`, `sheet.slotTaken`, `sheet.unavailable`,
   `sheet.noOwnerCode` y `sheet.ownerNoteFailed`.
