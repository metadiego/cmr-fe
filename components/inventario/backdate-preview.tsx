"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import type { BackdatePreview as Preview, BackdateProductImpact } from "@/lib/api/inventory-backdate";
import { countMoved } from "@/lib/inventory/backdate";
import { parseDayUTC } from "@/lib/format/fecha";
import { ErrorState, LoadingPanel, Panel, RecordTable, Td, Th } from "@/components/kit/panel";
import { Button } from "@/components/ui/button";

// What a PAST-dated adjustment would do, before saving (cmr-be #646, POST /inventory/adjustments/preview):
// per product the day's and today's balance before → after, the month openings it rewrites, the days
// that turn negative (red), later physical counts and closings, and the day-by-day table on demand.
// Nothing here writes; the save button reads `problems` from the same answer.
export function BackdatePreview({ state }: { state: { kind: "loading" } | { kind: "fail"; message: string } | { kind: "ok"; data: Preview } }) {
  const t = useTranslations("inventoryAdjustments.backdate");
  const tRoot = useTranslations();
  const format = useFormatter();
  if (state.kind === "loading") return <LoadingPanel rows={3} />;
  if (state.kind === "fail") return <ErrorState message={state.message} />;
  const p = state.data;
  const effective = parseDayUTC(p.effectiveDay);
  return (
    <Panel title={t("previewTitle")} description={t("previewHelp", { day: effective ? format.dateTime(effective, "dayLong") : p.effectiveDay, n: p.daysBack })}>
      <div className="space-y-4 px-5 py-4">
        {!p.canBackdate && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tRoot("inventory.backdate.forbidden")}</p>}
        {p.problems.map((pr) => (
          <p key={pr.code} className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {tRoot.has(pr.labelKey) ? tRoot(pr.labelKey) : pr.code}
          </p>
        ))}
        {p.closings.length > 0 && <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">{t("closings", { n: p.closings.length })}</p>}
        {p.products.map((x) => (
          <ProductImpact key={x.productId} x={x} />
        ))}
      </div>
    </Panel>
  );
}

function ProductImpact({ x }: { x: BackdateProductImpact }) {
  const t = useTranslations("inventoryAdjustments.backdate");
  const format = useFormatter();
  const [open, setOpen] = React.useState(false);
  const n = (v: number) => format.number(v, { maximumFractionDigits: 2 });
  const day = (iso: string) => {
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayMonth") : iso;
  };
  const month = (iso: string) => {
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "monthYear") : iso;
  };
  const negative = new Set(x.newlyNegativeDays);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {x.name ?? x.sku ?? x.productId}
          {x.sku && <span className="ml-2 font-mono text-xs text-muted-foreground">{x.sku}</span>}
        </span>
        <span className={`tabular-nums font-semibold ${x.delta < 0 ? "text-destructive" : "text-success-foreground"}`}>
          {x.delta > 0 ? "+" : ""}
          {n(x.delta)}
        </span>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Change label={t("effectiveDay")} before={n(x.effectiveDayBefore)} after={n(x.effectiveDayAfter)} />
        <Change label={t("today")} before={n(x.todayBefore)} after={n(x.todayAfter)} />
        {x.monthOpenings.map((m) => (
          <Change key={m.date} label={t("opening", { month: month(m.date) })} before={n(m.before)} after={n(m.after)} />
        ))}
      </div>
      {x.newlyNegativeDays.length > 0 && (
        <p className="text-sm text-destructive">{t("negativeDays", { days: x.newlyNegativeDays.map(day).join(", ") })}</p>
      )}
      {x.laterCounts.length > 0 && (
        <p className="text-sm text-warning-foreground">{t("laterCounts", { days: x.laterCounts.map((c) => `${day(c.date)} (${countMoved(c) > 0 ? "+" : ""}${n(countMoved(c))})`).join(", ") })}</p>
      )}
      {x.days.length > 0 && (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? t("hideDays") : t("showDays", { n: x.days.length })}
          </Button>
          {open && (
            <div className="max-h-80 overflow-auto rounded-lg border">
              <RecordTable
                head={
                  <>
                    <Th>{t("col.date")}</Th>
                    <Th right>{t("col.before")}</Th>
                    <Th right>{t("col.after")}</Th>
                  </>
                }
              >
                {x.days.map((d) => (
                  <tr key={d.date} className={negative.has(d.date) ? "bg-destructive/10" : undefined}>
                    <Td className="tabular-nums">{day(d.date)}</Td>
                    <Td className="text-right tabular-nums text-muted-foreground">{n(d.before)}</Td>
                    <Td className={`text-right tabular-nums ${d.after < 0 ? "font-semibold text-destructive" : ""}`}>{n(d.after)}</Td>
                  </tr>
                ))}
              </RecordTable>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Change({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular-nums">
        <span className="text-muted-foreground">{before}</span> → <span className="font-semibold">{after}</span>
      </div>
    </div>
  );
}
