// lib/nav.ts
export type NavItem = {
  href: string;
  // i18n key under the "nav" namespace (messages/<locale>.json). Resolved with
  // t(item.labelKey) at render time.
  labelKey: "home" | "clients" | "appointments";
};

// Single source of truth for primary navigation links.
// Destination routes may not exist yet (they will 404 until built).
export const navItems: NavItem[] = [
  { href: "/", labelKey: "home" },
  { href: "/clientes", labelKey: "clients" },
  { href: "/citas", labelKey: "appointments" },
];

// "/" is active only on the exact root; every other item is active on an exact
// match or a nested sub-path (e.g. /clientes/123 keeps "Clientes" active).
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
