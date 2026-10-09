# Handoff FE — Cuadre general y Consolidado dentro del grupo «Reportes»

**De:** cmr-be · **Para:** FE · **Fecha:** 2026-10-09 · **Prioridad:** alta (lo usa la gerencia hoy).

## Qué pidió el dueño

«Coloca los reportes en la opción Reportes»: el **Cuadre general** y el **Consolidado** tienen que
aparecer bajo el grupo «Reportes» del menú lateral.

## Qué hizo el BE (en producción, verificado por HTTP el 9-oct 07:17 AST)

- Nueva fila de menú **`cuadre-general`** (`POST /api/v1/menu` → 201, id `a8b44d43-f1a5-488b-9e46-6538edad0c47`):
  `labelKey: nav.cuadreGeneral`, `path: /billing/cash/summary`, `icon: chart-bar`,
  `permissionSlug: reportes.grupo.read` (hoy: admin, facturacion, gerente, solo_lectura — es dato,
  se cambia desde la pantalla de roles).
- La fila vieja **`dev-cuadre-general`** (estaba en «En desarrollo», con `menu.desarrollo`) quedó
  `visible: false`. No se borró.
- La misma fila está en el seed (`cmr-be/src/scripts/menu-items.ts`).

## Qué falta en el FE (una línea en el manifiesto)

La estructura del menú es del FE (`lib/nav/manifest.ts`). Sin entrada, `cuadre-general` cae en el
bucket de reserva de su `parentSlug` del BE y **no** aparece en «Reportes». Añadir en el bloque
`// Reports`:

```ts
{ clave: "cuadre-general", route: "/billing/cash/summary", group: "reports", order: 6 },
```

(Si preferís mover la página a `/reports/cash-summary`, es decisión vuestra: el BE no depende de la
ruta.)

## El «Consolidado»

El reporte «Consolidado» del legado (`cma/consolidado`: ventas por `grupo_consolidado`, factura vs
devolución, rango de fechas, varias oficinas) es en este sistema **«Ventas por grupo»**
(`clave: ventas-por-grupo`, `GET /facturacion/reportes/por-grupo`), que **ya** está en el grupo
«Reports» del manifiesto (order 4). No hace falta tocarlo. Si el dueño quiere que se llame
«Consolidado», se cambia el label por centro desde la pantalla de menú (`customLabel`), sin código.

El «consolidado» del **cuadre de caja** (unión de todos los cajeros) sigue siendo la opción
«Consolidado» del selector dentro de Caja general / Caja consultas; no es un ítem de menú.

## Cómo verificar

Entrar con un gerente (p. ej. Fabiola o Sheila) → `GET /api/v2/me/menu` debe traer `cuadre-general`;
en pantalla, «Reportes» muestra «Cuadre general» y «Ventas por grupo».
