# Decisión del dueño: las citas viejas se quedan en «programada»

**22-sep-2026.** La pregunta llevaba días abierta y la respuesta es **no se tocan**.

## De qué hablamos

**900 citas** con fecha pasada siguen en estado `programada`: de **20-ene-2026** a **12-sep-2026**,
602 del canal `atencion` y 298 del canal `callcenter` (contado en producción hoy).

Nunca se movieron a `atendida`, `no_show` ni `cancelada` porque nadie las cerró en su día. La
tentación era «igualarlas» de un pase.

## La decisión

**Se quedan como están.** No se pasan a otro estado, ni por script ni a mano.

El motivo es simple: nadie sabe hoy qué pasó con cada una de esas visitas, y ponerles un estado
inventado sería escribir en la historia clínica algo que nadie vio. Un `programada` viejo dice la
verdad —«esta cita quedó sin cerrar»—; un `atendida` falso o un `no_show` falso mienten, y encima
ensucian las estadísticas de asistencia y de captación.

## Qué implica

- **Ni el BE ni el FE hacen nada.** El tema queda cerrado: no hace falta volver a preguntarlo.
- Si una pantalla necesita separarlas de las citas futuras, lo hace **por fecha**, no cambiándoles el
  estado.
- El cron de auto-revertir (`confirmada → programada`) sigue como está y no las toca.

Recordatorio del contexto: estos datos son reales pero **de prueba**; al entrar en producción se
borran las citas y se vuelven a sincronizar, así que estas 900 desaparecen solas.
