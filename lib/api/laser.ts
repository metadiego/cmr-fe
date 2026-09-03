import { apiFetch } from "./client";
import type { FormatoPie } from "./formatos";

// Catálogo de parámetros de terapia láser (HILT/MLS) + formato print-ready.
// El BE entrega DATOS + estructura (no PDF): el render/print es del FE. Catálogo
// editable por API/MCP (permiso laser.update/create/delete); lectura laser.read.
// Contrato: /api/v1/laser/parametros y /api/v1/laser/formato/{tipo}.

export type LaserTipo = "hilt" | "mls";

// Una fila del catálogo. HILT usa stp*/energy; MLS usa frequency/duration/intensity.
export interface LaserParametro {
  id: string;
  pathology: string;
  type: LaserTipo;
  area: string;
  sortOrder: number;
  itemOrder: number;
  // HILT
  stp1Mjcm: number | null;
  stp1Hz: number | null;
  stp2Mjcm: number | null;
  stp2Hz: number | null;
  stp3Mjcm: number | null;
  stp3Hz: number | null;
  energy: number | null;
  // MLS
  frequency: string | null;
  duration: string | null;
  intensity: string | null;
  active: boolean;
}

// Membrete del formato (BE PR #207): centro + logo del centro (null → asset por defecto en el FE).
export interface FormatoMembrete {
  center?: string | null;
  logoUrl?: string | null;
}
// HILT: secciones por región, en orden (10 regiones).
// OJO (inconsistencia BE bajo v2): la CLAVE `secciones` se traduce a `sections`, pero `secciones`
// y `filas` son bolsas OPACAS en el traductor del BE, así que su CONTENIDO llega EN ESPAÑOL:
// `region`, `orden` y las filas (`LaserParametro` con campos españoles: patologia/frecuencia/…).
// El tipo declara `LaserParametro` (inglés) por reuso; para HILT/getFormato el runtime NO coincide.
// Arreglo del BE: sacar `secciones`/`filas` de CAMPOS_OPACOS para láser o añadir region al mapa.
export interface FormatoHilt {
  type: "hilt";
  sections: { region: string; orden: number; filas: LaserParametro[] }[];
  footer?: FormatoPie; // pie del legacy (BE PR #201) — mismo shape que el genérico
  letterhead?: FormatoMembrete;
}
// MLS: dos columnas (izquierda/derecha). `izquierda`/`derecha` NO están en el mapa CAMPOS_EN_INGLES,
// así que la CLAVE llega en español bajo v2; su CONTENIDO sí se traduce (LaserParametro inglés).
export interface FormatoMls {
  type: "mls";
  izquierda: LaserParametro[];
  derecha: LaserParametro[];
  footer?: FormatoPie;
  letterhead?: FormatoMembrete;
}
export type Formato = FormatoHilt | FormatoMls;

// GET /laser/format/{type} — formato armado (print-ready).
export function getFormato(tipo: LaserTipo, centroId?: string): Promise<Formato> {
  return apiFetch<Formato>(`/laser/format/${tipo}`, {}, centroId);
}

// GET /laser/parameters?type= — catálogo (editor).
export function getParametros(tipo: LaserTipo, centroId?: string): Promise<LaserParametro[]> {
  return apiFetch<LaserParametro[]>(`/laser/parameters?type=${tipo}`, {}, centroId).then((r) =>
    Array.isArray(r) ? r : ((r as { items?: LaserParametro[] })?.items ?? []),
  );
}
