# Mini-handoff BE — POS: facturar con LISTA DE PRECIOS (no solo regular)

> **De:** cmr-fe. **Para:** cmr-be. **Fecha:** 2026-07-14. **Bloquea** la feature de listas en el POS.
> Verificado en vivo contra prod (contrato real). Decisión del dueño: el POS general debe poder facturar con una
> **lista de precios** (regular / mayorista / "Navidad en Julio" / …), no siempre la regular.

## Estado actual (verificado)
- El POS **no envía ni usa** ninguna lista. Al agregar una línea sin `precioUnitario`, el server resuelve el
  **precio efectivo REGULAR** por el centro de la factura (`GET`/POST resuelve `fuente:"precio"` = regular).
- **No hay campo para elegir lista:**
  - `CreateFacturaDto` = `{ pacienteId, medicoId?, citaId?, medioId?, serie?, notas? }` → sin `tipoPrecioId`.
  - `AgregarItemDto` = `{ productoId, presentacionId?, cantidad?, precioUnitario?, gravado?, … }` → sin `tipoPrecioId`.
  - `FacturaEntity` → sin `tipoPrecioId`.
- Las listas SÍ existen como dato: `GET /precios/tipos` (regular, …) y `GET /precios/catalogo?tipoPrecioId=` resuelve
  por lista. Pero la **facturación** no las consume.

## Requerimiento
Poder crear/emitir una factura general aplicando una **lista de precios** elegida; el server resuelve el precio
efectivo de ESA lista (con fallback si la lista no tiene precio para un producto — definir política).

## Contrato propuesto (elegir A o B; A = más simple y suficiente)
**A) Lista a nivel de factura (recomendado):**
- Agregar `tipoPrecioId?: uuid` a `CreateFacturaDto` (la venta entera usa esa lista; default = regular).
- Exponer `tipoPrecioId` en `FacturaEntity` (para mostrar/reimprimir con qué lista se facturó).
- Al agregar línea sin `precioUnitario`, el server resuelve el efectivo **de la lista de la factura**.
- (Opcional) permitir cambiar la lista de un borrador: `PUT /facturas/:id` o `.../lista`.

**B) Lista por línea:** `tipoPrecioId?` en `AgregarItemDto`/`UpdateItemDto` (más flexible, más complejo en UI).

## Preguntas sí/no para BE
1. ¿A o B?  ___
2. Si un producto **no tiene precio en la lista elegida**, ¿fallback a regular, a base, o línea sin precio?  ___
3. ¿`FacturaEntity` devolverá `tipoPrecioId` (+ nombre) para mostrarlo?  ___

## Qué hará el FE cuando esté el contrato
- Selector de **lista de precios** en el POS general (alimentado por `GET /precios/tipos`), default regular.
- Manda `tipoPrecioId` al crear la factura; el precio "auto" de cada línea sale de esa lista.
- Muestra en la cabecera con qué lista se está facturando. i18n, RBAC, multi-tenant (X-Tenant-ID por centro).
