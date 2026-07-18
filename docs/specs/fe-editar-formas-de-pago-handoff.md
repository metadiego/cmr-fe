# Handoff FE — Editar formas de pago (factura) y reembolso (devolución) — Ver ≠ Editar

**BE listo (#112). NO son endpoints nuevos — el mecanismo ya existía; ahora la proyección da todo.**
Regla: **Ver y Editar son 2 pantallas/modos distintos** (evitar errores). Nada de caja negra.

## Datos: TODAS las formas usadas (para Ver y para Editar)
`GET /api/v1/facturas/:id` → `pagos[]` (o `GET /facturas/:id/pagos`) — pagos ACTIVOS:
```jsonc
[{ "id": "<pagoId>", "formaPagoId": "...", "formaPagoNombre": "Tarjeta",
   "monto": 100, "tipo": "pago", "referencia": "1234", "devolucionId": null },
 { "id": "<pagoId>", "formaPagoNombre": "Cheque", "monto": 30,
   "tipo": "reembolso", "devolucionId": "<devId>" }]
```
- `tipo`: `pago` (abono de la factura) | `reembolso` (de una devolución; `devolucionId` la liga).
- Catálogo de formas para el selector: `GET /api/v1/facturacion/formas-pago` (incluye Cheque, esEfectivo).

## VER (solo lectura)
Lista clara: cada forma usada con su monto y tipo (Pago / Reembolso). Sin inputs. Total abonado / saldo.

## EDITAR (modo aparte, explícito)
Por cada pago, permitir **cambiar la forma** (y monto) fácilmente:
`PUT /api/v1/facturas/:id/pagos/:pagoId` `{ formaPagoId, monto?, motivo }` (RBAC `factura.pago.anular`).
- Es una **corrección append-only**: anula el pago viejo y crea el corregido (enlazado), recomputa la
  factura. Auditable, nada se borra. Funciona en facturas EMITIDAS.
- **Reembolso de una devolución:** es un pago `tipo:reembolso` → **el MISMO** `PUT …/pagos/:pagoId`
  cambia su forma (preserva el tipo). Así se edita el método de reembolso si se equivocaron.
- Anular un pago mal capturado (sin reemplazo): `DELETE /facturas/:id/pagos/:pagoId { motivo }`.
- Agregar un pago faltante: `POST /facturas/:id/pagos` (o `/pagos/multiple`).

## Nota clave
El método de reembolso NO tiene que ser igual al de la venta (pagó tarjeta → reembolsa cheque) — se
elige libremente del catálogo. Ver y Editar deben ser claramente distintos para no confundir.

## Aceptación
- Ver muestra todas las formas (pagos + reembolsos) sin poder tocarlas.
- Editar permite cambiar la forma de cada pago/reembolso en 1-2 clics; el cambio se refleja y recomputa.
