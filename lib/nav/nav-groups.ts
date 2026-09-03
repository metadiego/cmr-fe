// Construcción PURA de los grupos de navegación del rail — extraída de la lógica
// que vivía inline en components/site-header.tsx (y replicada en el sidebar beta).
// Los ítems llegan del menú del BE (`GET /me/menu`, ver lib/api/menu.ts `MenuItem`):
// una lista PLANA, ya ordenada por `orden` y ya filtrada por permiso/visibilidad
// del lado del servidor. Aquí:
//   1. Se filtra por permiso en el FE (belt-and-suspenders, cosmético): un ítem se
//      ve si NO tiene `permisoClave` O `can(permisoClave)` es true. El BE ya filtró,
//      así que para un FE sincronizado esto no cambia nada — pero deja el criterio de
//      visibilidad explícito y testeable.
//   2. Se anida por `parentClave` (soporta N niveles).
//   3. Se devuelven SOLO las raíces de grupo (`tipo === "grupo"` o clave con prefijo
//      `g-`) que conservan al menos un hijo visible. Un grupo vacío NO se pinta: un
//      contenedor sin destinos sugiere un acceso que no existe.

export type NavMenuTipo = "item" | "grupo" | "separador";

// Subconjunto de lib/api/menu.ts `MenuItem` que necesita la construcción del árbol.
export type NavMenuItem = {
  clave: string;
  labelKey: string;
  labelCustom?: string | null;
  tipo?: NavMenuTipo;
  icon?: string | null;
  mostrarIcono?: boolean;
  path: string;
  parentClave?: string | null;
  permisoClave?: string | null;
};

export type NavNode = NavMenuItem & { children: NavNode[] };

// ¿La raíz es un grupo (contenedor sin destino propio)? `tipo === "grupo"` (cmr-be PR #230),
// el prefijo `g-` por compatibilidad, o un contenedor cuyo `path` es "#"/vacío — así los buckets
// del catálogo (`en-desarrollo`, `por-desarrollar`, path "#") se pintan como sección plegable en
// vez de como enlace muerto. Una hoja con ruta real (home "/", dashboard "/dashboard") NO es grupo.
function isGroupRoot(node: NavMenuItem): boolean {
  return (
    node.tipo === "grupo" ||
    node.clave.startsWith("g-") ||
    !node.path ||
    node.path === "#"
  );
}

export function buildNavGroups(
  items: NavMenuItem[],
  can: (permiso: string) => boolean,
): NavNode[] {
  // 1. Filtro de permiso (cosmético): sin permisoClave => siempre visible.
  const visible = items.filter((i) => !i.permisoClave || can(i.permisoClave));

  // 2. Anidar por parentClave preservando el orden de llegada.
  const byClave = new Map<string, NavNode>();
  for (const i of visible) {
    byClave.set(i.clave, { ...i, children: [] });
  }
  const roots: NavNode[] = [];
  for (const i of visible) {
    const node = byClave.get(i.clave)!;
    const parent = i.parentClave ? byClave.get(i.parentClave) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // 3. Solo raíces de grupo con hijos visibles.
  return roots.filter((r) => isGroupRoot(r) && r.children.length > 0);
}
