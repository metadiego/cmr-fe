import { apiFetch } from "./client";
import type { components } from "./schema";
import type { ColumnaEfectiva, CitaFila } from "./agenda-dia";
import type { EstadoCitaCatalogo } from "./citas";

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

// GET /tablero/columnas — catalog. With `tablero` → only columns ELIGIBLE for
// that board (by ambitos); without → the WHOLE catalog (to incorporate/reuse).
export function getColumnasCatalogo(tablero?: string): Promise<ColumnaCatalogo[]> {
  const qs = tablero ? `?tablero=${encodeURIComponent(tablero)}` : "";
  return apiFetch<ColumnaCatalogo[]>(`/tablero/columnas${qs}`);
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
  render?: Record<string, unknown>; // override del usuario, ej. {color, background}
}): Promise<unknown> {
  return apiFetch(`/tablero/personalizar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Generic board engine (registry-driven; any vertical) ────────────────────

// A registered vertical (GET /tableros). `entidad` = event entity for SSE
// filtering; `filtros` = server-side scope (e.g. {soloAtencion:true} for AP).
export interface TableroRegistro {
  id: string;
  clave: string;
  labelKey: string;
  icon: string | null;
  orden: number;
  permiso: string | null;
  layout: string; // "etapas" | "tabla" | ...
  ruta: string; // ruta del board del vertical, ej. "/tablero/atencion"
  entidad: string; // "cita" | "sesion" | ...
  filtros: Record<string, unknown> | null;
  esVertical?: boolean; // true → aparece en /tableros (menú); false → consultable (citas_cc)
  activo: boolean;
}

// A declarative transition (definicion.transiciones). `requiere` = payload field
// claves the FE must collect. `desdeEstados` empty = available from any state.
export interface Transicion {
  id: string;
  clave: string;
  labelKey: string;
  desdeEstados: string[];
  aEstado: string | null;
  metodo: string;
  path: string | null;
  accion: string | null;
  permiso: string | null;
  requiere: string[];
  confirmar: boolean;
  orden: number;
  activo: boolean;
}

export interface SubTipo {
  id: string;
  clave: string;
  labelKey: string;
  orden: number;
  activo?: boolean;
}

export interface TableroDefinicion {
  tablero: string;
  columnas: ColumnaEfectiva[];
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  subTipos: SubTipo[];
}

// GET /tableros — the vertical registry.
export function getTableros(): Promise<TableroRegistro[]> {
  return apiFetch<TableroRegistro[]>(`/tableros`);
}

// GET /tablero/definicion?tablero= — columns + states + transitions + subtypes.
export function getDefinicion(tablero: string): Promise<TableroDefinicion> {
  return apiFetch<TableroDefinicion>(`/tablero/definicion?tablero=${encodeURIComponent(tablero)}`);
}

// GET /tablero/filas?tablero=&fecha=(&subTipo=) — projected rows for a day.
// For "servicios" the columns come from THIS response (per-service), so always
// render with the columnas returned here.
export function getFilas(
  tablero: string,
  fecha: string,
  opts: { centroId?: string; subTipo?: string } = {},
): Promise<Tablero> {
  const sp = new URLSearchParams({ tablero, fecha });
  if (opts.subTipo) sp.set("subTipo", opts.subTipo);
  return apiFetch<Tablero>(`/tablero/filas?${sp.toString()}`, {}, opts.centroId);
}

// POST /tablero/celda — edit an editable cell. BE validates the column is
// editable in that tablero, maps by binding (allowlist), applies it and records
// a `campo_editado` audit event (antes/después + actor) + SSE. tenant scopes it.
export function editarCelda(
  body: { tablero: string; entidadId: string; columna: string; valor: unknown },
  centroId?: string,
): Promise<unknown> {
  return apiFetch(`/tablero/celda`, { method: "POST", body: JSON.stringify(body) }, centroId);
}

// An option for a data-driven `select` cell (GET /tablero/opciones). Populated
// server-side from `render.optionsSource` (e.g. "medicos"). Query by column
// CLAVE (not id): GET /tablero/opciones?tablero=&columna=<clave>.
export interface Opcion {
  value: string;
  label: string;
}

export function getOpciones(tablero: string, columna: string, centroId?: string): Promise<Opcion[]> {
  return apiFetch<Opcion[]>(
    `/tablero/opciones?tablero=${encodeURIComponent(tablero)}&columna=${encodeURIComponent(columna)}`,
    undefined,
    centroId,
  );
}

// POST /tablero/composicion — set one column's placement/color in a board (admin
// pre-personalization). `color` (null clears). Single-column upsert; does NOT
// touch the rest of the composition.
export function colorColumna(
  tablero: string,
  columnaId: string,
  color: string | null,
): Promise<unknown> {
  return apiFetch(`/tablero/composicion`, {
    method: "POST",
    body: JSON.stringify({ tablero, columnaId, color }),
  });
}

// POST /tablero/accion — execute a declarative transition. Fields go in payload
// (definicion.transiciones[].requiere says which). tenant scopes the request.
export function ejecutarAccion(
  body: { tablero: string; entidadId: string; accion: string; payload?: Record<string, unknown> },
  centroId?: string,
): Promise<unknown> {
  return apiFetch(`/tablero/accion`, { method: "POST", body: JSON.stringify(body) }, centroId);
}

// ── Admin CRUD (Constructor de Tableros; gate `tablero.admin`) ───────────────
// Create a vertical from the UI, no code. Delete is soft (activo:false). Admin
// GETs use ?all=true to include inactive rows. Types come straight from Swagger.

export type CreateTableroInput = components["schemas"]["CreateTableroDto"];
export type UpdateTableroInput = components["schemas"]["UpdateTableroDto"];
export type CreateColumnaInput = components["schemas"]["CreateColumnaDto"];
export type UpdateColumnaInput = components["schemas"]["UpdateColumnaDto"];
export type CreateEstadoInput = components["schemas"]["CreateEstadoDto"];
export type UpdateEstadoInput = components["schemas"]["UpdateEstadoDto"];
export type CreateTransicionInput = components["schemas"]["CreateTransicionDto"];
export type UpdateTransicionInput = components["schemas"]["UpdateTransicionDto"];
export type CreateSubTipoInput = components["schemas"]["CreateSubtipoDto"];
export type UpdateSubTipoInput = components["schemas"]["UpdateSubtipoDto"];

const q = (tablero: string, all: boolean) =>
  `?tablero=${encodeURIComponent(tablero)}${all ? "&all=true" : ""}`;

// Tableros registry
export function crearTablero(body: CreateTableroInput): Promise<TableroRegistro> {
  return apiFetch(`/tableros`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarTablero(id: string, body: UpdateTableroInput): Promise<TableroRegistro> {
  return apiFetch(`/tableros/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarTablero(id: string): Promise<void> {
  return apiFetch(`/tableros/${id}`, { method: "DELETE" });
}

// Columnas de catálogo (GET catálogo: getColumnasCatalogo)
export function crearColumna(body: CreateColumnaInput): Promise<ColumnaCatalogo> {
  return apiFetch(`/tablero/columnas`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarColumna(id: string, body: UpdateColumnaInput): Promise<ColumnaCatalogo> {
  return apiFetch(`/tablero/columnas/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

// Estados
export function getEstadosAdmin(tablero: string, all = true): Promise<EstadoCitaCatalogo[]> {
  return apiFetch(`/tablero/estados${q(tablero, all)}`);
}
export function crearEstado(body: CreateEstadoInput): Promise<EstadoCitaCatalogo> {
  return apiFetch(`/tablero/estados`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarEstado(id: string, body: UpdateEstadoInput): Promise<EstadoCitaCatalogo> {
  return apiFetch(`/tablero/estados/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarEstado(id: string): Promise<void> {
  return apiFetch(`/tablero/estados/${id}`, { method: "DELETE" });
}

// Transiciones
export function getTransicionesAdmin(tablero: string, all = true): Promise<Transicion[]> {
  return apiFetch(`/tablero/transiciones${q(tablero, all)}`);
}
export function crearTransicion(body: CreateTransicionInput): Promise<Transicion> {
  return apiFetch(`/tablero/transiciones`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarTransicion(id: string, body: UpdateTransicionInput): Promise<Transicion> {
  return apiFetch(`/tablero/transiciones/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarTransicion(id: string): Promise<void> {
  return apiFetch(`/tablero/transiciones/${id}`, { method: "DELETE" });
}

// SubTipos
export function getSubTiposAdmin(tablero: string, all = true): Promise<SubTipo[]> {
  return apiFetch(`/tablero/subtipos${q(tablero, all)}`);
}
export function crearSubTipo(body: CreateSubTipoInput): Promise<SubTipo> {
  return apiFetch(`/tablero/subtipos`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarSubTipo(id: string, body: UpdateSubTipoInput): Promise<SubTipo> {
  return apiFetch(`/tablero/subtipos/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarSubTipo(id: string): Promise<void> {
  return apiFetch(`/tablero/subtipos/${id}`, { method: "DELETE" });
}
