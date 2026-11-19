// Pure helpers of the «Ahora mismo» screen (kept out of the components so they are tested).
import type { RightNowDoctor, RightNowPatients, RightNowSales, RightNowService } from "../api/right-now.ts";

// The N best sellers by total (the BE already sends them, but the order is the screen's promise).
export function topSellers(sales: RightNowSales | undefined, n = 3) {
  return [...(sales?.sellers ?? [])].sort((a, b) => b.total - a.total).slice(0, n);
}

// Attended vs pending consultations, as the bar's two widths (0..100). No patients → both 0.
export function attendedSplit(p: RightNowPatients | undefined) {
  const attended = p?.attended ?? 0;
  const pending = p?.pending ?? 0;
  const total = attended + pending;
  if (total === 0) return { attended, pending, attendedPct: 0, pendingPct: 0 };
  const attendedPct = Math.round((attended / total) * 100);
  return { attended, pending, attendedPct, pendingPct: 100 - attendedPct };
}

// 0..1 from the BE → whole percent for the screen.
export const ratePct = (r: number | undefined) => Math.round((r ?? 0) * 100);

// Services with nothing that day never come from the BE; still, a service with no movement at all
// (0 waiting, in care and completed) is noise on a live board.
export function liveServices(services: RightNowService[] | undefined) {
  return (services ?? []).filter((s) => s.total > 0 || s.waiting + s.inCare + s.completed > 0);
}

// Minutes since an ISO instant (waiting time), floored; null when unknown.
export function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 60000));
}

// The doctors' ranking (owner, 12-nov): by AMOUNT billed by default, or by patients attended; the
// «sin médico» closing row (labelKey) always stays last, it is not a doctor. Ties: the other measure,
// then the name.
export type DoctorOrder = "amount" | "attended";
export function sortDoctors(list: readonly RightNowDoctor[], by: DoctorOrder): RightNowDoctor[] {
  const doctors = list.filter((d) => !d.labelKey);
  const closing = list.filter((d) => !!d.labelKey);
  const key = (d: RightNowDoctor) => (by === "amount" ? [d.net, d.attended] : [d.attended, d.net]);
  doctors.sort((a, b) => {
    const [a1, a2] = key(a);
    const [b1, b2] = key(b);
    return b1 - a1 || b2 - a2 || String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
  return [...doctors, ...closing];
}
