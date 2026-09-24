# «No puedo editar el paciente»: no viene del BE

**De:** cmr-be. **Fecha:** 2026-09-23. Reportado por los usuarios de Atención, Citas y Gerencia.

## Verificado (con el usuario real, contra producción)

Inicié sesión como **Berkaira Concepción** (rol `atencion`, centro Caguas) y llamé a la API con su
token. Todo lo que dicen que no pueden hacer, **se puede**:

| Acción | Endpoint | Resultado |
|---|---|---|
| Ver sus permisos | `GET /auth/me` | `pacientes.read`, `pacientes.create`, **`pacientes.update`** |
| Cambiar el teléfono | `PUT /pacientes/:id` | **200** |
| Cambiar el nombre | `PUT /pacientes/:id` | **200** |
| Cambiar el récord | `PUT /pacientes/:id` | **200** |
| Escribir el récord desde el tablero | `POST /tablero/celda` | **409 PACIENTE_RECORD_DUPLICADO** — llegó a la regla de negocio, no a un 403 |

Y en el registro de auditoría de los últimos dos días **no hay un solo 403** contra `/pacientes`. Es
decir: **la petición nunca sale del navegador.**

Los roles `atencion`, `citas` y `gerente` tienen `pacientes.update` en la base, y el BE resuelve los
permisos **en vivo** en cada petición (no van dentro del token), así que tampoco hace falta volver a
entrar.

## Dónde mirar en el FE

- `app/(app)/patients/[id]/page.tsx:208` y `:219` — el `<Can permiso="pacientes.update">` que envuelve
  la edición. `useCan` lee `permissions` de `/auth/me`, que para Berkaira SÍ los trae.
- `components/tablero/celda-toggle-icon.tsx:71` — misma comprobación para la celda.

Sospechas a descartar, por orden: que la pantalla se pida **sin centro activo** (sin `X-Tenant-ID` el
BE no resuelve permisos y `/auth/me` vuelve con la lista corta); que el botón esté además detrás de un
`@Roles` del FE con nombres de rol; o que la ruta `/patients/:id` no esté en el menú de esos roles y no
puedan ni llegar.

## Lo que hace falta para cerrarlo

Decir **en qué pantalla y con qué botón** lo intentan, y qué ven: si el botón no aparece, es el `Can`;
si aparece y falla, el error exacto del toast. Con eso se caza en minutos.

## Ampliación: el botón de ACCIONES también llega completo (23-sep-2026)

El dueño precisó que lo intentan desde el **botón de acciones del tablero de Atención**. Comprobado con
el token de Berkaira:

- `GET /tablero/definicion?tablero=atencion` le devuelve la columna **`acciones`** con
  `editar_paciente` (`kind: "link"`, `href: "/patients/:pacienteId"`) y `facturar`.
- `GET /tablero/filas?tablero=atencion` devuelve cada fila con **`pacienteId`** y con `acciones`.

Es decir: el BE le da el botón, la acción y el id con el que construir el enlace. Lo que falle está
entre el `AccionesModal` y la navegación a `/patients/:id`.

Tres cosas concretas que mirar en ese orden:

1. **El `AccionesModal` pinta la acción `kind: "link"`?** Hoy sabe pintar `facturar`; si el `link` no
   tiene su rama, el menú saldría vacío o sin esa entrada.
2. **El `href` se resuelve** sustituyendo `:pacienteId` por el de la fila. Si se pinta literal, el
   enlace lleva a `/patients/:pacienteId` y la página no existe.
3. **La página `/patients/[id]`** se abre para el rol `atencion`. La ruta no está en su menú (su menú
   trae `clientes`), así que si hay un guardián que compara la ruta contra el menú, ahí se corta — el
   sidebar traduce por `slug` con `routeForClave`, pero un guardián de ruta puede no hacerlo.
