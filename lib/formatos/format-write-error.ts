import { ApiError } from "../api/types.ts"

// One definition per format for every center (cmr-be #747): an edit changes every center's paper, so
// POST/PUT /formats need formats.config in EVERY active center. The BE answers 403 FORBIDDEN with
// faltan: ['formats.config'] and the generic labelKey auth.permiso_faltante, which does not say why.
export const FORMAT_NEEDS_EVERY_CENTER = "formatosAdmin.needsEveryCenter"

/** The same error, labelled so the editor says WHY it cannot save; anything else passes untouched. */
export function explainFormatWriteError(err: unknown): unknown {
  if (!(err instanceof ApiError) || err.status !== 403) return err
  const faltan = err.data?.faltan
  const missingFormatsConfig =
    Array.isArray(faltan) && faltan.includes("formats.config")
  // A 403 with its own specific label (not about formats.config) keeps it.
  if (!missingFormatsConfig && err.labelKey) return err
  return new ApiError(
    err.code,
    err.message,
    err.status,
    err.details,
    FORMAT_NEEDS_EVERY_CENTER,
    err.data
  )
}
