"use client";

import * as React from "react";

import type { FormatoCeldaTematica, FormatoColumna, FormatoFirmaLinea, FormatoSeccion, FormatoSegmento, FormatoSesion } from "@/lib/api/formatos";

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

// Texto de una línea de firma: el BE la manda como objeto { label, labelKey } (o, por compat, como string).
// Se PREFIERE `label`; si no, se traduce el labelKey. NUNCA se le pasa un objeto a `label()` (evita el crash).
function lineaText(linea: FormatoFirmaLinea, label: LabelFn): string {
  if (typeof linea === "string") return label(linea);
  return linea.label ?? label(linea.labelKey);
}
function lineaValor(linea: FormatoFirmaLinea): string {
  return typeof linea === "string" ? "" : (linea.valor ?? "");
}
// Etiqueta de columna: se prefiere el `label` ya listo del BE; si no, se traduce el labelKey (o cae a la clave).
function colLabel(col: FormatoColumna, label: LabelFn): string {
  return col.label ?? label(col.labelKey, col.clave);
}

// Casilla vacía para marcar a mano (☐). Compartida por checklist y las órdenes Rx (casillasEnFilas).
const Casilla = <span style={{ display: "inline-block", width: 12, height: 12, border: BORDER }} aria-hidden />;

// Un grupo de opciones con su propia casilla c/u, dentro de una celda de tabla_tematica (Peptide Rx: varios
// grupos independientes en la misma celda, p. ej. "Subcutaneously/Near Injury Site" y "Daily/Twice Daily").
function OpcionesSegmento({ opciones, vertical }: { opciones: string[]; vertical?: boolean }) {
  return (
    <span style={{ display: "flex", flexDirection: vertical ? "column" : "row", flexWrap: "wrap", gap: vertical ? 2 : "2px 10px" }}>
      {opciones.map((o, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          {Casilla} {o}
        </span>
      ))}
    </span>
  );
}

// Celda de tabla_tematica: string plano (como siempre) o segmentos (texto fijo / grupo de opciones / nota
// en cursiva), en línea uno tras otro — acordado con BE 09-oct-2026 para Peptide Rx (New Era).
function CeldaTematica({ valor }: { valor: FormatoCeldaTematica }) {
  if (valor == null) return null;
  if (typeof valor === "string") return <>{valor}</>;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {valor.segmentos.map((seg: FormatoSegmento, i: number) => {
        if ("texto" in seg) return <span key={i}>{seg.texto}</span>;
        if ("opciones" in seg) return <OpcionesSegmento key={i} opciones={seg.opciones} vertical={seg.vertical} />;
        return <span key={i} style={{ fontStyle: "italic", fontSize: 10 }}>{seg.nota}</span>;
      })}
    </span>
  );
}

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
            {/* Ruled lines that GROW: at least `n`, and the sheet's leftover height becomes more lines to
                write on — never a blank gap above the table (APEX, 04-nov-2026). */}
            <div
              style={{
                flex: "1 1 auto",
                minHeight: n * 24,
                backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 23px, #000 23px 24px)",
              }}
            />
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
      if (s.estilo === "en_linea") {
        // Legacy «LABEL: ________»: the label, then the line filling the rest of its cell; `columnas` per row.
        const cols = Math.max(1, s.columnas ?? 2);
        return (
          <>
            <Titulo>{label(s.labelKey)}</Titulo>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 40, rowGap: 22, marginTop: 28, fontSize: 12 }}>
              {(s.lineas ?? []).map((linea, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{lineaText(linea, label)}</span>
                  <span style={{ flex: 1, borderBottom: BORDER, minHeight: 18, paddingLeft: 4 }}>{lineaValor(linea)}</span>
                </div>
              ))}
            </div>
          </>
        );
      }
      // Una línea horizontal por entrada, con su etiqueta debajo (con aire arriba).
      return (
        <>
          <Titulo>{label(s.labelKey)}</Titulo>
          <div style={{ display: "flex", gap: 24, marginTop: 48 }}>
            {(s.lineas ?? []).map((linea, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderTop: BORDER, paddingTop: 4, fontSize: 10 }}>{lineaText(linea, label)}</div>
              </div>
            ))}
          </div>
        </>
      );

    case "parrafo":
      // Párrafo legal estático (constancia). Justificado, con aire. `titulo` opcional arriba; `texto` puede
      // traer "\n" entre líneas (Peptide Rx: "By signing..." + 3 líneas de reconocimiento).
      return (
        <>
          {s.titulo && <Titulo>{s.titulo}</Titulo>}
          <p
            style={{
              fontSize: s.tamano ?? 12,
              lineHeight: s.tamano ? 1.3 : 1.6,
              fontWeight: s.negrita ? 700 : undefined,
              textAlign: "justify",
              margin: "4px 0",
              whiteSpace: "pre-line",
            }}
          >
            {s.texto}
          </p>
        </>
      );

    case "campos":
      // Campos intermedios (label/valor) entre título y tabla: PEMF/Cámara, Área, Número de serie…
      // `titulo` (p. ej. "Composición Corporal", "Prescriber") se pinta igual que las demás secciones.
      return (
        <>
          {s.titulo && <Titulo>{s.titulo}</Titulo>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: s.etiquetaNormal ? "6px 16px" : "8px 24px", fontSize: s.tamano ?? 12, alignItems: "flex-end" }}>
            {s.campos.map((c) => (
              <div key={c.clave} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <span style={{ fontWeight: s.etiquetaNormal ? 400 : 700 }}>{c.label ?? `${label(c.labelKey)}:`}</span>
                <span style={{ borderBottom: BORDER, minWidth: c.ancho ?? 120, display: "inline-block" }}>{c.valor ?? ""}</span>
              </div>
            ))}
          </div>
        </>
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
      // Sin `colorHeader` explícito (p. ej. la tabla de dosis de GLP-1, que en el legado es blanco/negro
      // liso, no azul), el default es gris claro con texto negro — igual que la rejilla plana. El azul de
      // Peptide Rx/APEX RF/Empower SIEMPRE viene explícito en el payload, nunca asumido acá.
      const headBg = s.colorHeader ?? "#f2f2f2";
      const headFg = s.colorHeader ? "#fff" : "#000";
      const descBg = s.colorDescCol ?? undefined;
      // "Recommended Schedules" (Peptide Rx) manda `cabecera` con labels vacíos a propósito: esa tabla NO
      // lleva barra de encabezado en el papel. Si ningún label/subtitulo trae texto, no se pinta el <thead>.
      const hayCabecera = headerRows.some((row) => row.some((c) => (c.label ?? "").trim() !== "" || (c.subtitulo ?? "").trim() !== ""));
      // Dense order forms (layout "paginas") ask for a smaller font and a light-gray grid.
      const fs = s.tamano ?? 11;
      const bd = s.colorBorde ? `1px solid ${s.colorBorde}` : BORDER;
      const pad = s.tamano ? "4px 6px" : "6px 8px";
      return (
        <>
          {(s.titulo || s.labelKey) && <Titulo>{s.titulo ?? label(s.labelKey)}</Titulo>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs }}>
            {hayCabecera && (
              <thead>
                {headerRows.map((row, ri) => (
                  <tr key={ri} style={{ background: headBg, color: headFg }}>
                    {/* Columna de casilla (órdenes Rx): cabecera vacía, solo en la última fila de cabecera. */}
                    {casillasEnFilas && <th style={{ border: bd, padding: pad, width: 24 }} />}
                    {row.map((col, ci) => (
                      <th
                        key={ci}
                        style={{ border: bd, padding: pad, textAlign: "left", width: col.ancho ?? undefined, ...(s.tamano && s.colorHeader ? { fontSize: fs + 3, padding: "8px 10px" } : {}) }}
                      >
                        {colLabel(col, label)}
                        {col.subtitulo && <div style={{ fontStyle: "italic", fontWeight: 400, fontSize: fs - 1 }}>{col.subtitulo}</div>}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
            )}
            <tbody>
              {filas.map((f, ri) => {
                // Fila separadora de ancho completo (Peptide Rx: "Nootropics — Size (Select one)").
                if (f?.separador) {
                  return (
                    <tr key={`sep${ri}`}>
                      <td colSpan={lastRow.length + (casillasEnFilas ? 1 : 0)} style={{ border: bd, background: GRAY_HEADER, padding: pad, fontWeight: 700 }}>
                        {f.separador}
                        {f.subtitulo && <span style={{ fontWeight: 400, marginLeft: 8 }}>{f.subtitulo}</span>}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={`f${ri}`}>
                    {casillasEnFilas && <td style={{ border: bd, padding: pad, textAlign: "center" }}>{Casilla}</td>}
                    {lastRow.map((col, ci) => (
                      <td
                        key={ci}
                        style={{ border: bd, padding: pad, height: 26, ...(ci === 0 && descBg ? { background: descBg, color: "#fff", fontWeight: 700 } : {}) }}
                      >
                        <CeldaTematica valor={f?.[col.clave]} />
                      </td>
                    ))}
                  </tr>
                );
              })}
              {blancas.map((_, ri) => (
                <tr key={`b${ri}`}>
                  {casillasEnFilas && <td style={{ border: bd, padding: pad, textAlign: "center" }}>{Casilla}</td>}
                  {lastRow.map((col, ci) => (
                    <td key={ci} style={{ border: bd, padding: pad, height: 26, ...(ci === 0 && descBg ? { background: descBg } : {}) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }

    case "lista_casillas": {
      // ☐ per item; inline options carry their own ☐; `blanco` = width (px) of a fill-in line.
      const fs = s.tamano ?? 11;
      const item = (it: (typeof s.items)[number], i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.35 }}>
          <span style={{ marginTop: 2, flexShrink: 0, display: "inline-flex" }}>{Casilla}</span>
          <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", columnGap: 8 }}>
            <span>{it.texto}</span>
            {it.opciones && it.opciones.length > 0 && <OpcionesSegmento opciones={it.opciones} />}
            {it.blanco ? <span style={{ display: "inline-block", width: it.blanco, borderBottom: BORDER, height: fs }} /> : null}
          </span>
        </div>
      );
      return (
        <>
          {/* Title as written (order forms mix «SUPPORTING CLINICAL BASIS» and «Patient-specific clinical rationale»). */}
          {(s.titulo || s.labelKey) && <div style={{ fontWeight: 700, fontSize: fs + 1, marginBottom: 3 }}>{s.titulo ?? label(s.labelKey)}</div>}
          {s.intro && <div style={{ fontSize: fs, marginLeft: 20, marginBottom: 2 }}>{s.intro}</div>}
          <div
            style={{
              fontSize: fs,
              display: "flex",
              flexDirection: s.enLinea ? "row" : "column",
              flexWrap: s.enLinea ? "wrap" : "nowrap",
              gap: s.enLinea ? "2px 14px" : 1,
            }}
          >
            {s.items.map(item)}
          </div>
        </>
      );
    }

    case "salto_pagina":
      // The page split happens in FormatoPaginado; on its own it draws nothing.
      return null;

    case "leyenda":
      // Pie de leyenda secundario centrado (además del f-b/).
      return <p style={{ textAlign: "center", fontSize: 9, color: "#666", marginTop: 8 }}>{s.texto}</p>;

    default:
      return null;
  }
}

// One block per SESSION (layout "sesiones"), drawn like the legacy sheet
// (.personal/formatos-legacy/Sueroterapia Vit C con Laser Intravenoso-intra2.pdf, sueroterapia_form.php):
// «SESIÓN # : n/m» on a light rule, the colour table with a tall blank row, two stacked grey note bands,
// and the signatures in two columns (ENFERMERO + HORA on the left, FIRMA DEL PACIENTE on the right), each
// label OVER its line. `porPagina` blocks per physical page; every page after the first repeats `repeat`
// (letterhead + patient line), as the legacy prints a full header on each sheet. Each block is sized so two
// of them fill a letter page with air. Inline styles only: the print window has no Tailwind.
const SESSION_BLOCK_MIN_HEIGHT = "4.3in";
export function SesionesFormato({
  columns,
  sessions,
  notas,
  porPagina = 2,
  firmas,
  label,
  repeat,
}: {
  columns: FormatoColumna[];
  sessions: FormatoSesion[];
  notas: string[];
  porPagina?: number;
  firmas?: Extract<FormatoSeccion, { tipo: "firmas" }>;
  label: LabelFn;
  /** Header repeated at the top of every page after the first. */
  repeat?: React.ReactNode;
}) {
  const bloques: FormatoSesion[] = sessions.length > 0 ? sessions : [{ session: null, date: null }];
  const per = Math.max(1, porPagina);
  const pages: FormatoSesion[][] = [];
  for (let i = 0; i < bloques.length; i += per) pages.push(bloques.slice(i, i + per));
  const lineas = firmas?.lineas ?? [];
  const left = lineas.filter((_, i) => i % 2 === 0);
  const right = lineas.filter((_, i) => i % 2 === 1);
  const signLine = (l: FormatoFirmaLinea, k: React.Key, first: boolean) => (
    <div key={k} style={{ marginTop: first ? 0 : 18 }}>
      <div style={{ fontSize: 12 }}>{lineaText(l, label)}</div>
      <div style={{ borderBottom: BORDER, marginTop: 26, minHeight: 2, fontSize: 11, paddingLeft: 4 }}>{lineaValor(l)}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 18 }}>
      {pages.map((page, pi) => (
        <div key={pi} style={{ pageBreakAfter: pi + 1 < pages.length ? "always" : "auto" }}>
          {pi > 0 && <div style={{ marginBottom: 18 }}>{repeat}</div>}
          {page.map((s, i) => (
            <div key={i} style={{ breakInside: "avoid", minHeight: SESSION_BLOCK_MIN_HEIGHT, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #ccc", paddingBottom: 8, marginBottom: 14, fontSize: 12 }}>
                <span />
                <span>
                  <b>{label("formato.sessionNumber", "SESIÓN # :")}</b> {s.session ?? ""}
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.clave} style={{ border: BORDER, background: "#f0f0f0", padding: "6px 6px", textAlign: "center", fontWeight: 700 }}>
                        {colLabel(c, label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {columns.map((c) => (
                      <td key={c.clave} style={{ border: BORDER, height: 44, padding: "6px 6px", textAlign: "center", verticalAlign: "middle" }}>
                        {c.clave === "fecha" ? (s.date ?? "") : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              {/* Two grey bands to write by hand, stacked full width (legacy). */}
              {(notas.length ? notas : ["", ""]).map((_, ni) => (
                <div key={ni} style={{ height: 34, background: "#f0f0f0", marginTop: ni === 0 ? 20 : 10 }} />
              ))}
              {lineas.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
                  <div style={{ width: "42%" }}>{left.map((l, k) => signLine(l, k, k === 0))}</div>
                  <div style={{ width: "42%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    {right.map((l, k) => signLine(l, k, k === 0))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
