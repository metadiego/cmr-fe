"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { ControlSkeleton, LoadingRegion } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const CARD = "rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]";
// A typical drawer: bills and coins from $100 down to 1¢.
const DENOMINATIONS = 10;

// Loading stand-in for the cuadre Editor: same scope row, same two-column grid (denomination count,
// opening fund and per-cashier breakdown on the left; the sticky payment summary on the right) and
// the pending-invoices card underneath. Static labels are real; only the figures are bars.
export function CuadreCajaSkeleton({
  isGerencia,
  esConsolidado,
}: {
  isGerencia: boolean;
  esConsolidado: boolean;
}) {
  const t = useTranslations("caja");
  const tp = useTranslations("caja.payments");
  return (
    <LoadingRegion className="space-y-4">
      {isGerencia && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("scope.label")}</span>
          <ControlSkeleton className="w-64" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <div className={CARD}>
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">{t("count.title")}</h3>
            </div>
            <div className="grid grid-cols-[1fr_5.5rem_auto] gap-x-3 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>{t("count.denomination")}</span>
              <span className="text-right">{t("count.quantity")}</span>
              <span className="text-right">{t("count.lineTotal")}</span>
            </div>
            <div className="divide-y">
              {Array.from({ length: DENOMINATIONS }, (_, i) => (
                <div key={i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-x-3 px-4 py-1.5">
                  <Skeleton className={cn("h-4", i % 2 ? "w-12" : "w-14")} />
                  <Skeleton className="h-8 w-full" />
                  <div className="flex min-w-20 justify-end">
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm font-semibold">{t("count.total")}</span>
              <Skeleton className="h-5 w-20" />
            </div>
          </div>

          {!esConsolidado && (
            <div className={cn(CARD, "flex flex-wrap items-center gap-3 px-4 py-3")}>
              <span className="text-sm font-medium">{tp("opening")}</span>
              <Skeleton className="h-9 w-28" />
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Skeleton className="size-4 rounded-sm" />
                {t("applyOpening")}
              </span>
            </div>
          )}

          {isGerencia && (
            <div className={CARD}>
              <div className="grid grid-cols-[1fr_7rem_7rem] gap-x-3 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <span className="text-sm font-semibold text-foreground">{t("cashiers.title")}</span>
                <span className="text-right">{t("cashiers.cash")}</span>
                <span className="text-right">{t("cashiers.sales")}</span>
              </div>
              <div className="divide-y">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="grid grid-cols-[1fr_7rem_7rem] gap-x-3 px-4 py-2">
                    <Skeleton className={cn("my-0.5 h-4", i % 2 ? "w-32" : "w-40")} />
                    <Skeleton className="my-0.5 ml-auto h-4 w-16" />
                    <Skeleton className="my-0.5 ml-auto h-4 w-16" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_7rem_7rem] gap-x-3 border-t px-4 py-2.5 text-sm font-semibold">
                <span>{t("cashiers.consolidated")}</span>
                <Skeleton className="my-0.5 ml-auto h-4 w-16" />
                <Skeleton className="my-0.5 ml-auto h-4 w-16" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          <MethodsCard title={tp("cards")} rows={3} total={tp("totalCards")} />
          <MethodsCard title={tp("otherMethods")} rows={2} />
          <section className={cn(CARD, "space-y-1 p-4")}>
            <h3 className="mb-2 text-sm font-semibold">{tp("general")}</h3>
            {(["opening", "salesCash", "electronic", "totalCards", "totalCMA"] as const).map((k) => (
              <SummaryRow key={k} label={tp(k)} />
            ))}
            <div className="my-1 border-t" />
            {(["grossBilling", "returns", "netBilling"] as const).map((k) => (
              <SummaryRow key={k} label={tp(k)} />
            ))}
            <div className="my-1 border-t" />
            {(["cashInDrawer", "deposit"] as const).map((k) => (
              <SummaryRow key={k} label={tp(k)} />
            ))}
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
          </section>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>

      <div className={cn(CARD, "overflow-hidden")}>
        <div className="border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">{t("pending.title")}</h3>
        </div>
        <div className="divide-y">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 px-4 py-2.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className={cn("h-4", i % 2 ? "w-32" : "w-40")} />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

// "Tarjetas" / "Otros medios" card: real heading, a bar per payment method, optional total row.
function MethodsCard({ title, rows, total }: { title: string; rows: number; total?: string }) {
  return (
    <section className={CARD}>
      <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{title}</h3>
      <ul className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center justify-between px-4 py-2">
            <Skeleton className={cn("my-0.5 h-4", i % 2 ? "w-20" : "w-28")} />
            <Skeleton className="my-0.5 h-4 w-16" />
          </li>
        ))}
      </ul>
      {total && (
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm font-semibold">
          <span>{total}</span>
          <Skeleton className="my-0.5 h-4 w-16" />
        </div>
      )}
    </section>
  );
}

function SummaryRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Skeleton className="my-0.5 h-4 w-16" />
    </div>
  );
}
