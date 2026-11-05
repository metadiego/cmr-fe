// Billing lists across clinics (clinic-read-scope, owner 04-nov-2026): the invoice and refund lists show
// every clinic where the person holds `factura.read`, each row with its clinic. These are the few
// decisions those screens make about clinics, kept pure so they are tested. Run: `npm test`.

/**
 * The ONE clinic a new sale is created in: the filter's clinic when exactly one is ticked, else the
 * active clinic (top bar / session) when the person may bill there, else the only readable clinic.
 * `null` = undecided: the sale screen asks for one. `readable` empty = not known yet (trust `active`).
 * Unlike `createClinicOf` (lib/create-clinic.ts), it never falls back to "the first clinic": a sale moves
 * money, so when the clinic is not obvious the person picks it. On «Ambos» (`viewAll`) the top bar names no
 * clinic: with anything but one readable clinic it is undecided, so the link carries no `?centro=` and the
 * sale screen's gate asks (docs/specs/selector-de-centros-arriba.md).
 */
export function clinicForNewSale(
  choice: readonly string[] | null,
  readable: readonly string[],
  active: string | null | undefined,
  viewAll = false,
): string | null {
  if (choice && choice.length === 1) return choice[0];
  if (viewAll) return readable.length === 1 ? readable[0] : null;
  if (active && (readable.length === 0 || readable.includes(active))) return active;
  if (readable.length === 1) return readable[0];
  return null;
}

/** The distinct clinics of a list's rows, in order of first appearance (rows without one are skipped). */
export function rowClinicIds(rows: readonly { clinicId?: unknown }[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) if (typeof r.clinicId === "string" && r.clinicId) seen.add(r.clinicId);
  return [...seen];
}

/**
 * The clinics a range total covers: the ticked ones, else every readable clinic. The label says it:
 * one clinic by name, several by count. `null` while the readable clinics are not known.
 */
export type TotalScope = { kind: "one"; clinicId: string } | { kind: "many"; count: number };
export function rangeTotalScope(choice: readonly string[] | null, readable: readonly string[]): TotalScope | null {
  const covered = choice ?? readable;
  if (covered.length === 0) return null;
  return covered.length === 1 ? { kind: "one", clinicId: covered[0] } : { kind: "many", count: covered.length };
}

/** An option list's key: options of a board select column are per clinic (doctors/users differ). */
export function optionsKey(clinicId: string | null | undefined, column: string): string {
  return `${clinicId ?? ""}|${column}`;
}

/** An invoice's detail link, opened in the ROW's clinic. */
export function invoiceDetailHref(invoiceId: string, clinicId: string | null | undefined): string {
  return `/billing/invoices/${invoiceId}${clinicId ? `?centro=${encodeURIComponent(clinicId)}` : ""}`;
}

/** "New sale" link: in the decided clinic, or without one (the sale screen asks). */
export function newSaleHref(clinicId: string | null): string {
  return `/billing/invoices/new?nuevo=1${clinicId ? `&centro=${encodeURIComponent(clinicId)}` : ""}`;
}
