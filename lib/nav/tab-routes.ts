// Tabs as URL paths. A tabbed screen's tabs are path segments under the screen's own route, named
// in English after the tab they open: /billing/invoices/returns, /patients/<id>/billing,
// /scheduling/appointments/services. The FIRST tab is the default and lives at the screen's route
// itself (no segment), so the sidebar link and an old bookmark keep landing where they always did.
//
// Before this, some screens named their tab in `?tab=` (with Spanish values: `?tab=caja`) and others
// not at all, so a tab could not be linked to. `legacy` maps those old `?tab=` values to the new
// slugs; useTabRoute (hooks/use-tab-route.ts) rewrites such a URL in place.
//
// The tabbed screen itself is rendered by the route's layout.tsx (layouts stay mounted across child
// navigations, so switching tabs does not refetch the screen); each tab's page.tsx renders nothing.

export type TabRoute<T extends string = string> = {
  /** The screen's route; `[name]` marks a dynamic segment (e.g. the patient id). */
  pattern: string;
  /** The tab slugs, default first. */
  tabs: readonly T[];
  /** Old `?tab=` values that differ from the new slug. */
  legacy?: Readonly<Record<string, T>>;
};

const BILLING_LEGACY = { facturas: "invoices", devoluciones: "returns", caja: "cash", estadisticas: "stats" } as const;

export const PATIENT_TABS = {
  pattern: "/patients/[id]",
  tabs: ["summary", "appointments", "therapies", "billing", "documents", "protocol-change"],
} as const satisfies TabRoute;

export const BILLING_GENERAL_TABS = {
  pattern: "/billing/invoices",
  tabs: ["invoices", "returns", "cash", "stats"],
  legacy: BILLING_LEGACY,
} as const satisfies TabRoute;

export const BILLING_CONSULTATION_TABS = {
  pattern: "/billing/consultations",
  tabs: ["invoices", "returns", "cash"],
  legacy: { facturas: "invoices", devoluciones: "returns", caja: "cash" },
} as const satisfies TabRoute;

export const APPOINTMENTS_TABS = {
  pattern: "/scheduling/appointments",
  tabs: ["medical", "services"],
  legacy: { medicas: "medical", servicios: "services" },
} as const satisfies TabRoute;

export const ADMIN_TABS = {
  pattern: "/admin",
  tabs: ["staff", "users", "roles", "permissions", "role-editor", "pending", "centers", "theme", "menu"],
  legacy: { personal: "staff", permisos: "permissions", editorRol: "role-editor" },
} as const satisfies TabRoute;

export const TAB_ROUTES: readonly TabRoute[] = [
  PATIENT_TABS,
  BILLING_GENERAL_TABS,
  BILLING_CONSULTATION_TABS,
  APPOINTMENTS_TABS,
  ADMIN_TABS,
];

const segmentsOf = (path: string) => path.split("/").filter(Boolean);

/**
 * The screen's concrete route and the tab the pathname names, or null when the pathname is not
 * this screen or one of its tabs (e.g. a deeper page such as /billing/invoices/<id>).
 */
export function matchTab<T extends string>(route: TabRoute<T>, pathname: string): { base: string; tab: T } | null {
  const pattern = segmentsOf(route.pattern);
  const path = segmentsOf(pathname);
  if (path.length !== pattern.length && path.length !== pattern.length + 1) return null;
  for (let i = 0; i < pattern.length; i++) {
    const dynamic = pattern[i].startsWith("[") && pattern[i].endsWith("]");
    if (!dynamic && pattern[i] !== path[i]) return null;
  }
  const base = "/" + path.slice(0, pattern.length).join("/");
  if (path.length === pattern.length) return { base, tab: route.tabs[0] };
  const slug = path[pattern.length];
  return isTab(route, slug) ? { base, tab: slug } : null;
}

export function isTab<T extends string>(route: TabRoute<T>, value: string | null | undefined): value is T {
  return value != null && (route.tabs as readonly string[]).includes(value);
}

/** The slug an old `?tab=` value stands for (an unchanged name counts too), or null. */
export function legacyTab<T extends string>(route: TabRoute<T>, value: string | null | undefined): T | null {
  if (value == null) return null;
  const mapped = route.legacy?.[value];
  if (mapped) return mapped;
  return isTab(route, value) ? value : null;
}

/**
 * The link to `tab` on the screen at `base`. The default tab is the bare route. The query string is
 * kept (e.g. `?centro=`), minus a leftover `tab`, which the path now carries.
 */
export function tabHref<T extends string>(
  route: TabRoute<T>,
  base: string,
  tab: T,
  search?: URLSearchParams | string,
): string {
  const path = tab === route.tabs[0] ? base : `${base}/${tab}`;
  const q = new URLSearchParams(search);
  q.delete("tab");
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * The screen a pathname belongs to: a tab path is the screen's own route (/billing/invoices/returns →
 * /billing/invoices). The app shell matches the menu against this, so every tab of a menu screen
 * shows the same title in the top bar instead of a breadcrumb back to its own default tab.
 */
export function screenPathOf(pathname: string): string {
  for (const route of TAB_ROUTES) {
    const m = matchTab(route, pathname);
    if (m) return m.base;
  }
  return pathname;
}
