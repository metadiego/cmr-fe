# Handoff BE — usuarios de Atención SIN perfil/rol (no es del FE)

**De:** cmr-fe. **Fecha:** 2026-09-23. Cierra la investigación de `no-pueden-editar-el-paciente-no-es-del-be.md`.

## Lo verificado (tokens reales de los 3 usuarios que dio el dueño, contra prod)

El dueño dio tres cuentas de Atención. **Una funciona, dos NO** — y la razón no es el permiso de
paciente, es que **no tienen perfil/rol enlazado**:

| Usuario | `GET /auth/me` (con y sin X-Tenant-ID) | Puede editar |
|---|---|---|
| Berkaira Concepción | **41 permisos**, incluye `pacientes.update`, `activeClinicId` = Caguas | **Sí** (probado en navegador: acciones → Editar Paciente → ficha → botón Editar → formulario abre) |
| Laesi Martínez | **`/auth/me` = objeto VACÍO `{}`** (sin roles, sin profileId, 0 permisos) en Caguas y Bayamón | No (el FE no pinta nada porque no hay permisos) |
| Erikamari Rodríguez | **0 permisos** en Caguas y Bayamón | No |

Login (Supabase) de los tres funciona y devuelve token. El fallo es después: para Laesi y Erikamari
el BE **no resuelve un perfil** — su `auth.users` existe pero no está vinculado a un `personal`/perfil
con rol. Berkaira sí.

## Conclusión

- **No es del FE.** El botón «Editar» solo se gatea por `pacientes.update` (sin gate por nombre de rol),
  y el flujo completo funciona para quien SÍ tiene el permiso (Berkaira, verificado de punta a punta).
  El `AccionesModal` pinta `kind:"link"` y resuelve `:pacienteId` correctamente; no hay guardián de ruta.
- **Es del BE/RBAC (dato):** Laesi y Erikamari quedaron con cuenta de Supabase pero sin perfil/rol.
  El invite que enlaza la cuenta al `personal` y le da el rol `atencion` no se completó para ellas.

## Lo que pide el dueño

> «Todos los que tengan acceso a ese módulo deben tener el mismo privilegio, a MENOS que yo diga que no.»

Es decir: **igualar a Laesi y Erikamari con Berkaira** — vincular su cuenta al `personal` y asignarles el
rol `atencion` (el mismo con `pacientes.read/create/update`). Se puede hacer desde la pantalla de Accesos
del FE (invitar/enganchar a persona ya dada de alta + rol), o en el BE. **Revisar además el resto del
personal de Atención** por si hay más cuentas sin perfil/rol (mismo síntoma: `/auth/me` vacío).

## Para el FE (mejora defensiva, opcional)

Cuando `/auth/me` vuelve **vacío** (usuario autenticado pero sin perfil), la app hoy no lo distingue de
«sin permisos» y simplemente esconde todo, dejando al usuario sin pistas. Valorar un aviso claro
(«Tu cuenta no tiene un perfil asignado; contacta a un administrador») en vez de una pantalla muda.
