/**
 * Option lists of the column editor's pickers (appointment lifecycle, piece 6b, Task 11).
 *
 * The lists come from the board DEFINITION (`GET /board/definition`), which two backends serve while
 * release 6b rolls out (6a: old words only; 6b: old words plus stage groups). A column's stored config
 * still holds OLD words and door slugs on both: `render.transition` is a door slug, so an option's
 * `value` is exactly what gets stored.
 */

import type { CatalogueTransition } from "../lifecycle/board-catalogue.ts"

/** A picker option: `value` is what the column config stores. */
export interface PickerOption {
  value: string
  /** Message key of the text shown (a stage label), when the option is a stage. */
  labelKey: string | null
}

/** The door slugs a toggle column can call: the definition's transition slugs, once each, in order. */
export function doorSlugOptions(transitions: readonly CatalogueTransition[]): PickerOption[] {
  const seen = new Set<string>()
  const out: PickerOption[] = []
  for (const tr of transitions) {
    if (!tr.slug || seen.has(tr.slug)) continue
    seen.add(tr.slug)
    out.push({ value: tr.slug, labelKey: null })
  }
  return out
}
