# Handoff BE — Backfill de `facturaItemComponenteId` en facturas emitidas ANTES de PR #106

## Síntoma (real, verificado en prod)
En la devolución de un PC, los **componentes internos se ven** pero sus inputs salen **deshabilitados**
("no devolvible individualmente"). Causa: el FE habilita la devolución por-componente solo si el
componente trae `facturaItemComponenteId` (contrato). En las facturas **emitidas antes de PR #106** ese id
viene **null** → no se pueden devolver componentes parcialmente.

- Ejemplo del dueño: general `default-000001` (LISANDRO, $10,603.29, ULTRA + AVACEN + RHODIOLA + I-MODULATOR),
  emitida **07/16**. Sus `item.contenido[]` traen nombre/cantidad/precio pero `facturaItemComponenteId = null`.
- Verificado que en **emitidas nuevas** (post-#106, ej. `default-000008` creada 07/17) los 10 componentes del
  ULTRA traen `facturaItemComponenteId` → el FE habilita todo y la devolución parcial por-componente funciona
  (dogfood E2E: devolví 1 de 3 de un componente → monto correcto, tipo `parcial`).

## Pedido
**Backfill** de `facturaItemComponenteId` para los componentes de las facturas **emitidas existentes**
(las de antes de #106), enlazando la receta congelada (`facturaItemComponente`) con el snapshot de
`item.contenido[]` por `facturaItemId` + `productoId` (igual criterio que usa la proyección nueva).
Tras el backfill, `GET /facturas/:id` debe devolver `facturaItemComponenteId` poblado también en las viejas.

- Si por diseño **no** es posible reconstruir el enlace de las viejas (p.ej. no hay `facturaItemComponente`
  para esas), confírmenlo y el FE lo comunica: "las facturas anteriores a la fecha X no admiten devolución
  por-componente; sí devolución de la línea completa del kit". (El FE ya permite devolver la línea completa.)

## FE — ya listo, no requiere cambios
- Componentes visibles (desplegable por PC), inputs habilitados cuando hay `facturaItemComponenteId`,
  candado para no-emitidas, neto en vivo, política precio base, anular devolución. Todo en prod.
- Solo depende del dato: en cuanto el backfill pueble el id, las facturas viejas quedan devolvibles por
  componente sin tocar el FE.
