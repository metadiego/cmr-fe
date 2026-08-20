"use client";

// Ajustes de impresión POR DISPOSITIVO (la impresora es física, vive en la máquina, no en el BE).
// Se guardan en localStorage. Default: "navegador" → comportamiento actual intacto en todas partes.
// Un centro con impresora térmica + QZ Tray instalado elige "qz" y su impresora; el resto sigue igual.
export type MetodoImpresion = "navegador" | "qz";

export interface PrintSettings {
  metodo: MetodoImpresion;
  impresora: string | null; // nombre exacto de la impresora en el sistema (lista QZ)
  columnas: number; // ancho ESC/POS en caracteres (48 = 80mm Font A, 32 = 58mm)
}

const KEY = "cmr.print.settings.v1";
const DEFAULTS: PrintSettings = { metodo: "navegador", impresora: null, columnas: 48 };

export function getPrintSettings(): PrintSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<PrintSettings>;
    return {
      metodo: p.metodo === "qz" ? "qz" : "navegador",
      impresora: typeof p.impresora === "string" ? p.impresora : null,
      columnas: Number.isFinite(p.columnas) && Number(p.columnas) > 0 ? Number(p.columnas) : 48,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPrintSettings(next: Partial<PrintSettings>): PrintSettings {
  const merged = { ...getPrintSettings(), ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* almacenamiento no disponible → no bloquea; se usa el default en memoria */
  }
  return merged;
}
