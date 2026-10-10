"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getFormatoArmado, type FormatoArmado, type FormatoSeccion } from "@/lib/api/formatos";
import { SeccionInner, SesionesFormato } from "@/components/frontdesk/formato-secciones";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { imprimirFormato, LogoFormato, PieFormato } from "@/components/frontdesk/formato-parts";

// Documento GENÉRICO imprimible (tabla con filas en blanco para llenar a mano). Data-driven: todo viene
// del BE armado (membrete/título/paciente/columnas/filas). Papel A4/Letter, tinta negra, @media print
// via .formato-print. Los encabezados se traducen por labelKey; el `titulo` va tal cual (es del documento).
// Extraído de formatos-modal.tsx para hacerle lugar al laser (HILT/MLS) bajo el ceiling de ese archivo.
export function GenericFormatoRender({ clave, sesionId, centro, onVolver }: { clave: string; sesionId?: string; centro?: string; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const res = useResource<FormatoArmado>(() => getFormatoArmado(clave, sesionId, centro), [clave, sesionId, centro]);
  const printRef = React.useRef<HTMLDivElement>(null);
  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">…</p>;
  // Say WHY (e.g. FORBIDDEN: the user's role lacks the permission), not just that it failed.
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{t("formatoError")} — {res.state.message}</p>;
  if (res.state.kind !== "ok") return null;
  const d = res.state.data;
  const cols = d.columns ?? [];
  const filas = d.rows ?? [];
  const campos = d.fields ?? [];
  const secciones = d.sections ?? [];
  // ¿Hay una caja de OBSERVACIONES que CREZCA? (la de "lineas" no crece). Si no, va un espaciador flexible.
  const tieneTextoLibre = secciones.some((s) => s.tipo === "texto_libre" && s.estilo !== "lineas");
  // El discriminador es `layout` (no la presencia de columnas): "campos" = encabezado etiqueta/valor;
  // cualquier otro (o ausente con columnas) = rejilla. Contrato del handoff-formato-campos-secciones-pie.
  const esCampos = (d.layout ?? (cols.length ? "tabla" : "campos")) === "campos";
  // Metadatos declarativos del papel (bolsa `render`). ocultarEmpresa puede venir aquí o en letterhead.
  const render = d.render ?? {};
  const ocultarEmpresa = d.letterhead?.ocultarEmpresa || render.ocultarEmpresa;
  // Láser a color por sesión (multipágina): bloques por sesión con paginación; las firmas se pintan DENTRO
  // de cada bloque (no al final), así que se sacan de las secciones normales.
  // "sesiones" es el valor real (enum en español por convención del proyecto, igual que "campos"/"tabla"
  // — confirmado por BE, no es un bug de traducción); "sessions" queda como fallback por si el contrato
  // cambiara. Sin esto, el multipágina por sesión nunca se activaba.
  const esSesiones = d.layout === "sesiones" || d.layout === "sessions";
  const firmasSesion = esSesiones
    ? secciones.find((s): s is Extract<FormatoSeccion, { tipo: "firmas" }> => s.tipo === "firmas")
    : undefined;
  const seccionesVisibles = esSesiones ? secciones.filter((s) => s.tipo !== "firmas") : secciones;
  // Etiqueta por labelKey: traducción si existe; si no, el ÚLTIMO segmento en MAYÚSCULAS (nunca la clave
  // cruda en el papel). Handoff §"Claves i18n": el FE solo traduce; si falta, cae al segmento.
  // Defensivo: `key` debe ser string. El BE a veces manda etiquetas como OBJETO (p. ej. firmas.lineas =
  // { label, labelKey }); si llegara algo que no es string, NO se rompe la pantalla — se cae al fallback.
  const label = (key?: string | null, fallback?: string) => {
    if (typeof key === "string" && key && t.has(key)) return t(key);
    const seg = (typeof key === "string" ? key : "").split(".").pop() ?? "";
    return (fallback ?? seg.replace(/_/g, " ")).toUpperCase();
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, d.title || t("imprimirPdf"))}>{t("imprimirPdf")}</Button>
      </div>
      {/* .formato-doc = columna flex que LLENA la hoja (min-height:100vh en impresión): la zona de
          OBSERVACIONES (o un espaciador si no hay) crece y empuja firmas/pie al fondo → nada amontonado
          arriba. Norma repetida del dueño: los reportes ocupan toda la página con aire. */}
      <div ref={printRef} className="formato-print rounded-lg border bg-white p-6 text-black">
        <div className="formato-doc flex min-h-[70vh] flex-col">
          {/* Membrete: el bloque de títulos (empresa / centro / título) queda CENTRADO e intacto; el logo va
              ARRIBA-IZQUIERDA en posición absoluta para no empujar ni una línea (regla dura del handoff:
              si el logo mueve algo, está mal). En rejillas apretadas el logo baja a 32px. */}
          <div className="relative text-center">
            <div className="absolute left-0 top-0">
              <LogoFormato logoUrl={d.letterhead?.logoUrl} size={esCampos ? 42 : 32} />
            </div>
            {/* Arquetipos 1 y 4 del legacy NO llevan la línea de empresa (solo logo + título). */}
            {!ocultarEmpresa && <div className="text-base font-bold uppercase tracking-wide">{t("formatoEmpresa")}</div>}
            {d.letterhead?.center && <div className="text-sm font-semibold uppercase">{d.letterhead.center}</div>}
            <h2 className="mt-1 text-lg font-bold uppercase">{d.title}</h2>
          </div>

          {esSesiones ? (
            <>
              {/* Cabecera data-driven: el BE manda `fields` (paciente/record, y a veces fecha — p. ej.
                  "Nano + Láser Intravenoso" trae un 3er campo FECHA que "Vit C + Láser IV" no trae) igual
                  que en el layout "campos", así que se pinta tal cual viene, en línea, sin inventar qué
                  campos mostrar. Fallback a `d.patient` solo si el BE no manda `fields` (contrato viejo). */}
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-b pb-2 text-sm">
                {campos.length > 0 ? (
                  campos.map((c) => (
                    <span key={c.clave}>
                      <span className="font-bold">{c.label ?? `${label(c.labelKey)} :`}</span> {c.valor ?? ""}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="text-base font-bold">{d.patient?.name ?? "—"}</span>
                    {d.patient?.medicalRecordNumber && <span className="font-semibold">{t("recordLabel")} #{d.patient.medicalRecordNumber}</span>}
                  </>
                )}
              </div>
              {/* Láser a color por sesión (multipágina): bloques por sesión con paginación. */}
              <SesionesFormato
                columns={cols}
                sessions={d.sessions ?? []}
                notas={render.notas ?? []}
                porPagina={d.porPagina ?? render.porPagina ?? 2}
                firmas={firmasSesion}
                label={label}
              />
            </>
          ) : esCampos ? (
            /* Encabezado de pares etiqueta/valor (Vit C): una línea por campo, etiqueta en negrita ` : `
               valor. Aireado (.formato-campos). Nada de rejilla ni columnas inventadas. */
            <div className="formato-campos mt-6 flex flex-col gap-4 text-sm">
              {campos.map((c) => (
                <div key={c.clave} className="campo flex gap-2">
                  {/* Se PREFIERE el `label` que manda el BE (ya con dos puntos); si no, se traduce el labelKey. */}
                  <span className="font-bold">{c.label ?? `${label(c.labelKey)} :`}</span>
                  <span>{c.valor ?? ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Cabecera data-driven igual que "sesiones": se pinta `fields` tal cual venga (paciente/record,
                  y a veces fecha) en vez de inventar qué mostrar — ver nota en el bloque "sesiones" arriba.
                  Fallback a `d.patient`/`d.date` solo si el BE no manda `fields` (contrato viejo). */}
              <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b pb-2 text-sm">
                {campos.length > 0 ? (
                  campos.map((c) => (
                    <span key={c.clave}>
                      <span className="font-bold">{c.label ?? `${label(c.labelKey)} :`}</span> {c.valor ?? ""}
                    </span>
                  ))
                ) : (
                  <>
                    <div>
                      <span className="text-base font-bold">{d.patient?.name ?? "—"}</span>
                      {d.patient?.medicalRecordNumber && <span className="ml-3 font-semibold">{t("recordLabel")} #{d.patient.medicalRecordNumber}</span>}
                    </div>
                    <div className="tabular-nums">{d.date ?? ""}</div>
                  </>
                )}
              </div>
              {/* Rejilla con filas en blanco (aireadas, para llenar a mano). `render.numerarFilas` nombra una
                  columna que se numera "actual/total" (p. ej. "1/24") en vez de mostrar el valor crudo del BE —
                  mismo criterio que "SESIÓN n/n" en el layout "sesiones", aplicado a una rejilla de una fila
                  por terapia (Transcraneal: 24 filas, # TERAPIA = "1/24"…"24/24"). */}
              <table className="formato-grid mt-3 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-neutral-100 text-left">
                    {cols.map((c) => <th key={c.clave} className="border border-neutral-300 px-2 py-1.5 font-semibold">{c.label ?? label(c.labelKey, c.clave)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} style={{ height: 46 }}>
                      {cols.map((c) => {
                        const crudo = f?.[c.clave] ?? "";
                        const valor = render.numerarFilas === c.clave && crudo !== "" ? `${crudo}/${filas.length}` : crudo;
                        return <td key={c.clave} className="border border-neutral-300 px-2 pt-2 align-top">{valor}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Si NO hay área de observaciones que crezca, un espaciador flexible empuja firmas/pie al fondo. */}
          {!tieneTextoLibre && <div className="formato-grow" aria-hidden style={{ flex: "1 1 auto", minHeight: "24px" }} />}

          {/* Secciones (observaciones / firmas / párrafo / tabla de firmas / checklist / tabla temática /
              leyenda), en cualquier layout. El render de cada tipo vive en formato-secciones.tsx (data-driven,
              idéntico al legacy). Solo OBSERVACIONES (texto_libre caja) crece para llenar la hoja. */}
          {seccionesVisibles.map((s, i) => {
            const crece = s.tipo === "texto_libre" && s.estilo !== "lineas";
            return (
              <div
                key={s.clave ?? `sec-${i}`}
                className={"region mt-6" + (crece ? " formato-grow" : "")}
                style={crece ? { breakInside: "avoid", display: "flex", flexDirection: "column", flex: "1 1 auto" } : { breakInside: "avoid" }}
              >
                <SeccionInner s={s} label={label} casillasEnFilas={render.casillasEnFilas} />
              </div>
            );
          })}

          {/* Escala de dolor (HILT/MLS): imagen del legacy, tal cual, antes del pie. */}
          {render.imagenEscalaDolor && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={render.imagenEscalaDolor} alt="" className="mt-6 w-full max-w-2xl self-center object-contain" />
          )}

          {/* Pie del legacy (TODOS): pequeño, a la izquierda, al final. */}
          <PieFormato pie={d.footer} />
        </div>
      </div>
    </div>
  );
}
