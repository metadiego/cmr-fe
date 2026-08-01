# BE Handoff (petición amable) — Menú de usuario: nombre + perfil/preferencias/notificaciones

> Contexto FE: ya está en prod el **menú del avatar** (Tema, Idioma, Ajustes de la app, Cerrar
> sesión) y el buscador retráctil. El hover del avatar muestra hoy el **email** porque es lo único
> que expone `GET /auth/me`. Para completar la idea necesitamos, cuando gusten, tres piezas del BE.
> Todo API-First + Swagger + `COMMENT ON` en tablas/campos + multi-tenant + RBAC, sin hardcode.

## 1. Nombre visible del usuario (rápida, alto impacto)
Agregar el nombre propio del usuario a `GET /auth/me` (y donde vive el perfil):

- `nombre` (o `displayName`) — texto, opcional. `COMMENT ON`: "Nombre visible del usuario para la
  UI (hover del avatar, saludos). Si es null, el FE usa la parte antes de @ del email."
- Ideal también: `nombreCompleto`/`iniciales` si ya existen en `personal`/`perfil`.

FE lo consume sin más cambios: hoy hace fallback a `email.split('@')[0]`.

## 2. Perfil y preferencias del usuario (persistencia)
Pantalla "Perfil y preferencias" (hoy marcada *próximamente* en el menú). Pedimos endpoints para
**leer y guardar** preferencias por usuario (no por centro; el usuario las lleva entre centros):

- `GET /me/preferences` → `{ theme: 'light'|'dark'|'system', locale: 'es'|'en', ... }`
- `PUT /me/preferences` (parcial) → idem. RBAC: el propio usuario.
- Campos con `COMMENT ON`. Enum de `theme`/`locale` como **dato** (no hardcode en el FE): si
  exponen `GET /me/preferences/opciones` con los valores válidos, mejor aún (configurable).

Nota: hoy el FE persiste `locale` por cookie y `theme` por `next-themes` (localStorage). Con esto
quedarían **atados al usuario** en el servidor (multi-dispositivo).

## 3. Notificaciones (ajustes)
Toggles de notificaciones por canal/tipo, data-driven:

- `GET /me/notification-settings` → lista de `{ clave, labelKey, canal, activo }` (el FE pinta
  los toggles según lo que devuelvan — sin hardcode de tipos).
- `PUT /me/notification-settings/:clave` → `{ activo }`. RBAC: el propio usuario.

## 4. Avatar (opcional, si no existe ya)
`avatarUrl` ya viene en `/auth/me`. Si falta el **subir/cambiar** avatar:
- `PUT /me/avatar` (multipart o URL firmada de Supabase Storage) → devuelve `avatarUrl`.

## Prioridad sugerida
1) Nombre (#1) — desbloquea el hover y saludos ya mismo.
2) Preferencias (#2) — tema/idioma atados al usuario.
3) Notificaciones (#3) y Avatar (#4) — cuando haya espacio.

Gracias 🙏 — con esto el menú del avatar queda completo y todo data-driven.
