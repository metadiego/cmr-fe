# Handoff BE — Eventos en vivo de facturas: que TODO cambio de una factura avise

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-08 · **Prioridad:** media

## Qué pasó

El dueño tuvo que **recargar** Facturación general para ver lo que se acababa de facturar. El FE ya
escucha el bus único `GET /api/v2/tablero/stream` en la lista de facturas, filtrando `entity: "factura"`
y refrescando la lista y el total del rango con cada evento (desplegado; badge «En vivo»).

## Lo que el BE emite hoy (leído en el código, `cmr-be` main del 8-oct)

- `facturacion.service.ts` → `publicarFactura(factura, 'emitida')`: **solo al emitir**.
- `pagos.service.ts` → `accion: 'pago'` al registrar un pago.

Nada más. Por eso la lista sigue sin enterarse de:

| Cambio | Lo que ve la lista sin evento |
|---|---|
| Crear un borrador (venta nueva, factura de consulta) | no aparece hasta recargar |
| Anular | sigue diciendo «emitida» |
| **Reabrir** (nuevo) | sigue «emitida» |
| Descartar un borrador | la fila sigue ahí |
| Devolución | el estado/importe no cambia |
| Editar cabecera (médico, usuario, fecha) — incluidas las celdas inline de la lista | valor viejo en otras pantallas |
| Anular/editar un pago | el «cobrada» del total del rango no cambia |

## Pedido

Llamar `publicarFactura` (o el mismo `realtime.emit` con `entidad: 'factura'`) en **cada** escritura
de una factura: `creada`, `actualizada` (cabecera/líneas/descuentos), `anulada`, `reabierta`,
`descartada`, `devuelta`, `pago` (alta, edición y anulación). El FE solo usa `entity` e `id`, así que
basta con la `accion` que mejor la nombre. Mismo canal (`clinicId`), mismo `best-effort`.

## Verificación que pide el FE

Con `curl -N` sobre `/api/v2/tablero/stream` (Bayamón), una línea `data:` copiada por cada acción de la
tabla, hecha sobre el paciente de prueba (récord 111605).
