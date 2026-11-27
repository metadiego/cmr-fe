"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";

import type { CitaFila } from "@/lib/api/agenda-dia";
import {
  crearCitaAgenda,
  getCita,
  getTiposCita,
  getVisitasRecientes,
  type TipoCita,
  type Cita,
  type CreateCitaPayload,
} from "@/lib/api/citas";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { getOpciones, ejecutarAccion, type Opcion } from "@/lib/api/tablero";
import { pickDoctor } from "@/lib/tablero/pick-doctor";
import { patientDoctorOption } from "@/lib/medicos/patient-doctor-option";
import { asignarRecord } from "@/lib/api/pacientes";
import { nextAppointmentMissing } from "@/lib/board/next-appointment-missing";
import { parseDayUTC } from "@/lib/format/fecha";
import { useCan } from "@/hooks/use-can";
import { useCanInCenter } from "@/hooks/use-can-in-center";
import { bookedUnconfirmedNotice, CONFIRM_PERMISSION, createConfirmed } from "@/lib/lifecycle/confirm-on-create";
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
import { ReturnDatePicker } from "@/components/citas/return-date-picker";
import { AvisoDisponibilidad } from "@/components/citas/aviso-disponibilidad";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormFooter } from "@/components/kit/form-footer";
import { RequiredMark } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";

const NO_MEDICO = "__none__";

type BusyKind = "save" | "open" | "exit" | "record";

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO(): string {
  return plusDaysISO(0);
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
// 12-hour clock: the AM/PM marker is translated ("02:30 p. m." vs "02:30 PM"), so this
// was the one time format that leaked Spanish into an English session while pinned to es-PR.
function fmtHora(v: unknown, format: ReturnType<typeof useFormatter>): string | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : format.dateTime(d, "time");
}
function fmtFechaCorta(iso: string, format: ReturnType<typeof useFormatter>): string {
  const d = parseDayUTC(iso);
  return d ? format.dateTime(d, "dayMonth") : iso;
}

// SCHEDULING dialog after marking ATTENDED (through `render.postAccion`, not hardcoded).
// "Visit card" UI: hero with avatar + timeline of the visit just completed + quick booking of the
// next one. See docs/specs/ap-board — handoff PR #35.
export function NuevaCitaModal({
  tablero,
  fila,
  centroId,
  render,
  onClose,
  onSaved,
}: {
  tablero: string;
  fila: CitaFila;
  centroId?: string;
  render?: Record<string, unknown> | null; // config por-tablero de la columna (postAccion, agendar_cita…)
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("nuevaCita");
  const tRoot = useTranslations();
  const format = useFormatter();
  const { can } = useCan();
  const canConfirmHere = useCanInCenter(CONFIRM_PERMISSION, centroId);

  const agendarEnabled = render?.agendar_cita !== false; // módulo de agendamiento (plugged por config)

  const pacienteId = String(fila.pacienteId ?? "");
  const paciente = String(fila.paciente ?? fila.pacienteNombre ?? "");

  const [tipos, setTipos] = React.useState<TipoCita[]>([]);
  const [medicos, setMedicos] = React.useState<Opcion[]>([]);
  const [recientes, setRecientes] = React.useState<Cita[]>([]);
  const [record, setRecord] = React.useState<string>(String(fila.record ?? ""));

  const [tipoId, setTipoId] = React.useState<string>("");
  const [medicoId, setMedicoId] = React.useState<string>(NO_MEDICO);
  // Médico de la cita cuando NO está en `medicos` (las opciones activas del tablero): se añade como
  // opción extra, con su nombre, para que no "desaparezca" al ir a Asistido (reporte del dueño,
  // 14-oct-2026 / 20-oct-2026). Sin el centro del médico (GET /appointments no lo trae, solo
  // doctorId+doctorName) no se puede decir si está retirado o es de otro centro — se muestra el
  // nombre solo, nunca una etiqueta que no se pueda verificar.
  const [doctorExtra, setDoctorExtra] = React.useState<{ id: string; name: string } | null>(null);
  const [fecha, setFecha] = React.useState<string>("");
  const [notas, setNotas] = React.useState<string>("");
  // Which footer/header action is running: one guard for all of them, so only one runs at a time.
  const [busyKind, setBusyKind] = React.useState<BusyKind | null>(null);
  const { submitting, submit } = useSubmit(async (kind: BusyKind, fn: () => Promise<void>) => {
    setBusyKind(kind);
    try {
      await fn();
    } finally {
      setBusyKind(null);
    }
  });

  // Data-driven catalogues (types + doctors per center + history). Nothing hardcoded.
  React.useEffect(() => {
    let active = true;
    getTiposCita()
      .then((ts) => {
        if (!active) return;
        setTipos(ts);
        const seg = ts.find((x) => x.slug === "seguimiento") ?? ts[0];
        if (seg) setTipoId(seg.id);
      })
      .catch(() => {});
    // The appointment's doctor, read FRESH (the row in hand may predate a doctor just set on the board),
    // preselected by id; the row's own id/name are the fallback. Owner's report, 14-oct-2026.
    Promise.all([
      getOpciones(tablero, "medico", centroId),
      getCita(String(fila.id)).catch(() => null),
    ])
      .then(([o, cita]) => {
        if (!active) return;
        setMedicos(o);
        const doctorId = cita?.doctorId ?? (fila.medico__valor as string | undefined) ?? null;
        const doctorName = cita?.doctorName || String(fila.medico ?? "");
        const id = pickDoctor(o, { id: doctorId, name: doctorName });
        if (id) {
          setMedicoId(id);
          setDoctorExtra(null);
          return;
        }
        // No está entre las opciones activas: añadirlo igual, en vez de caer en "Sin médico"
        // (lib/medicos/patient-doctor-option.ts, la misma pieza de facturación y agregar-cita).
        const extra = patientDoctorOption(
          o.map((m) => m.value),
          { doctorId, doctorName },
          centroId,
        );
        if (extra) {
          setMedicoId(extra.id);
          setDoctorExtra({ id: extra.id, name: extra.name });
        }
      })
      .catch(() => {});
    if (pacienteId) {
      getVisitasRecientes(pacienteId, centroId)
        .then((v) => active && setRecientes(Array.isArray(v) ? v : []))
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [tablero, centroId, fila.id, fila.medico, fila.medico__valor, pacienteId]);

  const canWrite = can("citas.create");

  const nombreTipo = React.useCallback(
    (id: string) => tipos.find((x) => x.id === id)?.name ?? "",
    [tipos],
  );
  const colorTipo = React.useCallback(
    (id: string) => tipos.find((x) => x.id === id)?.color ?? null,
    [tipos],
  );

  // Visits before today, most recent first (max 4). Clinical context.
  const historial = React.useMemo(() => {
    const hoy = todayISO();
    return [...recientes]
      .filter((c) => String(c.date) < hoy)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 4);
  }, [recientes]);

  // Timeline of the visit just completed (data: the row's timestamps).
  const pasos: Array<{ key: "stepPresent" | "stepConsult" | "stepAttended"; at: unknown; current?: boolean }> = [
    { key: "stepPresent", at: fila.presente },
    { key: "stepConsult", at: fila.en_consulta },
    { key: "stepAttended", at: fila.asistido, current: true },
  ];

  async function crear(tId: string, f: string) {
    // Never report a booking that did not happen: a row without a patient cannot be booked.
    if (!pacienteId) throw new Error(t("noPatient"));
    const { advertencias } = await crearCitaAgenda(
      {
        patientId: pacienteId,
        appointmentTypeId: tId,
        date: f,
        ...(medicoId !== NO_MEDICO ? { doctorId: medicoId } : {}),
        ...(notas.trim() ? { notes: notas.trim() } : {}),
        // An appointment given at the desk is made with the person present (no call center), so it is born
        // CONFIRMED for any date, which is why it shows on its day's board. `confirmed` (cmr-be 4a) needs
        // appointments.confirm in this clinic; without it the appointment is born booked, never a 403.
        confirmed: createConfirmed(true, canConfirmHere),
      } as CreateCitaPayload,
      centroId,
    );
    // Born booked because appointments.confirm is missing here: say so, or the patient never reaches the board.
    if (bookedUnconfirmedNotice(true, canConfirmHere)) toast.warning(tRoot("lifecycle.bookedUnconfirmed"));
    mostrarAvisos(advertencias, tRoot, format);
    onSaved?.();
    onClose();
  }

  const onGuardar = () => submit("save", () => crear(tipoId, fecha));

  // "Open" (follow-up): next one at +30 days, no manual date needed.
  function onAbierto() {
    const seg = tipos.find((x) => x.slug === "seguimiento") ?? tipos.find((x) => x.id === tipoId);
    if (!seg) return;
    void submit("open", () => crear(seg.id, plusDaysISO(30)));
  }

  // "DISCHARGE": books no next appointment, only closes (patient attended).
  function onAlta() {
    onSaved?.();
    onClose();
  }

  // "Exit": reverts ATTENDED (back to en_consulta) and closes, also when the revert fails.
  const onSalir = () =>
    submit("exit", async () => {
      try {
        await ejecutarAccion({ boardSlug: tablero, entityId: fila.id, action: "volver_en_consulta" }, centroId);
        onSaved?.();
      } finally {
        onClose();
      }
    });

  const onGenerarRecord = () =>
    submit("record", async () => {
      if (!pacienteId) throw new Error(t("noPatient"));
      const p = await asignarRecord(pacienteId, centroId);
      setRecord(p.medicalRecordNumber ?? "");
    });

  const canSave = canWrite && agendarEnabled;
  const missing = canSave
    ? nextAppointmentMissing({ typeId: tipoId, date: fecha }).map((f) => (f === "date" ? t("whenBack") : t("type")))
    : [];

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={!submitting}
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
        onInteractOutside={(e) => submitting && e.preventDefault()}
      >
        {/* Hero */}
        <div className="relative shrink-0 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-6 pt-6 pb-5">
          <div className="flex items-start gap-4 pr-8">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-bold text-primary ring-2 ring-primary/25 ring-offset-2 ring-offset-background">
              {initials(paciente)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                {t("eyebrow")}
              </span>
              <DialogTitle className="truncate text-xl leading-tight tracking-tight">
                {paciente || t("patient")}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">{t("subline")}</DialogDescription>
            </div>
            <div className="shrink-0">
              {record ? (
                <span className="rounded-lg bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums shadow-sm ring-1 ring-border">
                  #{record}
                </span>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => onGenerarRecord()} disabled={submitting || !pacienteId}>
                  {t("generateRecord")}
                </Button>
              )}
            </div>
          </div>

          {/* Visit timeline */}
          <div className="mt-5 flex items-center">
            {pasos.map((p, i) => {
              const hora = fmtHora(p.at, format);
              const done = !!p.at || !!p.current;
              return (
                <React.Fragment key={p.key}>
                  {i > 0 && <span className={"mx-1.5 h-0.5 flex-1 rounded-full " + (done ? "bg-primary/60" : "bg-border")} aria-hidden />}
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={
                        "grid size-6 place-items-center rounded-full text-[10px] font-bold " +
                        (p.current
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : done
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {p.current ? "●" : "✓"}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t(p.key)}</span>
                    <span className="font-mono text-[10px] tabular-nums text-foreground/70">{hora ?? (p.current ? t("now") : "—")}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {historial.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("recentVisits")}</span>
              <div className="flex flex-wrap gap-1.5">
                {historial.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                    <span className="size-2 rounded-full" style={{ backgroundColor: colorTipo(String(c.appointmentTypeId)) ?? "var(--muted-foreground)" }} />
                    <span className="font-medium tabular-nums">{fmtFechaCorta(String(c.date), format)}</span>
                    <span className="text-muted-foreground">{nombreTipo(String(c.appointmentTypeId))}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick booking (agendar_cita module, switched on by config) */}
          {agendarEnabled && (
          <>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("whenBack")}{canSave && <RequiredMark />}</span>
            <ReturnDatePicker value={fecha} onChange={setFecha} doctorId={medicoId !== NO_MEDICO ? medicoId : undefined} centro={centroId} />
          </div>

          {/* Availability notice: if the doctor is not in that day, explains and offers the next date. */}
          <AvisoDisponibilidad
            doctorId={medicoId !== NO_MEDICO ? medicoId : undefined}
            date={fecha}
            centro={centroId}
            onUseSuggested={setFecha}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("doctor")}</span>
              <Select value={medicoId} onValueChange={setMedicoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("noDoctor")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEDICO}>{t("noDoctor")}</SelectItem>
                  {doctorExtra && (
                    <SelectItem value={doctorExtra.id}>{doctorExtra.name}</SelectItem>
                  )}
                  {medicos.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("type")}{canSave && <RequiredMark />}</span>
              <div className="flex flex-wrap gap-1.5">
                {tipos.map((tp) => {
                  const active = tp.id === tipoId;
                  const c = tp.color ?? undefined;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => setTipoId(tp.id)}
                      aria-pressed={active}
                      className={
                        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
                        (active ? "" : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground")
                      }
                      style={active && c ? { borderColor: c, color: c, backgroundColor: `${c}1a` } : undefined}
                    >
                      {tp.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("notes")}</span>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t("notesPlaceholder")} rows={2} />
          </label>
          </>
          )}
        </div>

        {/* Footer: "Save appointment" is the form's submit; the others are standalone actions. */}
        <FormFooter
          className="shrink-0 border-t bg-muted/30 px-6 py-4"
          primary={canSave ? { label: t("save"), onClick: () => onGuardar(), busy: busyKind === "save" } : []}
          missing={missing}
          submitting={submitting}
          // Another action running keeps "Save appointment" disabled but does not relabel it.
          submittingLabel={busyKind === "save" ? undefined : t("save")}
          extra={
            <>
              <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => onSalir()} disabled={submitting}>
                {t("exit")}
              </Button>
              {canSave && (
                <Button type="button" variant="outline" onClick={onAbierto} disabled={submitting || tipos.length === 0}>
                  {t("open")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="border-success/40 text-success-foreground hover:bg-success/10"
                onClick={onAlta}
                disabled={submitting}
              >
                {t("discharge")}
              </Button>
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
