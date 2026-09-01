# Spec/Plan — Disponibilidad fidedigna + auto-presente al saldar + edición de sesiones/áreas en Frontdesk

> Estado: PLAN (aprobado para construir). Cumple normas FE/BE: API-First, Swagger/MCP,
> configurable, multi-tenant, RBAC, comentarios en DB/campos, spec/plan, TDD, drift-clean,
> i18n, sin hardcode, sin duplicar código, sin secretos, verificación real.
> Repos: `cmr-be` (NestJS) + `cmr-fe` (Next.js). Bitácora dual en ambos `.personal/`.

## 1. Objetivo de negocio (palabras del dueño)
- La facturación **ya captura y guarda** áreas y días en el ítem (`factura_items.meta`). No se copia del legacy.
- Falta **arrastrar** ese dato del ítem → disponibilidad → frontdesk para **pintarlo fiel**: `sesión 1 de 12 (12 días × 1 área)`.
- El disparador de negocio es **la factura SALDADA** (`cancelado = montoAbonado ≥ total`), incluida la **cortesía a total 0** (descuento 100%). "No hay factura sin cobro"; el "emitir/imprimir" del legacy ocurre cuando el cliente ya pagó.
- Al quedar **saldada** el mismo día, cada línea de servicio/terapia debe **aparecer automáticamente en el frontdesk marcada PRESENTE**, en el tablero del servicio correspondiente.
- Frontdesk necesita un mecanismo para **corregir áreas/sesiones** (facturación pudo equivocarse) y que **actualice la disponibilidad** en vivo, con auditoría.

## 2. Hallazgos verificados (NO asumidos — dogfood real)

### 2.1 Legacy (SQL Server `farmacias`, Bayamón) — solo referencia
- Detalle láser `MSSDfact`: columnas reales `dias (int)`, `areas (int)`, `dosis (int)`, `cantidad`, `producto_id`.
  Ejemplo fiel (factura `037071`): `TD01` → `dias=12, areas=1, cantidad=12`, `precunit=70`, `subtotal=840`.
  **En el legacy `cantidad = dias × areas` y el precio se multiplica por esa cantidad** (los días SÍ multiplican).
- Saldo legacy: tabla `disponible` guarda **solo el total** (`cantidad`, `quedan`), sin desglose días/áreas.
- Frontdesk legacy: tabla `control_sesiones` (`codigo_producto`, `codigo_servicio`, `sesiones_totales`,
  `sesiones_consumidas`, `sesiones_disponibles`, `estado`, `es_inferido`) — **tampoco** guarda áreas/días.
- **Conclusión:** el desglose áreas/días vive **solo en la factura**. Para mostrar/editar en frontdesk hay que
  denormalizarlo desde el ítem hacia el paquete. `control_sesiones` es el modelo de referencia (producto→servicio).

### 2.2 Sistema nuevo (cmr-be) — estado actual
- Grupos data-driven: `grupos_facturacion` + `columnas_facturacion` (rol `multiplicador`/`informativo`).
  Prod hoy (láser): `areas`=multiplicador, **`dias`=informativo** ⚠️ (drift vs legacy, donde días multiplica).
- Ítem: `factura_items.meta.multiplicadores = { areas: n }` + demás columnas capturadas en `meta` (incl. `dias`). `sesiones` es campo propio.
- `cantidadEfectiva = cantidad × Π(multiplicadores)` (puro, testeado).
- Disponibilidad = `paquetes_sesiones`, creado **al EMITIR** líneas `modoDescarga='a_la_entrega'`.
  `crearPaqueteDeItem` copia `sesionesTotales = item.sesiones`. **NO copia áreas/días ni nombre de producto.**
- `pendientesEntrega()` devuelve el paquete + `pendiente` calculado, sin nombre ni multiplicadores.
- Estados factura: `borrador|emitida|anulada|devuelta_parcial|devuelta_total`. `cancelado` es DERIVADO.
- **Auto-presente al saldar: NO existe.** No hay side-effect factura→frontdesk. Las sesiones nacen `pendiente`.
- Frontdesk: `frontdesk_sesiones` (sin `facturaId`/`citaId`), máquina `pendiente→presente→en_terapia→asistido|cancelada`.

## 3. Gaps y diseño (por norma, sin hardcode / configurable / data-driven)

### GAP A — Denormalizar multiplicadores + sesiones al paquete (BE)
- `paquetes_sesiones` += `meta jsonb NULL` (comentado) con el snapshot congelado del ítem: `{ multiplicadores, sesiones, ...columnas informativas }`.
  Migración con `comment` en tabla y columna. Drift-clean (`typeorm ... schema:log` limpio).
- `crearPaqueteDeItem`: setear `sesionesTotales = cantidadEfectiva(item)` (fiel al legacy: días × áreas) y `meta` = `{ ...item.meta }`.
  Decisión data-driven: `sesionesTotales` = producto de multiplicadores del grupo; NO hardcode de "días×áreas".
- **Config drift láser:** `dias` debe ser `multiplicador` (no informativo) para casar con legacy. Se corrige **por dato**
  (endpoint admin `PUT /facturacion/columnas/:id`), NO en código. Se documenta y se ejerce vía API (dogfood).
- `pendientesEntrega()` / `disponibilidadServicio()` enriquecen cada paquete con `productoNombre`, `grupoClave`,
  y `multiplicadores` (desde `paquete.meta`), para que el FE pinte sin volver a la factura.

### GAP B — Auto-presente al SALDAR (BE)
- Nuevo servicio `FrontdeskAutopresenteService` (o método en frontdesk) suscrito al evento de saldo:
  cuando `factura.cancelado` pasa a `true` (en `pagos.service` tras recomputar, y en `emitir()` si total 0), y `fecha = hoy`,
  crear/asegurar una `frontdesk_sesion` por cada línea `a_la_entrega`, **idempotente** (nueva FK `facturaItemId` en `frontdesk_sesiones`),
  resolviendo el servicio por `servicio.grupoFacturacionId` (1:1 con el grupo del producto), estado inicial **`presente`** (sella `presenteEn`).
- Idempotencia: `UNIQUE(facturaItemId)` parcial; reintentos no duplican. Reversa: al anular factura → sesiones autogeneradas no consumidas pasan a `cancelada`.
- Configurable: flag por centro `frontdesk.autopresente` (tabla de settings existente) — si off, no crea (comportamiento actual).
- RBAC: la creación es efecto de sistema (no requiere permiso de usuario); auditable vía evento `frontdesk_evento` (`autopresente`).

### GAP C — Editar áreas/sesiones desde Frontdesk → actualiza disponibilidad (BE + FE)
- BE: `PATCH /facturas/paquetes/:id/ajuste` (o `/frontdesk/disponibilidad/:paqueteId`) con DTO `{ sesionesTotales?, multiplicadores? }`.
  Recalcula, valida (`sesionesTotales ≥ entregadas`), escribe `paquete.meta` + `sesionesTotales`, emite evento append-only
  `disponibilidad_ajustada` (antes/después + actor). Permiso configurable `frontdesk.disponibilidad.editar`.
  NO reescribe la factura (append-only); la factura queda como quedó, el ajuste es de disponibilidad (como el `note` legacy "fix quedan").
- FE: en el board de frontdesk, celda/acción "Corregir sesiones/áreas" (RBAC gate), modal con áreas/días/sesiones,
  guarda por debounce, refresca disponibilidad en vivo (SSE). i18n keys en inglés.

### GAP D — Render fiel en Frontdesk (FE)
- Mostrar por servicio: `sesión {entregadas+1} de {sesionesTotales}` + leyenda `({dias} días × {areas} áreas)` recorriendo
  `meta.multiplicadores` + informativos (sin asumir claves; salen del esquema `GET /facturacion/columnas`).
- Layout UI moderno (investigar referencia actual) al estándar "mega pro".

## 4. Plan por fases (TDD — test primero)
1. **F1 (BE):** migración `paquetes_sesiones.meta` + comentarios; unit test `crearPaqueteDeItem` (sesionesTotales=cantidadEfectiva, meta copiada). Drift-clean. `gen:api`.
2. **F2 (BE):** enriquecer `pendientesEntrega`/`disponibilidadServicio` (nombre+grupo+multiplicadores); tests de payload. Config láser `dias`→multiplicador por API (documentado).
3. **F3 (BE):** auto-presente al saldar; `facturaItemId` en `frontdesk_sesiones` + unique idempotente; tests (saldo>0, cortesía total 0, anulación revierte, off por flag).
4. **F4 (BE):** endpoint de ajuste de disponibilidad + evento auditable; tests (guard entregadas, RBAC, antes/después).
5. **F5 (FE):** render fiel "1 de 12 (12 días × 1 área)" + modal de corrección (RBAC) + SSE; i18n; layout moderno.
6. **F6 (Prueba real):** factura unificada láser+suero+producto con áreas/días reales → emitir → pagar (o cortesía 0) → verificar totales, disponibilidad fiel, auto-presente en cada tablero, y corrección de sesiones. Reversible (anular mismo día).

## 5. Prueba real fidedigna (F6)
- Usar productos reales del catálogo nuevo (grupos `laser`/`suero`/`producto`), capturando áreas/días como en el legacy (ej. láser 12 días × 1 área).
- Verificar contra script (ampliar `scripts/pos-e2e.sh`): totales, `sesionesTotales`, `pendiente`, auto-presente por servicio.
- Escrituras de prueba en prod **reversibles** (anular mismo día). Nada irreversible sin OK.

## 6. Normas explícitas cubiertas
API-First (todo por endpoint) · Swagger/MCP (`gen:api` tras cambios) · configurable (flags/columnas data-driven) ·
multi-tenant (`clinicId`/X-Tenant-ID) · RBAC (permisos nuevos configurables) · comentarios en DB/campos ·
spec/plan (este doc) · TDD (tests primero por fase) · drift-clean · i18n (claves en inglés) · sin hardcode ·
sin duplicar (reusar `crearPaqueteDeItem`, `cantidadEfectiva`, componentes FE) · sin secretos · verificación real (dogfood).
