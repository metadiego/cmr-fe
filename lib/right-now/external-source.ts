import type { RightNowExternalSource } from "@/lib/api/right-now";

// Whether a legacy-fed center's figures are stale, from the SCREEN's own clock: the BE's own
// `stale` assumes the pusher is still alive, but if it died no SSE event arrives and the screen
// never re-asks, so `stale` would stay false forever. `now` is the view's own ticking clock
// (refreshed every 30s), not `Date.now()` read here — same reason the "waiting minutes" do it.
export function externalSourceStale(ext: RightNowExternalSource, nowMs: number): boolean {
  if (ext.stale) return true;
  const receivedAtMs = new Date(ext.receivedAt).getTime();
  if (Number.isNaN(receivedAtMs)) return false;
  return nowMs - receivedAtMs > ext.staleAfterMinutes * 60_000;
}
