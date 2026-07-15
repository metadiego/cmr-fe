# Handoff FE — Insumos estimados de consumo (recetas de servicio/compuesto + reporte)

> **De:** BE (cmr-be). **En prod (PR #81).** Cero huecos de BE. Todos los endpoints existen y verificados.

## Concepto
Un **servicio** o **producto compuesto** puede consumir **insumos** (cánula, catéter, sueros base…). El
negocio registra la **cantidad estimada** por unidad — **no bloqueante**: se registra y reporta, pero **NO**
descarga inventario ni bloquea la venta, y **NO** aparece en el catálogo de facturación (esos insumos ya
son `facturableGeneral=false`). Sirve para el **reporte de consumo por terapia**.

## 1) Editor de receta de insumos (en el CRUD de producto: servicio o compuesto)
Reusar el mismo patrón de "componentes/receta" ya existente; agregar el toggle **`estimado`**.
- Listar: `GET /inventario/componentes?productoCompuestoId=<id>` → cada fila trae `estimado` (bool).
- Agregar: `POST /inventario/componentes`
  `{ productoCompuestoId, componenteId, cantidad, unidadId?, presentacionId?, estimado? }`
  - **Servicio**: solo admite `estimado:true` (400 si no). **Compuesto**: `estimado:false` = descarga real
    (receta), `estimado:true` = insumo de consumo extra.
- Editar/quitar: `PUT /inventario/componentes/:id { cantidad?, unidadId?, presentacionId?, estimado?, activo? }`
  · `DELETE /inventario/componentes/:id`.
- RBAC: admin/super_admin. i18n por `labelKey` en los rótulos del editor.
- `cantidad` es DECIMAL (dosis/receta). El insumo estimado **no** se ve en el POS de facturación.

## 2) Pantalla de Reporte de Consumo de Insumos
`GET /facturacion/reportes/consumo-insumos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estimado=true|false|all`
(default `estimado=true`). RBAC admin/super_admin/gerente. Multi-tenant (X-Tenant-ID = centro).
Respuesta (ordenada por cantidad desc):
```json
[{ "insumoId": "...", "insumo": "CANULA", "cantidad": 42, "facturas": 30,
   "porTerapia": [{ "terapiaId": "...", "terapia": "LASER", "cantidad": 42 }] }]
```
- Sale del **snapshot congelado** de facturas emitidas del período/centro → refleja el consumo real.
- Layout sugerido (buscar POS/analytics moderno): filtros de rango + selector estimado, tabla de insumos
  con total y expand por terapia, export/print (usa el módulo de export transversal ya existente).

## Contrato / notas
- Nada bloquea la venta por estos insumos (aunque no haya stock).
- Hoy la mayoría de servicios aún no tienen receta de insumos cargada → el reporte saldrá vacío hasta que
  el negocio configure las recetas por el editor (1). Eso es dato, no bug.
- MCP equivalente (para agentes): `agregar_componente_producto`, `reportes_ventas` tipo `consumo_insumos`.

## Fuera de alcance
- Costeo del consumo (solo cantidad por ahora).
