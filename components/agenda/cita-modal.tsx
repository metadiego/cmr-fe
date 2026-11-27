"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  validarCita,
  crearCitaAgenda,
  getVisitKind,
  actualizarCitaAgenda,
  type Cita,
  type TipoCita,
  type CitaConflicto,
} from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import type { Paciente } from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { AppointmentWhenFields } from "@/components/agenda/appointment-when-fields";
import { chosenTime } from "@/lib/agenda/appointment-when";
import { visitTypeId } from "@/lib/agenda/booking/type-list";
import { BookingFooterSummary, ClinicField, DoctorField, StatusField } from "@/components/agenda/cita-modal-fields";
import { StepLabel } from "@/components/kit/step-label";
import { getActiveCentro, isClinicViewAll, setActiveCentro } from "@/lib/tenant";
import { createClinicReady, formCreateClinic } from "@/lib/create-clinic";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { datosFaltantesDe } from "@/lib/api/ehr-gate";
import { citaBlockingCode } from "@/lib/api/cita-errors";
import { apiErrorLabel } from "@/lib/api/errors";
import type { EhrReadinessField } from "@/lib/api/ehr-integration";
import { EhrReadinessModal } from "@/components/tablero/ehr-readiness-modal";
import { useResource } from "@/hooks/use-resource";
import { useAppointmentSlots } from "@/hooks/use-appointment-slots";
import { useMe } from "@/hooks/use-me";
import { useShowAppointmentResult } from "@/hooks/use-appointment-result";
import { addMinutes } from "@/lib/agenda/calendar";
import { appointmentMissing, type AppointmentField } from "@/lib/agenda/appointment-missing";
import { citaEditPayload } from "@/lib/agenda/cita-edit-payload";
import { bookingSummary, clinicIsFixed, startsWithChoiceMade, timeRange } from "@/lib/agenda/appointment-form";
import { Button } from "@/components/ui/button";
import { AvisoDisponibilidad } from "@/components/citas/aviso-disponibilidad";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PatientPickerWithCreate } from "@/components/citas/patient-picker-with-create";
import { CitaActions } from "@/components/citas/cita-actions";
import { useCanInCenter } from "@/hooks/use-can-in-center";
import { bookedUnconfirmedNotice, bornConfirmedByDefault, CONFIRM_PERMISSION, confirmToggleShown, createConfirmed } from "@/lib/lifecycle/confirm-on-create";
import { useStatusColours } from "@/hooks/use-status-colours";
import { getDefinicion, type TableroDefinicion } from "@/lib/api/tablero";
import { CONSULTATION_BOARD } from "@/lib/frontdesk/consultation-board";

export function CitaModal({
  open,
  fecha,
  cita,
  pacienteInicial,
  centroId,
  horaInicial,
  tipoCitaIdInicial,
  tipos,
  medicos: medicosProp,
  canal,
  confirmedInitial,
  allowedActions,
  onOpenChange,
  onSaved,
  onPatientDataClosed,
}: {
  open: boolean;
  fecha: string; // ISO prefilled
  cita?: Cita | null;
  pacienteInicial?: Paciente | null;
  centroId?: string; // prefill center (e.g. from the day-view slot)
  horaInicial?: string; // prefill start time from the block
  tipoCitaIdInicial?: string; // prefill appointment type from the block
  tipos: TipoCita[];
  medicos: Personal[];
  // Who opens THIS dialog, for the BE's portfolio rule (only `callcenter` makes the agent the owner of a
  // patient with none yet). Each screen declares its own; undeclared sends nothing and the BE uses
  // 'frontdesk'. Handoff bug-canal-callcenter-no-se-manda-handoff-fe.md.
  canal?: "frontdesk" | "callcenter";
  // Create only: whether the toggle starts on confirmed, over the channel's default (a board's walk-in: true).
  confirmedInitial?: boolean;
  // Edit only: the row's `allowedActions` when opened from a list that has them (CitaActions draws them).
  allowedActions?: string[] | null;
  onOpenChange: (open: boolean) => void;
  // Gets the appointment just saved (create/edit) so the caller can show it at once.
  onSaved: (cita?: Cita) => void;
  // The EHR-data form (PACIENTE_DATOS_REQUERIDOS) was closed without completing it: a board filters on them.
  onPatientDataClosed?: (patient: Paciente) => void;
}) {
  const t = useTranslations("agenda.modal");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const format = useFormatter();
  const isEdit = !!cita;

  const me = useMe();
  const callcenterId = me.kind === "ok" ? me.me.staffId ?? undefined : undefined;
  const boardStatuses = useStatusColours(isEdit);

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  // An hour picked from one clinic's availability keeps that clinic (lib/agenda/appointment-form.ts).
  const clinicFixed = clinicIsFixed({ isEdit, givenClinic: centroId, givenTime: horaInicial });
  const needsCentro = !isEdit && !clinicFixed && centros.length > 1;
  const [centroSel, setCentroSel] = React.useState("");
  // The record's clinic on edit, else the one it was opened in, else the top bar's; on «Ambos» with no
  // clinic given it starts empty and asks (lib/create-clinic.ts).
  const viewAll = isClinicViewAll();
  const effectiveCentro = formCreateClinic({
    picked: centroSel, given: cita?.clinicId || centroId, active: getActiveCentro(), centers: centros.map((c) => c.id), viewAll,
  });
  // Born confirmed needs appointments.confirm in the clinic it is created in (cmr-be 4a): known missing = no toggle, born booked, and a toast says so.
  const canConfirmHere = useCanInCenter(CONFIRM_PERMISSION, effectiveCentro || undefined);
  // `medicos` are the clinic the caller opened it in; a clinic picked here lists its own doctors.
  const otherClinic = !!effectiveCentro && effectiveCentro !== centroId;
  const medicosRes = useResource<Personal[] | null>(
    () => (otherClinic ? getMedicos(effectiveCentro) : Promise.resolve(null)),
    [otherClinic, effectiveCentro],
  );
  const medicos = otherClinic ? (medicosRes.state.kind === "ok" ? (medicosRes.state.data ?? []) : []) : medicosProp;

  // La fecha es EDITABLE dentro del modal (antes era de solo lectura): se puede citar para otro día sin salir.
  // Nace con la que trae el contexto (la vista del día / la cita en edición). Handoff bug-agenda-sin-selector §1.
  const [fechaSel, setFechaSel] = React.useState(fecha);
  const [paciente, setPaciente] = React.useState<Paciente | null>(pacienteInicial ?? null);
  // Candado PACIENTE_DATOS_REQUERIDOS del BE: antes esta pantalla solo mostraba un toast genérico y
  // el usuario no sabía qué faltaba (handoff quejas-de-mostrador-2026-10-20, era una de las 4
  // pantallas sin el modal). null = sin gate.
  const [ehrGate, setEhrGate] = React.useState<EhrReadinessField[] | null>(null);
  const [tipoCitaId, setTipoCitaId] = React.useState(cita?.appointmentTypeId ?? tipoCitaIdInicial ?? "");
  // El médico llega PRESELECCIONADO: el de la cita (edición) o el asignado al paciente (`paciente.doctorId`).
  // Vacío = "Sin médico" (opción nula, nunca un registro comodín). Handoff agenda-estado-y-el-medico-comodin.
  const medicoDelPaciente = (p: Paciente | null) => (p as { doctorId?: string | null } | null)?.doctorId ?? "";
  const [medicoId, setMedicoId] = React.useState(cita?.doctorId ?? medicoDelPaciente(pacienteInicial ?? null));
  const [horaSet, setHora] = React.useState(cita?.time ?? horaInicial ?? "09:00");
  const [horaFinSet, setHoraFin] = React.useState(() => {
    if (cita?.endTime) return cita.endTime;
    const tp = tipos.find((x) => x.id === (cita?.appointmentTypeId ?? tipoCitaIdInicial));
    const start = cita?.time ?? horaInicial ?? "09:00";
    // La hora de fin SIEMPRE deriva del inicio (+ duración del tipo, o 30 min por defecto). Antes caía a
    // "09:30" fija cuando aún no había tipo, y con inicio a las 14:00 la cita "terminaba" a las 9:30 AM
    // (antes de empezar). Handoff bug-agenda-sin-selector-de-fecha §3.
    return addMinutes(start, tp?.durationMinutes ?? 30);
  });

  // One time, from the type's SLOTS that day; never blocking (hooks/use-appointment-slots.ts).
  const { slots, loaded: slotsLoaded, duration: slotDuration, holiday: festivoHoy, sheet } = useAppointmentSlots(effectiveCentro, fechaSel, tipoCitaId);
  // The hour really booked: a preset hour the day does not offer is dropped (lib/agenda/appointment-when.ts),
  // kept on edit and when it was picked on a calendar.
  const hora = chosenTime({
    time: horaSet,
    slots,
    loaded: slotsLoaded,
    keep: isEdit || startsWithChoiceMade({ isEdit, typeId: tipoCitaIdInicial, time: horaInicial }),
  });
  const horaFin = hora ? horaFinSet : "";
  // La hora elegida ya no tiene cupo → aviso NO bloqueante (el BE deja agendar igual).
  const slotLleno = !!hora && slots.some((s) => s.time === hora && s.vacios <= 0);

  // Tres estados, no un booleano forzado: `undefined` = nadie lo declaró, y el BE corre su propio
  // chequeo por los datos reales del paciente (récord, historial, médico en ficha) para decidir si
  // es de verdad primera vez — pero SOLO cuando el payload no manda nada. Mandar `false` por
  // defecto (como antes) apagaba ese chequeo siempre y el personal de call-center, que no tiene por
  // qué saber que hay que marcar la casilla a mano, terminaba citando pacientes nuevos como si
  // fueran de seguimiento. Handoff bug-primera-vez-fuerza-medico-handoff-fe.
  // Whether a NEW appointment is born confirmed (`confirmed` on create): the channel's default
  // (lib/lifecycle/confirm-on-create.ts) until the person flips the toggle. Still editable below.
  const [confirmedPicked, setConfirmedPicked] = React.useState<boolean | null>(null);
  const confirmedWanted = confirmedPicked ?? bornConfirmedByDefault(canal, confirmedInitial);
  const [motivo, setMotivo] = React.useState(cita?.reason ?? "");
  const [notas, setNotas] = React.useState(cita?.notes ?? "");
  const [warn, setWarn] = React.useState<CitaConflicto[] | null>(null);
  // VISIT_IN_PROGRESS / APPOINTMENT_DATE_IN_PAST (cmr-be #696/#697): a hard block discovered only on
  // submit, shown inline (never a toast) until the next attempt — handoff
  // .personal/handoff-citas-en-curso-y-fecha-pasada.md.
  const [blockError, setBlockError] = React.useState<string | null>(null);
  // Another clinic has its own hours: the hour is picked again from that clinic's slots.
  function pickClinic(id: string) {
    setCentroSel(id);
    setHora("");
    setHoraFin("");
    setWarn(null);
    setShowChoice(true);
  }
  // Opened from the booking calendar with type and hour already chosen: shown as a summary with
  // «Cambiar» rather than asked again. Notes stay behind «+ Añadir nota» until wanted.
  const [showChoice, setShowChoice] = React.useState(
    () => !startsWithChoiceMade({ isEdit, typeId: tipoCitaIdInicial, time: horaInicial }),
  );
  const [notesOpen, setNotesOpen] = React.useState(!!cita?.notes);

  const tipo = tipos.find((x) => x.id === tipoCitaId);
  // New or follow-up is a FACT of the patient's history, decided by the BE (owner's rule, 7-nov-2026):
  // follow-up only after an earlier ATTENDED medical appointment; therapies, a record number or an
  // assigned doctor prove nothing. Asked of the same endpoint as the Citas booking screen. (It used to
  // read the patient's `attendedBy`, which is the call-center operator, so a patient with no operator
  // always came up as «nueva».) Unknown while loading or on failure: nothing is guessed, the BE still
  // corrects the type on save.
  const visitRes = useResource(
    () => (paciente && !isEdit ? getVisitKind(paciente.id, effectiveCentro || undefined).catch(() => null) : Promise.resolve(null)),
    [paciente?.id, isEdit, effectiveCentro],
  );
  const visitKind = visitRes.state.kind === "ok" ? (visitRes.state.data ?? undefined) : undefined;
  const esPrimeraVezEff = visitKind ? !visitKind.attendedBefore : undefined;
  // The type follows it once known, unless the user changed it by hand. A type passed in by the caller
  // (the booking screen's "What are we booking?") counts as touched, so it is never overridden.
  const [tipoTouched, setTipoTouched] = React.useState(!!tipoCitaIdInicial);
  const tipoAutoId = visitTypeId(tipos as Array<TipoCita & { slug?: string | null }>, visitKind);
  const [autoPid, setAutoPid] = React.useState<string | null>(null);
  if (!cita && paciente && tipoAutoId && !tipoTouched && autoPid !== paciente.id) {
    setAutoPid(paciente.id);
    setTipoCitaId(tipoAutoId);
  }
  const medicoRequired = !!tipo?.requiresDoctor && esPrimeraVezEff === false;

  // Pick a type → auto-fill end time (start + duración), reset any prior warning.
  function onTipoChange(id: string) {
    setTipoTouched(true); // el usuario lo cambió a mano → no volver a autoseleccionar
    setTipoCitaId(id);
    const tp = tipos.find((x) => x.id === id);
    if (tp) setHoraFin(addMinutes(hora, tp.durationMinutes));
    setWarn(null);
  }
  function onHoraChange(value: string) {
    setHora(value);
    // Derivar SIEMPRE la hora de fin del inicio (aunque no haya tipo: 30 min por defecto), para que nunca
    // quede antes del inicio. Handoff bug-agenda-sin-selector-de-fecha §3.
    setHoraFin(addMinutes(value, slotDuration ?? tipo?.durationMinutes ?? 30));
    setWarn(null);
  }

  // Several clinics on create: the picker asks. Otherwise an empty clinic only happens on «Ambos» while
  // the clinic list has not arrived (or failed): the button waits and says why.
  const missingKeys = appointmentMissing({
    clinicPicker: needsCentro,
    clinicId: effectiveCentro,
    date: fechaSel,
    time: hora,
    endTime: horaFin,
    patientId: paciente?.id,
    doctorRequired: medicoRequired,
    doctorId: medicoId,
    typeId: tipoCitaId,
  });
  const fieldLabel: Record<AppointmentField, string> = {
    clinic: t("centro"),
    date: t("date"),
    time: t("time"),
    patient: t("patient"),
    doctor: t("doctor"),
    type: t("type"),
  };
  const missing = missingKeys.map((f) => fieldLabel[f]);
  const clinicPending = !isEdit && !needsCentro && !createClinicReady(effectiveCentro, centros.length, viewAll);
  // Loading only while the list is really loading; loaded with none = the person has no clinic.
  const clinicReason = !clinicPending
    ? null
    : centrosRes.state.kind === "loading"
      ? tc("loading")
      : centrosRes.state.kind === "fail"
        ? centrosRes.state.message
        : tRoot("caja.sinCentro");

  const pickedDay = fechaSel ? parseDayUTC(fechaSel.slice(0, 10)) : null;
  const dayLabel = pickedDay ? format.dateTime(pickedDay, "dayWeekdayShort") : "";
  const clinicName = centros.length > 1 ? centros.find((c) => c.id === effectiveCentro)?.name : undefined;
  const choiceSummary = bookingSummary([tipo?.name, dayLabel, timeRange(hora, horaFin), clinicName]);
  const medico = medicos.find((m) => m.id === medicoId);
  const footerRest = bookingSummary([tipo?.name, medico ? [medico.name, medico.lastName].filter(Boolean).join(" ") : null, clinicName]);

  const showResult = useShowAppointmentResult();
  // Either the overlap check found conflicts (shown; a second «Guardar» confirms) or the appointment
  // was saved. The button is disabled while anything is missing, so the throw is only a backstop.
  type Outcome =
    | { kind: "conflicts"; conflicts: CitaConflicto[] }
    | { kind: "saved"; saved: Cita | undefined; advertencias: Parameters<typeof mostrarAvisos>[0]; patient: Paciente };
  async function save(): Promise<Outcome> {
    setBlockError(null);
    if (!paciente || !tipoCitaId) throw new Error(t("patient"));
    // Validate overlap first (unless the user already confirmed past a warning).
    if (warn === null) {
      const res = await validarCita(
        {
          doctorId: medicoId || undefined,
          date: fechaSel,
          time: hora,
          endTime: horaFin,
          appointmentTypeId: tipoCitaId,
          excluirCitaId: cita?.id,
        },
        effectiveCentro || undefined,
      );
      if (res.conflictos.length > 0) return { kind: "conflicts", conflicts: res.conflictos };
    }

    // Edit = PUT with only the fields the update accepts (lib/agenda/cita-edit-payload.ts); the
    // date, type and patient are locked in edit mode (a new date or type is a reschedule).
    let editPayload = null;
    if (isEdit) {
      const edit = citaEditPayload(cita!, {
        patientId: paciente.id,
        appointmentTypeId: tipoCitaId,
        doctorId: medicoId,
        date: fechaSel,
        time: hora,
        endTime: horaFin,
        reason: motivo,
        notes: notas,
      });
      if (edit.kind === "locked") throw new Error(t("editLockedError"));
      editPayload = edit.payload;
    }

    const payload = {
      patientId: paciente.id,
      appointmentTypeId: tipoCitaId,
      doctorId: medicoId || undefined,
      date: fechaSel,
      time: hora,
      endTime: horaFin,
      channel: canal,
      isFirstVisit: esPrimeraVezEff,
      reason: motivo.trim() || undefined,
      notes: notas.trim() || undefined,
    };
    const { cita: saved, advertencias } = isEdit
      ? await actualizarCitaAgenda(cita!.id, editPayload ?? {}, effectiveCentro || undefined)
      : await crearCitaAgenda(
          { ...payload, confirmed: createConfirmed(confirmedWanted, canConfirmHere), bookedByStaffId: callcenterId },
          effectiveCentro || undefined,
        );
    return { kind: "saved", saved, advertencias, patient: paciente };
  }

  const { submitting, submit } = useSubmit(save, {
    onSuccess: (r) => {
      if (r.kind === "conflicts") {
        setWarn(r.conflicts);
        return;
      }
      if (effectiveCentro) setActiveCentro(effectiveCentro);
      if (isEdit) {
        toast.success(t("updated"));
        // BE #547: interpolates date/time/opensAt/etc. into the labelKey. Not blocking: already saved.
        mostrarAvisos(r.advertencias, tRoot);
      } else {
        // Every create shows the booking success dialog (spec §1); "moved" when the BE moved the live one.
        if (bookedUnconfirmedNotice(confirmedWanted, canConfirmHere)) toast.warning(tRoot("lifecycle.bookedUnconfirmed"));
        void showResult(r.saved, r.advertencias, {
          patient: r.patient, asked: { date: fechaSel, time: hora }, typeName: tipo?.name ?? "", types: tipos,
          doctor: medicos.find((m) => m.id === medicoId), center: centros.find((c) => c.id === effectiveCentro),
        });
      }
      onSaved(r.saved);
      onOpenChange(false);
    },
    // The BE's PACIENTE_DATOS_REQUERIDOS lock: open the modal that says what is missing.
    onError: (err) => {
      const faltantes = datosFaltantesDe(err);
      if (faltantes) {
        setEhrGate(faltantes);
        return true;
      }
      if (citaBlockingCode(err)) {
        setBlockError(apiErrorLabel(err, tRoot));
        return true;
      }
      return false;
    },
  });

  // Never empty: with no doctor it reads "Sin médico" (blocks saving only when the TYPE requires one).
  const doctorField = (
    <DoctorField
      medicoId={medicoId}
      onChange={(v) => { setMedicoId(v); setWarn(null); }}
      medicoRequired={medicoRequired}
      medicos={medicos}
    />
  );
  // On create, the state it is born with (BE allowlist): two options, so a toggle. Colours and labels
  // come from the status catalogue. On edit, the current status as a badge.
  const statusField = (
    <StatusField
      isEdit={isEdit}
      statuses={boardStatuses}
      cita={cita ?? null}
      confirmed={canConfirmHere !== false && confirmedWanted}
      canConfirm={confirmToggleShown(canConfirmHere)}
      onChange={setConfirmedPicked}
    />
  );

  const patientField = (
    <>
      {/* The patient comes first: choosing them picks the type (Nueva/Seguimiento, from their history)
          and their doctor, and the type decides which hours are free. */}
      <Field label={t("patient")} required>
        {isEdit ? (
          // Locked in edit mode: the update cannot move an appointment to another patient.
          <div className="flex h-9 items-center truncate rounded-md border border-input bg-muted/40 px-3 text-sm font-medium">
            {paciente ? paciente.displayName || [paciente.firstName, paciente.lastName].filter(Boolean).join(" ") : "—"}
          </div>
        ) : (
          <PatientPickerWithCreate
            value={paciente}
            onChange={(p) => {
              setPaciente(p);
              // Preselect the patient's doctor unless one was already chosen (never overrides a manual pick).
              if (!medicoId && medicoDelPaciente(p)) setMedicoId(medicoDelPaciente(p));
            }}
          />
        )}
      </Field>
    </>
  );
  const notesFields = (
    <>
      <Field label={t("reason")}>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
      </Field>
      {notesOpen ? (
        <Field label={t("notes")}>
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} autoFocus={!cita?.notes} />
        </Field>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setNotesOpen(true)}>
          {t("addNote")}
        </Button>
      )}
    </>
  );
  // Who is free that day and the overlap warning: under the pickers, or under the summary.
  const notices = (
    <>
      {/* Aviso de disponibilidad: si el médico no está ese día, lo advierte con el motivo (la fecha
          aquí viene del slot del día, así que solo informa; el usuario decide). */}
      <AvisoDisponibilidad doctorId={medicoId || undefined} date={fechaSel} centro={effectiveCentro || undefined} />

      {warn && (
        <div className="rounded-md border border-warning/40 bg-warning px-3 py-2 text-sm">
          <p className="font-medium text-warning-foreground">{t("overlapWarn")}</p>
          <ul className="mt-1 text-xs text-muted-foreground">
            {warn.map((c) => (
              <li key={c.appointmentId}>· {c.time}–{c.endTime}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <>
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size={showChoice ? "2xl" : "xl"}
      title={isEdit ? t("editTitle") : t("title")}
      // Booking over an overlap is a deliberate override: once the warning shows, only the button does it.
      onSubmit={warn ? () => {} : () => submit()}
      submitLabel={t("save")}
      actions={warn ? [{ label: t("saveAnyway"), onClick: () => submit() }] : undefined}
      submitting={submitting}
      missing={missing}
      blocked={clinicPending || !!blockError}
      reason={clinicReason ?? blockError}
      extra={<BookingFooterSummary when={hora ? bookingSummary([dayLabel, timeRange(hora, horaFin)]) : null} rest={footerRest} />}
    >
      <div className="flex items-center justify-between gap-2">
        <RequiredLegend />
        {/* On edit, the desk ACTIONS (confirm/reschedule/cancel/no-show), the same component as the
            board. A status change reloads and closes. Handoff agenda-abrir-la-cita. */}
        {isEdit && cita && (
          <CitaActions
            cita={cita}
            allowedActions={allowedActions}
            onChanged={() => {
              onSaved();
              onOpenChange(false);
            }}
          />
        )}
      </div>

      {needsCentro && <ClinicField centros={centros} value={effectiveCentro} onChange={pickClinic} />}

      {isEdit && <p className="text-xs text-muted-foreground">{t("editLocked")}</p>}

      {showChoice ? (
        // Picking the day and hour: what on a tinted panel, when beside it (one column below lg).
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="min-w-0 space-y-4 rounded-xl bg-muted/40 p-4 dark:bg-muted/20">
            <StepLabel n={1}>{t("stepAppointment")}</StepLabel>
            {patientField}
            <Field label={t("type")} required>
              <Select value={tipoCitaId || undefined} onValueChange={onTipoChange} disabled={isEdit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />
                        {x.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {doctorField}
            {statusField}
            {notesFields}
          </div>
          {/* lg:pt-4 matches the left panel's padding, so both step labels sit on one line. */}
          <div className="min-w-0 space-y-4 lg:pt-4">
            <StepLabel n={2}>{t("stepWhen")}</StepLabel>
            <AppointmentWhenFields
              date={fechaSel}
              onDateChange={setFechaSel}
              dateLocked={isEdit}
              min={isEdit ? undefined : todayPR()}
              slots={slots}
              time={hora}
              clinicId={effectiveCentro}
              typeId={tipoCitaId}
              onTimeChange={onHoraChange}
              holiday={festivoHoy}
              sheet={sheet}
            />
            {notices}
          </div>
        </div>
      ) : (
        <>
          {patientField}
          <Field label={t("chosen")} required>
            <div className="flex items-center gap-3 rounded-md border border-input bg-muted/40 px-3 py-2">
              {tipo && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tipo.color }} />}
              <span className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">{choiceSummary || "—"}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowChoice(true)}>
                {t("change")}
              </Button>
            </div>
            {slotLleno && (
              <p className="mt-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
                {t("slotFullWarn")}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {doctorField}
            {statusField}
          </div>
          {notesFields}
          {notices}
        </>
      )}
    </FormDialog>
    {ehrGate && paciente && (
      <EhrReadinessModal
        pacienteId={paciente.id}
        faltantes={ehrGate}
        centroId={effectiveCentro || undefined}
        onCancel={() => {
          setEhrGate(null);
          onPatientDataClosed?.(paciente);
        }}
        onCompleted={() => {
          setEhrGate(null);
          void submit();
        }}
      />
    )}
    </>
  );
}
