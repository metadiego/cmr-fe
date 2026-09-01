# Handoff FE — Cerrar el ciclo: catálogo → doble descarga (inventario + sesiones)

> **De:** BE (cmr-be). **Para:** cmr-fe. **Actualizado:** 2026-07-13.
> **Estado BE:** TODO el BE de abajo existe y está **en producción, VERIFICADO en los DOS centros**
> (`https://api.centrodemedicinaregenerativa.com`). No falta backend para cerrar el ciclo — **falta FE**.
>
> **Baseline prod verificado (2026-07-13), por centro (Caguas + Bayamón, a la par):**
> 39 fichas · 41 precios · 1 almacén · ~29–30 lotes de apertura cada uno.
> **Globales (ambos):** 88 productos (28 kits/compuestos) · 39 AMP (presentación de proveedor) ·
> 100 recetas (producto_componentes) · 28 reglas de descarga tipo `receta` · 2 proveedores.

## Cambios de BE recientes que el FE debe CONOCER (2026-07-13)
Todo lo de abajo ya está **en prod, ambos centros**, verificado:
1. **Catálogo completo en prod (Bayamón incluido).** Antes solo Caguas estaba promovido; hoy Bayamón quedó a la
   par: 39 fichas · 41 precios · 1 almacén · ~30 lotes de apertura por centro. Globales: 88 productos (28 kits)
   · 39 AMP · 100 recetas. → El FE puede trabajar sobre **datos reales de prod** en los dos centros.
2. **Factura de consulta filtrada:** `GET /facturas/catalogo?contexto=consulta` devuelve **solo** Consulta/
   Seguimiento (los tipos de cita), no el catálogo físico. El editor de factura ya lo pasa cuando `factura.citaId`.
3. **Un servicio nuevo nace con pestaña USABLE:** al crear un servicio (`POST /servicios` / MCP `crear_servicio`)
   el BE le provisiona las **columnas por defecto** (paciente, estado, sesiones, técnico, enfermera, acciones),
   composición global e idempotente. El FE **no** compone columnas tras crear; ajustes finos vía `POST /servicios/:id/columnas`.
4. **Modelo de descarga = 2 ejes explícitos** (ver §0): esto es lo que hay que reflejar en la UI para acabar con
   el "a veces descarga, a veces no".

**Plan UI de inventario (crear/editar productos + kits + recepción):** ver
`docs/plans/fe-inventario-creacion-ux-handoff.md` — **ya casi todo está construido**; ese doc trae la
RECONCILIACIÓN (delta (a)→(b)→(c)) para **no duplicar pantallas**.

## Reglas transversales (aplican a TODA pantalla)
- Leer `response.data` + `meta.pagination`. Auth: `Authorization: Bearer` + `X-Tenant-ID`.
- **Whitelist estricto**: mandar un query param no documentado = **HTTP 400**. Manda solo los documentados.
- i18n por `labelKey` (nunca strings hardcodeados). Estados loading / vacío / error en cada pantalla.
- **Buscar en internet el layout UI más moderno** antes de construir cada pantalla.

---

## 0. El MODELO que hay que reflejar en la UI (la raíz del "a veces descarga, a veces no")

La descarga NO es azar: son **dos ejes independientes**, cada uno **dato explícito**. La UI de configuración
del producto/servicio DEBE mostrar y editar ambos, para que nunca quede implícito.

**Eje 1 — ¿toca inventario? (rebaja de stock)** — en el **producto**:
- `esInventariable` (bool) — ¿genera/descuenta stock?
- `modoDescarga` (enum) — **cuándo**: `a_la_venta` (al facturar) · `a_la_entrega` (al entregar por sesiones) ·
  `no_descarga` (nunca).

**Eje 2 — ¿se entrega por sesiones? (rebaja de sesiones/dosis)** — en el **servicio de frontdesk**:
- El servicio (una pestaña = un tablero) tiene `productoId` **o no**.
  - **Con** `productoId` → cada sesión entregada descarga stock del producto (vía `reglas_descarga`).
  - **Sin** `productoId` = **servicio puro** → la sesión solo **cuenta** (estadística/dosis), no toca inventario.

Las 4 combinaciones que la UI debe dejar configurar sin ambigüedad:

| Caso | esInventariable | modoDescarga | servicio.productoId | Stock | Sesión |
|---|---|---|---|---|---|
| Consulta médica | no | no_descarga | — | ❌ | ❌ |
| Venta directa (frasco) | sí | a_la_venta | — | ✅ al facturar | ❌ |
| Tratamiento por sesiones inventariable (Vit C, GLP) | sí | a_la_entrega | ✅ | ✅ por sesión | ✅ |
| **Servicio NO inventariable (p. ej. Shock Wave)** | **no** | **no_descarga** | **null** | ❌ | ✅ solo cuenta |

---

## 1. Catálogo (base → derivados → AMP → kits) — BE LISTO
Detalle de JSON real en `docs/specs/fe-inventario-precios-handoff.md`.
- **Productos** `GET /inventario/productos?soloFisicos=&conProveedores=&q=&incluirInactivos=`. Cada producto trae
  `tipo` (base|unico|compuesto|servicio), **`esInventariable`**, **`modoDescarga`**, `unidadInventarioId`,
  `contenido`. La pantalla de alta/edición debe exponer **los dos ejes** (§0). `GET/PUT/POST/DELETE /inventario/productos`.
- **Derivados + dosis (receta)** `GET/POST/PUT/DELETE /inventario/componentes?productoCompuestoId=` (editor
  bill-of-materials; cantidad = dosis en unidad base). Editar aquí **re-publica** la regla versionada — no hay que hacer nada extra.
- **Presentación de proveedor (AMP)** `GET/POST/PUT/DELETE /inventario/presentaciones-proveedor` (selector de
  proveedor + unidad + concentración/contenido). ⚠️ **AMP es DESCRIPTIVO** (marca, concentración, empaque): NO
  convierte la salida. La autoridad de descarga es la regla/receta. No pintar el AMP como "factor de conversión".
- **Recibir compra** `POST /inventario/operaciones/recibir-compra` (crea lote; exige `almacenId`).
- **Selectores**: `GET /inventario/unidades` (+ `GET /inventario/unidades/convertir`), `GET /inventario/proveedores`,
  `GET /inventario/almacenes`.

## 2. Precios — BE LISTO (ver `fe-inventario-precios-handoff.md` §3)
- Catálogo por tipo `GET /precios/catalogo?tipoPrecioId=&clinicId=&q=` (`null`=hueco de precio).
- Derivar lista `POST /precios/derivar` con `dryRun:true` (preview) → tabla antes/después → `dryRun:false`.
  Ajuste %/$, redondeo, ámbito global/centro/individual.

## 3. Facturación (descarga #1) — BE LISTO
Base `/facturas`. POS/factura: buscar paciente → agregar líneas del catálogo → precio efectivo → descuentos →
**`POST /facturas/:id/emitir`** (aquí ocurre la **descarga de inventario** recorriendo la receta/regla) → pagos.
- **`GET /facturas/catalogo?contexto=consulta`** → factura de consulta ofrece **solo** Consulta/Seguimiento
  (sin `contexto` = catálogo de venta completo). Ya implementado.
- Líneas/kit: `POST/PUT/DELETE /facturas/:id/items(/:itemId)(/kit)`. Descuentos/exento; anular/devolver; pagos;
  `POST /facturas/cita/:citaId` (Facturar Consulta). Reportes en `/facturacion/reportes/*`.

## 4. Frontdesk / Servicios (descarga #2 + shock wave) — BE LISTO
Aquí vive el **Eje 2** y las **pestañas por servicio**. Base `/servicios` y `/frontdesk`.
- **Servicios (config = pestañas)**: `GET /servicios`, `GET /servicios/:id`, `POST /servicios`, `PUT /servicios/:id`,
  `DELETE /servicios/:id`, `GET/POST /servicios/:id/columnas`. Campos: `clave` (= clave del tablero/pestaña),
  `nombre`, `color`, `icono`, `orden`, **`productoId`** (null = servicio puro), `requiereTecnico`,
  `requiereEnfermera`, `mostrarConteo`, esquema de acciones. **Cada servicio = una pestaña**, data-driven: crear
  un servicio nuevo debe crear su pestaña sin tocar código.
- **Sesiones**: `GET/POST /frontdesk/sesiones`, `GET /frontdesk/sesiones/:id`, `.../historial`, transiciones
  **`POST /frontdesk/sesiones/:id/presente|en-terapia|asistido`** (en `asistido`/entrega ocurre la **descarga por
  sesión/dosis** si el servicio tiene `productoId`), `.../acciones`, `.../cancelar`, `.../reparar`.
- **Tablero**: `GET /frontdesk/tablero`. **Enfermería**: `GET/POST /frontdesk/nurse-status(/tipos)`.
  Reportes: `/frontdesk/reportes/{resumen,por-servicio,por-tecnico,tiempos}`.

### Caso concreto: **Shock Wave (onda de choque) — servicio NO inventariable**
- Se crea con `POST /servicios`: `clave:'shock_wave'`, `nombre:'Shock Wave'`, color/icono/orden,
  **`productoId: null`** (servicio puro → cuenta sesiones, no toca stock). Aparece como **nueva pestaña** automáticamente.
- **El BE ya provisiona las columnas por defecto al crear el servicio** (paciente, estado, sesiones, técnico,
  enfermera, acciones) → la pestaña **nace usable**, no vacía. El FE NO tiene que componer columnas tras crear;
  si el negocio quiere ajustar/añadir columnas de ESE servicio, usa `POST /servicios/:id/columnas`.
- Dosis de aplicación: aún sin definir por el negocio → por ahora solo cuenta sesiones; la config de dosis se
  suma después vía el esquema de acciones del servicio (`/servicios/:id/columnas`), sin código.

## 5. VALIDACIÓN de la doble descarga (la meta del ciclo)
Escenario end-to-end para probar (sobre datos de prod o local):
1. Paciente adquiere un tratamiento (kit/derivado) → **factura → emitir** ⇒ **Descarga #1**: baja el stock del
   insumo por la receta (verificable en kardex/movimientos).
2. Entrega por **sesiones** (frontdesk); cada sesión `asistido`:
   - servicio con `productoId` (inventariable) ⇒ **Descarga #2** baja stock por dosis **y** cuenta la sesión.
   - servicio puro (shock wave) ⇒ solo **cuenta** la sesión, stock intacto.
3. Verificar: stock del insumo baja solo donde debe + total de sesiones/dosis del paciente cuadra.

## 6. Decisión abierta (negocio + FE)
¿Se factura/receta alguna vez el **AMP/marca directo**, o **siempre el derivado (dosis en mg)**? Hoy: siempre el
derivado; el FE no deja elegir marca. Si el negocio quiere elegir marca, se agrega selector de AMP en la línea.

## Nota
Si al construir una pantalla un endpoint no devuelve lo que necesitas, **no improvises**: pide el ajuste al BE con
un mini-handoff (requerimiento, evidencia, gap, contrato propuesto, preguntas sí/no).
