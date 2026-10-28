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

export type LiveCell = { units: number; doubtful: boolean; measuredAt: string | null };

// Index of the scale counts by product + warehouse, for the «Live» column of Existencias. It is shown
// NEXT TO book stock and never added to it (owner, 28-oct-2026: «que NO sume, solo que diga live»).
export function liveIndex(
  warehouses: ReadonlyArray<{
    warehouseId: string;
    products: ReadonlyArray<{ productId: string; liveUnits: number; doubtful: boolean; byPad: ReadonlyArray<{ measuredAt: string }> }>;
  }>,
): Map<string, LiveCell> {
  const idx = new Map<string, LiveCell>();
  for (const w of warehouses) {
    for (const p of w.products) {
      idx.set(`${p.productId}|${w.warehouseId}`, { units: p.liveUnits, doubtful: p.doubtful, measuredAt: latestReading(p.byPad) });
    }
  }
  return idx;
}

// The live cell for a stock row. Stock rows are per lot, so the same product + warehouse can repeat:
// only the FIRST of them gets the live count (repeating it would read as if it added up). A row with no
// warehouse (stock spread over several) matches the product in any warehouse, combined, once.
export function liveForRows<R extends { productId: string; warehouseId?: string | null }>(
  rows: ReadonlyArray<R>,
  idx: ReadonlyMap<string, LiveCell>,
): Array<LiveCell | null> {
  const seen = new Set<string>();
  return rows.map((r) => {
    const key = `${r.productId}|${r.warehouseId ?? "*"}`;
    if (seen.has(key)) return null;
    seen.add(key);
    if (r.warehouseId) return idx.get(key) ?? null;
    const cells = [...idx.entries()].filter(([k]) => k.startsWith(`${r.productId}|`)).map(([, c]) => c);
    if (cells.length === 0) return null;
    return {
      units: cells.reduce((s, c) => s + c.units, 0),
      doubtful: cells.some((c) => c.doubtful),
      measuredAt: latestReading(cells.filter((c) => c.measuredAt).map((c) => ({ measuredAt: c.measuredAt as string }))),
    };
  });
}
