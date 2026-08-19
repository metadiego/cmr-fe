# Apariencia: la personal en el avatar, la corporativa en Configuración

## Decisión del dueño (19-ago-2026)

Son **dos cosas distintas** y viven en dos sitios distintos:

1. **Apariencia PERSONAL** — «mis colores, mi vista». Se llega desde el **menú del avatar**, y la tiene
   **todo usuario y todo rol**, incluido el administrador (*«el mismo administrador puede tener sus
   propios colores»*).
2. **Apariencia CORPORATIVA** — la del sistema y la de cada centro, más los **overrides** temporales que
   pisan la de todos. Se queda en **Configuración**, porque es donde se administra el negocio.

Ambas se quedan: la personal sale al avatar y en Configuración queda la corporativa.

## Lo que ya existe (comprobado en producción, 19-ago)

El BE tiene las **cuatro capas** y se mezclan en este orden: `sistema → centro → usuario → override`.
El override activo es el último y por eso puede pisar a todos.

| capa | endpoint | quién |
|---|---|---|
| usuario | `GET/PUT /api/v1/me/preferences` | cualquier usuario autenticado (lo suyo) |
| sistema | `GET/PUT /api/v1/preferences/system` | admin / super_admin |
| centro | `GET/PUT /api/v1/preferences/centro/:id` | admin / super_admin |
| override | `GET/POST /api/v1/preferences/override`, `DELETE /api/v1/preferences/override/:id` | super_admin |
| efectiva pública | `GET /api/v1/preferences/public` | sin sesión (login, marca) |

Respuestas reales de hoy: `system` → `{"colors":{"background":"#2e408c"},"radius":"0.625rem"}`;
`override` → `[]` (ninguno activo); `centro/<caguas>` → `{"facturacion":{"exigirCobroAntesDeEmitir":true}}`
(el `config` es un JSONB libre: el mismo sobre lleva tema y ajustes de negocio).

En el FE existe **solo la personal**: `app/(app)/settings/appearance/page.tsx`, que guarda con
`PUT /me/preferences` y usa `components/theme/theme-editor.tsx`. **No hay pantalla corporativa.**

## Qué se construye

### A. Acceso desde el avatar (personal) — para todos los roles

En el menú del avatar, junto a «Tu sesión» y «Cerrar sesión», una entrada **Apariencia** que lleva a
`/settings/appearance`. Sin permiso: es preferencia propia, la tiene cualquiera con sesión.

### B. Pantalla corporativa en Configuración

`/configuracion/apariencia`, con tres secciones y **el mismo editor** que la personal (no se duplica el
componente, se le pasa de qué capa lee y a dónde escribe):

1. **Sistema** — lo que ven todos por defecto. `GET/PUT /preferences/system`.
2. **Por centro** — selector de centro y su capa. `GET/PUT /preferences/centro/:id`.
3. **Overrides** — lista de los activos, crear y desactivar. `GET/POST /preferences/override`,
   `DELETE /preferences/override/:id`. Se explica en pantalla que **pisa a todos** mientras esté activo.

Visible solo para quien puede: las dos primeras para admin, la de overrides para super_admin. Se oculta
por permiso, no por nombre de rol.

## Reglas

- **No duplicar**: un solo `ThemeEditor`, parametrizado por capa. La pantalla personal no cambia de
  comportamiento.
- **i18n**: todos los textos nuevos en `messages/es.json` y `messages/en.json`.
- **El `config` es un sobre libre**: el FE solo toca las claves de tema (`colors`, `radius`, fondo) y
  **conserva el resto** al guardar (en `centro` conviven ajustes de facturación: si se pisan, se rompe el
  negocio). Leer, mezclar, escribir.
- **Uso de la pantalla**: ancho completo, secciones en pestañas o columnas; sin desperdiciar los lados.
- **Vista previa** antes de guardar, y aviso claro de a quién afecta cada capa.

## Qué se considera terminado

- Cualquier usuario, con cualquier rol, llega a su apariencia desde el avatar y guarda sus colores.
- Un admin cambia la del sistema o la de un centro desde Configuración y se ve el efecto tras recargar.
- Un super_admin crea un override, se ve que manda sobre todo, lo desactiva y vuelve lo anterior.
- Guardar la capa `centro` **no borra** `facturacion.exigirCobroAntesDeEmitir` ni otras claves ajenas.
