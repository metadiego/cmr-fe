// Which menu screen a URL belongs to, and whether the ACTIVE center lacks its permission. The menu is
// the same in every center (every screen usable in at least one of the person's centers, cmr-be
// positions spec §2.5), so a screen can be in the menu while the active center does not allow it:
// then the shell names the centers where it is allowed instead of opening a page that fails.
import type { MenuItem } from "@/lib/api/menu";
import { holdsPermission } from "../rbac/permission-aliases.ts";

type Screen = Pick<MenuItem, "slug" | "path" | "permissionSlug">;

/** The menu item whose path is the longest one the URL starts with (whole segments only). */
export function menuItemForPath<T extends Screen>(items: readonly T[], pathname: string): T | null {
  let best: T | null = null;
  for (const i of items) {
    const p = i.path;
    if (!p || !p.startsWith("/")) continue;
    const matches = pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`);
    if (matches && (!best || p.length > best.path.length)) best = i;
  }
  return best;
}

/** True when the screen asks for a permission the active center's session does not hold. */
export function needsOtherCenter(screen: Screen | null, activePermissions: readonly string[]): boolean {
  if (!screen?.permissionSlug) return false;
  return !holdsPermission(activePermissions, screen.permissionSlug);
}
