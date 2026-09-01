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

---
## RESPUESTA BE (#108) — NO se necesita backfill; el caso null es un BORRADOR

Verificado en **producción**:
- **0** ítems de kit EMITIDOS sin snapshot, y **0** con mismatch → en TODAS las facturas emitidas el
  snapshot (`factura_item_componentes`) coincide exacto con la receta → **`facturaItemComponenteId` ya
  viene poblado** en `contenido[]`. (Corrí `backfill:fic` local+prod: 0 afectadas.)
- Una ULTRA emitida real: snapshot 10/10 = receta 10/10 → id poblado. La devolución por-componente
  funciona en emitidas (tu propio dogfood en `default-000008` lo confirma).
- La factura que salía con id `null` es un **BORRADOR** (la imagen decía "Borrador"; no hay factura
  emitida con total \$10,603.29 en prod). En borradores el id es `null` **por diseño** (el snapshot se
  congela al EMITIR) y **no se devuelve un borrador** (se edita o se descarta).

**Acción FE:** ninguna. Tu contrato ya es correcto: inputs por-componente habilitados cuando hay
`facturaItemComponenteId` (emitidas) y deshabilitados cuando es `null` (borradores). Solo asegúrate de
que la prueba se haga sobre una factura **EMITIDA** (no borrador). Dejé `backfill:fic` como herramienta
idempotente por si a futuro alguna emitida lo necesita.
