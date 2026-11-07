"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { getCertificacionGastos, type CertificacionGastos as Cert } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });

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
  const [expandido, setExpandido] = React.useState<Set<string>>(new Set());
  const qsCentro = centro ? `?centro=${encodeURIComponent(centro)}` : "";
  const dia = (iso: string) => { const d = parseDayUTC(iso); return d ? dayFmt.format(d) : iso; };

  const { state } = useResource<Cert>(
    () => getCertificacionGastos(pacienteId, desde, hasta, centro),
    [pacienteId, desde, hasta, centro],
  );
  const data = state.kind === "ok" ? state.data : null;
  // Defensivo: la respuesta puede venir sin `cuadre`/`conceptos`/`total` (p. ej. paciente sin gastos),
  // y un acceso directo tumbaba la pestaña. Optional chaining + defaults en todo lo que viene del BE.
  const conceptos = data?.conceptos ?? [];
  const total = data?.total ?? 0;
  const cuadra = data?.reconciliation?.cuadra !== false;
  const puedeImprimir = !!data && cuadra && total > 0;
  const nombreConcepto = (c: { labelKey: string; slug: string }) =>
    tRoot.has(c.labelKey) ? tRoot(c.labelKey) : c.slug;

  function imprimir() {
    if (!data || !puedeImprimir) return;
    const filas = conceptos
      .map(
        (c) =>
          `<tr><td>${esc(nombreConcepto(c))}</td><td class="num">${money.format(c.total)}</td></tr>`,
      )
      .join("");
    const tratoLabel = trato === "sra" ? t("sra") : t("sr");
    const rec = data.patient?.medicalRecordNumber ? ` · ${t("record")} ${esc(String(data.patient.medicalRecordNumber))}` : "";
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
        <p>${esc(t("bodyPatient", { nombre: data.patient?.name ?? "" }))}${rec}, ${esc(t("bodyPeriod", { desde, hasta }))}</p>
        <table>
          <thead><tr><th>${esc(t("concept"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr class="total"><td>${esc(t("total"))}</td><td class="num">${money.format(total)}</td></tr></tfoot>
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
          <DatePicker id="cg-desde" value={desde} onChange={(v) => setRango((r) => ({ ...r, desde: v }))} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cg-hasta">{t("to")}</Label>
          <DatePicker id="cg-hasta" value={hasta} onChange={(v) => setRango((r) => ({ ...r, hasta: v }))} className="w-40" />
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
              {conceptos.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("empty")}</td></tr>
              ) : (
                conceptos.map((c) => {
                  const tieneDetalle = !!c.detail?.length;
                  const abierto = expandido.has(c.slug);
                  return (
                    <React.Fragment key={c.slug}>
                      <tr className={"border-t " + (tieneDetalle ? "cursor-pointer hover:bg-muted/30" : "")} onClick={() => tieneDetalle && setExpandido((s) => { const n = new Set(s); if (n.has(c.slug)) n.delete(c.slug); else n.add(c.slug); return n; })}>
                        <td className="px-3 py-2">
                          {tieneDetalle && <span className="mr-1.5 inline-block w-3 text-muted-foreground">{abierto ? "▾" : "▸"}</span>}
                          {nombreConcepto(c)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.invoices}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.refunds ? money.format(c.refunds) : "—"}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{money.format(c.total)}</td>
                      </tr>
                      {abierto && tieneDetalle && (
                        <tr className="border-t bg-muted/20">
                          <td colSpan={4} className="px-3 py-2">
                            <table className="w-full text-xs">
                              <tbody>
                                {c.detail!.map((f) => (
                                  <React.Fragment key={f.invoiceId}>
                                    <tr>
                                      <td className="py-1 pl-4 font-mono">
                                        <Link href={`/billing/invoices/${f.invoiceId}${qsCentro}`} className="text-primary underline-offset-2 hover:underline">{f.number || "—"}</Link>
                                      </td>
                                      <td className="py-1 tabular-nums text-muted-foreground">{dia(f.date)}</td>
                                      <td colSpan={2} />
                                    </tr>
                                    {f.lines.map((l) => (
                                      <tr key={l.invoiceItemId}>
                                        <td colSpan={2} className="py-0.5 pl-10 text-muted-foreground">
                                          <Link href={`/inventory/products`} className="hover:underline hover:text-foreground">{l.description}</Link>
                                        </td>
                                        <td colSpan={1} />
                                        <td className="py-0.5 text-right tabular-nums text-muted-foreground">{money.format(l.amount)}</td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {conceptos.length > 0 && (
              <tfoot>
                <tr className="border-t-2">
                  <td className="px-3 py-2 font-semibold" colSpan={3}>{t("total")}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{money.format(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
