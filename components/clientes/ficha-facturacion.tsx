"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { listFacturas, imprimirFactura, type Factura } from "@/lib/api/facturas";
import type { Paginated } from "@/lib/api/types";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";
import { buildRecibo } from "@/lib/factura/build-recibo";
import { buildReceiptText } from "@/lib/print/receipt-labels";
import { RECEIPT_LOGO_MAX_HEIGHT_MM, receiptToEscPos } from "@/lib/print/receipt-escpos";
import { loadLogoRaster } from "@/lib/print/load-logo";
import { BackupPrintButton } from "@/components/facturacion/backup-print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingPanel, Panel, RecordTable, Td, Th } from "@/components/kit/panel";
import { StatusBadge } from "@/components/kit/status-badge";

// Patient record, «Facturación» tab: the patient's FULL invoice history, every department (consulta +
// general), legacy invoices included (`legacyOrigin`), newest first, paginated — from GET /invoices?patientId
// (handoff docs/specs/patient-billing-tab-history-handoff.md). NOT /invoices/patient-summary: that is the
// cashier's «today» sum. No KPI totals here until the BE serves them for the whole history: a sum of one
// page is not the patient's total.
const PAGE_SIZE = 25;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
// Month first (US/PR business), digits only — explicit locale allowed by rule 3b. A BE day is a day: UTC.
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });

export function FichaFacturacion({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("patients.hub");
  const tRoot = useTranslations();
  const [page, setPage] = React.useState(1);
  const [shown, setShown] = React.useState<Factura | null>(null);
  const res = useResource<Paginated<Factura>>(
    () => listFacturas({ patientId: pacienteId, page, limit: PAGE_SIZE }, centro),
    [pacienteId, centro, page],
  );

  if (res.state.kind === "loading") return <LoadingPanel rows={6} />;
  if (res.state.kind === "fail") return <ErrorState message={res.state.message} />;

  const { items, pagination } = res.state.data;
  const total = pagination?.total ?? items.length;
  const pages = Math.max(1, Math.ceil(total / (pagination?.limit || PAGE_SIZE)));
  const label = (key: string, fallback: string) => (tRoot.has(key) ? tRoot(key) : fallback);
  const day = (iso?: string | null) => {
    const d = parseDayUTC(iso);
    return d ? dayFmt.format(d) : "—";
  };

  return (
    <Panel title={t("invoicesTitle")} description={items.length > 0 ? t("invoiceHistoryCount", { n: total }) : undefined}>
      {items.length === 0 ? (
        <EmptyState>{t("noFacturas")}</EmptyState>
      ) : (
        <RecordTable
          head={
            <>
              <Th>{t("invoice")}</Th>
              <Th>{t("date")}</Th>
              <Th>{t("department")}</Th>
              <Th>{t("origin")}</Th>
              <Th>{t("status")}</Th>
              <Th right>{t("total")}</Th>
              <Th right>{t("collected")}</Th>
            </>
          }
        >
          {items.map((f) => {
            const ctx = (f as { context?: string | null }).context;
            const amount = Number(f.total) || 0;
            const paid = Number(f.paidAmount) || 0;
            return (
              <tr key={f.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setShown(f)}>
                <Td className="font-mono">
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); setShown(f); }}>
                    {f.number || "—"}
                  </button>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{day(f.date)}</Td>
                <Td>{ctx ? label(`caja.division.${ctx === "consulta" ? "consulta" : "general"}`, ctx) : "—"}</Td>
                <Td>
                  {f.legacyOrigin ? (
                    <Badge variant="outline">{t("legacy", { origin: label(`grupo.${f.legacyOrigin}`, f.legacyOrigin) })}</Badge>
                  ) : (
                    <span className="text-muted-foreground">{t("newSystem")}</span>
                  )}
                </Td>
                <Td><StatusBadge kind="invoice" value={f.status} /></Td>
                <Td className="text-right font-semibold tabular-nums">{money.format(amount)}</Td>
                {/* Collected below the total is shown amber so an open balance stands out in the list. */}
                <Td className={cn("text-right tabular-nums", paid < amount && f.status !== "anulada" ? "text-warning-foreground" : "text-muted-foreground")}>
                  {money.format(paid)}
                </Td>
              </tr>
            );
          })}
        </RecordTable>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t px-5 py-2.5 text-sm">
          <span className="tabular-nums text-muted-foreground">{t("pageOf", { page, pages })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prevPage")}</Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t("nextPage")}</Button>
          </div>
        </div>
      )}
      <InvoiceQuickView invoice={shown} centro={centro} onClose={() => setShown(null)} />
    </Panel>
  );
}

// Click on a number: the invoice itself, as printed (the /print/invoice page in an iframe), without
// leaving the patient's record. «Abrir factura» goes to the full editor when needed.
function InvoiceQuickView({ invoice, centro, onClose }: { invoice: Factura | null; centro?: string; onClose: () => void }) {
  const t = useTranslations("patients.hub");
  const tReceipt = useTranslations("receipt");
  const tRoot = useTranslations();
  const center = (invoice as { clinicId?: string } | null)?.clinicId ?? centro;
  const qs = center ? `centro=${encodeURIComponent(center)}` : "";
  // Same backup path as the invoice editor (components/facturacion/receipt-print-dialog.tsx): raw
  // ESC/POS through the print hub, for when the ficha's quick-view browser print fails/isn't set up —
  // the owner noticed this view never had it. `imprimirFactura` marks it printed on the BE (same call
  // the editor makes), so the audit trail is identical regardless of where the reprint was triggered.
  async function buildBackupBytes(): Promise<Uint8Array> {
    if (!invoice) throw new Error("no invoice");
    const r = await imprimirFactura(invoice.id, center);
    const recibo = buildRecibo(r.invoice, {}, {}, r.quoteNumber ?? null);
    const logo = await loadLogoRaster(recibo.logoUrl ?? "/img/logo_cmr.png", RECEIPT_LOGO_MAX_HEIGHT_MM);
    return receiptToEscPos(recibo, buildReceiptText(tReceipt, tRoot), logo);
  }
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[28rem]">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="font-mono text-base">{invoice?.number ?? ""}</DialogTitle>
        </DialogHeader>
        {invoice && (
          <iframe
            src={`/print/invoice/${invoice.id}?embed=1${qs ? `&${qs}` : ""}`}
            title={invoice.number ?? invoice.id}
            className="block h-[min(75svh,44rem)] w-full bg-white"
          />
        )}
        {invoice && (
          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <BackupPrintButton centerId={center} buildBytes={buildBackupBytes} />
            <Button variant="outline" size="sm" onClick={() => window.open(`/print/invoice/${invoice.id}${qs ? `?${qs}` : ""}`, "_blank", "noopener")}>
              {t("printInvoice")}
            </Button>
            <Button size="sm" asChild>
              <Link href={`/billing/invoices/${invoice.id}${qs ? `?${qs}` : ""}`}>{t("openInvoice")}</Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
