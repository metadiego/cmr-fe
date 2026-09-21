# Handoff FE → BE — Agenda del día: `columns[].clave` en español, la fila en inglés (contrato roto)

> Reportado por el dueño, 21-sep-2026: `/scheduling/appointments/2026-10-01` "no está mostrando los
> datos". Investigado a fondo — hay citas reales (7 en Bayamón, 5 en Caguas, todas en la franja
> "sin hora"), pero Tipo/Paciente/Record/Teléfono/Médico/Estado salen en `—` aunque el BE SÍ manda
> esos valores. Es un bug real, del BE, no del FE.

## Evidencia cruda (JSON real, capturado ahora — no descripción)

Respuesta de `GET /api/v2/appointments/day-agenda?date=2026-10-01` en producción, cuenta
`atencion@centrodemedicinaregenerativa.com`, **21-sep-2026 16:54:01 UTC**, `requestId`
`ff68c1d3-40a5-4e87-888f-9a1d2cb2352b` (mismo payload, misma respuesta — no son dos llamadas):

`data.columns[]` (recorte, las que importan aquí):
```json
{"clave": "tipo", "binding": "cita.tipo", ...}
{"clave": "paciente", "binding": "paciente.nombre", ...}
{"clave": "record", "binding": "paciente.record", ...}
{"clave": "telefono", "binding": "paciente.telefono", ...}
{"clave": "medico", "binding": "medico.nombre", ...}
{"clave": "estado", "binding": "cita.estado", ...}
```

Una cita real, del **mismo `requestId`**, `data.centers[0].franjas[].tipos[].appointments[0]`
(centro CMR Bayamon, cita `499dfeb9-5076-4b71-934c-ae67d9647714`):
```json
{
  "id": "499dfeb9-5076-4b71-934c-ae67d9647714",
  "status": "programada",
  "time": null,
  "type": "Consulta (Nueva)",
  "patient": "EDITH CRESPO MALDONADO",
  "medicalRecordNumber": null,
  "phone": "+17872072736",
  "doctor": null,
  "medico__valor": null,
  "comentarios": null,
  "citadoPor": null,
  "actions": null
}
```

La cita **no tiene** las claves `paciente`, `tipo`, `estado`, `medico`, `telefono` ni `record` — tiene
`patient`, `type`, `status`, `doctor`, `phone`. `fila["paciente"]` da `undefined` sobre esta cita real;
`fila["patient"]` da `"EDITH CRESPO MALDONADO"`. Es el mismo objeto, en la misma respuesta HTTP, que
trae `columns[].clave = "paciente"` al lado. Reproducible: cualquier llamada a ese endpoint con una
cita real muestra lo mismo — no es una condición de carrera ni un caso aislado.

## La causa exacta (leída en el código, BE y FE, no supuesta)

`GET /api/v2/appointments/day-agenda?date=...` arma su respuesta con dos partes que se traducen de
forma **inconsistente** entre sí:

1. **`columns[]`** (`ColumnaEfectiva[]`) — `columnas` está en `CAMPOS_OPACOS`
   (`cmr-be/src/core/api-ingles/traducir-claves.ts:23`, la lista incluye `'columnas'`), así que la
   función `recorrer` (línea 73) la copia **sin recursar**: su contenido, incluido `clave`, queda
   **en español** (`"paciente"`, `"medico"`, `"telefono"`,
   `"record"`, `"tipo"`, `"estado"`), literal de `cmr-be/src/scripts/seed-tablero.ts`.
2. **`franjas[].tipos[].appointments[]`** (las citas) — **no** está en `CAMPOS_OPACOS`, así que
   **sí** recursa: cada cita sale con sus propias claves **traducidas** al inglés vía el mapa de
   `campos.ts` (`paciente→patient`, `medico→doctor`, `telefono→phone`, `record→medicalRecordNumber`,
   `tipo→type`, `estado→status`).

El FE (`lib/api/agenda-dia.ts`, tipo `ColumnaEfectiva`) documenta el contrato que siempre tuvo esta
respuesta: `clave: string; // key into each row of citas[]` — es decir, `fila[col.clave]` debe
resolver el valor de esa columna para esa fila. Eso es lo que hacen `components/agenda/dia-view.tsx`
(`CeldaCita`) y también `components/agenda/tablero-dinamico.tsx` (`TableroDinamico`, la pieza que sí
funciona bien en Atención/Frontdesk porque `GET /board/rows` no pasa por esta traducción). Con
`col.clave = "paciente"` y `fila.patient = "EDITH CRESPO MALDONADO"` (pero **sin** `fila.paciente`),
`fila[col.clave]` da `undefined` → el `Cell` de `tablero-dinamico.tsx` lo pinta como `—`.

**Por qué solo se notó en la franja "sin hora" de este reporte:** el 1-oct-2026 no tiene NINGUNA cita
en franjas con hora en ningún centro (todas sus franjas horarias traen `appointments: []`) — así que
la única evidencia visible ese día está en el bucket "sin hora". Pero el mismo `traducir-claves.ts`
corre igual para `franjas` con hora que para la de `hora: null` (mismo código, `citas.service.ts`
`grupoTipos`/`filaDe`, sin rama separada) — el bug es del payload completo, no de esa franja
específica. Con una cita real en una franja con hora, el mismo `—` debería reproducirse ahí también.

**Columnas afectadas** (verificado línea por línea en `campos.ts`): `paciente→patient` (línea 465),
`medico→doctor` (391), `telefono→phone` (624), `record→medicalRecordNumber` (549), `tipo→type` (629),
`estado→status` (286) — las seis mapeadas. `fila.estado` no existe (es `fila.status`), y `col.clave`
sigue siendo `"estado"`: mismo problema. **No afectadas** (`campos.ts` no tiene entrada para ellas,
confirmado por grep): `comentarios`, `citadoPor` — por eso esas dos sí se veían bien en un reporte
anterior (`docs/specs/agenda-dia-las-citas-sin-hora.md`, 17-sep) y llevó a pensar que el hueco era
solo Paciente/Médico. Ya no: es sistemático a toda columna cuyo nombre SÍ está en el mapa.

## Lo que NO se tocó (a propósito)

No se parchó en el FE. Un mapa local Español→Inglés en `dia-view.tsx`/`tablero-dinamico.tsx`
duplicaría `campos.ts` en el repo equivocado y se desactualizaría solo con el próximo campo que el BE
traduzca — exactamente lo que la norma del repo pide evitar. La resolución real es del BE: decidir si
`columnas`/`ColumnaEfectiva.clave` sale también traducida (consistente con las filas), o si `citas[]`
se sirve intacta para este endpoint en particular, o algún otro mecanismo — es una llamada de diseño
del BE, no del FE.

## Qué se considera terminado

- Con una cita real en una franja CON hora (no solo "sin hora"), Paciente/Médico/Teléfono/
  Record/Tipo/Estado se ven en la agenda del día, en las dos vistas (`CentroSheet`/`CentroSheetV2`).
- El contrato documentado en `lib/api/agenda-dia.ts` (`clave: string; // key into each row of
  citas[]`) vuelve a cumplirse tal cual, sin que el FE tenga que traducir nada.

## Referencia

- `cmr-be/src/core/api-ingles/traducir-claves.ts` — `CAMPOS_OPACOS` (línea 23, incluye `'columnas'`)
  y `recorrer` (línea 73), el recorrido que la exime.
- `cmr-be/src/core/api-ingles/campos.ts` — el mapa español→inglés: `paciente` (465), `medico` (391),
  `telefono` (624), `record` (549), `tipo` (629), `estado` (286); NO tiene `comentarios`/`citadoPor`.
- `cmr-be/src/scripts/seed-tablero.ts` — las `clave` en español sembradas para este tablero.
- `cmr-be/src/modules/citas/citas.service.ts` (`grupoTipos`/`filaDe`, día-agenda) — mismo código para
  franjas con hora y sin hora.
- `lib/api/agenda-dia.ts` (FE) — el contrato `ColumnaEfectiva.clave` documentado, y el gap
  `NOTA api-ingles` ya escrito ahí sobre esta misma asimetría.
- `docs/specs/agenda-dia-las-citas-sin-hora.md` — el reporte anterior que ya rozó esto (creyó que
  el hueco era solo Paciente/Médico; ahora se sabe que es cualquier clave que `campos.ts` traduzca).
