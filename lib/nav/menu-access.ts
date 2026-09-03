// El FRONTEND decide qué se VE (docs/specs/accesos-los-decide-el-frontend.md, 2-sep-2026).
// Recorre el catálogo COMPLETO de menú (GET /menu) y muestra un ítem si:
//   - no está oculto (`visible !== false`), Y
//   - no declara `permisoClave` (visible para cualquier autenticado), O
//   - el usuario tiene `*` (master), O
//   - su `permisoClave` está en los permisos efectivos.
// El BE sigue protegiendo qué se PUEDE en cada endpoint (@Permissions) — esto es SOLO visibilidad.
// Mismo criterio que hooks/use-can.ts `can()`, para que la barra y los gates coincidan.

import type { MenuItem } from "@/lib/api/menu";

type Gateable = Pick<MenuItem, "permissionSlug" | "visible">;

export function canSeeMenuItem(
  item: Gateable,
  permissions: readonly string[],
): boolean {
  if (item.visible === false) return false;
  if (!item.permissionSlug) return true;
  if (permissions.includes("*")) return true;
  return permissions.includes(item.permissionSlug);
}

export function filterMenuByPermissions(
  items: MenuItem[],
  permissions: readonly string[],
): MenuItem[] {
  return items.filter((i) => canSeeMenuItem(i, permissions));
}
