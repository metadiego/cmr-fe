// Clinics of an inventory transfer once the lists span every clinic the person can read (cmr-be
// clinic-read-scope): a transfer is listed when EITHER end is in scope, and receiving runs in its
// DESTINATION clinic with `inventario.recibir` checked there — never in "the screen's clinic".

/**
 * A transfer end's clinic name: the one the BE resolved (`originName`/`destinationName`), else the
 * first lookup that knows the id, else null (show a dash, never a uuid).
 */
export function transferClinicName(
  resolved: string | null | undefined,
  id: string | null | undefined,
  ...lookups: ReadonlyArray<(id: string) => string | null | undefined>
): string | null {
  if (resolved) return resolved;
  if (!id) return null;
  for (const lookup of lookups) {
    const name = lookup(id);
    if (name) return name;
  }
  return null;
}

/**
 * Whether the person can receive (approve/reject) this transfer: it is pending and its destination is
 * one of the clinics where they hold `inventario.recibir` (`receivable`).
 */
export function canReceiveTransfer(
  transfer: { status: string; destinationClinicId: string },
  receivable: readonly string[],
): boolean {
  return transfer.status === "pendiente" && receivable.includes(transfer.destinationClinicId);
}
