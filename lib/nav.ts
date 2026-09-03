// lib/nav.ts
//
// Route helpers for the app shell. The FE-owned `clave → route` mapping now
// lives in lib/nav/manifest.ts (routeForClave); this file keeps only the
// active-link predicate used by the sidebar and the shell header.

// "/" is active only on the exact root; every other item is active on an exact
// match or a nested sub-path (e.g. /clientes/123 keeps "Clientes" active).
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
