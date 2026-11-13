"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { loadRefundRecibo } from "@/lib/api/refund-receipt";
import type { Recibo } from "@/lib/factura/build-recibo";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";
import { ReceiptPaperSkeleton } from "@/components/facturacion/invoice-detail-skeleton";
import { BackupPrintButton } from "@/components/facturacion/backup-print-button";
import { loadLogoRaster } from "@/lib/print/load-logo";
import { RECEIPT_LOGO_MAX_HEIGHT_MM, receiptToEscPos } from "@/lib/print/receipt-escpos";
import { buildReceiptText } from "@/lib/print/receipt-labels";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";

// Recibo PROPIO de una devolución ("Devolución #D-000001"), reusando <ReciboTermico>. El nombre de cada
// producto no viene en el recibo del BE → lo resolvemos desde la factura de origen (facturaItemId → descripción).
export default function ReciboDevolucionPage() {
  const params = useParams<{ id: string; devId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = String(params.id);
  const devId = String(params.devId);
  const centro = search.get("centro") ?? undefined;
  const t = useTranslations("receipt");
  const tRoot = useTranslations();

  const [recibo, setRecibo] = React.useState<Recibo | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    loadRefundRecibo(id, devId, centro)
      .then((r) => {
        if (active) setRecibo(r);
      })
      .catch((err) => toastError(err, tRoot))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, devId, centro, tRoot]);

  // Bytes for the hub's backup print path: the SAME recibo the paper draws, rasterized exactly like
  // the invoice receipt's own hub button (components/facturacion/receipt-print-dialog.tsx).
  const buildBytes = React.useCallback(async () => {
    if (!recibo) throw new Error("recibo not loaded");
    const logo = await loadLogoRaster(recibo.logoUrl ?? "/img/logo_cmr.png", RECEIPT_LOGO_MAX_HEIGHT_MM);
    return receiptToEscPos(recibo, buildReceiptText(t, tRoot), logo);
  }, [recibo, t, tRoot]);

  // While loading, the real frame (back/print) stays and the paper is a skeleton of the same width.
  if (!loading && !recibo) return <p className="mx-auto max-w-7xl px-6 py-16 text-center text-sm text-muted-foreground">{tRoot("facturacion.notFound")}</p>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-3 flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.back()}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {tRoot("facturacion.back")}
        </Button>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => window.print()}>
          <HugeiconsIcon icon={PrinterIcon} className="size-4" />
          {tRoot("receipt.print")}
        </Button>
      </div>
      <div className="flex justify-center rounded-xl border bg-muted/30 p-6">
        <div className="shadow-lg ring-1 ring-border">
          {recibo ? <ReciboTermico recibo={recibo} /> : <ReceiptPaperSkeleton />}
        </div>
      </div>
      {recibo && (
        <div className="mt-3 flex justify-end no-print">
          <BackupPrintButton centerId={centro} buildBytes={buildBytes} />
        </div>
      )}
    </div>
  );
}
