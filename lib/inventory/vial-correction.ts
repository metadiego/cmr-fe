// Correcting the content of ONE open vial (cmr-be #726, docs/specs/correccion-de-contenido-de-vial.md).
// The BE refuses (VIAL_CORRECTION_OUT_OF_RANGE) taking out more than the vial holds or putting back more
// than fits; the dialog says so before the click, from the same remnant and capacity the screen shows.

export type VialCorrectionSign = "devolver" | "retirar"

export type VialCorrectionCheck = {
  /** The typed amount as a number, or null while it is empty or not a positive number. */
  amount: number | null
  /** Filled with a positive number, but above what this vial allows for that sign. */
  outOfRange: boolean
  /** The most this vial accepts for that sign (never negative). */
  max: number
}

export function vialCorrectionCheck(input: {
  raw: string
  sign: VialCorrectionSign
  remnant: number
  capacity: number
}): VialCorrectionCheck {
  const left = Math.max(0, Number(input.remnant) || 0)
  const room = Math.max(0, (Number(input.capacity) || 0) - left)
  const max = input.sign === "retirar" ? left : room
  const text = input.raw.trim().replace(",", ".")
  const n = text === "" ? NaN : Number(text)
  const amount = Number.isFinite(n) && n > 0 ? n : null
  // A tolerance, so 0.1 + 0.2 typed against a 0.3 remnant is not "out of range".
  const outOfRange = amount != null && amount - max > 1e-9
  return { amount, outOfRange, max }
}
