# Handoff BE — falta un endpoint para traer pacientes por lote de IDs

## El hallazgo (verificado en vivo, no supuesto)

QA en navegador real contra producción (api.centrodemedicinaregenerativa.com, 09-oct-2026): al
abrir el calendario de Citas Médicas (`components/agenda/medicas-calendar.tsx`), la pantalla
disparó **varios cientos de peticiones `GET /api/v2/patients/:id` individuales, una por cada
paciente distinto del mes** — y producción empezó a responder **429 (demasiadas peticiones)** a
muchas de ellas, confirmado con la pestaña de red del navegador.

La causa: `lib/agenda/use-paciente-map.ts` (`usePacienteMap`) hace
`Promise.all(ids.map((id) => getPaciente(id)))` porque `GET /api/v2/patients` no acepta NINGÚN
query param (`query?: never` en el OpenAPI) — no hay forma de pedir "estos 80 pacientes" de una
sola vez, así que el FE no tiene otra opción hoy que pedirlos uno por uno.

**No es un bug introducido por un cambio reciente** — el hook existe desde antes y el PR que
tocó `medicas-calendar.tsx` esta semana (#108) no cambió esa llamada. Es deuda ya en producción
que recién se hizo visible al probar un mes con muchas citas distintas.

## El pedido

Un endpoint (o parámetro) para traer varios pacientes de una sola llamada, por ejemplo:

```
GET /api/v2/patients?ids=uuid1,uuid2,uuid3,...
```

o el equivalente que el BE prefiera (POST con body si la lista puede ser larga). Alcanza con
devolver los mismos campos que ya trae `GET /api/v2/patients/:id`, en un array.

## Dónde se usa (para dimensionar)

- `lib/agenda/use-paciente-map.ts` — el único consumidor hoy; resuelve nombres de paciente para
  filas de citas/sesiones que solo traen `patientId`. Se usa en el calendario de Citas Médicas
  (`components/agenda/medicas-calendar.tsx`) sobre un MES completo de citas — ahí es donde se vio
  el reclamo en vivo, pero el mismo patrón puede repetirse en cualquier vista que liste muchas
  citas/sesiones a la vez.

## Mientras tanto (mitigación del lado FE, no bloqueante)

Se puede acotar el daño sin el endpoint nuevo (limitar cuántos ids distintos se piden a la vez,
o cachear entre meses) pero es un parche, no la solución — con un calendario concurrido el límite
de 429 se alcanza igual. El arreglo real es el batch endpoint.

## Contexto

Encontrado haciendo QA en navegador real del PR #108 (rediseño de navegación/pickers), 09-oct-2026.
El PR en sí no tiene este bug — se mergeó aparte — pero quedó claro que este hueco en la API ya
afecta producción hoy.
