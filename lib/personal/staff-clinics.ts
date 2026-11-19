// The clinics a staff row stands for on a list over clinics (cmr-be clinic-read-scope): the clinics of the
// read's scope where the person serves (`servesInCenters`), else the home clinic (`clinicName`).
export function clinicNamesOf(p: {
  clinicName?: string | null;
  servesInCenters?: { clinicId: string; clinicName: string | null }[];
}): string[] {
  const serves = (p.servesInCenters ?? []).map((c) => c.clinicName).filter((n): n is string => !!n);
  return serves.length > 0 ? serves : p.clinicName ? [p.clinicName] : [];
}
