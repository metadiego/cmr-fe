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
// verbatim de la respuesta real. OJO: `cantidad` llega como string → convertir con Number().
export interface TransferenciaItem {
  id: string;
  transferenciaId: string;
  productoId: string;
  loteId: string | null;
  cantidad: number | string;
  cantidadRecibida: number | string | null;
}
export interface TransferenciaDetalle {
  transferencia: Transferencia;
  items: TransferenciaItem[];
}

// Centros DESTINO posibles para una transferencia: los OTROS centros activos (el propio NO aparece),
// cada uno con sus almacenes activos DENTRO (no hace falta otra llamada). Es el endpoint correcto para
// el desplegable de destino — NO `auth/me/centros` (ese es solo para el centro ACTIVO). Un destino sin
// almacén viene con `almacenes: []` (enseñar + avisar, no esconder). Perm inventario.transferir.
// Handoff transferencia-destinos.
export interface DestinoTransferencia {
  clinicId: string;
  nombre: string;
  almacenes: Array<{ id: string; nombre: string }>;
}
export function getDestinosTransferencia(): Promise<DestinoTransferencia[]> {
  return apiFetch<DestinoTransferencia[]>(`/inventario/transferencias/destinos`);
}

// Pendientes del centro activo (como origen o destino).
export function listTransferenciasPendientes(): Promise<Transferencia[]> {
  return apiFetch<Transferencia[]>(`/inventario/transferencias/pendientes`);
}
export function getTransferencia(id: string): Promise<TransferenciaDetalle> {
  return apiFetch<TransferenciaDetalle>(`/inventario/transferencias/${id}`);
}
export function crearTransferencia(
  payload: CrearTransferenciaPayload,
): Promise<Transferencia> {
  return apiFetch<Transferencia>(`/inventario/transferencias`, {
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
  return apiFetch<Transferencia>(`/inventario/transferencias/${id}/recibir`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function rechazarTransferencia(
  id: string,
  payload: RechazarTransferenciaPayload,
): Promise<Transferencia> {
  return apiFetch<Transferencia>(`/inventario/transferencias/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
