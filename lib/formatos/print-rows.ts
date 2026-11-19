// Print-only row count for a numbered grid (transcraneal, PEMF, cámaras…). The BE bakes one row per
// session of the package ("1/24"), but the package it reads can be wrong for the patient (owner,
// 04-nov-2026: the patient has 6, the sheet printed 24). The desk may type how many therapies to print;
// nothing is saved — it only reshapes this sheet.
//
// Rows the BE sent are kept as they are (today's prefilled row included) up to `count`; extra rows are
// blank. Only the counter column (render.numerarFilas) is rewritten, as "i/count" when the format
// numbers as a fraction, or "i" otherwise.

export type PrintRow = Record<string, string | null | undefined>;

export function rowsForPrint(
  rows: PrintRow[],
  count: number | null | undefined,
  counterKey: string | null | undefined,
  asFraction: boolean,
): PrintRow[] {
  if (!count || count < 1 || !Number.isInteger(count)) return rows;
  return Array.from({ length: count }, (_, i) => {
    const row = { ...(rows[i] ?? {}) };
    if (counterKey) row[counterKey] = asFraction ? `${i + 1}/${count}` : String(i + 1);
    return row;
  });
}
