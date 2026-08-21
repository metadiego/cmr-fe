# Ajustar el inventario desde el menú de Inventario (no desde frontdesk)

> Handoff **BE → FE**. Fecha: 2026-08-21. El backend está construido, probado en producción y
> desplegado. Spec del BE: `cmr-be/docs/specs/ajuste-facil-inventario-por-vial.md`.

## Por qué

El personal reporta constantemente que el sistema no cuadra con lo que hay en la nevera, y hoy nadie
puede corregirlo desde la pantalla. Mensajes reales:

> *«los tirzepatide inventario dice que tengo 9… 1 en uso, 5 en la nevera»* · *«de los nano en sistema
> tengo 55 y en la nevera 54, hay algún nano que no se bajó»* · *«hoy se terminó el frasco 9, ya voy para
> el 8, y en el inventario queda 7»*

**Dónde va: en el menú de INVENTARIO.** Decisión del dueño (21-ago): no en frontdesk. Frontdesk mueve
inventario, sí, pero quien trabaja esa pantalla no es quien debe cuadrar existencias — el ajuste vive
donde se administra el inventario.

## Lo que cambió en el backend

`POST /api/v1/inventario/operaciones/ajustar` ya existía. Lo que estaba roto era el motivo: el DTO
llevaba una lista escrita a mano (`correccion`, `conteo_fisico`), así que de los 14 motivos del catálogo
solo 2 se podían usar. Ahora el motivo sale del **catálogo** (`GET /api/v1/inventario/motivos-movimiento`)
y agregar uno nuevo es un registro, sin desplegar.

Motivos disponibles hoy en producción (14): `apertura`, `apertura_vial`, `aplicacion`, `compra`,
`consumo_interno`, `conteo_fisico`, `correccion`, `dano_rotura`, `devolucion`, `merma`, `perdida`,
`transferencia`, `vencimiento`, `venta`.

Cuerpo del ajuste:

```jsonc
{
  "productoId": "…", "almacenId": "…",
  "cantidad": 1,                 // siempre POSITIVA
  "signo": "negativo",           // "positivo" suma, "negativo" resta
  "motivo": "merma",             // clave del catálogo
  "notas": "se rompió un frasco" // obligatorio: por qué
}
```

Un motivo que no exista devuelve `400` con `code: "MOTIVO_INVALIDO"` y el campo `motivosValidos`, para
que la pantalla pueda mostrar la lista sin adivinar.

Probado por HTTP en producción: `merma` y `dano_rotura` se aceptan; `mermma` se rechaza con la lista.

## Lo que hay que construir en el FE

1. **Un botón «Ajustar» en el reporte de existencias del producto**, dentro del menú de Inventario, en la
   fila del producto y almacén donde se ve el descuadre. Ahí es donde la persona nota la diferencia; que
   el ajuste esté a un clic de ese número es la mitad del trabajo.
2. **El diálogo**: cantidad, si suma o resta, el motivo **de un select cargado del catálogo** (nunca una
   lista escrita en el FE) y las notas obligatorias. Mostrar el stock actual y el resultante antes de
   confirmar: nadie debe ajustar a ciegas.
3. **Conteo físico**: cuando el motivo sea `conteo_fisico`, es más natural pedir *«¿cuántos hay de
   verdad?»* y que el FE calcule la diferencia contra el stock actual, en vez de pedir el delta. Es el
   caso que el personal describe («en la nevera tengo 54, el sistema dice 55»).
4. **Ver lo que se ajustó**: el historial de movimientos del producto debe mostrar los ajustes con su
   motivo, sus notas y quién lo hizo. Un ajuste sin rastro visible es peor que no ajustar.
5. **Permiso**: el que ya exige el endpoint (`inventario.*`). No inventar uno nuevo.

## Cumple, como todo lo demás

API-First · MCP · Swagger · configurable sin hardcode (el select sale del catálogo) · multi-tenant ·
RBAC · i18n con `labelKey`, nunca cadenas quemadas · no duplicar código · el endpoint correcto, no el
más cómodo · verificar en pantalla con `/qa`, sin adivinar.

## Qué es «terminado»

- Desde el menú de Inventario se resta un frasco roto con motivo «Daño o rotura» y una nota, y el stock
  baja en el acto.
- El select de motivos muestra los 14 del catálogo; si mañana se agrega uno en la base, aparece sin
  tocar el FE.
- Un conteo físico de 54 sobre un sistema que dice 55 deja el stock en 54.
- El movimiento queda visible en el historial con su motivo, su nota y su autor.
