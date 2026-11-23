// The booking screen's check of a service type the chosen patient can no longer book (a deep link,
// another patient picked): once their bookable balance is in, a service with no sessions left is
// cleared so the type list shows. Pure, no app imports. Spec 2026-11-23-appointments-booking-upgrades §4.

/** What the check is about: one patient, one service, one booking center. null = nothing to check. */
export function bookableCheckKey(p: {
  patientId: string | undefined;
  kind: "medical" | "service" | undefined;
  typeId: string | undefined;
  center: string | undefined;
}): string | null {
  return p.patientId && p.kind === "service" && p.typeId ? `${p.patientId}|${p.typeId}|${p.center ?? ""}` : null;
}

/**
 * - "wait": not decidable yet (balance not ok, or an appointment is being moved: the moved session is
 *   already booked, so it is not bookable, and the move must not lose its type). Check again later.
 * - "done": nothing to check (no patient, a medical type) or this key was already checked. Checked once
 *   per key on purpose: booking the last session reloads the balance, and that must not pull the
 *   calendar away.
 * - "keep" / "clear": decided now; the caller records the key as checked.
 */
export function unbookableTypeCheck(p: {
  patientId: string | undefined;
  kind: "medical" | "service" | undefined;
  typeId: string | undefined;
  center: string | undefined;
  checkedKey: string | null;
  moving: boolean;
  bookableState: "idle" | "loading" | "ok" | "fail";
  bookable: ReadonlyMap<string, { bookable: number }> | undefined;
}): "wait" | "done" | "keep" | "clear" {
  const key = bookableCheckKey(p);
  if (!key || key === p.checkedKey) return "done";
  if (p.moving || p.bookableState !== "ok" || !p.bookable) return "wait";
  return (p.bookable.get(p.typeId ?? "")?.bookable ?? 0) > 0 ? "keep" : "clear";
}
