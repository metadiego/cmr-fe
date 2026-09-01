# Handoff FE — Plan UI: crear/editar productos (todos los tipos) + kits + recepción de inventario

> **De:** BE (cmr-be). **Para:** cmr-fe. **Fecha:** 2026-07-13. **Tipo:** plan de UI/IA.
> **BE:** 100% listo y en prod (ambos centros). Todos los endpoints citados existen.
> **Regla de oro (larciles):** un **único flujo lógico** para crear cualquier producto — el **tipo** decide qué
> campos aparecen; el usuario nunca ve campos que no aplican. Cero pantallas separadas por tipo.
>
> ## ⚠️ ESTADO REAL (verificado 2026-07-13) — esto es RECONCILIACIÓN, no construir de cero
> La mayoría YA está construida en el FE. **No rehacer:**
> - `components/inventario/productos-admin.tsx` (689L): lista + form crear/editar, los 4 tipos **y los 2 ejes**
>   (`esInventariable` + `modoDescarga`) + AMP expandible. **Ya cumple §3.**
> - `recibir-compra.tsx` (269L): ya integra almacén + proveedor + AMP. **Ya cumple §6.**
> - `recetas-admin.tsx` (353L): editor de receta standalone (elige compuesto). **Ya cumple §4** (falta enlazarlo, ver abajo).
> - `amp-editor-sheet.tsx` + `presentaciones-proveedor-admin.tsx` + `proveedores-admin.tsx`: construidos. **Ya cumplen §1/§6.**
>
> **Delta real (lo único que falta — integración, no pantallas nuevas):**
> 1. **(a)** En `productos-admin`, cuando `tipo=compuesto`: botón **"Editar receta"** → deep-link a la receta de ese compuesto.
> 2. **(b)** `recetas-admin`: aceptar `?compuestoId=` para **preseleccionar** el compuesto (un solo editor, alcanzable
>    desde el producto y standalone). NO crear un editor de receta dentro del form.
> 3. **(c)** Crear el **índice/subnav de `inventario`** (hoy NO existe `inventario/page.tsx`): Productos · Recepción ·
>    Recetas · Proveedores · Precios(link) · Movimientos — para amarrar todo sin rutas paralelas ni duplicados.
>
> Las secciones §1–§8 de abajo describen el modelo completo (útil como referencia/checklist), pero **arranca por el
> delta (a)→(b)→(c)**; casi todo lo demás ya existe.

## 0. Referencias de UI moderna a emular (buscar y mirar antes de construir)
- **Producto = formulario seccionado de una sola página** con columna derecha de "organización/estado" — patrón
  **Shopify Admin › Products** (secciones: identidad, medios, precio, inventario, organización). No wizard multi-paso
  para el alta normal; wizard opcional solo la 1ª vez.
- **Receta/kit = editor Bill-of-Materials** tipo **Katana / Odoo BoM / Cin7 Manufacturing**: tabla de componentes
  con búsqueda inline, cantidad/dosis por fila, unidad, y total.
- **Recepción = "Receive stock" por líneas** tipo **inFlow / Cin7 / Sortly**: proveedor → líneas (producto +
  presentación + cantidad + costo + vencimiento) → confirmar. Escaneable, edición inline, panel de totales sticky.
- Tendencia 2025-26: **campos adaptativos por tipo/rol**, componentes atómicos reutilizables, datos en tiempo real.
- Transversal: leer `response.data`+`meta.pagination`; `Bearer`+`X-Tenant-ID`; **whitelist estricto** (param no
  documentado = 400); i18n `labelKey`; estados loading/vacío/error; `can()` cosmético por permiso.

## 1. Menú lógico (IA)
```
Inventario
├── Productos              (hub: lista + buscador + "Nuevo producto")
│     └── Producto :id     (crear/editar — formulario adaptativo por tipo)
│           └── (si compuesto) pestaña "Receta"   → editor BoM
│           └── (si servicio) enlace "Pestaña de frontdesk"
├── Recepción de inventario  ("Recibir compra" — entrada de stock por líneas)
├── Precios                 (catálogo por tipo + Derivar)   ← ya especificado aparte
├── Proveedores             (catálogo simple, global)
├── Almacenes / Unidades    (config; selectores)
└── Movimientos / Kardex    (solo lectura; para validar descargas)
```
El menú y sus permisos son data-driven (menú dinámico + RBAC ya existentes): usa `can('inventario.*')` para
mostrar/ocultar. No hardcodear rutas visibles sin permiso.

## 2. Hub de Productos — `GET /inventario/productos?q=&soloFisicos=&conProveedores=&incluirInactivos=`
- Tabla: SKU · Nombre · **Tipo** (chip: base/único/compuesto/servicio) · **Inventariable** (sí/no) ·
  **Modo descarga** (chip) · Proveedor(es) (si `conProveedores`) · Precio efectivo · Activo.
- Buscador (`q`), filtros por tipo/inventariable, toggle inactivos. Botón **"Nuevo producto"**.
- Fila → abre el editor. Estados vacío/loading/error.

## 3. Crear/editar producto — **formulario ADAPTATIVO por tipo** (la pieza central)
Un solo formulario. Arriba, un **selector de Tipo** (base · único · compuesto · servicio) que **muestra/oculta
secciones**. Layout Shopify: cuerpo (secciones) + columna derecha (estado/organización).

**Secciones y cuándo aparecen** (campo → BE, todos en `productos` salvo nota):

| Sección | Campos | base | único | compuesto | servicio |
|---|---|:-:|:-:|:-:|:-:|
| **Identidad** | `sku`, `nombre`, `nombreCorto`, `descripcion` | ✓ | ✓ | ✓ | ✓ |
| **Clasificación** | `categoriaId` (`GET /inventario/clasificaciones`) | ✓ | ✓ | ✓ | ✓ |
| **EJE 1 · Inventario** | **`esInventariable`** (toggle) · **`modoDescarga`** (a_la_venta / a_la_entrega / no_descarga) | ✓ | ✓ | ✓ | ✓* |
| **Medida base** | `unidadInventarioId`, `contenido`, `unidadContenidoId` (`GET /inventario/unidades`) | ✓ | ✓ | — | — |
| **Presentación/venta** | tamaño, peso (`tamano`,`peso`,`pesoUnidadId`) | — | ✓ | ✓ | — |
| **Precio** | precio por tipo (`GET/POST /precios…`, o link a Precios) | — | ✓ | ✓ | ✓ |
| **Receta** (pestaña) | componentes (ver §4) | — | — | ✓ | — |
| **Frontdesk** | enlace/crear servicio (Eje 2, ver §5) | — | — | — | ✓ |

\* servicio: por defecto `esInventariable=false` + `modoDescarga=no_descarga` (mostrar los toggles igual, para que
el usuario VEA que no descarga — es lo que elimina el "a veces sí, a veces no").

**Regla UX clave — los 2 EJES siempre visibles y explícitos** (ver `fe-roadmap-handoff.md` §0):
- Eje 1 (inventario): `esInventariable` + `modoDescarga`, en el producto.
- Eje 2 (sesiones): se configura en el **servicio de frontdesk** (§5), no aquí; pero si el tipo=servicio, mostrar
  un aviso/enlace: "Este servicio se entrega por sesiones → configúralo en Frontdesk".

**Defaults inteligentes al elegir tipo** (editables): base→(inventariable, no_descarga, pide unidad base);
único→(inventariable, a_la_venta); compuesto→(inventariable, a_la_entrega, abre Receta); servicio→(no
inventariable, no_descarga).

**Endpoints:** `POST /inventario/productos` (alta) · `PUT /inventario/productos/:id` · `GET /inventario/productos/:id`.

## 4. Editor de RECETA / kit (compuesto) — Bill-of-Materials
Pestaña dentro del producto compuesto. Tabla de componentes (patrón BoM):
- Columnas: **Componente** (buscar producto: derivado/único/servicio) · **Cantidad/Dosis** (en la unidad base del
  componente) · Unidad · (opcional) nota. Fila de "agregar componente" con buscador inline.
- Total/resumen de la receta. Reordenar. Eliminar.
- **Endpoints:** `GET /inventario/componentes?productoCompuestoId=:id` · `POST /inventario/componentes` ·
  `PUT /inventario/componentes/:id` · `DELETE /inventario/componentes/:id`.
- **Importante:** editar la receta **re-publica automáticamente** la regla de descarga versionada en el BE — el FE
  no hace nada extra. Solo CRUD de componentes.
- Kits/bundles = mismo editor (un compuesto cuyos componentes son varios productos/servicios).

## 5. Servicio de frontdesk (Eje 2) — desde un producto tipo servicio
- Si el producto es `servicio`, ofrecer "Crear pestaña de frontdesk": `POST /servicios` con `clave`, `nombre`,
  color/icono/orden, **`productoId`** = (null si NO inventariable como Shock Wave; o el producto si descarga por sesión).
- **La pestaña nace usable**: el BE ya le pone las columnas por defecto (no hay que componerlas). Ajustes finos:
  `POST /servicios/:id/columnas`. Sesiones y transiciones: ver `fe-roadmap-handoff.md` §4.

## 6. Recepción de inventario ("Recibir compra") — entrada de stock por líneas
Pantalla propia (patrón "receive stock"):
1. **Cabecera:** Proveedor (`GET /inventario/proveedores`), Almacén (`GET /inventario/almacenes`),
   nº factura de compra, fecha.
2. **Líneas:** por cada ítem → buscar **producto** → elegir/crear **Presentación de proveedor (AMP)**
   (`GET/POST /inventario/presentaciones-proveedor`: marca, concentración, contenido, sku proveedor — **descriptivo**,
   no convierte) → **cantidad** · **costo** · **vencimiento** · nº lote.
3. **Confirmar:** `POST /inventario/operaciones/recibir-compra` (crea el/los lotes; **exige `almacenId`**). El stock
   se **deriva** del libro de movimientos (no hay campo "existencia").
- UI: línea editable inline, panel de totales sticky, botón "Recibir". Estados de error por línea (sin precio, sin AMP…).

## 7. Validación (por qué este flujo importa)
Con esto el usuario configura explícitamente los **2 ejes** por producto/servicio → se acaba el "a veces descarga,
a veces no". Y habilita simular la **doble descarga** (factura→stock; sesión→dosis) sobre datos reales.

## 8. Fuera de alcance (de este plan)
- Reportes/kardex avanzado (solo un visor de movimientos para validar).
- Órdenes de compra formales (`/inventario/ordenes-compra` existe; recepción directa cubre el caso de hoy).
- Elegir marca (AMP) al facturar (decisión de negocio abierta — ver `fe-roadmap-handoff.md` §6).

## Fuentes de patrones UI
- [UX/UI best practices 2025 (devPulse)](https://devpulse.com/insights/ux-ui-design-best-practices-2025-enterprise-applications/)
- [PIM trends 2026 (Stibo)](https://www.stibosystems.com/blog/what-does-the-future-hold-for-product-information-management-five-key-points-to-consider)
- [Better form design (LogRocket)](https://blog.logrocket.com/ux-design/better-form-design-ux-tips-tools-tutorial/)
- Emular en vivo: Shopify Admin › Products (form seccionado), Katana/Odoo BoM (receta), inFlow/Cin7 Receive Stock (recepción).
