// The kardex tabs as CSV rows, in the same columns and words as the screen. Pure: the screen passes its
// translator and the reason labeller; tested in kardex-csv.test.ts.
import type { KardexDaily, KardexSummary } from "../api/inventory-kardex.ts";

type T = (key: string, values?: Record<string, string | number>) => string;
type Row = (string | number)[];

export function dailyCsv(daily: KardexDaily | null, t: T): Row[] {
  if (!daily) return [];
  const p = daily.product.capacity != null;
  return [
    [t("col.date"), t("col.opening"), t("col.inbound"), t("col.applied"), ...(p ? [t("col.proportion")] : []), t("col.adjustments"), t("col.closing")],
    ...daily.days.map((d) => [d.date, d.opening, d.inbound, d.applied, ...(p ? [d.appliedProportion ?? ""] : []), d.adjustments, d.closing]),
  ];
}

export function movementsCsv(s: KardexSummary | null, t: T, reason: (r: string | null) => string): Row[] {
  if (!s) return [];
  return [
    [t("col.date"), t("summary.kind"), t("day.reason"), t("day.notes"), t("day.quantity")],
    [s.from, t("summary.opening", { date: s.from }), "", "", s.opening],
    ...s.lines.map((l) => [l.date, l.kind === "inbound" ? t("summary.inbound") : t("summary.adjustment"), reason(l.reason), l.notes ?? "", l.quantity]),
    [s.to, t("summary.applied", { date: s.to }), "", "", -s.applied],
    [s.to, t("summary.closing", { date: s.to }), "", "", s.closing],
  ];
}

/** The owner's sheet: concept + quantity, the same rows as KardexOwnerSummary. */
export function ownerCsv(s: KardexSummary | null, t: T, reason: (r: string | null) => string): Row[] {
  const f = s?.ownerFormat;
  if (!s || !f) return [];
  return [
    [t("owner.concept"), t("owner.quantity")],
    [t("owner.opening"), f.opening],
    ...f.inbound.map((l) => [`${t("owner.inbound", { date: l.date })} · ${l.supplier ?? t("owner.noSupplier")} · ${t("owner.transfer")} # ${l.documentNumber ?? "—"}`, l.quantity]),
    ...f.manualOutputs.map((l) => [
      [reason(l.reason), l.adjustmentNumber != null ? `${t("owner.adjustment")} # ${l.adjustmentNumber}` : "", l.date].filter(Boolean).join(" · "),
      Math.abs(l.quantity),
    ]),
    ...(f.correctionsNet !== 0 ? [[t("owner.corrections"), f.correctionsNet]] : []),
    [t("owner.applied", { date: s.to }), f.appliedNet],
    [t("owner.closing", { date: s.to }), f.closing],
    ...f.closingBySupplier.map((x) => [`${t("owner.observations")} ${x.supplier ?? t("owner.noSupplier")}`, x.quantity]),
  ];
}
