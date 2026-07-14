# Handoff FE — POS de Facturación GENERAL

> **De:** BE (cmr-be). **Para:** cmr-fe. **Fecha:** 2026-07-14. **BE en prod y funcional.**

## ⛔ LO PRIMERO — NO MEZCLAR: son DOS facturaciones SEPARADAS
Hay **DOS flujos distintos, con DOS puntos de entrada distintos**. Comparten el **motor** (el mismo componente
editor de factura por debajo), pero el usuario **NUNCA** los ve mezclados. No hay selector combinado, no hay una
pantalla que haga "ambos según un flag".

| | **Facturación de CONSULTAS** | **Facturación GENERAL** |
|---|---|---|
| Qué factura | la consulta médica (Consulta / Seguimiento) | productos + láser + suero (todo junto) |
| Punto de entrada | AP-board → "Facturar Consulta" (`POST /facturas/cita/:citaId`) | pantalla **"Nueva venta"** → buscar paciente → `POST /facturas` |
| Catálogo (el select) | `GET /facturas/catalogo?contexto=consulta` → **SOLO** Consulta/Seguimiento | `GET /facturas/catalogo` (sin contexto) → **SOLO** productos/láser/suero |
| Se mezclan | **NO** | **NO** |

- El catálogo de **General NUNCA** muestra Consulta/Seguimiento; el de **Consultas NUNCA** muestra productos.
- (Clasificaciones producto/láser/suero = **internas**, no pestañas: dentro de General todo va en **un solo select**.)
- Comisiones = **FUERA**.
- ⚠️ **NO romper el shortcut existente de Atención** ("Facturar Consulta" en el AP-board → crea/abre la factura de
  consulta). Ese flujo YA funciona y se queda **tal cual**. General se agrega como entrada NUEVA, sin tocarlo.

> Reglas: `response.data`+`meta.pagination`; `Bearer`+`X-Tenant-ID`; whitelist estricto (param no doc = 400); i18n
> `labelKey`; `can()` por permiso; estados loading/vacío/error; **NO duplicar** (compartir el motor/componente y `lib/api/*`).

## Estado real
El editor de factura (motor) ya existe y sirve como base. **Falta la Facturación GENERAL como flujo propio**: su
punto de entrada ("Nueva venta") y su catálogo general — SIN tocar el flujo de Consultas, que ya funciona aparte.

**El DELTA real (esto es lo que falta, todo FE sobre endpoints que YA existen — NO hay hueco de BE):**
1. **Punto de creación (el hueco grande):** hoy NO se puede crear una factura general. Consulta se crea desde el
   AP-board (`facturarCita`); General necesita **nueva pantalla "Venta / factura general"**: buscar paciente →
   `POST /facturas` → abrir el editor. Faltan las funciones de cliente `crearFactura`/`buscarPaciente`.
2. **Descuentos 3 niveles + IVU por ítem:** el editor solo tiene descuento GLOBAL. Falta cablear descuento por
   grupo, exento de cabecera, y el **toggle IVU/exento por línea** (`gravado`) en la grilla.
3. **Funciones de cliente faltantes** (todas contra endpoints existentes):

| Función FE | Endpoint BE (verificado, existe) |
|---|---|
| crearFactura | `POST /facturas` |
| buscarPaciente | `GET /facturas/buscar-paciente` |
| setDescuentosGrupo | `PUT /facturas/:id/descuentos-grupo` |
| setExento (cabecera) | `PUT /facturas/:id/exento` |
| IVU/exento por línea | `gravado` en `POST/PUT /facturas/:id/items(/:itemId)` |
| pagosMultiple | `POST /facturas/:id/pagos/multiple` |
| devolver / devoluciones | `POST /facturas/:id/devolver` · `GET /facturas/:id/devoluciones` |

- Catálogo (el select, ya en uso): `GET /facturas/catalogo` (sin `contexto` = general; consulta excluida).
- Flujo base ya operativo: crear→líneas(+kit)→emitir(descarga inventario)→pagos→anular. Consulta NO se toca.

## Plan aprobado (del FE, aditivo, sin duplicar, consulta intacta)
(a) Nueva "Venta / factura general" desde `/facturacion` (buscar paciente → `POST /facturas` → editor existente).
(b) Extender la grilla del editor: toggle IVU/exento por ítem + descuento por grupo + exento de cabecera (3 niveles).
(c) Agregar las funciones de cliente faltantes (tabla de arriba). Todo directo sobre `/facturas`.

## Contrato (endpoints reales, base `/api/v1/facturas`)
- Buscar paciente: `GET /facturas/buscar-paciente?...`
- Crear borrador: `POST /facturas` `{ pacienteId, medicoId?, ... }`
- Catálogo (el select): `GET /facturas/catalogo?q=` (sin `contexto` = general).
- Líneas: `POST /facturas/:id/items` `{ productoId, cantidad, ... }` · `PUT /facturas/:id/items/:itemId` ·
  `DELETE .../items/:itemId` · `PUT .../items/:itemId/kit` (editar receta del kit en la línea).
- **Columnas de captura por producto** (CORREGIDO — la v1 citó mal `/facturas/columnas`): el endpoint real es
  **`GET /facturacion/columnas?productoId=`** (→ `esquemaPorProducto`; existe HOY, no es a futuro). Devuelve el
  esquema de columnas de línea; si el producto tiene multiplicadores (áreas/días/sesiones/dosis) el server los
  declara y el FE los pinta + los manda en el item. Hoy la mayoría no tiene → cantidad×precio (se agregan como dato
  cuando entren láser/suero). También `GET /facturacion/columnas?grupo=` y `GET /facturacion/divisiones`.
- Descuentos: `PUT /facturas/:id/descuento-global` · `.../descuentos-grupo` · `.../exento` (3 niveles).
- **Emitir** (aquí descarga inventario): `POST /facturas/:id/emitir`.
- Pagos: `POST /facturas/:id/pagos` (+ `/multiple`) · `GET .../pagos/resumen`. Anular/devolver: `.../anular`,
  `.../devolver`, `.../devoluciones`.

## Pantalla (buscar layout POS moderno; refs abajo)
Patrón shadcn/POS de una sola vista, sin pestañas por tipo:
1. **Cabecera**: buscar/seleccionar paciente + médico (opcional).
2. **Select único de catálogo** (`/facturas/catalogo`, buscador `q`): al elegir un producto → agrega línea. Un solo
   selector para TODO (clasificación interna no se muestra como filtro obligatorio; a lo sumo un filtro opcional).
3. **Grilla de líneas** (cart): columnas alineadas Concepto · Cant · (multiplicadores si aplican, data-driven desde
   `/facturas/columnas`) · Precio · Desc · IVU/Exento (toggle por ítem) · Total. Una fila por cargo, decimales alineados.
4. **Totales sticky** (Subtotal · Descuento · Impuesto · Total) + descuento global/exento de cabecera.
5. **Panel de pago single-pane** (efectivo/tarjeta/mixto; cambio; últimos-4) → emitir → cobrar.
6. Acciones: anular, devolver (total/parcial). Imprimir/recibo (contrato de impresión ya existe).

## ⚠️ Toggle IVU: nace del `gravado` del PRODUCTO (no siempre ON)
Bug observado: el toggle IVU sale en ON por defecto y se manda `gravado:true` → aplica IVU a productos que
NO lo llevan (ej. los ULTRA, que son `gravado:false`). **Fix FE:** al seleccionar/agregar un producto, el toggle
IVU debe inicializarse con el **`producto.gravado`** que devuelve `GET /facturas/catalogo` (true→ON, false/null→OFF).
El cajero puede cambiarlo puntualmente, pero el default = el `gravado` del producto. Solo los físicos
(`prod_serv='p'` del legacy, 43 productos) traen `gravado:true`; ULTRA/servicios/kits = false.

## IVU / exento
Por **ítem** (toggle `gravado`) + global (`factura.exento`), con herencia del server. El FE solo expone los toggles;
el server calcula. (Los productos hoy no traen `gravado` fijo → el cajero decide por ítem.)

## Componentes de kit — snapshot congelado (para el FE)
`GET /facturas/:id` incluye **`componentes: []`** (solo en facturas **emitidas**). Es el detalle congelado de qué
llevó cada línea de kit — para reimprimir/mostrar y como origen de la entrega en frontdesk. **Agrupar por `facturaItemId`.**
Campos por componente:
- `facturaItemId`, `facturaId`, `productoId`, `cantidad` (total congelado).
- `origen`: `receta` (no editado) | `editado` (personalizado en esa factura) → así el FE muestra si se editó.
- `esInventariable` (bool), `modoDescarga` (`a_la_venta`|`a_la_entrega`|`no_descarga`).
- `dosis`, `sesiones` (hoy null; se poblarán con láser/suero).

Notas: se congela **al emitir** (en borrador aún no hay `componentes`). Editar el kit en la factura sigue por
`PUT /facturas/:id/items/:itemId/kit`. El FE **no** calcula nada: solo lee/pinta `componentes`.

## Precio en el catálogo + selector de lista (SIMPLE — ya resuelto en BE)
- **`GET /facturas/catalogo`** ahora devuelve por producto: **`precio`** (ya resuelto por el centro activo; default
  **regular**) + **`presentacionId`**. El FE **solo lo muestra** — no resuelve precio aparte. (Enviar `X-Tenant-ID`
  del centro: los precios son por centro.)
- **Selector de lista de precios:** **`GET /precios/tipos`** → lista de tipos (regular/mayorista/seguro…). El FE
  arma el `<select>` con **regular por defecto**; al cambiarlo, refetch del catálogo con **`?tipoPrecioId=<id>`**.
- Al Agregar la línea: manda `precioUnitario` SOLO si el cajero lo sobrescribe; si no, el server usa el efectivo.

## Precio de la línea + lista de precios
- El precio se resuelve **server-side al Agregar** (`precioEfectivo` por el centro de la FACTURA; default **regular**:
  oferta→regular→base). No hace falta que el FE lo calcule; llega en la línea agregada.
- **Falta (FE):** un **selector de lista de precios** en el POS, con **regular por defecto**. Solo si el negocio
  quiere facturar con OTRA lista (mayorista/seguro) el FE la elige y pasa `tipoPrecioId`; sin eso, regular.
- (Opcional) para mostrar el precio en el PREVIEW antes de Agregar, el FE puede pedir `GET /precios/efectivo?
  presentacionId=` con `X-Tenant-ID` del centro; requiere el presentacionId por defecto del producto.

## Fuera de alcance
- Pestañas/filtros por tipo de producto. Comisiones. Cargar productos faltantes (lo hace el BE "al final").
- La pantalla de Consultas es aparte (ya tiene su contrato: `?contexto=consulta` + `POST /facturas/cita/:citaId`).

## Refs de UI moderna
- [shadcn/ui POS templates 2026](https://adminlte.io/blog/shadcn-ui-pos-templates/) · [POS payment UX (Bright)](https://brightinventions.pl/blog/payment-point-of-sale-design-ui-ux/) · [POS UX tactics (dev.pro)](https://dev.pro/insights/designing-a-pos-system-ten-user-experience-tactics-that-improve-usability/) · [Shopify POS UI](https://www.shopify.com/blog/pos-ui)

## Nota
El editor `/facturacion/[id]` ya existe (se usa para consulta). Evalúa **reusarlo** para General (mismo motor,
distinto catálogo) en vez de duplicar; el "un solo select" es el cambio principal. Si algo falta, mini-handoff al BE.
