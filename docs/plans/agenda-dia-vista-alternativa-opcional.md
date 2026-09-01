# Idea — Vista alternativa (opcional) para la agenda del día

**Estado: solo idea/prototipo. Cero código escrito.** Nace de una pregunta del dueño sobre
`/citas/agenda/[fecha]` ("¿puede verse mejor?"), no de un handoff. Se documenta acá para no perder el
trabajo de diseño y para que cualquiera pueda retomarlo — no porque haya que hacerlo ya.

Prototipos visuales (Artifacts, sin código real, con datos ficticios):
- Frontdesk híbrido: https://claude.ai/code/artifact/36509dfa-58a6-4d83-9a62-1b8b64deeb9b
- Agenda del día: https://claude.ai/code/artifact/640c4bd4-ce8e-4835-9116-98b7e81b066a

## El problema (observado en vivo, 2026-08-20, CMR Bayamón, 20 de agosto)

`/citas/agenda/[fecha]` repite una **tabla completa de 9 columnas** (Hora, Tipo, Paciente, Récord,
Teléfono, Médico, Comentarios, Citado por, Estado, Acciones) por cada combinación de
media-hora × tipo de cita — de 07:00 a 16:30 son ~20 tablas casi idénticas, la enorme mayoría
mostrando solo una fila "N cupos libres + Agendar". Las citas reales del día (27 esa fecha) quedan
al final, partidas en dos tablas separadas por tipo bajo el rótulo "Sin hora", con sus propios
encabezados repetidos otra vez.

Efecto: mucho scroll para llegar a la información real, y las citas "sin hora" (la mayoría, ese
día 17 de 27) leen como un caso aparte en vez de citas normales que solo no tienen hora asignada.

## La propuesta

1. **Franja compacta de cupos por hora** — una tarjeta por hora (no una tabla), con un renglón chico
   por tipo mostrando "libres/total". Reemplaza las ~20 tablas vacías por una fila horizontal con
   scroll. La hora que ya tiene algo agendado se resalta.
2. **Una sola tabla de citas del día**, con o sin hora, ordenada y filtrable por tipo (chips, mismo
   patrón que los chips de servicio del Frontdesk). "Sin hora asignada" es un filtro más, no una
   sección aparte.
3. **KPIs arriba** ("27 citas · 10 atendidas · 0 no-show", hoy texto plano en una barra oscura) como
   tarjetas con ícono y color — mismo lenguaje visual que se usó en el prototipo de Frontdesk, para
   que ambas pantallas se sientan de la misma familia.

## Cómo se integraría (pedido explícito: sin tocar lo que ya funciona)

El dueño pidió expresamente **no reemplazar la vista actual** — quiere las dos convivan para que el
equipo opine antes de decidir. Ruta sugerida, pensada para blast radius cero sobre lo existente:

- Componente nuevo y separado (p.ej. `components/citas/agenda-dia-v2.tsx`), que consume las mismas
  funciones de `lib/api/` que ya usa la vista actual — sin modificarlas.
- Un switch "Vista nueva (beta)" en la barra de `app/(app)/citas/agenda/[fecha]/page.tsx`, guardado
  como preferencia del usuario (mismo mecanismo que ya existe para tema personal —
  `PUT /me/preferences`), que decide cuál de los dos componentes se monta. La vista actual **no se
  toca**: sigue siendo el default hasta que el dueño decida lo contrario.
- Sin endpoint nuevo: la propuesta es 100% reordenamiento visual sobre los mismos datos
  (`GET` de citas del día) que ya trae la vista actual.

## Qué falta antes de codear esto (si se decide seguir)

- Confirmar con el dueño que el switch por preferencia de usuario es el mecanismo de rollout que
  quiere (vs. un flag global, vs. un query param `?vista=nueva`).
- Spec formal si BE necesita algo (hoy no parece necesitarlo — ver arriba).
- TDD + `/review` + prueba en vivo con navegador real antes de mergear, como con cualquier cambio de
  FE en este repo.
