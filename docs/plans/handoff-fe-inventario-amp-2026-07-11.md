# Hand-off FE — Inventario: capa AMP (presentación de proveedor) 2026-07-11 (copy-paste)

> Todo el BE ya está **desplegado en prod** (cmr-be PRs #46 #47 #48). Este doc es lo que le toca al FE.
> Empezar por `gen:api`. Regla: i18n (labels por clave), tokens-only, sin hardcode, buscar en internet el
> layout UI más moderno (data-table + formularios) para lo nuevo.
> Contexto de negocio: BE spec/plan en cmr-be `docs/specs|plans/inventario-base-derivados.md`.

## Qué resuelve (para el usuario)
Cuando **cambia el proveedor** — o el mismo proveedor manda **otra presentación/concentración** — ya NO se
edita ni duplica el producto. Se agrega una **presentación de proveedor (AMP)** y sus lotes; el
producto/derivado/precio/receta quedan intactos. Modelo dm+d: se **receta/vende el derivado** (dosis en mg),
se **compra/stockea el AMP** (el vial del proveedor de turno).

## Paso 0 — Regenerar tipos (obligatorio)
```bash
npm run gen:api    # o CMR_OPENAPI_URL=https://api.centrodemedicinaregenerativa.com/api/docs-json npm run gen:api
```
Trae: el schema del AMP y los endpoints nuevos + el campo `presentacionProveedorId` en `RecibirCompraDto`.

## 1. CRUD de presentaciones de proveedor (AMP) por producto — pantalla admin NUEVA
Endpoints (RBAC: roles `admin`/`super_admin`):
- `GET /api/v1/inventario/presentaciones-proveedor?productoId={uuid}&activo=true` → lista los AMP del producto.
- `GET /api/v1/inventario/presentaciones-proveedor/{id}`
- `POST /api/v1/inventario/presentaciones-proveedor` — body:
  ```jsonc
  {
    "productoId": "uuid",              // requerido (el producto BASE)
    "nombre": "Vial 10 mg — marca X",  // requerido
    "fabricanteId": "uuid?",           // clasificaciones tipo=fabricante
    "marcaId": "uuid?",                // clasificaciones tipo=marca
    "concentracion": 10,               // p.ej. 10 en "10 mg/ml"
    "unidadConcentracionId": "uuid?",  // unidades
    "contenidoPorEmpaque": 60,         // p.ej. 60 mg por vial
    "unidadContenidoId": "uuid?",      // unidades
    "factorABase": 60,                 // empaque→unidad base (metadato/trazabilidad)
    "sku": "string?", "barcode": "string?",
    "vigenciaDesde": "2026-07-01?", "vigenciaHasta": "2026-12-31?"
  }
  ```
- `PUT /api/v1/inventario/presentaciones-proveedor/{id}` — patch parcial (mismos campos + `activo`).
- `DELETE /api/v1/inventario/presentaciones-proveedor/{id}` — **baja lógica** (`activo=false`), 204.

**UI sugerida:** en la ficha del producto (o admin de inventario), una sección "Presentaciones de proveedor"
con una **data-table** (columnas: nombre, marca/fabricante, concentración, contenido, SKU, vigencia, activo)
+ un formulario de alta/edición (modal o panel). Selects para fabricante/marca (de `clasificaciones`) y unidades
(de `/inventario/unidades`). i18n en labels. `can()` para mostrar acciones.

## 2. Compra: elegir el AMP en `recibir_compra` (opcional pero recomendado)
`RecibirCompraDto` ahora acepta **`presentacionProveedorId?`** (uuid). Al recibir una compra, si el usuario
elige un AMP, el **lote nace ligado a esa presentación** (snapshot de qué contenía la compra). En el
formulario de recepción de compra, agregar un selector "Presentación de proveedor" (filtrado por el producto)
— opcional; si no se elige, la compra funciona igual que hoy.

## 3. Notas de modelo (no confundir)
- La **cantidad de la compra NO se convierte** por `factorABase`: el stock se lleva en unidad de inventario.
  `factorABase` es metadato/trazabilidad del AMP. La conversión de descarga (dosis→inventario) vive en las
  **reglas de descarga**, no aquí. No construir lógica de conversión en el FE.
- El **proveedor concreto y el costo** siguen en el LOTE (no en el AMP): el AMP es "qué presentación",
  el lote es "a quién se la compraste, a cuánto, qué vencimiento".

## Checklist FE
- [ ] `npm run gen:api`
- [ ] Pantalla admin: CRUD de presentaciones de proveedor por producto (data-table + form; i18n; `can()`)
- [ ] Selector de AMP (opcional) en el formulario de recibir compra (`presentacionProveedorId`)
- [ ] `tsc --noEmit` / `npm run build` verde

## Endpoints BE (referencia — todos desplegados)
- `GET/POST /api/v1/inventario/presentaciones-proveedor` · `GET/PUT/DELETE /…/{id}` (RBAC admin/super_admin)
- `POST /api/v1/inventario/operaciones/recibir-compra` — body += `presentacionProveedorId?`
- MCP (agentes): `list_/crear_/actualizar_presentacion_proveedor`, `recibir_compra` (+ campo).
