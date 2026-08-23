import type { components } from "./schema";
import { apiFetch } from "./client";

export interface Centro {
  id: string;
  nombre: string;
  codigo: string;
  direccion?: string | null;
  activo?: boolean;
  // Datos fiscales por centro (CentroEntity) — para el editor de empresa.
  // El GET /datos-fiscales expone `direccion` (combinada) pero para editar se usan
  // los campos crudos del centro: direccionFiscal + zip (asimetría del contrato BE).
  nombreLegal?: string | null;
  nombreComercial?: string | null;
  registroFiscal?: string | null;
  registroFiscalLabel?: string | null;
  telefono?: string | null;
  direccionFiscal?: string | null;
  zip?: string | null;
  web?: string | null;
  pieFactura?: string | null;
  logoUrl?: string | null;
  // Enganche facturación↔frontdesk: al saldar una factura del día, cada línea a_la_entrega
  // entra sola al frontdesk marcada "presente". Default true; se apaga por centro (PR #172).
  frontdeskAutopresente?: boolean | null;
}

// PUT /centros/:id/datos-fiscales — patch parcial (todos opcionales). La dirección
// se ENVÍA como `direccionFiscal` (el GET la lee como `direccion`). RBAC centro.fiscal.write.
export type DatosFiscalesPayload = components["schemas"]["UpdateDatosFiscalesDto"];

export function updateDatosFiscales(
  centroId: string,
  payload: DatosFiscalesPayload,
): Promise<unknown> {
  return apiFetch(
    `/centros/${centroId}/datos-fiscales`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}

export interface CreateCenterPayload {
  nombre: string;
  codigo: string;
  direccion?: string;
  activo?: boolean;
}

export async function getCenters(
  page?: number,
  limit?: number,
): Promise<Centro[]> {
  const p = new URLSearchParams();
  if (page) p.set("page", String(page));
  if (limit) p.set("limit", String(limit));
  const s = p.toString();
  const res: unknown = await apiFetch(`/centros${s ? `?${s}` : ""}`);
  if (Array.isArray(res)) return res as Centro[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Centro[]) : [];
}

export function createCenter(payload: CreateCenterPayload): Promise<Centro> {
  return apiFetch<Centro>(`/centros`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// The principal's own centers WITH name (master → all). Use this for the center
// selector instead of cross-referencing allowedClinicIds against getCenters().
export async function getMyCentros(): Promise<Centro[]> {
  const res: unknown = await apiFetch(`/auth/me/centros`);
  if (Array.isArray(res)) return res as Centro[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Centro[]) : [];
}

// Centros donde la persona TRABAJA DE VERDAD (tiene un rol) → para el selector del NAV, que cambia el
// contexto de facturar/cobrar/agendar. NO usar getMyCentros aquí: esa trae TODOS los centros asignados,
// incluidos accesos puntuales (p.ej. mirar el calendario ajeno) → mudarse allí no deja hacer nada. Uno
// solo → no enseñar el selector del nav. Handoff selector-de-centro-en-la-pantalla §«El selector del NAV».
export async function getMyCentrosOperativos(): Promise<Centro[]> {
  const res: unknown = await apiFetch(`/auth/me/centros/operativos`);
  if (Array.isArray(res)) return res as Centro[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Centro[]) : [];
}

// Patrón ÚNICO del selector EN la pantalla (no en el nav) para CUALQUIER dominio: «en qué centros tengo
// este permiso», con nombre. Dos llamadas por pantalla: una con el permiso de LECTURA (llenar el selector)
// y otra con el de ESCRITURA (decidir si ofrecer las acciones). NO hay endpoint por dominio. Un permiso
// inexistente responde 400 (no lista vacía) → un error de escritura no se confunde con «no puedes en
// ningún sitio». Handoff selector-de-centro-en-la-pantalla. Ver [[useCentroPantalla]].
export async function getCentrosDondePuedo(permiso: string): Promise<Centro[]> {
  const res: unknown = await apiFetch(`/me/centros-donde-puedo?permiso=${encodeURIComponent(permiso)}`);
  if (Array.isArray(res)) return res as Centro[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Centro[]) : [];
}
