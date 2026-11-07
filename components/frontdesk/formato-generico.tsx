"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getFormatoArmado, type FormatoArmado, type FormatoSeccion } from "@/lib/api/formatos";
import { SeccionInner, SesionesFormato } from "@/components/frontdesk/formato-secciones";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { imprimirFormato, LogoFormato, PieFormato } from "@/components/frontdesk/formato-parts";
import { FormatoPaginado } from "@/components/frontdesk/formato-paginado";
import { splitInlineFields, chunkPairs } from "@/lib/formatos/inline-fields";
import { rowsForPrint } from "@/lib/formatos/print-rows";
import { Input } from "@/components/ui/input";

// Documento GENÉRICO imprimible (tabla con filas en blanco para llenar a mano). Data-driven: todo viene
// del BE armado (membrete/título/paciente/columnas/filas). Papel A4/Letter, tinta negra, @media print
// via .formato-print. Los encabezados se traducen por labelKey; el `titulo` va tal cual (es del documento).
// Extraído de formatos-modal.tsx para hacerle lugar al laser (HILT/MLS) bajo el ceiling de ese archivo.
export function GenericFormatoRender({ clave, sesionId, centro, onVolver }: { clave: string; sesionId?: string; centro?: string; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const res = useResource<FormatoArmado>(() => getFormatoArmado(clave, sesionId, centro), [clave, sesionId, centro]);
  const printRef = React.useRef<HTMLDivElement>(null);
  // How many therapies to print (print only, never saved). Empty = the BE's rows as they come.
  const [printCount, setPrintCount] = React.useState("");
  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">…</p>;
  // Say WHY (e.g. FORBIDDEN: the user's role lacks the permission), not just that it failed.
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{t("formatoError")} — {res.state.message}</p>;
  if (res.state.kind !== "ok") return null;
  const d = res.state.data;
  const cols = d.columns ?? [];
  const campos = d.fields ?? [];
  const secciones = d.sections ?? [];
  // ¿Hay OBSERVACIONES (caja o renglones) que CREZCAN? Si no, va un espaciador flexible.
  const tieneTextoLibre = secciones.some((s) => s.tipo === "texto_libre");
  // El discriminador es `layout` (no la presencia de columnas): "campos" = encabezado etiqueta/valor;
  // cualquier otro (o ausente con columnas) = rejilla. Contrato del handoff-formato-campos-secciones-pie.
  const esCampos = (d.layout ?? (cols.length ? "tabla" : "campos")) === "campos";
  // Metadatos declarativos del papel (bolsa `render`). ocultarEmpresa puede venir aquí o en letterhead.
  const render = d.render ?? {};
  const ocultarEmpresa = d.letterhead?.ocultarEmpresa || render.ocultarEmpresa;
  const camposEnLinea = splitInlineFields(campos, render.camposEnLinea);
  // Numbered grid (one row per therapy): the desk can type how many to print — see print-rows.ts.
  const contadorFilas = !esCampos && d.layout !== "sesiones" && d.layout !== "sessions" ? render.numerarFilas : undefined;
  const filas = rowsForPrint(d.rows ?? [], contadorFilas ? Number(printCount) : null, contadorFilas, !!render.numerarComoFraccion);
  // Láser a color por sesión (multipágina): bloques por sesión con paginación; las firmas se pintan DENTRO
  // de cada bloque (no al final), así que se sacan de las secciones normales.
  // "sesiones" es el valor real (enum en español por convención del proyecto, igual que "campos"/"tabla"
  // — confirmado por BE, no es un bug de traducción); "sessions" queda como fallback por si el contrato
  // cambiara. Sin esto, el multipágina por sesión nunca se activaba.
  const esSesiones = d.layout === "sesiones" || d.layout === "sessions";
  const firmasSesion = esSesiones
    ? secciones.find((s): s is Extract<FormatoSeccion, { tipo: "firmas" }> => s.tipo === "firmas")
    : undefined;
  // GLP-1: cuando viene `render.imagenCuerpo` Y están las dos secciones (claves fijas, confirmadas por BE),
  // "composicion_corporal" y "medidas_corporales" se sacan del flujo normal para pintarlas en 3 columnas
  // junto al diagrama (composición | imagen | medidas), igual que el legado. Si falta cualquiera de las 3
  // piezas, NINGUNA se saca del flujo normal (se apilan como siempre) — nunca perder datos por un layout
  // a medias.
  const seccionComposicionCand = secciones.find((s) => s.clave === "composicion_corporal");
  const seccionMedidasCand = secciones.find((s) => s.clave === "medidas_corporales");
  const tresColumnas = !!(render.imagenCuerpo && seccionComposicionCand && seccionMedidasCand);
  const seccionComposicion = tresColumnas ? seccionComposicionCand : undefined;
  const seccionMedidas = tresColumnas ? seccionMedidasCand : undefined;
  const seccionesVisibles = (esSesiones ? secciones.filter((s) => s.tipo !== "firmas") : secciones).filter(
    (s) => s !== seccionComposicion && s !== seccionMedidas,
  );
  // Etiqueta por labelKey: traducción si existe; si no, el ÚLTIMO segmento en MAYÚSCULAS (nunca la clave
  // cruda en el papel). Handoff §"Claves i18n": el FE solo traduce; si falta, cae al segmento.
  // Defensivo: `key` debe ser string. El BE a veces manda etiquetas como OBJETO (p. ej. firmas.lineas =
  // { label, labelKey }); si llegara algo que no es string, NO se rompe la pantalla — se cae al fallback.
  const label = (key?: string | null, fallback?: string) => {
    if (typeof key === "string" && key && t.has(key)) return t(key);
    const seg = (typeof key === "string" ? key : "").split(".").pop() ?? "";
    return (fallback ?? seg.replace(/_/g, " ")).toUpperCase();
  };
  // `origen: ""` (vs. un binding real como "paciente.nombre") marca un campo para LLENAR A MANO (p. ej.
  // PEMF/Cámara Energética/Cámara Hiperbárica en terapia_camener): sin esto se imprimía la etiqueta sola,
  // sin ninguna línea para escribir — verificado en vivo contra GET /formats/terapia_camener/assembly.
  // External order forms reproduced sheet by sheet (landscape, own logo, watermark per page).
  if (d.layout === "paginas") return <FormatoPaginado d={d} label={label} onVolver={onVolver} />;
  // Pain scale, at the legacy size (62%, max 480px; inline because the print sheet caps img at 38px). With
  // signatures it sits between the observations and them (ondas_choque_form.php); without, before the foot.
  const primeraFirma = seccionesVisibles.find((s) => s.tipo === "firmas");
  const escalaAntesDeFirmas = !!primeraFirma;
  const escalaDolor = render.imagenEscalaDolor ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={render.imagenEscalaDolor}
      alt=""
      style={{ display: "block", width: "62%", maxWidth: 480, maxHeight: "none", margin: "20px auto 4px", objectFit: "contain" }}
    />
  ) : null;
  const campoValor = (c: { valor?: string | null; origen?: string }) =>
    !c.valor && c.origen === "" ? <span className="ml-1 inline-block min-w-[90px] border-b border-black" style={{ display: "inline-block", minWidth: 90, borderBottom: "1px solid #000" }}>&nbsp;</span> : (c.valor ?? "");
  // "campos" header: with render.subrayarValores every value is written ON a line (legacy `.fill`).
  const valorCampo = (c: { valor?: string | null; origen?: string }) =>
    render.subrayarValores ? (
      <span style={{ display: "inline-block", minWidth: c.origen === "" ? 140 : 180, borderBottom: "1px solid #000", padding: "0 4px" }}>{c.valor || "\u00a0"}</span>
    ) : (
      <span>{campoValor(c)}</span>
    );
  // «sesiones» patient line, legacy-style: one column per field (NOMBRE | RECORD), on a rule. Inline
  // grid: the print window has no Tailwind, and «gap-x-6» printed «LOZADARECORD #» glued together.
  const pacienteSesiones = (
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, campos.length || 2)}, 1fr)`, gap: 12, marginTop: 18, paddingBottom: 8, borderBottom: "1px solid #ccc", fontSize: 12 }}
    >
      {campos.length > 0 ? (
        campos.map((c) => (
          <span key={c.clave}>
            <b>{c.label ?? `${label(c.labelKey)} :`}</b> {campoValor(c)}
          </span>
        ))
      ) : (
        <>
          <b>{d.patient?.name ?? "—"}</b>
          <span>{d.patient?.medicalRecordNumber ? `${t("recordLabel")} #${d.patient.medicalRecordNumber}` : ""}</span>
        </>
      )}
    </div>
  );
  const membrete = (
    <>
          {/* Membrete: el bloque de títulos (empresa / centro / título) queda CENTRADO e intacto; el logo va
              ARRIBA-IZQUIERDA en posición absoluta para no empujar ni una línea (regla dura del handoff:
              si el logo mueve algo, está mal). En rejillas apretadas el logo baja a 32px. */}
          <div className="relative text-center" style={{ position: "relative" }}>
            {/* Inline position: the print window has no Tailwind, and the logo landed centred over the title. */}
            <div className="absolute left-0 top-0" style={{ position: "absolute", left: 0, top: 0 }}>
              <LogoFormato logoUrl={d.letterhead?.logoUrl} size={esCampos ? 42 : 32} />
            </div>
            {/* Arquetipos 1 y 4 del legacy NO llevan la línea de empresa NI la del centro (solo logo +
                título) — el logo de esos formatos ya trae "CENTRO DE MEDICINA REGENERATIVA" horneado. */}
            {!ocultarEmpresa && <div className="text-base font-bold uppercase tracking-wide">{t("formatoEmpresa")}</div>}
            {!ocultarEmpresa && d.letterhead?.center && <div className="text-sm font-semibold uppercase">{d.letterhead.center}</div>}
            {/* Línea más chica arriba del título (p. ej. "Cámara Energética" sobre "CONTROL DE SESIONES"). */}
            {render.subtitulo && <div className="text-sm font-semibold">{render.subtitulo}</div>}
            <h2 className="mt-1 text-lg font-bold uppercase">{d.title}</h2>
          </div>

    </>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        {contadorFilas && (
          <label className="ml-auto mr-3 flex items-center gap-2 text-sm text-muted-foreground">
            {t("formatoTherapyCount")}
            <Input
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              value={printCount}
              placeholder={String((d.rows ?? []).length)}
              onChange={(e) => setPrintCount(e.target.value)}
              className="h-8 w-20"
            />
          </label>
        )}
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, d.title || t("imprimirPdf"))}>{t("imprimirPdf")}</Button>
      </div>
      {/* .formato-doc = columna flex que LLENA la hoja (min-height:100vh en impresión): la zona de
          OBSERVACIONES (o un espaciador si no hay) crece y empuja firmas/pie al fondo → nada amontonado
          arriba. Norma repetida del dueño: los reportes ocupan toda la página con aire. */}
      <div ref={printRef} className="formato-print rounded-lg border bg-white p-6 text-black">
        <div className="formato-doc flex min-h-[70vh] flex-col">
          {membrete}

          {/* Selectores de tipo (p. ej. RADIAL/FOCAL en Ondas de Choque): una casilla en blanco por opción,
              a la izquierda, antes de los campos — se marca a mano cuál aplica. Verificado en vivo contra
              GET /formats/terapia_ondas_choque/assembly (`render.casillas`); el tipo ya lo declaraba pero
              nunca se pintaba. */}
          {render.casillas && render.casillas.length > 0 && (
            // Inline styles: the print window has no Tailwind (it printed «RADIALFOCAL» with no boxes).
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
              {render.casillas.map((c) => (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 70 }}>{c}</span>
                  <span style={{ display: "inline-block", width: 34, height: 18, border: "1px solid #000" }} aria-hidden />
                </div>
              ))}
            </div>
          )}

          {esSesiones ? (
            <>
              {/* Cabecera data-driven: el BE manda `fields` (paciente/record, y a veces fecha — p. ej.
                  "Nano + Láser Intravenoso" trae un 3er campo FECHA que "Vit C + Láser IV" no trae) igual
                  que en el layout "campos", así que se pinta tal cual viene, en línea, sin inventar qué
                  campos mostrar. Fallback a `d.patient` solo si el BE no manda `fields` (contrato viejo). */}
              {pacienteSesiones}
              {/* Láser a color por sesión (multipágina): bloques por sesión con paginación. */}
              <SesionesFormato
                columns={cols}
                sessions={d.sessions ?? []}
                notas={render.notas ?? []}
                porPagina={d.porPagina ?? render.porPagina ?? 2}
                firmas={firmasSesion}
                label={label}
                repeat={
                  <>
                    {membrete}
                    {pacienteSesiones}
                  </>
                }
              />
            </>
          ) : esCampos ? (
            /* Encabezado de pares etiqueta/valor (Vit C): una línea por campo, etiqueta en negrita ` : `
               valor. Aireado (.formato-campos). Nada de rejilla ni columnas inventadas. */
            <div className="formato-campos mt-6 flex flex-col gap-4 text-sm">
              {/* render.camposEnPares: the legacy 2-column grid — one row per PAIR of fields, in order
                  (APEX RF: Fecha|Paciente, Hora entrada|Hora salida, Sesión|Record). */}
              {render.camposEnPares ? (
                chunkPairs(campos).map((par, i) => (
                  <div
                    key={par.map((f) => f.clave).join("-") || i}
                    className="campo"
                    style={{ display: "flex", flexWrap: "wrap", columnGap: 32, rowGap: 4, justifyContent: par.length === 2 ? "space-between" : undefined }}
                  >
                    {par.map((f) => (
                      <span key={f.clave} style={{ display: "flex", gap: 8 }}>
                        <span className="font-bold">{f.label ?? `${label(f.labelKey)} :`}</span> {valorCampo(f)}
                      </span>
                    ))}
                  </div>
                ))
              ) : (
              /* render.camposEnLinea: those fields share ONE line, placed where the first of them sits in the
                  BE order (ondas_choque: FECHA, then «NOMBRE … | RECORD #» on one line, like the legacy); two
                  fields = one at each end. The rest, one per line. Labels: the BE's `label` first. */
              campos.map((c) => {
                const inline = camposEnLinea.inline;
                if (inline.includes(c)) {
                  if (c !== campos.find((x) => inline.includes(x))) return null;
                  return (
                    <div key={c.clave} className="campo" style={{ display: "flex", flexWrap: "wrap", columnGap: 32, rowGap: 4, justifyContent: inline.length === 2 ? "space-between" : undefined }}>
                      {inline.map((f) => (
                        <span key={f.clave} style={{ display: "flex", gap: 8 }}>
                          <span className="font-bold">{f.label ?? `${label(f.labelKey)} :`}</span> {valorCampo(f)}
                        </span>
                      ))}
                    </div>
                  );
                }
                return (
                  <div key={c.clave} className="campo flex gap-2">
                    <span className="font-bold">{c.label ?? `${label(c.labelKey)} :`}</span>
                    {valorCampo(c)}
                  </div>
                );
              })
              )}
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
                      <span className="font-bold">{c.label ?? `${label(c.labelKey)} :`}</span> {campoValor(c)}
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
              {/* Rejilla con filas en blanco (aireadas, para llenar a mano). El BE "hornea" el valor final de
                  cada celda (incluido el contador de `render.numerarFilas`, p. ej. "1/24" cuando
                  `numerarComoFraccion` aplica) — el FE pinta tal cual, nunca lo recalcula. Confirmado por BE
                  tras un primer intento equivocado de este lado donde el FE le agregaba "/total" él mismo. */}
              <table className="formato-grid mt-3 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-neutral-100 text-left">
                    {cols.map((c) => <th key={c.clave} className="border border-neutral-300 px-2 py-1.5 font-semibold">{c.label ?? label(c.labelKey, c.clave)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} style={{ height: 46 }}>
                      {cols.map((c) => <td key={c.clave} className="border border-neutral-300 px-2 pt-2 align-top">{f?.[c.clave] ?? ""}</td>)}
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
              idéntico al legacy). Solo OBSERVACIONES (texto_libre, caja o renglones) crece para llenar la hoja. */}
          {seccionesVisibles.map((s, i) => {
            const crece = s.tipo === "texto_libre";
            return (
              <React.Fragment key={s.clave ?? `sec-${i}`}>
              {escalaAntesDeFirmas && s === primeraFirma && escalaDolor}
              <div
                key={s.clave ?? `sec-${i}`}
                className={"region mt-6" + (crece ? " formato-grow" : "")}
                style={crece ? { breakInside: "avoid", display: "flex", flexDirection: "column", flex: "1 1 auto", marginTop: 24 } : { breakInside: "avoid" }}
              >
                <SeccionInner s={s} label={label} casillasEnFilas={render.casillasEnFilas} />
              </div>
              </React.Fragment>
            );
          })}

          {/* Diagrama del cuerpo (GLP-1): hombre o mujer ya resuelto por el BE según sexo del paciente, en 3
              columnas junto a Composición Corporal / Medidas Corporales — igual que el legado. Si vinieran
              las claves pero no el diagrama (o viceversa), se cae a apilado para no perder datos. */}
          {tresColumnas && seccionComposicion && seccionMedidas && render.imagenCuerpo ? (
            <div className="mt-6 flex flex-wrap items-start justify-center gap-6">
              <div className="min-w-[200px] flex-1"><SeccionInner s={seccionComposicion} label={label} /></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={render.imagenCuerpo} alt="" className="w-full max-w-[220px] shrink-0 object-contain" />
              <div className="min-w-[200px] flex-1"><SeccionInner s={seccionMedidas} label={label} /></div>
            </div>
          ) : (
            render.imagenCuerpo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={render.imagenCuerpo} alt="" className="mt-6 w-full max-w-md self-center object-contain" />
            )
          )}

          {/* Escala de dolor sin firmas (HILT/MLS): antes del pie. */}
          {!escalaAntesDeFirmas && escalaDolor}

          {/* Pie del legacy (TODOS): pequeño, a la izquierda, al final. */}
          <PieFormato pie={d.footer} />
        </div>
      </div>
    </div>
  );
}
