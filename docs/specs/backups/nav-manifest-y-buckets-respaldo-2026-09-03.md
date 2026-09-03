# Respaldo — el menú deja de escribirse a mano (2026-09-03)

## Por qué existe este respaldo

Hasta hoy la barra lateral (`components/app-sidebar.tsx`) se armaba con DOS fuentes:

1. El menú del BE ya filtrado (`GET /me/menu`) → los grupos de dominio (g-agenda, g-facturación, …).
2. Una **lista de rutas escrita a mano** (`lib/nav-manifest.ts`) + otra lista a mano dentro del
   sidebar (`REAL_ROUTES` + `hasPage`) → los buckets **«En desarrollo / Por desarrollar»** que solo
   veía el admin, para no perder páginas que aún no estaban registradas en el catálogo del BE.

La decisión del dueño **«Los accesos y los módulos los decide el frontend»**
([../accesos-los-decide-el-frontend.md](../accesos-los-decide-el-frontend.md), 2-sep-2026) dice que
**el catálogo de menú es DATO**: el frontend recorre el catálogo COMPLETO (`GET /menu`) y muestra cada
ítem si su `permisoClave` está en los permisos efectivos (o el usuario tiene `*`). Escribir la lista de
módulos a mano es justo lo que la nota pide evitar: *«añadir un módulo no puede exigir un despliegue
del frontend»*. Por eso se retira el manifiesto como FUENTE de la barra y se pasa a construirla desde
`GET /menu` + `permissions`.

## Qué cambió (para poder revertir)

- **`components/app-sidebar.tsx`**: se quitan `NAV_MANIFEST`, `REAL_ROUTES`, `KNOWN_ROUTES`, `hasPage`,
  `manifestItems`, `allItems`, `devGroups` y el gate `puedeVerCatalogoCompleto`/`isAdmin`. La barra queda
  = `buildNavGroups(menu, can)`, donde `menu` ahora viene del catálogo completo filtrado por permisos.
- **`hooks/use-menu.ts`**: la fuente pasa de `GET /me/menu` a `GET /menu` (catálogo completo) filtrado en
  el cliente por `permissions` (`lib/nav/menu-access.ts`). Si `/menu` falla, cae a `/me/menu` (equivalente).
- **`lib/nav/nav-groups.ts`**: `isGroupRoot` también reconoce contenedores con `path` `#`/vacío y con hijos
  (para que el bucket `en-desarrollo` del catálogo se pinte como grupo).
- **`lib/nav-manifest.ts`**: YA NO alimenta la barra. Se conserva SOLO como paleta de rutas del **editor de
  menú** (`components/configuracion/menu-editor.tsx`), para sugerir rutas reales de la app al registrar un
  ítem en el catálogo.
- **Buckets admin-only**: antes se gateaban con `isAdmin` (un chequeo por ROL, que la nota prohíbe). Ahora
  el bucket `en-desarrollo` del catálogo se gatea con el permiso `menu.desarrollo` — permiso, no rol.

Enlaces: la nueva decisión → [../accesos-los-decide-el-frontend.md](../accesos-los-decide-el-frontend.md).
Handoff con las páginas huérfanas a colocar en el catálogo definitivo →
[../nav-catalogo-huerfanas-handoff-be.md](../nav-catalogo-huerfanas-handoff-be.md).

## Contenido ANTERIOR de `lib/nav/nav-manifest` como FUENTE de la barra (verbatim)

La lista de 51 rutas que armaba los buckets vivía en `lib/nav-manifest.ts`. Se conserva ese archivo
(reusado por el editor), así que su contenido no se pierde; este respaldo documenta el PORQUÉ del cambio.

## Lógica de buckets eliminada de `app-sidebar.tsx` (verbatim, por si hay que revertir)

```tsx
const puedeVerCatalogoCompleto = !!session && isAdmin(session);
const REAL_ROUTES = [
  "/dashboard","/inventario","/clientes","/citas","/facturacion","/tablero",
  "/inventario/productos","/inventario/proveedores","/inventario/presentaciones-proveedor",
  "/inventario/recibir-compra","/inventario/recetas","/precios","/servicios","/comunicaciones",
  "/admin","/configuracion/tableros","/settings",
];
const KNOWN_ROUTES = [...REAL_ROUTES, ...NAV_MANIFEST.map((r) => r.path)];
const hasPage = (p) => p === "/" || KNOWN_ROUTES.some((r) => p === r || p.startsWith(r + "/") || p.startsWith(r));
const navItems = menu.filter((m) => !!m.path && m.path !== "#" && m.clave !== "en-desarrollo" && m.clave !== "por-desarrollar");
const bePaths = new Set(navItems.map((m) => m.path));
const manifestItems = puedeVerCatalogoCompleto
  ? NAV_MANIFEST.filter((r) => !bePaths.has(r.path)).map((r) => ({ clave: `manifest:${r.path}`, labelKey: r.labelKey, path: r.path }))
  : [];
const allItems = [...navItems.map((m) => ({ clave: m.clave, labelKey: m.labelKey, path: m.path })), ...manifestItems];
const devGroups = puedeVerCatalogoCompleto
  ? [
      { clave: "en-desarrollo", labelKey: "nav.en_desarrollo", items: allItems.filter((m) => hasPage(m.path)) },
      { clave: "por-desarrollar", labelKey: "nav.por_desarrollar", items: allItems.filter((m) => !hasPage(m.path)) },
    ].filter((g) => g.items.length > 0)
  : [];
```
