# Handoff BE — Listas de precio + override por centro + derivación lineal

> **Para:** cmr-be. **De:** cmr-fe. **Fecha:** 2026-07-12. **Estado:** BLOQUEA al FE (API-First).
> El FE **no** construirá esta UI hasta tener el contrato confirmado por BE. Todo lo de abajo
> es verificado contra prod (`/api/v1/precios/*`), no asumido.

## 1. Requerimiento de negocio (dueño: larciles)

Franquicia con 2+ centros (CMR Bayamón, CMR Caguas). Reglas de precio deseadas:

1. **Precio de franquicia (global):** por defecto un producto/presentación vale lo mismo en todos los centros.
2. **Override por centro:** un centro puede tener un precio distinto para un producto puntual.
3. **Múltiples listas de precio:** poder tener varias listas (ej. Regular, Mayorista, Seguro X, Temporada) coexistiendo.
4. **Derivación lineal:** crear una lista NUEVA a partir de otra (ej. la Regular) aplicando un ajuste
   **lineal** a todos sus precios: por **monto** (`+/- $X`) o por **porcentaje** (`+/- X%`). El ajuste debe poder
   aplicarse a **ámbito**:
   - **Global** (todos los centros),
   - **Un centro** en particular,
   - **Individual** (que existan overrides por centro dentro de la misma lista, con montos distintos por centro).
5. Flexibilidad total: subir o bajar, redondeo configurable, vigencia (desde/hasta) opcional.

## 2. Lo que el BE ya tiene (verificado en prod 2026-07-12)

- `PrecioEntity` **tiene `clinicId: string | null`** → soporta global (null) y por-centro (set). ✅ base del override.
- `tipoPrecioId` en cada precio + `GET/POST /precios/tipos` (`{clave, nombre}`) → un "tipo" puede modelar una **lista**.
  Hoy **solo existe `regular`** (`3becd4e1-…`). El tipo es **global** (no tiene `clinicId`).
- `GET /precios/catalogo` (q, asOf, page, limit) → una fila por presentación con `precio`, `fuente`
  (`oferta|precio|base|ninguno`), `tipoPrecioId`. **No** acepta `tipoPrecioId` ni `clinicId` como filtro.
- `GET /precios/efectivo?presentacionId=&asOf=` → resuelve el precio efectivo (motor de resolución existe).
- `GET /precios?presentacionId=` → filas crudas de esa presentación. Único filtro: `presentacionId`.
- `GET/POST /precios/ofertas` → promociones por presentación (precio/`descuentoPct`/vigencia/horario/prioridad).
- `POST /precios` (`CreatePrecioDto`) / `PUT /precios/{id}` (`UpdatePrecioDto`).

## 3. Gaps (lo que falta en el BE)

1. **`CreatePrecioDto` NO expone `clinicId`.** El FE no puede crear un precio dirigido a un centro específico
   de forma explícita. → *Pregunta:* ¿`POST /precios` con header `X-Tenant-ID` fija `clinicId` a ese centro?
   ¿Y `X-Tenant-ID` ausente/global crea `clinicId=null`? Documentarlo.
2. **Resolución de precedencia NO documentada.** ¿`catalogo`/`efectivo` con `X-Tenant-ID=centro` devuelven el
   precio del centro y hacen **fallback** al global (`clinicId=null`) cuando no hay override? Confirmar el orden:
   `oferta(centro) > precio(centro) > oferta(global) > precio(global) > base`.
3. **`catalogo`/`efectivo` no filtran por `tipoPrecioId`.** Para mostrar/editar una lista concreta hace falta
   `?tipoPrecioId=`. → agregar el query param (whitelist).
4. **`tipoPrecio` es global (sin `clinicId`).** OK si la "lista" es franquicia-wide y el override vive en
   `PrecioEntity.clinicId`. Confirmar que ése es el modelo (lista = tipo global; override = fila de precio por
   centro dentro de esa lista).
5. **NO existe derivación/bulk.** No hay endpoint para crear una lista derivada ni para ajustar en masa.
   Este es el gap central.

## 4. Contrato propuesto (a confirmar/ajustar por BE)

### 4.1 Filtros de lista y centro (lectura)
```
GET /api/v1/precios/catalogo?q=&tipoPrecioId=<uuid>&asOf=&page=&limit=
```
- `tipoPrecioId` (opcional): muestra la lista indicada (default = regular).
- Resolución por `X-Tenant-ID` con fallback a global; devolver en cada fila `clinicId` (o `esOverride:boolean`)
  para que el FE distinga "precio del centro" vs "heredado de global".

### 4.2 Crear precio dirigido (escritura)
```
POST /api/v1/precios   body: { presentacionId, tipoPrecioId, precio, clinicId?: uuid|null, vigenciaDesde?, vigenciaHasta? }
```
- Agregar `clinicId` opcional al DTO (o documentar que lo toma de `X-Tenant-ID`). `null` = global.

### 4.3 Derivación lineal (el gap central) — endpoint nuevo propuesto
```
POST /api/v1/precios/derivar
body: {
  origenTipoPrecioId: uuid,        // lista base (ej. regular)
  destinoTipoPrecioId: uuid,       // lista destino (existente) o crear una nueva aparte y pasar su id
  ajuste: { modo: "porcentaje" | "monto", valor: number, direccion: "subir" | "bajar" },
  ambito: { tipo: "global" } | { tipo: "centro", clinicId: uuid } | { tipo: "individual", porCentro: [{clinicId, valor}] },
  redondeo?: { a: 0.01 | 0.05 | 1, modo: "cercano" | "arriba" | "abajo" },
  vigenciaDesde?, vigenciaHasta?,
  soloPresentaciones?: uuid[]      // opcional: limitar a ciertas presentaciones
}
→ 200 { creadas: number, actualizadas: number, preview?: [...] }
```
- Idealmente soportar `?dryRun=true` para **previsualizar** sin escribir (el FE mostrará la tabla antes/después).
- Transaccional (todo o nada).

## 5. Preguntas puntuales para BE (marcar sí/no)
1. ¿`POST /precios` + `X-Tenant-ID` fija `clinicId`? ¿O agregamos `clinicId` al DTO?  ___
2. ¿`catalogo`/`efectivo` hacen fallback centro→global? ¿Orden de precedencia exacto?  ___
3. ¿Agregan `tipoPrecioId` (y `clinicId`/`esOverride` en la respuesta) a `catalogo`?  ___
4. ¿Modelo de "lista" = `tipoPrecio` global + override por `PrecioEntity.clinicId`? ¿Correcto?  ___
5. ¿Construyen `POST /precios/derivar` (con `dryRun`)? ¿O el FE debe iterar `POST /precios` (no ideal: sin transacción, sin redondeo server-side)?  ___

## 6. Qué hará el FE cuando el contrato esté confirmado
- Selector de **lista** (tipoPrecio) en `/precios` + filtro `tipoPrecioId`.
- Badge "override de centro" vs "heredado (global)" por fila; edición que dirige al centro activo o a global.
- Asistente **"Nueva lista derivada"**: elegir origen → ajuste (%/$, subir/bajar) → ámbito (global/centro/individual)
  → **preview** (dryRun) antes/después → aplicar.
- Todo i18n, multi-tenant (X-Tenant-ID), RBAC (`precios.*`), sin hardcode.

---
**El FE se detiene aquí hasta la respuesta del BE (§5).**
