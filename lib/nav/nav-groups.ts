// Construcción de los grupos del rail de navegación. Los ítems llegan del menú
// del BE (`GET /me/menu`, ver lib/api/menu.ts `MenuItem`): una lista PLANA, ya
// filtrada por permiso/visibilidad y con el label (labelCustom por-centro).
//
// Desde el route-reorg Phase 2 la ESTRUCTURA es FE-OWNED: cada destino se agrupa
// por su `group` del manifiesto (lib/nav/manifest.ts) y se ordena por su `order`,
// NO por el `parentClave`/`orden` del BE. El BE solo decide QUÉ se ve; el FE decide
// DÓNDE y en qué ORDEN. Reglas:
//   1. Filtro de permiso en el FE (belt-and-suspenders; el BE ya filtró).
//   2. Solo destinos reales (tipo item con ruta); las cabeceras de grupo del BE
//      (`tipo grupo` / clave `g-*`) y los separadores se descartan (el FE pone
//      sus propias cabeceras).
//   3. Cada destino se mete en el bucket de su `groupForClave`. Un clave que el
//      manifiesto NO conoce (tableros dinámicos, ítems futuros del BE) cae en un
//      bucket sintético por su `parentClave` del BE, etiquetado con el label del
//      grupo del BE — así nada se pierde; esos grupos van DESPUÉS de los 9 fijos.
//   4. Se emiten los grupos FE en el orden de NAV_GROUPS (solo los no vacíos),
//      seguidos de los buckets de fallback.

import { NAV_GROUPS, groupForClave, orderForClave } from "./manifest.ts";

export type NavMenuTipo = "item" | "grupo" | "separador";

// Subconjunto de lib/api/menu.ts `MenuItem` que necesita la construcción del árbol.
export type NavMenuItem = {
  slug: string;
  labelKey: string;
  customLabel?: string | null;
  type?: NavMenuTipo;
  icon?: string | null;
  showIcon?: boolean;
  path: string;
  parentSlug?: string | null;
  permissionSlug?: string | null;
};

export type NavNode = NavMenuItem & { children: NavNode[] };

// Raíces sueltas que NO se pintan como hoja de dominio: home es el link del logo,
// dashboard es un volcado de diagnóstico solo-admin.
const NOT_SURFACED = new Set(["home", "dashboard"]);

export function buildNavGroups(
  items: NavMenuItem[],
  can: (permiso: string) => boolean,
): NavNode[] {
  // 1. Filtro de permiso (cosmético): sin permisoClave => siempre visible.
  const visible = items.filter((i) => !i.permissionSlug || can(i.permissionSlug));

  // 2. Solo destinos reales (se descartan cabeceras de grupo, separadores y raíces sueltas).
  const destinations = visible.filter(
    (i) =>
      i.type !== "grupo" &&
      i.type !== "separador" &&
      !!i.path &&
      i.path !== "#" &&
      !NOT_SURFACED.has(i.slug),
  );

  // Filas contenedoras del catálogo del BE (para etiquetar los buckets de fallback):
  // `tipo grupo`, prefijo `g-`, o un contenedor con path "#"/vacío (p. ej. los buckets
  // `en-desarrollo`/`por-desarrollar` del catálogo — decisión «accesos los decide el frontend»).
  const beParents = new Map<string, NavMenuItem>();
  for (const i of visible) {
    if (i.type === "grupo" || i.slug.startsWith("g-") || !i.path || i.path === "#") {
      beParents.set(i.slug, i);
    }
  }

  // 3. Bucketizar por grupo FE; clave desconocida => bucket sintético `be:<parentClave>`.
  const buckets = new Map<string, NavNode[]>();
  const push = (key: string, node: NavNode) => {
    const arr = buckets.get(key);
    if (arr) arr.push(node);
    else buckets.set(key, [node]);
  };
  for (const i of destinations) {
    const feGroup = groupForClave(i.slug);
    const key = feGroup ?? (i.parentSlug ? `be:${i.parentSlug}` : "be:_orphan");
    push(key, { ...i, children: [] });
  }

  // Ordenar dentro de cada bucket FE por el `order` del manifiesto (los buckets
  // de fallback conservan el orden de llegada del BE).
  for (const [key, arr] of buckets) {
    if (!key.startsWith("be:")) {
      arr.sort((a, b) => orderForClave(a.slug) - orderForClave(b.slug));
    }
  }

  // Cada raíz de sección lleva un icono (todas las categorías de primer nivel lo muestran):
  // el del grupo FE, o —para buckets de fallback— el del contenedor del BE, o "folder" por defecto.
  const groupRoot = (
    slug: string,
    labelKey: string,
    icon: string,
    children: NavNode[],
  ): NavNode => ({
    slug,
    labelKey,
    icon,
    showIcon: true,
    type: "grupo",
    path: "#",
    children,
  });

  const out: NavNode[] = [];
  // 4a. Grupos FE en orden de taxonomía, solo los no vacíos.
  for (const g of NAV_GROUPS) {
    const children = buckets.get(g.key);
    if (children && children.length > 0) out.push(groupRoot(g.key, g.labelKey, g.icon, children));
  }
  // 4b. Buckets de fallback (tableros dinámicos / desconocidos) al final.
  for (const [key, children] of buckets) {
    if (!key.startsWith("be:") || children.length === 0) continue;
    const parentClave = key.slice("be:".length);
    const parent = beParents.get(parentClave);
    out.push(groupRoot(parentClave, parent?.labelKey ?? parentClave, parent?.icon ?? "folder", children));
  }
  return out;
}
