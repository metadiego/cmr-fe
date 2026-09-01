"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Download04Icon } from "@hugeicons/core-free-icons";

import { getEstadisticasServicios, type EstadisticasServicios, type EstServicio } from "@/lib/api/estadisticas";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useMe } from "@/hooks/use-me";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/ui/page";

const EMPTY: EstadisticasServicios = {
  totales: { sesiones: 0, pacientes: 0, participaciones: 0, serviciosActivos: 0 },
  general: [],
  servicios: [],
};

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const nf = new Intl.NumberFormat("en-US");
const pf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${pf.format(n)}%`;

// CSS autocontenido de la ventana de impresión (no hereda Tailwind): membrete + tablas + pie, tamaño carta.
// `.no-print` esconde controles/pestañas; `.solo-print` muestra membrete/pie; `[hidden]` (pestañas Radix
// inactivas) no imprime → sale solo la vista activa. Reusa el espíritu de los formatos de terapia.
const PRINT_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:12mm}
body{font-family:system-ui,-apple-system,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.no-print{display:none!important}
.solo-print{display:block!important}
[hidden]{display:none!important}
h1{font-size:16px;margin:0}h2{font-size:13px;margin:10px 0 2px}h3{font-size:12px;margin:8px 0 2px}
img{height:40px;width:auto;object-fit:contain}
table{width:100%;border-collapse:collapse;font-size:9.5px;margin-top:4px}
th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}
th{background:#f2f2f2}
.membrete{text-align:center;margin-bottom:6px}
.stats{margin:6px 0;font-size:10px}
.stats span{display:inline-block;border:1px solid #bbb;border-radius:4px;padding:3px 8px;margin-right:6px}
.muted{color:#777}.italic{font-style:italic}.right{text-align:right}.bold{font-weight:700}
.pie{margin-top:14px;font-size:9px;color:#555;text-align:left}
.rol-cab{margin-top:8px;font-weight:700}
`;

// Imprime el reporte en una ventana propia (escapa del shell de la app). Clona el nodo del reporte.
function imprimirReporte(el: HTMLElement | null, titulo: string) {
  if (!el || typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=1000,height=1200");
  if (!w) return; // popup bloqueado
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`,
  );
  w.document.close();
  w.focus();
  const go = () => w.print();
  if (w.document.readyState === "complete") go();
  else w.onload = go;
}

export default function EstadisticasServiciosPage() {
  const t = useTranslations("estadisticasServicios");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const gate = useCentroGate();
  const me = useMe();
  const printRef = React.useRef<HTMLDivElement>(null);

  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = React.useState(isoDay(primero));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  // Query "aplicada" (se dispara con Generar), separada de los inputs.
  const [query, setQuery] = React.useState({ desde: isoDay(primero), hasta: isoDay(hoy) });
  const [tab, setTab] = React.useState("general");

  const res = useResource<EstadisticasServicios>(
    () => (gate.centro ? getEstadisticasServicios(query.desde, query.hasta, gate.centro) : Promise.resolve(EMPTY)),
    [query.desde, query.hasta, gate.centro],
  );
  const data = res.state.kind === "ok" ? res.state.data : null;
  const cargando = res.state.kind === "loading";

  // Servicios con actividad = pestañas (y columnas de la matriz GENERAL).
  const serviciosActivos = React.useMemo(
    () => (data?.servicios ?? []).filter((s) => (s.sesiones ?? 0) > 0),
    [data],
  );
  // Pestaña efectiva derivada (sin efecto): si la elegida ya no existe (cambió el rango), cae a GENERAL.
  const tabEfectivo = tab === "general" || serviciosActivos.some((s) => s.clave === tab) ? tab : "general";

  const centroNombre = gate.centros.find((c) => c.id === gate.centro)?.nombre ?? "";
  const emailImpresor = me.kind === "ok" ? (me.me.email ?? "") : "";

  function exportarCsv() {
    if (!data) return;
    const cols = serviciosActivos;
    const head = [t("colNombre"), ...cols.map((c) => c.nombre), t("colTotal")];
    const lines = [head.map(csv).join(",")];
    for (const f of data.general) {
      lines.push([csv(f.nombre), ...cols.map((c) => f.porServicio[c.clave] ?? 0), f.total].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estadisticas-servicios_${query.desde}_${query.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer>
      {/* Título + acciones */}
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!data || data.general.length === 0}>
              <HugeiconsIcon icon={Download04Icon} className="size-4" /> {t("exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => imprimirReporte(printRef.current, t("title"))} disabled={!data}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" /> {tc("print")}
            </Button>
          </>
        }
      />

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        <div className="max-w-xl"><CentroPicker centros={gate.centros} onPick={gate.pick} /></div>
      ) : (
        <>
          {/* Filtros de rango */}
          <div className="flex flex-wrap items-end gap-3 rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 no-print">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-[160px]" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("to")}</span>
              <Input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className="h-9 w-[160px]" />
            </label>
            <Button className="h-9" onClick={() => setQuery({ desde, hasta })}>{t("generate")}</Button>
            {gate.puedeCambiar && gate.centro && gate.centros.length > 1 && (
              <div className="ml-auto text-sm text-muted-foreground">{centroNombre}</div>
            )}
          </div>

          {/* Región imprimible: membrete (solo print) + totales + pestañas */}
          <div ref={printRef}>
            {/* Membrete solo para impresión */}
            <div className="solo-print membrete">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/logo_cmr.png" alt="" />
              <div className="bold">{t("empresa")}</div>
              {centroNombre && <div>{centroNombre}</div>}
              <h1>{t("title")}</h1>
              <div className="muted">{query.desde} — {query.hasta}</div>
            </div>

            {cargando && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
            {res.state.kind === "fail" && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {res.state.message}
              </p>
            )}

            {data && !cargando && (
              <>
                {/* Totales del periodo */}
                <div className="stats grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label={t("totSesiones")} value={nf.format(data.totales.sesiones)} />
                  <StatCard label={t("totPacientes")} value={nf.format(data.totales.pacientes)} />
                  <StatCard label={t("totParticipaciones")} value={nf.format(data.totales.participaciones)} />
                  <StatCard label={t("totServicios")} value={nf.format(data.totales.serviciosActivos)} />
                </div>

                <Tabs value={tabEfectivo} onValueChange={setTab} className="mt-6">
                  <TabsList className="no-print max-w-full flex-wrap justify-start overflow-x-auto">
                    <TabsTrigger value="general">{t("general")}</TabsTrigger>
                    {serviciosActivos.map((s) => (
                      <TabsTrigger key={s.clave} value={s.clave}>{s.nombre}</TabsTrigger>
                    ))}
                  </TabsList>

                  {/* GENERAL: matriz personal × servicio */}
                  <TabsContent value="general" className="mt-4">
                    {data.general.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("sinDatos")}</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md bg-card shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/60">
                            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-2 font-semibold">{t("colNombre")}</th>
                              {serviciosActivos.map((s) => (
                                <th key={s.clave} className="whitespace-nowrap px-3 py-2 text-right font-semibold" title={s.nombre}>{s.nombre}</th>
                              ))}
                              <th className="px-3 py-2 text-right font-semibold">{t("colTotal")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {data.general.map((f, i) => {
                              const sinAsignar = f.personalId == null;
                              return (
                                <tr key={f.personalId ?? `s-${i}`} className="hover:bg-muted/30">
                                  <td className={"sticky left-0 z-10 bg-background px-3 py-2 font-medium " + (sinAsignar ? "italic text-muted-foreground" : "")}>{f.nombre}</td>
                                  {serviciosActivos.map((s) => {
                                    const v = f.porServicio[s.clave] ?? 0;
                                    return <td key={s.clave} className={"px-3 py-2 text-right tabular-nums " + (v === 0 ? "text-muted-foreground/40" : "")}>{v}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-bold tabular-nums">{f.total}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  {/* Una pestaña por servicio */}
                  {serviciosActivos.map((s) => (
                    <TabsContent key={s.clave} value={s.clave} className="mt-4">
                      <ServicioPanel servicio={s} />
                    </TabsContent>
                  ))}
                </Tabs>
              </>
            )}

            {/* Pie solo para impresión */}
            {data && (
              <div className="solo-print pie">
                {t("impresoPor")}: {emailImpresor || "—"} · {new Date().toLocaleString()}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-card px-4 py-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

// Panel de un servicio: resumen + un bloque por rol (cabecera con el divisor de %) con su tabla.
function ServicioPanel({ servicio }: { servicio: EstServicio }) {
  const t = useTranslations("estadisticasServicios");
  return (
    <div className="space-y-5">
      <div className="rounded-md bg-card px-4 py-2 text-sm shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
        <span className="font-semibold">{servicio.nombre}</span>
        <span className="ml-2 text-muted-foreground">
          {t("resumenServicio", { sesiones: servicio.sesiones, participaciones: servicio.participaciones, pacientes: servicio.pacientes })}
        </span>
      </div>

      {servicio.roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("sinRoles")}</p>
      ) : (
        servicio.roles.map((r) => (
          <section key={r.rol} className="region">
            <h3 className="rol-cab mb-1.5 text-sm font-bold">
              {t.has(`rol.${r.rol}`) ? t(`rol.${r.rol}`) : capitalizar(r.rol)}
              <span className="ml-2 font-normal text-muted-foreground">· {t("participacionesDivisor", { n: r.participaciones })}</span>
            </h3>
            <div className="overflow-x-auto rounded-md bg-card shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">{t("colNombre")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("colParticipaciones")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("colPacientes")}</th>
                    <th className="px-3 py-2 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.filas.map((f) => {
                    const sinAsignar = f.personalId == null;
                    return (
                      <tr key={f.personalId ?? `${r.rol}-${f.posicion}`} className="hover:bg-muted/30">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.posicion}</td>
                        <td className={"px-3 py-2 font-medium " + (sinAsignar ? "italic text-muted-foreground" : "")}>{f.nombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.participaciones}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.pacientes}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(f.porcentaje)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function capitalizar(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function csv(v: string | number) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
