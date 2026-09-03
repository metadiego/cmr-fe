# API v2 en inglés — lo que el frontend necesita saber

**Qué es:** el backend sirve ahora la MISMA API en dos idiomas. `/api/v1/` sigue exactamente como
está (nada que hacer hoy), y `/api/v2/` devuelve lo mismo con las rutas y los campos en inglés.

**Por qué así:** para que no haya un día en que todo se rompa a la vez. Un mismo endpoint responde
por las dos versiones, así que se migra **pantalla por pantalla** y cada una elige su versión. No
hay fecha de corte impuesta: `v1` se retira cuando la última pantalla haya migrado.

**Verificado en producción el 2-sep-2026:** 46 endpoints comparados uno a uno, misma respuesta en
las dos versiones. Ejemplo real, la factura 000323: `v1` devuelve `numero`, `subtotal`, `impuesto`,
`total`; `v2` devuelve `number`, `subtotal`, `tax`, `total`, con los mismos importes.

## Cómo migrar una pantalla

1. Cambia `\/api\/v1\/` por `\/api\/v2\/` en las llamadas de esa pantalla.
2. Traduce la ruta con la tabla de abajo (`facturas` → `invoices`).
3. Traduce los nombres de campo que leas de la respuesta (`nombre` → `name`).
4. Los parámetros de consulta también van en inglés: `?desde=` es `?from=`, `?hasta=` es `?to=`,
   `?estado=` es `?status=`. `limit`, `page` y `q` se dicen igual.
5. El cuerpo de un POST/PUT se manda en inglés: el backend lo traduce antes de validarlo.

Lo que **no** cambia entre versiones: `id`, `email`, `sku`, `total`, `subtotal`, `color`, `path`,
`clinicId`, `createdAt`, `updatedAt`, y el envoltorio `{ data, meta }` con su `pagination`.

Tampoco cambia el contenido de las bolsas libres cuyo vocabulario es del FE: `config`, `render`,
`meta`, `layout`, `columnas`, `filas`, `campos`, `secciones`, `acciones`, `filtros`, `datos`,
`vitales`, `targets`, `raw`. Sus claves internas se quedan tal cual a propósito: el motor de
tableros seguiría funcionando igual.

## Rutas que cambian (53)

| v1 (español) | v2 (inglés) |
|---|---|
| `ahora-mismo` | `right-now` |
| `caja` | `cash` |
| `calendario` | `calendar` |
| `captacion` | `acquisition` |
| `centros` | `centers` |
| `citas` | `appointments` |
| `citas/cupos` | `appointments/slots` |
| `citas/notas-dia` | `appointments/daily-notes` |
| `citas/reportes` | `appointments/reports` |
| `citas/tipos` | `appointments/types` |
| `comunicaciones` | `communications` |
| `estadisticas` | `statistics` |
| `facturacion/columnas` | `billing/columns` |
| `facturacion/devoluciones` | `billing/refunds` |
| `facturacion/formas-pago` | `billing/payment-methods` |
| `facturacion/medios` | `billing/sources` |
| `facturacion/reportes` | `billing/reports` |
| `facturas` | `invoices` |
| `festivos` | `holidays` |
| `formatos` | `formats` |
| `inventario/almacenes` | `inventory/warehouses` |
| `inventario/cierres` | `inventory/closings` |
| `inventario/clasificaciones` | `inventory/classifications` |
| `inventario/componentes` | `inventory/components` |
| `inventario/kardex` | `inventory/kardex` |
| `inventario/lotes` | `inventory/lots` |
| `inventario/motivos-movimiento` | `inventory/movement-reasons` |
| `inventario/movimientos` | `inventory/movements` |
| `inventario/operaciones` | `inventory/operations` |
| `inventario/ordenes-compra` | `inventory/purchase-orders` |
| `inventario/presentaciones` | `inventory/presentations` |
| `inventario/presentaciones-proveedor` | `inventory/supplier-presentations` |
| `inventario/productos` | `inventory/products` |
| `inventario/productos-centro` | `inventory/center-products` |
| `inventario/productos/:productoId/reglas` | `inventory/products/:productId/rules` |
| `inventario/proveedores` | `inventory/suppliers` |
| `inventario/recepciones` | `inventory/receipts` |
| `inventario/reportes` | `inventory/reports` |
| `inventario/stock` | `inventory/stock` |
| `inventario/tipos-movimiento` | `inventory/movement-types` |
| `inventario/transferencias` | `inventory/transfers` |
| `inventario/ubicaciones` | `inventory/locations` |
| `inventario/unidades` | `inventory/units` |
| `inventario/viales-abiertos` | `inventory/open-vials` |
| `medicos/horarios` | `doctors/schedules` |
| `pacientes` | `patients` |
| `pacientes/disponibilidad-legado` | `patients/legacy-availability` |
| `paneles` | `panels` |
| `personal` | `staff` |
| `precios` | `prices` |
| `precios/ofertas` | `prices/offers` |
| `servicios` | `services` |
| `tablero` | `board` |

Estas se dicen igual en las dos versiones: `api-keys`, `auth`, `callcenter`, `export`, `frontdesk`, `geo`, `laser`, `me`, `media`, `menu`, `preferences`, `profiles`.

## Campos más usados

La lista completa son 608 campos y está en el código, en `src/core/api-ingles/campos.ts` del
backend (es la fuente única, la misma que nombró las tablas). Los que salen en casi todas las
pantallas:

| v1 (español) | v2 (inglés) |
|---|---|
| `activo` | `active` |
| `apellido` | `lastName` |
| `apellidos` | `lastName` |
| `cantidad` | `quantity` |
| `centroId` | `centerId` |
| `clave` | `slug` |
| `codigoLegacy` | `legacyCode` |
| `descripcion` | `description` |
| `descuento` | `discount` |
| `direccion` | `address` |
| `edad` | `age` |
| `envio` | `shipping` |
| `estado` | `status` |
| `facturaId` | `invoiceId` |
| `fecha` | `date` |
| `fechaNacimiento` | `dateOfBirth` |
| `hora` | `time` |
| `impuesto` | `tax` |
| `medicoId` | `doctorId` |
| `monto` | `amount` |
| `motivo` | `reason` |
| `nombre` | `name` |
| `nombreMostrar` | `displayName` |
| `nombres` | `firstName` |
| `notas` | `notes` |
| `numero` | `number` |
| `orden` | `sortOrder` |
| `pacienteId` | `patientId` |
| `precio` | `price` |
| `productoId` | `productId` |
| `record` | `medicalRecordNumber` |
| `servicioId` | `serviceId` |
| `telefono` | `phone` |
| `tipo` | `type` |
| `vigenciaDesde` | `validFrom` |
| `vigenciaHasta` | `validUntil` |

## Detalles que conviene saber

- **Los campos calculados también están traducidos**: `nombreMostrar` es `displayName`, `edad` es
  `age`, `ingresoBruto` es `grossRevenue`, `noLeidas` es `unread`.
- **Cinco nombres tenían dos significados** según de dónde vinieran y se eligió uno: `clave` es
  `slug` (en una alerta era la clave del tipo), `destino` es `destination` (en una notificación era
  el destinatario), `direccion` es `address` (en una llamada era entrante/saliente), `orden` es
  `sortOrder`, `servicioClave` es `serviceSlug`. El dato es el mismo; solo el nombre pierde el
  matiz.
- **Si un campo llega en español por `v2`, es un error del backend, no del frontend**: hay una
  prueba que revienta cuando aparece un campo que no está en el mapa. Avisad y se añade.

## Qué NO hay que hacer

- No migrar todo de golpe: la gracia de tener dos versiones es poder ir pantalla por pantalla.
- No mezclar las dos versiones dentro de la MISMA pantalla: se puede, pero se hace un lío al leer
  el código.

Backend: `docs/specs/api-en-ingles.md` y `docs/plans/api-en-ingles.md`.
