"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CitaModal } from "@/components/agenda/cita-modal";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import type { PatientAppointments } from "@/hooks/use-patient-appointments";
import type { PatientAppointment } from "@/lib/agenda/booking/patient-appointments";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import { cancelarCita, type Cita, type TipoCita } from "@/lib/api/citas";
import { cancelarSesion } from "@/lib/api/frontdesk";
import { apiErrorLabel } from "@/lib/api/errors";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The patient rail under the PatientCard: the patient's Upcoming appointments (both kinds, by date then
// time) with Move / Edit / Cancel, and the last 5 Past ones (greyed, no actions). Spec "Patient rail".
// - Move hands the appointment to the screen, which points the calendar at it; the card turns blue
//   with "Moving: pick the new day and time" and a Stop button. The commit happens in the day panel.
// - Edit (medical only) opens the shared CitaModal in edit mode.
// - Cancel opens an inline box with a required free-text reason; the call runs here, in the
//   appointment's own center (X-Tenant-ID), falling back to the screen's center.
// Actions the user lacks are hidden: medical move/edit/cancel need `citas.update`, service move/cancel
// `frontdesk.update` (the BE's guards on reschedule/cancel and PATCH …/agenda).

export type TypeLookup = (kind: BookingKind, typeId: string) => { name: string; color: string | null } | undefined;

/** "Thu, Nov 5 · 8:00" — the label of an appointment's day and time (move box, toasts). */
export function useAppointmentLabel(): (date: string, time: string | null) => string {
  const format = useFormatter();
  return (date, time) => {
    const d = parseDayUTC(date);
    const day = d ? format.dateTime(d, "dayWeekdayShort") : date;
    return time ? `${day} · ${shortTime(time)}` : day;
  };
}

export function PatientRail({
  center,
  data,
  typeLookup,
  movingId,
  onMove,
  onStopMove,
  onEdit,
  onCancelled,
}: {
  center: string | undefined;
  data: Pick<PatientAppointments, "upcoming" | "past" | "loading" | "failed">;
  typeLookup: TypeLookup;
  movingId: string | null;
  onMove: (a: PatientAppointment) => void;
  onStopMove: () => void;
  onEdit: (a: PatientAppointment) => void;
  onCancelled: (a: PatientAppointment) => void;
}) {
  const t = useTranslations("appointmentsBooking.patient");
  const tb = useTranslations("appointmentsBooking");
  const { can } = useCan();
  const canChange = (kind: BookingKind) => can(kind === "medical" ? "citas.update" : "frontdesk.update");
  const [cancelling, setCancelling] = React.useState<string | null>(null);

  const card = (a: PatientAppointment, past: boolean) => (
    <AppointmentCard
      key={a.id}
      a={a}
      past={past}
      type={typeLookup(a.kind, a.typeId)}
      moving={movingId === a.id}
      canChange={!past && canChange(a.kind)}
      cancelling={cancelling === a.id}
      onMove={() => {
        setCancelling(null);
        onMove(a);
      }}
      onStopMove={onStopMove}
      onEdit={() => onEdit(a)}
      onAskCancel={() => setCancelling(a.id)}
      onKeep={() => setCancelling(null)}
      onCancel={async (reason) => {
        const tenant = a.centerId ?? center;
        try {
          if (a.kind === "medical") await cancelarCita(a.id, reason, tenant);
          else await cancelarSesion(a.id, reason, tenant);
          toast.success(tb("toasts.cancelled"));
          setCancelling(null);
          onCancelled(a);
        } catch (err) {
          toast.error(tb("toasts.cancelFailed", { message: apiErrorLabel(err) }));
        }
      }}
    />
  );

  return (
    <div className="flex flex-col gap-4" data-slot="patient-appointments">
      {data.failed.map((k) => (
        <p key={k} className="text-xs text-destructive">
          {t(k === "medical" ? "loadFailedMedical" : "loadFailedService")}
        </p>
      ))}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("upcoming")}</h3>
        {/* What is loaded shows while the rest loads (e.g. sessions after a center switch), so a moving
            card and its Stop never disappear; "Loading…" only while nothing is there yet. */}
        {data.upcoming.length > 0 ? (
          data.upcoming.map((a) => card(a, false))
        ) : data.loading ? (
          <p className="text-sm text-muted-foreground">{tb("loading")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("past")}</h3>
        {data.past.length > 0 ? (
          data.past.map((a) => card(a, true))
        ) : data.loading ? null : (
          <p className="text-sm text-muted-foreground">{t("noPast")}</p>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({
  a,
  past,
  type,
  moving,
  canChange,
  cancelling,
  onMove,
  onStopMove,
  onEdit,
  onAskCancel,
  onKeep,
  onCancel,
}: {
  a: PatientAppointment;
  past: boolean;
  type: { name: string; color: string | null } | undefined;
  moving: boolean;
  canChange: boolean;
  cancelling: boolean;
  onMove: () => void;
  onStopMove: () => void;
  onEdit: () => void;
  onAskCancel: () => void;
  onKeep: () => void;
  onCancel: (reason: string) => Promise<void>;
}) {
  const t = useTranslations("appointmentsBooking.patient");
  const tRoot = useTranslations();
  const label = useAppointmentLabel();
  const kindLabel = t(a.kind === "medical" ? "kindMedical" : "kindService");
  const statusKey = `${a.kind === "medical" ? "citas.estado" : "servicios.estado"}.${a.status}`;
  const status = tRoot.has(statusKey) ? tRoot(statusKey) : a.status;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg p-3 text-sm ring-1",
        moving ? "bg-primary/10 ring-2 ring-primary" : "bg-card ring-foreground/10",
        past && "opacity-60",
      )}
      data-slot="patient-appointment"
    >
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full bg-muted-foreground"
          style={type?.color ? { backgroundColor: type.color } : undefined}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate font-medium">{type?.name ?? kindLabel}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{kindLabel}</span>
      </div>
      <p className="tabular-nums first-letter:uppercase">{label(a.date, a.time)}</p>
      {(a.withLabel || past) && (
        <p className="truncate text-xs text-muted-foreground">
          {[a.withLabel, past ? status : null].filter(Boolean).join(" · ")}
        </p>
      )}

      {moving ? (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs font-medium text-primary">{t("moving")}</p>
          <Button size="xs" variant="outline" onClick={onStopMove}>
            {t("stopMove")}
          </Button>
        </div>
      ) : cancelling ? (
        <CancelBox onKeep={onKeep} onCancel={onCancel} id={a.id} />
      ) : (
        canChange && (
          <div className="flex gap-1">
            <Button size="xs" variant="outline" onClick={onMove}>
              {t("move")}
            </Button>
            {a.kind === "medical" && (
              <Button size="xs" variant="ghost" onClick={onEdit}>
                {t("edit")}
              </Button>
            )}
            <Button size="xs" variant="ghost" className="text-destructive" onClick={onAskCancel}>
              {t("cancel")}
            </Button>
          </div>
        )
      )}
    </div>
  );
}

function CancelBox({
  id,
  onKeep,
  onCancel,
}: {
  id: string;
  onKeep: () => void;
  onCancel: (reason: string) => Promise<void>;
}) {
  const t = useTranslations("appointmentsBooking.patient");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const fieldId = `cancel-reason-${id}`;

  // A ref, not only the state: two fast clicks land before the re-render that disables the button.
  const inFlight = React.useRef(false);
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onCancel(reason.trim());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2">
      <Label htmlFor={fieldId} className="text-xs">
        {t("cancelReasonLabel")}
      </Label>
      <Textarea
        id={fieldId}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("cancelReasonPlaceholder")}
        rows={2}
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="xs" variant="destructive" onClick={confirm} disabled={busy || reason.trim() === ""}>
          {t("confirmCancel")}
        </Button>
        <Button size="xs" variant="ghost" onClick={onKeep} disabled={busy}>
          {t("keep")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Edit a medical appointment from the rail: the shared CitaModal in edit mode (it hosts CitaActions).
 * Doctors come from the appointment's own center.
 */
export function EditAppointmentModal({
  cita,
  center,
  appointmentTypes,
  onClose,
  onSaved,
}: {
  cita: Cita;
  center: string | undefined;
  appointmentTypes: TipoCita[];
  onClose: () => void;
  onSaved: (saved?: Cita) => void;
}) {
  const doctorsCenter = cita.clinicId ?? center;
  const medicosRes = useResource<Personal[]>(() => getMedicos(doctorsCenter), [doctorsCenter]);
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  return (
    <CitaModal
      open
      fecha={cita.date}
      cita={cita}
      centroId={doctorsCenter ?? undefined}
      tipos={appointmentTypes}
      medicos={medicos}
      canal="callcenter"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSaved={onSaved}
    />
  );
}
