# Hand-off FE — Flujo de carga de productos en inventario 2026-07-11 (copy-paste)

> BE desplegado (cmr-be PRs #52 #54) + datos cargados en local (PR #53). Este doc reemplaza el enfoque de
> la pantalla AMP como puerta de entrada — **ESO estaba mal**. El flujo es **simple → complejo, en 3 pantallas**;
> AMP es AVANZADO/opcional. Empezar por `gen:api`. Reglas: i18n, tokens-only, sin hardcode, `can()`, y buscar en
> internet el layout data-table/form más moderno.
> Spec/plan BE: cmr-be `docs/specs|plans/carga-productos-inventario.md`.

## El error anterior (para no repetir)
La pantalla "Presentaciones de proveedor (AMP)" se hizo como **entrada** para cargar productos, y su selector
listaba **Consulta / Consulta de seguimiento** (que son SERVICIOS de facturación, no productos físicos). AMP es
la capa **avanzada** (cambio de proveedor/presentación de un producto que YA existe), NO el punto de entrada.

## El flujo correcto (3 pantallas, simple → complejo)
```
Paso 1  Proveedores           (identificar; no bloqueante)
Paso 2  Producto + presentación (crear UNA vez)
Paso 3  Compra / recompra      (stock: seleccionar producto + lote/factura/costo)
── avanzado ──
        Presentación de proveedor (AMP)  (solo si cambia proveedor/presentación)
```

## Paso 0 — `gen:api`
```bash
npm run gen:api
```

## Pantalla 1 — Proveedores  (`/inventario/proveedores`) 🔴 no existe (da 404)
CRUD contra el BE (ya vive, RBAC admin/super_admin):
- `GET /api/v1/inventario/proveedores` · `POST` · `PUT /:id` · `DELETE /:id`.
- Campos: nombre, rnc, telefono, email, direccion, activo. Data-table + form. (Hay 2 sembrados por centro.)

## Pantalla 2 — Producto + presentación  (`/inventario/productos`)
Crear/editar el producto (definición GLOBAL) + su presentación. Endpoints ya existen:
- `GET /api/v1/inventario/productos?page&limit&soloFisicos=true` — **usar `soloFisicos=true`** en cualquier
  picker de productos físicos (excluye servicios/consultas). `GET /:id` · `POST` · `PUT /:id` · `DELETE /:id`.
- Campos del producto (nuevos incluidos): `nombre`, **`nombreCorto`** (abreviado), `descripcion`, `tipo`
  (base|unico|compuesto|servicio), `contenido` + `unidadContenidoId` (cantidad + unidad: cápsula/ml/mg/mcg/…),
  **`tamano`** (texto: "300 cápsulas"), **`peso`** + **`pesoUnidadId`**, `categoriaId`/`marcaId`, `barcode`,
  `esInventariable`, `modoDescarga`.
- Unidades para los dropdowns: `GET /api/v1/inventario/unidades` (ya trae cápsula/gragea/pastilla/tableta/ml/
  mg/mcg/g/oz/dosis/vial/…). Clasificaciones: `GET /api/v1/inventario/clasificaciones`.
- Presentación de venta: `POST/PUT /api/v1/inventario/presentaciones` (nombre, unidadVenta, factorConversion,
  precioBase, gravado, barcode, esDefault).
- Ficha por centro (stock min/máx): `productos_centro` — `stockMinimo`, **`stockMaximo`** (nuevo).

## Pantalla 3 — Compra / recepción de stock  (`/inventario/compras` o "Recibir")
El corazón del stock. **Recompra = seleccionar producto existente, NO recrear.**
- `POST /api/v1/inventario/operaciones/recibir-compra` — body:
  ```jsonc
  { "productoId","almacenId","cantidad",           // requeridos (almacén: GET /inventario/almacenes)
    "costoUnitario","numeroLote","numeroFacturaCompra",  // nº factura de compra (NUEVO)
    "fechaVencimiento","proveedorId","ubicacionId","fechaEfectiva","notas",
    "presentacionProveedorId" }                     // opcional (AMP, avanzado)
  ```
  Crea el lote + la entrada; el **stock se DERIVA** (no se edita a mano). `GET /inventario/almacenes` para el
  selector de almacén (hay 1 "Almacén Principal" por centro).
- Recompra: mismo `productoId`, nuevo lote (nº factura, costo, vencimiento). El sistema no re-crea el producto.

## Avanzado — Presentación de proveedor (AMP)
Mantener la pantalla que ya se hizo, pero: (1) **no** como entrada de carga; (2) el picker de producto usa
`GET /inventario/productos?soloFisicos=true` para **no** mostrar consultas/servicios.

## Datos ya cargados (local) para probar
39 productos de venta directa (nombre real + abreviado), precio por centro, ficha stock min/máx, y **stock de
apertura** (p.ej. HYDROCOTILE ASIATICA 120 CAP → 168 uds en Caguas). Proveedores 2/centro. Unidades 16.

## Checklist FE
- [ ] `gen:api`
- [ ] Pantalla Proveedores (CRUD) — resuelve el 404 actual
- [ ] Pantalla Producto + presentación (con nombreCorto/tamano/peso/unidad/stockMin-Max)
- [ ] Pantalla Compra/recompra (recibir-compra + selección de producto + almacén + nº factura)
- [ ] AMP: dejar como avanzado + picker `soloFisicos=true`
- [ ] `tsc --noEmit` / build verde
