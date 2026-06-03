// lib/nav.ts
export type NavItem = {
  href: string;
  label: string;
};

// Single source of truth for primary navigation links.
// Destination routes may not exist yet (they will 404 until built).
export const navItems: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/clientes", label: "Clientes" },
  { href: "/citas", label: "Citas" },
];

// "/" is active only on the exact root; every other item is active on an exact
// match or a nested sub-path (e.g. /clientes/123 keeps "Clientes" active).
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
