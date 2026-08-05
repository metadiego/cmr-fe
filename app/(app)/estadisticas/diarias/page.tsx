"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, WhatsappIcon, Mail01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { getEstadisticasDiarias, type EstadisticasDiarias } from "@/lib/api/estadisticas";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const nf = new Intl.NumberFormat("en-US");
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtFecha(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// CSS de la ventana de impresión/envío. Diseño PREMIUM tipo membrete-recibo: logo, título serif, regla de
// acento (indigo sobrio), la atención médica como tres estadísticas centradas con divisores, tabla de
// líneas finas y el INGRESO como total protagonista. Se aplica sobre el mismo markup de la tarjeta
// (.card/.blk/.am/.ingreso/th.r/td.r/.fecha/.logo/.solo-print). print-color-adjust:exact para que el
// acento no salga lavado.
//
// BACKUP del diseño "recibo simple" anterior (por si el dueño prefiere volver; también en git commit 5db1514):
//   .card{width:108mm;border:1px solid #e4e4e4;border-radius:10px;padding:20px 22px}
//   h2{font-size:16px} .blk h3{color:#9a9a9a;border-bottom:1px solid #eee} .am{gap:16px} .am .ml-auto{margin-left:auto}
//   .ingreso{border-top:2px solid #111;font-size:15px}
const PRINT_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:16mm}
body{font-family:"Helvetica Neue",system-ui,-apple-system,Arial,sans-serif;color:#1a1a1a;background:#fff;margin:0;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.card{width:114mm;max-width:100%;margin:0 auto 16mm;border:1px solid #e7e7ea;border-radius:14px;padding:26px 28px 22px;page-break-inside:avoid;box-shadow:none}
.solo-print{display:block}
.logo{display:block;height:44px;width:auto;object-fit:contain;margin:0 auto 10px}
.text-center{text-align:center;padding-bottom:14px;border-bottom:2px solid #3b3b6d}
h2{font-family:Georgia,"Times New Roman",serif;font-size:18px;font-weight:700;letter-spacing:.01em;margin:0 0 4px}
.fecha{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9a9aa5;margin:0}
.blk{margin:18px 0}
.blk h3{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#3b3b6d;margin:0 0 9px}
.am{display:flex;font-size:12px}
.am>span{flex:1;text-align:center;padding:2px 6px;border-left:1px solid #eee}
.am>span:first-child{border-left:none}
.am .ml-auto{margin-left:0;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:12px}
th{font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9a9aa5;text-align:left;padding:0 0 7px;border-bottom:1px solid #ededf0}
td{padding:6px 0;border-bottom:1px solid #f4f4f6}
th.r,td.r,.text-right{text-align:right}
.font-medium{font-weight:500}.font-semibold{font-weight:600}.tabular-nums{font-variant-numeric:tabular-nums}
.ingreso{display:flex;justify-content:space-between;align-items:baseline;margin-top:20px;border-top:1px solid #3b3b6d;padding-top:12px}
.ingreso>span:first-child{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#3b3b6d}
.ingreso>span:last-child{font-size:20px;font-weight:800;color:#1a1a1a}
`;

export default function EstadisticasDiariasPage() {
  const t = useTranslations("estadisticasDiarias");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const gate = useCentroGate();
  const printRef = React.useRef<HTMLDivElement>(null);

  const hoy = isoDay(new Date());
  const [desde, setDesde] = React.useState(hoy);
  const [hasta, setHasta] = React.useState(hoy);
  const [query, setQuery] = React.useState({ desde: hoy, hasta: hoy });

  const centros = gate.centros;
  const centrosKey = centros.map((c) => c.id).join(",");
  // Una tarjeta por centro que el usuario puede ver (gerente = 1; admin supervisor = varias, apiladas).
  const res = useResource<{ centroId: string; centroNombre: string; data: EstadisticasDiarias }[]>(
    () =>
      centros.length
        ? Promise.all(
            centros.map((c) =>
              getEstadisticasDiarias(query.desde, query.hasta || undefined, c.id).then((data) => ({
                centroId: c.id,
                centroNombre: c.nombre,
                data,
              })),
            ),
          )
        : Promise.resolve([]),
    [query.desde, query.hasta, centrosKey],
  );
  const cards = React.useMemo(() => (res.state.kind === "ok" ? res.state.data : []), [res.state]);
  const cargando = res.state.kind === "loading";

  const rangoLabel = query.hasta && query.hasta !== query.desde ? `${fmtFecha(query.desde)} – ${fmtFecha(query.hasta)}` : fmtFecha(query.desde);

  // Reporte en TEXTO PLANO (para WhatsApp/Correo/Copiar): se lee en el móvil sin abrir nada.
  const texto = React.useMemo(() => {
    if (!cards.length) return "";
    return cards
      .map((c) => {
        const d = c.data;
        const vacio = d.atencionMedica.total === 0 && d.servicios.length === 0 && !d.ingresoBruto;
        const lineas = [`C.M.R. — ${c.centroNombre}    ${rangoLabel}`, ""];
        if (vacio) { lineas.push(t("sinActividad")); return lineas.join("\n"); }
        lineas.push(`${t("atencionMedica")}   N: ${d.atencionMedica.nuevas}   S: ${d.atencionMedica.seguimientos}   ${t("total")} ${d.atencionMedica.total}`, "");
        if (d.servicios.length) {
          lineas.push(`${t("servicios")}   (${t("col.aplicados")} / ${t("col.vendidos")})`);
          d.servicios.forEach((s) => lineas.push(`  ${s.nombre}: ${s.aplicados} / ${s.vendidos}`));
          lineas.push("");
        }
        lineas.push(`${t("ingresoBruto")}   ${money.format(d.ingresoBruto ?? 0)}`);
        return lineas.join("\n");
      })
      .join("\n\n————————————\n\n");
  }, [cards, rangoLabel, t]);

  function imprimir() {
    const el = printRef.current;
    if (!el || typeof window === "undefined") return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    // <base> para que las rutas relativas (el logo /img/logo_cmr.png) resuelvan en la ventana nueva.
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${t("title")} ${rangoLabel}</title><style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`);
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
    <div className="w-full px-6 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("help")}</p>
        </div>
        {/* Botones de exportación (no salen en la impresión). */}
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" size="sm" onClick={imprimir} disabled={!cards.length}><HugeiconsIcon icon={PrinterIcon} className="size-4" /> {tc("print")}</Button>
          <Button variant="outline" size="sm" onClick={whatsapp} disabled={!texto}><HugeiconsIcon icon={WhatsappIcon} className="size-4" /> {t("whatsapp")}</Button>
          <Button variant="outline" size="sm" onClick={correo} disabled={!texto}><HugeiconsIcon icon={Mail01Icon} className="size-4" /> {t("correo")}</Button>
          <Button variant="outline" size="sm" onClick={copiar} disabled={!texto}><HugeiconsIcon icon={Copy01Icon} className="size-4" /> {t("copiar")}</Button>
        </div>
      </div>

      {/* Rango + Generar */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border p-4 no-print">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("to")}</span>
          <Input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className="h-9 w-[160px]" />
        </label>
        <Button className="h-9" onClick={() => setQuery({ desde, hasta })}>{t("generar")}</Button>
      </div>

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : (
        <>
          {cargando && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
          {res.state.kind === "fail" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{tc("error")}</p>
          )}
          {/* Región imprimible: una tarjeta por centro, apiladas. */}
          <div ref={printRef} className="mx-auto max-w-3xl space-y-6">
            {cards.map((c) => <DiariaCard key={c.centroId} centro={c.centroNombre} fecha={rangoLabel} data={c.data} t={t} />)}
          </div>
        </>
      )}
    </div>
  );
}

function DiariaCard({ centro, fecha, data, t }: { centro: string; fecha: string; data: EstadisticasDiarias; t: (k: string) => string }) {
  const vacio = data.atencionMedica.total === 0 && data.servicios.length === 0 && !data.ingresoBruto;
  return (
    <div className="card rounded-xl border bg-card p-6">
      <div className="text-center">
        {/* Membrete con logo SOLO en la versión impresa/enviada (oculto en pantalla vía .solo-print). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo_cmr.png" alt="" className="solo-print logo" />
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
              <span title={t("tip.nuevas")}><span className="font-semibold">N:</span> {nf.format(data.atencionMedica.nuevas)}</span>
              <span title={t("tip.seguimientos")}><span className="font-semibold">S:</span> {nf.format(data.atencionMedica.seguimientos)}</span>
              <span className="ml-auto font-semibold">{t("total")} {nf.format(data.atencionMedica.total)}</span>
            </div>
          </div>

          {/* Servicios especializados */}
          {data.servicios.length > 0 && (
            <div className="blk">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("servicios")}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 pr-3 font-semibold">{t("col.servicio")}</th>
                    <th className="r px-3 py-1 text-right font-semibold" title={t("tip.aplicados")}>{t("col.aplicados")}</th>
                    <th className="r px-3 py-1 text-right font-semibold" title={t("tip.vendidos")}>{t("col.vendidos")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.servicios.map((s) => (
                    <tr key={s.clave}>
                      <td className="py-1.5 pr-3 font-medium">{s.nombre}</td>
                      <td className="r px-3 py-1.5 text-right tabular-nums">{nf.format(s.aplicados)}</td>
                      <td className="r px-3 py-1.5 text-right tabular-nums">{nf.format(s.vendidos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ingreso bruto */}
          <div className="ingreso flex items-center justify-between border-t-2 border-foreground pt-3 text-base font-bold">
            <span>{t("ingresoBruto")}</span>
            <span className="tabular-nums">{money.format(data.ingresoBruto ?? 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
