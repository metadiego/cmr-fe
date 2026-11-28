// "Compras y devoluciones" as CSV rows, in the same columns and words as the screen. Pure: tested in
// purchases-refunds-csv.test.ts.
import type { KardexPurchasesRefunds } from "../api/inventory-kardex.ts";
import { channelText } from "./purchases-refunds.ts";

type T = (key: string, values?: Record<string, string | number>) => string;
type Row = (string | number)[];

export function purchasesRefundsCsv(data: KardexPurchasesRefunds | null, t: T): Row[] {
  if (!data) return [];
  const rows: Row[] = [[t("purchasesRefunds.sectionPurchases")]];
  rows.push([
    t("purchasesRefunds.col.date"),
    t("purchasesRefunds.col.record"),
    t("purchasesRefunds.col.patient"),
    t("purchasesRefunds.col.invoice"),
    t("purchasesRefunds.col.channel"),
    t("purchasesRefunds.col.quantity"),
  ]);
  for (const p of data.purchases) {
    rows.push([p.date, p.recordNumber ?? "", p.patientName ?? "", p.invoiceNumber ?? "", channelText(p, t), p.quantity]);
  }
  rows.push([t("purchasesRefunds.totalPurchased"), "", "", "", "", data.totals.purchased]);

  rows.push([]);
  rows.push([t("purchasesRefunds.sectionRefunds")]);
  rows.push([
    t("purchasesRefunds.col.date"),
    t("purchasesRefunds.col.refundNumber"),
    t("purchasesRefunds.col.invoice"),
    t("purchasesRefunds.col.record"),
    t("purchasesRefunds.col.patient"),
    t("purchasesRefunds.col.quantity"),
  ]);
  for (const r of data.refunds) {
    rows.push([
      r.date,
      r.refundNumber ?? "",
      r.invoiceNumber ?? "",
      r.recordNumber ?? "",
      r.patientName ?? "",
      r.viaKit ? `${r.quantity} (${t("purchasesRefunds.viaKit")})` : r.quantity,
    ]);
  }
  rows.push([t("purchasesRefunds.totalRefunded"), "", "", "", "", data.totals.refunded]);
  rows.push([]);
  rows.push([t("purchasesRefunds.totalNet"), "", "", "", "", data.totals.net]);

  if (data.undatedLegacy.packages > 0) {
    rows.push([]);
    rows.push([t("purchasesRefunds.undatedLegacy", data.undatedLegacy)]);
  }
  return rows;
}
