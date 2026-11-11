# Handoff BE — «Estadísticas Diarias» necesita las unidades, no solo pacientes

> FE → BE. Fecha: 2026-11-11. No bloqueante: pedido del dueño, no bug.

## Qué pidió el dueño

Revisando `/billing/invoices/stats?desde=2026-11-11&hasta=2026-11-11` (Caguas), para Sueroterapia
Vit C la pantalla dice «Aplicados: 19». Verificado cruzando con `GET /frontdesk/sesiones` del mismo
día/centro/servicio: 19 sesiones `asistido` es correcto como CONTEO DE PACIENTES, pero el total de
**viales/dosis realmente administrados** (`data.cantidad` de cada sesión) suma **20**, no 19 — una
paciente recibió un vial de 60 g con `cantidad: 2` en vez de 1. El dueño quiere que la pantalla
muestre los dos números: **«19 Pac / 20 Vials»**.

## Lo verificado (fuente: HTTP real, no supuesto)

- `GET /api/v2/estadisticas/diarias?desde=2026-11-11&hasta=2026-11-11` (Caguas) responde, para Vit C,
  exactamente `{ "slug": "vitc", "name": "Sueroterapia Vit C", "applied": 19, "sold": 36,
  "returned": 0 }` — **sin ningún campo de unidades**. `applied` es conteo de sesiones, no de
  viales.
- La pieza para calcular lo que falta YA EXISTE y está en producción: BE #554 agregó exactamente este
  concepto («units applied: areas in laser, doses in Vit C, 1 per visit elsewhere») al OTRO reporte,
  `GET /estadisticas/servicios`, como el campo `therapies` (`EstServicio.therapies`,
  `EstRol.therapies`, `EstRolFila.therapies`/`therapiesShare` — ver `lib/api/estadisticas.ts:29-49`
  del FE). `/estadisticas/diarias` no lo tiene.

## Lo que se pide

Agregar `therapies` (mismo nombre, mismo concepto que BE #554) a cada fila de
`services[]` en `GET /estadisticas/diarias`, junto a `applied`/`sold`/`returned`:

```json
{ "slug": "vitc", "name": "Sueroterapia Vit C", "applied": 19, "sold": 36, "returned": 0, "therapies": 20 }
```

- Mismo criterio que BE #554 ya usa en el otro reporte para ese servicio (áreas en láser, dosis/
  `cantidad` en Vit C e Intravenoso, 1 por visita en el resto) — no inventar una regla nueva, reusar
  la que ya calcula `/estadisticas/servicios`.
- Ausente u opcional está bien donde `therapies === applied` (la mayoría de servicios, 1 unidad por
  visita) — el FE solo necesita el número cuando puede diferir, pero si es más simple mandarlo
  siempre, también sirve.

## Qué hace el FE con esto

En `components/reportes/estadisticas-diarias-view.tsx`, la columna «Aplicados» pasa a mostrar
«{applied} Pac / {therapies} Vials» (o la etiqueta que corresponda por servicio) cuando
`therapies !== undefined && therapies !== applied`; si no viene el campo, o si coincide con
`applied`, sigue mostrando solo el número como hoy — sin cambio visible para el resto de los
servicios.

## Relacionado
- `lib/api/estadisticas.ts` (tipos `EstDiariaServicio`, `EstServicio`).
- BE #554 (el mismo cálculo, en el reporte hermano).
