# Handoff FE — UNIFICAR la ruta del frontdesk bajo el patrón /tablero/[clave]

> **Fecha:** 2026-07-22 · **Origen:** BE/arquitectura · **Destino:** FE cmr-fe
> **Status:** SOLICITADO · **Prioridad:** alta (regla del dueño: UN MISMO PATRÓN para todo lo que sea
> tableros de servicios; solo el header/contenido puede diferir).

## 1. Problema (verificado en el código FE)

Hoy conviven DOS patrones de ruta para tableros:
- `app/(app)/tablero/[clave]` → ruta GENÉRICA del builder (p. ej. `/tablero/atencion`, `/tablero/citas`).
- `app/(app)/frontdesk` → página BESPOKE (`/frontdesk`) con tabs por servicio, 2 fechas y "Citar".

Es una inconsistencia: el frontdesk ES un tablero del builder (plan de convergencia "todo bajo el
builder") y debe vivir en el MISMO patrón de URL que el resto.

## 2. Lo requerido (regla del dueño, 2026-07-22)

1. La ruta canónica del frontdesk pasa a ser **`/tablero/frontdesk`** (mismo patrón `tablero/[clave]`).
2. **El header/las particularidades PUEDEN diferir** (tabs por servicio, doble fecha para gerencia, botón
   Citar): la ruta genérica `tablero/[clave]` puede renderizar un layout específico según la metadata del
   tablero (p. ej. `tableros.entidad === 'sesion'`/clave `frontdesk` → monta el componente frontdesk actual).
   El PATRÓN de URL es lo innegociable; el contenido se resuelve por dato, no por ruta especial.
3. `/frontdesk` queda como **redirect 308 → `/tablero/frontdesk`** (no romper enlaces/bookmarks existentes).
4. `lib/nav-manifest.ts`: la entrada `nav.frontdesk` apunta a `/tablero/frontdesk`.
5. Cualquier tablero de servicios futuro nace bajo `tablero/[clave]` — prohibido crear rutas bespoke nuevas.

## 3. Criterios de aceptación

1. `/tablero/frontdesk` muestra el frontdesk completo (tabs, fechas, Citar) igual que hoy.
2. `/frontdesk` redirige a `/tablero/frontdesk` (308).
3. `/tablero/atencion` y demás tableros intactos (canario).
4. Menú actualizado; i18n intacto; typecheck/lint/build verdes; deploy a Vercel.

## 4. Notas

- No requiere cambios de BE (las APIs `/frontdesk/*` del BE no cambian; esto es SOLO ruta/URL del FE).
- Registrar la decisión: el patrón de URL de tableros es `tablero/[clave]` — las diferencias de UI viven
  en el render por metadata, nunca en la forma de la URL.
