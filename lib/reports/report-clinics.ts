// Which clinics a report covers (handoff clinic-read-scope). A report reads every clinic where the person
// holds its permission, narrowed by the clinic filter; the BE answers with ONE figure that sums them (rows
// are not split by clinic), so the screen says which clinics a total covers instead of adding a column.
import { clinicFilterChoice } from "../clinic-read-scope.ts";

/**
 * What the report asks for. Until the person touches the filter, a `?centro=` link preselects that one
 * clinic (old links keep opening on it). `null` = every readable clinic. While the readable list is
 * unknown (empty), a link's clinic is still honoured so the report never widens behind the person's back.
 */
export function reportClinicChoice(
  readable: readonly string[],
  selected: readonly string[] | null,
  urlCenter: string | null | undefined,
  touched: boolean,
): string[] | null {
  const effective = touched ? selected : urlCenter ? [urlCenter] : null;
  if (readable.length === 0) return effective?.length ? [...effective] : null;
  return clinicFilterChoice(readable, effective);
}

/** The filter's ticks as shown: the link's clinic until the person touches the filter. */
export function reportFilterSelection(
  readable: readonly string[],
  selected: string[] | null,
  urlCenter: string | null | undefined,
  touched: boolean,
): string[] | null {
  if (touched) return selected;
  return urlCenter && readable.includes(urlCenter) ? [urlCenter] : null;
}

export type ClinicCoverage = { kind: "none" } | { kind: "one"; id: string } | { kind: "many"; count: number };

/** The clinics a total covers: the ticked ones, else every readable one. */
export function clinicCoverage(readable: readonly string[], choice: readonly string[] | null): ClinicCoverage {
  const covered = choice ?? readable;
  if (covered.length === 0) return { kind: "none" };
  if (covered.length === 1) return { kind: "one", id: covered[0] };
  return { kind: "many", count: covered.length };
}
