"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getFormato, type LaserParametro } from "@/lib/api/laser";
import { useResource } from "@/hooks/use-resource";
import { hiltPages } from "@/lib/formatos/hilt-sheet";
import { cell } from "@/lib/formatos/mls-sheet";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/frontdesk/signature-pad";
import { LogoFormato, imprimirFormato, PieFormato } from "@/components/frontdesk/formato-parts";
import { BORDER, LineInput, PatientLine, SHEET, TD, TH, type LaserSheetHeader } from "@/components/frontdesk/laser-sheet-parts";

// The HILT laser sheet, drawn like the legacy «HILT Form» (.personal/formatos-legacy/HILT Form.pdf).
// Sheet 1: logo left and «HILT» centred, the patient line, the regions that fit (lib/formatos/hilt-sheet),
// the Comentarios box, Trigger Point Sí/No, the hand-filled fields in two columns, the pain scale.
// Sheet 2: the patient line again and the remaining regions; the f-b/ foot closes it at the right (the
// legacy spilled it onto an empty third sheet).

type Region = { region: string; filas: LaserParametro[] };

const ROW: React.CSSProperties = { ...TD, height: 18, padding: "1px 4px" };

export function HiltSheet({ centro, header, onVolver }: { centro?: string; header: LaserSheetHeader; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const th = useTranslations("frontdesk.hilt");
  const res = useResource(() => getFormato("hilt", centro), [centro]);
  const [si, setSi] = React.useState("");
  const [no, setNo] = React.useState("");
  const [horaIn, setHoraIn] = React.useState("");
  const [horaOut, setHoraOut] = React.useState("");
  const printRef = React.useRef<HTMLDivElement>(null);

  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">…</p>;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{t("formatoError")} — {res.state.message}</p>;
  if (res.state.kind !== "ok") return null;
  const data = res.state.data;
  if (data.type !== "hilt") return null;
  const { first, second } = hiltPages<Region>(data.sections ?? []);
  const labels = { paciente: th("paciente"), fecha: th("fecha"), record: th("record") };

  const table = (regions: Region[]) => (
    <table style={{ width: "100%", borderCollapse: "collapse", margin: 0 }}>
      <thead>
        <tr>
          <th rowSpan={2} style={{ ...TH, width: "38%" }}>{th("patologia")}</th>
          {[1, 2, 3].map((n) => (
            <th key={n} colSpan={2} style={TH}>{th("step", { n })}</th>
          ))}
          <th rowSpan={2} style={{ ...TH, width: "15%" }}>{th("totEnergy")}</th>
        </tr>
        <tr>
          {[1, 2, 3].map((n) => (
            <React.Fragment key={n}>
              <th style={{ ...TH, background: "#fff" }}>{th("mjcm")}</th>
              <th style={{ ...TH, background: "#fff" }}>{th("hz")}</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {regions.map((r) => (
          <React.Fragment key={r.region}>
            <tr>
              <td colSpan={8} style={{ ...ROW, background: "#f0f0f0", fontWeight: 700 }}>{r.region}</td>
            </tr>
            {r.filas.map((f) => (
              <tr key={f.id}>
                <td style={ROW}>{f.pathology ?? f.patologia ?? ""}</td>
                <td style={ROW}>{cell(f.stp1Mjcm)}</td>
                <td style={ROW}>{cell(f.stp1Hz)}</td>
                <td style={ROW}>{cell(f.stp2Mjcm)}</td>
                <td style={ROW}>{cell(f.stp2Hz)}</td>
                <td style={ROW}>{cell(f.stp3Mjcm)}</td>
                <td style={ROW}>{cell(f.stp3Hz)}</td>
                <td style={ROW}>{cell(f.energy)}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );

  // One field of the two-column block: the label, the value over its own line, the row underlined.
  const field = (label: string, value: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "50% 1fr", alignItems: "end", gap: 8, fontSize: 10.5, minHeight: 24, paddingBottom: 3, borderBottom: BORDER }}>
      <span>{label}</span>
      <span style={{ borderBottom: BORDER, minHeight: 15, padding: "0 4px", fontWeight: 700 }}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, th("title"))}>{t("imprimirPdf")}</Button>
      </div>

      <div ref={printRef} className="formato-print rounded-lg border bg-white p-5 text-black">
        <div style={SHEET}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 40 }}>
            <div style={{ position: "absolute", left: 0, top: 0 }}>
              <LogoFormato logoUrl={data.letterhead?.logoUrl} size={30} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{th("title")}</div>
          </div>
          <PatientLine header={header} labels={labels} layout="spread" style={{ marginTop: 12 }} />
          <div style={{ marginTop: 10 }}>{table(first)}</div>

          <div style={{ border: BORDER, minHeight: 40, padding: "10px 8px", marginTop: 12, fontSize: 10.5 }}>{th("comentarios")}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 4, marginTop: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "50% 1fr 1fr", alignItems: "end", gap: 6, fontSize: 10.5, minHeight: 24, paddingBottom: 3, borderBottom: BORDER }}>
              <span>{th("triggerPoint")}</span>
              <span style={{ display: "flex", gap: 4 }}>{th("si")}<span style={{ flex: 1, borderBottom: BORDER }}><LineInput value={si} onChange={setSi} label={th("si")} /></span></span>
              <span style={{ display: "flex", gap: 4 }}>{th("no")}<span style={{ flex: 1, borderBottom: BORDER }}><LineInput value={no} onChange={setNo} label={th("no")} /></span></span>
            </div>
            <div />
            {field(th("tecnico"), header.tecnico)}
            {field(th("horaEntrada"), <LineInput value={horaIn} onChange={setHoraIn} label={th("horaEntrada")} />)}
            {field(th("proxima"), header.proximaCita)}
            {field(th("horaSalida"), <LineInput value={horaOut} onChange={setHoraOut} label={th("horaSalida")} />)}
            {field(th("nTerapias"), header.sesion)}
            {field(th("firma"), <SignaturePad height={26} bare />)}
          </div>

          {/* The pain scale at the legacy size (the print CSS caps img at 38px; inline wins). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- cloned into a print window; next/image does not survive it. */}
          <img src="/img/pain_measurement_scale.png" alt={t("escalaDolorAlt")} style={{ width: "36%", maxWidth: "36%", maxHeight: "none", margin: "18px auto 0", display: "block" }} />
        </div>

        {second.length > 0 && (
          <div style={{ ...SHEET, breakBefore: "page", pageBreakBefore: "always", marginTop: 24 }}>
            <PatientLine header={header} labels={labels} layout="spread" />
            <div style={{ marginTop: 6 }}>{table(second)}</div>
          </div>
        )}
        <PieFormato pie={data.footer} align="right" />
      </div>
    </div>
  );
}
