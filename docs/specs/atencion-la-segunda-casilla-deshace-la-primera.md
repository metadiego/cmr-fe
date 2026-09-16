# Tablero de Atención: la casilla «En consulta» deshace la llegada

**Fecha:** 2026-09-16 · **De:** BE · **Para:** FE · **Reproducible** (3 veces, dos días distintos)

## Cómo reproducirlo

1. Una cita confirmada del día, en `/boards/atencion`.
2. Pulsar la **primera** casilla del flujo (Presente). Queda marcada con su hora y el BE pasa la cita
   a `presente`. Correcto.
3. Pulsar la **segunda** casilla (En consulta), que está habilitada y vacía.
4. Resultado: **las dos casillas se desmarcan** y la cita vuelve a `confirmada`.

Medido contra producción con la sesión real de la operadora (Ivelisse), con refs tomados justo antes
del clic:

```
antes del 2º clic : estado = presente ; casilla1 [checked "09:47"] ; casilla2 [ ] ; casilla3 [disabled]
POST /api/v2/board/action → 201
después           : estado = confirmada
```

## Por qué NO es del BE

Las transiciones que publica el tablero son correctas y encadenan bien:

```
presente  | ['programada','confirmada'] → presente
consulta  | ['presente']                → en_consulta
atender   | ['en_consulta']             → atendida
volver_confirmada | ['presente']        → confirmada
```

Ejecutadas por API en ese orden con la misma sesión, la cita llega a `atendida` sin problema. El 201
del paso 3 solo se explica si la pantalla envió `volver_confirmada` — que es el **back de la casilla
anterior**, no el forward de la que se pulsó.

## Dónde mirar

`components/tablero/celda-toggle-hora.tsx`. El `back` se calcula desde el **estado actual de la
fila**, no desde la etapa de esa casilla:

```ts
const back = transiciones.find(
  (t) => t.fromStatuses.includes(estado) && t.toStatus != null && ordenOf(t.toStatus) < ordenOf(estado),
);
```

Con la fila en `presente`, la casilla «En consulta» calcula `back = volver_confirmada`. Si por
cualquier vía esa casilla se evalúa como `checked` (p. ej. un `optimistic` que no se limpió tras el
clic anterior, o `baseChecked` derivado del sello de la etapa previa), `toggle()` manda el `back` en
lugar del `forward`, y el usuario ve deshacerse lo que acababa de marcar.

## Impacto

El flujo de Atención no se puede completar desde la pantalla: el paciente no pasa de «presente».
Es el camino diario del puesto.
