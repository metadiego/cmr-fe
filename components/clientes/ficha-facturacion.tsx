"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { listFacturas, type Factura } from "@/lib/api/facturas";
import type { Paginated } from "@/lib/api/types";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const res = useResource<Paginated<Factura>>(
    () => listFacturas({ patientId: pacienteId, page, limit: PAGE_SIZE }, centro),
    [pacienteId, centro, page],
  );

  if (res.state.kind === "loading") return <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;

  const { items, pagination } = res.state.data;
  const total = pagination?.total ?? items.length;
  const pages = Math.max(1, Math.ceil(total / (pagination?.limit || PAGE_SIZE)));
  const label = (key: string, fallback: string) => (tRoot.has(key) ? tRoot(key) : fallback);
  const day = (iso?: string | null) => {
    const d = parseDayUTC(iso);
    return d ? dayFmt.format(d) : "—";
  };

  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{t("noFacturas")}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("invoiceHistoryCount", { n: total })}</p>
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">{t("invoice")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("date")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("department")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("origin")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("status")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("total")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("collected")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((f) => {
              const href = `/billing/invoices/${f.id}${centro ? `?centro=${encodeURIComponent(centro)}` : ""}`;
              const ctx = (f as { context?: string | null }).context;
              return (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono">
                    <Link href={href} className="underline-offset-2 hover:underline">{f.number || "—"}</Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{day(f.date)}</td>
                  <td className="px-3 py-2">{ctx ? label(`caja.division.${ctx === "consulta" ? "consulta" : "general"}`, ctx) : "—"}</td>
                  <td className="px-3 py-2">
                    {f.legacyOrigin ? (
                      <Badge variant="outline">{t("legacy", { origin: label(`grupo.${f.legacyOrigin}`, f.legacyOrigin) })}</Badge>
                    ) : (
                      <span className="text-muted-foreground">{t("newSystem")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><Badge variant="secondary">{f.status}</Badge></td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{money.format(Number(f.total) || 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money.format(Number(f.paidAmount) || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prevPage")}</Button>
          <span className="tabular-nums text-muted-foreground">{t("pageOf", { page, pages })}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t("nextPage")}</Button>
        </div>
      )}
    </div>
  );
}
