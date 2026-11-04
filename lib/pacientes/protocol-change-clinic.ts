// The clinic a protocol change is made in. The BE reads the patient's pending packages and writes the
// change in ONE clinic (the X-Tenant-ID one), so the screen always names one: the person's pick, else a
// ?centro= link's, else the top bar's (active/session), else the first where they hold the permission.

/**
 * `allowed`: clinics where the person holds tratamiento.cambio_protocolo (empty while unknown). While
 * unknown, the link's or the top bar's clinic is used as is (the BE still checks the permission).
 */
export function protocolChangeClinic(
  allowed: readonly string[],
  picked: string | null,
  urlCenter: string | null | undefined,
  topBarCenter: string | null,
): string | null {
  if (allowed.length === 0) return picked ?? urlCenter ?? topBarCenter ?? null;
  for (const id of [picked, urlCenter, topBarCenter]) if (id && allowed.includes(id)) return id;
  return allowed[0];
}
