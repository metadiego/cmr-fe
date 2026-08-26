# Plan — Sidebar de navegación (beta, opcional)

Deriva de la propuesta visual evaluada como prototipo (Artifact, sin código real):
https://claude.ai/code/artifact/b0a1a34b-3678-475b-8e93-a58845a673cf

El dueño aprobó desarrollarlo con una condición explícita: **sin dañar nada** — la barra clásica
sigue siendo el default e intacta; el sidebar es opt-in, con retorno instantáneo.

## Cómo se implementó (sin tocar `site-header.tsx`)

- `hooks/use-nav-vista.ts` — preferencia POR DISPOSITIVO (`localStorage`, mismo patrón que
  `components/agenda/dia-view.tsx` → `VISTA_KEY`): `"clasica"` (default) | `"sidebar"`.
- `components/app-shell.tsx` — único punto que decide el chrome. Si `vista !== "sidebar"`, renderiza
  EXACTAMENTE `<SiteHeader /><main>{children}</main>` — cero cambio de comportamiento para quien no
  activa el beta. `children` se monta una sola vez en cualquiera de las dos ramas (evita re-disparar
  fetches/streams de la página).
- `components/nav-sidebar.tsx` — el sidebar. Mismos datos (`useMenu()`) que la barra clásica, pero
  **no importa nada de `site-header.tsx`**: duplica a propósito la construcción del árbol de menú
  (grupos de dominio + herramientas de desarrollo) para que esta beta no pueda romper la barra
  clásica ni al revés. Si el sidebar se adopta como default, unificar esa lógica en un hook
  compartido es el siguiente paso natural — no se hizo ahora para minimizar el blast radius.
  En mobile (`<md`) sigue mostrando la barra clásica con su Sheet de siempre; el sidebar es solo
  desktop en esta beta.
- Colores: **cero paleta nueva**. Todo usa las clases semánticas de Tailwind que ya usa el resto de
  la app (`bg-background`, `text-muted-foreground`, `bg-primary`, `border`, etc.), así que hereda
  automáticamente la Apariencia configurada (personal y corporativa) — no hay nada que mantener en
  paralelo.
- El toggle vive en el menú del avatar (`components/user-menu.tsx`), como una sección nueva e
  insertada sin tocar ninguna línea existente de ese archivo — mismo patrón visual que Tema/Idioma.
  Dentro del propio sidebar también hay un enlace chico "Volver a la barra clásica" para no depender
  solo del menú del avatar.
- "En desarrollo"/"Por desarrollar" (herramientas de admin, van a desaparecer eventualmente per el
  dueño) bajan a un `<details>` colapsado al fondo del sidebar, visible solo si `isAdmin`.

## Respaldo / cómo revertir

1. **Instantáneo, sin código**: el toggle del avatar vuelve a "Barra clásica" al instante — nadie
   necesita esperar un deploy para volver atrás.
2. **De código**: el feature vive en 3 archivos nuevos + 2 archivos existentes con inserciones
   puramente aditivas (`app/layout.tsx` cambia 2 líneas: `SiteHeader`+`main` → `AppShell`;
   `user-menu.tsx` solo agrega un bloque, no modifica ninguno existente). `git revert` del commit
   alcanza sin tocar nada más.

## Qué falta / próximos pasos posibles (no bloqueantes)

- Sidebar para mobile (hoy cae a la barra clásica ahí).
- Unificar la construcción del árbol de menú con `site-header.tsx` si el sidebar gana adopción.
- Colapsar/recordar qué grupos quedaron abiertos (hoy siempre abren todos por default en cada carga).
- Sincronizar la preferencia entre dispositivos (hoy es post-dispositivo, `localStorage`) si se
  quiere — usaría el mismo mecanismo de `/me/preferences` que ya existe para Apariencia.
