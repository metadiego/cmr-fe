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
}

// camelCase token key → CSS custom property in globals.css.
const COLOR_VAR: Record<ThemeColorKey, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  success: "--success",
  warning: "--warning",
  info: "--info",
  border: "--border",
  input: "--input",
  ring: "--ring",
};

// Translate an effective ThemeConfig into the CSS variables to set on <html>.
// Unknown/empty keys are ignored so a missing config paints nothing (the
// globals.css defaults remain).
export function configToCssVars(config: ThemeConfig | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!config) return vars;

  if (config.colors) {
    for (const [key, value] of Object.entries(config.colors)) {
      const cssVar = COLOR_VAR[key as ThemeColorKey];
      if (cssVar && value) vars[cssVar] = value;
    }
  }
  if (config.radius) vars["--radius"] = config.radius;
  if (config.font?.sans) vars["--font-sans"] = config.font.sans;
  if (config.font?.heading) vars["--font-heading"] = config.font.heading;
  if (config.background?.imageUrl) {
    // CSS.escape isn't needed for a URL inside url("…"); quote it.
    vars["--app-bg-image"] = `url("${config.background.imageUrl}")`;
  }

  return vars;
}
