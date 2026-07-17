# Handoff FE — Lista de Devoluciones + acciones por factura

**BE listo (PR #102, prod).** Slice A: rastreo + lista global. (Políticas/precio-base/por-componente = slices B–D, luego.)

## 1. Lista de Devoluciones (nueva pantalla / botón desde Facturas)
```
GET /api/v1/facturacion/devoluciones?page=1&limit=20&estado=&q=&desde=&hasta=
Headers: Authorization + X-Tenant-ID (centro)
```
Respuesta `{ data: Devolucion[], meta.pagination:{total,page,limit} }`. Cada fila:
`id, facturaId, facturaNumero, tipo (total|parcial), estado (activa|anulada), montoDevuelto,
impuestoDevuelto, fecha, motivo, pacienteId, createdAt`.
- Columnas sugeridas: Nº Devolución, **Nº Factura** (`facturaNumero`), Fecha, Paciente (`pacienteId`→nombre), Monto, Estado, Acciones.
- Filtros: `estado`, `desde`/`hasta` (YYYY-MM-DD), `q` (busca por nº de factura).
- Toda devolución está **atada a una factura** (facturaId/facturaNumero) — no hay devolución suelta.

## 2. Acciones por FACTURA (tu imagen 4 — el `<td>`) → endpoints BE
| Botón | Endpoint BE |
|---|---|
| 👁 Ver detalles | `GET /api/v1/facturas/:id` |
| 🖨 Imprimir | payload de `GET /facturas/:id` (empresa/items/impuestos/contenido) — plantilla térmica |
| ✏️ Editar (borrador) | `PUT /api/v1/facturas/:id/cabecera` (+ items en borrador) |
| ✖ Anular | `POST /api/v1/facturas/:id/anular` `{ motivo, actorId? }` (RBAC `factura.anular`) — mismo día = anulación |
| ✉ Email | flujo de comunicaciones (ya existente) |
| ↩ Devolución | `POST /api/v1/facturas/:id/devolver` `{ items:[{facturaItemId, cantidad, sesiones?}], motivo, formaReembolsoId?, actorId? }` (RBAC `factura.devolver`) |

Ver devoluciones de una factura: `GET /facturas/:id/devoluciones`. Anular una devolución:
`POST /facturas/:id/devoluciones/:devolucionId/anular`. **Una factura puede tener varias devoluciones** (append-only).

## Reglas (dueño)
- **Anular** (mismo día, error del usuario) vs **Devolver** (24h/día siguiente) — ambas NO bloqueantes.
- **Múltiples devoluciones** por factura (raro, pasa) — soportado.
- Próximo (BE, slices B–D): **precio base** (láser/suero), devolución **por-componente** de kits, **precio editable**. El FE puede ir dejando el layout preparado para editar monto por línea.

## UI (layout moderno)
Data-table (shadcn/ui + TanStack Table): filtros arriba, chips de estado (activa/anulada), acciones por fila.
El modal de devolución: tabla de ítems con cantidad/sesiones a devolver + (futuro) monto editable por producto/componente.

## Aceptación
- Lista de devoluciones filtrable/paginada por centro; muestra nº de factura.
- Acciones de la factura llaman los endpoints correctos; anular ≠ devolver.
