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

---

## Sigue pasando DESPUÉS del arreglo `e754f1d` (16-sep, 10:19)

**Verificado** contra `https://cmr-fe-gamma.vercel.app` con la sesión real de la operadora, dos
ciclos seguidos, con refs tomados inmediatamente antes de cada clic y el estado consultado en el API
después de cada uno:

```
ciclo 1: [ ] [disabled] [disabled]  → clic 1ª → estado = presente ; [✓ 10:17] [ ] [disabled]
         clic 2ª → POST /board/action 201 → estado = confirmada      ← deshace
ciclo 2: [ ] [disabled] [disabled]  → clic 1ª → estado = presente ; [✓ 10:19] [ ] [disabled]
         clic 2ª → estado = confirmada                                ← deshace
```

Cita usada: `ada2a26a-f802-4ded-bec5-3acff5442eb1` (Bayamón, 16-sep, PRUEBA FINAL BAYAMON QA).

**Supuesto, no verificado:** que el navegador estuviera sirviendo ya el build de `e754f1d`. No tengo
forma de comprobar la versión del bundle desde aquí; si el despliegue no había llegado a esa URL
cuando corrí la prueba, esta evidencia no dice nada nuevo y basta con repetirla.

Para descartarlo en un minuto: dejad en la página algún rastro de versión (un `data-build` en el
`<html>` o el hash corto en el pie), y vuelvo a medir.
