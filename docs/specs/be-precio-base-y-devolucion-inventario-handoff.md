# Handoff BE — Precio base por producto (flag + edición) + reintegro de inventario en devoluciones

El FE ya tiene la devolución a pantalla completa con: política `como_facturada | precio_base`, devolver
todo o parte (por producto y por componente de kit, total/parcial), precio editable por línea y por
componente, disponibilidad por paciente/factura, neto en vivo (verde=reembolso / rojo=el paciente debe) y
guía de timing (anular mismo día / devolver después, no bloqueante). Faltan **2 cosas del BE** para cerrar:

## 1. "Precio base" como atributo del producto (marcable en 1 click) + edición
**Problema:** la política de devolución `precio_base` ya funciona y `GET /facturas/precio-base?productoId=`
devuelve un valor, pero **no hay forma de configurar desde la UI** qué productos usan precio base ni de
editar ese precio. `ProductoEntity`/`CreateProductoDto`/`UpdateProductoDto` **no tienen** campo de precio
base ni flag.

**Pedido:**
- **Flag por producto** `aplicaPrecioBaseDevolucion: boolean` (nombre a definir por BE) en
  `ProductoEntity` + Create/Update DTO, para marcar (en 1 click, toggle en el CRUD de producto) qué
  productos devuelven a **precio base** (láser, Vitamina C, GLP-1, y en general los de precio variable
  por cantidad). Con COMMENT en DB/Field.
- Confirmar de **dónde sale el `precioBase`**:
  - Si es el **precio de la lista regular** → basta el flag (el FE ya edita precios en `/precios`); indíquenlo.
  - Si es un **campo aparte** → exponerlo editable (`precioBase: number` en el producto o en precios) para
    poder fijarlo/editarlo en la UI.
- El FE agregará el toggle "Devuelve a precio base" en el editor de producto (junto a Gravado/IVU) y, si
  aplica, el campo de valor.

**Por qué (ejemplo del dueño):** paquete de **12 láser**, precio base **$150** c/u, pero en el paquete cada
uno salió a **$80** (pagó 12×80 = $960). El paciente se dio **2** sesiones, le quedan **10**. Devolución con
política **precio base** → lo consumido (2) se valora a $150 = $300; reembolso = $960 − $300 = **$660**… y en
otros casos el neto es **negativo** (el paciente debe) y decide seguir, no asistir, o pagar el resto. El FE
ya muestra ese neto 🟢/🔴; solo falta poder **marcar** el producto y tener el **precio base** editable.

## 2. Reintegro de inventario al devolver (venta / entrega inmediata)
**Pedido/confirmación:** que `POST /facturas/:id/devolver` **reintegre el stock** de los componentes/productos
que sean de **venta y entrega inmediata** (modoDescarga `a_la_venta`) al aprobarse la devolución, y que
actualice la **disponibilidad del paciente para esa factura** (ya se ve reflejada en
`cantidadDevuelta`/`sesionesDevueltas`). Los de `a_la_entrega` solo devuelven lo **no entregado** (ya
soportado). Confirmar si el reintegro ya ocurre o hay que implementarlo — el FE no toca stock.

## Ya soportado (no tocar, solo referencia)
Política full/precio_base, `items[].{cantidad|sesiones|precioDevuelto}`,
`items[].componentes[]{facturaItemComponenteId, cantidad, precioDevuelto}` (poblado en emitidas),
`GET /facturas/:id/politica-devolucion` (timing), múltiples devoluciones append-only, anular ≠ devolver.

Detalle FE: `docs/specs/fe-devoluciones-lista-y-acciones-handoff.md`.
