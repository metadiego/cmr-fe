"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { CitaFila } from "@/lib/api/agenda-dia";
import { createCita, getTiposCita, type TipoCita } from "@/lib/api/citas";
import { getOpciones, ejecutarAccion, type Opcion } from "@/lib/api/tablero";
import { asignarRecord } from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const NO_MEDICO = "__none__";

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Modal de AGENDAMIENTO que se abre tras marcar ASISTIDO (por `render.postAccion`
// en la columna, no hardcode). Crea la PRÓXIMA cita del paciente. La PRESCRIPCIÓN
// es plug-and-play: su sección se enchufa cuando el catálogo exista (hoy 404 → no
// se renderiza), sin tocar este modal. Ver docs/specs/ap-board — handoff PR #35.
export function NuevaCitaModal({
  tablero,
  fila,
  centroId,
  onClose,
  onSaved,
}: {
  tablero: string;
  fila: CitaFila;
  centroId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("nuevaCita");
  const tRoot = useTranslations();
  const { can } = useCan();

  const pacienteId = String(fila.pacienteId ?? "");
  const paciente = String(fila.paciente ?? fila.pacienteNombre ?? "");

  const [tipos, setTipos] = React.useState<TipoCita[]>([]);
  const [medicos, setMedicos] = React.useState<Opcion[]>([]);
  const [record, setRecord] = React.useState<string>(String(fila.record ?? ""));

  const [tipoId, setTipoId] = React.useState<string>("");
  const [medicoId, setMedicoId] = React.useState<string>(NO_MEDICO);
  const [fecha, setFecha] = React.useState<string>("");
  const [notas, setNotas] = React.useState<string>("");
  const [busy, setBusy] = React.useState<null | "save" | "open" | "exit" | "record">(null);

  // Catálogos data-driven (tipos + médicos por centro). Cero listas hardcodeadas.
  React.useEffect(() => {
    let active = true;
    getTiposCita()
      .then((ts) => {
        if (!active) return;
        setTipos(ts);
        // Default = seguimiento (la próxima cita tras atender suele serlo).
        const seg = ts.find((x) => x.clave === "seguimiento") ?? ts[0];
        if (seg) setTipoId(seg.id);
      })
      .catch(() => {});
    getOpciones(tablero, "medico", centroId)
      .then((o) => {
        if (!active) return;
        setMedicos(o);
        // Preseleccionar el médico actual de la cita si se puede resolver por nombre.
        const cur = o.find((x) => x.label === String(fila.medico ?? ""));
        if (cur) setMedicoId(cur.value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tablero, centroId, fila.medico]);

  const canWrite = can("citas.create");

  async function crear(tId: string, f: string) {
    if (!pacienteId || !tId || !f) return;
    await createCita(
      {
        pacienteId,
        tipoCitaId: tId,
        fecha: f,
        ...(medicoId !== NO_MEDICO ? { medicoId } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      } as Parameters<typeof createCita>[0],
      centroId,
    );
    onSaved?.();
    onClose();
  }

  async function onGuardar() {
    setBusy("save");
    try {
      await crear(tipoId, fecha);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  // "Abierto" (seguimiento): crea la próxima a +30 días, sin exigir fecha manual.
  async function onAbierto() {
    const seg = tipos.find((x) => x.clave === "seguimiento") ?? tipos.find((x) => x.id === tipoId);
    if (!seg) return;
    setBusy("open");
    try {
      await crear(seg.id, plusDaysISO(30));
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  // "ALTA": no agenda próxima cita, solo cierra (el paciente queda atendido).
  function onAlta() {
    onSaved?.();
    onClose();
  }

  // "Salir": revierte ASISTIDO (vuelve a en_consulta, limpia horaOut) y cierra.
  async function onSalir() {
    setBusy("exit");
    try {
      await ejecutarAccion({ tablero, entidadId: fila.id, accion: "volver_en_consulta" }, centroId);
      onSaved?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
      onClose();
    }
  }

  async function onGenerarRecord() {
    if (!pacienteId) return;
    setBusy("record");
    try {
      const p = await asignarRecord(pacienteId, centroId);
      setRecord(String((p as { numeroHistoria?: unknown }).numeroHistoria ?? ""));
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader className="gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("eyebrow")}
          </span>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg leading-tight">{paciente || t("patient")}</DialogTitle>
            {record ? (
              <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-sm font-medium tabular-nums">
                #{record}
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onGenerarRecord}
                disabled={anyBusy || !pacienteId}
              >
                {t("generateRecord")}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("doctor")}>
              <Select value={medicoId} onValueChange={setMedicoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("noDoctor")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEDICO}>{t("noDoctor")}</SelectItem>
                  {medicos.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("date")}>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
          </div>

          <Field label={t("type")}>
            <div className="flex flex-wrap gap-2">
              {tipos.map((tp) => {
                const active = tp.id === tipoId;
                return (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => setTipoId(tp.id)}
                    aria-pressed={active}
                    className={
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
                      (active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground")
                    }
                  >
                    {tp.nombre}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("notes")}>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={3}
            />
          </Field>
        </div>

        <div className="flex items-center gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onSalir} disabled={anyBusy}>
            {t("exit")}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {canWrite && (
              <Button type="button" variant="destructive" onClick={onAbierto} disabled={anyBusy || tipos.length === 0}>
                {t("open")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              onClick={onAlta}
              disabled={anyBusy}
            >
              {t("discharge")}
            </Button>
            {canWrite && (
              <Button type="button" onClick={onGuardar} disabled={anyBusy || !tipoId || !fecha}>
                {t("save")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
