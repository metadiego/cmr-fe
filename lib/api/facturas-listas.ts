import type { Paginated } from "./types";
import type { CenterChoice } from "@/lib/clinic-read-scope";
import type { Devolucion, ListFacturasParams } from "./facturas";
import { apiFetch, apiFetchPaged, apiFetchEnvelope, oneCenterPath, tenantOf } from "./client";

// The billing LIST reads, moved out of facturas.ts (size ceiling). They read every clinic where the
// person holds `factura.read` (cmr-be clinic-read-scope): `choice` null = all of them, a list = the
// clinic filter's ticked ones, a string = one picked clinic (it also forces X-Tenant-ID). Each row
// carries its own `clinicId`/`clinicName`: actions on a row use the ROW's clinic.

// Metadata-driven invoice list (GET /invoices/board): columns RESOLVED by the BE
// (fac_numero/fac_fecha/fac_paciente/fac_medico/fac_estado/fac_total/fac_medio/fac_acciones) + rows with
// those values already resolved (patient name, etc.), unlike GET /invoices (raw entity).
// `columns`/`rows` are OPAQUE bags: the BE translates the KEYS (columnas→columns/filas→rows) but not
// their CONTENT, so a column's internal keys (clave/rol/tipo) stay in Spanish on purpose (board engine).
export interface FacturaTableroColumna {
  clave: string;
  labelKey: string;
  rol?: string | null;
  // Inline-editable columns (fac_medico/fac_usuario): the BE declares them select with writeBinding
  // (factura.medicoId / factura.usuarioId) and optionsSource; the row brings `<clave>__valor` = the raw id.
  // Written through PUT /invoices/:id/header.
  tipo?: string;
  editable?: boolean;
  render?: { writeBinding?: string; optionsSource?: string; [k: string]: unknown } | null;
}
export type FacturaTableroFila = { id: string; clinicId?: string | null; clinicName?: string | null } & Record<string, unknown>;
export interface FacturaTablero {
  columns: FacturaTableroColumna[];
  rows: FacturaTableroFila[];
}
export async function getFacturasTablero(
  params: ListFacturasParams = {},
  choice?: CenterChoice,
): Promise<FacturaTablero> {
  const { page = 1, limit = 20, q, status, from, to, context } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  if (context) sp.set("context", context);
  return apiFetch<FacturaTablero>(await oneCenterPath(`/invoices/board?${sp.toString()}`, choice), {}, tenantOf(choice));
}

// Summary of the filtered RANGE (server total, not the page's): importe/exentas/cobradas from the
// `meta.resumen` of GET /invoices + the total count from `meta.pagination`. Same filters as the list, and
// it sums the SAME clinics as the rows. `meta` is an OPAQUE bag: its keys stay in Spanish.
export interface FacturasResumen {
  importe: number;
  exentas: number;
  cobradas: number;
  total: number; // invoices in the range (meta.pagination.total)
}
export async function getFacturasResumen(
  params: ListFacturasParams = {},
  choice?: CenterChoice,
): Promise<FacturasResumen> {
  const { q, status, from, to, context } = params;
  // limit=1: only the meta (summary + total) matters.
  const sp = new URLSearchParams({ page: "1", limit: "1" });
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  if (context) sp.set("context", context);
  const env = await apiFetchEnvelope<unknown>(await oneCenterPath(`/invoices?${sp.toString()}`, choice), {}, tenantOf(choice));
  const r = env.meta.resumen;
  return {
    importe: Number(r?.importe ?? 0),
    exentas: Number(r?.exentas ?? 0),
    cobradas: Number(r?.cobradas ?? 0),
    total: Number(env.meta.pagination?.total ?? 0),
  };
}

// GLOBAL refund list, paged + filters. Each row = DevolucionEntity (invoiceNumber included) with its
// clinic (`clinicId`, `clinicName`).
export interface ListDevolucionesParams {
  page?: number;
  limit?: number;
  q?: string; // invoice number
  status?: string; // activa|anulada
  from?: string;
  to?: string;
  context?: "general" | "consulta"; // by the refund's invoice type
}
export async function listDevoluciones(
  params: ListDevolucionesParams = {},
  choice?: CenterChoice,
): Promise<Paginated<Devolucion>> {
  const { page = 1, limit = 20, q, status, from, to, context } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  if (context) sp.set("context", context);
  return apiFetchPaged<Devolucion>(await oneCenterPath(`/billing/refunds?${sp.toString()}`, choice), {}, tenantOf(choice));
}
