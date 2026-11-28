import { apiFetch } from "./client"

// Corrección de paquetes del legado desde patient-desk (handoff
// correccion-paquetes-del-legado, cmr-be PR #740, 28-nov-2026): la carga del legado a veces entra
// con las sesiones entregadas mal contadas (una dosis de vitamina C de más o de menos, un paquete que
// se cargó de menos). Antes solo el dueño podía arreglarlo a mano en la base; esto es la ventana
// TEMPORAL (unos 30 días) para que Recepción/Enfermería/Gerente lo corrijan ellos mismos, solo para
// terapias pendientes del legado — nunca facturación nueva. Contrato verificado contra producción,
// 28-nov-2026.
export type LegacyPackagesWindow = {
  centerId: string
  until: string | null
  open: boolean
  today: string
}

export function getLegacyPackagesWindow(centerId: string): Promise<LegacyPackagesWindow> {
  return apiFetch<LegacyPackagesWindow>(
    `/invoices/packages/legacy/window?centerId=${encodeURIComponent(centerId)}`,
    {},
    centerId,
  )
}

// `until: null` cierra la ventana de inmediato. Permiso frontdesk.legacy_packages.configure.
export function putLegacyPackagesWindow(centerId: string, until: string | null): Promise<LegacyPackagesWindow> {
  return apiFetch<LegacyPackagesWindow>(
    `/invoices/packages/legacy/window?centerId=${encodeURIComponent(centerId)}`,
    { method: "PUT", body: JSON.stringify({ until }) },
    centerId,
  )
}

// `correctable`: true cuando el paquete tiene algo pendiente por corregir — incluye uno YA consumido
// cuyo total se cargó de menos (cmr-be, cambio del 28-nov posterior al PR #750), no solo los que
// tienen sesiones pendientes.
export type LegacyPackage = {
  id: string
  clinicId: string
  productId: string
  productName: string
  sku: string | null
  totalSessions: number
  deliveredSessions: number
  refundedSessions: number
  transferredSessions: number
  remaining: number
  status: string
  legacyReference: string | null
  correctable: boolean
}

export function getLegacyPackages(patientId: string, centerId?: string): Promise<LegacyPackage[]> {
  return apiFetch<LegacyPackage[]>(`/invoices/packages/legacy?patientId=${encodeURIComponent(patientId)}`, {}, centerId)
}

export type CorrectLegacyPackagePayload = {
  totalSessions?: number
  deliveredSessions?: number
  motivo: string
}

// PATCH /invoices/packages/legacy/:id — corrige total y/o entregadas en una sola llamada, en
// cualquier orden. Errores por labelKey: legacyPackages.correctionClosed/notLegacy/nothingPending/
// outOfRange/reasonRequired (lib/api/errors.ts ya los muestra por su labelKey).
export function correctLegacyPackage(
  id: string,
  payload: CorrectLegacyPackagePayload,
  centerId?: string,
): Promise<LegacyPackage> {
  return apiFetch<LegacyPackage>(
    `/invoices/packages/legacy/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    centerId,
  )
}
