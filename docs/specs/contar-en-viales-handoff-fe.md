# Handoff FE — Contar el inventario en viales por presentación

**Estado: BE EN PRODUCCIÓN y verificado por HTTP real el 8-oct-2026** (Bayamón, Tirzepatide, sin
mover stock: el conteo coincidió y no generó ajuste).

## Por qué

Tirzepatide (y todo lo que se descarga por dosis) guarda su stock en su **medida base** (mg); el
vial es empaque. La pantalla de conteo/ajuste del FE (`lib/inventario/ajuste.ts`, `deltaDelConteo`)
pide el número en esa medida base y llama a `ajustar` con la diferencia. El 21-ago alguien escribió
**12 y 13 viales** donde iban **miligramos** y Tirzepatide quedó en 13 mg en Bayamón con 26 viales
en la nevera. Se corrigió a mano; la pantalla tiene que dejar contar en viales.

## Endpoint

`POST /api/v2/inventory/operations/count` (v1 `/api/v1/inventario/operaciones/conteo`), permiso
`inventario.ajustar`.

```json
{ "productId": "…", "warehouseId": "…",
  "containers": [ { "presentationId": "…", "quantity": 16 },
                  { "presentationId": "…", "quantity": 10 } ],
  "countedQuantity": 30 }
```

- `containers`: envases **cerrados** por presentación. Varias a la vez: hoy conviven el vial de
  60 mg/3 mL y el de 62,5 mg/5 mL (cambió el laboratorio).
- `countedQuantity` (opcional con `containers`): lo que queda en los **abiertos**, en medida base. Sin
  `containers` es el conteo entero en medida base, como antes.
- Las presentaciones del producto: `GET /api/v2/inventory/presentations?productId=…` (las que tienen
  `content`).

### Respuesta REAL (Bayamón, Tirzepatide, 16 + 10 viales)

```json
{ "data": { "contado": 1585, "sistema": 1585, "difference": 0,
  "breakdown": [
    { "presentationId": "7afe5fc8-…", "presentation": "Vial 60 mg / 3 mL (20 mg/mL) + B6",
      "containers": 16, "inBaseMeasure": 960 },
    { "presentationId": "db0e77b6-…", "presentation": "Vial 62.5 mg / 5 mL (12.5 mg/mL) + B6",
      "containers": 10, "inBaseMeasure": 625 } ] } }
```

Ojo: `contado` y `sistema` salen **en español también en v2** a propósito: el glosario es global y
caja ya sirve `contado` en el cuadre; traducirlo rompería esa pantalla. Si hay diferencia, `ajuste`
trae el movimiento generado.

Errores (`labelKey`): `inventory.count.nothingCounted`, `inventory.count.presentationNotOfProduct`,
`inventory.count.presentationWithoutContent`, `inventory.count.productWithoutUnit`; una conversión
imposible responde `UOM_SIN_RUTA`.

## Lo que se pide en pantalla

En el conteo/ajuste de un producto **con presentaciones con contenido**: una fila por presentación
(«Vial 60 mg / 3 mL: [ 16 ]», «Vial 62,5 mg / 5 mL: [ 10 ]») + «Abierto (mg): [ 30 ]», el total
convertido a la vista antes de confirmar, y llamar a este endpoint en vez de calcular la diferencia
y llamar a `ajustar`. Productos sin presentaciones: como hoy.

Razón completa: `cmr-be/docs/specs/contar-en-viales.md`.
