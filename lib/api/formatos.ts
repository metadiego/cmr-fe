import { apiFetch } from "./client";

// Formatos de terapia (genéricos, data-driven, leídos del legacy). Cada servicio declara sus formatos
// en `servicio.formAcciones.reports[]` (report.id === formato.clave). El documento se pide "armado"
// con la sesión de la fila y se imprime (papel que se firma/archiva). Los de LÁSER van por su ruta
// propia (/laser/formato/:tipo). Contrato: HANDOFF-formatos-terapia (BE PR #192).

export type FormatoColumna = { clave: string; labelKey?: string | null };
export type FormatoFila = Record<string, string>;

// Definición de un formato (lista/admin).
export type Formato = {
  id: string;
  clave: string;
  labelKey?: string | null;
  titulo: string;
  servicioClave?: string | null;
  layout?: string;
  columnas: FormatoColumna[];
  filas: number | FormatoFila[]; // nº de filas en blanco, o filas explícitas
  membrete?: boolean | { centro?: string } | null;
  orden?: number;
  activo?: boolean;
};

// Par etiqueta/valor del encabezado (layout "campos", p. ej. Vit C: FECHA, NOMBRE, RECORD, SESION, DOSIS).
export type FormatoCampo = { clave: string; labelKey?: string | null; valor?: string | null; origen?: string };
// Sección del documento: texto_libre (recuadro de N líneas para escribir a mano) o firmas (líneas a firmar).
export type FormatoSeccion =
  | { clave: string; labelKey?: string | null; tipo: "texto_libre"; alto?: number }
  | { clave: string; labelKey?: string | null; tipo: "firmas"; lineas?: string[] };
// Pie del legacy: `{prefijo}{login||usuario} - {fechaHora}` (p. ej. "f-b/ usuario - 2026-07-30 16:17").
export type FormatoPie = { prefijo?: string; usuario?: string; login?: string; fechaHora?: string } | null;

// Documento ARMADO (print-ready) para una sesión. El `layout` es el discriminador:
// "campos" = encabezado de pares etiqueta/valor (no rejilla); "tabla" = rejilla de columnas/filas.
export type FormatoArmado = {
  clave: string;
  titulo: string;
  labelKey?: string | null;
  layout?: string;
  membrete?: { centro?: string } | null;
  paciente?: { nombre?: string | null; record?: string | null } | null;
  fecha?: string | null;
  campos?: FormatoCampo[]; // layout "campos"
  columnas: FormatoColumna[];
  filas: FormatoFila[]; // filas (en blanco, una celda por columna) para llenar a mano
  secciones?: FormatoSeccion[]; // observaciones/firmas (en cualquier layout)
  pie?: FormatoPie; // en TODOS los formatos
};

// GET /formatos?servicio=<clave> — lista de formatos del servicio (para el menú / admin).
export function getFormatos(servicio?: string, centroId?: string): Promise<Formato[]> {
  const qs = servicio ? `?servicio=${encodeURIComponent(servicio)}` : "";
  return apiFetch<unknown>(`/formatos${qs}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as Formato[]) : (((r as { items?: Formato[] })?.items) ?? []),
  );
}

// GET /formatos/{clave}/armado?sesionId=… — documento listo para imprimir. Sin sesionId sale en blanco.
export function getFormatoArmado(clave: string, sesionId?: string, centroId?: string): Promise<FormatoArmado> {
  const qs = sesionId ? `?sesionId=${encodeURIComponent(sesionId)}` : "";
  return apiFetch<FormatoArmado>(`/formatos/${encodeURIComponent(clave)}/armado${qs}`, {}, centroId);
}

// CRUD admin (permiso formatos.config).
export type FormatoInput = {
  clave: string;
  labelKey?: string;
  titulo: string;
  servicioClave: string;
  layout?: string;
  columnas: FormatoColumna[];
  filas: number;
  membrete?: boolean;
  orden?: number;
  activo?: boolean;
};
export function createFormato(input: FormatoInput, centroId?: string): Promise<Formato> {
  return apiFetch<Formato>(`/formatos`, { method: "POST", body: JSON.stringify(input) }, centroId);
}
export function updateFormato(id: string, input: Partial<FormatoInput>, centroId?: string): Promise<Formato> {
  return apiFetch<Formato>(`/formatos/${id}`, { method: "PUT", body: JSON.stringify(input) }, centroId);
}
