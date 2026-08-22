# FE — Planificación de compras: el backend ya está listo

Responde a `pedidos-planificacion-compras-handoff-be.md`. Desplegado y verificado en producción.

## Las tres preguntas que hiciste

1. **Las columnas derivadas las calcula el BACKEND.** Es regla de negocio: tiene que dar el mismo
   número en la tabla, en la puerta de agentes y en el papel del proveedor. Recibes `promedio`,
   `total`, `meses`, `pedir`, `nuevoPedido` y `pedidoRedondeado` ya resueltos. **No los recalcules.**
2. **No hacía falta un equivalente de VIEW_PO**: la venta se deriva del libro de movimientos —salidas
   por venta, aplicación y apertura de vial, menos devoluciones—. Los ajustes y las transferencias
   entre centros no cuentan: mover una caja de Bayamón a Caguas no es demanda.
3. **Las órdenes ya existían** (`ordenes_compra`). Les faltaba el número ante el proveedor: columna
   nueva, ya migrada.

## El endpoint

```
GET /api/v1/inventario/ordenes-compra/planificacion?meses=3&criterio1=2.5&criterio2=2&desde=
```

```jsonc
{
  "parametros": { "meses": 3, "criterio1": 2.5, "criterio2": 2 },
  "centros":    [{ "clinicId": "…", "nombre": "CMR Caguas" }, { "clinicId": "…", "nombre": "CMR Bayamon" }],
  "posAbiertas":[{ "id": "…", "numero": "263", "estado": "borrador" }],
  "productos": [{
    "productoId": "…", "sku": "tirzpatide", "nombre": "…",
    "existencias": { "<clinicId>": 12, "<clinicId>": 13 },   // una clave por centro
    "poCantidades": { "<poId>": 0 },                          // una clave por orden abierta
    "ventasDelPeriodo": 58.5,
    "promedio": 20, "total": 25, "meses": 1.25,
    "pedir": 2, "nuevoPedido": 40, "pedidoRedondeado": 100,
    "invTotal": 25, "enPo": 0
  }]
}
```

- **Las columnas de centro salen de `centros`**, no las escribas a mano: se están abriendo centros
  nuevos y la tabla tiene que crecer sola. Igual con `posAbiertas` para las columnas de PO.
- `desde` ancla la ventana de ventas a otra fecha (el «a partir de otra fecha» del legado).
- Los tres parámetros salen de la configuración; los de la consulta la sobrescriben solo para esa
  llamada, para poder simular sin guardar.
- **Permiso: `compras.planificar`** (no `inventario.read`). Es propio de gerencia porque la vista
  enseña el consolidado de todos los centros; ya lo tienen `admin`, `gerente` e `inventarios`.

## Las celdas editables

```
PUT /api/v1/inventario/ordenes-compra/:id/items    { productoId, cantidad }
PUT /api/v1/inventario/ordenes-compra/:id/numero   { numero }
```

- Cantidad **0 quita la línea**: así se deshace lo tecleado de más sin dejar un renglón en cero en el
  documento que ve el proveedor.
- Las dos se niegan si la orden ya está `recibida` o `cancelada`.
- Mismo permiso `compras.planificar`.

## Verificado en producción hoy

53 productos (solo los que se compran de verdad: ni kits ni servicios), los dos centros consolidados,
y por ejemplo la tirzepatida con 25 en inventario y 58.5 vendidas → promedio 20, cobertura 1.25 meses,
pedir 2, redondeado **100**.

## Dos cosas que faltan a propósito, para decidirlas juntos

1. **El conmutador «Productos / Intravenoso»** del legado filtra por su columna `typeclass`
   (`'xo'`, `'f1'`…). Nuestro catálogo no tiene ese campo y mapearlo a ojo sería adivinar: dime con
   qué clasificación nuestra se corresponde y lo añado como filtro del endpoint.
2. **Convertir la recomendación en orden** («Ok P.O de pedido» / «P.O Manual»). Hoy hay que crear la
   orden con `POST /inventario/ordenes-compra` indicando proveedor y almacén. Si quieres el botón de
   un clic, hace falta decidir qué proveedor y qué almacén se asumen — y prefiero no asumirlos yo.
