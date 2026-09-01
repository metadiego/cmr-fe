# Handoff FE — Transferencias entre centros con recepción/aprobación PARCIAL

> **De:** BE (cmr-be). **Para:** cmr-fe. **Fecha:** 2026-07-13.
> **BE 100% en prod** (PR #61), ambos centros. Todos los endpoints existen y están verificados. Falta el FE.
> Reglas transversales: `response.data`+`meta.pagination`; `Bearer`+`X-Tenant-ID`; whitelist estricto (param no
> documentado = 400); i18n `labelKey`; estados loading/vacío/error; `can()` por permiso; **NO duplicar** (reusar
> `lib/api/*` y componentes existentes; extraer a compartido si hace falta).

## Qué es
Mover stock de un centro a otro. El **origen baja al enviar**; el **destino NO sube hasta que su personal
aprueba** la recepción — **total o PARCIAL por producto**. El remanente no recibido se reconcilia
(vuelve al origen, o se da de baja como merma). Es la mejora clave sobre el sistema viejo.

## Contrato BE (real)
Base `/api/v1/inventario/transferencias`.
- **Crear** `POST /inventario/transferencias`
  body: `{ clinicOrigenId, clinicDestinoId, almacenOrigenId, almacenDestinoId,
  items:[{ productoId, loteId?, cantidad }], requiereRecepcion?=true, motivo?, notas? }`.
  Perm `inventario.transferir`. Crea la salida en origen y deja `pendiente` (+ alerta al destino y al origen).
- **Pendientes** `GET /inventario/transferencias/pendientes` → las del centro activo (origen o destino).
- **Detalle** `GET /inventario/transferencias/:id` → `{ transferencia, items }`. Cada item trae
  `cantidad` (enviada) y `cantidadRecibida` (null hasta recibir).
- **Recibir/Aprobar** `POST /inventario/transferencias/:id/recibir`
  body: `{ actorId?, items?:[{ itemId, cantidadRecibida }], politicaRemanente?: 'devolver_origen'|'merma' }`.
  - `items` **omitido** = recepción TOTAL. Con `items` = aprobación **parcial** (0 ≤ recibida ≤ enviada por línea).
  - `politicaRemanente` default `devolver_origen`. Perm `inventario.recibir`.
- **Rechazar** `POST /inventario/transferencias/:id/rechazar` body: `{ motivo, actorId? }` (revierte todo al origen).
- **MCP** equivalente: `crear_transferencia_inv`, `list_transferencias_pendientes`, `recibir_transferencia`, `rechazar_transferencia`.

**Estados:** `pendiente` → `recibida` (todo) | `recibida_parcial` (algo; remanente reconciliado) | `rechazada` (nada) | `cancelada`.

**Regla de personal calificado (IMPORTANTE para la UI):** **solo el centro DESTINO** puede recibir/aprobar.
Si el centro activo ≠ destino → el BE responde **403**. El FE debe **mostrar el botón "Recibir/Aprobar" solo cuando
`centroActivo === transferencia.clinicDestinoId`** (o admin); al origen muéstrale estado read-only ("enviada, en espera de recepción").

## Pantallas (buscar el layout moderno antes de construir)
1. **Lista de transferencias** (con filtro pendientes / por estado). Chips de estado; badge "por recibir" en las
   dirigidas a tu centro. Patrón: tabla + filtros (estilo listados de órdenes).
2. **Crear transferencia** — cabecera (origen/destino/almacenes/motivo) + líneas (buscar producto → lote? → cantidad).
   Patrón: "transfer order" (Cin7/inFlow): línea editable inline, totales.
3. **Recibir / Aprobar (la nueva, clave)** — patrón **"receive stock" con aprobación parcial**: por línea muestra
   **Enviado | Recibido (input, default=enviado, máx=enviado) | Remanente (auto)**; selector global de
   **política de remanente** (Devolver al origen / Merma); botón **Aprobar recepción**. Al enviar arma
   `items:[{itemId,cantidadRecibida}]`. Estados de error por línea (recibida > enviada). Confirmación.
   Referencias UI: inFlow/Cin7 "Receive", Katana receipts.

## Alertas (ya integradas en BE)
Al crear una transferencia el BE genera alertas persistentes: al **destino** una accionable ("Transferencia por
recibir") y al **origen** una informativa. El FE ya tiene la campana de alertas (SSE `/alertas/stream`); la alerta
del destino debe **enlazar a la pantalla de Recibir/Aprobar** de esa transferencia (metadata trae `transferenciaId`).
Al recibir/rechazar, el BE **resuelve** la alerta solo.

## No duplicar
Reusar `producto-picker`, selectores de almacén/proveedor y patrones de línea ya existentes en inventario. La
pantalla de "Recibir/Aprobar" es nueva (no existe equivalente); las de crear/listar pueden reusar componentes de listas.

## Nota
Si un endpoint no devuelve algo que la pantalla necesita, no improvises: mini-handoff al BE (requerimiento, evidencia, gap, contrato, sí/no).
