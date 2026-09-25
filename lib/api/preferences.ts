import { apiFetch } from "./client";
import type { ThemeConfig } from "@/lib/theme/config";

// Config por capas (#51). The BE resolves the effective config by precedence
// (override → usuario → centro → sistema) and returns it; the FE only paints it.

export interface PublicPreferences {
  effective: ThemeConfig;
}

export interface PreferenceLayers {
  sistema?: ThemeConfig | null;
  // `centro`/`usuario` are opaque-to-api-ingles at the TOP level but "center"/"user" happen to be in
  // its shared field map, so /me/preferences answers with these two translated to English while
  // `sistema`/`override`/`centroBloqueado` stay Spanish — verified live, same pattern as agenda-dia's
  // columns/rows split. Fixed here; was wrongly typed `centro`/`usuario` before (silently broke
  // setMyLanguage's read of the user's own layer).
  center?: ThemeConfig | null;
  user?: ThemeConfig | null;
  override?: ThemeConfig | null;
  // True when the center's admin locked its color for everyone (docs/specs in cmr-be:
  // centro-bloquea-apariencia-personal.md) — `effective` already resolves with the right
  // precedence when this is true; the FE only uses this to show the notice/disable the picker.
  centroBloqueado?: boolean;
}

export interface MyPreferences {
  effective: ThemeConfig;
  layers: PreferenceLayers;
  // Tema RESUELTO por el BE (igual que el idioma): "claro" por defecto; gana la elección del usuario en
  // cualquier máquina; un valor raro cae en "claro". El FE lo aplica al arrancar. Handoff be-el-tema-arranca-en-claro.
  tema?: string;
  temasDisponibles?: string[];
  idioma?: string;
  idiomasDisponibles?: string[];
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
  const usuario: ThemeConfig & { language?: unknown } = { ...(prefs.layers.user ?? {}) };
  // The raw layer stores it as `language` (api-inglés translates it that way — verified live), but
  // every PUT the FE has ever made writes `idioma`; drop the stale English key so a save never sends
  // both and leaves BE to guess which one is current.
  delete usuario.language;
  if (idioma) usuario.idioma = idioma;
  else delete usuario.idioma;
  return updateMyPreferences(usuario);
}

// Guarda SOLO el tema en la capa del usuario, sin borrar el resto de su apariencia personal (colores,
// radio, fondo, idioma). Mismo patrón que setMyLanguage: leer la capa `usuario` y MEZCLAR `tema`. Valores
// del contrato: "claro" | "oscuro"; `null` vuelve al defecto (quita la clave → se resuelve claro). Handoff
// be-el-tema-arranca-en-claro.
export async function setMyTheme(tema: string | null): Promise<ThemeConfig> {
  const prefs = await getMyPreferences();
  // PRESERVAR toda la capa del usuario (idioma/colores/fondo) y solo mezclar `tema`. NO borrar `language`
  // aquí: hoy la capa guarda el idioma bajo esa clave (verificado en vivo: layers.user = {language:"es"}),
  // y borrarla dejaría al usuario sin idioma. Solo setMyLanguage migra esa clave.
  const usuario: ThemeConfig = { ...(prefs.layers.user ?? {}) };
  if (tema) usuario.tema = tema;
  else delete usuario.tema;
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

// Verified live (2026-09-25): this GET still answers with ONLY the config blob, no `bloqueado` —
// the admin screen has no way to show whether a center is CURRENTLY locked before saving. Flagged
// back in .personal/apariencia-personal-restaurar-y-bloqueo-de-centro-handoff.md; the PUT below
// already accepts it per that same handoff.
export function getCentroPreferences(centroId: string): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>(`/preferences/center/${centroId}`);
}

export function updateCentroPreferences(
  centroId: string,
  config: ThemeConfig,
  // Omit to leave the lock untouched (e.g. saving just a color change) — never sent as `false`
  // unless the admin explicitly flips the switch off.
  bloqueado?: boolean,
): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>(`/preferences/center/${centroId}`, {
    method: "PUT",
    body: JSON.stringify(bloqueado === undefined ? { config } : { config, bloqueado }),
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
