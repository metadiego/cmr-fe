"use client";

import { useTranslations } from "next-intl";

import type { FrontdeskFila, Sesion } from "@/lib/api/frontdesk";
import type { Servicio } from "@/lib/api/servicios";
import type { Opcion } from "@/lib/api/tablero";
import type { ReportAccion } from "@/lib/frontdesk/acciones";
import { FormatosModal } from "@/components/frontdesk/formatos-modal";
import { PanelNotificarModal } from "@/components/frontdesk/panel-notificar-modal";
import { HistorialModal } from "@/components/frontdesk/historial-modal";
import { ComprasModal } from "@/components/frontdesk/compras-modal";
import { DosisAvisoDialog, type DosisAviso } from "@/components/frontdesk/dosis-aviso-dialog";

// The modals a session row can open (historial, compras, formatos, notificar, the dosis-no-comprada
// alert): split out of fila-sesion.tsx to keep that file under its 714-line DEBT ceiling
// (eslint.config.mjs) once the NO_PACKAGE_TO_ATTEND gate landed next to it. Same JSX, same props — no
// behavior or UI change.
export function FilaSesionModales({
  fila,
  sesion,
  servicio,
  centro,
  fecha,
  pacienteNombre,
  optionsByCol,
  run,
  guardarCelda,
  onApplied,
  historialOpen,
  setHistorialOpen,
  comprasOpen,
  setComprasOpen,
  formatoReport,
  setFormatoReport,
  notificarCfg,
  setNotificarCfg,
  dosisAviso,
  setDosisAviso,
  setPendSelect,
}: {
  fila: FrontdeskFila;
  sesion?: Sesion;
  servicio?: Servicio;
  centro?: string;
  fecha: string;
  pacienteNombre: string;
  optionsByCol: Record<string, Opcion[]>;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  guardarCelda: (columna: string, valor: unknown, etiqueta?: string) => Promise<unknown>;
  onApplied: () => void;
  historialOpen: boolean;
  setHistorialOpen: (v: boolean) => void;
  comprasOpen: boolean;
  setComprasOpen: (v: boolean) => void;
  formatoReport: ReportAccion | null;
  setFormatoReport: (v: ReportAccion | null) => void;
  notificarCfg: { panel: string; seccion: string } | null;
  setNotificarCfg: (v: { panel: string; seccion: string } | null) => void;
  dosisAviso: DosisAviso | null;
  setDosisAviso: (v: DosisAviso | null) => void;
  setPendSelect: (fn: (p: Record<string, string>) => Record<string, string>) => void;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  return (
    <>
      {sesion?.patientId && (
        <HistorialModal
          open={historialOpen}
          onOpenChange={setHistorialOpen}
          pacienteId={sesion.patientId}
          pacienteNombre={pacienteNombre}
          servicioId={servicio?.id}
          servicioNombre={servicio?.name}
          centro={centro}
        />
      )}
      {sesion?.patientId && (
        <ComprasModal
          open={comprasOpen}
          onOpenChange={setComprasOpen}
          pacienteId={sesion.patientId}
          pacienteNombre={pacienteNombre}
          servicioId={servicio?.id}
          servicioNombre={servicio?.name}
          fecha={fecha}
          centro={centro}
        />
      )}
      {sesion?.patientId && servicio && (
        <FormatosModal
          open={!!formatoReport}
          onOpenChange={(o) => !o && setFormatoReport(null)}
          initialReport={formatoReport ?? undefined}
          servicioNombre={servicio.name}
          formAcciones={servicio.formActions}
          pacienteNombre={pacienteNombre}
          sesionNN={fila["fd_sesiones"] != null ? String(fila["fd_sesiones"]) : undefined} servicioId={servicio?.id} pacienteId={sesion?.patientId}
          record={fila.fd_record != null ? String(fila.fd_record) : undefined}
          sesionId={fila.id} fecha={fecha}
          centro={centro}
          onHistorial={() => setHistorialOpen(true)} onApplied={onApplied}
        />
      )}
      {notificarCfg && sesion?.patientId && (
        <PanelNotificarModal
          open={!!notificarCfg}
          onOpenChange={(o) => !o && setNotificarCfg(null)}
          panelClave={notificarCfg.panel}
          seccion={notificarCfg.seccion}
          sesionId={fila.id}
          servicioNombre={servicio?.name ?? ""}
          pacienteNombre={pacienteNombre}
          enfermeras={optionsByCol["fd_enfermera"] ?? []}
          enfermeraActual={(() => { const raw = fila["fd_enfermera"]; const ops = optionsByCol["fd_enfermera"] ?? []; return ops.find((o) => o.value === raw || o.label === raw)?.value; })()}
          onAsignarEnfermera={(pid) => run(() => guardarCelda("fd_enfermera", pid, tRoot.has("tb.col.enfermera") ? tRoot("tb.col.enfermera") : t("enfermera")))}
          centro={centro}
        />
      )}
      {/* Cartel CENTRADO: dosis no comprada. No bloquea; dos salidas claras (§1 del handoff). */}
      <DosisAvisoDialog
        aviso={dosisAviso}
        onClose={() => setDosisAviso(null)}
        onUsarComprada={() => {
          // Volver a lo comprado: revierte el reflejo a lo que había y no escribe nada.
          const prev = dosisAviso?.prev ?? "";
          const clave = dosisAviso?.clave;
          if (clave) {
            setPendSelect((p) => {
              const n = { ...p };
              if (prev) n[clave] = prev;
              else delete n[clave];
              return n;
            });
          }
          setDosisAviso(null);
        }}
        onAplicarIgual={() => {
          const a = dosisAviso;
          setDosisAviso(null);
          if (!a) return;
          // El BE registra el descuido `dosis_no_comprada` al asistir y sale en la lista.
          run(async () => {
            try {
              return await guardarCelda(a.clave, a.valor, a.etiqueta);
            } catch (e) {
              setPendSelect((p) => {
                const n = { ...p };
                delete n[a.clave];
                return n;
              });
              throw e;
            }
          });
        }}
      />
    </>
  );
}
