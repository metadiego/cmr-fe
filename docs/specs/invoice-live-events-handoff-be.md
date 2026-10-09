> **RESUELTO por el BE, 8-oct-2026 20:00 — en producción y verificado con `curl -N` sobre
> `/api/v2/tablero/stream` (Bayamón), haciendo cada acción sobre el paciente de prueba récord 111605.**
>
> No se añadió un aviso por método: un suscriptor de la base de datos (`InvoiceLiveEventsSubscriber`)
> avisa de TODA escritura de facturas, líneas, descuentos de grupo, pagos y devoluciones, también las
> que entran por MCP o scripts. Las escrituras de una misma acción se juntan ~250 ms en un evento por
> factura. En v2 llega como `{ channel, entity: "factura", id, action, status, actorId, version, ts }`:
> `action` = el estado nuevo cuando cambia (`creada`, `emitida`, `anulada`, `borrador` al reabrir,
> `descartada`, `devuelta`, `pago`), si no `actualizada`; `id` = la factura. Vale igual para General y
> Consultas.
>
> Secuencia real (crear → línea → pago → emitir → reabrir → re-emitir → anular, y crear + descartar
> otro borrador), las líneas `data:` tal como llegaron:
>
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"creada","status":{"status":"borrador","total":0},"actorId":null,"versio
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"actualizada","status":{},"actorId":null,"version":1791504076458,"ts":"2
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"actualizada","status":{"status":"borrador","total":10},"actorId":null,"
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"pago","status":{},"actorId":null,"version":1791504081171,"ts":"2026-10-
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"actualizada","status":{"status":"borrador","total":10},"actorId":null,"
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"emitida","status":{"status":"emitida","total":10},"actorId":null,"versi
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"borrador","status":{"status":"borrador","total":10},"actorId":null,"ver
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"emitida","status":{"status":"emitida","total":10},"actorId":null,"versi
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"anulada","status":{"status":"anulada","total":10},"actorId":null,"versi
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"pago","status":{},"actorId":null,"version":1791504103952,"ts":"2026-10-
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"995c2c39-1d39-48da-b4e8-66d21cad5605","action":"actualizada","status":{"status":"anulada","total":10},"actorId":null,"v
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"893e8bf1-0441-4ec0-9193-3ec4cb2ab0aa","action":"creada","status":{"status":"borrador","total":0},"actorId":null,"versio
>   data: {"channel":"ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1","entity":"factura","id":"893e8bf1-0441-4ec0-9193-3ec4cb2ab0aa","action":"descartada","status":{"status":"borrador","total":0},"actorId":null,"ve
>
> Sin verificar por HTTP: la **devolución** (`devuelta`) — cubierta por prueba unitaria, no la hice
> en producción para no tocar inventario de verdad.

# Handoff BE — Eventos en vivo de facturas: que TODO cambio de una factura avise

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-08 · **Prioridad:** media

## Qué pasó

El dueño tuvo que **recargar** Facturación general para ver lo que se acababa de facturar. El FE ya
escucha el bus único `GET /api/v2/tablero/stream` en la lista de facturas, filtrando `entity: "factura"`
y refrescando la lista y el total del rango con cada evento (desplegado; badge «En vivo»).

**Aplica por igual a las dos listas: Facturación general (`/billing/invoices`) y Facturación de
consultas (`/billing/consultations`).** Son el mismo componente (`FacturasListView`, `contexto`
general|consulta) sobre el mismo `GET /invoices/board`, así que ya escuchan los dos el mismo bus. El
evento no necesita decir de qué lista es: cada una se refresca con sus propios filtros. Lo que se pide
abajo vale para facturas de venta y de consulta sin distinción.

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
