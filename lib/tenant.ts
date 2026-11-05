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

// The top bar's «Ambos» (docs/specs/selector-de-centros-arriba.md): reads span every clinic the person
// can read; the active center above stays the X-Tenant-ID and where writes go. Unset = that one clinic.
export const CLINIC_VIEW_COOKIE = "cmr_clinic_view";

export function isClinicViewAll(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").includes(`${CLINIC_VIEW_COOKIE}=all`);
}

export function setClinicViewAll(all: boolean): void {
  if (typeof document === "undefined") return;
  const maxAge = all ? 60 * 60 * 24 * 365 : 0;
  document.cookie = `${CLINIC_VIEW_COOKIE}=all; path=/; max-age=${maxAge}; samesite=lax`;
}
