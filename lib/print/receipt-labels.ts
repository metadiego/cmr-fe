import type { useTranslations } from "next-intl";

import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import type { ReceiptText } from "./receipt-escpos";

type Translator = ReturnType<typeof useTranslations>;

// The ticket's translations from the same places <ReciboTermico> takes them: the `receipt` namespace,
// `fac.col.<key>` for multipliers and `formasPago.<clave>` for payment methods.
export function buildReceiptText(tReceipt: Translator, tRoot: Translator): ReceiptText {
  return {
    t: (key, values) => tReceipt(key, values),
    multiplierLabel: (k) => (tRoot.has(`fac.col.${k}`) ? tRoot(`fac.col.${k}`) : k),
    paymentLabel: (p) => formaPagoLabel(tRoot, p.clave, p.formaPagoNombre),
  };
}
