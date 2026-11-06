// Which clinics a report covers (handoff clinic-read-scope). A report reads every clinic where the person
// holds its permission, narrowed by the top bar (Bayamón / Caguas / Ambos); the BE answers with ONE figure that sums them (rows
// are not split by clinic), so the screen says which clinics a total covers instead of adding a column.
export type ClinicCoverage = { kind: "none" } | { kind: "one"; id: string } | { kind: "many"; count: number };

/** The clinics a total covers: the ticked ones, else every readable one. */
export function clinicCoverage(readable: readonly string[], choice: readonly string[] | null): ClinicCoverage {
  const covered = choice ?? readable;
  if (covered.length === 0) return { kind: "none" };
  if (covered.length === 1) return { kind: "one", id: covered[0] };
  return { kind: "many", count: covered.length };
}
