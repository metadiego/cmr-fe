// Pure helpers for the live-stock screen (/inventory/live-stock). The screen never subtracts live
// from book stock (see lib/api/scale-live-stock.ts); these only order, group and age the readings.

// A pad with no event for longer than this is shown dimmed (handoff: «más de 24 h sin evento»).
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isStale(measuredAt: string, now: number): boolean {
  const t = Date.parse(measuredAt);
  return Number.isFinite(t) && now - t > STALE_AFTER_MS;
}

// Most recent `measuredAt` of a set of readings, or null when there is none.
export function latestReading(rows: ReadonlyArray<{ measuredAt: string }>): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const r of rows) {
    const t = Date.parse(r.measuredAt);
    if (Number.isFinite(t) && t > bestT) {
      bestT = t;
      best = r.measuredAt;
    }
  }
  return best;
}

// Pads grouped by scale (deviceId, alphabetical), each group ordered by pad number.
export function groupPadsByDevice<P extends { deviceId: string; pad: number }>(
  pads: ReadonlyArray<P>,
): Array<{ deviceId: string; pads: P[] }> {
  const byDevice = new Map<string, P[]>();
  for (const p of pads) {
    const list = byDevice.get(p.deviceId) ?? [];
    list.push(p);
    byDevice.set(p.deviceId, list);
  }
  return [...byDevice.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([deviceId, list]) => ({ deviceId, pads: list.slice().sort((a, b) => a.pad - b.pad) }));
}

// Text filter over SKU / product name, case- and accent-insensitive.
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export function matchesQuery(p: { sku: string | null; productName: string | null }, q: string): boolean {
  const needle = fold(q.trim());
  if (!needle) return true;
  return fold(`${p.sku ?? ""} ${p.productName ?? ""}`).includes(needle);
}
