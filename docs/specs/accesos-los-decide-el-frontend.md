# Los accesos y los módulos los decide el frontend

Decisión del dueño (2-sep-2026): **el frontend decide qué módulos y pantallas ve cada persona.**
El backend se queda con los códigos y los endpoints.

## Lo importante, primero

El backend **sigue comprobando el permiso en cada endpoint, y eso no se toca**. No es una
duplicación ni una desconfianza: quien tenga un token puede llamar al API sin pasar por la pantalla,
con `curl` desde cualquier sitio. Si el backend dejara de comprobar, esconder un botón no impediría
facturar, ni borrar, ni leer los pacientes de otro centro.

Dicho de otro modo: **el frontend decide qué se VE; el backend decide qué se PUEDE.** Las dos cosas
tienen que decir lo mismo, y la que protege es la segunda.

## Lo que el backend ya te da (nada que pedir, está en producción)

**`GET /api/v1/auth/me`** — quién es y qué puede:

- `permissions` — la lista de permisos efectivos. Un `*` significa todos.
- `roles`, `accessMode` (`admin` / `operativo` / `gerencial`), `isMaster`, `allowedClinicIds`.

**`GET /api/v1/menu`** — el catálogo COMPLETO de menú, 58 ítems, sin filtrar. Cada ítem trae:

- `clave`, `labelKey`, `path`, `icon`, `parentClave` (el anidamiento va por aquí, no por hijos),
- `permisoClave` — el permiso que ese ítem exige (51 de los 58 lo declaran),
- `orden`, `visible`, `centroId`.

Con esas dos llamadas el frontend ya puede decidir solo: recorre el catálogo y muestra el ítem si
`permisoClave` está en `permissions` (o si la persona tiene `*`). Los que no declaran permiso son
visibles para cualquiera autenticado.

**`GET /api/v1/permisos`** — el catálogo de los 161 permisos, por si hay que pintar una pantalla de
administración.

## `/me/menu` sigue existiendo

Devuelve el menú ya filtrado por el backend. **No se retira**: hoy funciona y nada se rompe. A
partir de ahora es una comodidad, no la fuente de la verdad — si el frontend prefiere decidir con
`/menu` + `permissions`, adelante, y las dos vías dan lo mismo.

## Lo que NO debe hacer el frontend

- **Escribir la lista de módulos a mano.** El catálogo es dato: se administra y añadir un módulo no
  puede exigir un despliegue del frontend.
- **Atar una pantalla a un nombre de rol** (`if (rol === 'admin')`). Se comprueba el PERMISO, nunca
  el nombre del rol: los gerentes también facturan, y quién tiene qué rol se cambia desde la UI.
- **Dar por hecho que ocultar es proteger.** Si una pantalla no debe usarse, además de ocultarla
  tiene que existir el permiso que la protege en el backend. Si falta alguno, dilo y se añade.

Backend: los permisos se declaran con `@Permissions(...)` en cada endpoint y se siembran en
`seed-rbac.ts`.
