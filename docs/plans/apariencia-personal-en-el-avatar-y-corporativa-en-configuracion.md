# Plan — Apariencia personal en el avatar + corporativa en Configuración

Deriva de `docs/specs/apariencia-personal-en-el-avatar-y-corporativa-en-configuracion.md`.
Revisión previa del código real de este repo:

- `app/(app)/settings/appearance/page.tsx` — pantalla PERSONAL: lee/escribe `PUT /me/preferences` y monta
  `ThemeEditor`. Se reusa tal cual; no se toca su comportamiento.
- `components/theme/theme-editor.tsx` — el editor. Hoy no sabe de capas: recibe un `config` y devuelve el
  editado. Es justo lo que hace falta para reusarlo.
- `components/site-header.tsx` — el menú del avatar (ahí están «Tu sesión» y «Cerrar sesión»).
- `lib/api/` — cliente generado; `preferences` necesita sus funciones para las capas corporativas.
- El ítem de menú `configuracion-apariencia` lo sirve el BE apuntando a `/settings/appearance`: hay que
  cambiarlo a `/configuracion/apariencia` (eso es un cambio de DATO en el BE, se pide o se hace allí).

## Pasos

1. **Avatar**: entrada «Apariencia» → `/settings/appearance`, sin permiso, en el menú del avatar. i18n.
2. **Cliente de API**: funciones para `GET/PUT /preferences/system`, `GET/PUT /preferences/centro/:id`,
   `GET/POST /preferences/override`, `DELETE /preferences/override/:id`, en `lib/api/preferences.ts`
   (junto a las de `me/preferences`, sin duplicar el cliente).
3. **Pantalla corporativa** `/configuracion/apariencia` con las tres secciones, reusando `ThemeEditor`.
   Al guardar: leer la capa, **mezclar** solo las claves de tema y escribir; nunca pisar el sobre entero.
4. **Permisos**: sistema y centro para admin; overrides para super_admin. Ocultar por permiso.
5. **TDD**: primero las pruebas — que guardar la capa `centro` conserva las claves ajenas; que sin
   permiso no se pinta la sección; que el override avisa de que pisa a todos.
6. **i18n** completo (es/en). Sin cadenas en los componentes.
7. `npx tsc --noEmit` y `npm run build` verdes.
8. **/review** del diff antes de mezclar a main, y **/qa** con navegador real: cambiar mi tema desde el
   avatar, cambiar el del sistema como admin, crear y quitar un override.
9. Menú: pedir al BE que el ítem de Configuración apunte a `/configuracion/apariencia`.

## Riesgo

El `config` de la capa `centro` **también lleva ajustes de negocio** (`facturacion.*`). Guardar sin
mezclar los borraría. El paso 5 lo fija con una prueba antes de escribir el código.
