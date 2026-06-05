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

// Follow-on (BE ready): the user's own personalization layer.
export function updateMyPreferences(config: ThemeConfig): Promise<MyPreferences> {
  return apiFetch<MyPreferences>("/me/preferences", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}
