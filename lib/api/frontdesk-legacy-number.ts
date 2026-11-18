import { apiFetch } from "./client";

// A legacy patient (no invoice/package of the new system yet) has their session number typed off
// the printed Láser format (n/m) pushed here so their availability catches up with it. Always 200:
// `applied:false` with a `reason` (patient_has_invoices, session_has_package, service_not_enabled,
// no_product, patient_has_package, invalid_number) means the BE decided not to touch anything —
// never an error. The format dialog calls this itself and never lets it block printing. BE #625.
export interface LegacySessionNumberResult {
  applied: boolean;
  reason?: string | null;
  packageId?: string | null;
}

export function setLegacySessionNumber(
  sessionId: string,
  payload: { number: number; total: number; reportId?: string },
  centroId?: string,
): Promise<LegacySessionNumberResult> {
  return apiFetch<LegacySessionNumberResult>(
    `/frontdesk/sessions/${sessionId}/legacy-number`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
