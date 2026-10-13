# Handoff BE → FE — La cita recién creada se ve al instante y queda filtrada sola

**De:** BE · **Para:** FE · **Fecha:** 2026-10-13 · **Prioridad:** alta (el dueño lo vio en Citas Médicas).

## Lo que pasó (verificado en producción)

El dueño agregó una cita al récord **84050** (Bayamón, CHRISTIAN (STAFF) RIVERA APONTE) y «no se agregó».
**Sí se guardó** (16:14, cita `b56c19c9-0823-4424-9f05-441eff2ede3c`, hoy, seguimiento, con médico, **sin hora**):

1. Como el paciente ya tenía una cita viva (6-nov), la regla «una cita viva por paciente» la **movió a hoy**:
   la del 6-nov quedó `reprogramada` y la de hoy lleva `reprogramadaDeId`. No nació una segunda.
2. La lista de hoy de Bayamón tiene **31** citas y `GET /citas` pagina de **20** (`meta.pagination
   {total:31,page:1,limit:20}`); ordenada por llegada y luego hora, una cita sin hora ni llegada cae la
   **última** → estaba en la **página 2**. En pantalla no se veía.

## Lo que pide el dueño

«Debería inmediatamente agregarla y filtrarla sola a ella.» Al guardar una cita:

1. Mostrarla al instante usando la respuesta del `POST` (trae la cita completa con su `id`), sin depender
   de que caiga en la página cargada.
2. Dejar la lista **filtrada a esa cita** (p. ej. `GET /citas?pacienteId=<id>&desde=<fecha>&hasta=<fecha>`,
   o filtrar por su `id` en memoria), con un botón para quitar el filtro.
3. Si el `POST` devolvió una cita **reprogramada** (trae `reprogramadaDeId`), avisar: «Tenía cita el 6-nov:
   se movió a hoy» — que no parezca que no se hizo nada.
4. La lista debe pedir todas las páginas (o `limit` hasta 100, el máximo del BE) cuando el día tiene más de
   20 citas: hoy se perdían 11.
