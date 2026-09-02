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
  { clave: "atencion", route: "/boards/atencion" },
  { clave: "clientes", route: "/patients" },
  { clave: "cambio-de-protocolo", route: "/patients/protocol-change" }, // (was the /pacientes 404-fix; now final English route)
  { clave: "comunicaciones", route: "/communications" },
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
  { clave: "frontdesk", route: "/boards/frontdesk" },
  { clave: "servicios", route: "/boards/servicios" },
  { clave: "panel-enfermeria", route: "/services/nursing-panel" },
  { clave: "config-formatos", route: "/configuration/formats" },
  { clave: "estadisticas-servicios", route: "/reports/services" },
  { clave: "estadisticas-diarias", route: "/reports/daily" },
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
  { clave: "configuracion-tableros", route: "/configuration/boards" },
  { clave: "configuracion-modulos", route: "/configuration/board-modules" },
  { clave: "mis-tableros", route: "/settings/tableros" }, // orphan — deleted in Phase 3
  { clave: "servicios-config", route: "/configuration/services" },
  { clave: "config-factura", route: "/configuration/invoice" },
  { clave: "config-requeridos", route: "/configuration/required-fields" },
  { clave: "config-datos-paciente", route: "/configuration/patient-fields" },
  { clave: "configuracion-apariencia", route: "/configuration/appearance" },
  { clave: "admin", route: "/admin" }, // top-level (decision #1) — unchanged
  { clave: "personal", route: "/configuration/staff" }, // staff folded in (decision #5)
  { clave: "auditoria", route: "/configuration/audit" },
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
