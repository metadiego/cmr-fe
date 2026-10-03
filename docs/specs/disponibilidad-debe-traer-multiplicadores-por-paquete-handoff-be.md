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
