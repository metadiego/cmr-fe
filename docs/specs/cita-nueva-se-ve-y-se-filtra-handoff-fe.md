# Handoff BE → FE — La cita recién creada se ve al instante y queda filtrada sola

**De:** BE · **Para:** FE · **Fecha:** 2026-10-13 · **Prioridad:** alta (el dueño lo vio en Citas Médicas).

## Lo que pasó (verificado en producción)

El dueño agregó una cita al récord **84050** (Bayamón, CHRISTIAN (STAFF) RIVERA APONTE) y «no se agregó».
**Sí se guardó** (16:14, cita `b56c19c9-0823-4424-9f05-441eff2ede3c`, hoy, seguimiento, con médico, **sin hora**):

1. Como el paciente ya tenía una cita viva (6-nov), la regla «una cita viva por paciente» la **movió a hoy**:
   la del 6-nov quedó `reprogramada` y la de hoy lleva `reprogramadaDeId`. No nació una segunda.
2. ~~Paginación~~ **CORREGIDO (16:20, tras la pregunta del FE):** lo de «página 2» era una suposición mía,
   no algo observado: el FE pide `limit=100` y el calendario recorre todas las páginas. Lo verificado: la
   cita **sí** sale en `GET /citas?desde=hoy&hasta=hoy` (31 de 31, la última: sin hora ni llegada).
   La auditoría solo registra el alta (`POST /api/v2/appointments`, 16:14:23, sesión de **Christian
   Rivera**, 200) y no las lecturas, así que **no se sabe qué pantalla** tenía abierta. La sospecha del FE
   —una cita **sin hora** no se pinta en la grilla del día— es la más probable.

## Lo que pide el dueño

«Debería inmediatamente agregarla y filtrarla sola a ella.» Al guardar una cita:

1. Mostrarla al instante usando la respuesta del `POST` (trae la cita completa con su `id`), sin depender
   de que caiga en la página cargada.
2. Dejar la lista **filtrada a esa cita** (p. ej. `GET /citas?pacienteId=<id>&desde=<fecha>&hasta=<fecha>`,
   o filtrar por su `id` en memoria), con un botón para quitar el filtro.
3. Si el `POST` devolvió una cita **reprogramada** (trae `reprogramadaDeId`), avisar: «Tenía cita el 6-nov:
   se movió a hoy» — que no parezca que no se hizo nada.
4. Una cita **sin hora** tiene que verse en cualquier vista del día (p. ej. una franja «Sin hora»).
