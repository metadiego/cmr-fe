import { apiFetch, apiFetchEnvelope } from "./client";
import type { components } from "./schema";
import type { Persistencia } from "./types";
import type { ColumnaEfectiva, CitaFila } from "./agenda-dia";
import type { EstadoCitaCatalogo } from "./citas";

// Catalog column definition (GET /board/columns). `scopes` = which boards
// it's eligible for. Distinct from ColumnaEfectiva (a placed column).
export type ColumnaCatalogo = components["schemas"]["ColumnaEntity"];

// Metadata-driven board (GET /appointments/board). Same dynamic-column engine as the
// day-view: effective columns + projected flat rows for a day. Not typed in
// Swagger (streamed projection), so we model the verified contract here.
// `columnas`→`columns` y `filas`→`rows` son claves OPACAS: la respuesta las renombra
// pero su CONTENIDO (ColumnaEfectiva/CitaFila) queda en español (motor de tableros).
export interface Tablero {
  columns: ColumnaEfectiva[];
  rows: CitaFila[];
}

// tablero: which board composition ("citas" = Atención al Paciente).
// soloAtencion: only Atención states (confirmada→atendida) — the AP board.
export function getTablero(
  fecha: string,
  opts: { tablero?: string; centroId?: string; soloAtencion?: boolean } = {},
): Promise<Tablero> {
  const sp = new URLSearchParams({ date: fecha });
  if (opts.tablero) sp.set("boardSlug", opts.tablero);
  if (opts.soloAtencion) sp.set("onlyCare", "true");
  return apiFetch<Tablero>(`/appointments/board?${sp.toString()}`, {}, opts.centroId);
}

// ── Column builder (metadata engine — works for any tablero key) ─────────────

// GET /board/columns — catalog. With `boardSlug` → only columns ELIGIBLE for
// that board (by scopes); without → the WHOLE catalog (to incorporate/reuse).
export function getColumnasCatalogo(tablero?: string): Promise<ColumnaCatalogo[]> {
  const qs = tablero ? `?boardSlug=${encodeURIComponent(tablero)}` : "";
  return apiFetch<ColumnaCatalogo[]>(`/board/columns${qs}`);
}

// GET /board/effective?boardSlug= — the columns currently placed (sortOrder/visible/pinned).
// OJO api-ingles: al ser un ARRAY directo (no dentro de la clave opaca `columnas`), la respuesta
// SÍ traduce las claves de cada columna al inglés (clave→slug, orden→sortOrder, fijo→pinned…),
// a diferencia de ColumnaEfectiva dentro de Tablero.columns (que llega en español).
export function getColumnasEfectivas(tablero: string): Promise<ColumnaEfectiva[]> {
  return apiFetch<ColumnaEfectiva[]>(`/board/effective?boardSlug=${encodeURIComponent(tablero)}`);
}

export interface ComposicionItem {
  columnId: string;
  sortOrder?: number;
  visible?: boolean;
  pinned?: boolean;
  active?: boolean;
}

// POST /board/composition/bulk — board-level composition (needs tablero.config).
export function setComposicionBulk(tablero: string, columnas: ComposicionItem[]): Promise<unknown> {
  return apiFetch(`/board/composition/bulk`, {
    method: "POST",
    body: JSON.stringify({ boardSlug: tablero, columns: columnas }),
  });
}

// POST /board/customize — per-user override (any user).
export function personalizarColumna(payload: {
  boardSlug: string;
  columnId: string;
  visible?: boolean;
  sortOrder?: number;
  pinned?: boolean;
  render?: Record<string, unknown>; // override del usuario, ej. {color, background}
}): Promise<unknown> {
  return apiFetch(`/board/customize`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Generic board engine (registry-driven; any vertical) ────────────────────

// A registered vertical (GET /boards). `entity` = event entity for SSE
// filtering; `filters` = server-side scope (e.g. {soloAtencion:true} for AP).
// Botón enchufable de la barra del tablero (estilo hooks). Editable por PUT /boards/:id, sin código:
// el FE registra HANDLERS por clave y pinta el `slot` por `orden`, gate por `requierePermiso`. Ver
// docs/specs/be-tablero-acciones-toolbar-hooks-handoff.md.
// OJO: AccionTablero vive DENTRO de la clave opaca `acciones`/`actions` → sus claves NO se traducen
// (quedan en español). NO renombrar (motor de tableros).
export interface AccionTablero {
  clave: string;
  labelKey: string;
  icon?: string | null;
  slot?: string; // "toolbar" | "row" | …
  orden?: number;
  handler: string; // clave del handler que el FE sabe ejecutar (volver, abrir_calendario, filtrar_paciente…)
  params?: Record<string, unknown> | null; // p. ej. { modo: "paciente" | "dia", rangoDias: 90 }
  requierePermiso?: string | null; // RBAC cosmético
  visible?: boolean;
}

export interface TableroRegistro {
  id: string;
  slug: string;
  labelKey: string;
  icon: string | null;
  sortOrder: number;
  permissionSlug: string | null;
  layout: string; // "etapas" | "tabla" | ...
  path: string; // ruta del board del vertical, ej. "/tablero/atencion"
  entity: string; // "cita" | "sesion" | ...
  filters: Record<string, unknown> | null; // clave opaca `filtros`→`filters` (contenido intacto)
  actions?: AccionTablero[] | null; // clave opaca `acciones`→`actions`; contenido en español
  isVertical?: boolean; // true → aparece en /boards (menú); false → consultable (citas_cc)
  active: boolean;
}

// A declarative transition (definicion.transiciones). `formFields` (era `requiere`) = payload field
// claves the FE must collect. `fromStatuses` empty = available from any state.
export interface Transicion {
  id: string;
  slug: string;
  labelKey: string;
  fromStatuses: string[];
  toStatus: string | null;
  method: string;
  path: string | null;
  action: string | null;
  permissionSlug: string | null;
  formFields: string[];
  requiresConfirmation: boolean;
  sortOrder: number;
  active: boolean;
}

export interface SubTipo {
  id: string;
  slug: string;
  labelKey: string;
  sortOrder: number;
  active?: boolean;
}

export interface TableroDefinicion {
  boardSlug: string;
  columns: ColumnaEfectiva[]; // clave opaca `columnas`→`columns`; contenido en español
  statuses: EstadoCitaCatalogo[];
  transitions: Transicion[];
  subtypes: SubTipo[];
}

// GET /boards — the vertical registry.
export function getTableros(): Promise<TableroRegistro[]> {
  return apiFetch<TableroRegistro[]>(`/boards`);
}

// GET /board/modal/modules?postAction= — catálogo GLOBAL de módulos pluggables de
// un modal de post-acción (BE-3). El estado plugged/unplugged por-tablero sigue en
// composicion.render (render.<clave>=false = desconectado).
export interface ModalModulo {
  slug: string;
  labelKey: string;
  descriptionKey: string;
  postAction: string;
  requiresCatalog: boolean;
}
export function getModalModulos(postAccion: string): Promise<ModalModulo[]> {
  return apiFetch<ModalModulo[]>(`/board/modal/modules?postAction=${encodeURIComponent(postAccion)}`);
}

// GET /board/definition?boardSlug= — columns + states + transitions + subtypes.
// Tenant-scoped: la composición (incl. render override por-tablero) es POR CENTRO,
// así que pasar centroId para leer la definición efectiva de ese centro.
export function getDefinicion(tablero: string, centroId?: string): Promise<TableroDefinicion> {
  return apiFetch<TableroDefinicion>(`/board/definition?boardSlug=${encodeURIComponent(tablero)}`, {}, centroId);
}

// GET /board/rows?boardSlug=&date=(&subtype=) — projected rows for a day.
// For "servicios" the columns come from THIS response (per-service), so always
// render with the columns returned here.
export function getFilas(
  tablero: string,
  fecha: string,
  opts: { centroId?: string; subTipo?: string } = {},
): Promise<Tablero> {
  const sp = new URLSearchParams({ boardSlug: tablero, date: fecha });
  if (opts.subTipo) sp.set("subtype", opts.subTipo);
  return apiFetch<Tablero>(`/board/rows?${sp.toString()}`, {}, opts.centroId);
}

// POST /tablero/celda — edit an editable cell. BE validates the column is
// editable in that tablero, maps by binding (allowlist), applies it and records
// a `campo_editado` audit event (antes/después + actor) + SSE. tenant scopes it.
// Devuelve la fila (`data`) + el CERTIFICADO de persistencia (`meta.persistencia`), que el BE arma
// releyendo la base. El FE lo usa para el toast que certifica y, si ok:false, revertir la celda.
// Handoff HANDOFF-toast-que-certifica-la-persistencia.
export async function editarCelda(
  body: { boardSlug: string; entityId: string; column: string; value: unknown },
  centroId?: string,
): Promise<{ data: unknown; persistencia?: Persistencia }> {
  const env = await apiFetchEnvelope<unknown>(
    `/board/cell`,
    { method: "POST", body: JSON.stringify(body) },
    centroId,
  );
  return { data: env.data, persistencia: env.meta?.persistencia };
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
    `/board/options?boardSlug=${encodeURIComponent(tablero)}&column=${encodeURIComponent(columna)}`,
    undefined,
    centroId,
  );
}

// POST /board/composition — upsert de UNA columna en un tablero; `render` SE FUSIONA sobre
// columnas.render (p. ej. {group} para agrupar/desagrupar toggles sin tocar transition/estampa).
export function setComposicion(
  payload: {
    boardSlug: string;
    columnId: string;
    sortOrder?: number;
    visible?: boolean;
    active?: boolean;
    render?: Record<string, unknown>;
  },
  centroId?: string,
): Promise<unknown> {
  return apiFetch(`/board/composition`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// POST /board/composition — set one column's placement/color in a board (admin
// pre-personalization). `color` (null clears). Single-column upsert; does NOT
// touch the rest of the composition.
export function colorColumna(
  tablero: string,
  columnaId: string,
  color: string | null,
): Promise<unknown> {
  return apiFetch(`/board/composition`, {
    method: "POST",
    body: JSON.stringify({ boardSlug: tablero, columnId: columnaId, color }),
  });
}

// POST /tablero/composicion — set one column's per-tablero `render` override
// (merges over the catalog render; composición wins). Single-column upsert; does
// NOT touch orden/visible/color. Used to plug/unplug modal modules per board
// (e.g. { agendar_cita:false }). Send the FULL render object (BE replaces it).
export function setComposicionRender(
  tablero: string,
  columnaId: string,
  render: Record<string, unknown>,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/board/composition`,
    { method: "POST", body: JSON.stringify({ boardSlug: tablero, columnId: columnaId, render }) },
    centroId,
  );
}

// POST /board/action — execute a declarative transition. Fields go in payload
// (definicion.transiciones[].formFields says which). tenant scopes the request.
export function ejecutarAccion(
  body: { boardSlug: string; entityId: string; action: string; payload?: Record<string, unknown> },
  centroId?: string,
): Promise<unknown> {
  return apiFetch(`/board/action`, { method: "POST", body: JSON.stringify(body) }, centroId);
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
  `?boardSlug=${encodeURIComponent(tablero)}${all ? "&all=true" : ""}`;

// Tableros registry
export function crearTablero(body: CreateTableroInput): Promise<TableroRegistro> {
  return apiFetch(`/boards`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarTablero(id: string, body: UpdateTableroInput): Promise<TableroRegistro> {
  return apiFetch(`/boards/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarTablero(id: string): Promise<void> {
  return apiFetch(`/boards/${id}`, { method: "DELETE" });
}

// Columnas de catálogo (GET catálogo: getColumnasCatalogo)
export function crearColumna(body: CreateColumnaInput): Promise<ColumnaCatalogo> {
  return apiFetch(`/board/columns`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarColumna(id: string, body: UpdateColumnaInput): Promise<ColumnaCatalogo> {
  return apiFetch(`/board/columns/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

// Estados
export function getEstadosAdmin(tablero: string, all = true): Promise<EstadoCitaCatalogo[]> {
  return apiFetch(`/board/statuses${q(tablero, all)}`);
}
export function crearEstado(body: CreateEstadoInput): Promise<EstadoCitaCatalogo> {
  return apiFetch(`/board/statuses`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarEstado(id: string, body: UpdateEstadoInput): Promise<EstadoCitaCatalogo> {
  return apiFetch(`/board/statuses/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarEstado(id: string): Promise<void> {
  return apiFetch(`/board/statuses/${id}`, { method: "DELETE" });
}

// Transiciones
export function getTransicionesAdmin(tablero: string, all = true): Promise<Transicion[]> {
  return apiFetch(`/board/transitions${q(tablero, all)}`);
}
export function crearTransicion(body: CreateTransicionInput): Promise<Transicion> {
  return apiFetch(`/board/transitions`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarTransicion(id: string, body: UpdateTransicionInput): Promise<Transicion> {
  return apiFetch(`/board/transitions/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarTransicion(id: string): Promise<void> {
  return apiFetch(`/board/transitions/${id}`, { method: "DELETE" });
}

// SubTipos
export function getSubTiposAdmin(tablero: string, all = true): Promise<SubTipo[]> {
  return apiFetch(`/board/subtypes${q(tablero, all)}`);
}
export function crearSubTipo(body: CreateSubTipoInput): Promise<SubTipo> {
  return apiFetch(`/board/subtypes`, { method: "POST", body: JSON.stringify(body) });
}
export function actualizarSubTipo(id: string, body: UpdateSubTipoInput): Promise<SubTipo> {
  return apiFetch(`/board/subtypes/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function borrarSubTipo(id: string): Promise<void> {
  return apiFetch(`/board/subtypes/${id}`, { method: "DELETE" });
}
