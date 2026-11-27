// Which menu screen a URL belongs to, and whether the ACTIVE center lacks its permission. The menu is
// the same in every center (every screen usable in at least one of the person's centers, cmr-be
// positions spec §2.5), so a screen can be in the menu while the active center does not allow it:
// then the shell names the centers where it is allowed instead of opening a page that fails.
import type { MenuItem } from "@/lib/api/menu";
import { holdsPermission } from "../rbac/permission-aliases.ts";
import { routeForClave } from "./manifest.ts";

type Screen = Pick<MenuItem, "slug" | "path" | "permissionSlug">;

const RECORD_ID = /^([0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * The menu item a URL belongs to, by the FE route the sidebar links to (`routeForClave`, BE paths are
 * Spanish and not the app's routes). Only the screen itself or a record under it (`/<route>/<id>/…`)
 * counts: another sub-page may need a different permission, so it is left to answer for itself.
 * The root route never matches everything.
 */
export function menuItemForPath<T extends Screen>(items: readonly T[], pathname: string): T | null {
  let best: { item: T; route: string } | null = null;
  for (const i of items) {
    const route = routeForClave(i.slug, i.path);
    if (!route.startsWith("/") || route === "/") continue;
    const rest = pathname === route ? "" : pathname.startsWith(`${route}/`) ? pathname.slice(route.length + 1) : null;
    if (rest === null) continue;
    if (rest !== "" && !RECORD_ID.test(rest.split("/")[0])) continue;
    if (!best || route.length > best.route.length) best = { item: i, route };
  }
  return best?.item ?? null;
}

/** True when the screen asks for a permission the active center's session does not hold. */
export function needsOtherCenter(screen: Screen | null, activePermissions: readonly string[]): boolean {
  if (!screen?.permissionSlug) return false;
  return !holdsPermission(activePermissions, screen.permissionSlug);
}
