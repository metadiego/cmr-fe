import { apiFetch } from "./client"

// Corrección de paquetes del legado — SOLO la ventana de configuración (handoff
// correccion-paquetes-del-legado, cmr-be PR #740, 28-nov-2026). El corrector del lado de
// patient-desk se retiró el mismo día (el dueño: "obstruye el trabajo del personal") — ver
// [[capacidad-no-es-alerta-de-problema]]. Esto queda porque /configuration/legacy-packages sigue
// fijando/cerrando la ventana por centro, aunque hoy nadie la use desde patient-desk.
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
