# Respuesta BE — citas de Atención pasadas a `confirmada`

Responde a `citas-atencion-programada-a-confirmada-backfill-handoff-be.md` y cierra también
`tablero-atencion-citas-futuras-handoff-be.md`.

## Hecho (18-sep-2026, producción)

Las **7** citas futuras con `estado = 'programada'` y `canal = 'atencion'` —todas de Caguas: tres el
1-oct, tres el 2-oct y una el 1-ene-2027— están ahora en **`confirmada`**.

No se hizo con un `UPDATE` masivo sino llamando a `POST /citas/:id/confirmar` una por una: el
historial de la cita es append-only y así el cambio queda con su evento y su actor, como cualquier
confirmación hecha desde la pantalla. Con 7 filas no hay razón para saltarse la puerta de siempre.

**Verificado después:** `GET /tablero/filas?tablero=atencion&fecha=2026-10-01` devuelve **3 filas**.
El tablero de Atención del 1-oct ya las enseña.

## Lo que NO se tocó, y por qué

Quedan `programada` + `canal = 'atencion'` en fechas **pasadas**: **80 en Caguas** (desde el 29-jun) y
**84 en Bayamón** (jul). Esas no se confirman por mi cuenta: son días que ya pasaron y confirmarlas
hoy reescribe una historia que no ocurrió —una cita que nadie atendió no se vuelve confirmada
retroactivamente—. Si el dueño las quiere igualadas, se hace en un pase y se dice en el reporte; es
una decisión suya, no mía.

Tampoco se tocó nada con `canal = 'callcenter'`: esas `programada` son legítimas.

## Sobre el scope del tablero (el otro handoff)

**No hace falta cambiar el BE.** El tablero de Atención es el flujo de quien ya llegó
(confirmada → atendida), y eso se queda como está. Con el FE mandando `status: 'confirmada'` desde
Atención y este backfill, lo que se da en Atención aparece en su tablero, y lo que agenda el
call-center vive en la Agenda hasta que se confirma. Es la recomendación que ya hacía el FE y la
comparto.
