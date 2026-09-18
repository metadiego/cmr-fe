// Which center the day view opens on.
//
// It used to be "all centers" for everyone (`useState(ALL)`), but the combined
// scope is admin/master only — the backend answers 409 to a non-admin request
// with no `X-Tenant-ID`, and every realtime stream is now scoped to the active
// center. So the rest of the staff landed on a value they could not use: a blank
// picker, a failed snapshot and a stream retrying for ever.
//
// Precedence mirrors hooks/use-centro-gate.ts: an explicit choice, then the
// session's active center, then the only center they have. Returns `null` when
// nothing can be resolved yet — the caller waits instead of guessing.
// See docs/specs/be-sse-acotado-al-centro-handoff.md.

export const ALL_CENTERS = "__all__";

export function initialAgendaCenter(opts: {
  /** Admin/master: the only principals the backend lets read several centers at once. */
  canSeeAllCenters: boolean;
  /** The center remembered for this device, if any. */
  saved: string | null;
  /** The session-wide active center (the `X-Tenant-ID` cookie / the profile's). */
  activeCenter: string | null;
  /** The centers this profile is assigned to. */
  centers: string[];
}): string | null {
  const { canSeeAllCenters, saved, activeCenter, centers } = opts;
  const assigned = (id: string | null): string | null =>
    id && centers.includes(id) ? id : null;

  if (canSeeAllCenters) {
    return saved === ALL_CENTERS ? ALL_CENTERS : (assigned(saved) ?? ALL_CENTERS);
  }
  // `ALL_CENTERS` is never a valid answer here, and `assigned` already rejects it.
  return assigned(saved) ?? assigned(activeCenter) ?? (centers.length === 1 ? centers[0] : null);
}
