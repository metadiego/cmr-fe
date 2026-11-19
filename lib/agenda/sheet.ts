// The call-center sheet behind the grids and the booking (BE #521, handoff
// docs/specs/reservar-en-la-hoja-handoff.md). With reservation ON for the center, the BE books a seat on
// the sheet before saving; with it off `sheet` arrives null and nothing changes. Pure helpers.

/** `data.sheet` of the grids: when the BE read the sheet, and whether it answered. */
export type SheetCheck = { checkedAt?: string | null; ok: boolean } | null | undefined;

/** The sheet did not answer: the availability shown may be stale (a warning band, never a block). */
export function sheetDown(sheet: SheetCheck): boolean {
  return !!sheet && sheet.ok === false;
}

/** A "Nueva cita" slot topped by the sheet (`cappedBy: 'hoja'`), not by our own slots. */
export function cappedBySheet(slot: { cappedBy?: string | null }): boolean {
  return slot.cappedBy === "hoja";
}

/** The 409 of a booking at an hour the sheet no longer has a seat for: refresh the grid after it. */
export function isSheetSlotTaken(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === "SHEET_SLOT_TAKEN";
}

/**
 * The days a series skipped because the sheet was full (`data.sinAsiento`, a key the v2 glossary
 * leaves as is; each item `{ serviceId, date }` — `fecha` in v1). Unique and sorted.
 */
export function noSeatDays(data: unknown): string[] {
  const list = (data as { sinAsiento?: unknown } | null)?.sinAsiento;
  if (!Array.isArray(list)) return [];
  const days = list
    .map((x) => (x as { date?: unknown; fecha?: unknown }).date ?? (x as { fecha?: unknown }).fecha)
    .filter((d): d is string => typeof d === "string" && d.length >= 10)
    .map((d) => d.slice(0, 10));
  return [...new Set(days)].sort();
}
