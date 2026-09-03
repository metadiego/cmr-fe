import { apiFetch } from "./client";

// Formatos de terapia (genéricos, data-driven, leídos del legacy). Cada servicio declara sus formatos
// en `servicio.formAcciones.reports[]` (report.id === formato.clave). El documento se pide "armado"
// con la sesión de la fila y se imprime (papel que se firma/archiva). Los de LÁSER van por su ruta
// propia (/laser/formato/:tipo). Contrato: HANDOFF-formatos-terapia (BE PR #192).

// FormatoColumna viaja SIEMPRE dentro de `columnas` (bolsa OPACA) → sus claves NO se traducen: quedan en español.
export type FormatoColumna = { clave: string; labelKey?: string | null };
export type FormatoFila = Record<string, string>; // dentro de `filas` (opaca): sus claves son claves de columna (datos)

// Definición de un formato (lista/admin).
export type Formato = {
  id: string;
  slug: string;
  labelKey?: string | null; // se dice igual (CAMPOS_IGUALES)
  title: string;
  serviceSlug?: string | null;
  layout?: string; // se dice igual (CAMPOS_IGUALES)
  columns: FormatoColumna[]; // clave `columnas`→`columns`; su CONTENIDO no se traduce (bolsa opaca)
  rows: number | FormatoFila[]; // clave `filas`→`rows`; nº de filas en blanco, o filas explícitas
  letterhead?: boolean | { center?: string } | null;
  sortOrder?: number;
  active?: boolean;
};

// Par etiqueta/valor del encabezado (layout "campos"). Viaja dentro de `campos` (bolsa OPACA) → claves en español.
export type FormatoCampo = { clave: string; labelKey?: string | null; valor?: string | null; origen?: string };
// Sección del documento (dentro de `secciones`, bolsa OPACA → claves en español): texto_libre o firmas.
export type FormatoSeccion =
  | { clave: string; labelKey?: string | null; tipo: "texto_libre"; alto?: number }
  | { clave: string; labelKey?: string | null; tipo: "firmas"; lineas?: string[] };
// Pie del legacy (clave `pie`→`footer`; su contenido SÍ se traduce). `login` y `fechaHora` NO están en el mapa.
export type FormatoPie = { prefix?: string; user?: string; login?: string; fechaHora?: string } | null;

// Documento ARMADO (print-ready) para una sesión. El `layout` es el discriminador:
// "campos" = encabezado de pares etiqueta/valor (no rejilla); "tabla" = rejilla de columnas/filas.
export type FormatoArmado = {
  slug: string;
  title: string;
  labelKey?: string | null;
  layout?: string;
  // Membrete (BE PR #207): centro + logo del centro (null → el FE usa el asset por defecto).
  letterhead?: { center?: string; logoUrl?: string | null } | null;
  patient?: { name?: string | null; medicalRecordNumber?: string | null } | null;
  date?: string | null;
  fields?: FormatoCampo[]; // clave `campos`→`fields`; contenido opaco (FormatoCampo en español)
  columns: FormatoColumna[]; // clave `columnas`→`columns`; contenido opaco
  rows: FormatoFila[]; // clave `filas`→`rows`; celdas en blanco para llenar a mano; contenido opaco
  sections?: FormatoSeccion[]; // clave `secciones`→`sections`; contenido opaco (FormatoSeccion en español)
  footer?: FormatoPie; // clave `pie`→`footer`; en TODOS los formatos
};

// GET /formats?service=<clave> — lista de formatos del servicio (para el menú / admin).
export function getFormatos(servicio?: string, centroId?: string): Promise<Formato[]> {
  const qs = servicio ? `?service=${encodeURIComponent(servicio)}` : "";
  return apiFetch<unknown>(`/formats${qs}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as Formato[]) : (((r as { items?: Formato[] })?.items) ?? []),
  );
}

// GET /formats/{slug}/assembly?sessionId=… — documento listo para imprimir. Sin sessionId sale en blanco.
export function getFormatoArmado(clave: string, sesionId?: string, centroId?: string): Promise<FormatoArmado> {
  const qs = sesionId ? `?sessionId=${encodeURIComponent(sesionId)}` : "";
  return apiFetch<FormatoArmado>(`/formats/${encodeURIComponent(clave)}/assembly${qs}`, {}, centroId);
}

// CRUD admin (permiso formatos.config).
export type FormatoInput = {
  slug: string;
  labelKey?: string;
  title: string;
  serviceSlug: string;
  layout?: string;
  columns: FormatoColumna[]; // clave `columnas`; items en español (bolsa opaca también al entrar)
  rows: number; // clave `filas`
  letterhead?: boolean;
  sortOrder?: number;
  active?: boolean;
};
export function createFormato(input: FormatoInput, centroId?: string): Promise<Formato> {
  return apiFetch<Formato>(`/formats`, { method: "POST", body: JSON.stringify(input) }, centroId);
}
export function updateFormato(id: string, input: Partial<FormatoInput>, centroId?: string): Promise<Formato> {
  return apiFetch<Formato>(`/formats/${id}`, { method: "PUT", body: JSON.stringify(input) }, centroId);
}
