// Pure form logic for "Corregir" on a legacy package (handoff
// correccion-paquetes-del-legado, cmr-be PR #740, 28-nov-2026). Kept separate from the dialog
// component so the arithmetic — what's missing, what's invalid, what the shortcut does, what the
// PATCH actually sends — is testable without mounting anything (rule 5).
export type LegacyPackageCorrectionForm = {
  totalSessions: string
  deliveredSessions: string
  motivo: string
}

export type LegacyPackageCorrectionField = "total" | "delivered" | "reason"

export function legacyPackageCorrectionMissing(f: LegacyPackageCorrectionForm): LegacyPackageCorrectionField[] {
  const missing: LegacyPackageCorrectionField[] = []
  if (f.totalSessions.trim() === "") missing.push("total")
  if (f.deliveredSessions.trim() === "") missing.push("delivered")
  if (f.motivo.trim() === "") missing.push("reason")
  return missing
}

export type LegacyPackageCorrectionInvalid = "notInteger" | "negative" | "deliveredOverTotal"

// Filled but not a valid correction. Never "missing" (rule 8): a reason, shown without disabling the
// fields themselves. Only checked once both numbers are present — `legacyPackageCorrectionMissing`
// already covers the empty case.
export function legacyPackageCorrectionInvalid(f: LegacyPackageCorrectionForm): LegacyPackageCorrectionInvalid | null {
  if (f.totalSessions.trim() === "" || f.deliveredSessions.trim() === "") return null
  const total = Number(f.totalSessions)
  const delivered = Number(f.deliveredSessions)
  if (!Number.isInteger(total) || !Number.isInteger(delivered)) return "notInteger"
  if (total < 0 || delivered < 0) return "negative"
  if (delivered > total) return "deliveredOverTotal"
  return null
}

// "Cerrar este paquete": total := delivered — a vitamina C package bought as one dose, corrected to
// say exactly what was given, nothing left pending.
export function closePackageForm(f: LegacyPackageCorrectionForm): LegacyPackageCorrectionForm {
  return { ...f, totalSessions: f.deliveredSessions }
}

export type LegacyPackageCorrectionPayload = {
  totalSessions?: number
  deliveredSessions?: number
  motivo: string
}

// The PATCH only names the field(s) that actually moved from the package's current numbers.
export function legacyPackageCorrectionPayload(
  f: LegacyPackageCorrectionForm,
  current: { totalSessions: number; deliveredSessions: number },
): LegacyPackageCorrectionPayload {
  const total = Number(f.totalSessions)
  const delivered = Number(f.deliveredSessions)
  const payload: LegacyPackageCorrectionPayload = { motivo: f.motivo.trim() }
  if (total !== current.totalSessions) payload.totalSessions = total
  if (delivered !== current.deliveredSessions) payload.deliveredSessions = delivered
  return payload
}
