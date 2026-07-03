// lib/nav.ts
//
// Route manifest for the app. Since RBAC fino F3, the visible menu is rendered
// from the BE (`GET /me/menu`, see hooks/use-menu.ts) — this file no longer
// decides visibility. It is the FE-owned mapping `clave → route + icon`: routes
// live in Next code, never generated from the DB. The BE menu item's `clave`
// keys into this manifest so the FE controls the actual destination and icon.

export type NavManifestEntry = {
  href: string;
  // Hugeicons icon name (resolved to a component where icons are rendered).
  icon?: string;
};

// Seeded menu claves (BE: home/clientes/citas/admin) + their FE routes. Extend
// this as new domains land (pacientes, citas, facturacion, …).
export const navManifest: Record<string, NavManifestEntry> = {
  home: { href: "/dashboard", icon: "Home01Icon" },
  clientes: { href: "/clientes", icon: "UserMultipleIcon" },
  citas: { href: "/citas", icon: "Calendar03Icon" },
  admin: { href: "/admin", icon: "Settings02Icon" },
  // Vertical boards (atencion/servicios/operaciones/…) are NOT hardcoded here:
  // the BE menu points them to /tablero/<clave> and the [clave] route renders
  // them generically. Adding a vertical needs zero FE code.
};

// Resolve a menu clave to its FE route. Falls back to the BE-provided path when
// the clave is not yet in the manifest (new domain not wired in code).
export function routeForClave(clave: string, fallback: string): string {
  return navManifest[clave]?.href ?? fallback;
}

// "/" is active only on the exact root; every other item is active on an exact
// match or a nested sub-path (e.g. /clientes/123 keeps "Clientes" active).
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
