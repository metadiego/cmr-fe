// The HILT laser sheet, drawn like the legacy «HILT Form» (.personal/formatos-legacy/HILT Form.pdf): the
// regions over two sheets. The first sheet also carries the comments, the hand-filled fields and the pain
// scale, so it has room for fewer rows.

/** Data rows the first sheet holds next to the comments, fields and pain scale (legacy: 22). */
export const HILT_FIRST_PAGE_ROWS = 22;

/**
 * Splits the regions into the two sheets, first-fit and in order: a region goes on the first sheet if
 * its rows still fit, else on the second. That is the legacy's own split — Rachis, Shoulder, Knee
 * (7+7+7) and then Oedema (1) on the first; Elbow… Foot on the second — without naming any region.
 */
export function hiltPages<T extends { filas: readonly unknown[] }>(
  sections: readonly T[],
  firstPageRows = HILT_FIRST_PAGE_ROWS,
): { first: T[]; second: T[] } {
  const first: T[] = [];
  const second: T[] = [];
  let used = 0;
  for (const s of sections) {
    if (used + s.filas.length <= firstPageRows) {
      first.push(s);
      used += s.filas.length;
    } else {
      second.push(s);
    }
  }
  return { first, second };
}
