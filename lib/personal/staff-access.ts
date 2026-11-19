// Access of a staff member to the system, for the merged Staff list (Staff and Users are one list:
// every login has a staff record, the BE creates one with each invite). The login's status is only
// known to an admin, who loads the profiles; everyone else sees "has a login" or "no login".

export const ACCESS_FILTERS = ["all", "withAccess", "noAccess", "suspended"] as const;
export type AccessFilter = (typeof ACCESS_FILTERS)[number];
export type Access = "none" | "active" | "pending" | "suspended" | "rejected";

export interface AccessProfile {
  status: string | null;
}

/** The access of one person: no login, or the status of their login (active when unknown). */
export function accessOf(
  person: { profileId?: string | null },
  profiles?: ReadonlyMap<string, AccessProfile>,
): Access {
  if (!person.profileId) return "none";
  const status = profiles?.get(person.profileId)?.status;
  if (status === "suspendido") return "suspended";
  if (status === "pendiente") return "pending";
  if (status === "rechazado") return "rejected";
  return "active";
}

function matches(access: Access, filter: AccessFilter): boolean {
  if (filter === "all") return true;
  if (filter === "noAccess") return access === "none";
  if (filter === "suspended") return access === "suspended";
  return access !== "none";
}

/** The people whose access matches the filter. */
export function filterByAccess<T extends { profileId?: string | null }>(
  people: T[],
  filter: AccessFilter,
  profiles?: ReadonlyMap<string, AccessProfile>,
): T[] {
  return people.filter((p) => matches(accessOf(p, profiles), filter));
}

/** How many people each filter shows, for the filter's counters. */
export function countByAccess(
  people: { profileId?: string | null }[],
  profiles?: ReadonlyMap<string, AccessProfile>,
): Record<AccessFilter, number> {
  const counts: Record<AccessFilter, number> = { all: 0, withAccess: 0, noAccess: 0, suspended: 0 };
  for (const p of people) {
    const access = accessOf(p, profiles);
    for (const f of ACCESS_FILTERS) if (matches(access, f)) counts[f]++;
  }
  return counts;
}
