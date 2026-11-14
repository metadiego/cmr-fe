// Responsibilities of a staff member (`staff.capabilities`): the tags that decide which lists a person
// appears in (doctors, nurses, technicians…) and, for "medico", the doctor tabs of their record.
// Every tag is also a job-title slug, so its label is the job title's (`personal.cargo.<slug>`).

/**
 * Old spellings of the same responsibility. "cc_operator" and "operadora" are the same job (the BE
 * already maps it so for the job title, `cmr-be/src/modules/personal/cargos.ts`); nothing reads either
 * tag by name, so the record shows and saves one.
 */
const SYNONYMS: Record<string, string> = { cc_operator: "operadora" };

/** The tags with old spellings replaced and duplicates removed, in their original order. */
export function normalizeResponsibilities(tags: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = SYNONYMS[raw.trim()] ?? raw.trim();
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** True when both lists hold the same tags once normalized, whatever the order. */
export function sameResponsibilities(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const x = normalizeResponsibilities(a);
  const y = normalizeResponsibilities(b);
  return x.length === y.length && x.every((tag) => y.includes(tag));
}

/** The chips to offer: every tag in use by anyone, normalized and sorted. */
export function responsibilityOptions(people: readonly { capabilities?: string[] | null }[]): string[] {
  return normalizeResponsibilities(people.flatMap((p) => p.capabilities ?? [])).sort();
}

/** Specialty only means something for a doctor; it stays visible when someone already filled it. */
export function showsSpecialty(jobTitle: string | null | undefined, tags: readonly string[], specialty: string | null | undefined): boolean {
  return jobTitle === "medico" || tags.includes("medico") || !!specialty?.trim();
}

/**
 * The Consulta preferences (land on Consulta, initial tab) are for front-desk staff; they stay visible
 * for anyone who already has one set, so a saved value is never hidden.
 */
export function showsConsultaPreferences(p: {
  jobTitle?: string | null;
  capabilities?: string[] | null;
  frontdeskStartsOnConsultation?: boolean | null;
  consultationBoardInitialTab?: string | null;
}): boolean {
  return (
    p.jobTitle === "recepcion" ||
    normalizeResponsibilities(p.capabilities).includes("recepcion") ||
    !!p.frontdeskStartsOnConsultation ||
    !!p.consultationBoardInitialTab
  );
}
