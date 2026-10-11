"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { LoadingRegion } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders for the full-screen return (app/(app)/billing/invoices/[id]/return/page.tsx),
// per docs/specs/2026-10-10-skeletons-de-carga.md: same boxes as the loaded page, real labels and
// column headers, bars only where the invoice's numbers go.

const CARD = "rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]";

/** Invoice summary strip (subtotal / discount / tax / total) with the loaded strip's box and labels. */
export function ReturnSummarySkeleton() {
  const tf = useTranslations("facturacion");
  const cols: { label: string; strong?: boolean }[] = [
    { label: tf("subtotal") },
    { label: tf("discount") },
    { label: tf("tax") },
    { label: tf("total"), strong: true },
  ];
  return (
    <LoadingRegion className="rounded-md ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] bg-gradient-to-br from-primary/10 to-transparent px-5 py-4">
      <div className="mt-3 border-t pt-3">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
          {cols.map((c) => (
            <div key={c.label} className="flex flex-col">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide", c.strong ? "text-primary/80" : "text-muted-foreground")}>
                {c.label}
              </span>
              <span className={cn("flex items-center", c.strong ? "h-6" : "h-5")}>
                <Skeleton className={c.strong ? "h-5 w-20" : "h-4 w-14"} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Lines table (real headers) + the aside's policy/reason/refund fields and net-refund card. */
export function ReturnFormSkeleton({ rows = 3 }: { rows?: number }) {
  const t = useTranslations("facturacionList.actions");
  const tf = useTranslations("facturacion");
  const tc = useTranslations("common");
  const field = (label: string, control: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Skeleton className={cn("h-9", control)} />
    </div>
  );
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
      <section className={cn("overflow-x-auto", CARD)}>
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{tf("concept")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colBilled")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colAvailable")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colReturn")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colRefund")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r} aria-busy={r === 0 ? true : undefined}>
                <td className="px-3 py-2">
                  {r === 0 && <span className="sr-only">{tc("loading")}</span>}
                  <div aria-hidden className="flex h-8 items-center">
                    <Skeleton className={cn("h-4", ["w-44", "w-36", "w-52"][r % 3])} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div aria-hidden className="flex h-8 items-center justify-end"><Skeleton className="h-4 w-20" /></div>
                </td>
                <td className="px-3 py-2">
                  <div aria-hidden className="flex h-8 items-center justify-end"><Skeleton className="h-4 w-6" /></div>
                </td>
                <td className="px-3 py-2">
                  <Skeleton aria-hidden className="ml-auto h-8 w-20" />
                </td>
                <td className="px-3 py-2">
                  <Skeleton aria-hidden className="ml-auto h-8 w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="h-fit space-y-4 lg:sticky lg:top-6">
        <LoadingRegion className={cn("space-y-3 p-4", CARD)}>
          {field(t("policy"), "w-44")}
          {field(t("returnReason"), "w-full")}
          {field(t("returnRefund"), "w-40")}
        </LoadingRegion>
        <LoadingRegion className={cn("p-4", CARD)}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("netRefund")}</span>
            <span className="flex h-7 items-center"><Skeleton className="h-6 w-24" /></span>
          </div>
          <Skeleton className="mt-3 h-9 w-full" />
        </LoadingRegion>
      </aside>
    </div>
  );
}
