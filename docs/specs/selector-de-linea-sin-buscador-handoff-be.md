# FE — El selector de línea de la factura solo ofrece 100 artículos y no busca

Medido en producción el 24-ago-2026 replicando las 5 facturas reales de Bayamón con la sesión de
`wortiz`, el facturador de verdad.

## El problema

En `/facturacion/<id>` el desplegable «Agregar línea» carga **exactamente 100 artículos** y:

- **no tiene ningún campo de búsqueda** (el popover abierto no contiene un solo `input`);
- **no pagina al bajar**: llegar al final de la lista no dispara ninguna petición nueva.

El catálogo del centro es mucho mayor, así que todo lo que no caiga en esos 100 es **imposible de
facturar desde la pantalla**. Casos reales de hoy, los tres de facturas que la clínica emitió:

| SKU | Artículo | Factura del legado |
|---|---|---|
| `CMALA01` | NPT Stem Cells | suero 244005 — $10.000 con $5.000 de descuento |
| `TDSP30` | Terapia del dolor FULL HILT | láser 037166 y 037167 |
| `TMAG01` | Terapia MAG - PEMF | láser 037166 |

Para emitirlas hubo que cargar las líneas por API. El resto del flujo —pago, emisión, impresión—
funciona bien en pantalla.

## El backend ya lo resuelve

`GET /api/v1/precios/catalogo?q=<texto>&tipoPrecioId=<id>&page=1&limit=50` busca por SKU y por nombre
y devuelve el artículo con su precio de la lista:

```jsonc
{ "productoId": "5922c4d1-…", "sku": "CMALA01", "nombre": "NPT Stem Cells",
  "presentacionId": "71f15180-…", "presentacionNombre": "NPT Stem Cells",
  "precio": 10000, "tipoPrecioId": "3becd4e1-…", "clinicId": "ef6f87b0-…" }
```

Comprobado: `q=CMALA01` → 1 resultado; `q=TDSP30` → 1; `q=TMAG01` → 1; `q=TDSP` → 2. El
`tipoPrecioId` es el de la lista de precios de la factura (la que la cabecera muestra como «Regular»).

`GET /facturas/catalogo` —lo que la pantalla usa hoy— también acepta `?q=`, pero **ignora `limit`** y
sin `q` devuelve siempre 100.

## Qué hay que hacer

Convertir el desplegable en un **combobox con búsqueda**: al teclear (con un respiro de ~250 ms),
llamar a `/precios/catalogo?q=…&tipoPrecioId=…` y pintar esos resultados. La carga inicial de 100
puede quedarse como «lo más usado» mientras no se escriba nada.

Detalles que importan:

- Buscar por **SKU y por nombre**: el personal teclea el código (`TDSP30`), no el nombre largo.
- Enseñar el SKU junto al nombre en cada opción: hay artículos con nombres casi idénticos
  («Terapia del dolor (1 sesión) MLS» vs «(5 Sesiones)»), y el código es lo que los distingue.
- Sin resultados ≠ lista vacía sin explicación: decir «no hay nada con ese texto».
- El precio viene en la respuesta; al elegir, rellenar el precio como ya se hace.

## Lo demás de la pantalla funciona

Verificado emitiendo las 5 facturas: el cálculo cuadra al centavo con el legado (incluido el
descuento por monto, que baja la base del IVU: $246.76 − $49.35 → estatal $20.73 + municipal $1.97 =
total $220.11), el pago y la emisión funcionan, el inventario descarga al emitir (KYDNEY PLUS 26 → 24)
y las sesiones del láser entran en frontdesk (20 pendientes por agendar).

## Un detalle menor

La pantalla de factura llama a `GET /profiles` y recibe **403** con cualquier usuario no admin
(`wortiz` lo es). No rompe nada visible, pero ensucia la consola y pide un endpoint de administración
desde una pantalla de caja: conviene quitar esa llamada.
