import { apiFetch } from "./client";
import type { FormatoPie } from "./formatos";

// Catálogo de parámetros de terapia láser (HILT/MLS) + formato print-ready.
// El BE entrega DATOS + estructura (no PDF): el render/print es del FE. Catálogo
// editable por API/MCP (permiso laser.update/create/delete); lectura laser.read.
// Contrato: /api/v1/laser/parametros y /api/v1/laser/formato/{tipo}.

export type LaserTipo = "hilt" | "mls";

// Una fila del catálogo. HILT usa stp*/energy; MLS usa frecuencia/tiempo/intensidad.
export interface LaserParametro {
  id: string;
  patologia: string;
  tipo: LaserTipo;
  area: string;
  orden: number;
  orden2: number;
  // HILT
  stp1Mjcm: number | null;
  stp1Hz: number | null;
  stp2Mjcm: number | null;
  stp2Hz: number | null;
  stp3Mjcm: number | null;
  stp3Hz: number | null;
  energy: number | null;
  // MLS
  frecuencia: string | null;
  tiempo: string | null;
  intensidad: string | null;
  activo: boolean;
}

// HILT: secciones por región, en orden (10 regiones).
export interface FormatoHilt {
  tipo: "hilt";
  secciones: { region: string; orden: number; filas: LaserParametro[] }[];
  pie?: FormatoPie; // pie del legacy (BE PR #201) — mismo shape que el genérico
}
// MLS: dos columnas (izquierda/derecha).
export interface FormatoMls {
  tipo: "mls";
  izquierda: LaserParametro[];
  derecha: LaserParametro[];
  pie?: FormatoPie;
}
export type Formato = FormatoHilt | FormatoMls;

// GET /laser/formato/{tipo} — formato armado (print-ready).
export function getFormato(tipo: LaserTipo, centroId?: string): Promise<Formato> {
  return apiFetch<Formato>(`/laser/formato/${tipo}`, {}, centroId);
}

// GET /laser/parametros?tipo= — catálogo (editor).
export function getParametros(tipo: LaserTipo, centroId?: string): Promise<LaserParametro[]> {
  return apiFetch<LaserParametro[]>(`/laser/parametros?tipo=${tipo}`, {}, centroId).then((r) =>
    Array.isArray(r) ? r : ((r as { items?: LaserParametro[] })?.items ?? []),
  );
}
