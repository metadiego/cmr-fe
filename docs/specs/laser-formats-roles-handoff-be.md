> **RESUELTO por el BE, 9-oct-2026 — en producción (commit `88a303d`) y verificado por HTTP real (Caguas, v2):**
>
> - **El `@Roles` de clase NO bloqueaba.** El `RolesGuard` cede al `@Permissions` declarado: con permiso declarado,
>   la lista de roles no se mira. Prueba real: una llave temporal de centro **sin ningún rol** y solo con `laser.read`
>   + `formatos.read` → `GET laser/format/hilt` **200**, `laser/format/mls` **200**, `formats/laser_hilt/assembly`
>   **200**, `laser/parameters` **200**; `POST laser/parameters` **403** (escribir sigue exigiendo `laser.create`).
>   La llave se revocó (después → 401). Lo que bloqueaba era solo el dato, y eso ya lo corregiste tú.
> - Permisos efectivos leídos con `GET /profiles/:id/access`: **M. Caballero (atención, Bayamón)** y **Damian Campos
>   (citas, Caguas)** tienen `laser.read`, `formatos.read` y `frontdesk.read` efectivos.
> - Aun así se **quitó** el `@Roles(...)` de `LaserController`: engañaba al que lo leía (te engañó a ti).
> - **Seed:** `IMPLIED_BY_DOMAIN` (`src/modules/rbac/dominio/frontdesk-prints-its-formats.ts`): todo rol con algo del
>   frontdesk nace con `formatos.read` + `laser.read` (solo lectura; no arrastra configurar formatos ni editar
>   parámetros). Quitárselo a un rol o usuario se hace desde la pantalla de roles/accesos.
> - Otros controladores con listas fijas: también **no bloquean** donde el endpoint declara su permiso o tiene uno
>   derivable de la ruta; queda deuda para retirarlas (no cambia el comportamiento).
>
> **Pendiente tuyo:** que el dueño pruebe con una usuaria de atención o enfermería en pantalla.

# Handoff BE — Formatos de láser: que decida el PERMISO, no una lista fija de roles

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-09 · **Prioridad:** alta (el frontdesk no puede
imprimir los formatos HILT/MLS).

## Qué pasó

El dueño probó los formatos desde el frontdesk con el rol **recepción**: «No se pudo cargar el formato».
Por HTTP con un admin, `GET /api/v2/laser/format/{hilt,mls}` y los 31 `GET /formats/:clave/assembly`
responden 200 (Caguas, 9-oct). La causa es de permisos:

1. Recepción, Atención y Enfermería no tenían `laser.read`, y Citas no tenía ni `formatos.read`.
2. **Además**, `LaserController` lleva a nivel de clase
   `@Roles('admin', 'super_admin', 'gerente', 'recepcion')` (`src/modules/laser/laser.controller.ts`):
   aunque un rol tenga `laser.read`, si no está en esa lista recibe 403.

## Regla del dueño

> Todos los roles que tienen acceso al frontdesk deben imprimir los formatos, a menos que yo indique
> que un rol o un usuario en particular no los pueda tener.

O sea: lo decide el **permiso** (dato, editable desde la pantalla de roles y de accesos por usuario),
nunca una lista de roles escrita en el código.

## Lo que ya hizo el FE (dato, por la API de roles, verificado al releer cada rol)

A los roles con `frontdesk.read` se les añadió lo que les faltaba, sin quitar nada:
`atencion` +`laser.read`, `citas` +`formatos.read` +`laser.read`, `enfermeria` +`laser.read`,
`recepcion` +`laser.read` (admin, gerente y solo_lectura ya los tenían).

## Lo que se pide

1. **Quitar el `@Roles(...)` de clase de `LaserController`** (o, como mínimo, de las lecturas
   `GET parametros` y `GET formato/:tipo`): que baste `@Permissions('laser.read')`. Las escrituras siguen
   con sus permisos `laser.create/update/delete`. Revisar si otros controladores que usa el frontdesk
   tienen el mismo `@Roles` fijo.
2. En el seed de roles: que todo rol con `frontdesk.read` nazca con `formatos.read` y `laser.read`.

## Verificación que pide el FE

Por HTTP real con un usuario de **atención** o **enfermería** (no admin): `GET /api/v2/laser/format/hilt`
→ 200, y `GET /api/v2/formats/laser_hilt/assembly` → 200. Copiar aquí las respuestas.
