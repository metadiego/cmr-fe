// Check for a board transition's form (components/tablero/tablero-acciones.tsx): every field the
// transition lists in `formFields` is required. The keys come from the board's config.

/** The transition's form fields that are still blank, in the transition's order. */
export function boardActionMissing(formFields: readonly string[], values: Record<string, string>): string[] {
  return formFields.filter((f) => (values[f] ?? "").trim() === "");
}
