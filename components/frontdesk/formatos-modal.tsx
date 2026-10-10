"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getFormato, type Formato, type LaserTipo, type LaserParametro } from "@/lib/api/laser";
import { getDisponibilidadServicio, type PaqueteDisponibilidad } from "@/lib/api/frontdesk";
import { parseAcciones, type ReportAccion } from "@/lib/frontdesk/acciones";
import { formatFechaSolo } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TimePicker } from "@/components/ui/time-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/frontdesk/signature-pad";
import { Campo, HORA_CLS, LogoFormato, imprimirFormato, PieFormato } from "@/components/frontdesk/formato-parts";
import { GenericFormatoRender } from "@/components/frontdesk/formato-generico";

// Modal ESTÁNDAR de acciones/formatos por servicio (data-driven desde servicio.formAcciones).
// Lista los `reports` (HILT/MLS…) y `additional_actions` (Historial). Al elegir un report:
// subform (Sesión + Áreas precargados) → render del formato médico imprimible con firma.
export function FormatosModal({
  open,
  onOpenChange,
  servicioNombre,
  formAcciones,
  pacienteNombre,
  record,
  sesionNN,
  servicioId,
  pacienteId,
  tecnicoNombre,
  proximaCita,
  sesionId,
  fecha,
  initialReport,
  centro,
  onHistorial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  servicioNombre: string;
  formAcciones: unknown;
  pacienteNombre: string;
  record?: string | null;
  // Sesión como "n/n" (p. ej. "1/12") de la fila (fd_sesiones): se muestra tal cual, no un número suelto.
  sesionNN?: string | null;
  // Fecha de la CITA/sesión (YYYY-MM-DD, la del tablero) — no la de hoy, el formato se reimprime.
  fecha?: string;
  // Para leer las ÁREAS y DÍAS por FORMATO (MLS/HILT) de la DISPONIBILIDAD, no de la factura: un cambio de
  // protocolo no genera factura, solo mueve la disponibilidad, así que es la fuente de verdad. Handoff
  // el-modal-de-laser-ya-no-pide-lo-que-sabemos.
  servicioId?: string;
  pacienteId?: string;
  tecnicoNombre?: string | null;
  proximaCita?: string | null;
  sesionId?: string; // fila/sesión → arma el formato genérico con sus datos (membrete/paciente/fecha)
  initialReport?: ReportAccion; // report elegido desde el menú de Acciones → se preselecciona (salta la lista)
  centro?: string;
  onHistorial?: () => void;
}) {
  const t = useTranslations("frontdesk");
  const cfg = React.useMemo(() => parseAcciones(formAcciones), [formAcciones]);
  const [report, setReport] = React.useState<ReportAccion | null>(null);
  const [generado, setGenerado] = React.useState(false);
  const [sesion, setSesion] = React.useState<string>("");
  const [areasOverride, setAreasOverride] = React.useState<string | null>(null); // null = usar el de la disponibilidad
  // Enviar el técnico (ya conocido) al impreso, o dejarlo en blanco para llenar a mano como el papel.
  const [enviarTecnico, setEnviarTecnico] = React.useState(true);

  // Disponibilidad del paciente para ESTE servicio: de aquí salen ÁREAS y DÍAS por formato (MLS/HILT). La
  // factura NO es la fuente — un cambio de protocolo no la genera, solo mueve la disponibilidad. El paquete
  // se cruza por nombre/sku del producto (contiene "mls"/"hilt").
  const dispRes = useResource<PaqueteDisponibilidad[]>(
    () => (open && servicioId && pacienteId ? getDisponibilidadServicio(servicioId, pacienteId, centro).then((d) => d.paquetes) : Promise.resolve([])),
    [open, servicioId, pacienteId, centro],
  );
  const paquetes = dispRes.state.kind === "ok" ? dispRes.state.data : [];

  function elegir(r: ReportAccion) {
    setSesion(String(sesionNN ?? "")); // n/n de la fila
    setAreasOverride(null); // nacen del dato de la disponibilidad
    setReport(r);
    setGenerado(false);
  }
  // Reset al abrir/cerrar (patrón ajustar-en-render). Al abrir con un report preseleccionado (desde el
  // menú de Acciones), se elige directo y se salta la lista.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) { setReport(null); setGenerado(false); }
    else if (initialReport) elegir(initialReport);
  }
  const tipo = ((report?.id || report?.function || report?.action || "") as string).toLowerCase() as LaserTipo;
  const esFormato = tipo === "hilt" || tipo === "mls";
  const pkg = tipo ? paquetes.find((p) => `${p.productoNombre ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(tipo)) : undefined;
  const areasAuto = pkg?.multiplicadores?.areas;
  // Áreas DERIVADAS de la disponibilidad (editable: override manual tiene precedencia). Si el paquete NO trae
  // áreas (p. ej. tras un cambio de protocolo a una terapia sin áreas), se deja VACÍO — nunca un 1 inventado
  // (regla del BE: la respuesta del handoff).
  const areas = areasOverride ?? (areasAuto != null ? String(areasAuto) : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("formatosTitle", { servicio: servicioNombre })}</DialogTitle>
          <DialogDescription>{pacienteNombre}</DialogDescription>
        </DialogHeader>

        {/* 1) Lista de acciones */}
        {!report && (
          <div className="space-y-4">
            {cfg.reports && cfg.reports.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {cfg.reports.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => elegir(r)}
                    className="rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <div className="font-medium">{r.labelKey && t.has(r.labelKey) ? t(r.labelKey) : r.name ?? r.id}</div>
                    <div className="text-xs text-muted-foreground">{t("generarFormato")}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("sinFormatos")}</p>
            )}
            {cfg.additional_actions && cfg.additional_actions.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {cfg.additional_actions.map((a, i) => (
                  <Button
                    key={a.id ?? i}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if ((a.target === "historial" || a.type === "modal") && onHistorial) {
                        onOpenChange(false);
                        onHistorial();
                      }
                    }}
                  >
                    {a.labelKey && t.has(a.labelKey) ? t(a.labelKey) : a.label ?? a.id}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2) Subform Sesión + Áreas */}
        {report && !generado && esFormato && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                {/* Sesión como "n/n" (p. ej. 1/12): texto, nace puesta desde la fila, editable por si acaso. */}
                <Label htmlFor="fmt-sesion">{t("colSesion")}</Label>
                <Input id="fmt-sesion" inputMode="numeric" placeholder="n/n" value={sesion} onChange={(e) => setSesion(e.target.value)} />
              </div>
              <div className="space-y-1">
                {/* Áreas por formato desde la DISPONIBILIDAD (MLS 4, HILT 2), editable. */}
                <Label htmlFor="fmt-areas">{t("colAreas")}</Label>
                <Input id="fmt-areas" type="number" min={1} value={areas} onChange={(e) => setAreasOverride(e.target.value)} />
              </div>
            </div>
            {tecnicoNombre && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={enviarTecnico} onCheckedChange={(v) => setEnviarTecnico(v === true)} />
                {t("enviarTecnico", { nombre: tecnicoNombre })}
              </label>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setReport(null)}>{t("volver")}</Button>
              <Button onClick={() => setGenerado(true)}>{t("generar")}</Button>
            </div>
          </div>
        )}

        {/* 3) Render del formato médico de LÁSER (HILT/MLS, ruta propia con parámetros) */}
        {report && generado && esFormato && (
          <FormatoRender
            tipo={tipo}
            centro={centro}
            header={{
              paciente: pacienteNombre,
              record: record ?? "",
              sesion: sesion || (sesionNN ?? ""),
              areas: Number(areas) || 0,
              tecnico: enviarTecnico ? (tecnicoNombre ?? "") : "",
              proximaCita: proximaCita ?? "",
              fecha: fecha ?? "",
            }}
            onVolver={() => setGenerado(false)}
          />
        )}

        {/* 3b) Formato GENÉRICO (data-driven): documento imprimible armado por el BE. Sin subform. */}
        {report && !esFormato && (
          <GenericFormatoRender clave={report.id} sesionId={sesionId} centro={centro} onVolver={() => setReport(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Header = { paciente: string; record: string; sesion: string; areas: number; tecnico: string; proximaCita: string; fecha: string };

function FormatoRender({ tipo, centro, header, onVolver }: { tipo: LaserTipo; centro?: string; header: Header; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const res = useResource<Formato>(() => getFormato(tipo, centro), [tipo, centro]);
  const [triggerSi, setTriggerSi] = React.useState("");
  const [triggerNo, setTriggerNo] = React.useState("");
  const [ctd, setCtd] = React.useState("");
  const [horaIn, setHoraIn] = React.useState("");
  const [horaOut, setHoraOut] = React.useState("");
  const printRef = React.useRef<HTMLDivElement>(null);

  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">…</p>;
  // Say WHY (e.g. FORBIDDEN: the user's role lacks the permission), not just that it failed.
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{t("formatoError")} — {res.state.message}</p>;
  if (res.state.kind !== "ok") return null;
  const data = res.state.data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, t(tipo === "hilt" ? "formatoHiltTitle" : "formatoMlsTitle"))}>{t("imprimirPdf")}</Button>
      </div>

      <div ref={printRef} className="formato-print space-y-4 rounded-lg border bg-white p-5 text-black">
        {/* Encabezado: membrete (logo pequeño + centro) + título; a la derecha fecha/sesión/áreas */}
        <div className="flex items-start justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <LogoFormato logoUrl={data.letterhead?.logoUrl} />
            <div>
              {data.letterhead?.center && <div className="text-xs font-semibold uppercase tracking-wide">{data.letterhead.center}</div>}
              <h2 className="text-lg font-bold uppercase">{t(tipo === "hilt" ? "formatoHiltTitle" : "formatoMlsTitle")}</h2>
              <p className="text-sm">{header.paciente}{header.record ? ` · ${t("recordLabel")} ${header.record}` : ""}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            {/* header.fecha = fecha de la cita, no la de hoy; sin ella (caller viejo), hoy es el fallback. */}
            <div>{formatFechaSolo(header.fecha || new Date().toISOString().slice(0, 10))}</div>
            <div>{t("colSesion")}: {header.sesion} · {t("colAreas")}: {header.areas}</div>
          </div>
        </div>

        {tipo === "hilt" && data.type === "hilt" && <HiltTabla secciones={data.sections} t={t} />}
        {tipo === "mls" && data.type === "mls" && <MlsTabla izquierda={data.izquierda} derecha={data.derecha} t={t} />}

        {/* Footer clínico: Trigger Point (Sí/No) solo HILT, CTD solo MLS — formato homologado. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-3 text-xs">
          {tipo === "hilt" ? (
            <Campo label={t("triggerPoint")}>
              <span className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  {t("triggerPointSi")}:
                  <input className="w-16 border-b border-dashed bg-transparent outline-none" value={triggerSi} onChange={(e) => setTriggerSi(e.target.value)} />
                </span>
                <span className="flex items-center gap-1">
                  {t("triggerPointNo")}:
                  <input className="w-16 border-b border-dashed bg-transparent outline-none" value={triggerNo} onChange={(e) => setTriggerNo(e.target.value)} />
                </span>
              </span>
            </Campo>
          ) : (
            <Campo label={t("ctd")}><input className="w-full border-b border-dashed bg-transparent outline-none" value={ctd} onChange={(e) => setCtd(e.target.value)} /></Campo>
          )}
          {/* Nº terapias = la "sesión/total" del tablero (p. ej. "4/12"), no días × áreas. */}
          <Campo label={t("nTerapias")}><span className="font-semibold tabular-nums">{header.sesion || "—"}</span></Campo>
          <Campo label={t("tecnico")}><span>{header.tecnico || "—"}</span></Campo>
          <Campo label={t("proximaCita")}><span>{header.proximaCita || "—"}</span></Campo>
          <Campo label={t("horaEntrada")}><TimePicker step={1} className={HORA_CLS} value={horaIn} onChange={setHoraIn} /></Campo>
          <Campo label={t("horaSalida")}><TimePicker step={1} className={HORA_CLS} value={horaOut} onChange={setHoraOut} /></Campo>
        </div>

        {/* Firma del paciente */}
        <div className="pt-2">
          <SignaturePad height={110} />
        </div>

        {/* Escala de dolor: la misma gráfica del formato homologado, no un campo numérico aparte. El
            `img` global de PRINT_CSS la limita a 38px (pensado para el logo); el inline style la anula. */}
        <div className="pt-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- clonado a una ventana de impresión aparte (ver imprimirFormato); next/image no sobrevive ese clon. */}
          <img src="/img/pain_measurement_scale.png" alt={t("escalaDolorAlt")} style={{ maxHeight: 140, maxWidth: "100%", margin: "0 auto" }} />
        </div>

        {/* Pie del legacy (BE PR #201): mismo componente que el genérico. */}
        <PieFormato pie={data.footer} />
      </div>
    </div>
  );
}

type TFn = (k: string, v?: Record<string, string | number>) => string;

function HiltTabla({ secciones, t }: { secciones: { region: string; filas: LaserParametro[] }[]; t: TFn }) {
  return (
    <div className="space-y-3">
      {secciones.map((s) => (
        <div key={s.region} className="region">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide">{s.region}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b bg-neutral-100 text-left">
                  <th className="px-2 py-1 font-medium">{t("colPatologia")}</th>
                  <th className="px-2 py-1 text-center font-medium" colSpan={2}>Step 1</th>
                  <th className="px-2 py-1 text-center font-medium" colSpan={2}>Step 2</th>
                  <th className="px-2 py-1 text-center font-medium" colSpan={2}>Step 3</th>
                  <th className="px-2 py-1 text-right font-medium">{t("colEnergy")}</th>
                </tr>
                <tr className="border-b text-[10px] text-neutral-500">
                  <th />
                  <th className="px-2 py-0.5 text-center">mJ/cm²</th><th className="px-2 py-0.5 text-center">Hz</th>
                  <th className="px-2 py-0.5 text-center">mJ/cm²</th><th className="px-2 py-0.5 text-center">Hz</th>
                  <th className="px-2 py-0.5 text-center">mJ/cm²</th><th className="px-2 py-0.5 text-center">Hz</th>
                  <th className="px-2 py-0.5 text-right">J</th>
                </tr>
              </thead>
              <tbody>
                {s.filas.map((f) => (
                  <tr key={f.id} className="border-b border-neutral-200">
                    <td className="px-2 py-1">{f.pathology ?? f.patologia}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.stp1Mjcm ?? "—"}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.stp1Hz ?? "—"}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.stp2Mjcm ?? "—"}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.stp2Hz ?? "—"}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.stp3Mjcm ?? "—"}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{f.stp3Hz ?? "—"}</td>
                    <td className="px-2 py-1 text-right font-medium tabular-nums">{f.energy ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function MlsTabla({ izquierda, derecha, t }: { izquierda: LaserParametro[]; derecha: LaserParametro[]; t: TFn }) {
  const col = (filas: LaserParametro[], titulo: string) => (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide">{titulo}</div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b bg-neutral-100 text-left">
            <th className="px-2 py-1 font-medium">{t("colPatologia")}</th>
            <th className="px-2 py-1 font-medium">{t("colFrecuencia")}</th>
            <th className="px-2 py-1 font-medium">{t("colTiempo")}</th>
            <th className="px-2 py-1 font-medium">{t("colIntensidad")}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-b border-neutral-200">
              <td className="px-2 py-1">{f.pathology ?? f.patologia}</td>
              <td className="px-2 py-1 tabular-nums">{f.frequency ?? "—"}</td>
              <td className="px-2 py-1 tabular-nums">{f.duration ?? "—"}</td>
              <td className="px-2 py-1 tabular-nums">{f.intensity ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {col(izquierda, t("ladoIzquierdo"))}
      {col(derecha, t("ladoDerecho"))}
    </div>
  );
}
