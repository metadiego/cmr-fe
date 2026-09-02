"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Download04Icon } from "@hugeicons/core-free-icons";

import { getReportePorUsuario, type ReporteUsuarioFila, type DivisionReporte } from "@/lib/api/facturacion-reportes";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/ui/page";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const money = (v: number) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))}`;

const TODAS = "__todas__";

export default function VentasPorUsuarioPage() {
  const t = useTranslations("facturacion.ventasPorUsuario");
  const tc = useTranslations("common");
  const centro = useSearchParams().get("centro") ?? undefined;

  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = React.useState(isoDay(primero));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  const [division, setDivision] = React.useState<string>(TODAS);
  const [query, setQuery] = React.useState<{ desde: string; hasta: string; contexto?: DivisionReporte }>({ desde: isoDay(primero), hasta: isoDay(hoy) });

  const { state } = useResource<ReporteUsuarioFila[]>(
    () => getReportePorUsuario(query, centro),
    [query.desde, query.hasta, query.contexto, centro],
  );
  const rows = state.kind === "ok" ? state.data : [];
  // El BE ya ordena; el total del período se suma solo para la barra proporcional y el pie.
  const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const maxTotal = rows.reduce((m, r) => Math.max(m, Math.abs(r.total ?? 0)), 0);

  function aplicar(d: string, h: string, div: string) {
    setDesde(d); setHasta(h); setDivision(div);
    setQuery({ desde: d, hasta: h, contexto: div === TODAS ? undefined : (div as DivisionReporte) });
  }
  function atajo(tipo: "hoy" | "ayer" | "semana" | "mes") {
    const h = new Date();
    if (tipo === "hoy") return aplicar(isoDay(h), isoDay(h), division);
    if (tipo === "ayer") { const a = new Date(h); a.setDate(h.getDate() - 1); return aplicar(isoDay(a), isoDay(a), division); }
    if (tipo === "semana") { const l = new Date(h); l.setDate(h.getDate() - ((h.getDay() + 6) % 7)); return aplicar(isoDay(l), isoDay(h), division); }
    return aplicar(isoDay(new Date(h.getFullYear(), h.getMonth(), 1)), isoDay(h), division);
  }

  const nombreDe = (r: ReporteUsuarioFila) => r.nombre ?? t("sinUsuario");

  function exportarCsv() {
    const lines = [[t("col.usuario"), t("col.total")].join(",")];
    rows.forEach((r) => lines.push([csv(nombreDe(r)), r.total].join(",")));
    lines.push([csv(t("totales")), total].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ventas-por-usuario_${query.desde}_${query.hasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={exportarCsv} disabled={rows.length === 0}>
              <HugeiconsIcon icon={Download04Icon} className="size-4" /> {t("exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" /> {tc("print")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4 no-print">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("to")}</span>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("division")}</span>
          <Select value={division} onValueChange={(v) => aplicar(desde, hasta, v)}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>{t("div.todas")}</SelectItem>
              <SelectItem value="general">{t("div.general")}</SelectItem>
              <SelectItem value="consulta">{t("div.consulta")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button onClick={() => aplicar(desde, hasta, division)} className="h-9">{t("search")}</Button>
        <div className="flex items-end gap-1.5">
          {(["hoy", "ayer", "semana", "mes"] as const).map((k) => (
            <Button key={k} variant="ghost" size="sm" className="h-9 text-xs" onClick={() => atajo(k)}>{t(`atajo.${k}`)}</Button>
          ))}
        </div>
      </div>

      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {state.kind === "ok" && (
        <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">{t("col.usuario")}</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">{t("col.total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
              )}
              {rows.map((r, i) => {
                const sinUsuario = r.usuarioId == null;
                const pct = maxTotal > 0 ? Math.max(2, Math.round((Math.abs(r.total) / maxTotal) * 100)) : 0;
                return (
                  <tr key={r.usuarioId ?? `__sin__${i}`} className={"hover:bg-muted/30 " + (sinUsuario ? "bg-warning" : "")}>
                    <td className="px-3 py-2">
                      <span className={"font-medium " + (sinUsuario ? "text-warning-foreground" : "")}>{nombreDe(r)}</span>
                      <div className="mt-1 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-muted">
                        <div className={"h-full rounded-full " + (sinUsuario ? "bg-warning-foreground" : "bg-primary")} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{money(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="px-3 py-2">{t("totales")}</td>
                  <td className="px-3 py-2 text-right text-base tabular-nums">{money(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </PageContainer>
  );
}

function csv(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
