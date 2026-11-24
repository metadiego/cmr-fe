// Protocol change (POST /facturas/paquetes/cambio-protocolo, GET /invoices/packages/protocol-change):
// split from lib/api/frontdesk.ts, which it was never part of (it is a package endpoint).
import { apiFetch } from "./client";

// CAMBIO DE PROTOCOLO: el médico deja sin efecto sesiones pendientes y las reemplaza por otras. Contrato
// verificado por HTTP: POST /facturas/paquetes/cambio-protocolo/:pacienteId con paqueteOrigenIds (ids de
// pendientes-entrega), nuevos (productoId + sesionesTotales≥1, opc. cantidad/areas/dosis), motivo (obl.),
// medicoId opc., reintegros opc. (unidades selladas que vuelven al almacén de un producto de entrega
// directa). Todo-o-nada; devuelve avisos (diferencia de valor, reintegros ignorados…). Handoff
// cambio-de-protocolo. Las cantidades nuevas son juicio del médico: el BE AVISA, no bloquea.
export interface CambioProtocaloNuevo {
  productId: string;
  totalSessions: number;
  quantity?: number;
  areas?: number; // NO en el mapa — dejado en español
  dose?: number;
  /** Agreed price per unit of what is created (cmr-be #691); omitted → the BE uses the list price. */
  precioUnitario?: number; // the DTO's own name: v2 leaves it as it is
}
export interface CambioProtocoloPayload {
  paqueteOrigenIds: string[]; // NO en el mapa (plural) — dejado en español
  newOnes: CambioProtocaloNuevo[];
  reason: string;
  doctorId?: string;
  // `reintegros` y `unidadesSelladas` NO en el mapa — dejados en español (productoId sí → productId).
  reintegros?: { productId: string; unidadesSelladas: number }[];
  /** Agreed price per unit of what closes (cmr-be #691); a package not among the origins → 400. */
  preciosOrigen?: { paqueteId: string; precioUnitario: number }[]; // the DTO's own names
}

/** One package that closes, in a simulation or in an applied change's valuation. */
export interface ProtocolChangeClose {
  packageId: string;
  productId: string;
  sku?: string | null;
  name: string | null;
  pendingSessions: number;
  /** Therapies pending: sessions × units per session (HILT 7 × 6 = 42). */
  units: number;
  /** What was charged per unit, as a reference; null without an invoice line. */
  chargedUnitPrice: number | null;
  unitPrice: number | null;
  value: number | null;
  valueSource: "manual" | "invoice" | "list" | null;
}
/** One package that is created. */
export interface ProtocolChangeCreate {
  productId: string;
  sku?: string | null;
  name: string | null;
  sessions?: number;
  units: number;
  unitPrice: number | null;
  listUnitPrice: number | null;
  value: number | null;
  valueSource: "manual" | "list" | null;
}
export interface ProtocolChangeTotals {
  closedValue: number;
  createdValue: number;
  difference: number;
}
/** What was agreed, stored with an applied change (null on changes before 24-nov-2026). */
export interface ProtocolChangeValuation {
  closes: ProtocolChangeClose[];
  creates: ProtocolChangeCreate[];
  totals: ProtocolChangeTotals;
}
export interface ProtocolChangeSimulation extends ProtocolChangeValuation {
  continuesAfter?: { productId: string; packageId: string; pendingSessions: number }[];
  pendingClosed?: number;
  warnings?: { code?: string; labelKey?: string; message?: string; params?: Record<string, unknown> }[];
}

/** POST …/simulate — the same body as apply (reason optional); writes nothing. */
export function simularCambioProtocolo(
  pacienteId: string,
  payload: Omit<CambioProtocoloPayload, "reason"> & { reason?: string },
  centroId?: string,
): Promise<ProtocolChangeSimulation> {
  const qs = centroId ? `?centerIds=${encodeURIComponent(centroId)}` : "";
  return apiFetch<ProtocolChangeSimulation>(
    `/invoices/packages/protocol-change/${encodeURIComponent(pacienteId)}/simulate${qs}`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

export interface CambioProtocoloResult {
  changeId?: string;
  creados?: unknown[]; // NO en el mapa — dejado en español
  cerrados?: unknown[]; // NO en el mapa — dejado en español
  avisos?: { code?: string; labelKey?: string; message?: string }[]; // `avisos` NO en el mapa
  valuation?: ProtocolChangeValuation | null;
}
export function aplicarCambioProtocolo(
  pacienteId: string,
  payload: CambioProtocoloPayload,
  centroId?: string,
): Promise<CambioProtocoloResult> {
  return apiFetch<CambioProtocoloResult>(
    `/facturas/paquetes/cambio-protocolo/${encodeURIComponent(pacienteId)}`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// HISTORIAL de cambios de protocolo del paciente, del más reciente al más viejo, agrupado por cambio (un día,
// un motivo, un médico; `medicoId` puede ser null). GET /invoices/packages/protocol-change/:patientId (inglesa,
// viva 1-oct). Handoff cambio-de-protocolo-a-la-ficha.
export interface CambioProtocoloHistorial {
  changeId: string;
  date: string;
  reason: string | null; doctorId: string | null;
  closedPackages: string[]; createdPackages: string[];
  /** The agreed valuation (cmr-be #691); null on changes before 24-nov-2026. */
  valuation?: ProtocolChangeValuation | null;
}
export function getCambiosProtocolo(pacienteId: string, centroId?: string): Promise<CambioProtocoloHistorial[]> {
  return apiFetch<CambioProtocoloHistorial[]>(`/invoices/packages/protocol-change/${encodeURIComponent(pacienteId)}`, {}, centroId)
    .then((r) => (Array.isArray(r) ? r : []));
}
