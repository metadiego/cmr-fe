// lib/nav/manifest.ts
//
// FE-OWNED nav manifest: the single source of truth mapping a BE menu `clave`
// (GET /me/menu → lib/api/menu.ts MenuItem.clave) to the FE route it should link
// to, AND to the menu group + order it renders under. Introduced by the
// route-reorg to DECOUPLE the FE URL/menu structure from BE `menu_items`.
//
// - route:  FE-owned URL (Phase 1 made these English).
// - group:  which of the 9 top-level menu groups it belongs to (Phase 2).
// - order:  order within that group (Phase 2). Grouping/order are FE-owned;
//           the BE only decides visibility/permission + per-center label.
//
// Dead/orphan seeded claves with no FE page (`caja` bare, `captacion-por-agente`,
// `ahora-mismo`) are intentionally ABSENT — the resolver's fallback returns their
// BE path so nothing dead-links, without asserting them as real FE routes.

export type NavGroupKey =
  | "scheduling" | "patients" | "services" | "billing" | "reports"
  | "inventory" | "communications" | "admin" | "configuration";

export interface NavGroupDef {
  key: NavGroupKey;
  labelKey: string; // i18n key (messages/*.json)
  order: number;    // top-level display order in the rail
}

// The 9-group taxonomy (route prefix = menu group). Order = top-to-bottom.
export const NAV_GROUPS: NavGroupDef[] = [
  { key: "scheduling", labelKey: "nav.grupo.scheduling", order: 1 },
  { key: "patients", labelKey: "nav.grupo.patients", order: 2 },
  { key: "services", labelKey: "nav.grupo.services", order: 3 },
  { key: "billing", labelKey: "nav.grupo.billing", order: 4 },
  { key: "reports", labelKey: "nav.grupo.reports", order: 5 },
  { key: "inventory", labelKey: "nav.grupo.inventory", order: 6 },
  { key: "communications", labelKey: "nav.grupo.communications", order: 7 },
  { key: "admin", labelKey: "nav.grupo.admin", order: 8 },
  { key: "configuration", labelKey: "nav.grupo.configuration", order: 9 },
];

export type NavEntry = {
  clave: string; // matches BE menu_items.clave (stable join key; never user-visible)
  route: string; // FE-owned URL
  group: NavGroupKey; // which menu group it renders under
  order: number; // order within the group
};

export const NAV_MANIFEST: NavEntry[] = [
  // Scheduling
  { clave: "citas", route: "/scheduling/appointments", group: "scheduling", order: 1 },
  { clave: "cupos", route: "/scheduling/slots", group: "scheduling", order: 2 },
  { clave: "calendario", route: "/scheduling/calendar", group: "scheduling", order: 3 },
  { clave: "atencion", route: "/boards/atencion", group: "scheduling", order: 4 }, // board surfaced in scheduling
  // Patients
  { clave: "clientes", route: "/patients", group: "patients", order: 1 },
  { clave: "cambio-de-protocolo", route: "/patients/protocol-change", group: "patients", order: 2 },
  // Services (boards + nursing)
  { clave: "frontdesk", route: "/boards/frontdesk", group: "services", order: 1 },
  { clave: "servicios", route: "/boards/servicios", group: "services", order: 2 },
  { clave: "panel-enfermeria", route: "/services/nursing-panel", group: "services", order: 3 },
  // Billing
  { clave: "facturacion", route: "/billing/invoices", group: "billing", order: 1 },
  { clave: "consultas", route: "/billing/consultations", group: "billing", order: 2 },
  { clave: "grupos-facturacion", route: "/billing/groups", group: "billing", order: 3 },
  { clave: "facturacion-devoluciones", route: "/billing/returns", group: "billing", order: 4 },
  { clave: "consultas-devoluciones", route: "/billing/consultations/returns", group: "billing", order: 5 },
  { clave: "caja-consulta", route: "/billing/cash/consultation", group: "billing", order: 6 },
  { clave: "caja-general", route: "/billing/cash/general", group: "billing", order: 7 },
  // Reports
  { clave: "estadisticas-servicios", route: "/reports/services", group: "reports", order: 1 },
  { clave: "estadisticas-diarias", route: "/reports/daily", group: "reports", order: 2 },
  { clave: "consumo-insumos", route: "/reports/supply-consumption", group: "reports", order: 3 },
  { clave: "ventas-por-grupo", route: "/reports/sales-by-group", group: "reports", order: 4 },
  { clave: "ventas-por-usuario", route: "/reports/sales-by-user", group: "reports", order: 5 },
  // Inventory
  { clave: "inventario-index", route: "/inventory", group: "inventory", order: 1 },
  { clave: "inventario-existencias", route: "/inventory/stock", group: "inventory", order: 2 },
  { clave: "inventario-productos", route: "/inventory/products", group: "inventory", order: 3 },
  { clave: "inventario-proveedores", route: "/inventory/suppliers", group: "inventory", order: 4 },
  { clave: "inventario-amp", route: "/inventory/supplier-presentations", group: "inventory", order: 5 },
  { clave: "inventario-recibir", route: "/inventory/receive-purchase", group: "inventory", order: 6 },
  { clave: "inventario-recetas", route: "/inventory/recipes", group: "inventory", order: 7 },
  { clave: "inventario-transferencias", route: "/inventory/transfers", group: "inventory", order: 8 },
  { clave: "inventario-viales", route: "/inventory/vials", group: "inventory", order: 9 },
  { clave: "precios", route: "/inventory/prices", group: "inventory", order: 10 },
  // Communications
  { clave: "comunicaciones", route: "/communications", group: "communications", order: 1 },
  // Admin (top-level, decision #1)
  { clave: "admin", route: "/admin", group: "admin", order: 1 },
  // Configuration (+ staff decision #5, + audit)
  { clave: "configuracion-tableros", route: "/configuration/boards", group: "configuration", order: 1 },
  { clave: "configuracion-modulos", route: "/configuration/board-modules", group: "configuration", order: 2 },
  { clave: "servicios-config", route: "/configuration/services", group: "configuration", order: 3 },
  { clave: "config-factura", route: "/configuration/invoice", group: "configuration", order: 4 },
  { clave: "config-requeridos", route: "/configuration/required-fields", group: "configuration", order: 5 },
  { clave: "config-datos-paciente", route: "/configuration/patient-fields", group: "configuration", order: 6 },
  { clave: "config-formatos", route: "/configuration/formats", group: "configuration", order: 7 },
  { clave: "configuracion-apariencia", route: "/configuration/appearance", group: "configuration", order: 8 },
  { clave: "auditoria", route: "/configuration/audit", group: "configuration", order: 9 },
  { clave: "personal", route: "/configuration/staff", group: "configuration", order: 10 },
  { clave: "mis-tableros", route: "/settings/tableros", group: "configuration", order: 11 }, // orphan — deleted in Phase 3
  // Loose roots — carried for resolver completeness; NOT surfaced as domain leaves
  // (buildNavGroups filters them out). home = the logo link; dashboard = admin diagnostic.
  { clave: "home", route: "/", group: "configuration", order: 98 },
  { clave: "dashboard", route: "/dashboard", group: "configuration", order: 99 },
];

const ROUTE_BY_CLAVE: Map<string, string> = new Map(
  NAV_MANIFEST.map((e) => [e.clave, e.route]),
);
const GROUP_BY_CLAVE: Map<string, NavGroupKey> = new Map(
  NAV_MANIFEST.map((e) => [e.clave, e.group]),
);
const ORDER_BY_CLAVE: Map<string, number> = new Map(
  NAV_MANIFEST.map((e) => [e.clave, e.order]),
);

// Resolve a BE menu clave to its FE route.
//   1. Known clave → its manifest route.
//   2. Unknown clave whose BE path is a dynamic board → rewrite /tablero/* → /boards/*.
//   3. Otherwise → the BE path verbatim (never a dead link), or "#" if none.
export function routeForClave(clave: string, bePath?: string): string {
  const known = ROUTE_BY_CLAVE.get(clave);
  if (known) return known;
  if (bePath && bePath.startsWith("/tablero/")) {
    return "/boards/" + bePath.slice("/tablero/".length);
  }
  return bePath ?? "#";
}

// FE-owned menu group for a clave (undefined if the manifest doesn't know it —
// e.g. a dynamic board; buildNavGroups falls back to the BE parent group).
export function groupForClave(clave: string): NavGroupKey | undefined {
  return GROUP_BY_CLAVE.get(clave);
}

// FE-owned order within a group; unknown claves sort last.
export function orderForClave(clave: string): number {
  return ORDER_BY_CLAVE.get(clave) ?? Number.MAX_SAFE_INTEGER;
}
