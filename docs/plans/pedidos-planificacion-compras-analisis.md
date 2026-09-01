# Análisis — Planificación de compras / Órdenes de compra (PO) del legado

**Estado: análisis, sin código.** Fuente auditada en disco: `cma/controllers/po_controller.php`,
`cma/vistas/pedidos/index.php`, `cma/js/script.js`. Es la pantalla que usa GERENCIA para planificar y
crear compras, con existencias de TODOS los centros y cálculos basados en la salida por ventas.

## Qué hace la pantalla (`/cma/vistas/pedidos/`)
Una tabla (`tabla-puor`) por producto, con existencias de los dos centros + las PO abiertas como
COLUMNAS dinámicas + los cálculos de planificación. La gerencia ajusta parámetros arriba y la tabla
recomienda cuánto pedir; se crean POs desde ahí.

## Columnas (izquierda → derecha)
`Producto | Inv Bay. | Inv Cag. | Inv Total | [PO 263] [PO 264] … | Promedio | Total | Meses | Pedido? | Nuevo Pedido | Pedido Red`

- **Inv Bay. / Inv Cag.** = `MInventario.Existencia` de cada centro (Caguas es el inventario remoto).
- **Inv Total** = Bay + Cag (existencia de TODOS los centros).
- **PO 263, PO 264, …** = una columna POR CADA orden de compra ABIERTA. La celda es la cantidad de ese
  producto en esa PO. Editable a doble clic (`.edit`/`.purchases`), y el propio nº de PO también es
  editable a doble clic (guarda en `clases/updateponumber.php`). La última PO va resaltada.
- **Promedio** = venta mensual promedio del producto. `round( SUM(ventas de los últimos N meses) / N )`,
  MÍNIMO 1. Ventas salen de `VIEW_PO` (facturación real = salida de inventario por ventas). Tooltip:
  desglose de ventas por centro (Caguas / Bayamón).
- **Total** = `Inv Total + Σ(cantidades en todas las PO abiertas)` (lo que hay + lo que ya viene en camino).
- **Meses** (cobertura) = `round( Total / Promedio , 2 )` → cuántos meses de venta cubre el stock+PO.
- **Pedido?** (0/1/2) — urgencia según la cobertura contra dos umbrales `criterio1`/`criterio2`:
  - `Meses < criterio2` → **2**   (pedir 2× el promedio)
  - `criterio2 ≤ Meses < criterio1` → **1**   (pedir 1× el promedio)
  - `Meses ≥ criterio1` → **0**   (no pedir)
- **Nuevo Pedido** = `Promedio × Pedido?` (0, 1× ó 2× el promedio).
- **Pedido Red** = `getRound(Nuevo Pedido)` — el REDONDEO ESPECIAL (ver abajo).

## Parámetros EDITABLES (arriba, se re-calcula al enviar)
- **Meses** (`meses`, default **3**): ventana de meses de ventas para el promedio.
- **criterio1** (default **2.5**) y **criterio2** (default **2**): umbrales de cobertura en meses.

## El REDONDEO ESPECIAL — `getRound($x)` (po_controller.php:610)
```
si x <= 0            → 0
si 0 < x < 100       → 100                 (todo pedido chico sube a 100)
si x termina en 00 ó 50 (decena 0/5 y unidad 0) → x  (se deja igual)
en otro caso         → x + (50 - (x % 50)) (sube al PRÓXIMO múltiplo de 50)
```
En una frase: **redondea SIEMPRE HACIA ARRIBA al múltiplo de 50 más cercano, con piso de 100.**
Ej.: 12→100, 120→150, 150→150, 151→200, 300→300.

## Acciones (botones)
- **Ok P.O de pedido** (`btn-newpo`): crea una PO con las cantidades recomendadas (Pedido Red).
- **Ok P.O Manual** (`btn-manualpo`): crea una PO con cantidades tecleadas a mano.
- **Imprimir** / **Exportar** (excel).

## Notas de datos / negocio
- El universo de productos sale de `MInventario` (activos, prod_serv P/h o M inventariable), agrupados
  por `cod_subgrupo` (1=Productos, 2=Fórmulas) y ordenados por `po_order`.
- «Meses» y los dos criterios son el juicio de la gerencia: bajarlos pide menos, subirlos pide más.
- Todo es un ranking de reposición: cobertura baja → pedir; el redondeo a 50/100 refleja cómo se compra
  por caja/paquete.

## Para nuestra versión (FE cmr-fe)
Misma tabla, mismos cálculos, pero data-driven desde el BE nuevo (Postgres) — el FE NO recalcula ventas
ni inventario. Ver el handoff BE `pedidos-planificacion-compras-handoff-be.md` con el contrato de datos
que necesito. Encaja con la norma «nada aislado»: enlaza inventario ↔ ventas ↔ compras ↔ centros.
