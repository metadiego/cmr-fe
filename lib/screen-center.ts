// The two center pickers (handoff selector-de-centro-en-la-pantalla): the TOP BAR's answers "which
// center do I work in?" (it moves the whole session, and only people with `centros.cambiar` see it);
// a SCREEN's own picker answers "which center am I looking at?" (only that screen, for anyone with the
// screen's permission in more than one center). For staff who cannot switch the session, the screen
// picker is the only way to look at another center, so it stays. For someone who CAN, the screen picker
// offering the same centers just repeats the top bar — so it hides, and the screen follows the top bar.

/**
 * True when the screen's picker adds nothing to the top bar's: the top bar is shown (more than one
 * operative center), it reaches every center the screen can show, and it currently sits on one of them
 * (otherwise the screen would silently show a center other than the top bar's).
 */
export function isScreenPickerRedundant(
  screenCenterIds: readonly string[],
  operativeCenterIds: readonly string[],
  topBarCenterId: string | null,
): boolean {
  if (operativeCenterIds.length <= 1) return false;
  if (!topBarCenterId || !screenCenterIds.includes(topBarCenterId)) return false;
  return screenCenterIds.every((id) => operativeCenterIds.includes(id));
}

/** The center a screen starts on: the top bar's, else the session's, else the first it can show. */
export function defaultScreenCenter(
  screenCenterIds: readonly string[],
  topBarCenterId: string | null,
  sessionCenterId: string | null,
): string {
  if (topBarCenterId && screenCenterIds.includes(topBarCenterId)) return topBarCenterId;
  if (sessionCenterId && screenCenterIds.includes(sessionCenterId)) return sessionCenterId;
  return screenCenterIds[0] ?? "";
}
