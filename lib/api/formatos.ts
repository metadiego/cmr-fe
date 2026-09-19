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
// Sección del documento (dentro de `secciones`, bolsa OPACA → claves en español). El `tipo` discrimina.
// Ampliado para salir IDÉNTICO al legacy (modelos médicos): además de texto_libre/firmas, se añaden
// parrafo, campos intermedios, tabla_firmas (con bordes), checklist, tabla_tematica y leyenda. Formas
// exactas en docs/specs/formatos-legacy-handoff-be.md. El FE dibuja lo que el BE emita; nada hardcodeado.
export type FormatoSeccion =
  // OBSERVACIONES: caja (por defecto) o N líneas regladas (`estilo:"lineas"`, `lineas` = nº de renglones).
  | { clave: string; labelKey?: string | null; tipo: "texto_libre"; titulo?: string | null; estilo?: "caja" | "lineas"; alto?: number; lineas?: number }
  // Firmas simples: línea horizontal + label debajo.
  | { clave: string; labelKey?: string | null; tipo: "firmas"; lineas?: string[] }
  // Párrafo estático (p. ej. el texto legal de una constancia).
  | { clave: string; labelKey?: string | null; tipo: "parrafo"; texto: string }
  // Campos intermedios (label/valor) entre el título y la tabla (PEMF/Cámara, Área, Número de serie…).
  | { clave: string; labelKey?: string | null; tipo: "campos"; campos: FormatoCampo[] }
  // Tabla de firmas CON BORDES: `columnas` × `filas` (Nombre/Firma/Fecha), cabecera gris opcional.
  | { clave: string; labelKey?: string | null; tipo: "tabla_firmas"; columnas: string[]; filas: string[]; cabecera?: boolean }
  // Lista de cotejo de enfermería: bandas de sección (colspan) + casillas Sí/No/Observación.
  | {
      clave: string;
      labelKey?: string | null;
      tipo: "checklist";
      columnas?: { pregunta?: string; si?: string; no?: string; obs?: string };
      grupos: { titulo?: string | null; preguntas: { texto: string }[] }[];
    }
  // Tabla temática (procedimiento): cabecera de color, columna de descripción de color, filas pre-puestas.
  // `cabecera` admite 1 o 2 filas (morpheus8 = 2). `filas` = descripciones ya puestas; `filasEnBlanco` añade vacías.
  | {
      clave: string;
      labelKey?: string | null;
      tipo: "tabla_tematica";
      colorHeader?: string | null;
      colorDescCol?: string | null;
      cabecera: FormatoColumna[][];
      filas?: FormatoFila[];
      filasEnBlanco?: number;
    }
  // Pie de leyenda secundario centrado (además del f-b/).
  | { clave: string; labelKey?: string | null; tipo: "leyenda"; texto: string };
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
  // `ocultarEmpresa` (arquetipos 1 y 4 del legacy): NO imprimir la línea "CENTRO DE MEDICINA REGENERATIVA".
  letterhead?: { center?: string; logoUrl?: string | null; ocultarEmpresa?: boolean } | null;
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
