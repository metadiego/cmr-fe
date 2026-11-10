"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { getReciboDevolucion, getFactura, getFormasPago } from "@/lib/api/facturas";
import { buildReciboDevolucion, type Recibo } from "@/lib/factura/build-recibo";
import { getActiveCentro } from "@/lib/tenant";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";
import { apiErrorLabel } from "@/lib/api/errors";
import { receiptStatusMessage } from "@/lib/print/receipt-status-message";

// The REFUND receipt on its own page («DEVOLUCIÓN #D-000026», «Factura de origen #L006875»), the twin of
// /print/invoice/:id: inside the billing dialog's viewer with ?embed=1 (reports ready/error to it), or in
// its own tab, where it prints itself. Owner, 10-nov: the first refunds printed the INVOICE instead.
export default function PrintRefundPage() {
  const params = useParams<{ invoiceId: string; refundId: string }>();
  const invoiceId = String(params?.invoiceId ?? "");
  const refundId = String(params?.refundId ?? "");
  const search = useSearchParams();
  const embed = search?.get("embed") === "1";
  const centroParam = search?.get("centro") || undefined;
  const t = useTranslations("receipt");
  const tRoot = useTranslations();
  const [recibo, setRecibo] = React.useState<Recibo | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  const errorText = error == null ? null : apiErrorLabel(error, tRoot);

  React.useEffect(() => {
    if (!invoiceId || !refundId) return;
    let active = true;
    const centro = centroParam ?? getActiveCentro() ?? undefined;
    Promise.all([getReciboDevolucion(invoiceId, refundId, centro), getFactura(invoiceId, centro).catch(() => null), getFormasPago(centro).catch(() => [])])
      .then(([rec, fact, formas]) => {
        if (!active) return;
        const nombres: Record<string, string> = {};
        (fact?.items ?? []).forEach((it) => {
          if (it.id) nombres[String(it.id)] = it.description ?? "—";
        });
        const clavePorNombre: Record<string, string> = {};
        formas.forEach((f) => {
          if (f.name && f.slug) clavePorNombre[f.name] = f.slug;
        });
        setRecibo(buildReciboDevolucion(rec, nombres, clavePorNombre));
        if (embed) window.parent.postMessage(receiptStatusMessage("ready"), window.location.origin);
      })
      .catch((err) => active && setError(err));
    return () => {
      active = false;
    };
  }, [invoiceId, refundId, centroParam, embed]);

  React.useEffect(() => {
    if (embed && errorText != null) window.parent.postMessage(receiptStatusMessage("error", errorText), window.location.origin);
  }, [embed, errorText]);

  // Its own tab: print itself once drawn, then close (like /print/invoice).
  React.useEffect(() => {
    if (!recibo || embed) return;
    const h = setTimeout(() => {
      window.print();
      window.onafterprint = () => {
        try {
          window.close();
        } catch {
          /* a tab a script did not open may refuse to close; it just stays open */
        }
      };
    }, 400);
    return () => clearTimeout(h);
  }, [recibo, embed]);

  if (errorText != null)
    return (
      <div role="alert" style={{ padding: 16, fontSize: 14, fontFamily: "sans-serif" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{t("loadFailed")}</p>
        <p style={{ margin: "4px 0 0", color: "#555" }}>{errorText}</p>
      </div>
    );
  if (!recibo) return <p style={{ padding: 16, fontSize: 14, fontFamily: "sans-serif", color: "#555" }}>{t("preparing")}</p>;
  return (
    <div id="pagina-recibo">
      <ReciboTermico recibo={recibo} />
    </div>
  );
}
