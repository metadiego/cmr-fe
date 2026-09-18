"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";

import type { Paciente } from "@/lib/api/pacientes";
import { createCita, getTiposCita, type TipoCita } from "@/lib/api/citas";
import { getOpciones, type Opcion } from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { parseDayUTC } from "@/lib/format/fecha";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const NO_MEDICO = "__none__";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtHoy(iso: string, format: ReturnType<typeof useFormatter>): string {
  const d = parseDayUTC(iso);
  return d ? format.dateTime(d, "dayWeekdayShort") : iso;
}

// Walk-in: agrega un paciente al tablero de HOY como cita CONFIRMADA (entra al
// board; BE sella confirmadaEn). Reusa PacienteSelect. tenant-scoped, RBAC en el
// botón que lo abre (citas.create). fecha = hoy (fija). Ver POST /citas (estado).
export function AgregarCitaModal({
  tablero,
  centroId,
  onClose,
  onSaved,
}: {
  tablero: string;
  centroId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("agregarCita");
  const tRoot = useTranslations();
  const format = useFormatter();
  const hoy = todayISO();

  const [tipos, setTipos] = React.useState<TipoCita[]>([]);
  const [medicos, setMedicos] = React.useState<Opcion[]>([]);
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [medicoId, setMedicoId] = React.useState<string>(NO_MEDICO);
  const [notas, setNotas] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getTiposCita().then((ts) => active && setTipos(ts)).catch(() => {});
    getOpciones(tablero, "medico", centroId).then((o) => active && setMedicos(o)).catch(() => {});
    return () => {
      active = false;
    };
  }, [tablero, centroId]);

  // Al elegir paciente: precargar SU médico (paciente.doctorId, cuyo valor coincide con el value de la
  // opción de médico — verificado). Si no tiene, queda «sin médico» — NUNCA null. Se puede cambiar aquí.
  function onPickPaciente(p: Paciente | null) {
    setPaciente(p);
    setMedicoId(p?.doctorId ? String(p.doctorId) : NO_MEDICO);
  }

  // Tipo AUTOMÁTICO, sin selector: si el paciente YA tiene récord, ya tuvo consulta → la cita es de
  // «Seguimiento»; sin récord (paciente nuevo) → «Consulta (Nueva)». El walk-in no pregunta el tipo.
  const tipoAuto = React.useMemo(() => {
    if (tipos.length === 0) return null;
    const seguimiento = tipos.find((x) => x.slug === "seguimiento");
    const nueva = tipos.find((x) => x.slug !== "seguimiento") ?? tipos[0];
    return paciente?.medicalRecordNumber ? (seguimiento ?? nueva ?? null) : (nueva ?? seguimiento ?? null);
  }, [paciente, tipos]);
  const medicoRequerido = !!tipoAuto?.requiresDoctor;
  const canSubmit = !!paciente && !!tipoAuto && (!medicoRequerido || medicoId !== NO_MEDICO) && !busy;

  // The patient's doctor may not serve at this center (`medicos` comes filtered to the active
  // center, see getOpciones above) — the POST is still correct, but the <Select> can't show a
  // label without a matching SelectItem. Add that option by hand, marked, instead of leaving it
  // blank. `doctorName` isn't in schema.d.ts yet (BE typing gap, see
  // docs/specs/agregar-cita-medico-de-otro-centro-handoff-be.md); the cast is temporary.
  const patientDoctorOption = React.useMemo(() => {
    const doctorId = paciente?.doctorId;
    if (!doctorId || medicos.some((m) => m.value === doctorId)) return null;
    // `doctorName`/`doctorClinicName` aren't in schema.d.ts yet (BE typing gap, see handoff); cast.
    const p = paciente as unknown as { doctorName?: string; doctorClinicName?: string };
    return { value: String(doctorId), label: p.doctorName ?? String(doctorId), centro: p.doctorClinicName ?? "" };
  }, [paciente, medicos]);

  async function onGuardar() {
    if (!paciente || !tipoAuto) return;
    setBusy(true);
    try {
      await createCita(
        {
          patientId: paciente.id,
          appointmentTypeId: tipoAuto.id,
          date: hoy,
          status: "confirmada", // entra al tablero de atención de hoy
          ...(medicoId !== NO_MEDICO ? { doctorId: medicoId } : {}),
          ...(notas.trim() ? { notes: notas.trim() } : {}),
        } as Parameters<typeof createCita>[0],
        centroId,
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="relative bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-6 pt-6 pb-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{t("eyebrow")}</span>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-xl leading-tight tracking-tight">{t("title")}</DialogTitle>
            <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
              {t("today")} · {fmtHoy(hoy, format)}
            </span>
          </div>
          <DialogDescription className="mt-0.5 text-xs">{t("subline")}</DialogDescription>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label={t("patient")}>
            <PacienteSelect value={paciente} onChange={onPickPaciente} />
          </Field>

          {/* Tipo AUTOMÁTICO (sin selector): solo lectura, decidido por el récord del paciente. */}
          {tipoAuto && (
            <Field label={t("type")}>
              <span
                className="inline-flex w-fit items-center rounded-md border px-3 py-1.5 text-sm font-medium"
                style={tipoAuto.color ? { borderColor: tipoAuto.color, color: tipoAuto.color, backgroundColor: `${tipoAuto.color}1a` } : undefined}
              >
                {tipoAuto.name}
              </span>
            </Field>
          )}

          {/* Médico del paciente (precargado). La HORA no se pide en el walk-in de hoy. */}
          <Field label={t("doctor") + (medicoRequerido ? " *" : "")}>
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("noDoctor")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MEDICO}>{t("noDoctor")}</SelectItem>
                {patientDoctorOption && (
                  <SelectItem value={patientDoctorOption.value}>
                    <span className="flex items-center gap-2">
                      {patientDoctorOption.label}
                      {/* Con varios centros, nombrar el centro del médico acelera la identificación. */}
                      <Badge variant="warning">
                        {patientDoctorOption.centro ? `${t("otherCenter")} · ${patientDoctorOption.centro}` : t("otherCenter")}
                      </Badge>
                    </span>
                  </SelectItem>
                )}
                {medicos.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("notes")}>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t("notesPlaceholder")} rows={2} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={onGuardar} disabled={!canSubmit}>
            {t("save")}
          </Button>
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
