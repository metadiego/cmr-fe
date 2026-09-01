# FE — Permisos y roles: crear, editar y asignar desde la pantalla

Backend desplegado y probado en producción (23-ago-2026). Falta la pantalla.

## Los tres conceptos, para que la pantalla los enseñe bien

- **Permiso** = una cosa que se puede hacer. Siempre `modulo.accion`: `factura.anular`, no
  «anular». Es la unidad que el sistema sabe negar.
- **Rol** = un puesto de trabajo: un paquete de permisos con el nombre que usa el negocio. **No hace
  nada por sí mismo**; existe para no asignar 159 cosas una a una.
- **Excepción por persona** = un permiso concedido o negado a alguien en concreto, opcionalmente solo
  en un centro, sin tocar su rol. **Negar gana siempre.**

Ninguna tarea pertenece a un rol: los gerentes también facturan, y puede haber un especialista que
repare descargas sin ser gerente. La pantalla tiene que dejar mover permisos entre roles sin que
nadie toque código.

## Catálogo de permisos

- `GET /api/v1/permisos` → `[{ id, clave, modulo, accion, descripcion }]`, ordenado por clave.
- `POST /api/v1/permisos` → `{ clave, descripcion? }`. Permiso: `rbac.create`.
  - `clave` va en formato `modulo.accion`. La acción **puede llevar puntos**:
    `factura.pago.anular` es válida.
  - **No se envían `modulo` ni `accion`**: se derivan de la clave. Si la pantalla los pide por
    separado, acabarán contradiciéndose.
  - Se normaliza a minúsculas y sin espacios: `  Compras.Aprobar ` se guarda `compras.aprobar`.
  - `409` si ya existe (comparando la clave ya normalizada). `400` si no tiene el formato.
- `PUT /api/v1/permisos/:id` → `{ descripcion }`. Permiso: `rbac.update`.
  - **La clave no se edita.** Está escrita en el código y en cada concesión; renombrarla las
    dejaría colgando. El campo debe salir en la pantalla como solo lectura.
- `DELETE /api/v1/permisos/:id` → `204`. Permiso: `rbac.delete`.
  - `400` si el código lo exige: «`citas.read` lo exige el código: borrarlo dejaría ese endpoint
    cerrado para todos.»
  - `400` si alguien lo tiene concedido, **diciendo cuántos**: «está concedido a 1 rol(es).
    Quítaselo primero.» Ese mensaje es para mostrarlo tal cual: dice qué hacer.

## Roles (ya existía)

- `GET /api/v1/roles`, `POST`, `PUT /roles/:id`, `DELETE /roles/:id`.
- `GET /api/v1/roles/:id/permisos` → `['citas.read', …]`.
- `PUT /api/v1/roles/:id/permisos` → `{ claves: [...] }`.
  **REEMPLAZA la lista entera.** Hay que leer primero y mandar el conjunto final; mandar solo los
  nuevos borra el resto.
- `GET /api/v1/roles/:id/menu` y `PUT /roles/:id/menu` → qué VE el rol, aparte de lo que puede hacer.

## Asignar a personas (ya existía)

- `POST /api/v1/profiles/:id/roles` → `{ rolClave, centroId? }`. Sin `centroId` = todos los centros.
- `DELETE /api/v1/profiles/:id/roles/:rolId?centroId=…`
- `POST /api/v1/profiles/:id/permisos` → `{ permisoClave, efecto: 'grant'|'deny', centroId? }`
- `DELETE /api/v1/profiles/:id/permisos/:permisoId?centroId=…`
- `GET /api/v1/profiles/:id/acceso?centroId=…` → la foto completa de una persona: sus roles, sus
  excepciones y el catálogo anotado con el ORIGEN de cada permiso (`viaRole` / `override` /
  `effective`). **Es el endpoint de la pantalla de accesos**: responde «¿qué puede hacer esta
  persona y por qué?» de una sola llamada.

## Lo que la pantalla debería resolver

1. **Catálogo**: tabla de permisos con buscador por módulo, y el alta. Al escribir la clave, enseñar
   en vivo cómo queda partida en módulo y acción — así se entiende la convención sin explicarla.
2. **Rol**: su lista de permisos agrupada por módulo, con casillas. Guardar manda el conjunto
   completo. Enseñar el contador de personas que llevan ese rol antes de guardar: quien edita un rol
   está cambiando a varias personas a la vez y debe verlo.
3. **Persona**: los roles que tiene y, debajo, sus excepciones. Cada permiso con su origen visible
   (viene del rol / se le dio aparte / se le quitó aparte) y el centro donde aplica. Que se pueda
   conceder o negar uno sin salir de ahí.
4. **Al borrar un permiso**, mostrar el mensaje del backend tal cual: ya dice a cuántos afecta y qué
   hacer antes.

Todo esto es superficie de administración: solo admin. El menú ya se filtra por permiso, así que a
quien no lo tenga no le aparece.
