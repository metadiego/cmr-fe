"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { LaserTipo } from "@/lib/api/laser";
import { getDisponibilidadServicio, type PaqueteDisponibilidad } from "@/lib/api/frontdesk";
import { parseAcciones, type ReportAccion } from "@/lib/frontdesk/acciones";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GenericFormatoRender } from "@/components/frontdesk/formato-generico";
import { MlsSheet } from "@/components/frontdesk/mls-sheet";
import { HiltSheet } from "@/components/frontdesk/hilt-sheet";

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
  // Report labelKeys come from the BE fully qualified ("frontdesk.formato.<slug>"): look them up from the root.
  const tRoot = useTranslations();
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
