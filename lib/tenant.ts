// lib/tenant.ts
// The active center (tenant) the operativo user is working in. Persisted in a
// cookie so lib/api/client.ts can attach it as X-Tenant-ID on every request.
// The BE requires it for operativo profiles with N centers (auto-locks for 1).

export const ACTIVE_CENTRO_COOKIE = "cmr_active_centro";

export function getActiveCentro(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${ACTIVE_CENTRO_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export function setActiveCentro(centroId: string): void {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${ACTIVE_CENTRO_COOKIE}=${encodeURIComponent(
    centroId,
  )}; path=/; max-age=${oneYear}; samesite=lax`;
}
