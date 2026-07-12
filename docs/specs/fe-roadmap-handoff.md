# Handoff FE — Roadmap: qué construir para avanzar (hacia la doble descarga)

> **De:** BE (cmr-be). **Para:** cmr-fe. **Fecha:** 2026-07-12.
> **Meta:** habilitar la validación de **DOBLE DESCARGA** — vender/entregar un tratamiento y que descargue
> **(1) inventario** (por la receta) **y (2) sesiones + dosis** que el paciente adquirió.
> **Todo el BE de abajo YA existe y está en producción** (`https://api.centrodemedicinaregenerativa.com`).
> Lo que falta son las **pantallas FE**. Reglas: leer `response.data` + `meta.pagination`; `Authorization:
> Bearer` + `X-Tenant-ID`; whitelist estricto (400 si mandas un query param no documentado); i18n `labelKey`;
> estados loading/vacío/error; **buscar en internet el layout UI más moderno** antes de construir cada pantalla.

## Prioridad (orden recomendado)
1. Catálogo (base) → 2. Precios → 3. Facturación → 4. Frontdesk/Sesiones → 5. **Validación doble descarga.**

---

## 1. Catálogo — LISTO en BE (ver detalle aparte)
Detalle completo en **`docs/specs/fe-inventario-precios-handoff.md`** (endpoints, JSON real, estados):
- **Productos** `/inventario/productos?soloFisicos=&conProveedores=&q=` (columna Proveedor con tooltip).
- **Presentación de proveedor (AMP)** `/inventario/presentaciones-proveedor` (editor con selector de proveedor+unidad).
- **Recetas de compuestos** `/inventario/componentes?productoCompuestoId=` (editor tipo bill-of-materials).
- **Recibir compra** `POST /inventario/operaciones/recibir-compra`.
- **Unidades / Proveedores** para selectores.

## 2. Precios — LISTO en BE (ver `fe-inventario-precios-handoff.md` §3 + §5-bis)
- **Catálogo por tipo** `GET /precios/catalogo?tipoPrecioId=&clinicId=&q=` (regular/mayorista/seguro; `null`=hueco).
- **Derivar lista** `POST /precios/derivar` con `dryRun:true` (PREVIEW) → tabla antes/después; luego `dryRun:false`.
  Ajuste %/$, redondeo (.99/entero/múltiplo), ámbito global/centro/individual. Pantalla: "Derivar precios" con
  preview antes de aplicar.

## 3. Facturación — BE LISTO, faltan pantallas (base de la descarga #1)
Base URL `/api/v1/facturas`. Endpoints clave:
- `POST /facturas` (nueva) · `GET /facturas` (lista) · `GET /facturas/:id` · `GET /facturas/tablero` ·
  `GET /facturas/catalogo` (productos facturables) · `GET /facturas/buscar-paciente?...`.
- Items: `POST /facturas/:id/items` · `PUT/DELETE /facturas/:id/items/:itemId` ·
  `PUT /facturas/:id/items/:itemId/kit` (editar la receta del kit en la línea).
- Descuentos/exento: `PUT /facturas/:id/descuento-global` · `.../descuentos-grupo` · `.../exento`.
- **`POST /facturas/:id/emitir`** ← aquí ocurre la **descarga de inventario** (recorre la receta/regla).
- `POST /facturas/:id/anular` · `POST /facturas/:id/devolver` · `GET /facturas/:id/devoluciones`.
- Pagos: `POST /facturas/:id/pagos` (+ `/multiple`) · `GET /facturas/:id/pagos` · `.../resumen`.
- Config: `/facturacion/formas-pago`, `/facturacion/medios`, `/facturacion/columnas` (grupos/columnas de captura),
  `/facturacion/reportes/{resumen,por-medico,por-producto,impuestos}`, `POST /facturas/cita/:citaId` (facturar consulta).

**Pantallas FE:** POS/factura (buscar paciente → agregar ítems del catálogo → precio efectivo → descuentos →
**emitir** → pagos), lista/tablero de facturas, devoluciones. UI: buscar el layout POS moderno (línea de ítems
editable inline, totales sticky, panel de pago).

## 4. Frontdesk / Sesiones — BE LISTO, faltan pantallas (base de la descarga #2)
Base URL `/api/v1/frontdesk` y `/api/v1/servicios`. Endpoints clave:
- **Servicios** (config): `GET/POST/PUT/DELETE /servicios`, `/servicios/:id/columnas`.
- **Sesiones:** `GET /frontdesk/sesiones` · `POST /frontdesk/sesiones` · `GET /frontdesk/sesiones/:id` ·
  `GET /frontdesk/sesiones/:id/historial` · **`POST /frontdesk/sesiones/:id/presente|en-terapia|asistido`**
  (transiciones; en "asistido/entrega" ocurre la **descarga por sesión/dosis**) · `.../acciones` · `.../cancelar` · `.../reparar`.
- **Tablero:** `GET /frontdesk/tablero`. **Estado enfermería:** `GET/POST /frontdesk/nurse-status`.
- Reportes: `/frontdesk/reportes/{resumen,por-servicio,por-tecnico,tiempos}`.

**Pantallas FE:** tablero de sesiones (columnas por estado, arrastrar/transicionar), ficha de sesión con
historial, marcar presente/en-terapia/asistido. UI: buscar el layout moderno de "board" clínico (kanban por
estado, contadores, tiempos).

## 5. Validación de DOBLE DESCARGA (la meta)
Con 1–4 construidos, el escenario de prueba end-to-end:
1. Paciente adquiere un tratamiento (derivado/kit o paquete de sesiones) → **factura** (`emitir`).
   → **Descarga #1:** inventario descarga la receta (sustancia base, materiales) — motor versionado
   (`reglas_descarga` receta, ya en prod).
2. La entrega por **sesiones** (frontdesk) → cada sesión "asistida" descarga su dosis.
   → **Descarga #2:** sesiones + **dosis total** acumulada del paciente.
3. Verificar: stock derivado del insumo baja correctamente (kardex) + total de dosis/sesiones del paciente cuadra.

**Para que esto sea un ROLEX**, el catálogo debe estar completo (ya lo está: 39 físicos + 27 kits + recetas
versionadas + precios + AMP/proveedor, todo en prod).

## Nota de dependencias BE (si algo falta al construir)
Si al construir una pantalla el endpoint no devuelve lo que necesitas (campo, filtro), **no improvises**: pide
el ajuste al BE con un mini-handoff (como `precios-listas-multicentro-handoff-be.md`): requerimiento, evidencia,
gap, contrato propuesto, preguntas sí/no.
