# HANDOFF BE — Historial de movimientos por producto (Entró / Salió) para la pantalla de Existencias

**Descubierto probando en el navegador (11-ago):** el dueño abrió Existencias, vio un negativo y esperaba
poder tocar el producto y ver **qué entró y qué salió** para entender el número. Hoy no se puede: ningún
endpoint expone el libro de movimientos. El FE ya dejó el clic→detalle funcionando con lo que SÍ existe
(`/inventario/stock/detalle`: desglose por almacén/lote y estado — físico, reservado, comprometido, dañado,
disponible), y el modal avisa en una frase que el historial "llega pronto". Este handoff pide ese historial.

## Qué falta

La existencia es `Σ(cantidad × signo del tipo)` sobre un libro de movimientos **inmutable** que el BE ya
tiene (lo confirma `stock.controller.ts`). Lo que no hay es un endpoint que **liste esos movimientos** de un
producto para explicarle a un humano por qué el saldo es el que es.

## Endpoint propuesto

```
GET /api/v1/inventario/stock/movimientos?productoId=&almacenId=&desde=&hasta=&page=&limit=
```

Tenant-scoped (X-Tenant-ID = centro), permiso `inventario.read` (el mismo que ya abre Existencias). Envuelto
como el resto (`{data, meta.pagination}`). Orden **cronológico inverso** (lo último arriba: es lo que se
mira primero al investigar un negativo).

Cada fila, en cristiano (el FE mostrará "Entró"/"Salió", números grandes a la derecha, sin jerga):

| campo | tipo | para qué |
|---|---|---|
| `id` | uuid | identidad de la línea |
| `fecha` | ISO | cuándo ocurrió (hora PR) |
| `signo` | `1` \| `-1` | entró (+) o salió (−) — el FE pinta la palabra y el color |
| `cantidad` | número | magnitud del movimiento (positiva siempre; el signo va aparte) |
| `saldoDespues` | número | existencia resultante tras este movimiento (deja ver dónde se volvió negativo) |
| `tipo` | enum | motivo en clave estable (ver abajo) |
| `tipoLabel` | string i18n-able | etiqueta legible ("Venta", "Aplicación", "Recepción", "Ajuste", "Transferencia", "Devolución/Anulación") |
| `almacenId` / `almacenNombre` | | dónde |
| `loteId` / `numeroLote` | | qué lote |
| `referencia` | `{ tipo, id, folio? }` | documento que lo originó (factura, sesión de frontdesk, recepción, transferencia, ajuste) para poder saltar a él |
| `usuario` | `{ id, nombre }` | quién lo hizo (auditoría) |
| `nota` | string \| null | comentario del ajuste, si lo hubo |

Enum `tipo` sugerido (clave estable en inglés, como conviene el FE): `sale`, `application`, `reception`,
`adjustment`, `transfer_in`, `transfer_out`, `return`, `void`. Ajusta a los tipos reales del ledger; lo
importante es que sea **estable** y que `tipoLabel` venga resuelto para no hardcodear el diccionario en el FE.

## Cómo lo cablea el FE al recibirlo

- `lib/api/stock.ts`: `getStockMovimientos(productoId, params, centro)` (misma forma que `getStockDetalle`).
- El modal de Existencias ya existe: se le añade una segunda sección "Movimientos" con la tabla
  Fecha · Movimiento (Entró/Salió) · Cantidad · Saldo · Documento, y se retira el aviso "llega pronto".
- Filtro por rango `desde`/`hasta` reutilizando el `asOf` que ya maneja la pantalla.

## Por qué importa

Es la prueba del inventario que pidió el dueño: ver que **una venta descuenta**, que **una sesión de
frontdesk descuenta** (incluso por dosis al abrir un vial) y que **una anulación devuelve** — pero sobre
todo, poder mirar un negativo y entender de dónde salió sin creerle a ciegas a la base de datos.

## Contexto

- Controlador existente: `cmr-be/src/modules/inventario/stock.controller.ts` (`/`, `/resumen`,
  `/consolidado`, `/detalle`, `/producto/:id`). Este handoff añade `/movimientos`.
- La existencia nunca se guarda: se recalcula del ledger. Este endpoint solo **lee y pagina** ese ledger.
- Tras desplegar: `npm run gen:api` en el FE para el cliente tipado, y comentarios en DB/campos (norma).
