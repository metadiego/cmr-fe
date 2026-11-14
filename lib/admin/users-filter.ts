// Search and status filter of the users table (components/admin/users-list.tsx).

export const USER_STATUSES = ["aprobado", "pendiente", "suspendido", "rechazado"] as const;
export type UserStatusFilter = "all" | (typeof USER_STATUSES)[number];

export interface FilterableUser {
  email: string | null;
  name?: string | null;
  lastName?: string | null;
  status: string | null;
  roles?: { name: string }[];
  centers?: { name?: string | null }[];
}

/** Users whose email, name, role or center contains `query` and whose status matches. */
export function filterUsers<T extends FilterableUser>(
  users: T[],
  query: string,
  status: UserStatusFilter,
): T[] {
  const term = query.trim().toLowerCase();
  return users.filter((u) => {
    if (status !== "all" && u.status !== status) return false;
    if (!term) return true;
    return [
      u.email ?? "",
      u.name ?? "",
      u.lastName ?? "",
      ...(u.roles?.map((r) => r.name) ?? []),
      ...(u.centers?.map((c) => c.name ?? "") ?? []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

/** How many users have each status, for the filter's counters. */
export function countByStatus(users: FilterableUser[]): Record<UserStatusFilter, number> {
  const counts: Record<UserStatusFilter, number> = {
    all: users.length,
    aprobado: 0,
    pendiente: 0,
    suspendido: 0,
    rechazado: 0,
  };
  for (const u of users) {
    if (u.status && u.status in counts && u.status !== "all") counts[u.status as UserStatusFilter]++;
  }
  return counts;
}

/** Initials for the avatar: first letters of name and last name, else of the email. */
export function userInitials(u: Pick<FilterableUser, "email" | "name" | "lastName">): string {
  const fromName = `${u.name?.trim()[0] ?? ""}${u.lastName?.trim()[0] ?? ""}`;
  return (fromName || (u.email ?? "?").slice(0, 2)).toUpperCase();
}
