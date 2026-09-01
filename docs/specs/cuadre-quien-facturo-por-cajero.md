# El cuadre tiene que decir QUIÉN facturó

> Handoff **BE → FE**. Fecha: 2026-08-20. El BE está construido, probado y desplegado.
> Spec del BE: `cmr-be/docs/specs/cuadre-por-cajero-en-el-totalizado.md`.

## Por qué

Palabras del dueño, durante la réplica de la jornada real:

> «¿Qué pasa si en un día hay varios facturadores en consulta o varios en la facturación general? Se
> puede filtrar por usuario para ver qué hizo cada uno, y además verlo todo totalizado, donde englobe
> todos los facturadores. Eso es importante para determinar, si un día hay un problema, quién fue.»

## Lo que cambió en el BE

`GET /caja/reportes/dia?fecha=YYYY-MM-DD[&division=consulta|general][&usuarioId=…]` ahora devuelve
**siempre** el campo `porCajero`. Antes solo venía cuando se pedía una división, así que en la vista
totalizada —la que abre el gerente— no aparecía.

```jsonc
{
  "fecha": "2026-08-20",
  "division": null,               // null = las dos divisiones juntas
  "usuarioId": null,
  "porCajero": [                  // ← SIEMPRE presente
    { "usuarioId": "…", "nombre": "Ana Ruiz",  "total": 700 },
    { "usuarioId": "…", "nombre": "Luis Pérez", "total": 500 }
  ],
  "porMetodo": { "efectivo": 1200 },
  "detalle": { "total": 1200, "efectivo": { "cantidad": 3, "monto": 1200 }, "tarjetas": [ … ] },
  "conteoEfectivo": null,
  "documentos": [ … ]
}
```

Qué devuelve `porCajero` según la llamada:

| llamada | contenido |
|---|---|
| `?fecha=` (gerencia) | **todos** los facturadores del día, de las dos divisiones |
| `?fecha=&division=consulta` | los facturadores de consultas |
| `?fecha=&division=general` | los de la facturación general |
| `?fecha=&usuarioId=u1` | solo ese cajero |
| `?fecha=` (un cajero que NO es gerencia) | solo el suyo — **lo fija el BE**, no la pantalla |

**La suma de `porCajero` debe dar `detalle.total`.** Hay una prueba del BE que lo exige. Si en pantalla
no cuadra, es un defecto y hay que reportarlo, no maquillarlo.

## Lo que hay que construir en el FE

1. **Tabla «Quién facturó» en el cuadre**: una fila por facturador con su nombre y su total, ordenada de
   mayor a menor, y una fila de total al pie que debe coincidir con el total del día.
2. **Filtrar por facturador**: al pulsar una fila, recargar el cuadre con `usuarioId` de ese cajero, de
   modo que todo el resto de la hoja (métodos de pago, documentos, conteo) quede acotado a él. Con un
   botón claro para volver al totalizado.
3. **Respetar la división**: si el usuario está viendo Consultas o General, la tabla es de esa división;
   en la vista sin división, es de todas juntas.
4. **No inventar visibilidad**: si el principal no es gerencia, `porCajero` traerá una sola fila (la
   suya). No hay que ocultar ni añadir nada — se pinta lo que llega. Y no pidas `usuarioId` de otro: el
   BE lo ignora y lo fija al propio, por diseño.
5. **Imprimir**: la hoja del cuadre que se entrega a contabilidad debería llevar esta tabla, junto al
   conteo de efectivo y el bloque tributario que ya se imprimen.

Permiso: `caja.read` (el mismo del cuadre). Roles que ya entran: admin, super_admin, gerente, recepción,
facturación.

## Cumple, como todo lo demás

API-First · MCP (`reporte_dia_caja`, mismo RBAC) · Swagger · configurable sin hardcode · multi-tenant ·
RBAC · spec y plan antes de código · TDD · i18n con `labelKey`, nunca cadenas quemadas · no duplicar
código · el endpoint correcto, no el más cómodo · verificar en pantalla con `/qa`, sin adivinar.

## Qué es «terminado»

- El cuadre del día muestra la tabla de facturadores y su suma coincide con el total del día.
- Pulsar un facturador acota toda la hoja a él; se puede volver al totalizado.
- Un usuario que no es gerencia ve una sola fila, la suya, sin trucos en el FE.
- La tabla sale también en la hoja impresa.
