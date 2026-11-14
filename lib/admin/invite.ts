// Pure helpers for the "Invite user" dialog (components/admin/invite-dialog.tsx).

/** Value of the "Center" select that means every center. */
export const ALL_CENTERS = "__all__";

/** Lowercase, without accents and with single spaces: "  José  Pérez" → "jose perez". */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface StaffCandidate {
  id: string;
  name: string;
  lastName?: string | null;
}

/**
 * The staff record (without a login) that the typed name most likely belongs to, or null.
 * Matches the full name, or the first name plus the first word of the last name ("Ana Ruiz" for
 * "Ana Ruiz Soto"). Only a single match is suggested: two people with the same name are left to
 * the admin to choose.
 */
export function suggestStaff<T extends StaffCandidate>(
  people: T[],
  name: string,
  lastName: string,
): T | null {
  const first = normalizeName(name);
  const last = normalizeName(lastName);
  if (!first || !last) return null;
  const typed = `${first} ${last}`;
  const matches = people.filter((p) => {
    const pFirst = normalizeName(p.name ?? "");
    const pLast = normalizeName(p.lastName ?? "");
    if (!pFirst || !pLast) return false;
    if (`${pFirst} ${pLast}` === typed) return true;
    return pFirst === first && pLast.split(" ")[0] === last.split(" ")[0];
  });
  return matches.length === 1 ? matches[0] : null;
}

export interface InvitePlan {
  /** Center sent with the invite itself (undefined = none). */
  inviteCenterId?: string;
  /** Role sent with the invite itself (undefined = assigned afterwards, or none). */
  inviteRole?: string;
  /** Centers granted after the invite, one assignment each. */
  extraCenterIds: string[];
  /** Role granted after the invite with no center, so it applies in every center. */
  globalRole?: string;
}

/**
 * How the dialog's choices turn into calls. The invite takes one center, and a role sent with it
 * is scoped to that center; for "all centers" the invite carries the first center, the others are
 * assigned right after, and the role is granted once without a center (it applies in all of them).
 * `homeCenterId` (the linked staff record's center) goes first: cmr-be rejects linking a staff
 * record to an invite for another center.
 */
export function planInvite(
  centerChoice: string,
  centerIds: string[],
  roleSlug: string,
  homeCenterId?: string | null,
): InvitePlan {
  const role = roleSlug || undefined;
  if (centerChoice !== ALL_CENTERS) {
    return { inviteCenterId: centerChoice || undefined, inviteRole: role, extraCenterIds: [] };
  }
  const ordered = homeCenterId && centerIds.includes(homeCenterId)
    ? [homeCenterId, ...centerIds.filter((id) => id !== homeCenterId)]
    : centerIds;
  const [firstCenter, ...others] = ordered;
  return { inviteCenterId: firstCenter, extraCenterIds: others, globalRole: role };
}
