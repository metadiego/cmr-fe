import type { ThemeConfig } from "./config.ts";

/**
 * El `config` de una capa de preferencias es un sobre JSONB LIBRE: además del tema puede llevar
 * ajustes de negocio de esa capa (p. ej. banderas de facturación del centro). El tipo lo dice así
 * para que nadie asuma que el sobre solo contiene apariencia.
 */
export type SobreDeCapa = ThemeConfig & Record<string, unknown>;

/**
 * Claves que pertenecen al TEMA dentro del sobre `config` de una capa de preferencias.
 * Todo lo demás que viva en ese sobre (ajustes de negocio del centro, banderas) es ajeno
 * a la apariencia y no se toca al guardar colores.
 */
export const CLAVES_DE_TEMA = ["colors", "radius", "background", "logo"] as const;

/**
 * Mezcla el tema editado sobre el sobre original: copia el original y pisa SOLO las claves de tema.
 * Guardar la apariencia de una capa no puede borrar los ajustes de negocio que comparten ese `config`.
 */
export function mezclarSoloTema(
  original: SobreDeCapa | ThemeConfig | null | undefined,
  editado: ThemeConfig,
): SobreDeCapa {
  const salida: Record<string, unknown> = { ...(original ?? {}) };
  for (const k of CLAVES_DE_TEMA) {
    const v = (editado as Record<string, unknown>)[k];
    if (v === undefined) continue;
    salida[k] = v;
  }
  return salida as SobreDeCapa;
}
