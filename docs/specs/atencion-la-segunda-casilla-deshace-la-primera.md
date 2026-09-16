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

---

## Respuesta del FE (2026-09-16, commit e754f1d + marca de versión)

**El arreglo está en main y desplegado (e754f1d).** La decisión de la casilla se extrajo a una función
PURA y testeada (`lib/tablero/toggle-hora.ts`, 5 tests, incluida la reproducción exacta): el `back` de
una casilla es ahora el reverso de SU etapa (`forward.toStatus`), no una transición cualquiera que baje
desde el estado de la fila. Con eso, «En consulta» con la fila en `presente` solo puede mandar `consulta`
o —si fuese la última etapa— `volver_presente`; **nunca `volver_confirmada`**. Verificado además que las
celdas del render tienen keys estables (no se cruzan handlers) y que no hay service worker que fije un
bundle viejo.

**Explicación más probable de que siguiera fallando:** el navegador servía el bundle ANTERIOR (justo lo
que no podían verificar). Por eso se añadió lo que pidieron:

**Marca de versión, ya en la página:** el pie de la barra lateral muestra `build <sha7>` (el commit que
sirve el navegador AHORA), inlinado en el build desde `VERCEL_GIT_COMMIT_SHA`. Para comprobar en un
minuto: recargar con caché limpia y leer el `build` del pie — si coincide con el commit del arreglo (o
posterior) y AÚN falla, es un caso nuevo; avisen con ese `build` y el estado antes/después y lo retomo.

---

## Con el build 980ee46 LEÍDO EN PANTALLA, sigue pasando (16-sep, 10:33)

Gracias por la marca de versión: resuelve la duda que yo no podía cerrar. **Ya no es el bundle viejo.**

**Verificado** — navegador reiniciado desde cero (proceso nuevo, sin caché ni sesión previa), sesión
real de la operadora, y el pie de la barra lateral leído en la misma pantalla de la prueba:

```
build 980ee46                      ← leído en el pie, en esta misma sesión
clic 1ª casilla → [✓ 10:31] ; GET /appointments → estado = presente
clic 2ª casilla → 1 POST /board/action → estado = confirmada     ← deshace

repetido: [✓ 10:33] → presente ; clic 2ª → 1 POST → confirmada
```

Cita: `ada2a26a-f802-4ded-bec5-3acff5442eb1` (Bayamón, PRUEBA FINAL BAYAMON QA).

**Dato que puede ayudar:** sale **una sola** llamada a `/board/action`, no dos. Así que no es un doble
disparo (primera + segunda); es una única acción, y por el resultado solo puede ser `volver_confirmada`.

**Supuesto, no verificado:** cuál es la acción exacta que viaja en el cuerpo. Desde aquí solo veo
método, URL y código de respuesta, no el payload. Si registráis el `action` enviado en consola —o me
decís cómo leerlo— lo confirmo en la siguiente pasada y dejamos de suponer los dos.

**Contexto que quizá importe:** en ambas mediciones la fila estaba **filtrada** (pestaña «Confirmed»
para el primer clic y «Checked in» para el segundo), porque en el día había dos filas y necesitaba
aislar la de la prueba. Si el filtrado remonta la lista entre un clic y otro, el estado interno de la
celda podría quedar desfasado — eso encajaría con un `optimistic` que sobrevive al remonte.
