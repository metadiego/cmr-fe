"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";

import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import {
  crearCitaAgenda,
  getTiposCita,
  listCitas,
  reagendarCitaConAvisos,
  type Cita,
  type TipoCita,
} from "@/lib/api/citas";
import { getOpciones, type Opcion } from "@/lib/api/tablero";
import { ApiError } from "@/lib/api/types";
import { type EhrReadinessField } from "@/lib/api/ehr-integration";
import { toastError } from "@/lib/api/errors";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { addDaysToDay, canReschedule, pickNextAppointment } from "@/lib/agenda/next-appointment";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { useMe } from "@/hooks/use-me";
import { EhrReadinessModal } from "@/components/tablero/ehr-readiness-modal";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { ReturnDatePicker } from "@/components/citas/return-date-picker";
import { patientDoctorOption, type PatientDoctor } from "@/lib/medicos/patient-doctor-option";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AvisoDisponibilidad } from "@/components/citas/aviso-disponibilidad";

const NO_MEDICO = "__none__";

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
  onFilterPatient,
  lockedPatient,
}: {
  tablero: string;
  centroId?: string;
  onClose: () => void;
  onSaved?: () => void;
  // Al paciente NUEVO sin datos, el BE rechaza con 400 (faltan docId/sexo/… para el EHR): se abre el MISMO
  // modal de datos que en Presente; si el usuario lo cierra sin completar, se deja la pantalla FILTRADA en ese
  // paciente para rematarlo sin buscarlo. Handoff traer-al-dia-y-la-pestana-inicial, §2.
  onFilterPatient?: (p: { id: string; nombre: string }) => void;
  // Paciente YA elegido (p. ej. "Citar" desde el header del patient desk, con ese paciente ya
  // seleccionado): se precarga y el buscador no se muestra — mismo patrón que lockedPatient en
  // TherapyDayScheduler (13-oct-2026).
  lockedPatient?: { id: string; nombre: string };
}) {
  const t = useTranslations("agregarCita");
  const tRoot = useTranslations();
  const format = useFormatter();
  const me = useMe();
  const actorId = me.kind === "ok" ? (me.me.staffId ?? undefined) : undefined;
  const hoy = todayPR();

  const [tipos, setTipos] = React.useState<TipoCita[]>([]);
  const [medicos, setMedicos] = React.useState<Opcion[]>([]);
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [medicoId, setMedicoId] = React.useState<string>(NO_MEDICO);
  const [notas, setNotas] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  // Faltantes del EHR que devolvió el 400: abren el modal de datos. null = sin gate.
  const [ehrGate, setEhrGate] = React.useState<EhrReadinessField[] | null>(null);

  // Fecha editable (handoff .personal/handoff-citar-consulta-cambiar-fecha.md): el chip «Hoy» abre
  // un date picker (piso en HOY — nunca el año pasado, caso récord 15059). Elegir otra fecha deja de
  // ser walk-in: aparece la hora, y si el paciente YA tiene una cita abierta, el guardado la MUEVE
  // (reagendo explícito, motivo obligatorio) en vez de crear una duplicada.
  const [fecha, setFecha] = React.useState(hoy);
  const [hora, setHora] = React.useState("");
  const [dateOpen, setDateOpen] = React.useState(false);
  const [citaViva, setCitaViva] = React.useState<Cita | null>(null);
  const [motivoMover, setMotivoMover] = React.useState("");

  // Qué paciente+fecha hace válida la citaViva cargada; cambia → se limpia EN EL RENDER (nunca un
  // setState síncrono dentro del efecto, react-hooks/set-state-in-effect) — el efecto de abajo solo
  // hace la llamada async.
  const citaVivaKey = paciente && fecha !== hoy ? `${paciente.id}|${fecha}` : null;
  const [citaVivaFor, setCitaVivaFor] = React.useState<string | null>(null);
  if (citaVivaKey !== citaVivaFor) {
    setCitaVivaFor(citaVivaKey);
    setCitaViva(null);
  }

  React.useEffect(() => {
    if (!citaVivaKey || !paciente) return;
    let active = true;
    listCitas({ patientId: paciente.id, from: hoy }, centroId)
      .then((r) => {
        if (active) setCitaViva(pickNextAppointment(r.items ?? [], addDaysToDay(hoy, -1)));
      })
      .catch(() => active && setCitaViva(null));
    return () => {
      active = false;
    };
  }, [citaVivaKey, paciente, hoy, centroId]);

  const moving = !!citaViva && citaViva.date !== fecha && canReschedule(citaViva);

  const nombrePaciente = (p: Paciente): string =>
    (p as { displayName?: string }).displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.id;

  React.useEffect(() => {
    let active = true;
    getTiposCita().then((ts) => active && setTipos(ts)).catch(() => {});
    getOpciones(tablero, "medico", centroId).then((o) => active && setMedicos(o)).catch(() => {});
    return () => {
      active = false;
    };
  }, [tablero, centroId]);

  React.useEffect(() => {
    if (!lockedPatient) return;
    let active = true;
    getPaciente(lockedPatient.id, centroId)
      .then((p) => active && onPickPaciente(p))
      .catch((err) => active && toastError(err, tRoot));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPickPaciente is stable per render, re-running on it would refetch every render
  }, [lockedPatient?.id, centroId]);

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
  // El walk-in NO exige médico: desde Atención el médico se asigna al MARCAR PRESENTE, no al agendar
  // (pedirlo antes es pedir un dato que recepción aún no tiene — mismo caso que la enfermera en frontdesk).
  // La regla real del BE (en-atencion-el-medico-se-sabe-despues) NO aplica al canal atencion, así que aquí
  // nunca hace falta; sin médico el BE estampa el «Sin Medico» del centro (legacyCode 000). El asterisco y el
  // botón bloqueado eran artefactos del FE. Si algún tipo lo exigiera de verdad, el BE responde 400 claro y
  // toastError lo muestra — no lo adivinamos aquí. Handoff walk-in-sin-medico-habilitar-el-boton.
  const medicoRequerido = false;
  const canSubmit = !!paciente && !!tipoAuto && !busy && (!moving || !!motivoMover.trim());

  // The patient's doctor may not serve at this center (`medicos` comes filtered to the active
  // center, see getOpciones above) — the POST is still correct, but the <Select> can't show a
  // label without a matching SelectItem. Add that option by hand, marked, instead of leaving it
  // blank. `doctorName` isn't in schema.d.ts yet (BE typing gap, see
  // docs/specs/agregar-cita-medico-de-otro-centro-handoff-be.md); the cast is temporary.
  const doctorExtra = React.useMemo(
    () => patientDoctorOption(medicos.map((m) => m.value), paciente as PatientDoctor | null, centroId),
    [paciente, medicos, centroId],
  );

  async function onGuardar() {
    if (!paciente || !tipoAuto) return;
    setBusy(true);
    try {
      if (moving && citaViva) {
        const { advertencias } = await reagendarCitaConAvisos(
          citaViva.id,
          { date: fecha, time: hora || undefined, reason: motivoMover.trim(), actorId },
          centroId,
        );
        mostrarAvisos(advertencias, tRoot);
      } else {
        const { advertencias } = await crearCitaAgenda(
          {
            patientId: paciente.id,
            appointmentTypeId: tipoAuto.id,
            date: fecha,
            status: "confirmada", // entra al tablero de atención de ese día
            ...(fecha !== hoy && hora ? { time: hora } : {}),
            ...(medicoId !== NO_MEDICO ? { doctorId: medicoId } : {}),
            ...(notas.trim() ? { notes: notas.trim() } : {}),
          } as Parameters<typeof crearCitaAgenda>[0],
          centroId,
        );
        mostrarAvisos(advertencias, tRoot);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      // Candado fail-closed del BE: paciente nuevo sin los datos del EHR → abrir el MISMO modal de datos que
      // en Presente (campo `faltantes`, no `faltan`). Al completar se reintenta el alta; al cerrarlo, el padre
      // deja la pantalla filtrada en el paciente.
      if (err instanceof ApiError && err.code === "PACIENTE_DATOS_REQUERIDOS") {
        const faltantes = (err.data?.faltantes as EhrReadinessField[] | undefined) ?? [];
        if (faltantes.length) {
          setEhrGate(faltantes);
          return;
        }
      }
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="relative bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-6 pt-6 pb-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
            {fecha === hoy ? t("eyebrow") : t("eyebrowScheduled")}
          </span>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-xl leading-tight tracking-tight">{t("title")}</DialogTitle>
            {/* Chip de fecha clicable (handoff .personal/handoff-citar-consulta-cambiar-fecha.md): por
                defecto hoy; ReturnDatePicker ya trae el piso en HOY, así nunca propone el año pasado. */}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
                >
                  {fecha === hoy ? t("today") : t("scheduledFor")} · {fmtHoy(fecha, format)}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-3">
                <ReturnDatePicker value={fecha} onChange={(d) => { setFecha(d); setDateOpen(false); }} />
              </PopoverContent>
            </Popover>
          </div>
          <DialogDescription className="mt-0.5 text-xs">
            {fecha === hoy ? t("subline") : t("sublineScheduled")}
          </DialogDescription>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label={t("patient")}>
            {lockedPatient ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {paciente ? nombrePaciente(paciente) : lockedPatient.nombre}
              </div>
            ) : (
              <PacienteSelect value={paciente} onChange={onPickPaciente} />
            )}
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

          {/* La HORA solo se pide al agendar para otro día — el walk-in de hoy no la necesita. */}
          {fecha !== hoy && (
            <Field label={t("time")}>
              <TimePicker value={hora} onChange={setHora} />
            </Field>
          )}

          {citaViva && citaViva.date !== fecha && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              {citaViva.doctorName
                ? t("hasAppointment", { date: fmtHoy(citaViva.date, format), doctor: citaViva.doctorName })
                : t("hasAppointmentNoDoctor", { date: fmtHoy(citaViva.date, format) })}
            </div>
          )}

          {/* Médico del paciente (precargado). La HORA no se pide en el walk-in de hoy. */}
          <Field label={t("doctor") + (medicoRequerido ? " *" : "")}>
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("noDoctor")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MEDICO}>{t("noDoctor")}</SelectItem>
                {doctorExtra && (
                  <SelectItem value={doctorExtra.id}>
                    <span className="flex items-center gap-2">
                      {doctorExtra.name}
                      {/* Retired, or another center — naming the center speeds up identifying them. */}
                      <Badge variant="warning">
                        {doctorExtra.mark.kind === "retired"
                          ? t("retired")
                          : doctorExtra.mark.center
                            ? `${t("otherCenter")} · ${doctorExtra.mark.center}`
                            : t("otherCenter")}
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

          <AvisoDisponibilidad
            doctorId={medicoId !== NO_MEDICO ? medicoId : undefined}
            date={fecha}
            centro={centroId}
          />

          {moving ? (
            <Field label={t("reasonRequired")}>
              <Input value={motivoMover} onChange={(e) => setMotivoMover(e.target.value)} placeholder={t("reasonRequiredPh")} />
            </Field>
          ) : (
            <Field label={t("notes")}>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t("notesPlaceholder")} rows={2} />
            </Field>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={onGuardar} disabled={!canSubmit}>
            {moving ? t("moveTo", { date: fmtHoy(fecha, format) }) : fecha === hoy ? t("save") : t("saveScheduled")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {ehrGate && paciente && (
      <EhrReadinessModal
        pacienteId={paciente.id}
        faltantes={ehrGate}
        centroId={centroId}
        onCancel={() => {
          // Cerrado sin completar: dejar la pantalla filtrada en este paciente para rematarlo sin buscarlo.
          setEhrGate(null);
          onFilterPatient?.({ id: paciente.id, nombre: nombrePaciente(paciente) });
          onClose();
        }}
        onCompleted={() => {
          // Datos completos → reintentar el alta, que ahora sí pasa el candado del BE.
          setEhrGate(null);
          void onGuardar();
        }}
      />
    )}
    </>
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
