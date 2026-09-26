# Handoff BE — El menú marca `allowed:false` en ítems cuyo permiso el usuario SÍ tiene

**Severidad: alta** (deja invisibles pantallas que la persona tiene permiso de usar).

## Síntoma

El dueño pidió que los **gerentes** puedan configurar los tiempos de terapias
(`/configuration/resources`, permiso `resources.read`/`resources.config`). Al revisarlo se descubrió que el
**enlace «Recursos» no aparece** en el menú del gerente, aunque el rol tiene los cinco `resources.*`.

## Verificado en producción (26-sep-2026), usuario `eduardo.ortiz@…` (rol gerente, centro Caguas)

Para el MISMO usuario y el MISMO centro (`centroId=CMR Caguas`), dos endpoints del BE se contradicen:

1. `GET /api/v2/profiles/:id/access?centroId=<Caguas>` → `effectivePermissions` **incluye**
   `resources.read, resources.config, resources.create, resources.update, resources.delete`.
2. `GET /api/v2/auth/me` (token del propio Eduardo) → **165 permisos**, incluye los cinco `resources.*`.
3. `GET /api/v2/profiles/:id/menu?centroId=<Caguas>` → el ítem `resources` viene
   **`"allowed": false, "requiresPermiso": "resources.read"`**.
4. `GET /api/v2/me/menu` (token de Eduardo) → el ítem `resources` **no sale** (coherente con el 3).

O sea: `effectivePermissions`/`auth/me` dicen que **SÍ** tiene `resources.read`, pero el constructor de menú
dice que **NO**. La misma clave, el mismo usuario, el mismo centro.

## No es un caso aislado — es SISTÉMICO

Cruzando `effectivePermissions` de Eduardo contra el `allowed` de su menú-preview, **22 ítems** están en la
misma situación (tiene el permiso requerido, pero `allowed:false`):

```
cupos (citas.read), inventario-existencias (inventario.read), grupos-facturacion (factura.columnas),
servicios-config (frontdesk.update), config-factura (factura.update), consumo-insumos (factura.read),
inventario-transferencias (inventario.transferir), inventario-viales (inventario.read),
personal (personal.read), precios (precios.read), scheduling-bridge (scheduling-bridge.read),
ehr-integration (ehr-integration.config), resources (resources.read),
+ 9 dev-* (menu.desarrollo)
```

## Sospecha (para que el BE lo confirme)

El `allowed` del constructor de menú **no está usando la misma resolución de permisos** que
`effectivePermissions`/`auth/me`. Posibles causas a revisar:

- El menú evalúa el permiso contra un set distinto (¿permisos ligados al menú del rol vía `setRoleMenu`, en
  vez de los permisos efectivos del rol?), o contra una caché que no se invalidó al conceder los permisos.
- O el `allowed` se calcula sin herencia de rol (solo overrides directos del perfil), mientras que
  `effectivePermissions` sí hereda del rol.

## Lo que se pide

Que **`GET /me/menu` y el `allowed` de `/profiles/:id/menu` usen exactamente la misma fuente de verdad que
`effectivePermissions`** (permisos efectivos con herencia de rol y centro). Con eso, los 22 ítems —incluido
`resources`— aparecen solos para quien tiene el permiso; **no hay que tocar cada ítem a mano**.

## Mientras tanto (workaround verificado, sin cambios de datos)

La PANTALLA sí funciona: su guard (`ConfigGuard permiso="resources.read"`) y el selector de centro
(`/me/centros-donde-puedo?permiso=resources.read|resources.config`) resuelven **CMR Caguas** para Eduardo. Es
decir, entrando por la **URL directa** `/configuration/resources` el gerente ya puede configurar los tiempos;
lo único que falta es que el **enlace** salga en el menú, que es lo que arregla este bug.

**No se cambió nada en RBAC**: los gerentes ya tenían los cinco `resources.*`. Este handoff es solo por la
visibilidad del menú.
