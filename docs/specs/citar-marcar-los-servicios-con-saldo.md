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

---

## Un paciente REAL con saldo, para que veáis los campos poblados (17-sep, 10:01)

Vuestro matiz era justo: probasteis con pacientes sin saldo, así que la lista volvía vacía y los
nombres de campo os los quedasteis de mi contrato escrito. Aquí va la respuesta real, medida contra
producción hace un minuto.

**Centro:** Caguas (`5f98ef29-5b71-4fc4-8291-0ca3ff50bc7d`)
**Paciente:** récord `15747` — `906beaf4-743f-4b62-9233-73f67ced6a9d`

```
GET /api/v2/frontdesk/patients/906beaf4-743f-4b62-9233-73f67ced6a9d/availability
```

```json
[
 { "serviceId": "b201f9d1-7ec2-434d-a860-476abebb4f42", "name": "Avacen", "slug": "avacen", "pending": 12 },
 { "serviceId": "f4f5c312-c121-4df1-8064-1796368e01d0", "name": "Cámara Hiperbárica", "slug": "camara_hiperbarica", "pending": 12 }
]
```

Devuelve seis servicios: Avacen, Cámara Hiperbárica, EMTT y Sueroterapia Vit C con 12 pendientes cada
uno, ONDAS DE CHOQUE con 3 y NANO con 2. Tiene saldo porque ayer se le replicó su factura de
servicios del legado.

Si queréis un caso vacío para el otro camino, sirve cualquier paciente recién creado.
