// A staff member's full name as the staff screens show it: name and last name, else the name alone.
export function staffFullName(p: { name: string; lastName?: string | null }): string {
  return [p.name, p.lastName].filter(Boolean).join(" ").trim() || p.name;
}
