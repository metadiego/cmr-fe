// Preferencias del contador de presentes en la barra de servicios (handoff presentes-por-servicio).
// La CORPORATIVA (por centro) manda sobre la PERSONAL: el BE las devuelve YA RESUELTAS en una llamada;
// el FE no mezcla. Mientras el endpoint de preferencias se confirma, se usan estos DEFAULTS (son un
// fallback, NO configuración cableada): `punto`, círculo, color primario, números y latido encendidos,
// vacíos visibles, barra normal.

export type PresentesModo = "punto" | "presion" | "tramos" | "burbuja";
export type PresentesFigura = "circulo" | "cuadrado" | "barra";
// Paleta del proyecto + `primario` (el default, = color primario de la app).
export type PresentesColor = "primario" | "violeta" | "verde" | "azul" | "ambar" | "rojo" | "tinta";

export interface PresentesPrefs {
  modo: PresentesModo;
  figura: PresentesFigura;
  color: PresentesColor;
  verNumeros: boolean;
  latido: boolean;
  ocultarVacios: boolean;
  compacta: boolean;
}

export const PRESENTES_DEFAULTS: PresentesPrefs = {
  modo: "punto",
  figura: "circulo",
  color: "primario",
  verNumeros: true,
  latido: true,
  ocultarVacios: false,
  compacta: false,
};

// Color de «hay gente» por clave de paleta → valor CSS (variables del tema con fallback). El vacío se
// pinta en gris aparte (no sale de aquí).
export const PRESENTES_COLOR_CSS: Record<PresentesColor, string> = {
  primario: "var(--primary)",
  violeta: "var(--color-violet-500, #8b5cf6)",
  verde: "var(--color-emerald-500, #10b981)",
  azul: "var(--color-sky-500, #0ea5e9)",
  ambar: "var(--color-amber-500, #f59e0b)",
  rojo: "var(--color-red-500, #ef4444)",
  tinta: "var(--foreground)",
};
