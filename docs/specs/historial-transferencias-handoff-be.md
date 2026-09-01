# FE — La pantalla de Transferencias necesita el HISTORIAL

Hoy la pantalla solo pide los pendientes, así que en cuanto una transferencia se acepta desaparece y
la lista queda en «Sin transferencias pendientes». No hay forma de responder «¿cuándo mandamos esas
cápsulas a Caguas y quién las recibió?».

## El endpoint (ya desplegado)

```
GET /api/v1/inventario/transferencias?estado=&direccion=
```

Devuelve las transferencias en las que el centro es parte —**las que envió y las que recibió**—, de la
más reciente a la más vieja (tope 200), con los dos nombres ya resueltos:

```jsonc
[{ "id":"…", "createdAt":"…", "estado":"recibida",
   "origenNombre":"CMR Bayamon", "destinoNombre":"CMR Caguas",
   "motivo":"…", "recibidaEn":"…", "recibidoPor":"…" }]
```

- `estado` (opcional): `pendiente`, `recibida`, `rechazada`…
- `direccion` (opcional): `enviadas` (este centro es el origen) o `recibidas` (es el destino). Sin
  él, las dos.
- Permiso `inventario.read`.

`GET …/transferencias/pendientes` se queda como está: es la bandeja de trabajo.

## La pantalla

Sugerencia: mantener arriba lo pendiente (que es lo accionable) y debajo el historial con filtros de
estado y dirección — «Enviadas / Recibidas / Todas». Cada fila abre el detalle que ya existe, que
desde hoy también trae el nombre del producto por línea. Aprovecha el ancho: la tabla se lleva la
pantalla, los filtros en una barra.
