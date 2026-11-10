"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { FormatoArmado, FormatoCampo, FormatoFirmaLinea, FormatoSeccion } from "@/lib/api/formatos";
import { legacyDay } from "@/lib/formatos/mls-sheet";
import { Button } from "@/components/ui/button";
import { imprimirFormato, PieFormato } from "@/components/frontdesk/formato-parts";

// The legacy «record» sheet (Sueroterapia Vit C, BPC-157, Plaquex — .personal/formatos-legacy/): centred
// company / center / title over a grey rule; one row per field (label | value) on a thin rule; the
// OBSERVACIONES box; ENFERMERO(A) | HORA, then FIRMA DEL PACIENTE and the grey signature band; f-b/ at
// the right. GenericFormatoRender hands over on lib/formatos/record-sheet.ts. Inline styles: the sheet is
// cloned into its own print window.

type Label = (key?: string | null, fallback?: string) => string;

const RULE = "1px solid #c8c8c8";

export function RecordSheet({ d, label, onVolver }: { d: FormatoArmado; label: Label; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const printRef = React.useRef<HTMLDivElement>(null);
  const obs = d.sections?.find((s): s is Extract<FormatoSeccion, { tipo: "texto_libre" }> => s.tipo === "texto_libre");
  const firmas = d.sections?.find((s): s is Extract<FormatoSeccion, { tipo: "firmas" }> => s.tipo === "firmas");
  const lineas = firmas?.lineas ?? [];
  const fieldLabel = (c: FormatoCampo) => c.label ?? label(c.labelKey, c.clave);
  const valueOf = (c: FormatoCampo) => (c.origen === "sesion.fecha" ? legacyDay(c.valor, "/") || c.valor : c.valor) ?? "";
  const lineText = (l: FormatoFirmaLinea) => (typeof l === "string" ? label(l, l) : (l.label ?? label(l.labelKey)));

  const sign = (l: FormatoFirmaLinea | undefined, key: string) =>
    l ? (
      <div key={key}>
        <div>{lineText(l)}</div>
        <div style={{ borderBottom: RULE, height: 14, marginTop: 4 }}>{typeof l === "string" ? "" : (l.valor ?? "")}</div>
      </div>
    ) : (
      <div key={key} />
    );

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, d.title)}>{t("imprimirPdf")}</Button>
      </div>

      <div ref={printRef} className="formato-print rounded-lg border bg-white p-6 text-black">
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", fontSize: 10 }}>
          <div style={{ textAlign: "center", paddingBottom: 14, borderBottom: RULE }}>
            {!d.letterhead?.ocultarEmpresa && <div style={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase" }}>{t("formatoEmpresa")}</div>}
            {d.letterhead?.center && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{d.letterhead.center}</div>}
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>{d.title}</div>
          </div>

          <div style={{ marginTop: 18 }}>
            {(d.fields ?? []).map((c) => (
              <div key={c.clave} style={{ display: "grid", gridTemplateColumns: "22% 1fr", padding: "7px 0 5px", borderBottom: RULE }}>
                <b>{fieldLabel(c)}</b>
                <span>{valueOf(c)}</span>
              </div>
            ))}
          </div>

          {obs && (
            <div style={{ marginTop: 18 }}>
              <b>{obs.titulo ?? label(obs.labelKey)}</b>
              <div style={{ border: RULE, height: 290, marginTop: 8 }} />
            </div>
          )}

          {lineas.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "48% 48%", justifyContent: "space-between", rowGap: 16, marginTop: 30 }}>
              {sign(lineas[0], "a")}
              {sign(lineas[1], "b")}
              {lineas.slice(2).map((l, i) => sign(l, `c${i}`))}
              {/* The grey signature band at the right of the last row, as the legacy prints it. */}
              {lineas.length % 2 === 1 && <div style={{ background: "#f0f0f0", height: 36, width: "62%", justifySelf: "end", alignSelf: "end" }} />}
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <PieFormato pie={d.footer} align="right" />
          </div>
        </div>
      </div>
    </div>
  );
}
