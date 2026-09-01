# Handoff BE — ancho del recibo térmico como preferencia por centro

> FE → BE. Fecha: 2026-08-20. Complementa `recibo-termico-sale-en-miniatura.md` (ya resuelto en el FE).

## Qué ya hizo el FE
El recibo térmico se imprimía en miniatura porque el CSS pedía 80mm sobre un área imprimible de 72mm.
Arreglado (commit 606b9d4): el ancho ahora sale de una variable `--recibo-ancho` con **default 72mm**,
y el FE la sobreescribe leyendo `GET /me/preferences → effective.recibo.anchoMm` (mismo motor de
capas que `colorPorCentro`). El FE YA consume esa clave: si llega, la usa; si no, deja 72mm.

## Qué falta en el BE (pequeño, mismo patrón que colorPorCentro)
Sembrar la clave en el esquema de preferencias, para que el ancho sea DATO por centro y no una
constante del código:

- **Capa `sistema` (default)**: `recibo: { anchoMm: 72 }`. Es el ancho IMPRIMIBLE (no el del rollo:
  un rollo de 80mm imprime ~72mm; uno de 58mm imprime ~48mm).
- **Capa `centro`**: que un centro con rollo de 58mm pueda fijar `recibo: { anchoMm: 48 }` (o el
  imprimible real de su impresora) sin tocar código.
- No hace falta endpoint nuevo: `PUT /preferences/centro/:id` y `PUT /me/preferences` ya aceptan
  cualquier clave del mismo shape. Solo confirmar que `recibo.anchoMm` (número, mm) viaja en `effective`.

## Verificación
`GET /me/preferences` de un centro con rollo de 58mm debe traer `effective.recibo.anchoMm = 48`
(o el que se configure); el recibo debe imprimir a ese ancho sin franjas ni miniatura. Un centro sin
configurar cae al default 72mm.
