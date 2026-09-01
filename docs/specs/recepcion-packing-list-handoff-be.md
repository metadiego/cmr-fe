# FE — Recibir compra por PACKING LIST (cabecera + carrito de líneas)

El backend ya está listo. Falta la pantalla.

## Por qué cambia la pantalla

Una compra no llega producto por producto: llega un packing list con diez o veinte líneas, todas del
mismo proveedor y la misma factura. La pantalla actual recibe UNA línea y la escribe al instante, así
que hay que repetirla entera por cada producto y volver a teclear proveedor y número de factura cada
vez. Y si te interrumpen en la línea siete, el inventario se queda con seis productos que la factura
del proveedor no cuadra.

## El endpoint

```
POST /api/v1/inventario/operaciones/recibir-compra-lote
```

```jsonc
{
  "almacenId": "…",               // opcional: si no va, el del centro activo
  "proveedorId": "…",             // opcional, común a todas las líneas
  "numeroFacturaCompra": "F-118", // opcional, común — el nº del PROVEEDOR
  "fechaEfectiva": "2026-08-22",  // opcional, común (por defecto, ahora)
  "notas": "…",                   // opcional, común
  "items": [                       // 1 a 200 líneas
    {
      "productoId": "…",
      "cantidad": 24,                      // > 0, en la unidad de inventario del producto
      "costoUnitario": 12.5,               // opcional
      "numeroLote": "L-1",                 // opcional, PROPIO de la línea
      "fechaVencimiento": "2027-12-31",    // opcional, PROPIO de la línea
      "presentacionProveedorId": "…",      // opcional
      "ubicacionId": "…",                  // opcional
      "notas": "caja rota"                 // opcional, gana a la nota común
    }
  ]
}
```

Respuesta: `{ documentoId, lineas: [{ lote, movimiento }] }`.

**Todo o nada.** Si una línea falla, no entra ninguna. No hace falta que el FE deshaga nada.

Para volver a ver la recepción: `GET /api/v1/inventario/operaciones/recepciones/:documentoId`
devuelve la cabecera y las líneas con producto, cantidad, costo, lote y vencimiento. Úsalo para
mostrar el recibo después de guardar.

Permiso: `inventario.recibir` (el mismo que la de una línea). El recibo pide `inventario.read`.

## La pantalla que hace falta

Cabecera arriba (almacén, proveedor, nº de factura del proveedor, fecha, notas) y debajo un **carrito
de líneas**: se elige producto, cantidad, costo, lote y vencimiento, se pulsa «Agregar» y la línea
cae en una tabla editable. Un solo botón **«Recibir»** al final envía todo. Aprovecha el ancho: la
cabecera no necesita más de un tercio de la pantalla y la tabla de líneas se lleva el resto.

Detalles que importan en el mostrador:
- El mismo producto puede ir en DOS líneas con lotes y vencimientos distintos. No lo bloquees ni lo
  agrupes: es lo que trae un packing list de verdad.
- Total de líneas y suma del costo a la vista, para cuadrar contra el papel del proveedor.
- Al guardar, enseña el recibo (el `documentoId`) y deja volver a él.
- Errores del backend a mostrar tal cual, que ya vienen con su `labelKey`:
  `inventario.recepcion_sin_lineas`, `inventario.recepcion_demasiadas_lineas`,
  `inventario.recepcion_cantidad_invalida`. Añade esas tres claves a `messages/es.json` y `en.json`.

## Ojo — una discrepancia que hay que zanjar

La pantalla actual dice: «Si eliges una presentación de proveedor (AMP), la cantidad y el costo van
POR EMPAQUE — el sistema convierte a unidad base con el factor». **El backend NO hace esa
conversión** al recibir: la cantidad se guarda tal como llega, en la unidad de inventario del
producto (la única autoridad de conversión es `reglas_descarga.factorBase`, y es de SALIDA).

O el FE ya convierte antes de enviar, o ese texto promete algo que no ocurre y una compra por
empaques entraría mal. Confírmalo antes de recibir una compra con AMP; no lo cambié porque cambiar la
regla de conversión no es cosa de esta entrega.

## La transferencia (para más adelante, mismo enfoque)

La transferencia entre centros ya es multi-línea con aprobación del destino
(`POST /inventario/transferencias`, `items[]` con `loteId` y cantidad; el destino acepta total o
parcialmente y el stock no sube allí hasta que acepta). Su pantalla necesita el mismo patrón de
carrito. Va aparte.
