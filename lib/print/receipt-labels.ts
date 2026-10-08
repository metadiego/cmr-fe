import type { ReceiptLabels } from "./hub.ts";

// Builds the printed labels for the backup ticket from the `receipt` i18n namespace — the same keys
// the on-screen receipt uses, so both print in the app's language.
export function receiptLabels(t: (key: string) => string): ReceiptLabels {
  return {
    invoice: t("invoice"),
    returnDoc: t("returnDoc"),
    budgetDoc: t("budgetDoc"),
    record: t("record"),
    subtotal: t("subtotal"),
    discount: t("discount"),
    shipping: t("shipping"),
    total: t("total"),
    paid: t("paid"),
    balance: t("balance"),
    attendedBy: t("attendedBy"),
    thanks: t("thanks"),
    backupFooter: t("backupFooter"),
  };
}
