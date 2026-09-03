import { apiFetch } from "./client";
import type { ThemeConfig } from "@/lib/theme/config";

// Config por capas (#51). The BE resolves the effective config by precedence
// (override → usuario → centro → sistema) and returns it; the FE only paints it.

export interface PublicPreferences {
  effective: ThemeConfig;
}

export interface PreferenceLayers {
  sistema?: ThemeConfig | null;
  centro?: ThemeConfig | null;
  usuario?: ThemeConfig | null;
  override?: ThemeConfig | null;
}

export interface MyPreferences {
  effective: ThemeConfig;
  layers: PreferenceLayers;
}

// Anonymous (landing/login): system + center defaults only.
export function getPublicPreferences(): Promise<PublicPreferences> {
  return apiFetch<PublicPreferences>("/preferences/public");
}

// Authenticated: effective + the individual layers (for the future personalization UI).
export function getMyPreferences(): Promise<MyPreferences> {
  return apiFetch<MyPreferences>("/me/preferences");
}

// The user's own personalization layer. PUT returns the saved config blob.
export function updateMyPreferences(config: ThemeConfig): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>("/me/preferences", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

// Guarda SOLO el idioma en la capa del usuario. El PUT reemplaza la capa entera, así que
// primero leemos la capa `usuario` vigente y MEZCLAMOS el idioma para no borrar la apariencia
// personal (colores, radio, fondo). `null` vuelve al defecto (quita la clave). El BE rechaza
// con 400 (labelKey preferencias.idiomaNoDisponible) un idioma fuera de la lista; el selector
// solo ofrece los de /auth/me, así que no debería pasar. Handoff idioma-por-usuario.
export async function setMyLanguage(idioma: string | null): Promise<ThemeConfig> {
  const prefs = await getMyPreferences();
  const usuario: ThemeConfig = { ...(prefs.layers.usuario ?? {}) };
  if (idioma) usuario.idioma = idioma;
  else delete usuario.idioma;
  return updateMyPreferences(usuario);
}

// --- Admin layers (admin/master). GET/PUT return the layer's config blob. ---

export function getSystemPreferences(): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>("/preferences/system");
}

export function updateSystemPreferences(config: ThemeConfig): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>("/preferences/system", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

export function getCentroPreferences(centroId: string): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>(`/preferences/center/${centroId}`);
}

export function updateCentroPreferences(
  centroId: string,
  config: ThemeConfig,
): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>(`/preferences/center/${centroId}`, {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

// --- Corporate override (master / super_admin). ---

export interface Override {
  id: string;
  name?: string | null;
  centerId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  config: ThemeConfig;
}

export interface CreateOverridePayload {
  config: ThemeConfig;
  centerId?: string;
  validFrom?: string;
  validUntil?: string;
  name?: string;
}

export function listOverrides(): Promise<Override[]> {
  return apiFetch<Override[]>("/preferences/override");
}

export function createOverride(payload: CreateOverridePayload): Promise<Override> {
  return apiFetch<Override>("/preferences/override", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteOverride(id: string): Promise<void> {
  return apiFetch<void>(`/preferences/override/${id}`, { method: "DELETE" });
}
