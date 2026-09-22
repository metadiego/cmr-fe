"use client";

import * as React from "react";

import type { FormatoColumna, FormatoSeccion, FormatoSesion } from "@/lib/api/formatos";

// Render data-driven de las secciones de un formato, para salir IDÉNTICO al legacy (modelos médicos):
// parrafo, campos intermedios, tabla_firmas (con bordes), checklist, tabla_tematica, leyenda, además de
// texto_libre (caja o líneas regladas) y firmas simples. NADA hardcodeado por formato: se dibuja lo que el
// BE emite en `sections[]`. Formas exactas en docs/specs/formatos-legacy-handoff-be.md. Se extrajo de
// formatos-modal.tsx para no pasar su techo de líneas y poder probarlo aparte.

const BORDER = "1px solid #000";
const GRAY_HEADER = "#e5e5e5";

// `label` traduce por labelKey (lo inyecta el modal, que tiene el catálogo del frontdesk); si falta, cae al
// último segmento en MAYÚSCULAS. Se pasa como prop para no duplicar el catálogo ni la lógica.
export type LabelFn = (key?: string | null, fallback?: string) => string;

// Título de sección (negrita, mayúsculas). Las secciones sin título propio (parrafo/leyenda) no lo pintan.
function Titulo({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-sm font-bold uppercase">{children}</div>;
}

// Casilla vacía para marcar a mano (☐). Compartida por checklist y las órdenes Rx (casillasEnFilas).
const Casilla = <span style={{ display: "inline-block", width: 12, height: 12, border: BORDER }} aria-hidden />;

export function SeccionInner({
  s,
  label,
  casillasEnFilas,
}: {
  s: FormatoSeccion;
  label: LabelFn;
  // Órdenes Rx: cada fila de tabla_tematica lleva un ☐ delante para marcar a mano (render.casillasEnFilas).
  casillasEnFilas?: boolean;
}) {
  switch (s.tipo) {
    case "texto_libre": {
      // OBSERVACIONES: caja que crece (por defecto) o N renglones reglados (estilo "lineas").
      const titulo = s.titulo ?? label(s.labelKey);
      if (s.estilo === "lineas") {
        const n = Math.max(1, s.lineas ?? 5);
        return (
          <>
            <Titulo>{titulo}</Titulo>
            <div>
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} style={{ borderBottom: BORDER, height: 24 }} />
              ))}
            </div>
          </>
        );
      }
      return (
        <>
          <Titulo>{titulo}</Titulo>
          <div style={{ border: "1px solid #999", flex: "1 1 auto", minHeight: `${Math.max(3, s.alto ?? 3) * 30}px` }} />
        </>
      );
    }

    case "firmas":
      // Una línea horizontal por entrada, con su etiqueta debajo (con aire arriba).
      return (
        <>
          <Titulo>{label(s.labelKey)}</Titulo>
          <div style={{ display: "flex", gap: 24, marginTop: 48 }}>
            {(s.lineas ?? []).map((linea, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderTop: BORDER, paddingTop: 4, fontSize: 10 }}>{label(linea)}</div>
              </div>
            ))}
          </div>
        </>
      );

    case "parrafo":
      // Párrafo legal estático (constancia). Justificado, con aire.
      return <p style={{ fontSize: 12, lineHeight: 1.6, textAlign: "justify", margin: "4px 0" }}>{s.texto}</p>;

    case "campos":
      // Campos intermedios (label/valor) entre título y tabla: PEMF/Cámara, Área, Número de serie…
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", fontSize: 12 }}>
          {s.campos.map((c) => (
            <div key={c.clave} style={{ display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>{label(c.labelKey)}:</span>
              <span style={{ borderBottom: BORDER, minWidth: 120, display: "inline-block" }}>{c.valor ?? ""}</span>
            </div>
          ))}
        </div>
      );

    case "tabla_firmas": {
      // Tabla de firmas CON BORDES: una columna por firmante; dentro, una fila por etiqueta (Nombre/Firma/Fecha).
      return (
        <>
          {s.labelKey && <Titulo>{label(s.labelKey)}</Titulo>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            {s.cabecera !== false && (
              <thead>
                <tr>
                  {s.columnas.map((c, i) => (
                    <th key={i} style={{ border: BORDER, background: GRAY_HEADER, padding: "6px 8px", textAlign: "left" }}>{c}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {s.filas.map((rowLabel, r) => (
                <tr key={r}>
                  {s.columnas.map((_, c) => (
                    <td key={c} style={{ border: BORDER, padding: "8px", height: 28, verticalAlign: "bottom" }}>
                      <span style={{ fontWeight: 700 }}>{rowLabel}:</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }

    case "checklist": {
      // Lista de cotejo: cabecera oscura, bandas de sección (colspan) y celdas de casilla Sí/No + observación.
      const c = s.columnas ?? {};
      const box = Casilla;
      return (
        <>
          {s.labelKey && <Titulo>{label(s.labelKey)}</Titulo>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#2b2b2b", color: "#fff" }}>
                <th style={{ border: BORDER, padding: "6px 8px", textAlign: "left" }}>{c.pregunta ?? "Pregunta"}</th>
                <th style={{ border: BORDER, padding: "6px 8px", width: 40 }}>{c.si ?? "Sí"}</th>
                <th style={{ border: BORDER, padding: "6px 8px", width: 40 }}>{c.no ?? "No"}</th>
                <th style={{ border: BORDER, padding: "6px 8px", textAlign: "left" }}>{c.obs ?? "Observación"}</th>
              </tr>
            </thead>
            <tbody>
              {s.grupos.map((g, gi) => (
                <React.Fragment key={gi}>
                  {g.titulo && (
                    <tr>
                      <td colSpan={4} style={{ border: BORDER, background: GRAY_HEADER, padding: "5px 8px", fontWeight: 700 }}>{g.titulo}</td>
                    </tr>
                  )}
                  {g.preguntas.map((p, pi) => (
                    <tr key={pi}>
                      <td style={{ border: BORDER, padding: "6px 8px" }}>{p.texto}</td>
                      <td style={{ border: BORDER, padding: "6px 8px", textAlign: "center" }}>{box}</td>
                      <td style={{ border: BORDER, padding: "6px 8px", textAlign: "center" }}>{box}</td>
                      <td style={{ border: BORDER, padding: "6px 8px" }} />
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </>
      );
    }

    case "tabla_tematica": {
      // Tabla de procedimiento: cabecera(s) de color, columna de descripción de color, filas pre-puestas + blancas.
      const headerRows = s.cabecera ?? [];
      const lastRow = headerRows[headerRows.length - 1] ?? [];
      const filas = s.filas ?? [];
      const blancas = Array.from({ length: Math.max(0, s.filasEnBlanco ?? 0) });
      const headBg = s.colorHeader ?? "#5b9bd5";
      const descBg = s.colorDescCol ?? undefined;
      return (
        <>
          {s.labelKey && <Titulo>{label(s.labelKey)}</Titulo>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              {headerRows.map((row, ri) => (
                <tr key={ri} style={{ background: headBg, color: "#fff" }}>
                  {/* Columna de casilla (órdenes Rx): cabecera vacía, solo en la última fila de cabecera. */}
                  {casillasEnFilas && <th style={{ border: BORDER, padding: "6px 8px", width: 24 }} />}
                  {row.map((col, ci) => (
                    <th key={ci} style={{ border: BORDER, padding: "6px 8px", textAlign: "left" }}>{label(col.labelKey, col.clave)}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {filas.map((f, ri) => (
                <tr key={`f${ri}`}>
                  {casillasEnFilas && <td style={{ border: BORDER, padding: "6px 8px", textAlign: "center" }}>{Casilla}</td>}
                  {lastRow.map((col, ci) => (
                    <td
                      key={ci}
                      style={{ border: BORDER, padding: "6px 8px", height: 26, ...(ci === 0 && descBg ? { background: descBg, color: "#fff", fontWeight: 700 } : {}) }}
                    >
                      {f?.[col.clave] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
              {blancas.map((_, ri) => (
                <tr key={`b${ri}`}>
                  {casillasEnFilas && <td style={{ border: BORDER, padding: "6px 8px", textAlign: "center" }}>{Casilla}</td>}
                  {lastRow.map((col, ci) => (
                    <td key={ci} style={{ border: BORDER, padding: "6px 8px", height: 26, ...(ci === 0 && descBg ? { background: descBg } : {}) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }

    case "leyenda":
      // Pie de leyenda secundario centrado (además del f-b/).
      return <p style={{ textAlign: "center", fontSize: 9, color: "#666", marginTop: 8 }}>{s.texto}</p>;

    default:
      return null;
  }
}

// Láser a color POR SESIÓN (layout "sessions"): un bloque por sesión = SESIÓN #, tabla de columnas con la
// fecha de la sesión + 1 fila en blanco, las 2 cajas de notas VACÍAS (para escribir a mano) y las firmas.
// `porPagina` sesiones por página física (salto de página impreso). Si el BE no manda sesiones (impresión en
// blanco), se pinta UN bloque vacío para que la hoja sea usable. Idéntico al legacy (nano_laser*, sueroterapia).
export function SesionesFormato({
  columns,
  sessions,
  notas,
  porPagina = 2,
  firmas,
  label,
}: {
  columns: FormatoColumna[];
  sessions: FormatoSesion[];
  notas: string[];
  porPagina?: number;
  firmas?: Extract<FormatoSeccion, { tipo: "firmas" }>;
  label: LabelFn;
}) {
  const bloques = sessions.length > 0 ? sessions : [{ sesion: null, fecha: null }];
  return (
    <div className="mt-4">
      {bloques.map((s, i) => {
        const saltar = (i + 1) % porPagina === 0 && i + 1 < bloques.length;
        return (
          <div key={i} style={{ breakInside: "avoid", pageBreakAfter: saltar ? "always" : "auto", marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              SESIÓN{s.sesion ? ` ${s.sesion}` : ""}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  {columns.map((c) => (
                    <th key={c.clave} style={{ border: BORDER, padding: "5px 8px", textAlign: "left" }}>{label(c.labelKey, c.clave)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ height: 34 }}>
                  {columns.map((c) => (
                    <td key={c.clave} style={{ border: BORDER, padding: "6px 8px", verticalAlign: "top" }}>
                      {c.clave === "fecha" ? (s.fecha ?? "") : ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {/* Dos cajas de notas VACÍAS (para escribir a mano) — legacy. */}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {(notas.length ? notas : ["", ""]).map((_, ni) => (
                <div key={ni} style={{ flex: 1, border: "1px solid #999", minHeight: 44 }} />
              ))}
            </div>
            {firmas && (
              <div className="region" style={{ marginTop: 12 }}>
                <SeccionInner s={firmas} label={label} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
