# La cita creada desde Atención no aparece en la agenda de ese día — handoff BE

## Síntoma (reporte del dueño, 17-sep-2026)

En una prueba de Atención se asistió a un paciente y se le dio una cita para **2026-10-01**. Al
ubicarse en esa fecha en la agenda, **no aparece ningún paciente**. Récords afectados: **84687** (VALLES,
LOURDES JANIRA) y **15760**.

## Verificado (no supuesto)

**La cita SÍ existe** — en pantalla, historial del paciente 84687 (panel «Acciones» → *Medical
appointments*): `2026-06-29 programada`, `2026-09-17 · 11:12 atendida`, **`2026-10-01 programada`**. O
sea la creación funcionó y quedó en estado `programada`, **sin hora**.

**La vista-día no la trae** — `GET /appointments/day-agenda?date=2026-10-01` devuelve
`resumen.totalCitas = 0` / «0 appts» en **ambos** centros (Bayamón y Caguas, modo combinado «All
centers»). En `2026-09-30` y `2026-10-02` **tampoco** aparece → **no es un corrimiento de fecha**.

**El FE está correcto** (trazado en código):
- Creación (`components/tablero/nueva-cita-modal.tsx` → `createCita` → `POST /appointments`): manda
  `date: "2026-10-01"` como **string de día plano** (de `<input type=date>` o `plusDaysISO`, sin
  `new Date`/`toISOString`, sin medianoche local). Futuras → `status` omitido → nace `programada`. No
  manda hora.
- Vista-día (`components/agenda/dia-view.tsx` → `getAgendaDia` → `GET /appointments/day-agenda`): manda
  `date=2026-10-01` crudo, sin corrimiento; formatea con `parseDayUTC`. Renderiza la franja `hora:null`
  si el BE la devuelve.

**El propio BE debería incluirla** (leído en `cmr-be`):
- `citas.service.ts` `agendaCentro()`: `repo.find({ where: { clinicId, fecha }, order: { hora:'ASC' } })`
  — **sin filtro de estado** — y **sí** proyecta las citas sin hora en una franja `hora:null`
  (`sinHora = citas.filter(c => !c.hora)`, ~línea 761). Por su propia lógica, una `programada` sin hora
  en ese `clinicId` + `fecha` tendría que salir.
- Y sin embargo `resumen.totalCitas` = 0 → el `repo.find({ clinicId, fecha })` **no la está
  matcheando**.

## La contradicción a resolver (competencia BE)

La cita existe y una consulta paciente-scoped la ve (el historial / `proxCita`, que filtra
`estado Not In (cancelada,no_show,reprogramada)`), pero la consulta día `{ clinicId, fecha }` la pierde.
La diferencia está en **`clinicId` o en el valor exacto de `fecha`**. Revisar la FILA REAL de esa cita:

1. **`clinicId`**: ¿es exactamente el de Bayamón o Caguas? Si es `null`, o un centro que
   `centrosObjetivo(centroId, autorizados)` no incluye, la vista-día combinada lo omite aunque el
   historial (paciente-scoped) sí lo muestre. **Sospecha principal.**
2. **`fecha`**: ¿está guardada como `'2026-10-01'` (DATE) o lleva hora/zona que rompe el match exacto de
   `where: { fecha }`? El historial podría formatearla desde otra columna/rango y mostrar 2026-10-01
   aunque el match día a día falle.
3. Confirmar que el `tipoCitaId` (seguimiento) entra en `grupoTipos` de la franja `hora:null` (que no se
   caiga ahí).

Repro directo: `SELECT id, fecha, clinicId, estado, hora, tipoCitaId FROM citas WHERE pacienteId = (84687)`
y comparar `clinicId`/`fecha` contra lo que pide `GET /appointments/day-agenda?date=2026-10-01`.

## Pregunta para el dueño/BE

Si el `clinicId` resulta ser el correcto pero de un centro que el usuario no tenía seleccionado, la
parte FE sería solo el selector de centro; pero con «All centers» combinado ambos daban 0, así que la
evidencia apunta al dato/consulta del BE. Confirmar con la fila real.
