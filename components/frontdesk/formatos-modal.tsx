"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getFormato, type Formato, type LaserTipo, type LaserParametro } from "@/lib/api/laser";
import { getFormatoArmado, type FormatoArmado } from "@/lib/api/formatos";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { parseAcciones, type ReportAccion } from "@/lib/frontdesk/acciones";
import { formatFechaSolo } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/frontdesk/signature-pad";

// CSS autocontenido para la ventana de impresión (el documento NO hereda Tailwind ahí). Incluye las
// utilidades que usa el documento + tablas/tamaño carta. Un formato es un PAPEL: no puede depender de
// estilos externos ni de que el otro lado tenga el diccionario.
const PRINT_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:9mm}
body{font-family:system-ui,-apple-system,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11px}
.no-print{display:none!important}
h2{font-size:15px;margin:0}
table{width:100%;border-collapse:collapse;font-size:9.5px;margin-top:3px}
th,td{border:1px solid #999;padding:1.5px 5px;text-align:left;vertical-align:top;line-height:1.2}
img{max-width:100%;max-height:38px;object-fit:contain}
.text-center{text-align:center}.text-right{text-align:right}
.font-bold{font-weight:700}.font-semibold{font-weight:600}.font-medium{font-weight:500}
.uppercase{text-transform:uppercase}.tracking-wide{letter-spacing:.04em}
.text-lg{font-size:15px}.text-base{font-size:13px}.text-sm{font-size:12px}.text-xs{font-size:10px}
.flex{display:flex}.items-end{align-items:flex-end}.items-start{align-items:flex-start}
.justify-between{justify-content:space-between}.gap-3{gap:10px}.gap-4{gap:12px}
.border-b{border-bottom:1px solid #000}.pb-2{padding-bottom:4px}.pb-3{padding-bottom:5px}.pt-2{padding-top:3px}.pt-3{padding-top:4px}
.mt-1{margin-top:3px}.mt-2{margin-top:5px}.mt-3{margin-top:6px}.mb-1{margin-bottom:2px}.mb-2{margin-bottom:4px}
.ml-2{margin-left:8px}.ml-3{margin-left:12px}
.tabular-nums{font-variant-numeric:tabular-nums}
.bg-neutral-100{background:#f2f2f2}.text-neutral-500{color:#666}
.space-y-2>*+*{margin-top:5px}.space-y-3>*+*{margin-top:6px}.space-y-4>*+*{margin-top:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
/* Cada región/tabla no se parte entre páginas si cabe */
section, .region { break-inside: avoid; }
/* Formatos GENÉRICOS (rejillas en blanco para llenar a mano): filas ALTAS y aireadas, que llenen la hoja
   (no amontonadas arriba). No aplica a las tablas densas de láser (HILT/MLS). */
.formato-grid td { height: 46px; padding: 8px 8px; vertical-align: top; }
.formato-grid th { padding: 5px 8px; }
`;

// Imprime un elemento en una VENTANA propia (evita el recorte del Dialog/Radix que dejaba la hoja en
// blanco). Clona el nodo, convierte cualquier <canvas> (firma) en <img> para que sí salga impreso.
function imprimirFormato(el: HTMLElement | null, titulo: string) {
  if (!el || typeof window === "undefined") return;
  const clone = el.cloneNode(true) as HTMLElement;
  const canvasOrig = el.querySelectorAll("canvas");
  const canvasClone = clone.querySelectorAll("canvas");
  canvasOrig.forEach((c, i) => {
    try {
      const img = document.createElement("img");
      img.src = (c as HTMLCanvasElement).toDataURL("image/png");
      canvasClone[i]?.replaceWith(img);
    } catch { /* canvas vacío/tainted: se omite */ }
  });
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return; // bloqueado por popup: el usuario debe permitir ventanas emergentes
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>${PRINT_CSS}</style></head><body>${clone.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  const go = () => { w.print(); };
  // Espera a que carguen imágenes (logo/firma) antes de imprimir.
  if (w.document.images.length) setTimeout(go, 400); else setTimeout(go, 150);
}

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
  sesionDefault,
  areasDefault,
  tecnicoNombre,
  proximaCita,
  sesionId,
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
  sesionDefault?: number;
  areasDefault?: number;
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
  const [areas, setAreas] = React.useState<string>("");

  function elegir(r: ReportAccion) {
    const f = r.editable_fields ?? [];
    const dSes = f.find((x) => x.name === "session" || x.name === "sesion")?.default;
    const dAre = f.find((x) => x.name === "areas")?.default;
    setSesion(String(sesionDefault ?? dSes ?? ""));
    setAreas(String(areasDefault ?? dAre ?? ""));
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
                    className="rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
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
                <Label htmlFor="fmt-sesion">{t("colSesion")}</Label>
                <Input id="fmt-sesion" type="number" min={1} value={sesion} onChange={(e) => setSesion(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fmt-areas">{t("colAreas")}</Label>
                <Input id="fmt-areas" type="number" min={1} value={areas} onChange={(e) => setAreas(e.target.value)} />
              </div>
            </div>
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
              sesion: Number(sesion) || 0,
              areas: Number(areas) || 0,
              tecnico: tecnicoNombre ?? "",
              proximaCita: proximaCita ?? "",
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

type Header = { paciente: string; record: string; sesion: number; areas: number; tecnico: string; proximaCita: string };

function FormatoRender({ tipo, centro, header, onVolver }: { tipo: LaserTipo; centro?: string; header: Header; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const res = useResource<Formato>(() => getFormato(tipo, centro), [tipo, centro]);
  const [triggerPoint, setTriggerPoint] = React.useState("");
  const [horaIn, setHoraIn] = React.useState("");
  const [horaOut, setHoraOut] = React.useState("");
  const [dolor, setDolor] = React.useState("");
  const nTerapias = header.sesion * header.areas;
  const printRef = React.useRef<HTMLDivElement>(null);
  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centroSel = centrosRes.state.kind === "ok" ? centrosRes.state.data.find((c) => c.id === centro) : undefined;
  // Logo de la EMPRESA (mismo para todos los centros): el del centro o, si no tiene, el de cualquiera.
  const logoUrl = centroSel?.logoUrl ?? (centrosRes.state.kind === "ok" ? centrosRes.state.data.find((c) => c.logoUrl)?.logoUrl ?? null : null);

  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">…</p>;
  if (res.state.kind !== "ok") return <p className="text-sm text-destructive">{t("formatoError")}</p>;
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="" className="max-h-10 object-contain" />}
            <div>
              {centroSel?.nombre && <div className="text-xs font-semibold uppercase tracking-wide">{centroSel.nombre}</div>}
              <h2 className="text-lg font-bold uppercase">{t(tipo === "hilt" ? "formatoHiltTitle" : "formatoMlsTitle")}</h2>
              <p className="text-sm">{header.paciente}{header.record ? ` · ${t("recordLabel")} ${header.record}` : ""}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <div>{formatFechaSolo(new Date().toISOString().slice(0, 10))}</div>
            <div>{t("colSesion")}: {header.sesion} · {t("colAreas")}: {header.areas}</div>
          </div>
        </div>

        {tipo === "hilt" && data.tipo === "hilt" && <HiltTabla secciones={data.secciones} t={t} />}
        {tipo === "mls" && data.tipo === "mls" && <MlsTabla izquierda={data.izquierda} derecha={data.derecha} t={t} />}

        {/* Footer clínico */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-3 text-xs">
          <Campo label={t("triggerPoint")}><input className="w-full border-b border-dashed bg-transparent outline-none" value={triggerPoint} onChange={(e) => setTriggerPoint(e.target.value)} /></Campo>
          <Campo label={t("nTerapias")}><span className="font-semibold tabular-nums">{nTerapias || "—"}</span></Campo>
          <Campo label={t("tecnico")}><span>{header.tecnico || "—"}</span></Campo>
          <Campo label={t("proximaCita")}><span>{header.proximaCita || "—"}</span></Campo>
          <Campo label={t("horaEntrada")}><input type="time" className="border-b border-dashed bg-transparent outline-none" value={horaIn} onChange={(e) => setHoraIn(e.target.value)} /></Campo>
          <Campo label={t("horaSalida")}><input type="time" className="border-b border-dashed bg-transparent outline-none" value={horaOut} onChange={(e) => setHoraOut(e.target.value)} /></Campo>
          <Campo label={t("escalaDolor")}><input type="number" min={0} max={10} className="w-16 border-b border-dashed bg-transparent outline-none" value={dolor} onChange={(e) => setDolor(e.target.value)} /></Campo>
        </div>

        {/* Firma del paciente */}
        <div className="pt-2">
          <SignaturePad height={110} />
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 font-medium">{label}:</span>
      <span className="min-w-0 flex-1">{children}</span>
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
                    <td className="px-2 py-1">{f.patologia}</td>
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
              <td className="px-2 py-1">{f.patologia}</td>
              <td className="px-2 py-1 tabular-nums">{f.frecuencia ?? "—"}</td>
              <td className="px-2 py-1 tabular-nums">{f.tiempo ?? "—"}</td>
              <td className="px-2 py-1 tabular-nums">{f.intensidad ?? "—"}</td>
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

// Documento GENÉRICO imprimible (tabla con filas en blanco para llenar a mano). Data-driven: todo viene
// del BE armado (membrete/título/paciente/columnas/filas). Papel A4/Letter, tinta negra, @media print
// via .formato-print. Los encabezados se traducen por labelKey; el `titulo` va tal cual (es del documento).
function GenericFormatoRender({ clave, sesionId, centro, onVolver }: { clave: string; sesionId?: string; centro?: string; onVolver: () => void }) {
  const t = useTranslations("frontdesk");
  const res = useResource<FormatoArmado>(() => getFormatoArmado(clave, sesionId, centro), [clave, sesionId, centro]);
  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const printRef = React.useRef<HTMLDivElement>(null);
  // Logo: el del centro; si no tiene, el de CUALQUIER centro (misma empresa → mismo logo).
  const logoUrl = centrosRes.state.kind === "ok"
    ? (centrosRes.state.data.find((c) => c.id === centro)?.logoUrl ?? centrosRes.state.data.find((c) => c.logoUrl)?.logoUrl ?? null)
    : null;
  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">…</p>;
  if (res.state.kind !== "ok") return <p className="text-sm text-destructive">{t("formatoError")}</p>;
  const d = res.state.data;
  const cols = d.columnas ?? [];
  const filas = d.filas ?? [];
  const campos = d.campos ?? [];
  const secciones = d.secciones ?? [];
  // El discriminador es `layout` (no la presencia de columnas): "campos" = encabezado etiqueta/valor;
  // cualquier otro (o ausente con columnas) = rejilla. Contrato del handoff-formato-campos-secciones-pie.
  const esCampos = (d.layout ?? (cols.length ? "tabla" : "campos")) === "campos";
  // Etiqueta por labelKey: traducción si existe; si no, el ÚLTIMO segmento en MAYÚSCULAS (nunca la clave
  // cruda en el papel). Handoff §"Claves i18n": el FE solo traduce; si falta, cae al segmento.
  const label = (key?: string | null, fallback?: string) => {
    if (key && t.has(key)) return t(key);
    const seg = (key ?? "").split(".").pop() ?? "";
    return (fallback ?? seg.replace(/_/g, " ")).toUpperCase();
  };
  // Pie del legacy en TODOS los formatos: `{prefijo}{login||usuario} - {fechaHora}`.
  const pie = d.pie;
  const pieTexto = pie ? `${pie.prefijo ?? ""}${pie.login || pie.usuario || ""} - ${pie.fechaHora ?? ""}` : "";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" onClick={onVolver}>{t("volver")}</Button>
        <Button size="sm" onClick={() => imprimirFormato(printRef.current, d.titulo || t("imprimirPdf"))}>{t("imprimirPdf")}</Button>
      </div>
      <div ref={printRef} className="formato-print rounded-lg border bg-white p-6 text-black">
        {/* Membrete: logo (empresa) + nombre de la empresa + centro + título del documento (3 líneas). */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-2 max-h-10 object-contain" />}
          <div className="text-base font-bold uppercase tracking-wide">{t("formatoEmpresa")}</div>
          {d.membrete?.centro && <div className="text-sm font-semibold uppercase">{d.membrete.centro}</div>}
          <h2 className="mt-1 text-lg font-bold uppercase">{d.titulo}</h2>
        </div>

        {esCampos ? (
          /* Encabezado de pares etiqueta/valor (Vit C): una línea por campo, etiqueta en negrita ` : ` valor.
             Nada de rejilla ni columnas inventadas. */
          <div className="mt-4 space-y-2 text-sm">
            {campos.map((c) => (
              <div key={c.clave} style={{ display: "flex", gap: "6px" }}>
                <span className="font-bold">{label(c.labelKey)} :</span>
                <span>{c.valor ?? ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Paciente + récord + fecha (solo rejilla; en "campos" ya van dentro de los campos). */}
            <div className="mt-4 flex items-end justify-between border-b pb-2 text-sm">
              <div>
                <span className="text-base font-bold">{d.paciente?.nombre ?? "—"}</span>
                {d.paciente?.record && <span className="ml-3 font-semibold">{t("recordLabel")} #{d.paciente.record}</span>}
              </div>
              <div className="tabular-nums">{d.fecha ?? ""}</div>
            </div>
            {/* Rejilla con filas en blanco (aireadas, para llenar a mano). */}
            <table className="formato-grid mt-3 w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-neutral-100 text-left">
                  {cols.map((c) => <th key={c.clave} className="border border-neutral-300 px-2 py-1.5 font-semibold">{label(c.labelKey, c.clave)}</th>)}
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

        {/* Secciones (observaciones / firmas), en cualquier layout. */}
        {secciones.map((s) => (
          <div key={s.clave} className="region mt-4" style={{ breakInside: "avoid" }}>
            <div className="mb-1 text-sm font-bold uppercase">{label(s.labelKey)}</div>
            {s.tipo === "texto_libre" ? (
              // Recuadro con `alto` líneas en blanco (≈22px por línea) para escribir a mano.
              <div style={{ border: "1px solid #999", minHeight: `${Math.max(1, s.alto ?? 3) * 22}px` }} />
            ) : s.tipo === "firmas" ? (
              // Una línea horizontal por cada entrada, con su etiqueta debajo.
              <div style={{ display: "flex", gap: "24px", marginTop: "26px" }}>
                {(s.lineas ?? []).map((linea, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ borderTop: "1px solid #000", paddingTop: "3px", fontSize: "10px" }}>{label(linea)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {/* Pie del legacy (TODOS): pequeño, a la izquierda, al final. */}
        {pieTexto.trim() && <div className="mt-4 text-left text-[10px] text-neutral-500">{pieTexto}</div>}
      </div>
    </div>
  );
}
