# Stock live de las balanzas — handoff BE → FE

**Fecha:** 2026-10-27 · **BE:** `7a7f2fa`, `f57a4d8`, `2ee057e` (en producción) · **Spec BE:**
`cmr-be/docs/specs/stock-live-de-las-balanzas.md`

## Qué es

Las balanzas de inventario (Pasti) cuentan cuántas unidades de cada variante hay en cada plato del
almacén. El BE guarda cada cambio y calcula el **stock live**, que solo **informa** y **nunca** cambia
el inventario contable. Los displays fuera del almacén ya cuentan en el contable, así que los dos
números son distintos a propósito.

## Pantalla nueva: `/inventory/live-stock`

El menú ya tiene el ítem en Inventario: clave `inventory-live-stock`, `labelKey`
**`nav.inventory_live_stock`**, permiso `inventario.read`. Hay que añadir la traducción, «Stock live
(balanzas)» / «Live stock (scales)», y la ruta en `lib/nav-manifest.ts`.

### Datos: `GET /api/v2/inventory/scale/live-stock`

Filtros opcionales:
- `warehouseId`;
- `productId`;
- `centerIds`, repetible, para ver varios centros si el usuario puede.

Respuesta real de producción (27-oct, Caguas; el dispositivo `qa-test-scale` es de prueba):

```json
{ "data": { "generatedAt": "2026-10-27T17:07:55.554Z", "warehouses": [ {
  "warehouseId": "b6a99d6f-…", "warehouseName": "Almacén Principal", "clinicId": "5f98ef29-…",
  "pads": [ { "deviceId": "qa-test-scale", "pad": 1, "supplierPresentationId": "09898e08-…",
      "presentationName": "VALERIANA OFFICINALIS 120 CAPS — 120 cápsulas", "productId": "158192ca-…",
      "sku": "VALERI120", "productName": "VALERIANA OFFICINALIS 120 CAPS", "units": 12,
      "doubtful": false, "kind": "change", "measuredAt": "2026-10-27T17:07:43.000Z" } ],
  "products": [ { "productId": "158192ca-…", "sku": "VALERI120", "productName": "VALERIANA OFFICINALIS 120 CAPS",
      "liveUnits": 12, "doubtful": false, "bookUnits": 23, "bookUnit": null,
      "byPad": [ { "deviceId": "qa-test-scale", "pad": 1, "supplierPresentationId": "09898e08-…",
          "units": 12, "doubtful": false, "measuredAt": "2026-10-27T17:07:43.000Z",
          "presentationName": "VALERIANA OFFICINALIS 120 CAPS — 120 cápsulas" } ] } ] } ] } }
```

### Cómo mostrarlo (pantalla completa, sin pasos de más)

- **Cabecera**:
  - selector de almacén, y de centro si el usuario tiene varios;
  - «Actualizado hace X min», a partir de `generatedAt`;
  - botón **Actualizar**. Con un sondeo cada 60 s alcanza, porque los eventos llegan al cambiar.
- **Vista principal, «Por producto»** (`products`), una tabla densa a lo ancho:
  - columnas: SKU, Producto, **Almacén (balanza)** = `liveUnits`, **Contable** = `bookUnits` más
    `bookUnit` si viene, Balanzas = `byPad.length`, Última lectura = el `measuredAt` más reciente;
  - **no calcular la diferencia**: el contable incluye los displays y las unidades pueden no ser las
    mismas. Mostrarlos lado a lado, con una nota fija: «El contable incluye los displays fuera del
    almacén».
  - Si `doubtful` es true, un chip de aviso: «Conteo dudoso».
  - Al expandir la fila, el desglose `byPad`: balanza, plato, variante, unidades y hora.
- **Pestaña «Por balanza»** (`pads`): un grupo por `deviceId` con sus platos, en tarjetas compactas
  (plato, producto, unidades en grande, hora y chip si es dudoso).
  - Un plato con `units: 0` se muestra como «vacío», no se oculta.
  - Una lectura vieja (más de 24 h sin evento) va atenuada, con su hora.
- **Historial** de un plato o de un producto, en un panel lateral, con
  `GET /api/v2/inventory/scale/stock-events?deviceId=&pad=&supplierPresentationId=&since=&until=&limit=`.
  - Campos reales: `externalId`, `deviceId`, `pad`, `warehouseId`, `supplierPresentationId`,
    `productId`, `units`, `previousUnits`, `totalWeightG`, `unitWeightG`, `kind`
    (`change|snapshot|boot`), `doubtful`, `measuredAt`.
  - Una línea por evento: «13 → 12», el tipo y la hora.
- **Estados**:
  - vacío («Ninguna balanza ha enviado datos en este almacén»);
  - cargando;
  - error con reintento.
- **i18n**: todas las etiquetas por `labelKey`, nada escrito a fuego.

### Opcional: columna en Existencias

`GET /api/v2/inventory/scale/live-stock?productId=<id>` devuelve el `liveUnits` de un producto, para
mostrar «Almacén (balanza)» junto al stock contable.

## Pruebas que pide

- Con el usuario real de inventario de Caguas, la pantalla muestra el producto de prueba VALERI120 con
  12 en balanza y 23 en contable, y **no** muestra una resta.
- Un usuario de Bayamón no ve el almacén de Caguas.
- El chip «Conteo dudoso» sale en EASYDUST1 (`doubtful: true`).
- El historial del plato 1 muestra 13 y luego 12.
