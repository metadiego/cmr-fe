// lib/theme/config.ts
// The token vocabulary the FE owns. The BE stores theme config as a free JSONB
// blob (config por capas #51) and resolves the EFFECTIVE config by precedence
// (override → user → center → system); the FE just paints `effective` by mapping
// these keys to the CSS variables defined in app/globals.css.
//
// Colors must be valid CSS colors (the design system uses OKLCH, e.g.
// "oklch(0.62 0.2 264)"). Keep every value a token — never bespoke CSS.

export type ThemeColorKey =
  | "background"
  | "foreground"
  | "card"
  | "cardForeground"
  | "popover"
  | "popoverForeground"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "border"
  | "input"
  | "ring";

export interface ThemeConfig {
  colors?: Partial<Record<ThemeColorKey, string>>;
  /** Base radius, e.g. "0.625rem". */
  radius?: string;
  font?: {
    sans?: string;
    heading?: string;
  };
  /** Page background media (Supabase Storage public URLs). */
  background?: {
    imageUrl?: string;
    videoUrl?: string; // applied by the FE separately (future); not a CSS var
  };
  /**
   * Acento de color por centro, indexado por centroId (ej. { "<bayamon>": "#2563EB" }).
   * Señal visual sutil (punto de color junto al nombre del centro) para que los usuarios
   * multi-centro se ubiquen de un vistazo. Default del sistema (Bayamón azul, Caguas verde);
   * personalizable por usuario en "Mi apariencia". No es una CSS var — el FE lo pinta puntual.
   */
  colorPorCentro?: Record<string, string>;
  /**
   * Recibo térmico: ancho IMPRIMIBLE del papel en mm (no el ancho del rollo). Default del sistema 72
   * (rollo de 80mm, área imprimible ~72). Hay rollos de 58mm → dato por centro, no constante. El FE lo
   * escribe como `--recibo-ancho` y `@page`/`.recibo-print` lo usan. Handoff recibo-termico-sale-en-miniatura.
   */
  recibo?: { anchoMm?: number };
}

// Redesign navy (2026-08): el color-theming por-centro está en PAUSA — el sistema de
// diseño (globals.css) es la única fuente de color. El mapa token→CSS-var se removió
// junto con su aplicación (ver configToCssVars). `config.colors` se ignora.

// Translate an effective ThemeConfig into the CSS variables to set on <html>.
// Unknown/empty keys are ignored so a missing config paints nothing (the
// globals.css defaults remain).
export function configToCssVars(config: ThemeConfig | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!config) return vars;

  // COLOR y --app-bg-image: intencionalmente NO se aplican. Los temas por-centro
  // guardados venían del diseño oscuro anterior y su índigo se filtraba a
  // fondos/píldoras/dropdowns/headers vía --background/--foreground/--card/--secondary…
  // El sistema de diseño claro (globals.css) manda en color. El branding solo aporta
  // radio, tipografía y ancho de recibo (funcionales, no cromáticos).
  if (config.radius) vars["--radius"] = config.radius;
  if (config.font?.sans) vars["--font-sans"] = config.font.sans;
  if (config.font?.heading) vars["--font-heading"] = config.font.heading;
  // Ancho imprimible del recibo térmico por centro; si el BE no lo manda, el CSS deja el default 72mm.
  const ancho = Number(config.recibo?.anchoMm);
  if (Number.isFinite(ancho) && ancho > 0) vars["--recibo-ancho"] = `${ancho}mm`;

  return vars;
}
