import { holdsPermission } from "./permission-aliases.ts";

// A 403 in the audit log is the backend correctly refusing a call the frontend never needed to
// make. The fix for that noise is not making the call, not catching the error afterward
// (handoff-ruido-403-auditoria.md: three endpoints the FE called from roles that can never hold
// their permission, ~1,360 403s/day). `fetcher` only runs when `permissions` already holds
// `permiso`; otherwise this resolves to `fallback` without touching the network.
export function callIfPermitted<T>(
  permissions: readonly string[],
  permiso: string,
  fetcher: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!holdsPermission(permissions, permiso)) return Promise.resolve(fallback);
  return fetcher();
}
