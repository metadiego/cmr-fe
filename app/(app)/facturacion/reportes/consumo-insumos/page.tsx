"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Download04Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { getConsumoInsumos, type ConsumoInsumo, type EstimadoFiltro } from "@/lib/api/facturacion-reportes";
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
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Fechas por defecto: del 1° del mes a hoy (Date del navegador; permitido en cliente).
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const num = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

export default function ConsumoInsumosPage() {
  const t = useTranslations("inventario.consumoReporte");
  const tc = useTranslations("common");
  const centro = useSearchParams().get("centro") ?? undefined;

  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = React.useState(isoDay(primero));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  const [estimado, setEstimado] = React.useState<EstimadoFiltro>("true");
  // La query "aplicada" (se dispara al pulsar Buscar), separada de los inputs.
  const [query, setQuery] = React.useState({ desde: isoDay(primero), hasta: isoDay(hoy), estimado: "true" as EstimadoFiltro });

  const { state } = useResource<ConsumoInsumo[]>(
    () => getConsumoInsumos(query, centro),
    [query.desde, query.hasta, query.estimado, centro],
  );
  const rows = state.kind === "ok" ? state.data : [];
  const totalUnidades = rows.reduce((s, r) => s + (r.cantidad ?? 0), 0);
  const totalFacturas = rows.reduce((s, r) => s + (r.facturas ?? 0), 0);

  const [open, setOpen] = React.useState<Set<string>>(new Set());
  function toggle(id: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function buscar() {
    setQuery({ desde, hasta, estimado });
  }

  function exportarCsv() {
    const head = [t("col.insumo"), t("col.cantidad"), t("col.facturas"), t("col.terapia")];
    const lines = [head.join(",")];
    rows.forEach((r) => {
      if (r.porTerapia?.length) {
        r.porTerapia.forEach((pt) => lines.push([csv(r.insumo), r.cantidad, r.facturas, csv(pt.terapia) + `=${pt.cantidad}`].join(",")));
      } else {
        lines.push([csv(r.insumo), r.cantidad, r.facturas, ""].join(","));
      }
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consumo-insumos_${query.desde}_${query.hasta}.csv`;
    a.click();
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

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4 no-print">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("to")}</span>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("tipo")}</span>
          <Select value={estimado} onValueChange={(v) => setEstimado(v as EstimadoFiltro)}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("estimadoTrue")}</SelectItem>
              <SelectItem value="false">{t("estimadoFalse")}</SelectItem>
              <SelectItem value="all">{t("estimadoAll")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button onClick={buscar} className="h-9">{t("search")}</Button>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Kpi label={t("kpi.insumos")} value={num(rows.length)} />
        <Kpi label={t("kpi.unidades")} value={num(totalUnidades)} />
        <Kpi label={t("kpi.facturas")} value={num(totalFacturas)} />
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.insumo")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("col.cantidad")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("col.facturas")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "fail" && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-destructive">{tc("error")}</td></tr>
            )}
            {state.kind === "ok" && rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr>
            )}
            {rows.map((r) => {
              const isOpen = open.has(r.insumoId);
              const tieneTerapias = (r.porTerapia?.length ?? 0) > 0;
              return (
                <React.Fragment key={r.insumoId}>
                  <tr className={cn("hover:bg-muted/30", tieneTerapias && "cursor-pointer")} onClick={() => tieneTerapias && toggle(r.insumoId)}>
                    <td className="px-3 py-2 font-medium">{r.insumo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(r.cantidad)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{num(r.facturas)}</td>
                    <td className="px-3 py-2 text-right">
                      {tieneTerapias && (
                        <HugeiconsIcon icon={ArrowRight01Icon} className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                      )}
                    </td>
                  </tr>
                  {isOpen && r.porTerapia.map((pt) => (
                    <tr key={r.insumoId + pt.terapiaId} className="bg-muted/20 text-xs">
                      <td className="px-3 py-1.5 pl-8 text-muted-foreground">{pt.terapia}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{num(pt.cantidad)}</td>
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5" />
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{t("footnote")}</p>
    </PageContainer>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] bg-gradient-to-br from-primary/5 to-transparent px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function csv(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
