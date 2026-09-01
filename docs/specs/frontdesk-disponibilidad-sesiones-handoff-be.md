# HANDOFF BACKEND — Disponibilidad fiel + auto-presente al saldar + edición de sesiones/áreas en Frontdesk

> Para el/la dev de **cmr-be**. Debe entenderse TODO desde aquí sin conversación previa.
> Normas obligatorias: API-First · Swagger/MCP (`gen:api`) · configurable · multi-tenant (`clinicId`/X-Tenant-ID) ·
> RBAC · comentarios en DB y campos · spec/plan · TDD (test primero) · drift-clean · i18n (claves inglés) ·
> sin hardcode · NO duplicar · sin secretos · **NUNCA asumir, investigar a fondo**.
> El FE (esta sesión) NO toca backend; solo consumirá los endpoints/campos que aquí se piden. Plan FE: `frontdesk-disponibilidad-sesiones-plan.md`.

---

## 1. Objetivo de negocio (palabras del dueño)
1. La facturación **ya captura y guarda áreas y días** en el ítem (`factura_items.meta`). NO se copia del legacy.
2. Falta **arrastrar** ese dato del ítem → disponibilidad → frontdesk, para pintar **fiel**: `sesión 1 de 12 (12 días × 1 área)`.
3. Disparador de negocio = **factura SALDADA** (`cancelado = montoAbonado ≥ total`), **incluida la cortesía a total 0**
   (descuento 100% que da la ficha). Regla del dueño: "**no hay factura sin cobro**"; el "emitir/imprimir" del legacy
   ocurre cuando el cliente **ya pagó**. En nuestro modelo el pago total (o el total 0) es el hito.
4. Al quedar **saldada el mismo día**, cada línea de servicio/terapia debe **aparecer automáticamente en el frontdesk
   marcada PRESENTE**, cada una **en el tablero del servicio que le corresponde** (aunque hoy solo se opere láser: láser,
   suero o el servicio que sea, debe caer donde toca).
5. Frontdesk necesita un mecanismo para **corregir áreas/sesiones** (facturación pudo equivocarse) que **actualice la
   disponibilidad** en vivo, con auditoría (append-only, antes/después + actor).

---

## 2. Hallazgos VERIFICADOS (dogfood real, NO asumidos)

### 2.1 Legacy (SQL Server `farmacias`, Bayamón) — SOLO referencia, no se toca
- Detalle láser `MSSDfact` tiene columnas reales: `dias (int)`, `areas (int)`, `dosis (int)`, `cantidad`, `producto_id`.
  Ejemplo fiel factura `037071`: `TD01` → `dias=12, areas=1, cantidad=12`, `precunit=70`, `subtotal=840`.
  **En el legacy `cantidad = dias × areas` y el precio se multiplica por esa cantidad → los días SÍ multiplican.**
- Saldo legacy `disponible`: guarda solo el **total** (`cantidad`, `quedan`), **sin** desglose días/áreas.
- Frontdesk legacy tiene una tabla nueva `control_sesiones` (`codigo_producto`, `codigo_servicio`, `sesiones_totales`,
  `sesiones_consumidas`, `sesiones_disponibles`, `estado`, `es_inferido`) — **tampoco** guarda áreas/días.
- **CONCLUSIÓN CLAVE:** el desglose **áreas/días vive SOLO en la factura**. Para mostrarlo/editarlo en frontdesk hay que
  **denormalizarlo desde el ítem hacia el paquete**. `control_sesiones` es buen modelo de referencia (producto→servicio).

### 2.2 Sistema nuevo (cmr-be) — estado actual verificado
- Grupos data-driven: `grupos_facturacion` + `columnas_facturacion` (rol `multiplicador` | `informativo`).
  **Drift en prod (láser):** `areas`=multiplicador, **`dias`=informativo** ⚠️. Choca con el legacy (donde días multiplica).
- Ítem `factura_items`: `meta.multiplicadores = { areas: n }` + demás columnas capturadas en `meta` (incl. `dias`).
  `sesiones` es campo propio (`agregarItem`: `sesiones = dto.sesiones ?? dto.cantidad ?? 1`, service ~L1270).
- `cantidadEfectiva(item) = cantidad × Π(multiplicadores)` (método puro, testeado; `facturacion.service.ts` ~L251).
- Disponibilidad = `paquetes_sesiones` (`entities/paquete-sesion.entity.ts`). Se crea **al EMITIR** líneas
  `modoDescarga='a_la_entrega'` (`emitir()` ~L1499 → `crearPaqueteDeItem()` ~L1607). Hoy copia
  `sesionesTotales = item.sesiones` y **NO** copia áreas/días ni nombre de producto. Anular → paquetes `anulado`.
- `pendientesEntrega(pacienteId)` (~L1705) devuelve `{...paquete, pendiente}` (sin nombre ni multiplicadores).
  `pendientesEntregaPorGrupo` (~L1691). `FrontdeskService.disponibilidadServicio()` (~L387) resuelve por
  `servicio.grupoFacturacionId` (1:1) o `servicio.productoId`.
- Estados factura: `borrador|emitida|anulada|devuelta_parcial|devuelta_total`. **`cancelado` es DERIVADO**
  (`montoAbonado ≥ total`, `factura.entity.ts` ~L253). NO existe estado `pagada`/`cancelada`.
- **Auto-presente al saldar: NO EXISTE.** Ni `emitir()` ni `pagos.service` crean sesiones de frontdesk.
  `frontdesk_sesiones` nacen `pendiente`; máquina `pendiente→presente→en_terapia→asistido|cancelada`.
- **YA EXISTE (no duplicar):**
  - `frontdesk_sesiones.paqueteSesionId` (FK lógica al paquete que se entrega; opcional) + `productoAplicadoId` + `datos jsonb`.
  - `GET /frontdesk/pacientes/:id/historial` (PR #148) proyecta `sesionNumero` (X), `sesionesTotales` (Y),
    `areas` (= `datos.aplicadas ?? cantidad`), staff. Ver `historialPaciente()` (~L244) y
    `docs/specs/frontdesk-historial-paciente-servicio.md`. **Reusar/extender este patrón, no reimplementar.**

---

## 3. Trabajo BE requerido (fases, TDD)

### GAP A — Denormalizar multiplicadores + fijar sesiones al paquete
- `paquetes_sesiones` += columna **`meta jsonb NULL`** (migración con `comment` en tabla y columna): snapshot congelado
  del ítem `{ multiplicadores, ...columnas informativas (dias, dosis, sesiones) }`. Drift-clean.
- `crearPaqueteDeItem`: `sesionesTotales = cantidadEfectiva(item)` (fiel al legacy: días × áreas) y `meta = { ...item.meta }`.
  **Data-driven**: el total = producto de multiplicadores del grupo; NO hardcodear "días×áreas".
  ⚠️ Ojo suero/otros: hoy `sesiones` puede venir explícito y sin multiplicadores `cantidadEfectiva=cantidad`.
  Investigar la captura real de cada grupo (láser/suero/producto) antes de cambiar; NO romper suero.
- **Config drift láser**: `dias` debe pasar a `rol='multiplicador'` (casa con legacy y con el cobro correcto).
  Hacerlo **por dato** (`PUT /facturacion/columnas/:id`), documentado; NO en código. Verificar impacto en cobro de láser
  (hoy podría estar subfacturando si captura cantidad=1).

### GAP B — Auto-presente al SALDAR
- Cuando `factura.cancelado` pasa a `true` (en `pagos.service` tras recomputar, y en `emitir()` si total 0) **y `fecha=hoy`**:
  crear/asegurar una `frontdesk_sesion` por cada línea `a_la_entrega`, **idempotente**, resolviendo el servicio por
  `servicio.grupoFacturacionId` (1:1 con el grupo del producto), estado inicial **`presente`** (sella `presenteEn`),
  enlazando `paqueteSesionId` del paquete recién creado.
- **Idempotencia**: agregar FK/uniq por (`facturaItemId`) o (`paqueteSesionId`) en `frontdesk_sesiones`; reintentos no duplican.
- **Reversa**: anular factura → sus sesiones autogeneradas **no consumidas** pasan a `cancelada`.
- **Configurable**: flag por centro `frontdesk.autopresente` (settings existentes); off = comportamiento actual.
- **Auditable**: evento `frontdesk_evento` tipo `autopresente` (actor = sistema/quien cobró).

### GAP C — Editar áreas/sesiones desde Frontdesk → actualiza disponibilidad
- Endpoint **`PATCH /facturas/paquetes/:id/ajuste`** (o `/frontdesk/disponibilidad/:paqueteId`),
  DTO `{ sesionesTotales?: number, multiplicadores?: Record<string,number> }`.
  Recalcula, **valida `sesionesTotales ≥ sesionesEntregadas`**, escribe `paquete.meta` + `sesionesTotales`,
  emite evento append-only **`disponibilidad_ajustada`** (antes/después + actor). NO reescribe la factura (append-only,
  como el `note` "fix quedan" del legacy). Permiso **configurable** `frontdesk.disponibilidad.editar`.

### GAP D — Payload para que el FE pinte fiel (sin volver a la factura)
- `pendientesEntrega` / `disponibilidadServicio` deben enriquecer cada paquete con:
  `productoNombre`, `grupoClave`, `multiplicadores` (de `paquete.meta`), `sesionesTotales`, `sesionesEntregadas`, `pendiente`.
  Con eso el FE arma `sesión {entregadas+1} de {sesionesTotales}` + leyenda `({dias} días × {areas} áreas)` recorriendo
  `multiplicadores` (sin asumir claves; salen del esquema `GET /facturacion/columnas`).

---

## 4. Contrato que el FE espera (resumen para acordar)
- **Disponibilidad enriquecida** (GET pendientes-entrega / disponibilidadServicio): + `productoNombre`, `grupoClave`,
  `multiplicadores{}`, `sesionesTotales`, `sesionesEntregadas`, `pendiente`.
- **Auto-presente**: al saldar, la sesión ya aparece en el board del servicio en estado `presente` (SSE lo emite).
- **Ajuste**: `PATCH …/paquetes/:id/ajuste { sesionesTotales?, multiplicadores? }` → 200 con el paquete actualizado + evento.
- Gate RBAC: `frontdesk.disponibilidad.editar` (para mostrar/ocultar la acción en el FE via `/me` o `use-can`).

## 5. Prueba real fidedigna (la corre el dueño/FE tras deploy BE)
Factura unificada con **láser + suero + producto** usando productos reales, capturando áreas/días como el legacy
(ej. láser 12 días × 1 área) → **emitir** → **pagar** (o **cortesía total 0**) → verificar: totales correctos,
`sesionesTotales` fiel (12), disponibilidad enriquecida, **auto-presente por servicio**, y **corrección** de sesiones/áreas.
Escrituras de prueba en prod **reversibles** (anular mismo día). Ampliar `scripts/pos-e2e.sh` con estas aserciones.

## 6. Notas de entorno (importante)
- **Prod BE va por detrás del repo local** (p.ej. `GET /facturacion/catalogo` responde 404 en prod pero existe en el código).
  Confirmar en qué entorno prueba el dueño antes de afirmar "funciona" (ver memoria `verificar-en-el-mismo-be-que-el-usuario`).
- Creds/hosts legacy y de prod: NO copiar aquí (están en configs del `cmr` y en `cmr-be/.personal/ENV-PROD.md`).
- Bitácora dual en ambos `.personal/` al cerrar.
