import type { QueueInTherapyEntry } from "@/lib/api/frontdesk-queue";

// "Overdue" = the BE's own estimated end (resource config or 30-day history median, PR #422) has
// already passed. An entry with no estimate at all is NEVER counted as overdue — that would be a
// guess the FE invented, not something the BE actually computed (CLAUDE.md rule 10: honest data).
export function isOverdueInTherapy(
  entry: Pick<QueueInTherapyEntry, "estimatedEnd">,
  nowIso: string,
): boolean {
  return entry.estimatedEnd != null && entry.estimatedEnd < nowIso;
}

export function countOverdueInTherapy(
  entries: readonly Pick<QueueInTherapyEntry, "estimatedEnd">[],
  nowIso: string,
): number {
  return entries.filter((e) => isOverdueInTherapy(e, nowIso)).length;
}
