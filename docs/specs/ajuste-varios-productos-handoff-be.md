# Handoff BE — Un ajuste de inventario con uno o varios productos

Fecha: 2026-11-18 · Pedido del dueño: los usuarios se quejan de que en Inventario → Ajustes tienen que
hacer **un ajuste por cada producto**. Que un ajuste pueda llevar uno o varios productos.

## Verificado (cmr-be origin/main, cmr-fe main)

- `POST /inventory/operations/adjust` (`AjustarDto`, `operaciones.dto.ts:106`) recibe **un** producto:
  `productoId`, `almacenId`, `cantidad > 0`, `signo` (positivo | negativo), `motivo?` (del catálogo
  `motivos_movimiento`), `loteId?`, `fechaEfectiva?` y `notas` (obligatorio).
- No hay un endpoint por lote. Recibir compra sí lo tiene (`receive-purchase-lot`: un `documentoId`
  para toda la recepción, y si falla una línea no se escribe ninguna).
- En el FE el ajuste es un modal por producto, abierto desde Existencias
  (`components/inventario/ajuste-modal.tsx`).

## Por qué no se resuelve en el FE con N llamadas

Llamar N veces a `/adjust` no es atómico. Si falla la línea 4, las 3 primeras ya movieron stock y no hay
forma de deshacerlo. Además, cada línea quedaría con un documento distinto, y el dueño lee el ajuste
como **un** documento con su número («AJUSTE # 6066» en su hoja del kardex, ver
`kardex-resumen-formato-dueno-handoff-be.md`).

## Pedido

1. **`POST /inventory/operations/adjust-batch`** (y su alias en español):
   ```
   { almacenId, motivo?, fechaEfectiva?, notas, pacienteId?,
     lineas: [{ productoId, cantidad, signo, loteId?, motivo?, notas? }] }   // 1..N
   ```
   - El motivo y las notas de la cabecera valen para todas las líneas, salvo que una línea traiga los
     suyos.
   - Todo o nada, en una transacción, con **un `documentoId`** y un **número de ajuste** consecutivo por
     centro.
   - Mismas validaciones que `/adjust`. Si algo falla, el error indica la línea (`index`) y lleva su
     `labelKey`.
   - Permiso: el mismo que `/adjust`.
   - Si el ajuste es para un paciente (las «VITA C RICHARD TORRES» de la hoja), `pacienteId` es opcional.
2. **`GET /inventory/reports/adjustments?desde&hasta&centerIds`**: la lista de ajustes, uno por
   documento, con número, fecha, centro, almacén, motivo, paciente, líneas, unidades y quién lo cargó.
   Igual que `reports/receipts`.
3. **`GET /inventory/operations/adjustments/:documentoId`**: el detalle, con `product {name, sku}` por
   línea, igual que el de la recepción.
4. Swagger, MCP (`adjust_stock_batch`), comentarios en la base y tests.

## FE (cuando esté)

- Pantalla «Ajustes» en Inventario, con el mismo patrón que Recibir compra:
  - cabecera con almacén, motivo, fecha, paciente opcional y nota;
  - una tabla de líneas, agregando productos con el buscador; por línea, cantidad, entra o sale, y lote
    si hace falta;
  - un solo «Guardar».
- Pestaña «Ajustes hechos», con la misma barra Imprimir / CSV / Email y el logo.
- El modal por producto de Existencias se queda para el caso de uno solo.
