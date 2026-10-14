"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { LoadingRegion } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Loading placeholders for the invoice screens (docs/specs/2026-10-10-skeletons-de-carga.md), kept out
// of app/(app)/billing/invoices/[id]/page.tsx (DEBT ceiling). Each one copies the loaded markup of the
// region it stands in for: same containers, same paddings, real labels wherever they don't need data.

/** Inline bar for spots where a <div> is not valid (inside <p>/<h1>); same look as <Skeleton>. */
export function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-foreground/[0.07]", className)} />;
}

/** A summary line of the totals card (label real, amount pending), same box as the page's <Row>. */
function AmountRow({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={strong ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{label}</span>
      <span className={cn("flex items-center", strong ? "h-6" : "h-5")}>
        <Skeleton className={strong ? "h-5 w-20" : "h-4 w-14"} />
      </span>
    </div>
  );
}

/** The thermal receipt paper while its data loads (same width as <ReciboTermico> on screen). */
export function ReceiptPaperSkeleton() {
  const dashed = <div className="my-2 border-t border-dashed border-border" />;
  return (
    <LoadingRegion className="mx-auto w-[var(--recibo-ancho,72mm)] bg-card px-3 py-4">
      <div style={{ height: "6mm" }} />
      <div className="flex flex-col items-center gap-1.5">
        <Skeleton className="mb-1 h-[14mm] w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-2.5 w-36" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      {dashed}
      <div className="flex justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      {dashed}
      <div className="space-y-1.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-3 w-36" />
      </div>
      {dashed}
      <div className="space-y-2">
        {["w-32", "w-28", "w-36"].map((w, i) => (
          <div key={i} className="flex justify-between gap-2">
            <Skeleton className={cn("h-2.5", w)} />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>
      {dashed}
      <div className="space-y-1.5">
        {["w-16", "w-14", "w-20"].map((w, i) => (
          <div key={i} className="flex justify-between gap-2">
            <Skeleton className={cn("h-2.5", w)} />
            <Skeleton className="h-2.5 w-14" />
          </div>
        ))}
      </div>
      <div style={{ height: "10mm" }} />
    </LoadingRegion>
  );
}

/** Line items: the real card title and column headers, skeleton rows shaped per column. */
function ItemsCardSkeleton({ rows = 3 }: { rows?: number }) {
  const t = useTranslations("facturacion");
  const tc = useTranslations("common");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("items")}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>{t("concept")}</TableHead>
              <TableHead className="w-20 text-right">{t("qty")}</TableHead>
              <TableHead className="w-28 text-right">{t("price")}</TableHead>
              <TableHead className="w-28 text-right">{t("lineTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r} aria-busy={r === 0 ? true : undefined} className="hover:bg-transparent">
                <TableCell>
                  {r === 0 && <span className="sr-only">{tc("loading")}</span>}
                  <div aria-hidden className="flex h-7 items-center">
                    <Skeleton className={cn("h-4", ["w-48", "w-40", "w-56"][r % 3])} />
                  </div>
                </TableCell>
                {["w-8", "w-16", "w-16"].map((w, c) => (
                  <TableCell key={c}>
                    <div aria-hidden className="flex h-7 items-center justify-end">
                      <Skeleton className={cn("h-4", w)} />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </CardContent>
    </Card>
  );
}

/** Totals card + payments panel of the editor's aside, with their real labels. */
function SummaryAsideSkeleton() {
  const t = useTranslations("facturacion");
  const tp = useTranslations("pagosFactura");
  return (
    <aside className="space-y-4">
      <Card>
        <LoadingRegion>
          <CardContent className="space-y-2">
            <AmountRow label={t("subtotal")} />
            <AmountRow label={t("discount")} />
            <AmountRow label={t("tax")} />
            <div className="border-t pt-2"><AmountRow label={t("total")} strong /></div>
          </CardContent>
        </LoadingRegion>
      </Card>
      {/* Same box as PagosFactura: header, one payment row, the balance strip. */}
      <LoadingRegion className="space-y-2 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tp("title")}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {tp("paid")} <Bar className="h-3 w-12" />
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
          <Skeleton className="h-4 w-12 rounded-full" />
          <span className="flex h-5 flex-1 items-center"><Skeleton className="h-4 w-24" /></span>
          <Skeleton className="h-4 w-14" />
        </div>
        <div className="flex items-center justify-between rounded-md border px-2.5 py-1.5">
          <span className="flex h-5 items-center"><Skeleton className="h-4 w-20" /></span>
          <Skeleton className="h-4 w-14" />
        </div>
      </LoadingRegion>
    </aside>
  );
}

/**
 * The whole invoice detail before the invoice arrives: back link, header (title, user line, record and
 * number chips, status badge, print), items + totals grid and the receipt preview card.
 */
export function InvoiceDetailSkeleton() {
  const tRoot = useTranslations();
  return (
    <PageContainer>
      <Bar className="h-5 w-16" />
      <PageHeader
        title={
          <span aria-busy="true">
            <span className="sr-only">{tRoot("common.loading")}</span>
            <span className="flex h-[15px] items-center"><Bar className="h-2.5 w-28" /></span>
            <span className="flex h-8 items-center"><Bar className="h-6 w-56" /></span>
          </span>
        }
        description={<span className="mt-0.5 flex h-[22px] items-center"><Bar className="h-3 w-44" /></span>}
        actions={
          <span aria-hidden className="flex items-center gap-2">
            <Bar className="h-7 w-16 rounded-lg" />
            <Bar className="h-7 w-20" />
            <Bar className="h-5 w-20 rounded-full" />
            <Bar className="h-8 w-24" />
          </span>
        }
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-3">
          <ItemsCardSkeleton />
        </section>
        <SummaryAsideSkeleton />
      </div>
      <Card>
        <CardHeader className="no-print">
          <CardTitle className="text-muted-foreground">{tRoot("receipt.previewTitle")}</CardTitle>
          <CardAction><Skeleton className="h-8 w-24" /></CardAction>
        </CardHeader>
        <CardContent className="flex justify-center rounded-xl bg-muted/30 py-6">
          <div className="shadow-lg ring-1 ring-border">
            <ReceiptPaperSkeleton />
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

/** Bordered option rows of the invoice dialogs (kit optionals, kit components, patient search). */
export function DialogRowsSkeleton({ rows = 3, sub, trailing = "w-12" }: { rows?: number; sub?: boolean; trailing?: string | null }) {
  return (
    <LoadingRegion className="space-y-2">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span className="flex min-w-0 flex-col gap-1.5 py-0.5">
            <Skeleton className={cn("h-4", ["w-40", "w-32", "w-48"][r % 3])} />
            {sub && <Skeleton className="h-3 w-24" />}
          </span>
          {trailing && <Skeleton className={cn("h-4", trailing)} />}
        </div>
      ))}
    </LoadingRegion>
  );
}

/** Result rows of the product search popover (SKU + name). */
export function ProductOptionsSkeleton() {
  return (
    <LoadingRegion>
      {["w-40", "w-32", "w-44"].map((w, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className={cn("h-4", w)} />
        </div>
      ))}
    </LoadingRegion>
  );
}
