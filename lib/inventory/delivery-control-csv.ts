// The "Control de entregas" tab as CSV rows, in the same columns and words as the screen. Pure: the
// screen passes its translator and a month label; tested in delivery-control-csv.test.ts.
import type { KardexDeliveryControl } from "../api/inventory-kardex.ts";
import { deliveryObservationsText, groupDeliveryLines } from "./delivery-control.ts";

type T = (key: string, values?: Record<string, string | number>) => string;
type Row = (string | number)[];

export function deliveryCsv(data: KardexDeliveryControl | null, t: T, monthLabel: (m: string | null) => string): Row[] {
  if (!data) return [];
  const rows: Row[] = [
    [
      t("delivery.col.record"),
      t("delivery.col.patient"),
      t("delivery.col.date"),
      t("delivery.col.invoice"),
      t("delivery.col.sold"),
      t("delivery.col.delivered"),
      t("delivery.col.deliveryDates"),
      t("delivery.col.pending"),
      t("delivery.col.notes"),
    ],
  ];
  for (const g of groupDeliveryLines(data.lines, data.months)) {
    for (const l of g.lines) {
      rows.push([
        l.recordNumber ?? "",
        l.patientName ?? "",
        l.invoiceDate ?? "",
        l.invoiceNumber ?? "",
        l.sold,
        l.delivered,
        l.deliveryDates.join(" "),
        l.pending,
        deliveryObservationsText(l, t),
      ]);
    }
    rows.push([monthLabel(g.month), "", "", "", g.sold, g.delivered, "", g.pending, ""]);
  }
  rows.push([t("delivery.totalPending"), "", "", "", "", "", "", data.warehouse.pending, ""]);
  return rows;
}
