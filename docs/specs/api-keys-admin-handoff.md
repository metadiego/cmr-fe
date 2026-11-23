# Handoff — pantalla «API keys» (Administración › API keys)

Fecha: 20-nov-2026. BE: cmr-be#656 (`docs/specs/api-keys-admin.md`). FE: rama `feat/api-keys-admin`.

## Qué es

Las API keys son las contraseñas de máquinas y scripts (básculas, print hubs, puente telefónico,
iPads, integraciones). Hasta hoy no había pantalla para verlas ni para revocarlas. Esta pestaña sirve
para verlas, limpiar las que nadie usa y crear nuevas.

## Dónde

`/admin/api-keys`, pestaña de «Personal y accesos», solo para administradores (como Roles, Permisos,
Menú). No necesita fila en `menu_items`: hereda la puerta de `/admin`.

## Contrato (BE)

| Llamada | Para qué |
|---|---|
| `GET /api-keys?status=all` | La lista (también `active`, `revoked`, `expired`; sin `status` = todas, como antes). Trae `lastUsedAt` (null = nunca usada). |
| `POST /api-keys` `{ name, permissions, scope, clinicId?, expiresAt? }` | Crea; la respuesta trae `plainKey` UNA vez. `scope: admin` = todos los centros; `clinic` + `clinicId` = un centro. `'*'` solo en `admin`. |
| `DELETE /api-keys/:id` | Revoca. Pasa por el escudo: 428 `api_keys.revoke` → `apiFetch` ya muestra el diálogo y repite. |

Errores con `labelKey` (en `messages/*.json`): `apiKeys.clinicKeyTooBroad`, `apiKeys.beyondCreator`,
`apiKeys.cannotRevokeSelf`. Acción del escudo: `confirmation.action.apiKeyRevoke` (con `{name}`).

## Pantalla

- Resumen: activas, con acceso total, nunca usadas (y cuántas de esas con acceso total).
- Tabla: nombre + prefijo, estado (`StatusBadge` kind `apiKey`: En uso / Nunca usada / Caducada /
  Revocada), qué puede hacer (acceso total o la lista de permisos), centro, último uso, caducidad,
  creada. Orden: las nunca usadas con acceso total primero.
- Revocar: menú ⋮ de la fila → confirmación → escudo del BE.
- Nueva key: nombre, centro (o todos), caducidad opcional, acceso total (solo «todos los centros») o
  permisos del catálogo. Después enseña la key con «Copiar» y avisa de que no se vuelve a mostrar.
  Enter no envía (es dar acceso).

Lógica pura con prueba: `lib/api-keys/key-status.ts`, `lib/api-keys/create-missing.ts`.

## Orden de despliegue

Primero cmr-be#656 (si el FE va antes, la lista funciona —el BE viejo ignora `status`— pero revocar
no pregunta en el BE). Luego este PR.

## Todos los centros (corrección, 23-nov-2026)

Las llamadas de `lib/api/api-keys.ts` **no mandan `X-Tenant-ID`** (`tenant: null`): con el centro de
la barra superior, el BE acotaba al admin a ese centro y la pestaña solo enseñaba las keys de ese
centro (ninguna de «todos los centros», que son las de acceso total). Revocar una de las ocultas
daba 404, y una key de «todos los centros» creada con un centro activo quedaba atada a él (eso se
corrige también en el BE).
