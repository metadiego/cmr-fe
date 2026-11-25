// Visits left open on a day already closed (sessions stuck «En terapia», consultations never closed),
// grouped by the logged-in person who left them so (owner, 06-nov / 17-nov-2026). Each group keeps its
// visits so a click on the name lists them and opens each one on its own day (owner, 24-nov-2026: «que
// filtre esas visitas para ver si las podemos asistir»).

export type OverdueVisit = {
  key: string;
  kind: "services" | "consultation";
  date: string;
  patientId: string;
  patientName: string | null;
  /** Services only: the desk's service filter for that day. */
  serviceId?: string;
};

export type OverdueGroup = { actorId: string; name: string; visits: OverdueVisit[] };

/**
 * One group per actor, most visits first; inside, oldest day first (the longest-forgotten is the first to fix).
 * A visit with no known actor is left out — the banner names people, and there is nobody to name.
 */
export function groupOverdue(
  entries: readonly { actorId: string | null; actorName?: string | null; visit: OverdueVisit }[],
  nameOf: (id: string) => string,
): OverdueGroup[] {
  const byActor = new Map<string, OverdueGroup>();
  for (const e of entries) {
    if (!e.actorId) continue;
    const g = byActor.get(e.actorId) ?? { actorId: e.actorId, name: e.actorName || nameOf(e.actorId), visits: [] };
    g.visits.push(e.visit);
    byActor.set(e.actorId, g);
  }
  const groups = [...byActor.values()];
  for (const g of groups) g.visits.sort((a, b) => a.date.localeCompare(b.date) || (a.patientName ?? "").localeCompare(b.patientName ?? ""));
  return groups.sort((a, b) => b.visits.length - a.visits.length);
}
