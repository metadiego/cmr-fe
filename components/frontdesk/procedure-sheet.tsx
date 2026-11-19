"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { FormatoArmado, FormatoCampo, FormatoFirmaLinea, FormatoSeccion } from "@/lib/api/formatos";
import { chunkPairs } from "@/lib/formatos/inline-fields";
import { legacyDay } from "@/lib/formatos/mls-sheet";
import { isTickBox } from "@/lib/formatos/body-composition";
import { Button } from "@/components/ui/button";
import { imprimirFormato, LogoFormato, PieFormato } from "@/components/frontdesk/formato-parts";

// The legacy procedure sheet (APEX, EMPOWER RF, V-TONE, MORPHEUS8 — .personal/formatos-legacy/): the logo
// large and centred, the title under it; the header fields in pairs, each value over its line; the
// procedure table with its blue header and the descriptions in blue; the serial numbers one per line;
// «Observaciones:» and its lines; «Firmas:» and one signature per line; the f-b/ foot at the right.
// GenericFormatoRender hands over on the data (layout «campos» + render.camposEnPares + a coloured
// tabla_tematica), never on the slug. Inline styles: the sheet is cloned into its own print window.

type Seccion<T extends FormatoSeccion["tipo"]> = Extract<FormatoSeccion, { tipo: T }>;
type Label = (key?: string | null, fallback?: string) => string;

const BORDER = "1px solid #000";
const BLUE_TEXT = "#1f6fb2";

export function ProcedureSheet({ d, label, onVolver }: { d: FormatoArmado; label: Label; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const printRef = React.useRef<HTMLDivElement>(null);
  const fieldLabel = (c: FormatoCampo) => c.label ?? label(c.labelKey, c.clave);
  const valueOf = (c: FormatoCampo) => (c.origen === "sesion.fecha" ? legacyDay(c.valor, "/") || c.valor : c.valor) || " ";
  const lineText = (l: FormatoFirmaLinea) => (typeof l === "string" ? label(l, l) : (l.label ?? label(l.labelKey)));

  const valueLine = (c: FormatoCampo, style: React.CSSProperties) => (
    <span style={{ display: "inline-block", borderBottom: BORDER, padding: "0 2px", minHeight: 16, ...style }}>{valueOf(c)}</span>
  );

  const table = (s: Seccion<"tabla_tematica">) => {
    const head = s.cabecera ?? [];
    const cols = head[head.length - 1] ?? [];
    const bg = s.colorHeader ?? "#5b9bd5";
    return (
      <table key={s.clave ?? "tabla"} style={{ width: "100%", borderCollapse: "collapse", marginTop: 22, fontSize: 10.5 }}>
        <thead>
          {head.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <th key={ci} style={{ border: BORDER, background: bg, color: "#fff", padding: "8px 6px", textAlign: "center", verticalAlign: "middle", fontWeight: 700 }}>
                  {c.label ?? label(c.labelKey, c.clave)}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {(s.filas ?? []).map((f, ri) => (
            <tr key={ri}>
              {cols.map((c, ci) => {
                const v = f?.[c.clave];
                return (
                  <td
                    key={c.clave}
                    style={{ border: BORDER, height: 48, padding: "4px 6px", verticalAlign: "middle", textAlign: ci === 0 ? "left" : "center", ...(ci === 0 ? { color: s.colorDescCol ?? BLUE_TEXT, fontWeight: 700 } : {}) }}
                  >
                    {isTickBox(v) ? <span style={{ display: "inline-block", width: 13, height: 13, border: BORDER }} /> : typeof v === "string" ? v : null}
                  </td>
                );
              })}
            </tr>
          ))}
          {Array.from({ length: Math.max(0, s.filasEnBlanco ?? 0) }).map((_, ri) => (
            <tr key={`b${ri}`}>
              {cols.map((c) => (
                <td key={c.clave} style={{ border: BORDER, height: 48 }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const section = (s: FormatoSeccion, i: number) => {
    if (s.tipo === "tabla_tematica") return table(s);
    if (s.tipo === "campos")
      return (
        <div key={s.clave ?? i} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {s.campos.map((c) => (
            <div key={c.clave}>
              <b>{fieldLabel(c)}</b> {valueLine(c, { width: 230 })}
            </div>
          ))}
        </div>
      );
    if (s.tipo === "texto_libre")
      return (
        <div key={s.clave ?? i} style={{ marginTop: 20 }}>
          <b>{s.titulo ?? label(s.labelKey)}</b>
          <div style={{ marginTop: 8 }}>
            {Array.from({ length: Math.max(1, s.lineas ?? 4) }).map((_, li) => (
              <div key={li} style={{ height: 26, borderBottom: BORDER }} />
            ))}
          </div>
        </div>
      );
    if (s.tipo === "firmas")
      return (
        <div key={s.clave ?? i} style={{ marginTop: 24 }}>
          <b style={{ fontStyle: "italic" }}>{t("formatoFirmas")}</b>
          {(s.lineas ?? []).map((l, li) => (
            <div key={li} style={{ display: "grid", gridTemplateColumns: "140px 260px", alignItems: "end", marginTop: 22 }}>
              <b>{lineText(l)}</b>
              <span style={{ borderBottom: BORDER, minHeight: 16 }}>{typeof l === "string" ? "" : (l.valor ?? "")}</span>
            </div>
          ))}
        </div>
      );
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, d.title)}>{t("imprimirPdf")}</Button>
      </div>

      <div ref={printRef} className="formato-print rounded-lg border bg-white p-6 text-black">
        <div className="formato-doc" style={{ display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", fontSize: 11.5 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <LogoFormato logoUrl={d.letterhead?.logoUrl} size={64} />
          </div>
          <div style={{ textAlign: "center", fontSize: 22, fontWeight: 700, marginTop: 14 }}>{d.title}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 26 }}>
            {chunkPairs(d.fields ?? []).map((pair, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24 }}>
                {pair.map((c) => (
                  <div key={c.clave} style={{ display: "flex", alignItems: "end", gap: 6, whiteSpace: "nowrap" }}>
                    <b>{fieldLabel(c)}</b>
                    {valueLine(c, { flex: 1, marginRight: 30 })}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {(d.sections ?? []).map(section)}

          <div className="formato-grow" aria-hidden style={{ flex: "1 1 auto", minHeight: 12 }} />
          <PieFormato pie={d.footer} align="right" />
        </div>
      </div>
    </div>
  );
}
