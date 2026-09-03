import type { components } from "./schema";
import { apiFetch } from "./client";

// Transferencias de inventario entre centros con recepción/aprobación PARCIAL.
// Contrato verificado contra prod 2026-07-13 (reversible: crear→detalle→recibir/rechazar).
// Estados: pendiente → recibida | recibida_parcial | rechazada | cancelada.
export type Transferencia = components["schemas"]["TransferenciaInventarioEntity"];
export type CrearTransferenciaPayload =
  components["schemas"]["CrearTransferenciaInvDto"];
export type RecibirTransferenciaPayload =
  components["schemas"]["RecibirTransferenciaInvDto"];
export type RechazarTransferenciaPayload =
  components["schemas"]["RechazarTransferenciaInvDto"];

// El item del detalle (GET :id) NO está bien tipado en OpenAPI (quirk) → tipado aquí
// verbatim de la respuesta real. OJO: `quantity` llega como string → convertir con Number().
// NOTA: `productoNombre` NO está en el mapa BE → llega en español.
export interface TransferenciaItem {
  id: string;
  transferId: string;
  productId: string;
  // Nombre resuelto por el BE en el detalle (deseable — evita depender del catálogo, que está paginado
  // y puede no traer el producto). Si no viene, el FE cae al catálogo y luego al id. Handoff
  // transferencia-boton-recibir (pieza BE).
  productoNombre?: string | null;
  lotId: string | null;
  quantity: number | string;
  receivedQuantity: number | string | null;
}
export interface TransferenciaDetalle {
  transfer: Transferencia;
  items: TransferenciaItem[];
}

// Centros DESTINO posibles para una transferencia: los OTROS centros activos (el propio NO aparece),
// cada uno con sus almacenes activos DENTRO (no hace falta otra llamada). Es el endpoint correcto para
// el desplegable de destino — NO `auth/me/centros` (ese es solo para el centro ACTIVO). Un destino sin
// almacén viene con `warehouses: []` (enseñar + avisar, no esconder). Perm inventario.transferir.
// Handoff transferencia-destinos.
export interface DestinoTransferencia {
  clinicId: string;
  name: string;
  warehouses: Array<{ id: string; name: string }>;
}
export function getDestinosTransferencia(): Promise<DestinoTransferencia[]> {
  return apiFetch<DestinoTransferencia[]>(`/inventory/transfers/destinations`);
}

// Pendientes del centro activo (como origen o destino).
export function listTransferenciasPendientes(): Promise<Transferencia[]> {
  return apiFetch<Transferencia[]>(`/inventory/transfers/pending`);
}

// HISTORIAL: todas las transferencias del centro (enviadas + recibidas), recientes primero (tope 200),
// con los dos nombres YA resueltos (no en la entity → aquí se extiende el tipo). Filtros opcionales por
// estado y dirección. Perm inventario.read. Handoff historial-transferencias.
// OJO: el param `address` es la DIRECCIÓN del historial (enviadas/recibidas); en el mapa BE global
// `direccion` → `address`, por eso la query usa `address` aunque semánticamente sea "direction".
export interface TransferenciaHistorial extends Transferencia {
  originName?: string | null;
  destinationName?: string | null;
}
export function listTransferencias(
  params: { status?: string; address?: "enviadas" | "recibidas" } = {},
): Promise<TransferenciaHistorial[]> {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.address) sp.set("address", params.address);
  const qs = sp.toString();
  return apiFetch<TransferenciaHistorial[]>(`/inventory/transfers${qs ? `?${qs}` : ""}`);
}
export function getTransferencia(id: string): Promise<TransferenciaDetalle> {
  return apiFetch<TransferenciaDetalle>(`/inventory/transfers/${id}`);
}
export function crearTransferencia(
  payload: CrearTransferenciaPayload,
): Promise<Transferencia> {
  return apiFetch<Transferencia>(`/inventory/transfers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
// Recibir/Aprobar — SOLO el centro DESTINO (el BE responde 403 si no). `items` omitido =
// recepción TOTAL; con items = parcial (0 ≤ recibida ≤ enviada). politicaRemanente default devolver_origen.
export function recibirTransferencia(
  id: string,
  payload: RecibirTransferenciaPayload,
): Promise<Transferencia> {
  return apiFetch<Transferencia>(`/inventory/transfers/${id}/receive`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function rechazarTransferencia(
  id: string,
  payload: RechazarTransferenciaPayload,
): Promise<Transferencia> {
  return apiFetch<Transferencia>(`/inventory/transfers/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
