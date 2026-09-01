// lib/theme/brand.ts
// Branding MÍNIMO y cohesivo: lo único personalizable del tema es UN color de marca,
// elegido de una lista pre-aprobada. Todo lo demás (fondos, texto, tarjetas, colores de
// estado, el rail oscuro) lo fija el sistema de diseño en globals.css y NO se toca.
//
// Truco OKLCH: el navy del diseño es oklch(0.53 0.10 250) — Luz 0.53, Croma 0.10, Tono 250.
// Cada marca aprobada mantiene una L/C parecidas y solo cambia el TONO, así todas pesan igual
// y el texto blanco sobre `--primary` siempre contrasta (la L está fija en un valor oscuro).

export interface BrandOption {
  /** Clave estable (i18n `appearance.brand_<key>`), no visible. */
  key: string;
  /** Color primario en OKLCH; se aplica tal cual a --primary. */
  primary: string;
}

// Set curado: todos a ~L0.53 para contraste garantizado con texto blanco. Se pueden
// añadir/quitar aquí; la UI y la derivación los toman de esta lista.
export const APPROVED_BRANDS: BrandOption[] = [
  { key: "navy", primary: "oklch(0.53 0.10 250)" }, // default del sistema
  { key: "ocean", primary: "oklch(0.53 0.11 232)" },
  { key: "teal", primary: "oklch(0.55 0.09 195)" },
  { key: "emerald", primary: "oklch(0.54 0.11 158)" },
  { key: "violet", primary: "oklch(0.51 0.13 292)" },
  { key: "rose", primary: "oklch(0.55 0.15 12)" },
];

export const DEFAULT_BRAND = APPROVED_BRANDS[0];

/** Extrae el TONO (tercer componente) de un color "oklch(L C H)". null si no es OKLCH. */
export function hueOf(oklch: string | null | undefined): number | null {
  if (!oklch) return null;
  const m = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/i.exec(oklch);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) ? h : null;
}

/** ¿El primario guardado corresponde a una marca aprobada? Devuelve su key, o null. */
export function brandKeyFor(primary: string | null | undefined): string | null {
  if (!primary) return null;
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const p = norm(primary);
  return APPROVED_BRANDS.find((b) => norm(b.primary) === p)?.key ?? null;
}

// Deriva SOLO la familia de acento (6 vars) a partir del primario elegido. El resto de
// tokens del diseño no se tocan. SOLO se aplica si el primario es un color APROBADO; toda
// config no aprobada (heredada del editor libre viejo, hex, etc.) se ignora y se cae al
// default navy del diseño — así se garantiza que solo pintan colores de la lista curada.
export function deriveBrandVars(
  primary: string | null | undefined,
): Record<string, string> {
  if (!primary || !brandKeyFor(primary)) return {};
  const h = hueOf(primary);
  if (h == null) return {};
  return {
    "--primary": primary,
    "--ring": primary,
    "--sidebar-primary": primary,
    "--sidebar-ring": primary,
    // Tinte claro y su texto, mismo tono que el primario (hover/acento sutil).
    "--accent": `oklch(0.94 0.03 ${h})`,
    "--accent-foreground": `oklch(0.33 0.06 ${h})`,
  };
}
