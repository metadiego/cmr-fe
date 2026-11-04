"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { CitaModal } from "@/components/agenda/cita-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingToolbar, type BookingView } from "@/components/appointments-booking/booking-toolbar";
import { AvailabilityMonth } from "@/components/appointments-booking/availability-month";
import { DayPanel } from "@/components/appointments-booking/day-panel";
import { PeriodHeader } from "@/components/appointments-booking/period-header";
import { WeekGrid } from "@/components/appointments-booking/week-grid";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import type { BookingCalendarData } from "@/hooks/use-booking-calendar";
import type { TimeWindow } from "@/lib/agenda/booking/availability";
import { dayKind, monthOf, shiftMonth, type MonthRef } from "@/lib/agenda/booking/month";
import { shiftDay, type BookingPeriod } from "@/lib/agenda/booking/period";
import { shiftWeek, weekDays } from "@/lib/agenda/booking/week";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import type { TipoCita } from "@/lib/api/citas";
import type { Paciente } from "@/lib/api/pacientes";
import { getMedicos, type Personal } from "@/lib/api/personal";

// The calendar half of the booking screen: toolbar, the period row (‹ Today › · title · Day/Week/Month)
// and the period itself: Month (month of free spots + the selected day's times), Week (hours × days +
// the selected day's times) or Day (that day's times, large, hosting the form / Move box itself).
// Picking a medical time opens the shared CitaModal with everything preset (it owns doctor choice,
// validation, the overlap warning, the EHR gate and the BE's reschedule-instead behaviour). Picking a
// service time renders the `serviceForm` slot under the day's grid. While moving an appointment the day
// panel asks "Move here?" instead. Data comes from the screen's useBookingCalendar.

type Month = MonthRef;

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
  /** Week view: any day of the shown week. */
  anchor?: string;
}

export function BookingCalendar({
  data,
  center,
  centerNote,
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
  period,
  anchor,
  onPeriod,
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
  /** One line under the toolbar, e.g. while a move shows the appointment's own center. */
  centerNote?: string;
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
  period: BookingPeriod;
  /** Week view: any day of the shown week. */
  anchor: string;
  onPeriod: (p: BookingPeriod) => void;
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
  // Booking a medical time opens CitaModal, which creates: only with `citas.create`. Without it the
  // time can still be picked (to read it), and the day panel says why nothing opens.
  const { can, ready: permsReady } = useCan();
  const canCreateMedical = can("citas.create");

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
    if (medical && !moving && canCreateMedical) setModal({ date: day, time });
  };

  const selectDay = (day: string) => {
    if (day !== date) onChange({ date: day });
  };

  const pickNext = (day: string, time: string) => {
    if (day !== date) onChange({ date: day, month: monthOf(day), anchor: day });
    pickTime(day, time);
  };

  // A week cell = that day + the hour's first time with room, exactly like picking it in the day panel.
  const pickCell = (day: string, time: string) => {
    if (day !== date) onChange({ date: day });
    pickTime(day, time);
  };

  const today = data.todayIso;
  const dayDate = date ?? today;
  const shift = (delta: -1 | 0 | 1) => {
    if (period === "month") {
      onChange({ month: delta === 0 ? monthOf(today) : shiftMonth(month, delta) });
    } else if (period === "week") {
      const next = delta === 0 ? today : shiftWeek(anchor, delta);
      onChange({ anchor: next, month: monthOf(next) });
    } else {
      const next = delta === 0 ? today : shiftDay(dayDate, delta);
      onChange({ date: next < today ? today : next, month: monthOf(next) });
    }
  };
  const closedKind = date ? dayKind(date, monthOf(date).month0, today, data.holidays) : undefined;
  const closedLabel =
    closedKind === "sunday" ? t("day.closed") : closedKind === "holiday" ? t("day.holiday") : undefined;

  const fullDayHref = date
    ? medical
      ? `/scheduling/appointments/${date}`
      : `/scheduling/appointments/services/${date}`
    : undefined;

  return (
    <section
      className="@container flex min-h-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
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
      {centerNote && <p className="text-xs font-medium text-primary">{centerNote}</p>}
      <PeriodHeader
        period={period}
        month={month}
        anchor={anchor}
        date={dayDate}
        canGoBack={period !== "day" || dayDate > today}
        onShift={shift}
        onPeriod={onPeriod}
      />

      {data.notConfigured ? (
        <EmptyState
          className="min-h-0 flex-1"
          title={t("month.notConfigured")}
          description={t("month.notConfiguredHint")}
        />
      ) : (
        // Month/Week and the day panel side by side only when this card is wide enough for both (a
        // container query, so the app sidebar being open or folded counts): main >= ~560px + gap + the
        // 19rem day panel. Narrower (laptops with the sidebar open), the day panel sits under the main
        // area and both share the height; the day panel scrolls inside itself, the page never does.
        // Day view is the day panel alone, large.
        <div
          className={
            period === "day"
              ? "flex min-h-0 flex-1 flex-col"
              : "grid min-h-0 flex-1 grid-cols-1 gap-4 lg:@max-[880px]:grid-rows-[minmax(0,3fr)_minmax(0,2fr)] @min-[880px]:grid-cols-[minmax(0,1fr)_19rem] @min-[880px]:grid-rows-[minmax(0,1fr)]"
          }
        >
          {period === "month" && (
            <AvailabilityMonth
              weeks={data.weeks}
              month0={month.month0}
              todayIso={today}
              holidays={data.holidays}
              days={data.days}
              view={medical ? view : "free"}
              window={window}
              selected={date}
              ringDate={ringDate}
              onSelect={selectDay}
              onRetry={data.retryDay}
            />
          )}
          {period === "week" && (
            <WeekGrid
              week={weekDays(anchor)}
              todayIso={today}
              holidays={data.holidays}
              days={data.weekDays}
              view={medical ? view : "free"}
              window={window}
              selected={date}
              picked={picked}
              ringDate={ringDate}
              onPick={pickCell}
              onRetry={data.retryDay}
            />
          )}
          <DayPanel
            date={date}
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
            large={period === "day"}
            closedLabel={closedLabel}
          >
            {date && picked && serviceForm ? (
              serviceForm({ date, time: picked, clear: () => setPick(null) })
            ) : medical && picked && !moving && permsReady && !canCreateMedical ? (
              <p className="text-sm text-muted-foreground">{t("day.noPermissionMedical")}</p>
            ) : null}
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
