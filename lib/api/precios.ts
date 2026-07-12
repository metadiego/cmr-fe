import type { components } from "./schema";
import type { Paginated } from "./types";
import { apiFetch, apiFetchPaged } from "./client";

// Precios (§3 del hand-off). Catálogo = una fila por presentación con su precio
// efectivo y la FUENTE (oferta|precio|base|ninguno). Editar = PUT si ya existe fila
// de precio regular, POST si no. Todo verificado contra prod 2026-07-12.

export type PrecioEntity = components["schemas"]["PrecioEntity"];
export type CreatePrecioPayload = components["schemas"]["CreatePrecioDto"];
export type UpdatePrecioPayload = components["schemas"]["UpdatePrecioDto"];

// Fila del catálogo (respuesta no nombrada en OpenAPI → tipada aquí verbatim).
export type PrecioFuente = "oferta" | "precio" | "base" | "ninguno";
export interface PrecioCatalogoRow {
  productoId: string;
  sku: string | null;
  nombre: string;
  presentacionId: string;
  presentacionNombre: string;
  precio: number | null;
  fuente: PrecioFuente;
  tipoPrecioId: string | null;
  monedaId: string | null;
  impuestoId: string | null;
}

// Tipo de precio (regular/oferta/…). El regular es `clave:"regular"`.
export interface TipoPrecio {
  id: string;
  clave: string;
  nombre?: string;
}

// `tipoPrecioId` = lista concreta (regular/mayorista/…); sin él = precio efectivo.
// `clinicId` = centro para el que resolver (admin); sin él = scope del header.
export function listCatalogoPrecios(opts: {
  q?: string;
  page?: number;
  limit?: number;
  asOf?: string;
  tipoPrecioId?: string;
  clinicId?: string;
}): Promise<Paginated<PrecioCatalogoRow>> {
  const sp = new URLSearchParams();
  if (opts.q?.trim()) sp.set("q", opts.q.trim());
  if (opts.asOf) sp.set("asOf", opts.asOf);
  if (opts.tipoPrecioId) sp.set("tipoPrecioId", opts.tipoPrecioId);
  if (opts.clinicId) sp.set("clinicId", opts.clinicId);
  sp.set("page", String(opts.page ?? 1));
  sp.set("limit", String(opts.limit ?? 50));
  return apiFetchPaged<PrecioCatalogoRow>(`/precios/catalogo?${sp.toString()}`);
}

export function listTiposPrecio(): Promise<TipoPrecio[]> {
  return apiFetch<TipoPrecio[]>(`/precios/tipos`);
}

export type CreateTipoPrecioPayload = components["schemas"]["CreateTipoPrecioDto"];
export function createTipoPrecio(payload: CreateTipoPrecioPayload): Promise<TipoPrecio> {
  return apiFetch<TipoPrecio>(`/precios/tipos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Derivar una lista a partir de otra (ajuste lineal %/$). Verificado prod 2026-07-12.
// dryRun=true → PREVIEW (no escribe): devuelve { cambios, total, aplicados }.
// Scope: ámbito "global" exige scope GLOBAL → pasar tenant=null (omite X-Tenant-ID);
// "centro" → pasar el clinicId como tenant. El BE rechaza derivar de otro centro.
export type DerivarPayload = components["schemas"]["DerivarPreciosDto"];
export interface DerivarCambio {
  productoId: string;
  sku: string | null;
  presentacionId: string;
  precioAntes: number | null;
  precioDespues: number | null;
  fuente: string;
}
export interface DerivarResult {
  cambios: DerivarCambio[];
  total: number;
  aplicados: number;
}
export function derivarPrecios(
  payload: DerivarPayload,
  tenant?: string | null,
): Promise<DerivarResult> {
  return apiFetch<DerivarResult>(
    `/precios/derivar`,
    { method: "POST", body: JSON.stringify(payload) },
    tenant,
  );
}

// Filas de precio de una presentación (para hallar el precioId regular a editar).
export function listPreciosByPresentacion(
  presentacionId: string,
): Promise<PrecioEntity[]> {
  return apiFetch<PrecioEntity[]>(
    `/precios?presentacionId=${encodeURIComponent(presentacionId)}`,
  );
}

export function createPrecio(payload: CreatePrecioPayload): Promise<PrecioEntity> {
  return apiFetch<PrecioEntity>(`/precios`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePrecio(
  id: string,
  payload: UpdatePrecioPayload,
): Promise<PrecioEntity> {
  return apiFetch<PrecioEntity>(`/precios/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
