// «Cambiar usuario» of a payment or refund: what is missing and why it cannot be sent yet (rule 8).

export type StaffOption = { id: string; name?: string | null; lastName?: string | null; active?: boolean | null };

export const staffName = (s: Pick<StaffOption, "name" | "lastName">): string => [s.name, s.lastName].filter(Boolean).join(" ").trim();

/** Active staff only, by name; the current one stays listed so the picker shows who it is now. */
export function reassignOptions(staff: StaffOption[]): StaffOption[] {
  return staff.filter((s) => s.active !== false).sort((a, b) => staffName(a).localeCompare(staffName(b), "es"));
}

/** `filled`: someone is picked. `same`: it is already theirs (nothing to change — a reason, not missing). */
export function reassignCheck(picked: string, currentId: string | null | undefined): { filled: boolean; same: boolean } {
  return { filled: !!picked, same: !!picked && picked === currentId };
}
