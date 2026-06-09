import { apiFetch } from "./client";

// A navigation item from the BE menu registry (#6). `GET /me/menu` returns the
// principal's EFFECTIVE menu — already filtered by permission + visibility +
// active centro, ordered by `orden`, flat (the FE nests by `parentClave`).
// `clave` matches the FE route manifest (lib/nav.ts); `path` is the route.
export interface MenuItem {
  id: string;
  clave: string;
  labelKey: string; // full i18n key, e.g. "nav.home"
  path: string;
  icon?: string | null;
  parentClave?: string | null;
  orden: number;
  permisoClave?: string | null;
  visible: boolean;
  centroId?: string | null;
}

export async function getMyMenu(): Promise<MenuItem[]> {
  const res: unknown = await apiFetch(`/me/menu`);
  if (Array.isArray(res)) return res as MenuItem[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as MenuItem[]) : [];
}
