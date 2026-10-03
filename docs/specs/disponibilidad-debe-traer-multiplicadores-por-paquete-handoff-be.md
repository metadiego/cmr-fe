> **RESPONDIDO por el BE, 3-oct-2026 — tu supuesto era correcto y ya está hecho.**
>
> **Confirmado el hueco:** `cambio-protocolo.service.ts` creaba los paquetes nuevos con `meta: null`
> literalmente. Así que sí: el formato de Láser habría salido sin áreas para cualquier paciente que
> hubiera pasado por un cambio de protocolo.
>
> **Hecho**, con dos reglas que salen de lo ya decidido y no de una lista de casos:
> - **Los días son las sesiones**, porque las sesiones son las visitas (lo que arreglamos esta
>   mañana). Así que `multiplicadores.dias` = `sesionesTotales` del paquete nuevo.
> - **Las áreas se heredan** del paquete que se reemplaza: es la misma venta con otra terapia y
>   nadie las volvió a cobrar.
>
> Y quien hace el cambio puede decir otras: el DTO acepta `areas` por terapia nueva
> (`POST cambio-protocolo`, y lo mismo por MCP). Si se dice, manda lo dicho.
>
> **Lo que NO se hace**: inventar `areas: 1` cuando no consta. Un servicio sin áreas (suero, EMTT)
> no tiene por qué tenerlas, y un 1 inventado se vería en el formato como si alguien lo hubiera
> escrito a mano. En ese caso el paquete trae solo `dias` y el formato debe pintar las áreas vacías,
> no un 1.
>
> Razón completa: `cmr-be/docs/specs/la-columna-declara-si-cuenta-sesiones.md`.

# Handoff BE — la disponibilidad debe traer `multiplicadores` (areas/days) en TODO paquete, también en cambio de protocolo

**Severidad: media.** El formato de Láser (HILT/MLS) ya se arma desde la **disponibilidad**, no desde la
factura. Si un paquete no trae `multiplicadores`, las áreas del formato salen vacías.

## Por qué la disponibilidad y no la factura (decisión del dueño)

> «esos datos se generan en la factura pero deben también vivir en la disponibilidad… en caso de un
> cambio de protocolo NO hay factura, hay un cambio en las disponibilidades».

El láser cobra por `días × áreas`. El formato necesita **áreas por tipo** (MLS vs HILT) y los **días**.
La factura los tiene, pero un **cambio de protocolo no genera factura** — solo mueve la disponibilidad.
Por eso la disponibilidad tiene que ser la fuente de verdad del formato.

## Lo verificado en vivo (2026-10-03, prod)

`GET /api/v2/frontdesk/servicios/:laserId/disponibilidad?patientId=…` para AGUSTINA VALLE TORRES
(record 90321, Bayamón) **ya devuelve** los dos paquetes con su desglose:

```
paquetes[0]  sku=TD01    "Terapia del dolor (1 sesión) MLS"   multiplicadores={ days:12, areas:4 }  total=12
paquetes[1]  sku=TDSP30  "TERAPIA DEL DOLOR FULL HILT"        multiplicadores={ days:12, areas:2 }  total=12
```

Para los paquetes **nacidos de factura, el BE ya está completo**: el FE cruza el paquete por
nombre/sku (contiene "mls"/"hilt") y lee `multiplicadores.areas` + `multiplicadores.days`. Ya desplegado.

## Lo que se pide al BE (confirmar / completar)

**Que `multiplicadores` (al menos `areas` y `days`) venga poblado en la disponibilidad para TODO
paquete, incluidos los creados o modificados por un CAMBIO DE PROTOCOLO** (que no pasan por factura).

- Verificado: paquetes de factura → ok.
- **Sin verificar (supuesto):** paquetes de cambio de protocolo. Si ahí `multiplicadores` llega null o
  sin `areas`, el formato de Láser saldrá sin áreas para esos pacientes. Hay que poblarlo en la misma
  ruta de disponibilidad.

## Lo que NO cambia

El precio ni `cantidadEfectivaDeLinea` (días × áreas). Esto es solo asegurar que el desglose que ya
calcula la factura **también viva en la disponibilidad**, que es de donde el formato lo toma.
