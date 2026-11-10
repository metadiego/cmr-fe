"use client";

import * as React from "react";

import { legacyDay } from "@/lib/formatos/mls-sheet";

// Pieces the legacy laser sheets (MLS, HILT) share. Inline styles only: each sheet is cloned into its own
// print window (formato-parts imprimirFormato), where the app's CSS does not exist.

export type LaserSheetHeader = { paciente: string; record: string; sesion: string; tecnico: string; proximaCita: string; fecha: string };

export const BORDER = "1px solid #000";
export const TH: React.CSSProperties = { border: BORDER, background: "#f0f0f0", padding: "3px 4px", textAlign: "center", verticalAlign: "middle", fontWeight: 700, fontSize: 10 };
export const TD: React.CSSProperties = { border: BORDER, padding: "2px 4px", height: 21, textAlign: "center", verticalAlign: "middle", fontSize: 10 };
export const SHEET: React.CSSProperties = { display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif", color: "#000" };

/**
 * «Paciente : NAME · Fecha : MM-DD-YYYY · Record # N», the legacy's one header line. MLS sets the three in
 * fixed columns («columns»); HILT spreads them to the left, the centre and the right («spread»).
 */
export function PatientLine({
  header,
  labels,
  layout = "columns",
  style,
}: {
  header: LaserSheetHeader;
  labels: { paciente: string; fecha: string; record: string };
  layout?: "columns" | "spread";
  style?: React.CSSProperties;
}) {
  const spread = layout === "spread";
  return (
    <div style={{ display: "grid", gridTemplateColumns: spread ? "1fr 1fr 1fr" : "38% 32% 30%", fontSize: 10.5, ...style }}>
      <span>{labels.paciente} <b>{header.paciente}</b></span>
      <span style={{ textAlign: spread ? "center" : "left" }}>{labels.fecha} {legacyDay(header.fecha)}</span>
      <span style={{ textAlign: spread ? "right" : "left" }}>{labels.record} <b>{header.record}</b></span>
    </div>
  );
}

/** A hand-filled value typed on screen; on paper it is the text alone, bold. */
export function LineInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ border: 0, background: "transparent", font: "inherit", fontWeight: 700, padding: 0, outline: "none", width: "100%" }}
    />
  );
}
