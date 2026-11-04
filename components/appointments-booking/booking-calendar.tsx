"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { CitaModal } from "@/components/agenda/cita-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingToolbar, type BookingView } from "@/components/appointments-booking/booking-toolbar";
import { AvailabilityMonth } from "@/components/appointments-booking/availability-month";
import { DayPanel } from "@/components/appointments-booking/day-panel";
import { useResource } from "@/hooks/use-resource";
import type { BookingCalendarData } from "@/hooks/use-booking-calendar";
import type { TimeWindow } from "@/lib/agenda/booking/availability";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import type { TipoCita } from "@/lib/api/citas";
import type { Paciente } from "@/lib/api/pacientes";
import { getMedicos, type Personal } from "@/lib/api/personal";

// The calendar half of the booking screen: toolbar, month of free spots and the selected day's times.
// Picking a medical time opens the shared CitaModal with everything preset (it owns doctor choice,
// validation, the overlap warning, the EHR gate and the BE's reschedule-instead behaviour). Picking a
// service time renders the `serviceForm` slot under the day's grid. While moving an appointment the day
// panel asks "Move here?" instead. Data comes from the screen's useBookingCalendar.

type Month = { year: number; month0: number };

/**
 * An appointment from the patient rail being moved. The day panel's "Move here?" box confirms with the
 * picked day and time; `onConfirm` resolves true when the move went through (the picked time is then
 * dropped). "Not this one" only un-picks the time: moving goes on until the screen clears it.
 */
export interface CalendarMoving {
  fromLabel: string;
  needsReason: boolean;
  onConfirm: (to: { date: string; time: string }, reason?: string) => Promise<boolean>;
}

export interface BookingCalendarPatch {
  date?: string;
  month?: Month;
  window?: TimeWindow;
  view?: BookingView;
}

function shiftMonth(m: Month, delta: number): Month {
  const i = m.year * 12 + m.month0 + delta;
  return { year: Math.floor(i / 12), month0: i % 12 };
}

function monthOf(iso: string): Month {
  return { year: Number(iso.slice(0, 4)), month0: Number(iso.slice(5, 7)) - 1 };
}

export function BookingCalendar({
  data,
  center,
  kind,
  typeId,
  typeName,
  color,
  label,
  onClearType,
  date,
  month,
  window,
  view,
  onChange,
  patient,
  appointmentTypes,
  moving,
  ringDate,
  serviceForm,
  onAppointmentsChanged,
}: {
  data: BookingCalendarData;
  center: string | undefined;
  kind: BookingKind;
  typeId: string;
  typeName: string;
  color: string | null;
  label: string;
  onClearType: () => void;
  date: string | undefined;
  month: Month;
  window: TimeWindow;
  view: BookingView;
  /** One call per event: the screen merges the patch into its state (and the URL for `date`). */
  onChange: (patch: BookingCalendarPatch) => void;
  patient: Paciente | null;
  appointmentTypes: TipoCita[];
  /** Set while an appointment from the patient rail is being moved. */
  moving?: CalendarMoving;
  /** The moving appointment's current day (orange ring in the month). */
  ringDate?: string;
  /** Task 9: the service booking form for the picked time; `clear` un-picks it (e.g. after booking). */
  serviceForm?: (pick: { date: string; time: string; clear: () => void }) => React.ReactNode;
  /** After a booking is saved: refresh these dates (month + day) and the patient's appointments. */
  onAppointmentsChanged: (dates: string[]) => void;
}) {
  const t = useTranslations("appointmentsBooking");
  const medical = kind === "medical";

  // The picked time belongs to one (type, day, moving or not): changing any drops it without an effect,
  // so starting or stopping a move never leaves a stale pick (and its form or Move box) behind.
  const keyOf = (day: string) => `${kind}|${typeId}|${day}|${moving ? "move" : ""}`;
  const pickKey = keyOf(date ?? "");
  const [pick, setPick] = React.useState<{ key: string; time: string } | null>(null);
  const picked = pick && pick.key === pickKey ? pick.time : null;

  const [modal, setModal] = React.useState<{ date: string; time: string } | null>(null);
  const medicosRes = useResource<Personal[]>(
    () => (medical && center ? getMedicos(center) : Promise.resolve([])),
    [medical, center],
  );
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];

  const pickTime = (day: string, time: string) => {
    setPick({ key: keyOf(day), time });
    if (medical && !moving) setModal({ date: day, time });
  };

  const selectDay = (day: string) => {
    if (day !== date) onChange({ date: day });
  };

  const pickNext = (day: string, time: string) => {
    if (day !== date) onChange({ date: day, month: monthOf(day) });
    pickTime(day, time);
  };

  const fullDayHref = date
    ? medical
      ? `/scheduling/appointments/${date}`
      : `/scheduling/appointments/services/${date}`
    : undefined;

  return (
    <section
      className="flex min-h-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      data-slot="booking-calendar"
    >
      <BookingToolbar
        label={label}
        typeName={typeName}
        color={color}
        onClearType={onClearType}
        window={window}
        onWindow={(w) => onChange({ window: w })}
        view={medical ? view : undefined}
        onView={medical ? (v) => onChange({ view: v }) : undefined}
        nextFree={data.notConfigured ? [] : data.nextFree}
        nextFreeLoading={data.nextFreeLoading}
        onPickNext={pickNext}
      />

      {data.notConfigured ? (
        <EmptyState
          className="min-h-0 flex-1"
          title={t("month.notConfigured")}
          description={t("month.notConfiguredHint")}
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[minmax(0,1fr)]">
          <AvailabilityMonth
            weeks={data.weeks}
            month0={month.month0}
            year={month.year}
            todayIso={data.todayIso}
            holidays={data.holidays}
            days={data.days}
            view={medical ? view : "free"}
            window={window}
            selected={date}
            ringDate={ringDate}
            onSelect={selectDay}
            onRetry={data.retryDay}
            onMonth={(delta) =>
              onChange({ month: delta === 0 ? monthOf(data.todayIso) : shiftMonth(month, delta) })
            }
          />
          <DayPanel
            date={date}
            kind={kind}
            typeName={typeName}
            day={data.day}
            window={window}
            picked={picked}
            onPickTime={(time) => date && pickTime(date, time)}
            onRetry={data.retrySelected}
            moving={
              moving && {
                fromLabel: moving.fromLabel,
                needsReason: moving.needsReason,
                onConfirm: async (reason) => {
                  if (!date || !picked) return;
                  if (await moving.onConfirm({ date, time: picked }, reason)) setPick(null);
                },
                onCancel: () => setPick(null),
              }
            }
            fullDayHref={fullDayHref}
          >
            {date && picked && serviceForm
              ? serviceForm({ date, time: picked, clear: () => setPick(null) })
              : null}
          </DayPanel>
        </div>
      )}

      {modal && (
        <CitaModal
          key={`${modal.date} ${modal.time}`}
          open
          fecha={modal.date}
          horaInicial={modal.time}
          tipoCitaIdInicial={typeId}
          pacienteInicial={patient}
          centroId={center}
          tipos={appointmentTypes}
          medicos={medicos}
          canal="callcenter"
          onOpenChange={(open) => {
            if (!open) setModal(null);
          }}
          onSaved={(cita) => {
            setModal(null);
            setPick(null);
            const dates = [modal.date];
            const saved = cita?.date ? String(cita.date).slice(0, 10) : "";
            if (saved && saved !== modal.date) dates.push(saved);
            onAppointmentsChanged(dates);
          }}
        />
      )}
    </section>
  );
}
