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

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export async function getMyMenu(): Promise<MenuItem[]> {
  return asArray<MenuItem>(await apiFetch(`/me/menu`));
}

// ---- Menu admin CRUD (GET/POST/PUT/DELETE /menu) — @Roles admin -------------

// Writable fields of a menu item (id/centro are server-managed).
export type MenuItemPayload = {
  clave: string;
  labelKey: string;
  path: string;
  icon?: string | null;
  parentClave?: string | null;
  orden?: number;
  permisoClave?: string | null;
  visible?: boolean;
};

// All registered menu items (admin view — not filtered by the caller's permisos).
export async function getAllMenu(): Promise<MenuItem[]> {
  return asArray<MenuItem>(await apiFetch(`/menu`));
}

export function createMenuItem(payload: MenuItemPayload): Promise<MenuItem> {
  return apiFetch<MenuItem>(`/menu`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMenuItem(
  id: string,
  payload: Partial<MenuItemPayload>,
): Promise<MenuItem> {
  return apiFetch<MenuItem>(`/menu/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteMenuItem(id: string): Promise<void> {
  return apiFetch<void>(`/menu/${id}`, { method: "DELETE" });
}
