import { ApiError } from "./types.ts"
import type { EhrReadinessField } from "./ehr-integration.ts"

// Único punto que reconoce el 400 PACIENTE_DATOS_REQUERIDOS y saca sus `faltantes` — antes cada
// pantalla repetía `err instanceof ApiError && err.code === "..."` a mano, y 4 de ellas (celda de
// hora, selector de estado, modal de Control de Citas, fila del frontdesk) se quedaron sin
// copiarlo, mostrando solo un toast genérico en vez del modal que pide los datos (quejas de
// Christian y Yadira, handoff quejas-de-mostrador-2026-10-20). Devuelve `null` cuando el error no es
// este candado, o cuando lo es pero sin campos (nada que pedir).
//
// Vive en su PROPIO archivo (no en ehr-integration.ts) a propósito: ese archivo importa
// `apiFetch`/`lib/env`, que revienta al importarlo fuera de Next (p. ej. en un test con
// `node --experimental-strip-types`) si faltan las env vars de Supabase — esta función pura no debe
// arrastrar eso solo por vivir al lado.
export function datosFaltantesDe(err: unknown): EhrReadinessField[] | null {
  if (!(err instanceof ApiError) || err.code !== "PACIENTE_DATOS_REQUERIDOS") return null
  const faltantes = (err.data?.faltantes as EhrReadinessField[] | undefined) ?? []
  return faltantes.length ? faltantes : null
}
