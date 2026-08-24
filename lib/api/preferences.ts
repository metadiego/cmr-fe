import { apiFetch } from "./client";
import type { ThemeConfig } from "@/lib/theme/config";

// Config por capas (#51). The BE resolves the effective config by precedence
// (override → usuario → centro → sistema) and returns it; the FE only paints it.

export interface PublicPreferences {
  effective: ThemeConfig;
}

// A dónde llevar a la persona AL ENTRAR. `path` ya viene resuelto por el BE (su elección si tiene el
// permiso; si no, la deducida de su menú con el orden del trabajo diario). `elegida` = lo que pidió (o
// null). Si `elegida` y `path` difieren, su preferida ya no está disponible → se le puede avisar. `path`
// null = no tiene ninguna pantalla. Handoff al-entrar-cada-uno-a-su-trabajo.
export interface Inicio {
  path: string | null;
  elegida: string | null;
}
export function getInicio(): Promise<Inicio> {
  return apiFetch<Inicio>("/me/inicio");
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
  return apiFetch<ThemeConfig>(`/preferences/centro/${centroId}`);
}

export function updateCentroPreferences(
  centroId: string,
  config: ThemeConfig,
): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>(`/preferences/centro/${centroId}`, {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

// --- Corporate override (master / super_admin). ---

export interface Override {
  id: string;
  nombre?: string | null;
  centroId?: string | null;
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
  config: ThemeConfig;
}

export interface CreateOverridePayload {
  config: ThemeConfig;
  centroId?: string;
  vigenteDesde?: string;
  vigenteHasta?: string;
  nombre?: string;
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
