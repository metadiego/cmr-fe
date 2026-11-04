"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";

import {
  createCita,
  getTiposCita,
  listCitas,
  reagendarCita,
  type Cita,
  type TipoCita,
} from "@/lib/api/citas";
import { toastError } from "@/lib/api/errors";
import { addDaysToDay, canReschedule, pickNextAppointment } from "@/lib/agenda/next-appointment";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { useCan } from "@/hooks/use-can";
import { useMe } from "@/hooks/use-me";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AvisoDisponibilidad } from "@/components/citas/aviso-disponibilidad";
import { ReturnDatePicker } from "@/components/citas/return-date-picker";
import { SlotAvailabilityHint } from "@/components/citas/slot-availability-hint";

// "Next appt" board column (render.kind = "nextAppointment"): the date, clickable. The popover shows the
// patient's current next appointment and moves it with the same shortcuts + calendar as the post-visit
// modal — reschedule (POST /appointments/:id/reschedule, audit trail kept) instead of a second booking.
// With no next appointment it books one (follow-up, the row's doctor, confirmed — as Nueva cita does).
export function NextAppointmentCell({
  value,
  patientId,
  doctorId,
  centroId,
  onChanged,
}: {
  value: unknown; // the column's date (YYYY-MM-DD) or null
  patientId?: string;
  doctorId?: string;
  centroId?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("nextAppointment");
  const tNueva = useTranslations("nuevaCita");
  const tRoot = useTranslations();
  const format = useFormatter();
  const { can } = useCan();
  const me = useMe();
  const actorId = me.kind === "ok" ? me.me.staffId ?? undefined : undefined;

  const current = typeof value === "string" && value ? value : null;
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [appt, setAppt] = React.useState<Cita | null>(null);
  const [types, setTypes] = React.useState<TipoCita[]>([]);
  const [day, setDay] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [time, setTime] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const fmtDay = (d: string, style: "dayWeekdayShort" | "dayMonthYear") => {
    const p = parseDayUTC(d);
    return p ? format.dateTime(p, style) : d;
  };

  // Loaded on open only: the board can have dozens of rows and this is one click away.
  React.useEffect(() => {
    if (!open || !patientId) return;
    let active = true;
    const params = current ? { from: current, to: current } : { from: addDaysToDay(todayPR(), 1) };
    Promise.all([
      listCitas({ patientId, ...params }, centroId).then((r) => r.items ?? []),
      getTiposCita().catch(() => [] as TipoCita[]),
    ])
      .then(([list, ts]) => {
        if (!active) return;
        const next = pickNextAppointment(list, current ? addDaysToDay(current, -1) : todayPR());
        setAppt(next);
        setTime(next?.time ? next.time.slice(0, 5) : "");
        setTypes(ts);
      })
      .catch((err) => active && toastError(err, tRoot))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, patientId, current, centroId, tRoot]);

  // Opening resets the form and shows the skeleton until the effect above has the appointment.
  function onOpenChange(next: boolean) {
    if (next) {
      setLoading(true);
      setDay("");
      setReason("");
      setTime("");
    }
    setOpen(next);
  }

  const type = appt ? types.find((x) => x.id === appt.appointmentTypeId) : null;
  // Owner's rule (04-nov-2026): every appointment booked or moved from this cell is a FOLLOW-UP.
  // Booking sends the follow-up type; the reschedule endpoint cannot change the type yet (BE handoff
  // docs/specs/next-appointment-follow-up-handoff-be.md), so only follow-ups can be moved from here.
  const followUp = types.find((x) => x.slug === "seguimiento");
  const isFollowUp = !!appt && !!followUp && appt.appointmentTypeId === followUp.id;
  const movable = canReschedule(appt) && isFollowUp && can("citas.update");
  const bookable = !appt && !loading && !!followUp && can("citas.create");
  const doctorForAviso = appt?.doctorId ?? doctorId;

  async function save() {
    if (!day) return;
    setBusy(true);
    try {
      if (appt) {
        await reagendarCita(
          appt.id,
          {
            date: day,
            time: time || undefined,
            reason: reason.trim() || t("defaultReason"),
            actorId,
          },
          centroId,
        );
        toast.success(t("moved", { date: fmtDay(day, "dayWeekdayShort") }));
      } else if (patientId && followUp) {
        // Always a follow-up (owner's rule), never the first type of the catalogue.
        await createCita(
          {
            patientId,
            appointmentTypeId: followUp.id,
            date: day,
            ...(time ? { time } : {}),
            ...(doctorId ? { doctorId } : {}),
            ...(reason.trim() ? { notes: reason.trim() } : {}),
            // Booked at the desk with the patient present: confirmed, as in Nueva cita.
            status: "confirmada",
          } as Parameters<typeof createCita>[0],
          centroId,
        );
        toast.success(t("booked", { date: fmtDay(day, "dayWeekdayShort") }));
      }
      setOpen(false);
      onChanged?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  if (!patientId) {
    return <span className="whitespace-nowrap tabular-nums">{current ? fmtDay(current, "dayMonthYear") : "—"}</span>;
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t("open")}
          className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 tabular-nums transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <span>{current ? fmtDay(current, "dayMonthYear") : "—"}</span>
          <HugeiconsIcon
            icon={Calendar03Icon}
            className="size-3.5 text-muted-foreground opacity-60 group-hover:text-primary group-hover:opacity-100"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[24rem] gap-0 p-0">
        <div className="border-b bg-muted/30 px-4 py-3">
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("title")}
          </span>
          {loading ? (
            <div className="mt-1 h-6 w-40 animate-pulse rounded bg-muted" />
          ) : appt ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">{fmtDay(appt.date, "dayWeekdayShort")}</span>
              {appt.time && <span className="font-mono text-sm tabular-nums">{appt.time.slice(0, 5)}</span>}
              {type && (
                <Badge
                  variant="secondary"
                  style={type.color ? { color: type.color, backgroundColor: `${type.color}1a` } : undefined}
                >
                  {type.name}
                </Badge>
              )}
              {appt.doctorName && <span className="text-xs text-muted-foreground">{appt.doctorName}</span>}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{t("none")}</p>
          )}
        </div>

        {!loading && (movable || bookable) && (
          <div className="space-y-3 px-4 py-3">
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {tNueva("whenBack")}
            </span>
            <ReturnDatePicker value={day} onChange={setDay} />
            <AvisoDisponibilidad doctorId={doctorForAviso} date={day} centro={centroId} onUseSuggested={setDay} />
            <SlotAvailabilityHint
              day={day}
              time={time}
              appointmentTypeId={followUp?.id}
              centroId={centroId}
              onUseTime={setTime}
            />
            {appt && day && (day !== appt.date || time !== (appt.time ?? "").slice(0, 5)) && (
              <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                {t("fromTo", {
                  from: `${fmtDay(appt.date, "dayWeekdayShort")} ${(appt.time ?? "").slice(0, 5)}`.trim(),
                  to: `${fmtDay(day, "dayWeekdayShort")} ${time}`.trim(),
                })}
              </p>
            )}
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={appt ? t("reasonPh") : tNueva("notesPlaceholder")}
            />
          </div>
        )}

        {!loading && appt && !movable && (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            {canReschedule(appt) && !isFollowUp ? t("notFollowUp") : t("notMovable")}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t bg-muted/30 px-4 py-2.5">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            {tNueva("exit")}
          </Button>
          {(movable || bookable) && (
            <Button type="button" size="sm" onClick={save} disabled={!day || busy || (day === appt?.date && time === (appt?.time ?? "").slice(0, 5))}>
              {appt ? t("move") : t("book")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
