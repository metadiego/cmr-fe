# Handoff FE — Kits flexibles: componentes OPCIONALES + impresión compacta

> **De:** BE (cmr-be). **En prod (PR #84).** Cero huecos de BE. Reemplaza el hack de "2 kits (FULL/BASE)".

## Qué se resuelve
1. **Componente opcional**: un kit puede tener componentes que el cajero **incluye/excluye** en la venta;
   el **total se ajusta solo** (ej. Protocolo Rodilla $4,000 base + Infiltración opcional +$3,000 → $7,000).
2. **Impresión del kit**: cada kit decide si el recibo muestra el **desglose** de componentes o solo el kit
   (**compacto**), útil para no exponer PRP/Wharton/exosomas de una infiltración.

## Config del kit (en el CRUD de producto/inventario — admin)
- Componentes del kit (misma UI de receta ya existente, `/inventario/componentes`), con campos nuevos:
  - **`opcional`** (bool): el componente se puede incluir/excluir por línea.
  - **`precioIncremental`** (número): cuánto SUMA al total del kit si el opcional se incluye.
  - **`incluidoPorDefecto`** (bool): si arranca marcado.
- En el producto (kit): **`imprimeComponentes`** (bool). `true` = recibo detallado; `false` = **compacto**.
  Toggle en el editor de producto. (MCP: `set_impresion_kit`.)

## En el POS (facturación) — modal de toggle (tu imagen 2)
Cuando una línea es un kit con opcionales:
1. Al agregar el kit (`POST /facturas/:id/items { productoId, cantidad }`) el BE ya calcula el
   `precioUnitario` = base + Σ opcionales `incluidoPorDefecto`, y sella `item.opcionalesIncluidos`.
2. Abrir el modal → **`GET /facturas/:id/items/:itemId/opcionales`** →
   `[{ componenteId, nombre, cantidad, precioIncremental, incluido }]`. Pinta cada opcional con su checkbox
   (`incluido`) y su `precioIncremental`.
3. Al guardar el modal → **`PUT /facturas/:id/items/:itemId/opcionales { incluidos: [componenteId...] }`**
   (los que quedan marcados). El BE **re-precifica** la línea (base + Σ incluidos) y **recomputa los totales**;
   la respuesta es la **factura proyectada** (con el `total` en vivo). El FE solo re-pinta.
- El total se ajusta solo — **no** hay que crear dos kits ni calcular en el FE.

## En el recibo / detalle
- `GET /facturas/:id` devuelve:
  - Cada línea (`items[]`) con **`imprimeComponentes`** (bool) y **`opcionalesIncluidos`** (ids).
  - `componentes[]` (snapshot congelado, solo facturas EMITIDAS) agrupado por `facturaItemId`.
- Regla de impresión por línea:
  - `imprimeComponentes = true` → mostrar el kit y, indentados, sus componentes (nombre/cant/precio).
  - `imprimeComponentes = false` → **compacto**: mostrar SOLO el kit (nombre/cant/precio), sin componentes.

## Contrato / notas
- Los opcionales **excluidos** no se facturan, no descargan inventario ni se congelan; los **incluidos** sí.
- El FE no calcula precios: manda la selección, el BE devuelve el total.
- RBAC: componentes/producto = admin; toggle en factura = mismos roles del POS.
- i18n: rotula "Opcional", "Incluir", "Detalle/Compacto" por `labelKey`.
- UI moderna: buscar patrón "line-item add-ons / configurable bundle" (POS/checkout) — modal con checkboxes,
  precio incremental a la derecha, total sticky que actualiza en vivo.
- MCP equivalente (agentes): `agregar_componente_producto` (con opcional/precioIncremental/incluidoPorDefecto),
  `set_impresion_kit`, `set_opcionales_item`.

## Ejemplo (Protocolo Rodilla)
- UN kit "Protocolo Rodilla" base $4,000; componente **Infiltración** `opcional=true`,
  `precioIncremental=3000`, `incluidoPorDefecto=false`, y el sub-kit Infiltración con `imprimeComponentes=false`.
- POS: sin tocar → $4,000; tildar Infiltración → $7,000. Adiós a FULL/BASE duplicados.
