"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import { componentAmount, invoiceTotals, taxColumns, type ProductSales, type ProductSalesBucket } from "@/lib/caja/product-sales";
import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";

// «Venta de productos (IVU)» — what Accounting (Sheila) files the IVU return from: taxable / exempt /
// exonerated, IVU collected split by component (columns from the DATA), refunds, net, EVERY product
// invoice of the sheet, and the reconciliation with the day total. Presents BE numbers only.
export function ProductSalesSection({ ps }: { ps: ProductSales }) {
  const t = useTranslations("caja.productSales");
  const cols = React.useMemo(() => taxColumns(ps), [ps]);
  const invoices = React.useMemo(() => ps.invoices ?? [], [ps]);
  const tot = React.useMemo(() => invoiceTotals(invoices, cols), [invoices, cols]);
  const check = ps.check;

  return (
    <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <h3 className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-sm font-semibold">
        <span>{t("title")}</span>
        {check &&
          (check.squares ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success-foreground">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" /> {t("squares")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
              <HugeiconsIcon icon={Alert02Icon} className="size-4" /> {t("gap", { amount: money(check.gap) })}
            </span>
          ))}
      </h3>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
        <Bucket label={t("taxable")} b={ps.taxable} t={t} />
        <Bucket label={t("exempt")} b={ps.exempt} t={t} dim />
        <Bucket label={t("exonerated")} b={ps.exonerated} t={t} warn={ps.exonerated.amount > 0}>
          {ps.exonerated.amount > 0 && (
            <div className="mt-1 text-xs">{t("taxWouldBe")}: <b className="tabular-nums">{money(ps.exonerated.taxWouldBe?.total ?? 0)}</b></div>
          )}
        </Bucket>
        <Card label={t("taxCollected")} value={money(ps.tax.total)}>
          {cols.map((c) => (
            <div key={c.key} className="flex justify-between text-xs text-muted-foreground">
              <span>{c.name} {c.rate}%</span>
              <span className="tabular-nums">{money(componentAmount(ps.tax, c.key))}</span>
            </div>
          ))}
        </Card>
        <Card label={t("refunds")} value={ps.refunds.amount > 0 ? `−${money(ps.refunds.amount)}` : money(0)} tone={ps.refunds.amount > 0 ? "danger" : undefined}>
          <div className="text-xs text-muted-foreground">{t("refundDocs", { n: ps.refunds.documents })} · {t("taxShort")} {money(ps.refunds.tax?.total ?? 0)}</div>
        </Card>
        <Card label={t("net")} value={money(ps.net)} strong />
      </div>

      <div className="overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-semibold">{t("colNumber")}</th>
              <th className="px-3 py-2 text-left font-semibold">{t("colRecord")}</th>
              <th className="px-3 py-2 text-left font-semibold">{t("colPatient")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colBase")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colDiscount")}</th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-semibold">{c.name}</th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">{t("colTotal")}</th>
              <th className="px-3 py-2 text-center font-semibold">{t("colExonerated")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colRefunded")}</th>
              <th className="px-3 py-2 text-left font-semibold">{t("colPayment")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.length === 0 && (
              <tr><td colSpan={9 + cols.length} className="px-3 py-3 text-center text-muted-foreground">{t("none")}</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className={cn(inv.exonerated && "bg-warning/30")}>
                <td className="px-3 py-2 font-mono tabular-nums">{inv.number || "—"}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{inv.medicalRecordNumber || ""}</td>
                <td className="px-3 py-2">{inv.patient || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(inv.base)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(inv.discount)}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-right tabular-nums">{money(componentAmount(inv.tax, c.key))}</td>
                ))}
                <td className="px-3 py-2 text-right font-medium tabular-nums">{money(inv.total)}</td>
                <td className="px-3 py-2 text-center text-xs">{inv.exonerated ? t("yes") : t("no")}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums", (inv.refunded ?? 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                  {(inv.refunded ?? 0) > 0 ? `−${money(inv.refunded ?? 0)}` : money(0)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{inv.paymentMethods || "—"}</td>
              </tr>
            ))}
          </tbody>
          {invoices.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground" colSpan={3}>{t("totals", { n: invoices.length })}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(tot.base)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(tot.discount)}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-right tabular-nums">{money(tot.byComponent[c.key] ?? 0)}</td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{money(tot.total)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{tot.exonerated}</td>
                <td className="px-3 py-2 text-right tabular-nums">{tot.refunded > 0 ? `−${money(tot.refunded)}` : money(0)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {check && (
        <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-1 border-t px-4 py-2.5 text-sm", !check.squares && "bg-destructive/10")}>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("check")}</span>
          <span>{t("products")} <b className="tabular-nums">{money(check.products)}</b></span>
          <span>+ {t("services")} <b className="tabular-nums">{money(check.services)}</b></span>
          <span>= {t("dayNet")} <b className="tabular-nums">{money(check.dayNet)}</b></span>
          {!check.squares && <span className="font-semibold text-destructive">{t("gap", { amount: money(check.gap) })}</span>}
        </div>
      )}
    </section>
  );
}

type T = ReturnType<typeof useTranslations>;

function Card({ label, value, children, strong, tone }: { label: string; value: string; children?: React.ReactNode; strong?: boolean; tone?: "danger" }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2.5 ring-1 ring-foreground/5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-lg tabular-nums", strong ? "font-bold" : "font-semibold", tone === "danger" && "text-destructive")}>{value}</div>
      {children}
    </div>
  );
}

function Bucket({ label, b, t, dim, warn, children }: { label: string; b: ProductSalesBucket; t: T; dim?: boolean; warn?: boolean; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-md px-3 py-2.5 ring-1", warn ? "bg-warning ring-warning/40 text-warning-foreground" : "bg-muted/40 ring-foreground/5", dim && b.amount === 0 && "opacity-70")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{money(b.amount)}</div>
      <div className="flex justify-between text-xs opacity-80"><span>{t("base")}</span><span className="tabular-nums">{money(b.base)}</span></div>
      <div className="flex justify-between text-xs opacity-80"><span>{t("discount")}</span><span className="tabular-nums">{money(b.discount)}</span></div>
      <div className="flex justify-between text-xs opacity-80"><span>{t("taxShort")}</span><span className="tabular-nums">{money(b.tax)}</span></div>
      <div className="flex justify-between text-xs opacity-80"><span>{t("lines")}</span><span className="tabular-nums">{b.lines}</span></div>
      {children}
    </div>
  );
}
