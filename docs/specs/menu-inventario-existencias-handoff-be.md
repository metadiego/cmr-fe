# FE → BE — «Existencias» debe salir en el menú de Inventario

**Fecha:** 2026-08-28 · Pedido del dueño: el visor de existencias tiene que aparecer **bajo la opción
de Inventario** del menú, para quien administra inventario, no solo para admin.

## Estado en el FE

- La pantalla existe y funciona: `/inventario/existencias` (visor genérico, buscador, filtros,
  semáforo, unidad, equivalencias, desglose por almacén/lote). Ya está en el manifiesto del FE.
- **Pero el menú lo arma el BE** (`GET /me/menu`). El FE solo puede *flotar* rutas del manifiesto en los
  grupos internos «En desarrollo/Por desarrollar», y **solo para admin/master**. Por eso hoy un usuario
  de inventario **no la ve bajo Inventario**.

## Lo que hace falta en el BE

Registrar el ítem en el grupo de inventario de `/me/menu`:

- **clave:** p. ej. `inventario-existencias`
- **path:** `/inventario/existencias`
- **parent/grupo:** `g-inventario` (el mismo donde están productos, viales, transferencias…)
- **permiso:** `inventario.read` (el mismo del endpoint `GET /inventario/stock/resumen`)
- **labelKey:** `nav.inventario_existencias` (el FE ya la traduce como «Existencias»)
- **orden:** arriba del grupo (es lo más consultado: «¿cuánto queda?»)

Con eso aparece sola para todos los que tengan `inventario.read`, sin tocar el FE (que ya la conoce).

## Verificación

Con la sesión real de un usuario de inventario (no la vista previa de admin): que `/me/menu` traiga
`inventario-existencias` dentro de `g-inventario`, y que al abrirla cargue el resumen del centro activo.
