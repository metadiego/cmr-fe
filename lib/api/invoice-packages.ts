import { apiFetch } from "./client";

// Exceptional package availability (cmr-be #693, handoff .personal/handoff-asistir-exige-sesiones.md):
// sessions granted with no purchase behind them, for a patient-desk row that cannot attend for lack of
// balance. Not yet in the generated schema (openapi-typescript hasn't been re-run against this BE PR),
// so the payload/response are hand-typed here rather than derived from `components["schemas"]`.
export type PackageExceptionPayload = {
  pacienteId: string;
  productoId: string;
  sesiones: number;
  motivo: string;
  centerId?: string;
};
export type PackageException = {
  id: string;
  patientId: string;
  productId: string;
  sessions: number;
  meta?: { exceptional?: boolean; [key: string]: unknown };
  [key: string]: unknown;
};

export function crearDisponibilidadExcepcional(
  payload: PackageExceptionPayload,
  centroId?: string,
): Promise<PackageException> {
  return apiFetch<PackageException>(
    `/invoices/packages/exception`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
