// lib/nav/manifest.ts
//
// FE-OWNED nav manifest: the single source of truth mapping a BE menu `clave`
// (GET /me/menu → lib/api/menu.ts MenuItem.clave) to the FE route it should link
// to, AND to the menu group + order it renders under. Introduced by the
// route-reorg to DECOUPLE the FE URL/menu structure from BE `menu_items`.
//
// - route:  FE-owned URL (Phase 1 made these English).
// - group:  which of the 8 top-level menu groups it belongs to (Phase 2).
// - order:  order within that group (Phase 2). Grouping/order are FE-owned;
//           the BE only decides visibility/permission + per-center label.
//
// Dead/orphan seeded claves with no FE page (`caja` bare, `captacion-por-agente`,
// `ahora-mismo`) are intentionally ABSENT — the resolver's fallback returns their
// BE path so nothing dead-links, without asserting them as real FE routes.

export type NavGroupKey =
  | "scheduling" | "services" | "billing" | "reports"
  | "inventory" | "communications" | "admin" | "configuration";

export interface NavGroupDef {
  key: NavGroupKey;
  labelKey: string; // i18n key (messages/*.json)
  icon: string;     // curated icon name (lib/menu-icons.ts) — every top-level group shows one
  order: number;    // top-level display order in the rail
}

// The 8-group taxonomy. Order = top-to-bottom. There is no separate "patients" group: the patient
// list lives under Services next to the front desk and nursing panel, the screens that work with it
// day to day (owner decision, 2026-10).
export const NAV_GROUPS: NavGroupDef[] = [
  { key: "scheduling", labelKey: "nav.grupo.scheduling", icon: "calendar", order: 1 },
  { key: "services", labelKey: "nav.grupo.services", icon: "stethoscope", order: 2 },
  { key: "billing", labelKey: "nav.grupo.billing", icon: "invoice", order: 3 },
  { key: "reports", labelKey: "nav.grupo.reports", icon: "chart", order: 4 },
  { key: "inventory", labelKey: "nav.grupo.inventory", icon: "package", order: 5 },
  { key: "communications", labelKey: "nav.grupo.communications", icon: "bell", order: 6 },
  { key: "admin", labelKey: "nav.grupo.admin", icon: "users", order: 7 },
  { key: "configuration", labelKey: "nav.grupo.configuration", icon: "settings", order: 8 },
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
  { clave: "therapy-day", route: "/scheduling/therapy-day", group: "scheduling", order: 5 },
  // Services: Patient Center (front desk), Patients, Nursing Panel; then the services board and protocol change
  { clave: "frontdesk", route: "/boards/frontdesk", group: "services", order: 1 },
  { clave: "patient-desk", route: "/boards/patient-desk", group: "services", order: 2 },
  { clave: "clientes", route: "/patients", group: "services", order: 2 },
  { clave: "panel-enfermeria", route: "/services/nursing-panel", group: "services", order: 3 },
  { clave: "servicios", route: "/boards/servicios", group: "services", order: 4 },
  { clave: "cambio-de-protocolo", route: "/patients/protocol-change", group: "services", order: 5 },
  // Billing
  { clave: "facturacion", route: "/billing/invoices", group: "billing", order: 1 },
  { clave: "consultas", route: "/billing/consultations", group: "billing", order: 2 },
  // Devoluciones/Cuadre de caja (general y consulta) NO son páginas standalone desde 09-oct-2026 —
  // son pestañas dentro de Facturación/Consultas (components/facturacion/facturacion-con-tabs.tsx).
  // Estas 4 filas siguen acá a propósito, apuntando a su ruta de siempre: así, si el catálogo del BE
  // todavía trae una de estas claves, `routeForClave` resuelve algo predecible y
  // `lib/nav/nav-groups.ts` (NOT_SURFACED_ROUTES) la reconoce y la oculta del menú. No borrar estas
  // filas sin también quitarlas de NOT_SURFACED_ROUTES.
  { clave: "facturacion-devoluciones", route: "/billing/returns", group: "billing", order: 4 },
  { clave: "consultas-devoluciones", route: "/billing/consultations/returns", group: "billing", order: 5 },
  { clave: "caja-consulta", route: "/billing/cash/consultation", group: "billing", order: 6 },
  { clave: "caja-general", route: "/billing/cash/general", group: "billing", order: 7 },
  // Reports
  { clave: "estadisticas-servicios", route: "/reports/services", group: "reports", order: 1 },
  // Estadísticas diarias NO es una página standalone desde 09-oct-2026 — es una pestaña de
  // Facturación general (components/reportes/estadisticas-diarias-view.tsx). Esta fila sigue acá
  // a propósito: resuelve la ruta de siempre para que NOT_SURFACED_ROUTES (lib/nav/nav-groups.ts)
  // la reconozca y la oculte del menú aunque el catálogo del BE todavía la traiga.
  { clave: "estadisticas-diarias", route: "/reports/daily", group: "reports", order: 2 },
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
  // Movido de Facturación/Reportes a Inventario (owner, 09-oct-2026): es cuánto insumo se consumió,
  // dato de inventario, no de facturación. También se quita el botón de Facturación (ver
  // facturas-list-view.tsx) que apuntaba acá.
  { clave: "consumo-insumos", route: "/reports/supply-consumption", group: "inventory", order: 11 },
  // Communications
  { clave: "comunicaciones", route: "/communications", group: "communications", order: 1 },
  // Admin (top-level, decision #1)
  { clave: "admin", route: "/admin", group: "admin", order: 1 },
  // Configuration (+ staff decision #5, + audit)
  { clave: "configuracion-tableros", route: "/configuration/boards", group: "configuration", order: 1 },
  { clave: "configuracion-modulos", route: "/configuration/board-modules", group: "configuration", order: 2 },
  { clave: "servicios-config", route: "/configuration/services", group: "configuration", order: 3 },
  // Movido de Facturación a Configuración (pedido del dueño, 09-oct-2026): define cómo se agrupan
  // los productos-dosis para facturar (membresía + división), un ajuste de catálogo/setup, no una
  // operación de facturación del día a día. Al lado de "Servicios" porque cada servicio ancla su
  // grupo desde ahí (components/servicios/servicio-form-fields.tsx → GrupoSelect).
  { clave: "grupos-facturacion", route: "/configuration/billing-groups", group: "configuration", order: 3.5 },
  { clave: "config-factura", route: "/configuration/invoice", group: "configuration", order: 4 },
  { clave: "config-requeridos", route: "/configuration/required-fields", group: "configuration", order: 5 },
  { clave: "config-datos-paciente", route: "/configuration/patient-fields", group: "configuration", order: 6 },
  { clave: "config-formatos", route: "/configuration/formats", group: "configuration", order: 7 },
  { clave: "configuracion-apariencia", route: "/configuration/appearance", group: "configuration", order: 8 },
  { clave: "auditoria", route: "/configuration/audit", group: "configuration", order: 9 },
  { clave: "personal", route: "/configuration/staff", group: "configuration", order: 10 },
  { clave: "scheduling-bridge", route: "/configuration/scheduling-bridge", group: "configuration", order: 11 },
  { clave: "ehr-integration", route: "/configuration/ehr-integration", group: "configuration", order: 12 },
  // clave real del BE confirmada en cmr-be/src/scripts/menu-items.ts: "config-panel".
  { clave: "config-panel", route: "/configuration/panel", group: "configuration", order: 13 },
  // clave INVENTADA del lado FE: el BE (06-oct-2026) todavía no sembró una fila de menú para esta
  // pantalla nueva — se llega hoy por el enlace "Catálogo" dentro del propio selector de banderas
  // de prioridad (components/clientes/priority-flags-badges.tsx), no por el menú lateral. Cuando el
  // BE siembre `menu_items` para esto, confirmar la clave real aquí (handoff pendiente a BE).
  { clave: "config-prioridad-flags", route: "/configuration/priority-flags", group: "configuration", order: 13.5 },
  // "resources" sigue siendo su propio renglón del menú (clave real del catálogo del BE — quitarla
  // de aquí sin tocar la fila en el BE la manda a un bucket huérfano, no la borra). Ahora TAMBIÉN
  // vive como pestaña de "cupos" (/scheduling/slots), así que las dos rutas llevan a la misma
  // pantalla en la práctica; no se toca el menú en producción sin verificarlo primero.
  { clave: "resources", route: "/configuration/resources", group: "configuration", order: 14 },
  // Movido de Reportes a Configuración (owner, 09-oct-2026).
  { clave: "cuadre-general", route: "/billing/cash/summary", group: "configuration", order: 15 },
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
