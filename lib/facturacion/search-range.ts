// The invoice list opens on TODAY, but a search is for one invoice whose date nobody remembers: «038158»
// found nothing because the screen sent today's range with it (S038158 is from 8-jul). With text in the
// search box the range is dropped and every date is searched; without it, the chosen range applies.
export function invoiceListRange(
  q: string,
  desde: string,
  hasta: string,
): { from?: string; to?: string; allDates: boolean } {
  if (q.trim()) return { allDates: true };
  return { from: desde || undefined, to: hasta || undefined, allDates: false };
}
