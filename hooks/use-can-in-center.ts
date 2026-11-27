"use client";

import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { heldInCenter } from "@/lib/lifecycle/confirm-on-create";
import { getActiveCentro } from "@/lib/tenant";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";

// One request per permission per minute, shared by every caller: some callers render once per board row
// (NextAppointmentCell), and a request per row would burst the backend's per-person rate limit.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<Centro[] | null> }>();
/** The centers where the person holds `permission` (cached a minute, shared); null on failure. */
export function centersWhere(permission: string): Promise<Centro[] | null> {
  const hit = cache.get(permission);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = getCentrosDondePuedo(permission).catch(() => {
    cache.delete(permission); // a failure is not remembered
    return null;
  });
  cache.set(permission, { at: Date.now(), promise });
  return promise;
}

/**
 * Whether the person holds `permission` in a center (`/me/centros-donde-puedo`): the given one, else the
 * top bar's, else the session's. null while not known (loading, failed, no center).
 */
export function useCanInCenter(permission: string, centerId?: string | null): boolean | null {
  const me = useMe();
  const target = centerId || getActiveCentro() || (me.kind === "ok" ? me.me.activeClinicId : null);
  const res = useResource<Centro[] | null>(() => centersWhere(permission), [permission]);
  return heldInCenter(res.state.kind === "ok" ? res.state.data : null, target);
}
