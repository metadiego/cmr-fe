// lib/nav/manifest.ts
//
// FE-OWNED nav manifest: the single source of truth mapping a BE menu `clave`
// (GET /me/menu → lib/api/menu.ts MenuItem.clave) to the FE route it should link
// to. Introduced by the route-reorg Phase 0 to DECOUPLE the FE URL structure
// from BE `menu_items.path` — the FE no longer renders `path` verbatim.
//
// Phase 0 contract: every `route` here equals the clave's CURRENT path, so the
// rendered menu is byte-identical to before — EXCEPT `cambio-de-protocolo`,
// whose BE seed path (/pacientes/cambio-de-protocolo) 404s; we point it at the
// real FE folder (/pacientes/cambio-protocolo), fixing a live dead link.
// Later phases flip these `route` values to the new English paths, one category
// at a time; group/order ownership arrives in Phase 2.
//
// Dead/orphan seeded claves with no FE page (`caja` bare, `captacion-por-agente`,
// `ahora-mismo`) are intentionally ABSENT — the resolver's fallback returns their
// BE path so behavior is unchanged, without asserting them as real FE routes.

export type NavEntry = {
  clave: string; // matches BE menu_items.clave (stable join key; never user-visible)
  route: string; // FE-owned URL
};

export const NAV_MANIFEST: NavEntry[] = [
  // Agenda / pacientes
  { clave: "citas", route: "/scheduling/appointments" },
  { clave: "cupos", route: "/scheduling/slots" },
  { clave: "calendario", route: "/scheduling/calendar" },
  { clave: "atencion", route: "/tablero/atencion" },
  { clave: "clientes", route: "/clientes" },
  { clave: "cambio-de-protocolo", route: "/pacientes/cambio-protocolo" }, // FIX: BE seed 404s
  { clave: "comunicaciones", route: "/comunicaciones" },
  // Facturación / caja  (Phase 1: billing)
  { clave: "facturacion", route: "/billing/invoices" },
  { clave: "consultas", route: "/billing/consultations" },
  { clave: "grupos-facturacion", route: "/billing/groups" },
  { clave: "facturacion-devoluciones", route: "/billing/returns" },
  { clave: "consultas-devoluciones", route: "/billing/consultations/returns" },
  { clave: "consumo-insumos", route: "/reports/supply-consumption" },
  { clave: "caja-consulta", route: "/billing/cash/consultation" },
  { clave: "caja-general", route: "/billing/cash/general" },
  // Servicios / boards / reportes
  { clave: "frontdesk", route: "/tablero/frontdesk" },
  { clave: "servicios", route: "/tablero/servicios" },
  { clave: "panel-enfermeria", route: "/panel/enfermeria" },
  { clave: "config-formatos", route: "/configuracion/formatos" },
  { clave: "estadisticas-servicios", route: "/estadisticas/servicios" },
  { clave: "estadisticas-diarias", route: "/estadisticas/diarias" },
  { clave: "ventas-por-grupo", route: "/reports/sales-by-group" },
  { clave: "ventas-por-usuario", route: "/reports/sales-by-user" },
  // Inventario → Inventory (Phase 1)
  { clave: "inventario-index", route: "/inventory" },
  { clave: "inventario-existencias", route: "/inventory/stock" },
  { clave: "inventario-viales", route: "/inventory/vials" },
  { clave: "inventario-productos", route: "/inventory/products" },
  { clave: "inventario-proveedores", route: "/inventory/suppliers" },
  { clave: "inventario-amp", route: "/inventory/supplier-presentations" },
  { clave: "inventario-recibir", route: "/inventory/receive-purchase" },
  { clave: "inventario-recetas", route: "/inventory/recipes" },
  { clave: "inventario-transferencias", route: "/inventory/transfers" },
  { clave: "precios", route: "/inventory/prices" },
  // Configuración / admin / staff / auditoría
  { clave: "configuracion-tableros", route: "/configuracion/tableros" },
  { clave: "configuracion-modulos", route: "/settings/tablero-modulos" },
  { clave: "mis-tableros", route: "/settings/tableros" },
  { clave: "servicios-config", route: "/servicios" },
  { clave: "config-factura", route: "/configuracion/factura" },
  { clave: "config-requeridos", route: "/configuracion/requeridos" },
  { clave: "config-datos-paciente", route: "/configuracion/datos-paciente" },
  { clave: "configuracion-apariencia", route: "/configuracion/apariencia" },
  { clave: "admin", route: "/admin" },
  { clave: "personal", route: "/personal" },
  { clave: "auditoria", route: "/auditoria" },
  // Raíces sueltas
  { clave: "home", route: "/" },
  { clave: "dashboard", route: "/dashboard" },
];

const BY_CLAVE: Map<string, string> = new Map(
  NAV_MANIFEST.map((e) => [e.clave, e.route]),
);

// Resolve a BE menu clave to its FE route.
//   1. Known clave → its manifest route.
//   2. Unknown clave whose BE path is a dynamic board → rewrite /tablero/* → /boards/*.
//   3. Otherwise → the BE path verbatim (never a dead link), or "#" if none.
export function routeForClave(clave: string, bePath?: string): string {
  const known = BY_CLAVE.get(clave);
  if (known) return known;
  if (bePath && bePath.startsWith("/tablero/")) {
    return "/boards/" + bePath.slice("/tablero/".length);
  }
  return bePath ?? "#";
}
