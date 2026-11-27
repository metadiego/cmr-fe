"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import {
  confirmarCita,
  unconfirmCita,
  presenteCita,
  noShowCita,
  cancelarCita,
  reagendarCita,
  getTiposCita,
  getHistorial,
  type Cita,
  type TipoCita,
  type CitaEvento,
} from "@/lib/api/citas";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getAgendaDia, type AgendaDia } from "@/lib/api/agenda-dia";
import { todayPR } from "@/lib/format/fecha";
import { slotAvailability } from "@/lib/agenda/slot-availability";
import { cancelMissing } from "@/lib/citas/cancel-missing";
import { rescheduleMissing, type RescheduleField } from "@/lib/citas/reschedule-missing";
import { citaBlockingCode } from "@/lib/api/cita-errors";
import { cancelMeaning, refusalRefreshesRow } from "@/lib/lifecycle/board-action-rules";
import { apiErrorLabel } from "@/lib/api/errors";
import { appointmentMenuFor } from "@/lib/lifecycle/allowed-actions";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { labelText, stageLabel } from "@/lib/lifecycle/stage-labels";
import { FormDialog } from "@/components/kit/form-dialog";
import { Field } from "@/components/kit/field";
import { useSubmit } from "@/components/kit/use-submit";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useConfirm } from "@/components/kit/confirm-host";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CitaActions({
  cita,
  allowedActions,
  onChanged,
}: {
  cita: Cita;
  /** The row's `allowedActions` (cmr-be 4a) when the caller has them (a board or day-list row): the menu
   * is drawn from them. Without them (an entity read: booking screen, calendar, day view, board modal),
   * the status rules of piece 3 decide (lib/lifecycle/allowed-actions.ts `appointmentMenuFor`). */
  allowedActions?: string[] | null;
  onChanged: () => void;
}) {
  const t = useTranslations("appointments.actions");
  const { can } = useCan();
  const confirm = useConfirm();
  const centroId = cita.clinicId ?? undefined;
  // One CitaActions per table row: ids must not collide.
  const reasonId = `${React.useId()}-cancel-reason`;

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reagOpen, setReagOpen] = React.useState(false);
  const [histOpen, setHistOpen] = React.useState(false);
  // Clean reason on every open (and on another appointment).
  const [cancelForm, setCancelForm] = useDialogForm(() => ({ reason: "" }), cancelOpen, cita.id);

  // One guard for every status change: runs the call, toasts, then `after` (e.g. close the dialog).
  // A failed call leaves the dialog open with what was typed.
  const { submitting, submit: run } = useSubmit(
    async (fn: () => Promise<unknown>, after?: () => void) => {
      await fn();
      return after;
    },
    {
      successMessage: t("done"),
      onSuccess: (after) => {
        after?.();
        onChanged();
      },
      // The appointment moved under us: close the dialog and redraw (the toast still says why).
      onError: (err) => {
        if (refusalRefreshesRow(err)) {
          setCancelOpen(false);
          onChanged();
        }
        return false;
      },
    },
  );

  const tRoot = useTranslations();
  const actions = appointmentMenuFor({
    row: cita,
    date: cita.date,
    today: todayPR(),
    allowed: allowedActions,
    canConfirm: can("appointments.confirm"),
  });
  // Cancel on an arrived patient is "arrived, not served": same dialog and reason, its own words.
  const notServe = cancelMeaning("medical", cita, allowedActions) === "not_serve";
  const cancelLabel = notServe ? tRoot("lifecycle.action.not_serve") : t("cancelar");
  // Show the menu whenever the user can act OR at least view history.
  if (!can("citas.update") && !can("citas.read")) return null;

  async function markNoShow() {
    const ok = await confirm({
      title: t("noShowTitle"),
      description: t("noShowHelp"),
      confirmLabel: t("noShow"),
    });
    if (ok) await run(() => noShowCita(cita.id, centroId));
  }

  const cancelMissingLabels = cancelMissing(cancelForm).map(() => t("reason"));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={submitting} aria-label={t("menu")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.includes("confirmar") && (
            <DropdownMenuItem onSelect={() => void run(() => confirmarCita(cita.id, centroId))}>
              {t("confirmar")}
            </DropdownMenuItem>
          )}
          {actions.includes("unconfirm") && (
            <DropdownMenuItem onSelect={() => void run(() => unconfirmCita(cita.id, centroId))}>
              {tRoot("lifecycle.action.unconfirm")}
            </DropdownMenuItem>
          )}
          {actions.includes("presente") && (
            <DropdownMenuItem onSelect={() => void run(() => presenteCita(cita.id, centroId))}>
              {t("presente")}
            </DropdownMenuItem>
          )}
          {actions.includes("reagendar") && (
            <DropdownMenuItem onSelect={() => setReagOpen(true)}>
              {t("reagendar")}
            </DropdownMenuItem>
          )}
          {actions.includes("noShow") && (
            <DropdownMenuItem onSelect={() => void markNoShow()}>
              {t("noShow")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setHistOpen(true)}>
            {t("historial")}
          </DropdownMenuItem>
          {actions.includes("cancelar") && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setCancelOpen(true)}
            >
              {cancelLabel}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel — requires a reason. Irreversible: only the button cancels, Enter never does. */}
      <FormDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        size="md"
        title={notServe ? cancelLabel : t("cancelTitle")}
        description={notServe ? t("notServeHelp") : t("cancelHelp")}
        onSubmit={() => {}}
        actions={[
          {
            label: cancelLabel,
            variant: "destructive",
            onClick: () =>
              run(
                () => cancelarCita(cita.id, cancelForm.reason.trim(), centroId),
                () => setCancelOpen(false),
              ),
          },
        ]}
        submitting={submitting}
        missing={cancelMissingLabels}
      >
        <Field label={t("reason")} htmlFor={reasonId} required>
          <Textarea
            id={reasonId}
            value={cancelForm.reason}
            onChange={(e) => setCancelForm({ reason: e.target.value })}
            rows={3}
          />
        </Field>
      </FormDialog>

      {/* Reschedule / move — own component, mounted only when open (avoids per-row fetches) */}
      {reagOpen && (
        <RescheduleDialog
          cita={cita}
          onClose={() => setReagOpen(false)}
          onDone={() => {
            setReagOpen(false);
            onChanged();
          }}
        />
      )}

      {/* History / audit trail — mounted only when open */}
      {histOpen && <HistorialDialog cita={cita} onClose={() => setHistOpen(false)} />}
    </>
  );
}

// Reschedule / cross-center move. Mounted only when open, so its data fetches
// (centros, tipos, medicos, destination availability) run once per open — not
// per table row — and its state starts clean on every open. Reagendar records
// the audit trail (motivo + antes/después).
function RescheduleDialog({
  cita,
  onClose,
  onDone,
}: {
  cita: Cita;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("appointments.actions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const id = React.useId();

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const medicosRes = useResource<Personal[]>(() => getMedicos());
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];

  const [centro, setCentro] = React.useState(cita.clinicId ?? "");
  const [fecha, setFecha] = React.useState(cita.date);
  const [hora, setHora] = React.useState(cita.time ?? "");
  const [medico, setMedico] = React.useState(cita.doctorId ?? "");
  const [motivo, setMotivo] = React.useState("");
  // VISIT_IN_PROGRESS / APPOINTMENT_DATE_IN_PAST (cmr-be #696/#697): a hard block discovered only on
  // submit, shown inline (never a toast) until the next attempt — handoff
  // .personal/handoff-citas-en-curso-y-fecha-pasada.md.
  const [blockError, setBlockError] = React.useState<string | null>(null);

  const canMulti = can("citas.multicentro");
  const crossCentro = !!centro && centro !== cita.clinicId;
  const esSeguimiento = tipos.find((x) => x.id === cita.appointmentTypeId)?.slug === "seguimiento";
  const medicoRequired = crossCentro && esSeguimiento;

  function pickCentro(v: string) {
    setCentro(v);
    // Moving a follow-up to another center clears the doctor (must pick one there).
    if (v !== cita.clinicId && esSeguimiento) setMedico("");
  }

  // Destination-day availability. reagendar does NOT enforce cupo — this is only
  // a hint + a "use the next free hour" shortcut.
  const agendaRes = useResource<AgendaDia | null>(
    () => (centro && fecha ? getAgendaDia(fecha, { centroId: centro }) : Promise.resolve(null)),
    [centro, fecha],
  );
  const availability = React.useMemo(() => {
    const data = agendaRes.state.kind === "ok" ? agendaRes.state.data : null;
    const c = data?.centers?.[0];
    if (!c) return null;
    const { free, next } = slotAvailability(c.slots ?? c.franjas ?? [], String(cita.appointmentTypeId), hora);
    return { vacios: free, next };
  }, [agendaRes.state, hora, cita.appointmentTypeId]);

  const origen = centros.find((c) => c.id === cita.clinicId)?.name ?? cita.clinicId ?? "";
  const destino = centros.find((c) => c.id === centro)?.name ?? centro;

  const fieldLabel: Record<RescheduleField, string> = {
    date: t("date"),
    doctor: t("doctor"),
    reason: t("reason"),
  };
  const missing = rescheduleMissing({
    date: fecha,
    doctorRequired: medicoRequired,
    doctorId: medico,
    reason: motivo,
  }).map((f) => fieldLabel[f]);
  // A move needs the appointment types (a follow-up must name its doctor there): wait for them, and say why.
  const typesPending = crossCentro && tiposRes.state.kind !== "ok";
  const typesReason = !typesPending
    ? null
    : tiposRes.state.kind === "fail"
      ? tiposRes.state.message
      : tc("loading");

  const { submitting, submit } = useSubmit(
    () => {
      setBlockError(null);
      return reagendarCita(
        cita.id,
        {
          date: fecha,
          time: hora || undefined,
          reason: motivo.trim(),
          centerId: crossCentro ? centro : undefined,
          doctorId: crossCentro && medico ? medico : undefined,
        },
        cita.clinicId ?? undefined,
      );
    },
    {
      successMessage: t("done"),
      onSuccess: () => onDone(),
      onError: (err) => {
        if (!citaBlockingCode(err)) return false;
        setBlockError(apiErrorLabel(err, tRoot));
        return true;
      },
    },
  );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("reagendarTitle")}
      onSubmit={() => submit()}
      submitLabel={crossCentro ? t("move") : t("reagendar")}
      submitting={submitting}
      missing={missing}
      blocked={typesPending || !!blockError}
      reason={typesReason ?? blockError}
    >
      {centros.length > 1 && canMulti && (
        <Field label={t("centro")} htmlFor={`${id}-centro`}>
          <Select value={centro || undefined} onValueChange={pickCentro}>
            <SelectTrigger id={`${id}-centro`} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {centros.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {crossCentro && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {t("moveFromTo", { from: origen, to: destino })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("date")} htmlFor={`${id}-date`} required>
          {/* The year dropdown goes 110 years back by default (date-picker.tsx, for birth dates) — a
              reschedule has no business reaching the past. Record 15059, 2026-11-11: a misclick two
              rows up the year list sent an appointment to 2025 (the sheet rejected it as 404, but
              nothing stopped the local save). Handoff .personal/handoff-hoja-caida-avisar-o-bloquear.md. */}
          <DatePicker id={`${id}-date`} value={fecha} onChange={setFecha} min={todayPR()} />
        </Field>
        <Field label={t("time")} htmlFor={`${id}-time`}>
          <TimePicker id={`${id}-time`} value={hora} onChange={setHora} />
        </Field>
      </div>

      {medicoRequired && (
        <Field label={t("doctor")} htmlFor={`${id}-doctor`} required>
          <Select value={medico || undefined} onValueChange={setMedico}>
            <SelectTrigger id={`${id}-doctor`} className="w-full">
              <SelectValue placeholder={t("doctorPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {medicos.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {[m.name, m.lastName].filter(Boolean).join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {availability && hora && availability.vacios === 0 && (
        <div className="rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
          {t("noCupo", { hora })}
          {availability.next && (
            <button
              type="button"
              className="ml-1 underline"
              onClick={() => setHora(availability.next!)}
            >
              {t("useNext", { hora: availability.next })}
            </button>
          )}
        </div>
      )}

      <Field label={t("reason")} htmlFor={`${id}-reason`} required>
        <Textarea
          id={`${id}-reason`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder={t("reasonPlaceholder")}
        />
      </Field>
    </FormDialog>
  );
}

// Audit trail viewer (GET /citas/:id/historial). Shows each event with its
// antes → después (fecha, hora, centro, médico), mapping ids to names.
// Exportado para reusarlo desde la ficha del paciente (historial de reagendamientos) sin duplicar la
// traza antes→después. No duplicar código (norma).
export function HistorialDialog({ cita, onClose }: { cita: Cita; onClose: () => void }) {
  const t = useTranslations("appointments.actions");
  const format = useFormatter();
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const histRes = useResource<CitaEvento[]>(() =>
    getHistorial(cita.id, cita.clinicId ?? undefined),
  );
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const medicosRes = useResource<Personal[]>(() => getMedicos());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];

  const centroName = (id: unknown) =>
    centros.find((c) => c.id === id)?.name ?? (id ? String(id) : "—");
  const medicoName = (id: unknown) => {
    const m = medicos.find((x) => x.id === id);
    return m ? [m.name, m.lastName].filter(Boolean).join(" ") : id ? String(id) : "—";
  };
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : format.dateTime(d, "dateAndTime");
  };

  const events = histRes.state.kind === "ok" ? histRes.state.data : [];

  function diff(ev: CitaEvento) {
    const a = ev.payload?.antes ?? {};
    const d = ev.payload?.despues ?? {};
    const rows: { label: string; from: string; to: string }[] = [];
    const push = (key: string, label: string, render: (v: unknown) => string) => {
      if (a[key] === undefined && d[key] === undefined) return;
      const from = render(a[key]);
      const to = render(d[key]);
      if (from !== to) rows.push({ label, from, to });
    };
    const txt = (v: unknown) => (v ? String(v) : "—");
    // The diff names old status words (the history derives them from the stages): shown by stage label.
    const estadoName = (v: unknown) => {
      const word = v ? String(v) : "";
      return labelText(tRoot, "medical", word ? stageLabel("medical", { estado: word }) : null, word) || "—";
    };
    push("estado", t("estado"), estadoName);
    push("fecha", t("date"), txt);
    push("hora", t("time"), txt);
    push("centroId", t("centro"), centroName);
    push("medicoId", t("doctor"), medicoName);
    return rows;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("historialTitle")}</DialogTitle>
        </DialogHeader>
        {histRes.state.kind === "loading" && (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        )}
        {histRes.state.kind === "fail" && (
          <p className="text-sm text-destructive">{histRes.state.message}</p>
        )}
        {histRes.state.kind === "ok" && events.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("historialEmpty")}</p>
        )}
        <ol className="space-y-3">
          {events.map((ev) => {
            const rows = diff(ev);
            return (
              <li key={ev.id} className="rounded-md bg-card p-3 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.has(`event.${ev.type}`) ? t(`event.${ev.type}`) : ev.type}</span>
                  <span className="text-xs text-muted-foreground">{fmt(ev.createdAt)}</span>
                </div>
                {ev.reason && <p className="mt-1 text-xs text-muted-foreground">{ev.reason}</p>}
                {rows.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {rows.map((r) => (
                      <li key={r.label}>
                        <span className="text-muted-foreground">{r.label}:</span>{" "}
                        <span className="line-through opacity-70">{r.from}</span>
                        {" → "}
                        <span className="font-medium">{r.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
