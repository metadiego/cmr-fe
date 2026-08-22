# FE — El desplegable de centro DESTINO usa su propio endpoint

## El problema (visto en pantalla)

Con la cuenta del rol Inventarios de Bayamón, en `/inventario/transferencias/nueva` el desplegable de
**centro destino** ofrece una sola opción: «CMR Bayamon». O sea, no se puede mandar nada a Caguas, y
el origen no puede ser el destino.

La causa: el selector se llena con `GET /auth/me/centros`, que devuelve **solo los centros asignados
al usuario**. Ese filtro es correcto para el selector de centro ACTIVO (si ofreciera otros, la
pantalla mentiría sobre a qué se tiene acceso), pero el destino de una transferencia es, por
definición, otro centro.

## El endpoint correcto (ya desplegado)

```
GET /api/v1/inventario/transferencias/destinos
```

```jsonc
[
  {
    "clinicId": "5f98ef29-…",
    "nombre": "CMR Caguas",
    "almacenes": [{ "id": "b6a99d6f-…", "nombre": "Almacén Principal" }]
  }
]
```

- Trae los demás centros **activos** con sus almacenes activos, ya ordenados por nombre.
- El centro propio **no aparece**. Un centro inactivo tampoco.
- Un destino **sin almacén** viene con `almacenes: []`: enséñalo y avisa («ese centro no tiene
  almacén») en vez de esconderlo, que si no el usuario se queda buscando Caguas.
- Permiso: `inventario.transferir` (el mismo que crear la transferencia).

## Qué cambiar

En la pantalla de nueva transferencia, llenar **centro destino** y **almacén destino** con este
endpoint: los almacenes del destino vienen dentro de cada centro, así que al elegir el centro ya
tienes su lista sin otra llamada. El selector de centro ACTIVO (el de la cabecera) se queda como está,
con `auth/me/centros`.

## Recordatorio del flujo, que la pantalla ya explica bien

El stock sale del origen al crear la transferencia y **no entra en el destino hasta que su encargado
la acepta** (total o parcialmente). Al crearla, el backend levanta una alerta accionable en el centro
destino, del tipo `transferencia.recepcion`, dominio `inventario`, color `verde` — la que la campanita
ya pinta.
