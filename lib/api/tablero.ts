import { apiFetch } from "./client";
import type { components } from "./schema";
import type { ColumnaEfectiva, CitaFila } from "./agenda-dia";

// Catalog column definition (GET /tablero/columnas). `ambitos` = which boards
// it's eligible for. Distinct from ColumnaEfectiva (a placed column).
export type ColumnaCatalogo = components["schemas"]["ColumnaEntity"];

// Metadata-driven board (GET /citas/tablero). Same dynamic-column engine as the
// day-view: effective columns + projected flat rows for a day. Not typed in
// Swagger (streamed projection), so we model the verified contract here.
export interface Tablero {
  columnas: ColumnaEfectiva[];
  filas: CitaFila[];
}

// tablero: which board composition ("citas" = Atención al Paciente).
// soloAtencion: only Atención states (confirmada→atendida) — the AP board.
export function getTablero(
  fecha: string,
  opts: { tablero?: string; centroId?: string; soloAtencion?: boolean } = {},
): Promise<Tablero> {
  const sp = new URLSearchParams({ fecha });
  if (opts.tablero) sp.set("tablero", opts.tablero);
  if (opts.soloAtencion) sp.set("soloAtencion", "true");
  return apiFetch<Tablero>(`/citas/tablero?${sp.toString()}`, {}, opts.centroId);
}

// ── Column builder (metadata engine — works for any tablero key) ─────────────

// GET /tablero/columnas?tablero= — catalog of columns ELIGIBLE for that board.
export function getColumnasCatalogo(tablero: string): Promise<ColumnaCatalogo[]> {
  return apiFetch<ColumnaCatalogo[]>(`/tablero/columnas?tablero=${encodeURIComponent(tablero)}`);
}

// GET /tablero/efectivas?tablero= — the columns currently placed (orden/visible/fijo).
export function getColumnasEfectivas(tablero: string): Promise<ColumnaEfectiva[]> {
  return apiFetch<ColumnaEfectiva[]>(`/tablero/efectivas?tablero=${encodeURIComponent(tablero)}`);
}

export interface ComposicionItem {
  columnaId: string;
  orden?: number;
  visible?: boolean;
  fijo?: boolean;
  activo?: boolean;
}

// POST /tablero/composicion/bulk — board-level composition (needs tablero.config).
export function setComposicionBulk(tablero: string, columnas: ComposicionItem[]): Promise<unknown> {
  return apiFetch(`/tablero/composicion/bulk`, {
    method: "POST",
    body: JSON.stringify({ tablero, columnas }),
  });
}

// POST /tablero/personalizar — per-user override (any user).
export function personalizarColumna(payload: {
  tablero: string;
  columnaId: string;
  visible?: boolean;
  orden?: number;
  fijo?: boolean;
}): Promise<unknown> {
  return apiFetch(`/tablero/personalizar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
