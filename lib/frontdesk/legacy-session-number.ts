// Parses the format dialog's "Sesión n/m" field for POST /frontdesk/sessions/:id/legacy-number
// (BE #625): a legacy patient with no invoice/package yet has staff type their session number
// straight off the printed sheet, and the BE catches the patient's availability up to it. Anything
// that isn't two whole numbers with 1 ≤ n ≤ m is not a session worth pushing — the dialog just
// prints as typed, same as before this feature existed.
export function parseLegacySessionNumber(value: string | null | undefined): { number: number; total: number } | null {
  const m = /^(\d+)\/(\d+)$/.exec((value ?? "").trim());
  if (!m) return null;
  const number = Number(m[1]);
  const total = Number(m[2]);
  if (number < 1 || total < 1 || number > total) return null;
  return { number, total };
}
