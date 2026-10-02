"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  validarCita,
  crearCitaAgenda,
  actualizarCitaAgenda,
  getCuposLibres,
  type Cita,
  type TipoCita,
  type CitaConflicto,
  type CuposLibres,
} from "@/lib/api/citas";
import type { Personal } from "@/lib/api/personal";
import type { Paciente } from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { SlotPicker, type Slot, type SlotVariant } from "@/components/agenda/slot-picker";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useMe } from "@/hooks/use-me";
import { useEstados } from "@/hooks/use-estados";
import { Badge } from "@/components/ui/badge";
import { addMinutes, todayISO } from "@/lib/agenda/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvisoDisponibilidad } from "@/components/citas/aviso-disponibilidad";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { PacienteSelect } from "@/components/citas/paciente-select";
import { CitaActions } from "@/components/citas/cita-actions";

// Centinela "Sin médico" para que el Select nunca quede en vacío (Radix no admite value="").
const NONE_MEDICO = "__sin_medico__";

export function CitaModal({
  open,
  fecha,
  cita,
  pacienteInicial,
  centroId,
  horaInicial,
  tipoCitaIdInicial,
  tipos,
  medicos,
  canal,
  onOpenChange,
  onSaved,
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
  // Quién abre ESTE modal, para la regla de cartera del BE (duenoDeLaCartera: solo `callcenter`
  // "estrena" al agente como dueño de un paciente sin cartera todavía). Antes viajaba
  // "callcenter" fijo para CUALQUIER invocador de este modal compartido — incluida la ficha del
  // paciente (acciones-paciente-sheet.tsx), que no es call-center y le atribuía la cartera a quien
  // sea que creara la cita ahí. Cada pantalla declara la suya; sin declarar, no viaja nada y el BE
  // cae a su propio default ('atencion'). Handoff bug-canal-callcenter-no-se-manda-handoff-fe.md
  // (su diagnóstico original estaba al revés: el dato SÍ viajaba, pero desde donde no debía).
  canal?: "atencion" | "callcenter";
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("agenda.modal");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const isEdit = !!cita;

  const me = useMe();
  const callcenterId = me.kind === "ok" ? me.me.staffId ?? undefined : undefined;
  const { map: estadosMap, estados } = useEstados();
  // On create the state is the catalog's initial one; on edit it's the cita's.
  const estadoClave = cita?.status ?? estados.find((e) => e.isInitial)?.slug ?? "programada";
  const estadoDef = estadosMap.get(estadoClave);

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const needsCentro = !isEdit && centros.length > 1;
  const [centroSel, setCentroSel] = React.useState(centroId ?? "");
  const effectiveCentro =
    centroSel || cita?.clinicId || centroId || getActiveCentro() || (centros.length === 1 ? centros[0].id : "");

  // La fecha es EDITABLE dentro del modal (antes era de solo lectura): se puede citar para otro día sin salir.
  // Nace con la que trae el contexto (la vista del día / la cita en edición). Handoff bug-agenda-sin-selector §1.
  const [fechaSel, setFechaSel] = React.useState(fecha);
  const [paciente, setPaciente] = React.useState<Paciente | null>(pacienteInicial ?? null);
  const [tipoCitaId, setTipoCitaId] = React.useState(cita?.appointmentTypeId ?? tipoCitaIdInicial ?? "");
  // El médico llega PRESELECCIONADO: el de la cita (edición) o el asignado al paciente (`paciente.doctorId`).
  // Vacío = "Sin médico" (opción nula, nunca un registro comodín). Handoff agenda-estado-y-el-medico-comodin.
  const medicoDelPaciente = (p: Paciente | null) => (p as { doctorId?: string | null } | null)?.doctorId ?? "";
  const [medicoId, setMedicoId] = React.useState(cita?.doctorId ?? medicoDelPaciente(pacienteInicial ?? null));
  const [hora, setHora] = React.useState(cita?.time ?? horaInicial ?? "09:00");
  const [horaFin, setHoraFin] = React.useState(() => {
    if (cita?.endTime) return cita.endTime;
    const tp = tipos.find((x) => x.id === (cita?.appointmentTypeId ?? tipoCitaIdInicial));
    const start = cita?.time ?? horaInicial ?? "09:00";
    // La hora de fin SIEMPRE deriva del inicio (+ duración del tipo, o 30 min por defecto). Antes caía a
    // "09:30" fija cuando aún no había tipo, y con inicio a las 14:00 la cita "terminaba" a las 9:30 AM
    // (antes de empezar). Handoff bug-agenda-sin-selector-de-fecha §3.
    return addMinutes(start, tp?.durationMinutes ?? 30);
  });

  // UNA sola hora, de los CUPOS del TIPO ese día (endpoint dedicado available-slots, BE 2-oct): franjas en
  // horas enteras con huecos libres/capacidad + la duración del tipo (para la hora de fin). NO bloqueante.
  // Dos variantes (desplegable/chips) para comparar. Handoff citas-hora-por-cupo-handoff-be.
  const [slotVar, setSlotVar] = React.useState<SlotVariant>("dropdown");
  const [slotSeeded, setSlotSeeded] = React.useState(false);
  if (!slotSeeded && typeof window !== "undefined") {
    setSlotSeeded(true);
    const sv = window.localStorage.getItem("cmr_slot_variant");
    if (sv === "dropdown" || sv === "chips") setSlotVar(sv);
  }
  function pickSlotVar(v: SlotVariant) {
    setSlotVar(v);
    try { window.localStorage.setItem("cmr_slot_variant", v); } catch { /* storage bloqueado */ }
  }
  const cuposRes = useResource<CuposLibres | null>(
    () => (effectiveCentro && fechaSel && tipoCitaId ? getCuposLibres(fechaSel, tipoCitaId, effectiveCentro) : Promise.resolve(null)),
    [effectiveCentro, fechaSel, tipoCitaId],
  );
  const slots: Slot[] = React.useMemo(() => {
    if (cuposRes.state.kind !== "ok" || !cuposRes.state.data) return [];
    return cuposRes.state.data.slots.map((s) => ({ time: s.time, vacios: s.free, cupo: s.capacity }));
  }, [cuposRes.state]);
  // Duración del tipo (del endpoint; manda sobre el catálogo). Se usa para derivar la hora de fin.
  const slotDuration = cuposRes.state.kind === "ok" ? cuposRes.state.data?.durationMinutes ?? null : null;
  // La hora elegida ya no tiene cupo → aviso NO bloqueante (el BE deja agendar igual).
  const slotLleno = !!hora && slots.some((s) => s.time === hora && s.vacios <= 0);

  // Tres estados, no un booleano forzado: `undefined` = nadie lo declaró, y el BE corre su propio
  // chequeo por los datos reales del paciente (récord, historial, médico en ficha) para decidir si
  // es de verdad primera vez — pero SOLO cuando el payload no manda nada. Mandar `false` por
  // defecto (como antes) apagaba ese chequeo siempre y el personal de call-center, que no tiene por
  // qué saber que hay que marcar la casilla a mano, terminaba citando pacientes nuevos como si
  // fueran de seguimiento. Handoff bug-primera-vez-fuerza-medico-handoff-fe.
  // Estado con el que NACE la cita (solo al crear; BE allowlist = programada|confirmada). Sale del
  // CATÁLOGO (`esInicial`), no de una regla escrita aquí: antes una cita de HOY nacía "confirmada", y
  // confirmada entra DIRECTA al tablero de Atención cuando todavía no se está seguro de que el paciente
  // venga. Confirmar es una decisión del usuario. Cambiarlo mañana es marcar otro estado como inicial en
  // el catálogo del BE, sin tocar este archivo.
  const claveInicial = (estados.find((e) => e.isInitial)?.slug ?? "programada") as
    | "programada"
    | "confirmada";
  // El catálogo llega por red: el estado se DERIVA de su inicial hasta que el usuario elija a mano
  // (sin setState en efecto, que dispara renders en cascada / lo marca el React Compiler).
  const [estadoElegido, setEstadoElegido] = React.useState<"programada" | "confirmada" | null>(null);
  const estadoCrear = estadoElegido ?? claveInicial;
  const [motivo, setMotivo] = React.useState(cita?.reason ?? "");
  const [notas, setNotas] = React.useState(cita?.notes ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [warn, setWarn] = React.useState<CitaConflicto[] | null>(null);

  const tipo = tipos.find((x) => x.id === tipoCitaId);
  // El TIPO y "primera vez" son un HECHO del historial, no una preferencia: asistido ALGUNA vez ⇒ Seguimiento;
  // si no ⇒ Nueva. Se decide SOLO, sin casilla (regla del dueño, repetida). La señal es `attendedBy` (clave v2;
  // antes el FE leía `atendidoPor` y por eso nunca casaba) con `atendidoPor` de respaldo (v1/filas del board).
  const yaSeguimiento = !!(
    (paciente as { attendedBy?: string | null; atendidoPor?: string | null } | null)?.attendedBy ??
    (paciente as { atendidoPor?: string | null } | null)?.atendidoPor
  );
  const esPrimeraVezEff = !yaSeguimiento;
  // El tipo se autoselecciona al elegir paciente (seguimiento/nueva), salvo que el usuario lo cambie a mano.
  const [tipoTouched, setTipoTouched] = React.useState(false);
  const tipoAutoId = React.useMemo(() => {
    if (!paciente) return "";
    const slug = yaSeguimiento ? "seguimiento" : "nueva";
    return tipos.find((x) => (x as { slug?: string | null }).slug === slug)?.id ?? "";
  }, [paciente, yaSeguimiento, tipos]);
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

  const canSubmit =
    !!paciente &&
    !!tipoCitaId &&
    !!fechaSel &&
    !!hora &&
    !!horaFin &&
    (!medicoRequired || !!medicoId) &&
    (!needsCentro || !!effectiveCentro) &&
    !submitting;

  async function onSubmit() {
    if (!paciente || !tipoCitaId) return;
    setSubmitting(true);
    try {
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
        if (res.conflictos.length > 0) {
          setWarn(res.conflictos); // show warning; a second Guardar confirms
          setSubmitting(false);
          return;
        }
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
      const { advertencias } = isEdit
        ? await actualizarCitaAgenda(cita!.id, payload, effectiveCentro || undefined)
        : await crearCitaAgenda({ ...payload, status: estadoCrear, bookedByStaffId: callcenterId }, effectiveCentro || undefined);
      if (effectiveCentro) setActiveCentro(effectiveCentro);
      toast.success(isEdit ? t("updated") : t("created"));
      for (const a of advertencias) {
        if (a.labelKey) toast.warning(tRoot(a.labelKey));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>{isEdit ? t("editTitle") : t("title")}</DialogTitle>
            {/* En edición, las ACCIONES DEL PUESTO (confirmar/reprogramar/cancelar/no-show) — se reusa
                el mismo componente del tablero. Al cambiar el estado, recargar y cerrar. Handoff agenda-abrir-la-cita. */}
            {isEdit && cita && (
              <CitaActions
                cita={cita}
                onChanged={() => {
                  onSaved();
                  onOpenChange(false);
                }}
              />
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {needsCentro && (
            <Field label={t("centro")} required>
              <Select value={effectiveCentro || undefined} onValueChange={setCentroSel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("centroPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Fecha y Hora LADO A LADO (aprovecha el ancho; deja aire para Notas abajo). La hora es por CUPOS
              del tipo ese día, horas enteras, fin automática, no bloqueante. Handoff citas-hora-por-cupo. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("date")} required>
              <Input type="date" value={fechaSel} onChange={(e) => e.target.value && setFechaSel(e.target.value)} />
            </Field>
            <Field label={t("time")} required>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t("endAuto", { time: horaFin })}</span>
                <div className="inline-flex rounded-md border p-0.5 text-xs">
                  <button type="button" onClick={() => pickSlotVar("dropdown")}
                    className={"rounded px-2 py-0.5 " + (slotVar === "dropdown" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {t("variantList")}
                  </button>
                  <button type="button" onClick={() => pickSlotVar("chips")}
                    className={"rounded px-2 py-0.5 " + (slotVar === "chips" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {t("variantGrid")}
                  </button>
                </div>
              </div>
              <SlotPicker slots={slots} value={hora} onChange={(time) => onHoraChange(time)} variant={slotVar} />
              {/* Aviso NO bloqueante: la hora elegida ya no tiene cupo. El BE no bloquea ni avisa en citas, así
                  que el aviso lo da el FE. Handoff citas-hora-por-cupo-handoff-be. */}
              {slotLleno && (
                <p className="mt-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
                  {t("slotFullWarn")}
                </p>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("patient")} required>
              <PacienteSelect
                value={paciente}
                onChange={(p) => {
                  setPaciente(p);
                  // Preseleccionar el médico del paciente si aún no se eligió uno (no pisa una elección manual).
                  if (!medicoId && medicoDelPaciente(p)) setMedicoId(medicoDelPaciente(p));
                }}
              />
            </Field>
            {/* El selector NUNCA sale vacío: si no hay médico, queda en "Sin médico" (no bloquea el
                guardado salvo que el TIPO exija médico). Handoff citas-medico-y-confirmada. */}
            <Field label={t("doctor")} required={medicoRequired}>
              <Select value={medicoId || NONE_MEDICO} onValueChange={(v) => { setMedicoId(v === NONE_MEDICO ? "" : v); setWarn(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_MEDICO}>{t("noDoctor")}</SelectItem>
                  {medicos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {[m.name, m.lastName].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("type")} required>
              <Select value={tipoCitaId || undefined} onValueChange={onTipoChange}>
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
            <Field label={t("status")}>
              {isEdit ? (
                <div className="flex h-9 items-center">
                  <Badge
                    variant="secondary"
                    style={estadoDef ? { backgroundColor: `${estadoDef.color}20`, color: estadoDef.color } : undefined}
                  >
                    {estadoDef ? tRoot(estadoDef.labelKey) : t("statusScheduled")}
                  </Badge>
                </div>
              ) : (
                // Al crear: elegir con qué estado nace (allowlist BE). Confirmada = entra al tablero de
                // Atención de una vez. Colores/etiquetas del catálogo (data-driven).
                <Select value={estadoCrear} onValueChange={(v) => {
                    setEstadoElegido(v as "programada" | "confirmada");
                  }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["programada", "confirmada"] as const).map((clave) => {
                      const d = estadosMap.get(clave);
                      return (
                        <SelectItem key={clave} value={clave}>
                          <span className="inline-flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: d?.color ?? "#999" }} />
                            {d ? tRoot(d.labelKey) : clave}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          {/* Sin casilla "Primera vez" (regla del dueño): el tipo ya lo dice —Nueva/Seguimiento— y se decide
              solo por si el paciente fue asistido alguna vez (`attendedBy`). */}

          <Field label={t("reason")}>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </Field>
          <Field label={t("notes")}>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </Field>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? tc("saving") : warn ? t("saveAnyway") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
