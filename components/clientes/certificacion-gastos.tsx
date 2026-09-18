"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getCertificacionGastos, type CertificacionGastos as Cert } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Certificación de gastos (legado) dentro de la ficha. El BE ya suma por concepto (grupo de
// facturación) con las devoluciones RESTADAS; el FE solo elige el rango, muestra y arma el DOCUMENTO
// (persona autorizada + trato Sr./Sra. + pie de la clínica + periodo). Si `cuadre.cuadra===false` NO
// se imprime. Handoff ficha-del-paciente-hub-y-certificacion-de-gastos.
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

function anioEnCurso(): { desde: string; hasta: string } {
  const y = new Date().getFullYear();
  return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
}

export function CertificacionGastos({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("certificacionGastos");
  const tRoot = useTranslations();
  const [{ desde, hasta }, setRango] = React.useState(anioEnCurso);
  const [persona, setPersona] = React.useState("");
  const [trato, setTrato] = React.useState<"sr" | "sra">("sr");

  const { state } = useResource<Cert>(
    () => getCertificacionGastos(pacienteId, desde, hasta, centro),
    [pacienteId, desde, hasta, centro],
  );
  const data = state.kind === "ok" ? state.data : null;
  const cuadra = data ? data.cuadre.cuadra !== false : true;
  const puedeImprimir = !!data && cuadra && data.total > 0;
  const nombreConcepto = (c: { labelKey: string; clave: string }) =>
    tRoot.has(c.labelKey) ? tRoot(c.labelKey) : c.clave;

  function imprimir() {
    if (!data || !puedeImprimir) return;
    const filas = data.conceptos
      .map(
        (c) =>
          `<tr><td>${esc(nombreConcepto(c))}</td><td class="num">${money.format(c.total)}</td></tr>`,
      )
      .join("");
    const tratoLabel = trato === "sra" ? t("sra") : t("sr");
    const rec = data.paciente.record ? ` · ${t("record")} ${esc(String(data.paciente.record))}` : "";
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t("title"))}</title>
      <style>
        @page { margin: 2.5cm; }
        html,body{margin:0}
        body{font-family:Georgia,'Times New Roman',serif;color:#111;min-height:100vh;display:flex;flex-direction:column;padding:0 8mm}
        .head{text-align:center;margin-bottom:1.5rem}
        .head img{height:70px}
        .clinic{font-weight:bold;font-size:1.05rem;margin-top:.4rem}
        h1{text-align:center;font-size:1.15rem;letter-spacing:.04em;text-transform:uppercase;margin:1.5rem 0}
        .body{font-size:1rem;line-height:1.9;flex:1}
        table{width:100%;border-collapse:collapse;margin:1.2rem 0}
        th,td{border-bottom:1px solid #999;padding:.5rem .3rem;text-align:left}
        th.num,td.num{text-align:right;font-variant-numeric:tabular-nums}
        .total td{border-top:2px solid #111;border-bottom:none;font-weight:bold}
        .foot{margin-top:3.5rem;font-size:.95rem}
        .firma{margin-top:3rem;border-top:1px solid #111;width:60%;padding-top:.3rem}
        .muted{color:#555;font-size:.85rem}
      </style></head><body>
      <div class="head"><img src="/img/logo_cmr.png" alt=""><div class="clinic">Centro de Medicina Regenerativa</div></div>
      <h1>${esc(t("title"))}</h1>
      <div class="body">
        <p>${esc(t("bodyIntro", { trato: tratoLabel, persona: persona.trim() || "____________________" }))}</p>
        <p>${esc(t("bodyPatient", { nombre: data.paciente.nombre }))}${rec}, ${esc(t("bodyPeriod", { desde, hasta }))}</p>
        <table>
          <thead><tr><th>${esc(t("concept"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr class="total"><td>${esc(t("total"))}</td><td class="num">${money.format(data.total)}</td></tr></tfoot>
        </table>
      </div>
      <div class="foot">
        <p>${esc(t("footNote"))}</p>
        <div class="firma">${esc(t("clinicSignature"))}</div>
        <p class="muted">${esc(t("issuedOn", { fecha: new Date().toLocaleDateString("es-PR") }))}</p>
      </div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=820,height=1060");
    if (!w) return;
    w.document.open();
    w.document.write(doc);
    w.document.close();
  }

  return (
    <div className="space-y-4">
      {/* Rango (año en curso por defecto) + campos del documento */}
      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card p-4 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <div className="space-y-1">
          <Label htmlFor="cg-desde">{t("from")}</Label>
          <Input id="cg-desde" type="date" value={desde} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cg-hasta">{t("to")}</Label>
          <Input id="cg-hasta" type="date" value={hasta} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>{t("treatment")}</Label>
          <Select value={trato} onValueChange={(v) => setTrato(v as "sr" | "sra")}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sr">{t("sr")}</SelectItem>
              <SelectItem value="sra">{t("sra")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-56 flex-1 space-y-1">
          <Label htmlFor="cg-persona">{t("authorizedPerson")}</Label>
          <Input id="cg-persona" value={persona} onChange={(e) => setPersona(e.target.value)} placeholder={t("authorizedPersonPh")} />
        </div>
        <Button type="button" onClick={imprimir} disabled={!puedeImprimir}>{t("print")}</Button>
      </div>

      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
      {state.kind === "fail" && <p className="text-sm text-destructive">{state.message}</p>}
      {data && !cuadra && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{t("noCuadra")}</p>
      )}

      {data && (
        <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("concept")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("invoices")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("refunds")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {data.conceptos.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("empty")}</td></tr>
              ) : (
                data.conceptos.map((c) => (
                  <tr key={c.clave} className="border-t">
                    <td className="px-3 py-2">{nombreConcepto(c)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.facturas}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.devoluciones ? money.format(c.devoluciones) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money.format(c.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.conceptos.length > 0 && (
              <tfoot>
                <tr className="border-t-2">
                  <td className="px-3 py-2 font-semibold" colSpan={3}>{t("total")}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{money.format(data.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
