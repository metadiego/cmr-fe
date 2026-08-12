# HANDOFF BE — Crear usuario de PRUEBA del rol `citas` (con clave fija, como atencionbay)

**Por qué al BE:** el FE solo tiene la anon key de Supabase; no puede crear un usuario de auth con
contraseña fija ni confirmarlo. El invite del app o manda enlace por correo o genera una clave temporal
aleatoria (con `mustChangePassword`), así que no sirve para un usuario de prueba con clave conocida. Hay
que crearlo con la service_role, igual que se creó `atencionbay@cmr.test`.

## Qué crear (idéntico patrón a atencionbay@cmr.test)

1. **Usuario de auth (Supabase):**
   - email: `citasbay@cmr.test`
   - password: `123456789`
   - email **confirmado** (que pueda entrar de inmediato, sin magic link ni cambio de clave forzado).
2. **Perfil** aprobado (no pendiente), nombre visible: **Usuario Citas (Bayamón)**.
3. **Rol asignado:** `citas` (id `f54f2531-9c60-45e1-a2ff-f145c9852109`) en el centro **CMR Bayamón**
   (`ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1`). Si quieres que cubra ambos, asígnalo también en **CMR Caguas**
   (`5f98ef29-5b71-4fc4-8291-0ca3ff50bc7d`); de todos modos el rol trae `citas.multicentro`.

## El rol `citas` YA quedó configurado por el FE (no hay que tocarlo)

- **Lista blanca de menú:** `citas` (tablero de Citas) + `clientes`. Nada más.
- **Permisos (crear/leer/editar, SIN borrar):**
  `citas.create, citas.read, citas.update, citas.multicentro,`
  `clientes.create, clientes.read, clientes.update,`
  `pacientes.create, pacientes.read, pacientes.update`

## Cómo lo comprobamos al terminar (el FE lo hace, sin adivinar)

- Login `citasbay@cmr.test` / `123456789` (X-Tenant-ID Bayamón) → `GET /api/v1/me/menu` debe devolver
  **solo Citas + Clientes** (más sus cabeceras de grupo), no el menú entero.
- Las acciones dentro: crear/leer/editar citas, clientes y pacientes; **borrar NO** debe estar disponible.
- Debe poder trabajar Bayamón y Caguas (multicentro / asignación en ambos).

## Contexto

- El menú como lista blanca ya está desplegado (BE #280). El rol `citas` es un rol EXISTENTE al que el FE
  ya le fijó la lista blanca vía `POST /roles/:id/menu`.
- Referencia del usuario de prueba análogo ya existente: `atencionbay@cmr.test` (rol `atencion`, Bayamón).
