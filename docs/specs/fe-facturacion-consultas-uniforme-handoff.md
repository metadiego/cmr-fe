# Handoff FE — Facturación de CONSULTAS: lista + acciones + devolución (uniforme con General)

**BE listo (#110 + ya existente). Casi todo se REUSA con `contexto=consulta` — NO son endpoints nuevos.**
Pilar: **Facturación General ≠ Consultas — NO MEZCLAR** (siempre filtrar por contexto).

## 1. Lista de facturas de consulta (misma que general)
`GET /api/v1/facturas?contexto=consulta` (o `GET /facturas/tablero?contexto=consulta` con nombres resueltos).
Mismos filtros (estado, desde/hasta, q, productoId) y paginación. Reusa el MISMO componente de tabla que
la lista general, solo cambia `contexto=consulta`.

## 2. Acciones por factura (idénticas a general)
Mismos endpoints (agnósticos al contexto):
Ver `GET /facturas/:id` · Imprimir (payload de getById) · Editar `PUT /facturas/:id/cabecera` ·
Anular `POST /facturas/:id/anular` · Email `POST /facturas/:id/email` · Devolver `POST /facturas/:id/devolver`.
Guía de timing: `GET /facturas/:id/politica-devolucion` (anular mismo día / devolver después, no bloqueante).

## 3. Devolución de consulta (mismos componentes, más simple)
Mismo `POST /facturas/:id/devolver` (política como_facturada|precio_base, cantidad/precioDevuelto por ítem,
componentes[] si hubiera kit). Las consultas suelen ser 1 línea simple → el modal sale trivial, pero
reusa el MISMO componente para uniformidad. **Anular devolución** (deja todo como estaba):
`POST /facturas/:id/devoluciones/:devolucionId/anular`. Múltiples devoluciones por factura: soportado.

## 4. Lista de devoluciones de consulta (NUEVO filtro, #110)
`GET /api/v1/facturacion/devoluciones?contexto=consulta` (+ estado/desde/hasta/q, paginado). Reusa la
MISMA tabla de devoluciones que general, con `contexto=consulta`. (General usa `contexto=general`.)

## Resumen para el FE
Reusar los componentes de General (lista de facturas, barra de acciones, modal de devolución, lista de
devoluciones) pasando `contexto=consulta`. No hay lógica nueva — solo el parámetro de contexto en 2 listas.
