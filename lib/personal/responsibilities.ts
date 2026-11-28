// Responsibilities of a staff member (`staff.capabilities`): the legacy tags some pickers still read
// until the BE's PR 4 retires them. The staff record itself now reads Functions (lib/personal/functions.ts).
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

/** Specialty only means something for a doctor (the `doctor` function); it stays visible when filled. */
export function showsSpecialty(isDoctor: boolean, specialty: string | null | undefined): boolean {
  return isDoctor || !!specialty?.trim();
}

/**
 * The Consulta preferences (land on Consulta, initial tab) are for front-desk staff (the `front_desk`
 * function); they stay visible for anyone who already has one set, so a saved value is never hidden.
 */
export function showsConsultaPreferences(
  isFrontDesk: boolean,
  p: { frontdeskStartsOnConsultation?: boolean | null; consultationBoardInitialTab?: string | null },
): boolean {
  return isFrontDesk || !!p.frontdeskStartsOnConsultation || !!p.consultationBoardInitialTab;
}
