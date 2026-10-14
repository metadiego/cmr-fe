# Paquetes de venta — handoff BE → FE

**Fecha:** 2026-10-14 · **BE:** `f52d165`, `248f56b`, `7c9d221` (desplegados y verificados en
producción) · **Spec BE:** `cmr-be/docs/specs/paquetes-de-venta.md`

## Qué es

Cada centro tiene sus paquetes, por ejemplo «Láser IV · 12 terapias»: 12 sesiones por $1.440. El
**precio regular** no se teclea: sale del catálogo (el precio de una sesión en el centro × las
sesiones). Al venderlo, la factura lleva la línea a **precio regular** con el **descuento del
paquete**, así que la factura y el recibo pueden decir: precio regular, ahorro y lo que se paga. Es lo
que se pidió: «dejar evidencia clara de los precios reales y lo que se están ahorrando».

Ya están cargados en producción los 11 paquetes de Diego en **los dos centros** (22 filas).

## 1. Pantalla de configuración (CRUD) — menú «Paquetes de venta»

Hay un ítem de menú nuevo, sembrado en producción: `clave: 'paquetes-venta'`,
`labelKey: 'nav.paquetesVenta'`, `path: '/inventory/sales-packages'`, `parentClave: 'g-inventario'`,
`orden: 11`, `permisoClave: 'precios.read'`. Falta la entrada en `lib/nav/manifest.ts` y la página.

**Listar** — `GET /api/v2/billing/sales-packages?centerIds=a,b&includeInactive=true`
(`centerIds` es opcional: si falta, se usa el centro activo). Esta es la respuesta REAL de producción
(14-oct, Bayamón), una fila:

```json
{
  "id": "6d82346f-…", "clinicId": "ef6f87b0-…",
  "name": "Láser IV · 12 terapias",
  "productId": "162fffaf-…", "productName": "LASER INTRAVENOSO - ENDO", "productSku": "LI001",
  "sessions": 12, "packagePrice": 1440,
  "regularUnitPrice": 180, "regularPrice": 2160, "savings": 720, "savingsPct": 33.33,
  "sortOrder": 2, "active": true, "updatedBy": null, "createdAt": "…", "updatedAt": "…"
}
```

Columnas sugeridas: Nombre · Producto (sku) · Sesiones · **Regular** · **Paquete** · **Ahorro (%)** ·
Activo. Los tres últimos números los calcula el BE; el FE no calcula nada.

**Crear** — `POST /api/v2/billing/sales-packages`
`{ centerId?, name, productId, sessions, packagePrice, sortOrder?, active? }`.
**Editar** — `PUT /api/v2/billing/sales-packages/:id`, parcial (el centro no se cambia).
**Retirar** — `DELETE /api/v2/billing/sales-packages/:id`. Pone `active=false`; no se borra, porque
las facturas lo nombran. Para reactivarlo: `PUT { active: true }`.

Permisos: `precios.read`, `precios.create`, `precios.update` y `precios.delete`, en el centro.

Errores (llegan `labelKey` y `failures: [{ labelKey, field }]`, todos a la vez):

- 400 `SALES_PACKAGE_INVALID` con `salesPackage.nameRequired`, `salesPackage.duplicateName`,
  `salesPackage.invalidSessions`, `salesPackage.invalidPrice`, `salesPackage.priceNotBelowRegular`
  (el paquete tiene que costar **menos** que el regular), `salesPackage.noRegularPrice` (el producto
  no tiene precio regular en ese centro), `salesPackage.duplicateProductSessions`,
  `salesPackage.productNotFound` y `salesPackage.centerRequired`.
- 404 `SALES_PACKAGE_NOT_FOUND` con `salesPackage.notFound`.
- 403 con `centros.no_autorizado`.

## 2. Vender un paquete en la factura (facturación general)

En el editor de la factura borrador hace falta un botón «Agregar paquete». Abre la lista
`GET /billing/sales-packages`, que ya viene del centro de la factura si mandas `X-Tenant-ID` con ese
centro. Al elegir uno:

`POST /api/v2/invoices/:invoiceId/sales-packages` `{ "packageId": "…" }` — permiso
`factura.create`, el mismo que agregar una línea. Devuelve la línea creada. Esta es la respuesta REAL
(factura borrador de prueba, que luego se descartó):

```json
{
  "id": "e319fc88-…",
  "description": "LASER INTRAVENOSO - ENDO · Láser IV · 12 terapias",
  "quantity": 12, "sessions": 12, "unitPrice": 180,
  "discountType": "monto", "discountValue": 720, "discount": 720, "total": 1440,
  "salesPackageId": "6d82346f-…",
  "meta": { "salesPackage": { "id": "6d82346f-…", "name": "Láser IV · 12 terapias", "sessions": 12,
            "regularUnitPrice": 180, "regularPrice": 2160, "packagePrice": 1440, "savings": 720 } }
}
```

Y la factura queda con subtotal 2160, descuento 720 y total 1440.

Errores: 404 `SALES_PACKAGE_NOT_FOUND` si el paquete es de otro centro; 400 `SALES_PACKAGE_INVALID`
con `salesPackage.inactive` si está retirado.

**Una línea de paquete no se edita.** `PUT /invoices/:id/items/:itemId` con `quantity`, `sessions`,
`unitPrice` o algún descuento responde 409 `SALES_PACKAGE_LINE_LOCKED`, `labelKey:
salesPackage.lineLocked`. En la línea, cuando `salesPackageId != null`, los campos de cantidad,
precio y descuento van **de solo lectura**, con una nota «Paquete: para cambiarlo, quítalo y agrégalo
de nuevo». Quitarla (`DELETE …/items/:itemId`) sí se puede. La descripción sí se puede editar.

## 3. La evidencia: factura en pantalla, PDF y recibo térmico

En cualquier línea con `meta.salesPackage` (sirve también para facturas viejas: el dato está
congelado ahí), debajo de la descripción:

> **Paquete Láser IV · 12 terapias** — Precio regular $2,160.00 · Ahorro $720.00 (33%) · Precio del
> paquete $1,440.00

Y, si la factura tiene alguna línea de paquete, al pie: **«Usted ahorró $720.00»** (la suma de
`savings` de esas líneas). Va en la vista de la factura, en el PDF/impresión
(`app/print/invoice/[id]`) y en el recibo térmico (`recibo-termico.tsx` / `build-recibo.ts`).

## 4. i18n

Hacen falta los textos de `nav.paquetesVenta`, de los `salesPackage.*` de arriba, y de «Agregar
paquete», «Precio regular», «Ahorro», «Precio del paquete» y «Usted ahorró».

## Pruebas que pide

- La lista pinta `regularPrice`, `packagePrice` y `savings` tal como vienen (no se recalculan).
- Vender un paquete agrega la línea y la factura muestra subtotal, descuento y total del BE.
- Una línea con `salesPackageId` no deja editar cantidad, precio ni descuento; quitarla sí.
- La impresión y el recibo muestran regular, ahorro y paquete en la línea, y «Usted ahorró» al pie.
- Una factura sin paquetes no cambia en nada.
