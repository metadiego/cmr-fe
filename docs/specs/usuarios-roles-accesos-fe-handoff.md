# FE HAND-OFF — Usuarios, roles y accesos (F4 del dominio RBAC)

> Estado: **DESPLEGADO en producción** el 2026-08-02.
> BE: metadiego/cmr-be#232 · FE: metadiego/cmr-fe#14 · Spec: cmr-be `docs/specs/usuarios-roles-accesos.md`.
> El FE ya está implementado (no hay tarea de codificación pendiente): este documento es el
> contrato + la guía de verificación en pantalla.

## Por qué existía el problema

Los roles de la base de datos **nunca llegaban a las peticiones**: `RequestContext.roles` salía
solo de `app_metadata` del JWT de Supabase, que nadie escribe salvo para el master. Cualquier ruta
con `@Roles('gerente'|'recepcion'|'medico'…)` devolvía 403 a todo no-master, aunque tuviera el rol
asignado. Por eso el módulo de usuarios "no servía". Ese puente ya está construido.

## Contrato nuevo que consume el FE

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/roles/:id/permisos` | Precargar el editor de permisos (antes abría vacío y **borraba** los permisos al guardar). |
| GET/PUT | `/roles/:id/menu` | Qué opciones del menú ve el rol (casillas). El PUT solo reescribe los permisos ligados a menú. |
| GET | `/profiles` (enriquecido) | Cada perfil trae `roles[]` y `centros[]` (con tipo, vigencia y activo). |
| GET/PUT/DELETE | `/profiles/:id/asignaciones[/:asigId]` | Centros del usuario: listar, editar vigencia, revocar (soft). |
| PUT | `/profiles/:id` | nombre / apellido / accessMode. |
| POST | `/profiles/:id/suspender` · `/reactivar` | Corta o restaura el acceso (efecto **inmediato**). |
| POST | `/profiles/invite` (ampliado) | Acepta `centroId`, `rolClave`, `tipoAsignacion`, `vigenteHasta`. |

Errores nuevos: `VIGENCIA_INVALIDA` (fecha fin anterior al inicio) y `TENANT_NOT_FOUND`
(X-Tenant-ID que no es un centro real).

## Reglas de negocio que el FE debe respetar

1. **Un centro a la vez** para todo lo que no sea admin. El BE responde 409 a un no-admin sin
   `X-Tenant-ID`. La opción "todos los centros" solo se ofrece a admin/master
   (`lib/centros-scope.ts` → `puedeVerTodosLosCentros`). Ver ambos a la vez = dirección, CEO,
   presidencia.
2. **Excepción de menú por usuario** = override del `permisoClave` del ítem. Al alternar, la
   referencia es el ROL (`viaRole`): si el rol ya da el resultado deseado se **quita** la
   excepción; solo se crea cuando contradice al rol.
3. **Rol sin centro = rol en TODOS los centros.** El diálogo de invitación lo advierte.
4. Los roles `admin` y `super_admin` son reservados: no se pueden crear por API y solo el master
   los concede de forma global.

## Dónde está cada cosa

- `components/admin/users-list.tsx` — lista con rol/centros, búsqueda, editar, suspender.
- `components/admin/profile-centros-dialog.tsx` — centros del usuario (temporal con fecha fin).
- `components/admin/profile-edit-dialog.tsx` — datos y modo de acceso.
- `components/admin/rbac-settings.tsx` — roles, permisos (con precarga) y **Menú del rol**.
- `components/admin/access-dialog.tsx` — pestaña Menú **editable** (excepciones por usuario).
- `components/admin/menu-admin.tsx` — el permiso del ítem pasa a selector del catálogo.
- `lib/api/profiles.ts`, `lib/api/rbac.ts`, `lib/centros-scope.ts`.

## Qué verificar en pantalla (/admin)

1. **Usuarios**: se ven las columnas Rol(es) y Centro(s); un centro temporal muestra su fecha fin.
2. **Invitar**: elegir centro y rol en el mismo paso; el invitado entra ya operativo.
3. **Centros del usuario**: dar un temporal con fecha, revocarlo y volver a asignarlo (no debe
   dar error de duplicado).
4. **Roles → Permisos**: abrir y cerrar sin guardar; los permisos del rol **no** deben perderse.
5. **Roles → Menú**: marcar/desmarcar opciones y comprobar que el usuario con ese rol las ve.
6. **Accesos → Menú**: encender una opción que el rol NO da; el usuario la ve sin cambiar de rol.
7. **Suspender**: el usuario suspendido pierde el acceso en su siguiente petición (sin esperar a
   que caduque su sesión).

## Pendiente / backlog (no bloquea)

- Lectura combinada multicentro para no-admins (central de citas): requiere que cada servicio con
  `clinicId` filtre por `allowedClinicIds`; hoy solo lo hacen citas, ahora-mismo y centros.
- Vigencia en las excepciones de permisos.
- Dos ítems de menú que comparten el mismo permiso no se pueden alternar por separado.
- Unificar los dos editores de menú (`/admin` y `/configuracion/menu`).
