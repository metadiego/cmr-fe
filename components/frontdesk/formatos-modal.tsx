"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FORMAT_PRINTED_EVENT } from "@/components/frontdesk/formato-parts";

import type { LaserTipo } from "@/lib/api/laser";
import { getDisponibilidadServicio, type PaqueteDisponibilidad } from "@/lib/api/frontdesk";
import { setLegacySessionNumber } from "@/lib/api/frontdesk-legacy-number";
import { getSessionSheet, type SessionSheet } from "@/lib/api/frontdesk-sheet";
import { parseAcciones, type ReportAccion } from "@/lib/frontdesk/acciones";
import { parseLegacySessionNumber } from "@/lib/frontdesk/legacy-session-number";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GenericFormatoRender } from "@/components/frontdesk/formato-generico";
import { MlsSheet } from "@/components/frontdesk/mls-sheet";
import { HiltSheet } from "@/components/frontdesk/hilt-sheet";
import { SheetSendBar } from "@/components/format-sheet/sheet-send-bar";
import { getFormatos } from "@/lib/api/formatos";
import { fillableSlugsFrom } from "@/lib/format-sheet/sheet";

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
  onApplied,
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
  // El paciente del legado quedó con disponibilidad al día (legacy-session-number aplicó): refresca
  // la fila para que su columna SESIÓN deje de mostrar "—". Handoff numero-sesion-formato-legado.
  onApplied?: () => void;
}) {
  const t = useTranslations("frontdesk");
  // Report labelKeys come from the BE fully qualified ("frontdesk.formato.<slug>"): look them up from the root.
  const tRoot = useTranslations();
  const { can } = useCan();
  const cfg = React.useMemo(() => parseAcciones(formAcciones), [formAcciones]);
  const [report, setReport] = React.useState<ReportAccion | null>(null);
  const [generado, setGenerado] = React.useState(false);
  // Sesión: null = usar el "n/n" AUTOMÁTICO (hoja de la visita → el paquete que corresponde al
  // formato, HILT/MLS; si no casa, el `display` de la hoja). Editable por si acaso (override).
  const [sesionOverride, setSesionOverride] = React.useState<string | null>(null);
  const [areasOverride, setAreasOverride] = React.useState<string | null>(null); // null = usar el de la disponibilidad
  // Enviar el técnico (ya conocido) al impreso, o dejarlo en blanco para llenar a mano como el papel.
  const [enviarTecnico, setEnviarTecnico] = React.useState(true);

  // Disponibilidad del paciente para ESTE servicio: de aquí salen ÁREAS y DÍAS por formato (MLS/HILT). La
  // factura NO es la fuente — un cambio de protocolo no la genera, solo mueve la disponibilidad. El paquete
  // se cruza por nombre/sku del producto (contiene "mls"/"hilt").
  const dispRes = useResource<PaqueteDisponibilidad[]>(
    () => (open && servicioId && pacienteId ? getDisponibilidadServicio(servicioId, pacienteId, centro).then((d) => d.paquetes ?? []) : Promise.resolve([])),
    [open, servicioId, pacienteId, centro],
  );
  const paquetes = dispRes.state.kind === "ok" ? dispRes.state.data : [];

  // Hoja de la visita (BE #598, handoff laser-sesion-del-dia-y-areas): de aquí sale la SESIÓN del
  // paquete correcto (MLS vs HILT, no el ancla "1/12" de la fila cuando la visita de hoy es la otra) y
  // el respaldo de ÁREAS cuando la disponibilidad no las trae.
  const sheetRes = useResource<SessionSheet | null>(
    () => (open && sesionId ? getSessionSheet(sesionId, centro) : Promise.resolve(null)),
    [open, sesionId, centro],
  );
  const sheet = sheetRes.state.kind === "ok" ? sheetRes.state.data : null;

  // Which reports can be filled on screen ("Llenar en pantalla" / QR, no printable-only one):
  // generic per format, from GET /formats' own `fillable` (cmr-be #665), never a FE-side slug list.
  const formatosRes = useResource(() => (open ? getFormatos(undefined, centro) : Promise.resolve([])), [open, centro]);
  const fillableSlugs = React.useMemo(
    () => fillableSlugsFrom(formatosRes.state.kind === "ok" ? formatosRes.state.data : []),
    [formatosRes.state],
  );

  function elegir(r: ReportAccion) {
    setSesionOverride(null); // nace automática (hoja de la visita)
    setAreasOverride(null); // nacen del dato de la disponibilidad
    setReport(r);
    setGenerado(false);
  }
  // Reset al abrir/cerrar (patrón ajustar-en-render). Al abrir con un report preseleccionado (desde el
  // menú de Acciones), se elige directo y se salta la lista.
  // A sheet printed from here closes the dialog once the print window is done (formato-parts).
  React.useEffect(() => {
    if (!open) return;
    const close = () => onOpenChange(false);
    window.addEventListener(FORMAT_PRINTED_EVENT, close);
    return () => window.removeEventListener(FORMAT_PRINTED_EVENT, close);
  }, [open, onOpenChange]);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) { setReport(null); setGenerado(false); }
    else if (initialReport) elegir(initialReport);
  }
  const tipo = ((report?.id || report?.function || report?.action || "") as string).toLowerCase() as LaserTipo;
  const esFormato = tipo === "hilt" || tipo === "mls";
  const pkg = tipo ? paquetes.find((p) => `${p.productoNombre ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(tipo)) : undefined;
  // Áreas DERIVADAS, en orden: multiplicadores del paquete (disponibilidad) y, si no hay, `sheet.areas`
  // (hoja de la visita). Editable: override manual tiene precedencia. Si ninguna trae áreas (p. ej. tras
  // un cambio de protocolo a una terapia sin áreas), se deja VACÍO — nunca un 1 inventado (regla del BE).
  const areasAuto = pkg?.multiplicadores?.areas ?? sheet?.areas ?? undefined;
  const areas = areasOverride ?? (areasAuto != null ? String(areasAuto) : "");
  // Sesión DERIVADA: el "n/n" del paquete de la hoja que corresponde a este formato (HILT → el renglón
  // cuyo sku/productName contiene "hilt"; MLS → el otro); si no casa, el `display` de la hoja; si la
  // hoja todavía no llegó, el "n/n" de la fila (mismo orden que pedía el handoff).
  const sheetPkg = tipo ? sheet?.packages.find((p) => `${p.productName ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(tipo)) : undefined;
  const sesionAuto = sheetPkg?.xy ?? sheet?.display ?? String(sesionNN ?? "");
  const sesion = sesionOverride ?? sesionAuto;

  // «Generar»: si la Sesión escrita es un "n/m" válido, se la pasa al BE ANTES de mostrar el
  // formato (que recién entonces habilita su botón de imprimir). Nunca bloquea: cualquier reason
  // ("not applied") o error de red/5xx se traga en silencio y el formato sigue igual. Handoff
  // numero-sesion-formato-legado.
  async function generar() {
    const parsed = parseLegacySessionNumber(sesion);
    if (parsed && sesionId && can("frontdesk.update")) {
      try {
        const result = await setLegacySessionNumber(sesionId, { ...parsed, reportId: tipo || undefined }, centro);
        if (result.applied) {
          toast.success(t("disponibilidadActualizada", { number: parsed.number, total: parsed.total }));
          onApplied?.();
        }
      } catch {
        /* nunca bloquea: ver comentario arriba */
      }
    }
    setGenerado(true);
  }

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
                    <div className="font-medium">{r.labelKey && tRoot.has(r.labelKey) ? tRoot(r.labelKey) : r.name ?? r.id}</div>
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
                <Input id="fmt-sesion" inputMode="numeric" placeholder="n/n" value={sesion} onChange={(e) => setSesionOverride(e.target.value)} />
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
              <Button onClick={generar}>{t("generar")}</Button>
            </div>
          </div>
        )}

        {/* 3) Render del formato médico de LÁSER (HILT/MLS, ruta propia con parámetros) */}
        {report && generado && tipo === "mls" && (
          <MlsSheet
            centro={centro}
            header={{
              paciente: pacienteNombre,
              record: record ?? "",
              sesion: sesion || (sesionNN ?? ""),
              tecnico: enviarTecnico ? (tecnicoNombre ?? "") : "",
              proximaCita: proximaCita ?? "",
              fecha: fecha ?? "",
              areas: areas ? Number(areas) : null,
            }}
            onVolver={() => setGenerado(false)}
          />
        )}
        {report && generado && tipo === "hilt" && (
          <HiltSheet
            centro={centro}
            header={{
              paciente: pacienteNombre,
              record: record ?? "",
              sesion: sesion || (sesionNN ?? ""),
              tecnico: enviarTecnico ? (tecnicoNombre ?? "") : "",
              proximaCita: proximaCita ?? "",
              fecha: fecha ?? "",
              areas: areas ? Number(areas) : null,
            }}
            onVolver={() => setGenerado(false)}
          />
        )}

        {/* 3b) Formato GENÉRICO (data-driven): documento imprimible armado por el BE. Sin subform. */}
        {report && !esFormato && (
          <>
            {/* A sheet that is filled on screen (GLP-1): open it here, its QR, or «Enviar al iPad». */}
            {sesionId && fillableSlugs.has(report.id) && <SheetSendBar slug={report.id} sessionId={sesionId} />}
            <GenericFormatoRender clave={report.id} sesionId={sesionId} centro={centro} onVolver={() => setReport(null)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
