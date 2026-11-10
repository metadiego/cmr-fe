"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getFormato, type LaserParametro } from "@/lib/api/laser";
import { useResource } from "@/hooks/use-resource";
import { cell, legacyDay, sameHeight } from "@/lib/formatos/mls-sheet";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/frontdesk/signature-pad";
import { LogoFormato, imprimirFormato, PieFormato } from "@/components/frontdesk/formato-parts";

// The MLS laser sheet, drawn like the legacy «MLS Form» (.personal/formatos-legacy/MLS Form.pdf): logo
// left and «MLS» centred; Paciente / Fecha / Record on one line; the two pathology tables side by side
// (black borders, everything centred); the Comentarios box; the six hand-filled fields in two columns,
// each over its line; the patient's signature; the pain scale; the f-b/ foot at the right. Inline styles:
// the sheet is cloned into its own print window (formato-parts imprimirFormato).

export type MlsHeader = { paciente: string; record: string; sesion: string; tecnico: string; proximaCita: string; fecha: string };

const BORDER = "1px solid #000";
const TH: React.CSSProperties = { border: BORDER, background: "#f0f0f0", padding: "3px 4px", textAlign: "center", fontWeight: 700, fontSize: 10 };
const TD: React.CSSProperties = { border: BORDER, padding: "2px 4px", height: 21, textAlign: "center", verticalAlign: "middle", fontSize: 10 };
const LINE_INPUT: React.CSSProperties = { border: 0, borderBottom: BORDER, background: "transparent", font: "inherit", padding: "0 4px", outline: "none", width: "100%" };

export function MlsSheet({ centro, header, onVolver }: { centro?: string; header: MlsHeader; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const tm = useTranslations("frontdesk.mls");
  const res = useResource(() => getFormato("mls", centro), [centro]);
  const [ctd, setCtd] = React.useState("");
  const [horaIn, setHoraIn] = React.useState("");
  const [horaOut, setHoraOut] = React.useState("");
  const printRef = React.useRef<HTMLDivElement>(null);

  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">…</p>;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{t("formatoError")} — {res.state.message}</p>;
  if (res.state.kind !== "ok") return null;
  const data = res.state.data;
  if (data.type !== "mls") return null;
  const { left, right } = sameHeight(data.izquierda ?? [], data.derecha ?? []);

  const table = (rows: (LaserParametro | null)[]) => (
    <table style={{ width: "100%", borderCollapse: "collapse", margin: 0 }}>
      <thead>
        <tr>
          <th style={{ ...TH, width: "52%" }}>{tm("patologia")}</th>
          <th style={TH}>{tm("frec")}</th>
          <th style={TH}>{tm("tiempo")}</th>
          <th style={TH}>{tm("int")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((f, i) => (
          <tr key={f?.id ?? `blank-${i}`}>
            <td style={TD}>{f ? (f.pathology ?? f.patologia ?? "") : ""}</td>
            <td style={TD}>{cell(f?.frequency)}</td>
            <td style={TD}>{cell(f?.duration)}</td>
            <td style={TD}>{cell(f?.intensity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // One hand-filled field: the label, then the value written over a line (blank line when empty).
  const field = (label: string, value: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "48% 1fr", alignItems: "end", gap: 8, fontSize: 11, minHeight: 26 }}>
      <span>{label}</span>
      <span style={{ borderBottom: BORDER, minHeight: 16, padding: "0 4px", fontWeight: 700 }}>{value}</span>
    </div>
  );
  const typed = (value: string, set: (v: string) => void, label: string) => (
    <input aria-label={label} value={value} onChange={(e) => set(e.target.value)} style={{ ...LINE_INPUT, borderBottom: 0, padding: 0, fontWeight: 700 }} />
  );

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, tm("title"))}>{t("imprimirPdf")}</Button>
      </div>

      <div ref={printRef} className="formato-print rounded-lg border bg-white p-5 text-black">
        <div className="formato-doc" style={{ display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif", color: "#000" }}>
          {/* Logo left, «MLS» centred over the whole width. */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
            <div style={{ position: "absolute", left: 0, top: 0 }}>
              <LogoFormato logoUrl={data.letterhead?.logoUrl} size={34} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{tm("title")}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "38% 32% 30%", fontSize: 10.5, marginTop: 14 }}>
            <span>{tm("paciente")} <b>{header.paciente}</b></span>
            <span>{tm("fecha")} {legacyDay(header.fecha)}</span>
            <span>{tm("record")} <b>{header.record}</b></span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            {table(left)}
            {table(right)}
          </div>

          <div style={{ border: BORDER, minHeight: 70, padding: "10px 8px", marginTop: 26, fontSize: 10.5 }}>{tm("comentarios")}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 6, rowGap: 6, marginTop: 14 }}>
            {field(tm("tecnico"), header.tecnico)}
            {field(tm("horaEntrada"), typed(horaIn, setHoraIn, tm("horaEntrada")))}
            {field(tm("proxima"), header.proximaCita)}
            {field(tm("horaSalida"), typed(horaOut, setHoraOut, tm("horaSalida")))}
            {field(tm("nTerapias"), header.sesion)}
            {field(tm("ctd"), typed(ctd, setCtd, tm("ctd")))}
          </div>

          {/* «Firma del Paciente» over its line; the pad lets the patient sign on screen. */}
          <div style={{ textAlign: "center", fontSize: 10, marginTop: 22 }}>{tm("firma")}</div>
          <div style={{ width: "78%", margin: "4px auto 0", borderBottom: BORDER }}>
            <SignaturePad height={60} bare />
          </div>

          {/* The pain scale at the legacy size (the print CSS caps img at 38px; inline wins). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- cloned into a print window; next/image does not survive it. */}
          <img src="/img/pain_measurement_scale.png" alt={t("escalaDolorAlt")} style={{ width: "74%", maxWidth: "74%", maxHeight: "none", margin: "14px auto 0", display: "block" }} />

          <div className="formato-grow" aria-hidden style={{ flex: "1 1 auto" }} />
          <PieFormato pie={data.footer} align="right" />
        </div>
      </div>
    </div>
  );
}
