# Frontdesk nuevo — una sesión cancelada no es una «segunda sesión»

**Fecha:** 2026-10-14 · **De:** BE → FE · **Visto por:** el dueño, en pantalla (CRUZ RIVERA, IRIS,
récord 89759, Bayamón, LÁSER «2 sesiones»: una asistida y otra vacía en gris).

## Lo verificado (producción, lectura, 14-oct 11:45)

- Esa paciente tiene **una sola** sesión viva de láser hoy: `bfdb3952…`, asistida, técnico Edgar
  Acevedo, origen `scheduling-server`.
- La otra fila es `db4846d6…`, **`cancelada`**: se creó a mano el 9-oct y se canceló el 10-oct
  (la cita se rehízo). No es un duplicado: el índice único `UQ_frontdesk_sessions_one_live_a_day`
  solo deja una fila **no cancelada** por paciente/servicio/día, y hoy hay **0** grupos con dos
  vivas en los dos centros.
- Hoy hay **14** pares paciente+servicio donde una cancelada convive con una viva. En todos ellos el
  frontdesk nuevo enseña una fila de más y cuenta «2 sesiones».

## Qué pide

En el detalle del paciente (`service-sessions-table`) y en el conteo «N sesiones» de cada servicio:

1. Una sesión `cancelada` **no se pinta** como fila operativa ni cuenta en «N sesiones».
2. Si el servicio de ese día **solo** tiene canceladas, se puede enseñar una línea discreta del tipo
   «Cancelada» (sin selector de técnico ni flujo), para que no desaparezca sin rastro. Si ya existe
   una viva, la cancelada no se enseña.
3. Lo mismo en los chips de la lista de la izquierda.

`lib/frontdesk/patient-day.ts` ya separa `cancelada` en varios sitios (líneas ~133, 150 y 168): la
regla debe estar en **un** sitio, `groupByPatient`, para que chips, detalle y conteo la hereden.

## Pruebas que pide

- Paciente con láser `cancelada` + láser `asistido` el mismo día → 1 fila, «1 sesión».
- Paciente con solo láser `cancelada` → ninguna fila operativa (como mucho la marca «Cancelada»).
- Sin canceladas, nada cambia.
