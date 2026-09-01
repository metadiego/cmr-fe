# Handoff FE — Lista de Facturación General (réplica de la pantalla legacy)

**BE listo y en prod (PR #89). Sin cambio de schema.** Objetivo: la pantalla de la imagen
("Facturación de Productos"): tabla con filtros + paginación + acciones por fila.

## Endpoint (con nombres ya resueltos → no resuelvas IDs tú)
```
GET /api/v1/facturas/tablero?contexto=general
Headers: Authorization: Bearer <token>   +   X-Tenant-ID: <centro del picker>
```
Devuelve `{ data: { columnas:[…], filas:[…] }, meta }`. `filas` = facturas ya proyectadas con
**nombre de paciente y usuario resueltos**. Es el mismo motor de tableros de Atención/Citas.

Alternativa cruda: `GET /api/v1/facturas?contexto=general` → `{ data: FacturaEntity[], meta.pagination:{total,page,limit} }` (aquí `pacienteId` es UUID, lo resuelves tú).

## Mapeo columna-por-columna de la imagen
| Columna en pantalla | Campo BE | Nota |
|---|---|---|
| **Nº Factura** (`0010129`) | `numero` | `null` en borrador → muestra "—" o "Borrador" |
| **Fecha** (`7/15/2026`) | `fecha ?? createdAt` | formatear local |
| **Cliente** (`WOLF JIMENEZ…`) | fila `paciente` (tablero) / `pacienteId` (crudo) | |
| **Total** (`679.31`) | `total` | |
| **Estado** (chip `IMPRESA`) | `estado` (`borrador\|emitida\|anulada…`) | chip por estado, label vía i18n |
| **Usuario** (`MICHELLE`) | `creadoPor` / `emitidoPor` | quién creó / quién cobró |
| dropdown médico (`Javier Lillo…`) | `medicoId` | editable → `PUT /facturas/:id/cabecera` |
| dropdown 2 (referencia/vendedor) | ver §Referencia | editable → `PUT /facturas/:id/cabecera` |

## Filtros (barra superior de la imagen) — mismos params en ambos endpoints
| Filtro imagen | param |
|---|---|
| **Buscar Cliente** | `q` (busca nº factura O paciente por nombre/record/teléfono) |
| **Fecha** (`mm/dd/yyyy`) | `desde` + `hasta` (`YYYY-MM-DD`; un solo día = desde=hasta) |
| paginación (1,2,3, Siguiente, Última) | `page` + `limit`; total = `meta.pagination.total` |
| **Seleccionar Producto** | `productoId` (UUID) → facturas que contienen ese producto |

Contexto inválido → 400.

## Acciones por fila (los botones 👁 🖨 ✏️ ↩️ + "+ Nueva Factura")
| Botón | Endpoint |
|---|---|
| **+ Nueva Factura** | flujo POS que ya existe (`POST /api/v1/facturas`) |
| 👁 Ver | `GET /api/v1/facturas/:id` |
| 🖨 Imprimir | endpoint de impresión/PDF ya documentado (`factura-formato-termico-fe.md`) |
| ✏️ Editar (borrador) | `PUT /api/v1/facturas/:id/cabecera` (+ items en borrador) |
| ↩️ Devolver | flujo de devoluciones ya existente (`POST /facturas/:id/…`) |

## ⚠️ Picker de centro (admins) — ANTES de la lista
Admin elige centro → ese `clinicId` va en `X-Tenant-ID` toda la sesión → la lista carga la
facturación **del centro correcto**. Reusa `fe-facturacion-picker-centro-handoff.md` + `GET /auth/me/centros`.

## Referencia (2º dropdown / medir ads-publicidad-médico)
El dueño quiere registrar la **referencia** (de dónde vino el paciente: publicidad/campaña/médico).
Confirmar con BE si va como campo propio o dentro de `cabecera`; hoy `PUT /facturas/:id/cabecera`
maneja médico/medio/receptor. **[FE: no inventar; pedir el campo exacto al BE antes de pintarlo.]**

## Aceptación
- Centro X en `X-Tenant-ID` → solo facturas **generales** de X (ninguna de consulta).
- Filtros cliente/fecha + paginación funcionan; acciones abren ver/imprimir/editar/devolver.
- UI: data-table moderna (shadcn/ui DataTable o TanStack Table), labels i18n, no hardcode.
