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

## Corrección tras investigar el RBAC con el token maestro (23-sep, mismo día)

Mi primera lectura («no tienen perfil/rol») era **incorrecta**. Con el maestro, `GET /profiles` muestra
que **los tres perfiles son IDÉNTICOS**: rol `atencion` (id 27203025-…) con `centerId` Caguas,
`status: aprobado`, `accessMode: operativo`, centro base Caguas `active:true`. **El rol SÍ está puesto**
en Laesi y Erikamari, igual que en Berkaira. No hay nada que «asignar».

## La causa real: el LOGIN no resuelve el perfil

- Berkaira: su login → `GET /auth/me` = **41 permisos** (funciona de punta a punta en el navegador).
- Laesi y Erikamari: su login (token válido, con la misma contraseña que dio el dueño) → `GET /auth/me`
  = **objeto vacío `{}` / 0 permisos**, en Caguas y en Bayamón.

O sea: el token autentica, pero el BE **no encuentra un perfil para ese `auth.users.id`**. El perfil
existe (con su email, rol y centro) pero está **enlazado a otro `authUserId`** (o a ninguno) distinto del
usuario de Supabase con el que estas dos entran hoy. Es un desajuste de **enlace auth↔perfil**, no de RBAC
ni de FE. Probable origen: la cuenta de Supabase se (re)creó aparte del perfil (nuevo `sub`), o el invite
no cerró el enlace de vuelta.

## Conclusión

- **No es del FE.** El botón «Editar» solo se gatea por `pacientes.update` (sin gate por nombre de rol),
  y el flujo completo funciona para quien SÍ resuelve perfil (Berkaira, verificado de punta a punta).
  El `AccionesModal` pinta `kind:"link"` y resuelve `:pacienteId`; no hay guardián de ruta.
- **Es del BE:** re-enlazar el `auth.users.id` REAL de Laesi y Erikamari (las cuentas que usa el dueño)
  a sus perfiles ya existentes, para que `GET /auth/me` resuelva sus 41 permisos como Berkaira. Y auditar
  al resto del personal de Atención por el mismo síntoma (`/auth/me` vacío pese a tener perfil aprobado).

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

## Cierre (23-sep, dato autoritativo del BE — corrige lo anterior)

El BE lo comprobó con acceso directo a Supabase + auth logs: **los tres perfiles están bien enlazados**
a su usuario real de Supabase, y **Erikamari entra bien con sus 41 permisos**, igual que Berkaira. Mis
lecturas de «0 permisos / auth/me vacío» para Erikamari salieron **falseadas por el rate-limit de Supabase**
(tantos mint de token seguidos), no eran reales — retiro esa parte del diagnóstico.

**Lo único que falla es Laesi, y es la CONTRASEÑA** (Supabase: `invalid_credentials`). Su cuenta está
confirmada y entró el 21-sep, así que probablemente la cambió ella. Acción: restablecer su contraseña
(a la de la lista, o enviar enlace de set-password para que ponga la suya). No hay nada que tocar en FE
ni en RBAC.
