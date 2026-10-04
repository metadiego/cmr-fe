# El cuadre de efectivo debe avisar DESCUADRE cuando nadie ha contado

**BE:** PR #389 en revisión (`feat/cuadre-descuadra-sin-conteo`, cmr-be), sin desplegar todavía.
**FE:** pendiente — cambiar cómo se pinta "Diferencia (cuadra)" en la pantalla de cuadre
(`billing/cash/*`).

## El problema (encontrado por el dueño en producción)

Hoy, cuando nadie ha contado el efectivo todavía, la pantalla muestra **"Diferencia (cuadra):
$0.00" en verde** — exactamente igual que un cuadre que sí cuadró de verdad. Con ventas reales en
efectivo sin contar (p. ej. $100 esperados, $0 contados), eso es un falso positivo: parece que
todo está bien cuando en realidad nadie ha hecho el conteo físico.

## Lo que cambia en el API

`GET caja/reportes/dia` (y `GET cash/reports/day` en v2) gana un campo nuevo:

```json
"cuadre": {
  "contado": false,
  "fondoInicial": 0,
  "efectivoContado": 0,
  "efectivoEsperado": 100,
  "diferencia": -100
}
```

- `contado: false` → **nadie ha registrado un conteo de billetes todavía**. `diferencia` viene
  negativa por el efectivo esperado completo (un descuadre real y medible).
- `contado: true` → ya hay un conteo real (`efectivoContado`/`fondoInicial` vienen del cuadre
  guardado). `diferencia = efectivoContado - fondoInicial - efectivoEsperado`, como siempre:
  positiva = sobrante, negativa = faltante, cero = cuadró.

## Qué tocar en el FE

1. **Leer `cuadre.contado`** antes de pintar "Diferencia (cuadra)":
   - `false` → mostrar en **amarillo o rojo, parpadeando** (pedido explícito del dueño), con un
     texto tipo "Sin contar — falta $100.00" usando `cuadre.diferencia` (ya viene con el signo
     correcto). **Nunca** el verde de "cuadra" cuando no hay conteo.
   - `true` → el comportamiento de siempre: verde si `diferencia === 0`, rojo/amarillo si no.
2. **Dejar de calcular "Efectivo en caja"/"A depositar" a mano en el FE** (si se estaba haciendo)
   y usar `cuadre.fondoInicial`/`cuadre.efectivoContado`/`cuadre.efectivoEsperado` ya resueltos
   por el BE — evita que el FE adivine la fórmula y la vuelva a tener mal.
3. Aplica a las dos pantallas de cuadre (`consulta` y `general`), ya que ambas consumen el mismo
   `reporteDia()`.

## No-scope

- No cambia el cuadre ya CERRADO (`CajaService.cerrar()`/su propia `diferencia`) — esa lógica ya
  era correcta. Esto es solo la vista EN VIVO, antes de cerrar el día.

Razón completa: `cmr-be/docs/specs/cuadre-efectivo-sin-conteo-descuadra.md`.
