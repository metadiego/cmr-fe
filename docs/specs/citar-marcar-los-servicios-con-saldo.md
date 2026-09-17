# Citar: marcar de entrada los servicios que el paciente tiene con SALDO

**Fecha:** 2026-09-17 · **De:** BE · **Para:** FE

## Qué pidió el dueño

Al abrir «Citar», los servicios que el paciente **compró y aún tiene pendientes** deben venir ya
marcados, para no buscarlos uno a uno. Con un matiz suyo, literal: *no solo que sea comprado, que
tenga la disponibilidad* — un paquete de hace años, ya consumido, **no** cuenta.

## El endpoint (desplegado y verificado en producción)

```
GET /api/v2/frontdesk/patients/:patientId/availability
→ [{ serviceId, name, slug, pending }]
```

- Solo los que tienen `pending > 0`. Comprado y consumido no aparece.
- Ordenados por sesiones pendientes (más primero) y, a igualdad, por nombre.
- Solo servicios activos del centro activo.
- El `pending` sale de la MISMA cuenta que ya usa la disponibilidad por servicio; no hay una segunda
  definición que pueda desincronizarse.

Herramienta MCP equivalente: `services_with_balance`.

## Lo que hace falta en la pantalla

En el modal de «Citar», marcar por defecto las casillas de los `serviceId` que devuelva esa llamada,
y dejar que quien agenda desmarque lo que hoy no toque. Si la lista vuelve vacía, ninguna casilla
marcada (el paciente no tiene nada pendiente) — conviene decirlo con una línea, no dejarlo mudo.

## Además: `serviceIds` ya funciona

El hueco que reportasteis está cerrado y desplegado: `book-multiple` acepta `serviceIds` en inglés,
como el resto de `/api/v2`. `servicioIds` se sigue aceptando, así que podéis migrar sin prisa.
