# Hand-off FE — Inventario (Productos + Proveedor + AMP) y Precios (catálogo)

> **Para:** cmr-fe. **De:** BE (cmr-be). **Fecha:** 2026-07-12. **Estado:** todo **DESPLEGADO Y VERIFICADO EN
> PRODUCCIÓN** (`https://api.centrodemedicinaregenerativa.com`). No falta nada del BE. Este doc es
> auto-contenido: no adivines nada, todo está aquí (endpoints exactos, JSON real, estados, layout).

---

## 0. Lo básico (leer sí o sí)

- **Base URL:** `${NEXT_PUBLIC_API_BASE_URL}/api/v1` (prod = `https://api.centrodemedicinaregenerativa.com/api/v1`;
  local = `http://localhost:3001/api/v1`).
- **Auth:** header `Authorization: Bearer <token>` (el JWT de Supabase del usuario logueado — ya lo tienes).
- **Centro activo:** header `X-Tenant-ID: <clinicId>` (el centro seleccionado). Para estos endpoints de
  catálogo (productos/proveedores/unidades/AMP son GLOBAL) no cambia el resultado, pero **envíalo igual** por
  consistencia (precios/stock sí dependen del centro).
- **Roles:** el usuario debe tener rol `admin`, `super_admin` o `gerente` (o los permisos `inventario.*` /
  `precios.*`). Si no, el BE responde `403`.
- **Envelope de respuesta (SIEMPRE):** todo viene envuelto así:
  ```json
  { "data": <lo que pediste>, "meta": { "timestamp": "...", "requestId": "...", "pagination": { "total": 39, "page": 1, "limit": 20 } } }
  ```
  → **Lee `response.data`** (no el objeto raíz). La paginación está en `response.meta.pagination`.
- **Errores:** `{ "error": { "code": "...", "message": "..." }, "meta": {...} }` con status 4xx. Códigos que
  verás: `401` (token inválido), `403` (sin rol/permiso), `400 VALIDATION_ERROR` (query/body mal — p.ej. un
  query param no soportado; **manda solo los params documentados aquí**), `404`.
- **Paginación:** query `?page=1&limit=20` (limit máx 100). Default page=1, limit=20.

---

## 1. Pantalla PRODUCTOS  (`/inventario/productos`)

### Endpoint
```
GET /api/v1/inventario/productos?soloFisicos=true&conProveedores=true&q=<texto>&page=1&limit=50
```
Query params (TODOS opcionales, y **solo estos** — otro param = 400):
- `soloFisicos=true` → solo comprables (tipo base|unico; sin servicios ni kits). Para esta pantalla: **usa `true`**.
- `conProveedores=true` → adjunta `proveedores:[{id,nombre}]` a cada producto (para la columna Proveedor). **Úsalo.**
- `q=<texto>` → búsqueda server-side por nombre O sku (ILIKE). **Debounce 300ms**; manda `q` en cada tecla.
- `incluirInactivos=true` → incluye inactivos (por defecto solo activos). Opcional (toggle "ver inactivos").
- `page`, `limit`.

### Respuesta REAL (verbatim)
```json
{
  "data": [
    {
      "id": "56f5688f-a824-43dd-b851-6dd01a292e70",
      "sku": "113",
      "nombre": "ARTHRITINE PLUS 300  CAPSULES",
      "nombreCorto": "ARTHRITINE PLUS 300",
      "descripcion": "ARTHRITINE PLUS 300  CAPSULES",
      "tipo": "unico",
      "activo": true,
      "modoDescarga": "a_la_venta",
      "unidadInventarioId": null,
      "marcaId": null, "fabricanteId": null,
      "gravado": true, "impuestoId": null,
      "proveedores": [ { "id": "d77b28ff-...", "nombre": "Nulab" } ]
    }
  ],
  "meta": { "pagination": { "total": 39, "page": 1, "limit": 1 } }
}
```

### Columnas de la tabla
`NOMBRE | SKU | TIPO | PROVEEDOR | ESTADO | (acciones)`
- **PROVEEDOR** = `producto.proveedores`. Reglas de render (patrón moderno):
  - 0 → `—`.
  - 1 → el `nombre` (ej. "Nulab").
  - 2+ → `"Nulab +2"` en una sola línea con **tooltip** al hover/focus que liste todos (single-line + ellipsis
    + tooltip es el default para contenido que no cabe). **No** hagas wrap ni muestres N chips que rompan la fila.
- **TIPO** = `tipo` (badge): `unico` → "Único", `base` → "Base", etc. Usa `labelKey` i18n, no hardcodees.
- **ESTADO** = `activo` → badge "Activo/Inactivo".

### Comportamiento
- **Buscador** (input arriba): manda `?q=` con debounce 300ms; resetea a `page=1`. Placeholder: "Buscar por nombre, SKU o código…".
- **Header sticky** (la tabla pasa de una pantalla).
- **Fila expandible** (chevron ▸ al inicio de la fila): al expandir, carga y muestra los **AMP** del producto
  (§2, `GET presentaciones-proveedor?productoId=`) en una sub-tabla: `Proveedor · Presentación · Contenido`.
  Progressive disclosure, sin salir de la lista.
- **Paginación** (footer) con `meta.pagination.total`.
- **Estados:** loading (skeleton de filas), vacío ("Sin productos" / "Sin resultados para «q»"), error (mensaje + retry).
- Botón **"+ Nuevo producto"** → `POST /inventario/productos` (fuera de este hand-off; ya existe el CRUD).

---

## 2. AMP — Presentaciones de proveedor  (dentro del producto / fila expandida)

El **AMP** es la capa NO-limitante: un producto puede tener **N** AMP, cada uno con su **proveedor + marca +
cantidad + presentación**. El mismo proveedor puede venderlo en varias presentaciones (cada una = otro AMP).

### Endpoints
```
GET    /api/v1/inventario/presentaciones-proveedor?productoId=<uuid>&activo=true
POST   /api/v1/inventario/presentaciones-proveedor
PUT    /api/v1/inventario/presentaciones-proveedor/<id>
DELETE /api/v1/inventario/presentaciones-proveedor/<id>        (baja lógica)
```
`GET` requiere `productoId` (uuid) sí o sí. `activo=true` opcional.

### Respuesta REAL del GET (verbatim)
```json
{ "data": [ {
  "id": "53b25ee7-...",
  "productoId": "56f5688f-...",
  "proveedorId": "d77b28ff-...",
  "nombre": "ARTHRITINE PLUS 300  CAPSULES — 300 cápsulas",
  "contenidoPorEmpaque": 300,
  "unidadContenidoId": "8923f560-...",
  "concentracion": null, "unidadConcentracionId": null,
  "marcaId": null, "fabricanteId": null,
  "factorABase": null, "sku": null, "barcode": null,
  "vigenciaDesde": null, "vigenciaHasta": null,
  "activo": true
} ] }
```

### Body de POST/PUT (crear/editar AMP)
```json
{
  "productoId": "<uuid>",          // requerido en POST
  "proveedorId": "<uuid>",         // el selector de proveedor (§4)
  "nombre": "Frasco 300 cápsulas", // requerido en POST
  "contenidoPorEmpaque": 300,      // number opcional
  "unidadContenidoId": "<uuid>",   // unidad del contenido (§4 unidades: capsula/g/ml…)
  "concentracion": 10,             // opcional (p.ej. 10 mg/ml)
  "unidadConcentracionId": "<uuid>",
  "marcaId": "<uuid>", "fabricanteId": "<uuid>",  // opcionales (clasificaciones)
  "sku": "...", "barcode": "..."   // opcionales
}
```
En PUT todos son opcionales (patch). `DELETE` es baja lógica (`activo=false`).

### UI del editor de AMP
- Panel lateral / side-sheet (más fricción que inline = menos errores en datos sensibles). NO inline.
- **Selector de Proveedor** (obligatorio visualmente): dropdown alimentado por `GET /inventario/proveedores` (§4).
- **Cantidad + Unidad**: input numérico (`contenidoPorEmpaque`) + selector de unidad (`GET /inventario/unidades`,
  §4). Ej: `300` + `Cápsula`.
- Campos avanzados colapsables: concentración+unidad, marca, fabricante, sku, barcode.
- El `nombre` puedes autogenerarlo ("{producto} — {cantidad} {unidad}") y dejar editar.

---

## 3. Pantalla PRECIOS  (`/precios`)

### Endpoint (catálogo — el que faltaba)
```
GET /api/v1/precios/catalogo?q=<texto>&page=1&limit=50&asOf=<ISO opcional>
```
Params: `q` (nombre|sku, debounce 300ms), `page`, `limit`, `asOf` (momento para el precio; default ahora).

### Respuesta REAL (verbatim)
```json
{
  "data": [ {
    "productoId": "02b4dc7d-...",
    "sku": "admod300",
    "nombre": "ADRENAL MODULATOR 300 CAPSULES",
    "presentacionId": "2412933f-...",
    "presentacionNombre": "Unidad",
    "precio": 149.28,
    "fuente": "precio",                 // "oferta" | "precio" | "base" | "ninguno"
    "tipoPrecioId": "e4f7cc70-...",
    "monedaId": "7e9b1035-...",
    "impuestoId": "0383ce7d-..."
  } ],
  "meta": { "pagination": { "total": 39, "page": 1, "limit": 1 } }
}
```

### Columnas
`PRODUCTO (nombre) | SKU | PRESENTACIÓN | PRECIO | FUENTE | (editar)`
- **PRECIO**: `precio` formateado como moneda; si `precio == null` → `—` (badge "sin precio").
- **FUENTE**: badge — `oferta` (verde "Oferta"), `precio` (neutro "Regular"), `base` (gris "Base"), `ninguno`
  (rojo "Sin precio"). i18n por `labelKey`.
- Header sticky, búsqueda `q`, paginación, estados loading/vacío/error (igual que §1).

### Editar precio (inline)
- Patrón: **edición inline** del campo PRECIO (lápiz al hover / foco). Al guardar:
  - Si el producto ya tenía precio de tipo regular (viene de `fuente:"precio"`), necesitas su `precioId`:
    obténlo con `GET /api/v1/precios?presentacionId=<presentacionId>` (devuelve las filas de precio de esa
    presentación) → toma la de `tipoPrecioId` regular → `PUT /api/v1/precios/<id>` con `{ "precio": 123.45 }`.
  - Si `fuente` es `base`/`ninguno` (no hay fila de precio): `POST /api/v1/precios` con
    `{ presentacionId, tipoPrecioId: <regular>, precio }`. El `tipoPrecioId` regular sale de
    `GET /api/v1/precios/tipos` (busca `clave:"regular"`).
- Ofertas (opcional, avanzado): `GET/POST /api/v1/precios/ofertas?presentacionId=`.

---

## 4. Selectores auxiliares (para los dropdowns)

- **Proveedores** (GLOBAL): `GET /api/v1/inventario/proveedores` →
  `data: [{ id, nombre, rnc, telefono, email, direccion, activo }]`. Filtra `activo:true` en el FE para el selector.
- **Unidades** (GLOBAL): `GET /api/v1/inventario/unidades` →
  `data: [{ id, clave, nombre, dimension, factorACanonica, esCanonica, activo }]`. `dimension` ∈
  masa|volumen|actividad|conteo|longitud (algunas null). Muestra `nombre`; agrupa por `dimension` si quieres.
- **Tipos de precio / monedas / impuestos:** `GET /api/v1/precios/tipos`, `/precios/monedas`, `/precios/impuestos`.

---

## 5. Orden de construcción sugerido
1. Pantalla **Productos** (§1) con columna Proveedor (tooltip) + buscador + paginación + estados. (Desbloquea lo visible.)
2. **Fila expandible** → lista de AMP (§2 GET).
3. **Editor de AMP** (§2 POST/PUT) con selectores de proveedor + unidad (§4).
4. Pantalla **Precios** (§3) con catálogo + edición inline.

## 6. Reglas transversales (obligatorias)
- **i18n**: TODO label vía `labelKey`/traducción, cero strings hardcodeados.
- **Estados**: siempre loading / vacío / error explícitos (no pantalla en blanco).
- **No mandes query params fuera de los documentados** → el BE responde 400 (whitelist estricto).
- **Lee `response.data`** y `response.meta.pagination`.
- Tema claro/oscuro, responsive, header sticky en tablas.

## 7. UI moderna — referencias (aplicar patrones)
Tabla enterprise: single-line + ellipsis + tooltip para contenido largo; filas expandibles con chevron;
edición inline con lápiz/foco; header sticky; bulk actions; estados vacíos claros.
Fuentes: [Pencil&Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) ·
[Setproduct 2026](https://www.setproduct.com/blog/data-table-ui-design) ·
[LogRocket](https://blog.logrocket.com/ux-design/data-table-design-best-practices/).
