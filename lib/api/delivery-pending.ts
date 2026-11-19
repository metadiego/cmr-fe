import { apiFetch, oneCenterPath, tenantOf } from "./client";
import type { PendienteEntrega } from "./frontdesk";

// A patient's pending packages in several clinics (GET /facturas/pendientes-entrega?centerIds; factura.read
// in each), each with its clinic — to know where a protocol change can be made. The one-clinic read the
// front desk uses is `getPendientesEntrega` (lib/api/frontdesk.ts).
export type PendienteEntregaEnCentro = PendienteEntrega & { clinicId?: string | null; clinicName?: string | null };

export async function getPendientesEntregaDe(
  pacienteId: string,
  clinicIds: readonly string[],
): Promise<PendienteEntregaEnCentro[]> {
  const path = await oneCenterPath(`/facturas/pendientes-entrega?patientId=${encodeURIComponent(pacienteId)}`, clinicIds);
  const r = await apiFetch<unknown>(path, {}, tenantOf(clinicIds));
  return Array.isArray(r) ? (r as PendienteEntregaEnCentro[]) : [];
}
