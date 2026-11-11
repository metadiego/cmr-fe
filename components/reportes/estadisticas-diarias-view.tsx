"use client";

import * as React from "react";
import { revenueLines, showReturned } from "@/lib/estadisticas/daily-revenue";
import { dailyRowShowsUnits } from "@/lib/estadisticas/services";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, WhatsappIcon, Mail01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { getEstadisticasDiarias, type EstadisticasDiarias } from "@/lib/api/estadisticas";
import { getServicios } from "@/lib/api/servicios";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { CentroPicker } from "@/components/facturacion/centro-picker";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const REVENUE_LABEL = { gross: "ingresoBruto", refunds: "devoluciones", net: "ingresoNeto" } as const;
const nf = new Intl.NumberFormat("en-US");
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtFecha(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// CSS de la ventana de impresión/envío: NO la tabla ancha de pantalla (fea), sino un RECIBO angosto,
// centrado y elegante (como una factura, un poco más ancho): columna ~108mm, líneas finas en vez de
// rejilla, encabezado centrado, ingreso con regla. Tinta negra. Se aplica sobre el mismo markup (clases
// .card/.blk/.am/.ingreso/th.r/td.r/.fecha) que ya trae la tarjeta.
const PRINT_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:16mm}
body{font-family:"Helvetica Neue",system-ui,-apple-system,Arial,sans-serif;color:#111;background:#fff;margin:0;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.card{width:108mm;max-width:100%;margin:0 auto 14mm;border:1px solid #e4e4e4;border-radius:10px;padding:20px 22px;page-break-inside:avoid}
.text-center{text-align:center}
h2{font-size:16px;font-weight:700;letter-spacing:.01em;margin:0 0 2px}
.fecha{font-size:12px;color:#777;margin-bottom:14px}
.blk{margin:14px 0}
.blk h3{font-size:9.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#9a9a9a;margin:0 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}
.am{display:flex;gap:16px;font-size:13px}
.am .ml-auto{margin-left:auto;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:12px}
th{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#9a9a9a;text-align:left;padding:0 0 5px}
td{padding:5px 0;border-top:1px solid #f2f2f2}
th.r,td.r,.text-right{text-align:right}
.font-medium{font-weight:500}.font-semibold{font-weight:600}.tabular-nums{font-variant-numeric:tabular-nums}
.ingreso{display:flex;justify-content:space-between;align-items:baseline;margin-top:16px;border-top:2px solid #111;padding-top:9px;font-weight:700;font-size:15px}
`;

// Cierre diario del gerente: UNA sola tarjeta, la del centro activo de la pantalla (mismo patrón
// que Facturas/Devoluciones/Cuadre de caja — useCentroGate + CentroPicker si hace falta elegir),
// independiente de Facturación general/consulta (suma ambas divisiones). Vive como pestaña de
// Facturación general (components/facturacion/facturacion-con-tabs.tsx) desde 09-oct-2026,
// extraído de lo que era app/(app)/reports/daily/page.tsx. Antes apilaba una tarjeta por cada
// centro permitido; se corrigió a pedido del dueño (09-oct-2026) para que sea consistente con las
// otras pestañas.
export function EstadisticasDiariasView() {
  const t = useTranslations("estadisticasDiarias");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const gate = useCentroGate();
  const printRef = React.useRef<HTMLDivElement>(null);

  const hoy = isoDay(new Date());
  const [desde, setDesde] = React.useState(hoy);
  const [hasta, setHasta] = React.useState(hoy);
  const [query, setQuery] = React.useState({ desde: hoy, hasta: hoy });
  // «Devueltos» per service: hidden by default (owner, 11-nov: it can confuse), kept as a view option —
  // remembered in this browser only. The money block (bruto / devoluciones / neto) always shows.
  const [verDevueltos, setVerDevueltos] = React.useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("cmr.dailyStats.showReturned") === "1";
    } catch {
      return false;
    }
  });
  function toggleDevueltos(v: boolean) {
    setVerDevueltos(v);
    try {
      window.localStorage.setItem("cmr.dailyStats.showReturned", v ? "1" : "0");
    } catch {
      /* storage blocked: the choice lasts this visit */
    }
  }

  const res = useResource<EstadisticasDiarias | null>(
    () => (gate.centro ? getEstadisticasDiarias(query.desde, query.hasta || undefined, gate.centro) : Promise.resolve(null)),
    [query.desde, query.hasta, gate.centro],
  );
  const data = res.state.kind === "ok" ? res.state.data : null;
  const cargando = res.state.kind === "loading";

  // Qué servicios declaran su propia unidad (owner's call, 11-nov: por configuración, NUNCA por
  // nombre — ver lib/estadisticas/services.ts). Catálogo del centro activo, no del rango elegido.
  const serviciosRes = useResource<ReadonlySet<string>>(
    () =>
      gate.centro
        ? getServicios(gate.centro).then((ss) => new Set(ss.filter((s) => s.statisticsUnitKey).map((s) => s.slug)))
        : Promise.resolve(new Set<string>()),
    [gate.centro],
  );
  const serviciosData = serviciosRes.state.kind === "ok" ? serviciosRes.state.data : null;
  const slugsConUnidad = React.useMemo(() => serviciosData ?? new Set<string>(), [serviciosData]);

  const rangoLabel = query.hasta && query.hasta !== query.desde ? `${fmtFecha(query.desde)} – ${fmtFecha(query.hasta)}` : fmtFecha(query.desde);

  // Reporte en TEXTO PLANO (para WhatsApp/Correo/Copiar): se lee en el móvil sin abrir nada.
  const texto = React.useMemo(() => {
    if (!data) return "";
    const vacio = data.medicalCare.total === 0 && data.services.length === 0 && !data.grossRevenue && !data.refunds;
    const lineas = [`C.M.R. — ${gate.centroNombre}    ${rangoLabel}`, ""];
    if (vacio) { lineas.push(t("sinActividad")); return lineas.join("\n"); }
    lineas.push(`${t("atencionMedica")}   ${t("nuevos")}: ${data.medicalCare.newCount}   ${t("seguimiento")}: ${data.medicalCare.followUpCount}   ${t("total")} ${data.medicalCare.total}`, "");
    if (data.services.length) {
      lineas.push(`${t("servicios")}   (${t("col.aplicados")} / ${t("col.vendidos")})`);
      data.services.forEach((s) => {
        const aplicado = dailyRowShowsUnits(s.slug, slugsConUnidad)
          ? t("col.aplicadosUnidades", { visits: s.visits, therapies: s.therapies })
          : String(s.therapies);
        lineas.push(`  ${s.name}: ${aplicado} / ${s.sold}`);
      });
      lineas.push("");
    }
    revenueLines(data).forEach((l) => lineas.push(`${t(REVENUE_LABEL[l.key])}   ${money.format(l.amount)}`));
    return lineas.join("\n");
  }, [data, gate.centroNombre, rangoLabel, t, slugsConUnidad]);

  function imprimir() {
    const el = printRef.current;
    if (!el || typeof window === "undefined") return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t("title")} ${rangoLabel}</title><style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    const go = () => w.print();
    if (w.document.readyState === "complete") go(); else w.onload = go;
  }
  function whatsapp() {
    if (!texto) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }
  function correo() {
    if (!texto) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(`${t("title")} — ${rangoLabel}`)}&body=${encodeURIComponent(texto)}`;
  }
  async function copiar() {
    if (!texto) return;
    try { await navigator.clipboard.writeText(texto); toast.success(t("copiado")); } catch { /* portapapeles bloqueado */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">{t("help")}</p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={imprimir} disabled={!data}><HugeiconsIcon icon={PrinterIcon} className="size-4" /> {tc("print")}</Button>
          <Button variant="outline" size="sm" onClick={whatsapp} disabled={!texto}><HugeiconsIcon icon={WhatsappIcon} className="size-4" /> {t("whatsapp")}</Button>
          <Button variant="outline" size="sm" onClick={correo} disabled={!texto}><HugeiconsIcon icon={Mail01Icon} className="size-4" /> {t("correo")}</Button>
          <Button variant="outline" size="sm" onClick={copiar} disabled={!texto}><HugeiconsIcon icon={Copy01Icon} className="size-4" /> {t("copiar")}</Button>
        </div>
      </div>

      {/* Rango + Generar */}
      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 no-print">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
          <DatePicker value={desde} onChange={setDesde} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("to")}</span>
          <DatePicker value={hasta} min={desde} onChange={setHasta} className="h-9 w-[160px]" clearable />
        </label>
        <Button className="h-9" onClick={() => setQuery({ desde, hasta })}>{t("generar")}</Button>
        <label className="ml-auto flex h-9 items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={verDevueltos} onChange={(e) => toggleDevueltos(e.target.checked)} className="size-4" />
          {t("verDevueltos")}
        </label>
      </div>

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        <CentroPicker centros={gate.centros} onPick={gate.pick} />
      ) : (
        <>
          {cargando && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
          {res.state.kind === "fail" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{tc("error")}</p>
          )}
          {/* Región imprimible: una sola tarjeta, la del centro activo. */}
          {data && (
            <div ref={printRef} className="mx-auto max-w-3xl">
              <DiariaCard
                centro={gate.centroNombre}
                fecha={rangoLabel}
                data={data}
                t={t}
                verDevueltos={verDevueltos}
                slugsConUnidad={slugsConUnidad}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DiariaCard({
  centro,
  fecha,
  data,
  t,
  verDevueltos,
  slugsConUnidad,
}: {
  centro: string;
  fecha: string;
  data: EstadisticasDiarias;
  t: (k: string, values?: Record<string, string | number>) => string;
  verDevueltos: boolean;
  slugsConUnidad: ReadonlySet<string>;
}) {
  const devueltos = verDevueltos && showReturned(data);
  const vacio = data.medicalCare.total === 0 && data.services.length === 0 && !data.grossRevenue && !data.refunds;
  return (
    <div className="card rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <div className="text-center">
        <h2 className="text-xl font-bold">C.M.R. — {centro}</h2>
        <div className="fecha text-sm text-muted-foreground">{fecha}</div>
      </div>

      {vacio ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">{t("sinActividad")}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Atención médica */}
          <div className="blk">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("atencionMedica")}</h3>
            <div className="am flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span title={t("tip.nuevas")}><span className="font-semibold">{t("nuevos")}:</span> {nf.format(data.medicalCare.newCount)}</span>
              <span title={t("tip.seguimientos")}><span className="font-semibold">{t("seguimiento")}:</span> {nf.format(data.medicalCare.followUpCount)}</span>
              <span className="ml-auto font-semibold">{t("total")} {nf.format(data.medicalCare.total)}</span>
            </div>
          </div>

          {/* Servicios especializados */}
          {data.services.length > 0 && (
            <div className="blk">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("servicios")}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 pr-3 font-semibold">{t("col.servicio")}</th>
                    <th className="r px-3 py-1 text-right font-semibold" title={t("tip.aplicados")}>{t("col.aplicados")}</th>
                    <th className="r px-3 py-1 text-right font-semibold" title={t("tip.vendidos")}>{t("col.vendidos")}</th>
                    {devueltos && <th className="r px-3 py-1 text-right font-semibold" title={t("tip.devueltos")}>{t("col.devueltos")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.services.map((s) => (
                    <tr key={s.slug}>
                      <td className="py-1.5 pr-3 font-medium">{s.name}</td>
                      <td
                        className="r px-3 py-1.5 text-right tabular-nums"
                        title={dailyRowShowsUnits(s.slug, slugsConUnidad) ? t("tip.aplicadosUnidades") : undefined}
                      >
                        {dailyRowShowsUnits(s.slug, slugsConUnidad)
                          ? t("col.aplicadosUnidades", { visits: s.visits, therapies: s.therapies })
                          : nf.format(s.therapies)}
                      </td>
                      <td className="r px-3 py-1.5 text-right tabular-nums">{nf.format(s.sold)}</td>
                      {devueltos && <td className="r px-3 py-1.5 text-right tabular-nums">{nf.format(s.returned ?? 0)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ingreso bruto · Devoluciones (−) · Ingreso NETO, the headline (BE #541; = the day's cash count). */}
          <div className="ingreso space-y-1 border-t-2 border-foreground pt-3">
            {revenueLines(data).map((l) => (
              <div key={l.key} className={"flex items-center justify-between " + (l.headline ? "text-base font-bold" : "text-sm")}>
                <span>{t(REVENUE_LABEL[l.key])}</span>
                <span className={"tabular-nums " + (l.amount < 0 ? "text-destructive" : "")}>{money.format(l.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
