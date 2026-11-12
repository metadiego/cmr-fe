"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Alert02Icon } from "@hugeicons/core-free-icons";

import type { ReporteDia, TributarioPartida, DivisionCounts } from "@/lib/api/caja";
import { money } from "@/lib/caja/totales";
import { CuadreDevoluciones, devolucionesPrintHtml } from "@/components/caja/cuadre-devoluciones";
import { refundSplit } from "@/lib/caja/refunds-by-method";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { ProductSalesSection } from "@/components/caja/product-sales-section";
import { productSalesPrintHtml, type ProductSalesPrintLabels } from "@/lib/caja/product-sales-print";
import { signaturesPrintHtml, type PrintedSignature } from "@/lib/caja/sign-off";
import { ConteoEfectivoSection, type ConteoEfectivoPanel } from "@/components/caja/conteo-efectivo-section";
import { conteoTableHtml } from "@/lib/caja/conteo-table-print";

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
  titulo,
  division,
  fecha,
  centroNombre,
  reporte,
  resumen,
  subtotalesTarjeta,
  divisionCounts,
  firmas,
  firmaTexto,
}: {
  // Título de la hoja impresa; default = t("title") ("Cuadre de caja"). El cuadre TOTAL del día
  // (handoff cuadre-unico-del-dia) pasa el suyo propio ("Cuadre total del día").
  titulo?: string;
  // Etiqueta YA traducida (p.ej. t(`division.${division}`)): este componente ya no conoce el tipo
  // CajaDivision. Ausente = sin sufijo de división (el cuadre TOTAL del día no es de una sola división).
  division?: string;
  fecha: string;
  centroNombre?: string;
  reporte: Omit<ReporteDia, "countMode">;
  resumen: CuadreResumen;
  // Subtotales informativos configurables de tarjeta (p.ej. VISA + MASTERCARD), el mismo array que
  // ResumenPagos pinta en pantalla (lib/caja/totales.ts subtotalesTarjeta()) — faltaba en la hoja
  // impresa, que solo traía "Total tarjetas" sin desglose. Ausente = sin esa sección.
  subtotalesTarjeta?: Array<{ clave: string; labelKey: string; nombre: string; monto: number }>;
  // Modo `split` (BE #566): dos conteos (consulta/general) en vez del único consolidado, EN PANTALLA
  // Y en lo impreso — es la hoja que se entrega, tenía que salir ahí (owner, 11-nov-2026). Ausente =
  // como siempre, un solo conteo.
  divisionCounts?: DivisionCounts;
  // Sign-off blocks already put into words (components/caja/cash-sign-off.tsx): «Aceptado por … · when»
  // over each line. Absent = the two blank lines of before.
  firmas?: PrintedSignature[];
  firmaTexto?: string;
}) {
  const t = useTranslations("caja");
  const tp = useTranslations("caja.payments");
  const td = useTranslations("caja.detalle");
  const tps = useTranslations("caja.productSales");
  const tRoot = useTranslations();
  const tituloEfectivo = titulo ?? t("title");

  const documentos = React.useMemo(() => reporte.documentos ?? [], [reporte.documentos]);
  // Columna «División» (handoff cuadre-unico-del-dia): solo en el cuadre TOTAL, donde cada documento
  // trae la suya. En el reporte por división ningún documento la trae → la columna no se pinta.
  const conDivision = documentos.some((d) => d.division);
  const devoluciones = reporte.devolucionesDetalle ?? [];
  const trib = reporte.tributario ?? null;
  const conteo = reporte.conteoEfectivo ?? null;
  // Denominaciones de MAYOR a menor (hoja del legado).
  const conteoLineas = React.useMemo(
    () => [...(conteo?.lines ?? [])].sort((a, b) => b.value - a.value),
    [conteo],
  );
  // Uno (de siempre) o dos paneles (modo `split`, BE #566) — ver ConteoEfectivoSection.
  const conteoPanels: ConteoEfectivoPanel[] = divisionCounts
    ? (["consultation", "general"] as const).map((k) => ({
        title: `${td("conteoEfectivo")} · ${t(`division.${k === "consultation" ? "consulta" : "general"}`)}`,
        lines: divisionCounts[k].lines.map((l) => ({ key: l.denominacionId, quantity: l.cantidad, value: l.valor, amount: l.monto })),
        total: divisionCounts[k].hasCount ? divisionCounts[k].counted : null,
      }))
    : [
        {
          title: td("conteoEfectivo"),
          subtitle: conteo && conteo.cajeros > 1 ? td("cajerosSumados", { n: conteo.cajeros }) : undefined,
          lines: conteoLineas.map((l, i) => ({ key: l.denominationId ?? `${l.value}-${i}`, quantity: l.quantity, value: l.value, amount: l.amount })),
          total: conteo ? conteo.total : null,
        },
      ];

  // Cruce id → documento, para nombrar las facturas exoneradas (nº + paciente) que el BE da por id.
  const docPorId = React.useMemo(() => {
    const m = new Map<string, (typeof documentos)[number]>();
    for (const d of documentos) m.set(d.id, d);
    return m;
  }, [documentos]);
  const exoneradas = (trib?.facturasExoneradas ?? []).map((id) => {
    const d = docPorId.get(id);
    return { id, numero: d?.number ?? null, paciente: d?.patient ?? null };
  });
  const hayExonerado = !!trib && trib.exonerado.amount > 0;
  // Mismo criterio que ResumenPagos: labelKey traducible si existe, si no el nombre crudo del BE.
  const subtotalesTarjetaResueltos = (subtotalesTarjeta ?? []).map((s) => ({
    label: tRoot.has(s.labelKey) ? tRoot(s.labelKey) : s.nombre,
    monto: s.monto,
  }));

  function imprimir() {
    if (typeof window === "undefined") return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(
      buildPrintHtml({
        titulo: tituloEfectivo,
        divisionLabel: division ?? "",
        centroNombre: centroNombre ?? "",
        fechaLabel: formatFechaSolo(fecha),
        resumen,
        reporte,
        subtotalesTarjeta: subtotalesTarjetaResueltos,
        divisionCounts,
        exoneradas,
        firmasHtml: firmas?.length ? signaturesPrintHtml(firmas, firmaTexto) : undefined,
        productSalesHtml: reporte.productSales
          ? productSalesPrintHtml(reporte.productSales, Object.fromEntries(PS_KEYS.map((k) => [k, String(tps.raw(k))])) as ProductSalesPrintLabels)
          : "",
        divisionLabels: { consulta: t("division.consulta"), general: t("division.general") },
        L: {
          resumen: tp("general"),
          cards: tp("cards"),
          otherMethods: tp("otherMethods"),
          noOther: tp("noOther"),
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
          cardSales: tp("cardSales"),
          chargedRefunded: tp("chargedRefunded"),
          colAntesDescuento: td("colAntesDescuento"),
          colBaseNeta: td("colBaseNeta"),
          colFacturaOrigen: td("colFacturaOrigen"),
          colFormaReembolso: td("colFormaReembolso"),
          colImpuesto: td("colImpuesto"),
          colLineas: td("colLineas"),
          documentos: td("documentos"),
          whoBilled: td("who.title"),
          whoTotal: td("who.total"),
          colCajero: td("who.col"),
          colNumero: td("colNumero"),
          colDivision: td("colDivision"),
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

      {/* 0. Conteo de efectivo: uno (sellado/consolidado) o dos (modo `split`, BE #566). */}
      <ConteoEfectivoSection
        panels={conteoPanels}
        labels={{
          colCantidad: td("colCantidad"),
          colValor: td("colValor"),
          colMonto: td("colMonto"),
          conteoTotal: td("conteoTotal"),
          sinConteo: td("sinConteo"),
        }}
      />

      {/* 1. Bloque tributario */}
      {trib && (
        <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{td("tributario")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">{td("partida")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colAntesDescuento")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colDescuento")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colBaseNeta")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colImpuesto")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colTotal")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{td("colLineas")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <TribRow label={td("gravado")} p={trib.taxable} />
                <TribRow label={td("exento")} p={trib.exempt} />
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

      {/* 1b. Venta de productos (IVU): every product invoice + IVU by component + check (BE #470). */}
      {reporte.productSales && <ProductSalesSection ps={reporte.productSales} />}

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
                  {conDivision && <th className="px-4 py-2 text-left font-semibold">{td("colDivision")}</th>}
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
                    <td className="px-4 py-2 font-mono tabular-nums">{d.number || "—"}</td>
                    {conDivision && (
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {d.division ? t(`division.${d.division}`) : "—"}
                      </td>
                    )}
                    {/* Sin récord = celda vacía (no "null" ni guion raro). */}
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{d.medicalRecordNumber || ""}</td>
                    <td className="px-4 py-2">{d.patient || "—"}</td>
                    {/* Quién facturó: usuario.nombre; null (o nombre null = llave) → "—", nunca el id. */}
                    <td className="px-4 py-2">{d.user?.name || "—"}</td>
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

      {/* 3. Devoluciones del día — en rojo, con su factura de origen y su forma (components/caja/cuadre-devoluciones.tsx). */}
      <CuadreDevoluciones devoluciones={devoluciones} />
    </div>
  );
}

function TribRow({ label, p, dim }: { label: string; p: TributarioPartida; dim?: boolean }) {
  return (
    <tr className={dim ? "text-muted-foreground" : undefined}>
      <td className="px-4 py-2 font-medium">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{p.gross != null ? money(p.gross) : "—"}</td>
      <td className="px-4 py-2 text-right tabular-nums">{p.discount ? `−${money(p.discount)}` : money(0)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{money(p.base)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{money(p.tax)}</td>
      <td className="px-4 py-2 text-right font-medium tabular-nums">{money(p.amount)}</td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{p.lines}</td>
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
.tot td{font-weight:700;border-top:2px solid #111}
/* Resumen y conteo lado a lado (uso óptimo del papel). */
.cols{display:flex;gap:28px;align-items:flex-start;page-break-inside:avoid}
.cols .col{flex:1;min-width:0}
.cols .col h2{margin-top:0}
.aviso{margin-top:8px;border:1px solid #d9a441;background:#fdf6e8;color:#8a5a00;border-radius:6px;padding:8px 10px;font-size:11px}
.dim{color:#999}
.firmas{display:flex;gap:40px;margin-top:48px}
.firma{flex:1;text-align:center;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#333}
.firmas:has(.firma-wrap){flex-wrap:wrap;row-gap:28px}
.firmas .firma-wrap{flex:1;min-width:150px;display:flex;flex-direction:column;justify-content:flex-end}
.firma-sello{min-height:28px;text-align:center;font-size:10.5px;color:#1b5e20;padding-bottom:4px}
.firma-sello .rojo{font-weight:600;margin-top:2px}
.firma-texto{margin-top:40px;font-size:11px;color:#333;text-align:center}
.firma-texto + .firmas{margin-top:28px}
.firma-wrap .firma{flex:none}
.rojo{color:#b3261e}
`;

type PrintLabels = Record<string, string>;
const PS_KEYS = [
  "title", "taxable", "exempt", "exonerated", "taxCollected", "taxWouldBe", "refunds", "net", "amount", "base",
  "discount", "taxShort", "lines", "colNumber", "colRecord", "colPatient", "colBase", "colDiscount", "colTotal",
  "colExonerated", "colRefunded", "colPayment", "totals", "none", "yes", "no", "check", "products", "services",
  "dayNet", "squares", "gap",
] as const satisfies readonly (keyof ProductSalesPrintLabels)[];
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function buildPrintHtml(args: {
  titulo: string;
  divisionLabel: string;
  centroNombre: string;
  fechaLabel: string;
  resumen: CuadreResumen;
  reporte: Omit<ReporteDia, "countMode">;
  subtotalesTarjeta: Array<{ label: string; monto: number }>;
  exoneradas: Array<{ id: string; numero: string | null; paciente: string | null }>;
  productSalesHtml?: string;
  firmasHtml?: string;
  // Etiquetas para la columna «División» de la tabla de documentos (solo el cuadre TOTAL del día la usa)
  // Y para el título de cada panel de conteo en modo `split` — mismas etiquetas, mismo significado.
  divisionLabels?: { consulta: string; general: string };
  // Modo `split` (BE #566): dos paneles de conteo (consulta/general) en vez del único consolidado.
  divisionCounts?: DivisionCounts;
  L: PrintLabels;
}): string {
  const { titulo, divisionLabel, centroNombre, fechaLabel, resumen: s, reporte, subtotalesTarjeta, exoneradas, divisionLabels, divisionCounts, L, productSalesHtml, firmasHtml } = args;
  const trib = reporte.tributario;
  const documentos = reporte.documentos ?? [];
  const devoluciones = reporte.devolucionesDetalle ?? [];
  const conteo = reporte.conteoEfectivo ?? null;
  const hayExonerado = !!trib && trib.exonerado.amount > 0;
  const tarjetas = reporte.detalle.tarjetas;
  const otros = reporte.detalle.otros;

  // Mismo bloque que ResumenPagos en pantalla: filas por método (×cantidad) + subtotales informativos
  // (p.ej. VISA + MASTERCARD) + total. Antes solo se imprimía "Total tarjetas" sin este desglose.
  const metodoRows = (rows: typeof tarjetas) =>
    rows
      .map((r) => {
        const sp = refundSplit(r);
        const note = sp ? `<br><span class="dim">${esc(L.chargedRefunded.replace("{charged}", money(sp.sales)).replace("{refunded}", money(sp.refunds)))}</span>` : "";
        return `<tr><td>${esc(r.name)} <span class="dim">×${esc(r.quantity)}</span></td><td class="r mono">${esc(money(r.amount))}${note}</td></tr>`;
      })
      .join("");
  const cardsBlock = `<h2>${esc(L.cards)}</h2>
    <table>
      <tbody>${tarjetas.length ? metodoRows(tarjetas) : `<tr><td class="dim">${esc(L.noOther)}</td><td></td></tr>`}</tbody>
      ${
        subtotalesTarjeta.length
          ? `<tbody>${subtotalesTarjeta.map((sub) => `<tr><td class="dim"><em>${esc(sub.label)}</em></td><td class="r mono dim"><em>${esc(money(sub.monto))}</em></td></tr>`).join("")}</tbody>`
          : ""
      }
      <tfoot><tr class="tot"><td>${esc(L.totalCards)}</td><td class="r mono">${esc(money(reporte.detalle.totalTarjetas))}</td></tr></tfoot>
    </table>`;
  const otherMethodsBlock = `<h2>${esc(L.otherMethods)}</h2>
    <table>
      <tbody>${otros.length ? metodoRows(otros) : `<tr><td class="dim">${esc(L.noOther)}</td><td></td></tr>`}</tbody>
    </table>`;

  // Uno (de siempre) o dos bloques de conteo (modo `split`, BE #566) — mismo helper que la pantalla,
  // para que lo impreso diga exactamente lo mismo que lo que ya vio quien cerró la caja.
  const tableLabels = { colCantidad: L.colCantidad, colValor: L.colValor, colMonto: L.colMonto, conteoTotal: L.conteoTotal, sinConteo: L.sinConteo };
  const conteoBlock = divisionCounts
    ? (["consultation", "general"] as const)
        .map((k) =>
          conteoTableHtml({
            title: `${L.conteoEfectivo} · ${k === "consultation" ? (divisionLabels?.consulta ?? "") : (divisionLabels?.general ?? "")}`,
            lines: divisionCounts[k].lines.map((l) => ({ key: l.denominacionId, quantity: l.cantidad, value: l.valor, amount: l.monto })),
            total: divisionCounts[k].hasCount ? divisionCounts[k].counted : null,
            labels: tableLabels,
          }),
        )
        .join("")
    : conteoTableHtml({
        title: L.conteoEfectivo,
        lines: (conteo?.lines ?? []).map((l, i) => ({ key: l.denominationId ?? `${l.value}-${i}`, quantity: l.quantity, value: l.value, amount: l.amount })),
        total: conteo ? conteo.total : null,
        labels: tableLabels,
      });

  const resumenRows = [
    [L.opening, money(s.inicio)],
    [L.salesCash, money(s.salesCash)],
    [L.electronic, money(s.electronicas)],
    [L.totalCards, money(s.totalTarjetas)],
    ...(reporte.detalle.cardSalesTotal != null ? [[L.cardSales, money(reporte.detalle.cardSalesTotal)]] : []),
    [L.totalCMA, money(s.totalDia), "strong"],
    [L.grossBilling, money(s.bruto)],
    [L.returns, money(s.devuelto)],
    ...(reporte.detalle.refundsByMethod ?? []).map((m) => [`· ${m.name}`, `−${money(m.amount)}`]),
    [L.netBilling, money(s.neto), "strong"],
    [L.cashInDrawer, money(s.contado)],
    [L.deposit, money(s.aDepositar)],
    [L.variance, money(s.diferencia), "var"],
  ]
    .map(([k, v, cls]) => `<tr class="${cls ?? ""}"><td>${esc(k)}</td><td class="r mono">${esc(v)}</td></tr>`)
    .join("");

  const tribRow = (label: string, p: TributarioPartida, dim = false) =>
    `<tr class="${dim ? "dim" : ""}"><td>${esc(label)}</td><td class="r mono">${esc(p.gross != null ? money(p.gross) : "—")}</td><td class="r mono">${esc(p.discount ? "−" + money(p.discount) : money(0))}</td><td class="r mono">${esc(money(p.base))}</td><td class="r mono">${esc(money(p.tax))}</td><td class="r mono">${esc(money(p.amount))}</td><td class="r mono">${esc(p.lines)}</td></tr>`;

  const tribBlock = trib
    ? `<h2>${esc(L.tributario)}</h2>
       <table>
         <thead><tr><th></th><th class="r">${esc(L.colAntesDescuento)}</th><th class="r">${esc(L.colDescuento)}</th><th class="r">${esc(L.colBaseNeta)}</th><th class="r">${esc(L.colImpuesto)}</th><th class="r">${esc(L.colTotal)}</th><th class="r">${esc(L.colLineas)}</th></tr></thead>
         <tbody>
           ${tribRow(L.gravado, trib.taxable)}
           ${tribRow(L.exento, trib.exempt)}
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

  const docConDivision = documentos.some((d) => d.division);
  const divCell = (d: (typeof documentos)[number]) =>
    docConDivision ? `<td class="dim">${esc(d.division ? (divisionLabels?.[d.division] ?? d.division) : "—")}</td>` : "";
  const docRows = documentos
    .map(
      (d) =>
        `<tr><td class="mono">${esc(d.number || "—")}</td>${divCell(d)}<td class="mono dim">${esc(d.medicalRecordNumber || "")}</td><td>${esc(d.patient || "—")}</td><td>${esc(d.user?.name || "—")}</td><td class="mono">${esc(d.formaPago || "—")}</td><td class="r mono">${esc(money(d.total))}</td></tr>`,
    )
    .join("");
  const docBlock = `<h2>${esc(L.documentos)} (${documentos.length})</h2>
    <table>
      <thead><tr><th>${esc(L.colNumero)}</th>${docConDivision ? `<th>${esc(L.colDivision)}</th>` : ""}<th>${esc(L.colRecord)}</th><th>${esc(L.colPaciente)}</th><th>${esc(L.colFacturo)}</th><th>${esc(L.colFormaPago)}</th><th class="r">${esc(L.colTotal)}</th></tr></thead>
      <tbody>${docRows || `<tr><td colspan="${docConDivision ? 7 : 6}" class="dim">—</td></tr>`}</tbody>
    </table>`;

  const devBlock = devolucionesPrintHtml(devoluciones, L, esc);

  const subtitulo = divisionLabel ? `${esc(titulo)} — ${esc(divisionLabel)}` : esc(titulo);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${subtitulo} ${esc(fechaLabel)}</title><style>${PRINT_CSS}</style></head><body>
    <div class="head">
      <h1>${esc(centroNombre || titulo)}</h1>
      <div class="sub">${subtitulo} · ${esc(fechaLabel)}</div>
    </div>
    <div class="cols">
      <div class="col">${cardsBlock}${otherMethodsBlock}</div>
      <div class="col"><h2>${esc(L.resumen)}</h2><table class="res"><tbody>${resumenRows}</tbody></table>${conteoBlock}</div>
    </div>
    ${tribBlock}
    ${productSalesHtml ?? ""}
    ${cajerosBlock}
    ${docBlock}
    ${devBlock}
    ${firmasHtml ?? `<div class="firmas">
      <div class="firma">${esc(L.cajero)}</div>
      <div class="firma">${esc(L.gerente)}</div>
    </div>`}
  </body></html>`;
}
