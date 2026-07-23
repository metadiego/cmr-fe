# Handoff BE — disparar "Programar citas" desde el tablero por `render.postAccion` (data-driven)

## Contexto
El dueño quiere que, al **Asistir** a un paciente en el tablero de frontdesk, se abra el modal "Programar
citas" para dejar agendada la próxima visita. **Regla dura: NADA hardcodeado** — el FE no debe asumir que
"asistido" dispara el modal; el estado/columna que lo dispara lo declara el BE por dato.

## Lo que el FE ya hace (en prod)
El modal "Programar citas" existe y se abre por 2 vías:
1. Botón **Citar** (sin paciente → busca).
2. **`render.postAccion`** de una columna del flujo: tras ejecutar la acción (transición), si la columna
   trae `render.postAccion === "programar_citas"`, el FE abre el modal con el `pacienteId` de la sesión.
   (Mismo mecanismo que el `postAccion` ya documentado para "nueva_cita_prescripcion" en Atención.)

## Lo que falta en el BE (DATO, por API del constructor — no código FE)
Hoy la columna `asistido` del tablero de servicios trae:
`render = { group, estampa: "horaOutEn", transition: "atender" }` — **sin `postAccion`**.
→ Agregar **`render.postAccion: "programar_citas"`** a esa columna (o al estado que el dueño decida que
debe ofrecer la próxima cita). Es override por composición/columna, data-driven, por-tablero. Confirmar el
valor de convención `"programar_citas"` (el FE lo espera; si prefieres otro string, dímelo y lo alineo).

## Contrato de agendado (ya en prod, usado por el modal)
- `POST /frontdesk/sesiones/agendar-multiple { pacienteId, servicioId, fechas[] }` (varias fechas).
- `POST /frontdesk/sesiones { pacienteId, servicioId, fecha }` (una).
- Disponibilidad informativa: `GET /frontdesk/servicios/:servicioId/disponibilidad?pacienteId`.

## Aceptación
- Marcar Asistido en una fila → se abre "Programar citas" con el paciente ya cargado (porque la columna
  declara `postAccion: "programar_citas"`), NO por un `if` en el FE.
- Quitar ese `postAccion` en el BE → el modal deja de abrirse tras asistir (prueba de que es data-driven).
