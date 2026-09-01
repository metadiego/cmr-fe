"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Download04Icon, Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import {
  getReportePorGrupo,
  type ReportePorGrupo,
  type ReporteGrupoFila,
  type DivisionReporte,
} from "@/lib/api/facturacion-reportes";
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

// Date del navegador (permitido en cliente). Semana = lunes→hoy.
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const money = (v: number) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))}`;
const nint = (v: number) => new Intl.NumberFormat("en-US").format(Number(v ?? 0));
function titleCase(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

const TODAS = "__todas__";

export default function VentasPorGrupoPage() {
  const t = useTranslations("facturacion.ventasPorGrupo");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const centro = useSearchParams().get("centro") ?? undefined;

  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = React.useState(isoDay(primero));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  const [division, setDivision] = React.useState<string>(TODAS);
  // Query aplicada (se dispara al pulsar Buscar / atajo), separada de los inputs.
  const [query, setQuery] = React.useState<{ desde: string; hasta: string; contexto?: DivisionReporte }>(
    { desde: isoDay(primero), hasta: isoDay(hoy) },
  );

  const { state } = useResource<ReportePorGrupo>(
    () => getReportePorGrupo(query, centro),
    [query.desde, query.hasta, query.contexto, centro],
  );
  const data = state.kind === "ok" ? state.data : null;
  const grupos = data?.grupos ?? [];
  const maxNeto = React.useMemo(
    () => (data?.grupos ?? []).reduce((m, g) => Math.max(m, Math.abs(g.neto ?? 0)), 0),
    [data],
  );
  // Un megagrupo solo es "subtotal" útil si agrupa 2+ grupos; si cada grupo es su propio megagrupo
  // (1:1, el caso de hoy), las tarjetas y la etiqueta por fila serían ruido → se ocultan.
  const gruposPorMega = React.useMemo(() => {
    const m = new Map<string, number>();
    (data?.grupos ?? []).forEach((g) => { if (g.megagrupoClave) m.set(g.megagrupoClave, (m.get(g.megagrupoClave) ?? 0) + 1); });
    return m;
  }, [data]);
  const megasUtiles = (data?.megagrupos ?? []).filter((m) => (gruposPorMega.get(m.clave) ?? 0) > 1);

  function aplicar(d: string, h: string, div: string) {
    setDesde(d);
    setHasta(h);
    setDivision(div);
    setQuery({ desde: d, hasta: h, contexto: div === TODAS ? undefined : (div as DivisionReporte) });
  }
  function buscar() {
    aplicar(desde, hasta, division);
  }
  // Atajos de fecha.
  function atajo(tipo: "hoy" | "ayer" | "semana" | "mes") {
    const h = new Date();
    if (tipo === "hoy") return aplicar(isoDay(h), isoDay(h), division);
    if (tipo === "ayer") { const a = new Date(h); a.setDate(h.getDate() - 1); return aplicar(isoDay(a), isoDay(a), division); }
    if (tipo === "semana") { const lun = new Date(h); const dow = (h.getDay() + 6) % 7; lun.setDate(h.getDate() - dow); return aplicar(isoDay(lun), isoDay(h), division); }
    return aplicar(isoDay(new Date(h.getFullYear(), h.getMonth(), 1)), isoDay(h), division);
  }

  const rotulo = (g: { labelKey: string; clave: string }) => (tRoot.has(g.labelKey) ? tRoot(g.labelKey) : titleCase(g.clave));

  function exportarCsv() {
    if (!data) return;
    const head = [t("col.grupo"), t("col.facturado"), t("col.descuento"), t("col.devoluciones"), t("col.impuesto"), t("col.envio"), t("col.neto"), t("col.facturas")];
    const lines = [head.join(",")];
    grupos.forEach((g) => lines.push([csv(rotulo(g)), g.facturado, g.descuento, g.devoluciones, g.impuesto, g.envio, g.neto, g.facturas].join(",")));
    const to = data.totales;
    lines.push([csv(t("totales")), to.facturado, to.descuento, to.devoluciones, to.impuesto, to.envio, to.neto, ""].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-por-grupo_${query.desde}_${query.hasta}.csv`;
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
            <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!data || grupos.length === 0}>
              <HugeiconsIcon icon={Download04Icon} className="size-4" /> {t("exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!data}>
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
          <span className="text-xs font-medium text-muted-foreground">{t("division")}</span>
          {/* Consulta y General son divisiones distintas y NO se mezclan en la lectura del negocio. */}
          <Select value={division} onValueChange={(v) => aplicar(desde, hasta, v)}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>{t("div.todas")}</SelectItem>
              <SelectItem value="general">{t("div.general")}</SelectItem>
              <SelectItem value="consulta">{t("div.consulta")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button onClick={buscar} className="h-9">{t("search")}</Button>
        <div className="flex items-end gap-1.5">
          {(["hoy", "ayer", "semana", "mes"] as const).map((k) => (
            <Button key={k} variant="ghost" size="sm" className="h-9 text-xs" onClick={() => atajo(k)}>{t(`atajo.${k}`)}</Button>
          ))}
        </div>
      </div>

      {state.kind === "loading" && <p className="mt-6 text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {data && (
        <>
          {/* CUADRE: la garantía de que el reporte se puede creer. */}
          <div className="mt-6">
            {data.cuadre.cuadra ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                {t("cuadra", { total: money(data.cuadre.totalFacturas) })}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                <HugeiconsIcon icon={Alert02Icon} className="size-4" />
                {t("noCuadra", { diferencia: money(data.cuadre.diferencia) })}
              </div>
            )}
          </div>

          {/* Subtotales por MEGAGRUPO (del BE, sin recalcular). Solo si agrupan 2+ grupos. */}
          {megasUtiles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {megasUtiles.map((m) => (
                <div key={m.clave} className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] px-3 py-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {tRoot.has(`fac.megagrupo.${m.clave}`) ? tRoot(`fac.megagrupo.${m.clave}`) : titleCase(m.clave)}
                  </div>
                  <div className="text-lg font-bold tabular-nums">{money(m.neto)}</div>
                  <div className="text-[11px] text-muted-foreground">{t("nFacturas", { n: nint(m.facturas) })}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla por grupo (orden del BE: neto desc). Neto es la columna protagonista. */}
          <div className="mt-4 overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("col.grupo")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.facturado")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.descuento")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.devoluciones")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.impuesto")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.envio")}</th>
                  <th className="px-3 py-2 text-right font-semibold text-foreground">{t("col.neto")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.facturas")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {grupos.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
                )}
                {grupos.map((g) => {
                  // Etiqueta de megagrupo por fila solo cuando agrupa 2+ (si es 1:1 con su clave, es ruido).
                  const megaUtil = !!g.megagrupoClave && g.megagrupoClave !== g.clave && (gruposPorMega.get(g.megagrupoClave) ?? 0) > 1;
                  const mega = megaUtil ? (tRoot.has(`fac.megagrupo.${g.megagrupoClave}`) ? tRoot(`fac.megagrupo.${g.megagrupoClave}`) : titleCase(g.megagrupoClave!)) : null;
                  return <GrupoRow key={g.clave} g={g} rotulo={rotulo(g)} maxNeto={maxNeto} sinClasLabel={t("sinClasificarTip")} mega={mega} />;
                })}
              </tbody>
              {grupos.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-3 py-2">{t("totales")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totales.facturado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totales.descuento)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totales.devoluciones)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totales.impuesto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totales.envio)}</td>
                    <td className="px-3 py-2 text-right text-base tabular-nums">{money(data.totales.neto)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function GrupoRow({ g, rotulo, maxNeto, sinClasLabel, mega }: { g: ReporteGrupoFila; rotulo: string; maxNeto: number; sinClasLabel: string; mega: string | null }) {
  const esSinClas = g.clave === "sin_clasificar";
  const pct = maxNeto > 0 ? Math.max(2, Math.round((Math.abs(g.neto) / maxNeto) * 100)) : 0;
  return (
    <tr className={"hover:bg-muted/30 " + (esSinClas ? "bg-warning" : "")}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {esSinClas && (
            <span title={sinClasLabel} className="text-warning-foreground">
              <HugeiconsIcon icon={Alert02Icon} className="size-4" />
            </span>
          )}
          <span className={"font-medium " + (esSinClas ? "text-warning-foreground" : "")}>{rotulo}</span>
          {mega && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{mega}</span>}
        </div>
        {/* Barra proporcional al neto: de un vistazo, qué se mueve. */}
        <div className="mt-1 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-muted">
          <div className={"h-full rounded-full " + (esSinClas ? "bg-warning-foreground" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(g.facturado)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(g.descuento)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(g.devoluciones)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(g.impuesto)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(g.envio)}</td>
      <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{money(g.neto)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(g.facturas)}</td>
    </tr>
  );
}

function csv(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
