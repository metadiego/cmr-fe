"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Alert02Icon } from "@hugeicons/core-free-icons";

import type { CajaDivision, ReporteDia, TributarioPartida } from "@/lib/api/caja";
import { money } from "@/lib/caja/totales";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";

// Números de la caja (modelo CMA) que también van en la hoja impresa.
export interface CuadreResumen {
  inicio: number;
  salesCash: number;
  electronicas: number;
  totalTarjetas: number;
  totalDia: number;
  bruto: number;
  devuelto: number;
  neto: number;
  contado: number;
  aDepositar: number;
  diferencia: number;
}

// Pie del cuadre: documentos del día + bloque tributario (lo que se entrega a contabilidad), con su
// versión impresa firmable. Solo PRESENTA datos del BE — nada se recalcula aquí. Handoff HANDOFF-pie-del-cuadre.
export function CuadreDetalle({
  division,
  fecha,
  centroNombre,
  reporte,
  resumen,
}: {
  division: CajaDivision;
  fecha: string;
  centroNombre?: string;
  reporte: ReporteDia;
  resumen: CuadreResumen;
}) {
  const t = useTranslations("caja");
  const tp = useTranslations("caja.payments");
  const td = useTranslations("caja.detalle");

  const documentos = React.useMemo(() => reporte.documentos ?? [], [reporte.documentos]);
  const devoluciones = reporte.devolucionesDetalle ?? [];
  const trib = reporte.tributario ?? null;
  const conteo = reporte.conteoEfectivo ?? null;
  // Denominaciones de MAYOR a menor (hoja del legado).
  const conteoLineas = React.useMemo(
    () => [...(conteo?.lineas ?? [])].sort((a, b) => b.valor - a.valor),
    [conteo],
  );

  // Cruce id → documento, para nombrar las facturas exoneradas (nº + paciente) que el BE da por id.
  const docPorId = React.useMemo(() => {
    const m = new Map<string, (typeof documentos)[number]>();
    for (const d of documentos) m.set(d.id, d);
    return m;
  }, [documentos]);
  const exoneradas = (trib?.facturasExoneradas ?? []).map((id) => {
    const d = docPorId.get(id);
    return { id, numero: d?.numero ?? null, paciente: d?.paciente ?? null };
  });
  const hayExonerado = !!trib && trib.exonerado.monto > 0;

  function imprimir() {
    if (typeof window === "undefined") return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(
      buildPrintHtml({
        titulo: t("title"),
        divisionLabel: t(`division.${division}`),
        centroNombre: centroNombre ?? "",
        fechaLabel: formatFechaSolo(fecha),
        resumen,
        reporte,
        exoneradas,
        L: {
          resumen: tp("general"),
          opening: tp("opening"),
          salesCash: tp("salesCash"),
          electronic: tp("electronic"),
          totalCards: tp("totalCards"),
          totalCMA: tp("totalCMA"),
          grossBilling: tp("grossBilling"),
          returns: tp("returns"),
          netBilling: tp("netBilling"),
          cashInDrawer: tp("cashInDrawer"),
          deposit: tp("deposit"),
          variance: t("summary.variance"),
          conteoEfectivo: td("conteoEfectivo"),
          conteoTotal: td("conteoTotal"),
          sinConteo: td("sinConteo"),
          colCantidad: td("colCantidad"),
          colValor: td("colValor"),
          tributario: td("tributario"),
          gravado: td("gravado"),
          exento: td("exento"),
          exonerado: td("exonerado"),
          colMonto: td("colMonto"),
          colDescuento: td("colDescuento"),
          colBase: td("colBase"),
          colImpuesto: td("colImpuesto"),
          colLineas: td("colLineas"),
          documentos: td("documentos"),
          whoBilled: td("who.title"),
          whoTotal: td("who.total"),
          colCajero: td("who.col"),
          colNumero: td("colNumero"),
          colRecord: td("colRecord"),
          colPaciente: td("colPaciente"),
          colFacturo: td("colFacturo"),
          colFormaPago: td("colFormaPago"),
          colTotal: td("colTotal"),
          devoluciones: td("devoluciones"),
          colMotivo: td("colMotivo"),
          exoneradoAviso: td("exoneradoAviso"),
          cajero: td("firmaCajero"),
          gerente: td("firmaGerente"),
        },
      }),
    );
    w.document.close();
    w.focus();
    const go = () => w.print();
    if (w.document.readyState === "complete") go();
    else w.onload = go;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{td("footerTitle")}</h2>
        <Button variant="outline" size="sm" onClick={imprimir}>
          <HugeiconsIcon icon={PrinterIcon} className="size-4" /> {td("print")}
        </Button>
      </div>

      {/* 0. Conteo de efectivo (sellado / consolidado): cantidad · valor · monto, de mayor a menor. */}
      <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <h3 className="flex items-center justify-between border-b px-4 py-2.5 text-sm font-semibold">
          <span>{td("conteoEfectivo")}</span>
          {conteo && conteo.cajeros > 1 && (
            <span className="text-xs font-normal text-muted-foreground">{td("cajerosSumados", { n: conteo.cajeros })}</span>
          )}
        </h3>
        {!conteo ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{td("sinConteo")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-right font-semibold">{td("colCantidad")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colValor")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colMonto")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conteoLineas.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-3 text-center text-muted-foreground">{td("sinConteo")}</td></tr>
                )}
                {conteoLineas.map((l, i) => (
                  <tr key={l.denominacionId ?? `${l.valor}-${i}`}>
                    <td className="px-4 py-2 text-right tabular-nums">{l.cantidad}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{money(l.valor)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(l.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="px-4 py-2 text-right text-xs uppercase tracking-wide text-muted-foreground" colSpan={2}>{td("conteoTotal")}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{money(conteo.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* 1. Bloque tributario */}
      {trib && (
        <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{td("tributario")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">{td("partida")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colMonto")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colDescuento")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colBase")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colImpuesto")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colLineas")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <TribRow label={td("gravado")} p={trib.gravado} />
                <TribRow label={td("exento")} p={trib.exento} />
                <TribRow label={td("exonerado")} p={trib.exonerado} dim={!hayExonerado} />
              </tbody>
            </table>
          </div>
          {/* Exonerado > 0: decisión que contabilidad debe ver → aviso ámbar + las facturas. */}
          {hayExonerado && (
            <div className="m-4 rounded-md border border-warning/40 bg-warning px-3 py-2.5 text-sm text-warning-foreground">
              <p className="flex items-center gap-1.5 font-medium">
                <HugeiconsIcon icon={Alert02Icon} className="size-4" /> {td("exoneradoAviso")}
              </p>
              {exoneradas.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {exoneradas.map((e) => (
                    <li key={e.id} className="tabular-nums">
                      {e.numero ? `#${e.numero}` : e.id.slice(0, 8)}
                      {e.paciente ? ` · ${e.paciente}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* 2. Documentos del día */}
      <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <h3 className="border-b px-4 py-2.5 text-sm font-semibold">
          {td("documentos")} <span className="font-normal text-muted-foreground">({documentos.length})</span>
        </h3>
        {documentos.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{td("sinDocumentos")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">{td("colNumero")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{td("colRecord")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{td("colPaciente")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{td("colFacturo")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{td("colFormaPago")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documentos.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 font-mono tabular-nums">{d.numero || "—"}</td>
                    {/* Sin récord = celda vacía (no "null" ni guion raro). */}
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{d.record || ""}</td>
                    <td className="px-4 py-2">{d.paciente || "—"}</td>
                    {/* Quién facturó: usuario.nombre; null (o nombre null = llave) → "—", nunca el id. */}
                    <td className="px-4 py-2">{d.usuario?.nombre || "—"}</td>
                    {/* Forma de pago YA resuelta en siglas: pintar tal cual. */}
                    <td className="px-4 py-2 font-mono text-xs">{d.formaPago || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Devoluciones del día — bloque aparte, en rojo, con signo. */}
      {devoluciones.length > 0 && (
        <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <h3 className="border-b border-destructive/20 px-4 py-2.5 text-sm font-semibold text-destructive">
            {td("devoluciones")} <span className="font-normal">({devoluciones.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">{td("colNumero")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colMonto")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{td("colMotivo")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devoluciones.map((dev) => (
                  <tr key={dev.id}>
                    <td className="px-4 py-2 font-mono tabular-nums">{dev.numero != null ? String(dev.numero) : "—"}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-destructive">
                      −{money(dev.montoDevuelto)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{dev.motivo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function TribRow({ label, p, dim }: { label: string; p: TributarioPartida; dim?: boolean }) {
  return (
    <tr className={dim ? "text-muted-foreground" : undefined}>
      <td className="px-4 py-2 font-medium">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{money(p.monto)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{money(p.descuento)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{money(p.base)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{money(p.impuesto)}</td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{p.lineas}</td>
    </tr>
  );
}

// ————————————————————————————————————————————————————————————————————————————
// Hoja impresa (ventana propia, sin el shell de la app): cabecera + resumen + tributario + documentos
// + firmas. El modelo es el del legado, legible. Se compone del dato del BE (no del DOM de pantalla).
// ————————————————————————————————————————————————————————————————————————————
const PRINT_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:16mm}
body{font-family:"Helvetica Neue",system-ui,-apple-system,Arial,sans-serif;color:#111;background:#fff;margin:0;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.head{text-align:center;margin-bottom:18px}
.head h1{font-size:22px;font-weight:800;letter-spacing:.01em;margin:0}
.head .sub{font-size:13px;color:#555;margin-top:3px}
h2{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:20px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#888;text-align:left;padding:0 6px 5px}
td{padding:5px 6px;border-top:1px solid #f0f0f0}
.r{text-align:right}
.mono{font-family:"SF Mono",Menlo,Consolas,monospace}
.res{width:100%}
.res td{border:none;padding:3px 6px}
.res .strong td{font-weight:700;border-top:1px solid #ccc}
.res .var td{font-weight:800;border-top:2px solid #111;padding-top:7px}
.conteo{width:100%}
.conteo .tot td{font-weight:700;border-top:2px solid #111}
/* Resumen y conteo lado a lado (uso óptimo del papel). */
.cols{display:flex;gap:28px;align-items:flex-start;page-break-inside:avoid}
.cols .col{flex:1;min-width:0}
.cols .col h2{margin-top:0}
.aviso{margin-top:8px;border:1px solid #d9a441;background:#fdf6e8;color:#8a5a00;border-radius:6px;padding:8px 10px;font-size:11px}
.dim{color:#999}
.firmas{display:flex;gap:40px;margin-top:48px}
.firma{flex:1;text-align:center;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#333}
.rojo{color:#b3261e}
`;

type PrintLabels = Record<string, string>;
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function buildPrintHtml(args: {
  titulo: string;
  divisionLabel: string;
  centroNombre: string;
  fechaLabel: string;
  resumen: CuadreResumen;
  reporte: ReporteDia;
  exoneradas: Array<{ id: string; numero: string | null; paciente: string | null }>;
  L: PrintLabels;
}): string {
  const { titulo, divisionLabel, centroNombre, fechaLabel, resumen: s, reporte, exoneradas, L } = args;
  const trib = reporte.tributario;
  const documentos = reporte.documentos ?? [];
  const devoluciones = reporte.devolucionesDetalle ?? [];
  const conteo = reporte.conteoEfectivo ?? null;
  const conteoLineas = [...(conteo?.lineas ?? [])].sort((a, b) => b.valor - a.valor);
  const hayExonerado = !!trib && trib.exonerado.monto > 0;

  const conteoBlock = `<h2>${esc(L.conteoEfectivo)}</h2>${
    !conteo
      ? `<p class="dim">${esc(L.sinConteo)}</p>`
      : `<table class="conteo"><thead><tr><th class="r">${esc(L.colCantidad)}</th><th class="r">${esc(L.colValor)}</th><th class="r">${esc(L.colMonto)}</th></tr></thead>
         <tbody>${
           conteoLineas.length
             ? conteoLineas
                 .map((l) => `<tr><td class="r mono">${esc(l.cantidad)}</td><td class="r mono dim">${esc(money(l.valor))}</td><td class="r mono">${esc(money(l.monto))}</td></tr>`)
                 .join("")
             : `<tr><td colspan="3" class="dim">${esc(L.sinConteo)}</td></tr>`
         }</tbody>
         <tfoot><tr class="tot"><td colspan="2" class="r dim">${esc(L.conteoTotal)}</td><td class="r mono">${esc(money(conteo.total))}</td></tr></tfoot></table>`
  }`;

  const resumenRows = [
    [L.opening, money(s.inicio)],
    [L.salesCash, money(s.salesCash)],
    [L.electronic, money(s.electronicas)],
    [L.totalCards, money(s.totalTarjetas)],
    [L.totalCMA, money(s.totalDia), "strong"],
    [L.grossBilling, money(s.bruto)],
    [L.returns, money(s.devuelto)],
    [L.netBilling, money(s.neto), "strong"],
    [L.cashInDrawer, money(s.contado)],
    [L.deposit, money(s.aDepositar)],
    [L.variance, money(s.diferencia), "var"],
  ]
    .map(([k, v, cls]) => `<tr class="${cls ?? ""}"><td>${esc(k)}</td><td class="r mono">${esc(v)}</td></tr>`)
    .join("");

  const tribRow = (label: string, p: TributarioPartida, dim = false) =>
    `<tr class="${dim ? "dim" : ""}"><td>${esc(label)}</td><td class="r mono">${esc(money(p.monto))}</td><td class="r mono">${esc(money(p.descuento))}</td><td class="r mono">${esc(money(p.base))}</td><td class="r mono">${esc(money(p.impuesto))}</td><td class="r mono">${esc(p.lineas)}</td></tr>`;

  const tribBlock = trib
    ? `<h2>${esc(L.tributario)}</h2>
       <table>
         <thead><tr><th></th><th class="r">${esc(L.colMonto)}</th><th class="r">${esc(L.colDescuento)}</th><th class="r">${esc(L.colBase)}</th><th class="r">${esc(L.colImpuesto)}</th><th class="r">${esc(L.colLineas)}</th></tr></thead>
         <tbody>
           ${tribRow(L.gravado, trib.gravado)}
           ${tribRow(L.exento, trib.exento)}
           ${tribRow(L.exonerado, trib.exonerado, !hayExonerado)}
         </tbody>
       </table>
       ${
         hayExonerado
           ? `<div class="aviso">${esc(L.exoneradoAviso)}${
               exoneradas.length
                 ? " — " + exoneradas.map((e) => esc((e.numero ? "#" + e.numero : e.id.slice(0, 8)) + (e.paciente ? " · " + e.paciente : ""))).join("; ")
                 : ""
             }</div>`
           : ""
       }`
    : "";

  // «Quién facturó» en la hoja impresa (§5): una fila por facturador + Σ que cuadra con el total del día.
  const porCajero = reporte.porCajero ?? [];
  const cajerosBlock = porCajero.length
    ? `<h2>${esc(L.whoBilled)}</h2>
       <table>
         <thead><tr><th>${esc(L.colCajero)}</th><th class="r">${esc(L.colTotal)}</th></tr></thead>
         <tbody>${[...porCajero]
           .sort((a, b) => b.total - a.total)
           .map((c) => `<tr><td>${esc(c.nombre || "—")}</td><td class="r mono">${esc(money(c.total))}</td></tr>`)
           .join("")}</tbody>
         <tfoot><tr class="tot"><td class="r dim">${esc(L.whoTotal)}</td><td class="r mono">${esc(money(porCajero.reduce((sum, c) => sum + Number(c.total ?? 0), 0)))}</td></tr></tfoot>
       </table>`
    : "";

  const docRows = documentos
    .map(
      (d) =>
        `<tr><td class="mono">${esc(d.numero || "—")}</td><td class="mono dim">${esc(d.record || "")}</td><td>${esc(d.paciente || "—")}</td><td>${esc(d.usuario?.nombre || "—")}</td><td class="mono">${esc(d.formaPago || "—")}</td><td class="r mono">${esc(money(d.total))}</td></tr>`,
    )
    .join("");
  const docBlock = `<h2>${esc(L.documentos)} (${documentos.length})</h2>
    <table>
      <thead><tr><th>${esc(L.colNumero)}</th><th>${esc(L.colRecord)}</th><th>${esc(L.colPaciente)}</th><th>${esc(L.colFacturo)}</th><th>${esc(L.colFormaPago)}</th><th class="r">${esc(L.colTotal)}</th></tr></thead>
      <tbody>${docRows || `<tr><td colspan="6" class="dim">—</td></tr>`}</tbody>
    </table>`;

  const devBlock = devoluciones.length
    ? `<h2 class="rojo">${esc(L.devoluciones)} (${devoluciones.length})</h2>
       <table>
         <thead><tr><th>${esc(L.colNumero)}</th><th class="r">${esc(L.colMonto)}</th><th>${esc(L.colMotivo)}</th></tr></thead>
         <tbody>${devoluciones
           .map(
             (d) =>
               `<tr><td class="mono">${esc(d.numero != null ? d.numero : "—")}</td><td class="r mono rojo">−${esc(money(d.montoDevuelto))}</td><td class="dim">${esc(d.motivo || "—")}</td></tr>`,
           )
           .join("")}</tbody>
       </table>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)} ${esc(divisionLabel)} ${esc(fechaLabel)}</title><style>${PRINT_CSS}</style></head><body>
    <div class="head">
      <h1>${esc(centroNombre || titulo)}</h1>
      <div class="sub">${esc(titulo)} — ${esc(divisionLabel)} · ${esc(fechaLabel)}</div>
    </div>
    <div class="cols">
      <div class="col"><h2>${esc(L.resumen)}</h2><table class="res"><tbody>${resumenRows}</tbody></table></div>
      <div class="col">${conteoBlock}</div>
    </div>
    ${tribBlock}
    ${cajerosBlock}
    ${docBlock}
    ${devBlock}
    <div class="firmas">
      <div class="firma">${esc(L.cajero)}</div>
      <div class="firma">${esc(L.gerente)}</div>
    </div>
  </body></html>`;
}
