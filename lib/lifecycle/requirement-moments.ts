/**
 * The MOMENT a service's required field is asked at (services.form_acciones `campos[].en`): the flow step
 * it belongs to. Stored under the step's old name (`presente` / `en_terapia` / `asistido`) — what this app
 * writes, and all the 6a backend accepts. From 6b on the backend also accepts the new names (`check_in` /
 * `start_therapy` / `finish`), so a value written elsewhere (MCP, API) may hold one: read both.
 */

const NEW_TO_OLD: Readonly<Record<string, string>> = {
  check_in: "presente",
  start_therapy: "en_terapia",
  finish: "asistido",
}

/** The moments the app offers and writes (old names, in flow order). */
export const REQUIREMENT_MOMENTS: readonly string[] = ["presente", "en_terapia", "asistido"]

/** A stored moment, under either name, as the step it is asked at (the old name). */
export function momentStep(en: string | null | undefined): string | null {
  if (!en) return null
  return NEW_TO_OLD[en] ?? en
}
