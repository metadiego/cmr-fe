// Generic column-visibility helpers shared by every report built on report-table-dialog.tsx (the day
// summary by service, cmr-be #632, and the one by doctor, cmr-be #637). One pair of pure functions,
// parametrized by a report's own column list, so a new report never re-derives this logic.

/** The saved choice, cleaned: only known columns, always in table order; nothing valid → the defaults. */
export function visibleColumns<C extends string>(all: readonly C[], defaults: readonly C[], saved: unknown): C[] {
  if (!Array.isArray(saved)) return [...defaults];
  const set = new Set(saved.filter((c): c is string => typeof c === "string"));
  const cols = all.filter((c) => set.has(c));
  return cols.length ? cols : [...defaults];
}

/** Toggle one column; the last visible one cannot be hidden (an empty table prints nothing). */
export function toggleColumn<C extends string>(all: readonly C[], current: readonly C[], col: C): C[] {
  const on = current.includes(col);
  if (on && current.length === 1) return [...current];
  const set = new Set(on ? current.filter((c) => c !== col) : [...current, col]);
  return all.filter((c) => set.has(c));
}
