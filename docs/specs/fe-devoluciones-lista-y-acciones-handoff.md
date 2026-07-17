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

## Slice B (BE #103) — Política de devolución `precio_base`
El modal de devolución ofrece la **política**: `como_facturada` (default) | `precio_base`.
- `POST /facturas/:id/devolver` acepta `politica: 'precio_base'`.
- **precio_base** (servicios de precio variable: láser, vit C, GLP-1): valora lo CONSUMIDO al **precio base**
  = el más alto entre las presentaciones del producto. Reembolso = pagado − consumido×base → **puede ser
  NEGATIVO** (el paciente termina debiendo). NO reembolsa efectivo si es negativo; se registra el saldo.
- Consultar el precio base para preview: `GET /api/v1/facturas/precio-base?productoId=<id>` → `{ productoId, precioBase }`.
- **Preview obligatorio en el modal:** al elegir `precio_base`, mostrar el neto calculado (puede salir
  "el paciente debe $X") ANTES de confirmar. No bloqueante — es decisión del paciente (seguir/pagar/no volver).
- UI: toggle de política + columna/al pie con el neto (verde=reembolso, rojo=debe).

## Slice C (BE #104) — Por-componente + precio editable
`POST /facturas/:id/devolver` — cada item ahora acepta:
- `precioDevuelto` (number, opcional): **override del monto** de la LÍNEA (precio editable por producto). Puede ser negativo.
- `componentes` (opcional): devolver componentes específicos de un kit (PC):
  `[{ facturaItemComponenteId, cantidad?, precioDevuelto? }]`. Revierte el inventario del componente
  (si es a_la_venta) y reembolsa `precioDevuelto` (el snapshot del componente NO trae precio → el precio
  del componente se EDITA en el modal). Los componentes del kit vienen en `GET /facturas/:id` →
  `item.contenido[]` (con `productoId`, `nombre`, `cantidad`, `precio` de referencia).
- UI del modal: por cada línea, permitir editar el monto a devolver; para kits, expandir sus componentes
  (de `contenido[]`) y permitir devolver/editar cada uno. Data-grid editable (shadcn/ui + TanStack Table).

## Slice D (BE #105) — Timing: anular vs devolver (NO bloqueante)
`GET /api/v1/facturas/:id/politica-devolucion` →
`{ accionSugerida: 'anular'|'devolver', mismoDia: boolean, dentroVentanaAnulacion: boolean, config }`.
- **mismo día** de emisión → `accionSugerida: 'anular'`; **día siguiente/24h+** → `'devolver'`.
- Configurable por centro (`preferences.anulacion`: ventana `mismo_dia`|`horas`, zonaHoraria).
- **NO bloqueante:** la devolución se permite cualquier día. Es GUÍA — el FE resalta el botón sugerido
  (mismo día → "Anular"; después → "Devolver"), pero deja ambos disponibles.
- MCP: `politica_devolucion`.
