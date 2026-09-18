# Tablero de Atención: no muestra las citas de fechas FUTURAS (programada) — handoff BE

**Reporte del dueño (18-sep-2026):** en `/boards/atencion`, al ponerse en una fecha futura (p. ej.
`2026-10-01`) NO se ven las citas de ese día. Verificado en pantalla: el tablero da **ALL 0** en el
1-oct, aunque ese día hay 3 citas en Caguas.

## Verificado (no supuesto)

- El tablero de atención se pinta con `GenericBoard` → `getFilas(tablero='atencion', fecha, {centroId})`
  → `GET /board/rows?boardSlug=atencion&date=…`. **El FE NO manda ningún filtro de estado** (no pasa
  `onlyCare`/`soloAtencion`); `components/tablero/generic-board.tsx` solo manda `centroId`/`subTipo`.
- Por lo tanto el recorte lo hace el **servidor**: las filas del tablero `atencion` quedan acotadas a
  los estados de atención (confirmada→atendida). Las citas del 1-oct son **`programada`** (futuras,
  creadas por «Nueva cita» sin `status`), así que caen fuera del scope y el tablero sale vacío.
- **Dónde SÍ se ven (y ya funciona):** la AGENDA / Central de Citas
  (`/scheduling/appointments/2026-10-01`) muestra las 3 citas del día (grupo «Sin hora»); el FE ya
  abre esa vista en el centro activo (commit `3980f83`).

## Decisión que necesitamos del BE / dueño

¿El tablero de Atención debe **también** listar las citas `programada` de una fecha (futura), o esas
citas viven solo en la Agenda?

- Si deben verse en Atención: es un cambio del **scope del tablero en el BE** (incluir `programada`
  en las filas de `board/rows?boardSlug=atencion`, quizá solo para fechas != hoy). El FE no puede
  soltarlo porque no manda ese filtro; lo decide el servidor por `boardSlug`.
- Si no: cerrar como «por diseño» y, si acaso, el FE puede poner en el tablero de Atención un enlace
  «ver en la agenda» para fechas futuras (eso sí es del FE).

Recomendación del FE: para ver el día completo agendado, la Agenda es la pantalla correcta y ya
funciona; el tablero de Atención es el flujo de atención (presente/en terapia/asistido) de quienes ya
llegaron. Confirmar con el dueño qué comportamiento quiere.
