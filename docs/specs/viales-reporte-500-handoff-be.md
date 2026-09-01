# Handoff BE — `GET /inventario/viales-abiertos/reporte` devuelve 500 (rompe la pantalla de Viales)

> FE → BE. Fecha: 2026-08-22. Bloqueante: la pantalla `/inventario/viales` no muestra nada.

## Síntoma
La pantalla de Seguimiento de viales muestra «DATABASE_ERROR · A database error occurred» al elegir
el único producto de vial (BPC-157). El FE solo pinta lo que llega; el error es del endpoint.

## Reproducción (verificado por HTTP, prod, Bayamón, 2026-08-22)
```
GET /api/v1/inventario/viales-abiertos/reporte?productoId=85ed9774-af55-456b-9a03-bf2bb8d6981d
X-Tenant-ID: ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1
→ HTTP 500
{"error":{"code":"DATABASE_ERROR","message":"A database error occurred"},
 "meta":{"requestId":"00761436-8ab3-4a12-85c0-80474b8d4d7f", ...}}
```
Falla con SOLO `productoId` (sin almacén ni fechas) y también con `?desde&hasta`. `requestId` incluido
para rastrear en los logs del BE.

## Pedido
Revisar la query del reporte de viales-abiertos (posible join/columna/tipo que rompe en producción).
Que devuelva 200 con `{ cerrados, activo, historicos, consumos[] }` aunque no haya consumos (lista
vacía), como el resto de reportes. Sin este fix la pantalla de Viales no sirve en ningún centro.

## Relacionado
- `viales-enlazar-a-factura-handoff-be.md` (agregar `facturaId` a cada consumo) — depende de que este
  endpoint primero responda 200.
```
