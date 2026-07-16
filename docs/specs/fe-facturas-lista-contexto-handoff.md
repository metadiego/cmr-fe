# Handoff FE — Lista de Facturación General (índice) + picker de centro

**Estado BE:** ✅ listo (PR en curso → prod). Sin cambio de schema.

## Qué falta en el FE
Hoy NO hay pantalla de **índice/lista** de facturas de la Facturación General; solo se crean.
Hace falta la lista para VER, buscar y abrir facturas del centro correcto.

## Contrato BE
`GET /api/v1/facturas` — lista paginada `{ data, meta.pagination }`. Query params:
| param | valor | uso |
|---|---|---|
| `contexto` | **`general`** \| `consulta` | **usar `general`** aquí (excluye las de consulta médica). Omitido = todas. |
| `estado` | `borrador\|emitida\|anulada…` | filtro estado |
| `q` | texto | nº de factura O paciente (nombre/record/teléfono) |
| `desde` / `hasta` | `YYYY-MM-DD` | rango por fecha de creación (hasta = fin de día inclusive) |
| `page` / `limit` | int | paginación |

Valor inválido de `contexto` → **400**. Abrir detalle: `GET /api/v1/facturas/:id`.
(Tablero metadata-driven equivalente: `GET /api/v1/facturas/tablero?contexto=general`.)

## ⚠️ Picker de centro (administradores) — OBLIGATORIO antes de la lista
El admin debe elegir **centro primero**; ese centro va en **`X-Tenant-ID`** en TODA la sesión de
facturación. Así la lista carga la facturación **del centro correcto** (el BE filtra por `clinicId`
del tenant; sin centro no hay narrowing y mezcla centros). Reusar el flujo ya documentado en
`docs/plans/fe-facturacion-picker-centro-handoff.md` (`GET /auth/me/centros`). Personal de un solo
centro: sin picker, su `clinicId` fijo.

## UI (buscar layout moderno de referencia)
Tabla/lista responsive: columnas nº, fecha, paciente, estado (chip), total; barra de filtros
(search + estado + rango fecha) arriba; fila → abre detalle. Labels vía i18n (`labelKey`), no
hardcode. Inspirarse en patrones actuales de "invoices list / data table" (ej. shadcn/ui DataTable,
TanStack Table) — nada de tabla plana antigua.

## Aceptación
- Con centro X en `X-Tenant-ID`: la lista muestra SOLO facturas generales de X (ninguna de consulta).
- Cambiar de centro en el picker recarga la lista de ese centro.
- Search por nº/paciente y filtros de estado/fecha funcionan.
