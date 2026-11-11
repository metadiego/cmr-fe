"use client";

import { useTranslations } from "next-intl";

import type { ReporteDia } from "@/lib/api/caja";
import { money } from "@/lib/caja/totales";

// The day's refunds as accounting reconciles them (Sheila, 10-nov; BE #560): refund number, ORIGIN invoice,
// patient and record, refund method (Care Credit…), amount (negative) and reason. Screen table + the
// printed sheet's block, from the same rows. Moved out of cuadre-detalle.tsx (at its ceiling).
type Devolucion = NonNullable<ReporteDia["devolucionesDetalle"]>[number];

const numero = (d: Devolucion) => d.displayNumber || (d.number != null ? String(d.number) : "—");

export function CuadreDevoluciones({ devoluciones }: { devoluciones: Devolucion[] }) {
  const td = useTranslations("caja.detalle");
  if (devoluciones.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <h3 className="border-b border-destructive/20 px-4 py-2.5 text-sm font-semibold text-destructive">
        {td("devoluciones")} <span className="font-normal">({devoluciones.length})</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-semibold">{td("colNumero")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colFacturaOrigen")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colPaciente")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colFormaReembolso")}</th>
              <th className="px-4 py-2 text-right font-semibold">{td("colMonto")}</th>
              <th className="px-4 py-2 text-left font-semibold">{td("colMotivo")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {devoluciones.map((dev) => (
              <tr key={dev.id}>
                <td className="px-4 py-2 font-mono tabular-nums">{numero(dev)}</td>
                <td className="px-4 py-2 font-mono tabular-nums">{dev.invoiceNumber || "—"}</td>
                <td className="px-4 py-2">
                  {dev.patient || "—"}
                  {dev.medicalRecordNumber && <span className="ml-1 text-xs text-muted-foreground">#{dev.medicalRecordNumber}</span>}
                </td>
                <td className="px-4 py-2">{dev.refundMethod || "—"}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums text-destructive">−{money(dev.refundedAmount)}</td>
                <td className="px-4 py-2 text-muted-foreground">{dev.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The same block for the printed sheet (its own window, plain HTML). */
export function devolucionesPrintHtml(
  devoluciones: Devolucion[],
  L: Record<string, string>,
  esc: (s: unknown) => string,
): string {
  if (devoluciones.length === 0) return "";
  const rows = devoluciones
    .map(
      (d) =>
        `<tr><td class="mono">${esc(numero(d))}</td><td class="mono">${esc(d.invoiceNumber || "—")}</td><td>${esc(d.patient || "—")}${d.medicalRecordNumber ? ` <span class="dim">#${esc(d.medicalRecordNumber)}</span>` : ""}</td><td>${esc(d.refundMethod || "—")}</td><td class="r mono rojo">−${esc(money(d.refundedAmount))}</td><td class="dim">${esc(d.reason || "—")}</td></tr>`,
    )
    .join("");
  return `<h2 class="rojo">${esc(L.devoluciones)} (${devoluciones.length})</h2>
    <table>
      <thead><tr><th>${esc(L.colNumero)}</th><th>${esc(L.colFacturaOrigen)}</th><th>${esc(L.colPaciente)}</th><th>${esc(L.colFormaReembolso)}</th><th class="r">${esc(L.colMonto)}</th><th>${esc(L.colMotivo)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
