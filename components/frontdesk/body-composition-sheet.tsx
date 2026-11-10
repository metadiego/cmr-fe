"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { FormatoArmado, FormatoCampo, FormatoSeccion } from "@/lib/api/formatos";
import { headerLines, isMeasured, isTickBox } from "@/lib/formatos/body-composition";
import { Button } from "@/components/ui/button";
import { imprimirFormato, PieFormato } from "@/components/frontdesk/formato-parts";

// The GLP-1 body-composition sheet, drawn like the legacy (.personal/formatos-legacy/Glp-1.pdf), on ONE
// letter page: centred company / center / title; NOMBRE · RECORD · PESO, then SESION #; the dose grid
// with its tick boxes; the OBSERVACIONES box; Composición Corporal | the body (man or woman, already
// chosen by the BE from the patient's sex in render.imagenCuerpo) | Medidas Corporales; the signature
// line; the f-b/ foot at the right. Used by GenericFormatoRender when the format carries those two
// sections and the body image. Inline styles: the sheet is cloned into its own print window.

type Seccion<T extends FormatoSeccion["tipo"]> = Extract<FormatoSeccion, { tipo: T }>;
type Label = (key?: string | null, fallback?: string) => string;

const BORDER = "1px solid #000";
const SOFT = "1px solid #bbb";

export function BodyCompositionSheet({
  d,
  label,
  composicion,
  medidas,
  onVolver,
}: {
  d: FormatoArmado;
  label: Label;
  composicion: Seccion<"campos">;
  medidas: Seccion<"campos">;
  onVolver: () => void;
}) {
  const t = useTranslations("frontdesk");
  const printRef = React.useRef<HTMLDivElement>(null);
  const secciones = d.sections ?? [];
  const dosis = secciones.find((s): s is Seccion<"tabla_tematica"> => s.tipo === "tabla_tematica");
  const obs = secciones.find((s): s is Seccion<"texto_libre"> => s.tipo === "texto_libre");
  const firmas = secciones.find((s): s is Seccion<"campos"> => s.tipo === "campos" && s !== composicion && s !== medidas);
  const { first, second } = headerLines(d.fields ?? []);
  const body = typeof d.render?.imagenCuerpo === "string" ? d.render.imagenCuerpo : null;
  const fieldLabel = (c: FormatoCampo) => c.label ?? label(c.labelKey, c.clave);
  const sesion = second[0]?.valor ?? "";

  const headerField = (c: FormatoCampo) => (
    <span key={c.clave} style={{ marginRight: 14 }}>
      <b>{fieldLabel(c)}</b>{" "}
      {isMeasured(c) ? (
        <span style={{ display: "inline-block", minWidth: 70, borderBottom: BORDER, textAlign: "center", padding: "0 4px" }}>{c.valor || " "}</span>
      ) : (
        c.valor
      )}
    </span>
  );

  // One side box (Composición / Medidas): title centred over a rule, then label + value over its line.
  const sideBox = (s: Seccion<"campos">) => (
    <div style={{ border: SOFT, borderRadius: 6, padding: "10px 10px 12px", fontSize: 10.5 }}>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 12, textTransform: "uppercase", paddingBottom: 6, borderBottom: BORDER, margin: "0 6px 10px" }}>
        {s.titulo ?? label(s.labelKey)}
      </div>
      {s.campos.map((c) => (
        <div key={c.clave} style={{ display: "grid", gridTemplateColumns: "1fr 46%", alignItems: "end", gap: 6, minHeight: 20 }}>
          <span>{fieldLabel(c)}</span>
          <span style={{ borderBottom: BORDER, textAlign: "center", minHeight: 14 }}>{c.valor || " "}</span>
        </div>
      ))}
    </div>
  );

  const cols = dosis?.cabecera?.[dosis.cabecera.length - 1] ?? [];

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, d.title)}>{t("imprimirPdf")}</Button>
      </div>

      <div ref={printRef} className="formato-print rounded-lg border bg-white p-5 text-black">
        <div className="formato-doc" style={{ display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif", color: "#000" }}>
          <div style={{ textAlign: "center", paddingBottom: 6, borderBottom: SOFT }}>
            {!d.letterhead?.ocultarEmpresa && <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{t("formatoEmpresa")}</div>}
            {d.letterhead?.center && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{d.letterhead.center}</div>}
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginTop: 3 }}>{d.title}</div>
          </div>

          <div style={{ fontSize: 10.5, marginTop: 6 }}>{first.map(headerField)}</div>
          {second.length > 0 && <div style={{ fontSize: 10.5, marginTop: 3 }}>{second.map(headerField)}</div>}

          {dosis && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 9.5 }}>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.clave} style={{ border: BORDER, background: "#f0f0f0", padding: "3px 4px", textAlign: "center", fontWeight: 700 }}>
                      {c.label ?? label(c.labelKey, c.clave)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dosis.filas ?? []).map((f, ri) => (
                  <tr key={ri}>
                    {cols.map((c, ci) => {
                      const v = f?.[c.clave];
                      return (
                        <td key={c.clave} style={{ border: BORDER, textAlign: "center", verticalAlign: "middle", height: isTickBox(v) ? 34 : 26, fontWeight: ci === 0 ? 400 : 700 }}>
                          {isTickBox(v) ? (
                            <span style={{ display: "inline-block", width: 15, height: 15, border: "1.5px solid #000" }} />
                          ) : typeof v === "string" ? (
                            v
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {obs && (
            <div style={{ border: SOFT, borderRadius: 4, padding: "6px 8px 8px", marginTop: 8, fontSize: 10 }}>
              <b style={{ textTransform: "uppercase" }}>{obs.titulo ?? label(obs.labelKey)}</b>
              {Array.from({ length: Math.max(1, obs.lineas ?? 3) }).map((_, i) => (
                <div key={i} style={{ borderBottom: "1px solid #555", height: 19 }} />
              ))}
            </div>
          )}

          {/* Composición | the body | Medidas — the boxes centred on the figure, as in the legacy. */}
          <div style={{ display: "grid", gridTemplateColumns: "25% 1fr 25%", alignItems: "center", gap: 10, flex: "1 1 auto", marginTop: 10 }}>
            {sideBox(composicion)}
            {body ? (
              // eslint-disable-next-line @next/next/no-img-element -- cloned into a print window; next/image does not survive it.
              <img src={body} alt="" style={{ display: "block", height: 520, maxHeight: 520, width: "auto", maxWidth: "100%", margin: "0 auto", objectFit: "contain" }} />
            ) : (
              <div />
            )}
            {sideBox(medidas)}
          </div>

          {firmas && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: BORDER, paddingTop: 8, marginTop: 10, fontSize: 10.5 }}>
              {firmas.campos.map((c) => (
                <span key={c.clave} style={{ display: "flex", alignItems: "end", gap: 6, flex: 1 }}>
                  <b style={{ whiteSpace: "nowrap" }}>{fieldLabel(c)}</b>
                  <span style={{ flex: 1, borderBottom: BORDER, minHeight: 14 }}>{c.valor || " "}</span>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 14 }}>
            <PieFormato pie={d.footer} align="right" />
            {sesion && <span style={{ fontSize: 10, color: "#666" }}>{t("formatoPage", { page: sesion })}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
