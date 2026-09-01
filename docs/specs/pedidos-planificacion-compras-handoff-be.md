# Handoff BE — datos para «Planificación de compras / PO» (la pantalla de gerencia)

> FE → BE. Fecha: 2026-08-22. Análisis completo del legado en
> `docs/plans/pedidos-planificacion-compras-analisis.md` (fórmula y redondeo exactos ahí).

## Qué es
La pantalla que usa GERENCIA para planificar y crear compras: por producto, existencias de TODOS los
centros + las PO abiertas como columnas + una recomendación de cuánto pedir, con dos parámetros que la
gerencia ajusta. Necesito que el BE sirva estos datos (API-First, multi-tenant pero con vista
CONSOLIDADA de todos los centros; RBAC de gerencia/compras). El FE solo pinta y edita; NO recalcula
ventas ni inventario.

## Endpoint sugerido
`GET /inventario/planificacion-compras?meses=3&criterio1=2.5&criterio2=2`
- `meses` (default 3): ventana de meses de ventas para el promedio.
- `criterio1` (default 2.5) / `criterio2` (default 2): umbrales de cobertura (meses).

### Respuesta (por producto, ya con existencias de TODOS los centros y ventas resueltas)
```jsonc
{
  "parametros": { "meses": 3, "criterio1": 2.5, "criterio2": 2 },
  "posAbiertas": [ { "id": "…", "numero": "263" }, { "id": "…", "numero": "264" } ],
  "productos": [
    {
      "productoId": "…", "nombre": "…", "grupo": "productos|formulas", "orden": 10,
      "existencias": { "<centroId>": 0, "<centroId>": 2 },   // por centro
      "invTotal": 2,
      "poCantidades": { "<poId>": 0, "<poId>": 0 },           // cantidad en cada PO abierta
      "ventaPorCentro": { "bayamon": 3, "caguas": 1 },        // para el tooltip
      "promedio": 1                                            // round(ventas_del_periodo/meses), min 1
    }
  ]
}
```
El BE resuelve `promedio` desde las VENTAS reales (salida por facturación) de los últimos `meses`. El
FE calcula el resto en el cliente con la fórmula del análisis (Total, Meses, Pedido?, Nuevo Pedido,
Pedido Red con el redondeo a 50/piso 100) — o, si prefieren, devuélvanlos ya calculados; confírmenlo.

## Editar cantidades de una PO (celda a doble clic)
`PUT /inventario/compras/:poId/items` body `{ productoId, cantidad }` (upsert de la línea).
Y renombrar el nº de PO: `PUT /inventario/compras/:poId` body `{ numero }` (equivale a
`updateponumber.php` del legado).

## Crear PO
- Desde la recomendación: `POST /inventario/compras` body `{ proveedorId?, items:[{productoId, cantidad}] }`
  con las cantidades = Pedido Red.
- Manual: mismo endpoint con cantidades tecleadas.

## Preguntas a zanjar (no asumir)
1. ¿El BE calcula las columnas derivadas (Meses/Pedido?/Nuevo Pedido/Pedido Red) o las deja al FE? Yo
   propongo FE (la fórmula es de negocio y cambia con los parámetros), pero necesito `promedio`,
   `invTotal`/por-centro y `poCantidades` del BE.
2. ¿«VIEW_PO» (ventas) del legado tiene equivalente en el BE nuevo? ¿Excluye devoluciones? ¿Cómo separa
   venta por centro?
3. ¿Las PO abiertas viven ya en el BE nuevo (tabla de compras) o hay que modelarlas? El legado las trae
   como columnas dinámicas por PO abierta.

Con esto armo la pantalla igual que el legado (tabla por producto, PO como columnas, celdas editables a
doble clic, parámetros arriba, botones crear/imprimir/exportar), data-driven y sin hardcode.
