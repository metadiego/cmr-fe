# Firmar el cuadre como gerente: un permiso propio (handoff FE → BE)

**Fecha:** 6-nov-2026 · **Reportado por:** el dueño: «en la firma electrónica del cuadre general, para los usuarios
facturadores el botón muestra Firmar como gerente».

## La causa (verificada en producción)

La firma de gerente (#486) se decide con `caja.ver_todos`. Pero `GET /api/v2/roles?conPermisos=true` muestra que en
producción los **seis** roles de caja tienen exactamente los mismos permisos de caja, `caja.ver_todos` incluido:
`admin`, `atencion`, `facturacion`, `facturador_consulta`, `gerente` y `solo_lectura`.

Con eso no se distingue a un gerente de un facturador. Cualquier facturador puede firmar como gerente, y el BE lo
acepta.

## Lo que pide el FE (ya desplegado de este lado)

1. **Un permiso nuevo: `caja.sign_as_manager`**, en el catálogo de permisos, para que se pueda asignar desde
   Accesos. Debe darse a `gerente` y a `admin`. Si hay que darlo a algún rol más, lo decide el dueño.
2. **`POST /cash/reconciliations/:id/sign` con `signAs: "supervisor"` debe exigir `caja.sign_as_manager`** en lugar de
   `caja.ver_todos`, con 403 si no lo tiene. El FE oculta el botón, pero la regla tiene que cumplirse en el BE.
3. `caja.ver_todos` sigue sirviendo para lo que es: ver el consolidado y las hojas de los demás cajeros.

## Lo que hizo el FE (commit en este mismo push)

- «Firmar como gerente» aparece solo con `can("caja.sign_as_manager")`. Master lo ve siempre. **Mientras el permiso
  no exista, ningún gerente que no sea master verá el botón.**
- Un facturador en el consolidado, si cobró ese día, ve **«Firmar mi hoja»**: lo lleva a su propia hoja, donde firma
  como cajero con «Firmar y aceptar».
