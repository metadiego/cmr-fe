import type { components } from "./schema";
import type { Paginated } from "./types";
import { apiFetch, apiFetchPaged } from "./client";

// Facturación (BE PR #39+). Tenant-scoped: pasar centroId (X-Tenant-ID) en escrituras.
export type Factura = components["schemas"]["FacturaEntity"];
export type FacturaItem = components["schemas"]["FacturaItemEntity"];
export type Producto = components["schemas"]["ProductoEntity"];
export type FormaPago = components["schemas"]["FormaPagoEntity"];
export type AgregarItemPayload = components["schemas"]["AgregarItemDto"];
export type RegistrarPagoPayload = components["schemas"]["RegistrarPagoDto"];
export type DescuentoGlobalPayload = components["schemas"]["DescuentoGlobalDto"];

// Bloque fiscal por sucursal, proyectado en la factura (getById) y en
// GET /centros/:id/datos-fiscales. Configurable/multi-tenant; campos null = sin dato.
export type FacturaEmpresa = {
  nombreLegal: string | null;
  nombreComercial: string | null;
  registroFiscal: string | null;
  registroFiscalLabel: string | null;
  telefono: string | null;
  direccion: string | null;
  sucursal: string | null;
  pieFactura: string | null;
  web: string | null;
  logoUrl: string | null;
};

export type FacturaPago = {
  id?: string;
  formaPagoId?: string | null;
  formaPagoNombre?: string | null; // ya resuelto por el BE
  monto: number;
  referencia?: string | null;
  tipo?: string;
  fecha?: string | null;
};

// La factura con sus líneas + proyección enriquecida de GET /facturas/:id (BE):
// paciente, medico, empresa (bloque fiscal), pagos[], emisor, emitidaEn, numeroDisplay.
export type FacturaConItems = Factura & {
  items?: FacturaItem[];
  paciente?: {
    nombres?: string;
    apellidos?: string | null;
    record?: string | null;
    docId?: string | null;
  } | null;
  medico?: { id?: string; nombre?: string } | null;
  empresa?: FacturaEmpresa | null;
  pagos?: FacturaPago[];
  emisor?: { id?: string; nombre?: string } | null;
  emitidaEn?: string | null;
  numeroDisplay?: string | null;
};

// GET /facturas — listado paginado (findAll), filtrado server-side. Devuelve
// FacturaEntity cruda por fila (sin proyección de paciente); el detalle en
// /facturas/:id. `q` = nº de factura o record del paciente (verificado en prod).
export interface ListFacturasParams {
  page?: number;
  limit?: number;
  q?: string;
  estado?: string;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  pacienteId?: string;
}
export function listFacturas(
  params: ListFacturasParams = {},
  centroId?: string,
): Promise<Paginated<Factura>> {
  const { page = 1, limit = 20, q, estado, desde, hasta, pacienteId } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (estado) sp.set("estado", estado);
  if (desde) sp.set("desde", desde);
  if (hasta) sp.set("hasta", hasta);
  if (pacienteId) sp.set("pacienteId", pacienteId);
  return apiFetchPaged<Factura>(`/facturas?${sp.toString()}`, {}, centroId);
}

// Crear/obtener la factura BORRADOR de una cita (idempotente: si existe activa,
// devuelve la misma). Trae la línea de consulta del producto del tipo_cita.
export function facturarCita(citaId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/cita/${citaId}`, { method: "POST" }, centroId);
}

export function getFactura(id: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${id}`, {}, centroId);
}

// Catálogo facturable (productos/servicios) para agregar líneas.
// `contexto='consulta'` → el BE restringe a los productos de los tipos de cita activos (Consulta,
// Seguimiento): una factura de consulta médica no ofrece el catálogo físico completo.
export function getCatalogoFacturacion(
  centroId?: string,
  contexto?: string,
): Promise<Producto[]> {
  const qs = contexto ? `?contexto=${encodeURIComponent(contexto)}` : "";
  return apiFetch<Producto[]>(`/facturas/catalogo${qs}`, {}, centroId);
}

export function agregarItem(facturaId: string, payload: AgregarItemPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/items`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

export function actualizarItem(facturaId: string, itemId: string, payload: Partial<AgregarItemPayload>, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

export function eliminarItem(facturaId: string, itemId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/items/${itemId}`, { method: "DELETE" }, centroId);
}

export function setDescuentoGlobal(facturaId: string, payload: DescuentoGlobalPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/descuento-global`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Emitir (cierra el borrador). Sin body.
export function emitirFactura(facturaId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/emitir`, { method: "POST" }, centroId);
}

// Anular una factura emitida (RBAC factura.anular; motivo obligatorio). El BE sella
// actor/fecha. La ventana "mismo día" es configurable en el BE.
export function anularFactura(facturaId: string, motivo: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(
    `/facturas/${facturaId}/anular`,
    { method: "POST", body: JSON.stringify({ motivo }) },
    centroId,
  );
}

export function getFormasPago(centroId?: string): Promise<FormaPago[]> {
  return apiFetch<FormaPago[]>(`/facturacion/formas-pago`, {}, centroId);
}

export function registrarPago(facturaId: string, payload: RegistrarPagoPayload, centroId?: string): Promise<unknown> {
  return apiFetch(`/facturas/${facturaId}/pagos`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
