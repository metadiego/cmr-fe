import type { components } from "./schema";
import { apiFetch } from "./client";

// Facturación (BE PR #39+). Tenant-scoped: pasar centroId (X-Tenant-ID) en escrituras.
export type Factura = components["schemas"]["FacturaEntity"];
export type FacturaItem = components["schemas"]["FacturaItemEntity"];
export type Producto = components["schemas"]["ProductoEntity"];
export type FormaPago = components["schemas"]["FormaPagoEntity"];
export type AgregarItemPayload = components["schemas"]["AgregarItemDto"];
export type RegistrarPagoPayload = components["schemas"]["RegistrarPagoDto"];
export type DescuentoGlobalPayload = components["schemas"]["DescuentoGlobalDto"];

// La factura con sus líneas (lo que devuelven POST /facturas/cita y GET /facturas/:id).
export type FacturaConItems = Factura & {
  items?: FacturaItem[];
  paciente?: { nombres?: string; apellidos?: string | null } | null;
  medico?: { nombre?: string } | null;
};

// Crear/obtener la factura BORRADOR de una cita (idempotente: si existe activa,
// devuelve la misma). Trae la línea de consulta del producto del tipo_cita.
export function facturarCita(citaId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/cita/${citaId}`, { method: "POST" }, centroId);
}

export function getFactura(id: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${id}`, {}, centroId);
}

// Catálogo facturable (productos/servicios) para agregar líneas.
export function getCatalogoFacturacion(centroId?: string): Promise<Producto[]> {
  return apiFetch<Producto[]>(`/facturas/catalogo`, {}, centroId);
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

export function getFormasPago(centroId?: string): Promise<FormaPago[]> {
  return apiFetch<FormaPago[]>(`/facturacion/formas-pago`, {}, centroId);
}

export function registrarPago(facturaId: string, payload: RegistrarPagoPayload, centroId?: string): Promise<unknown> {
  return apiFetch(`/facturas/${facturaId}/pagos`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
