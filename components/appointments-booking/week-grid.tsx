"use client";

import { useFormatter, useTranslations } from "next-intl";

import {
  bookedBucket,
  freeBucket,
  type DaySlots,
  type TimeWindow,
} from "@/lib/agenda/booking/availability";
import { dayKind, monthOf } from "@/lib/agenda/booking/month";
import { hourLabel, weekCell, weekHours } from "@/lib/agenda/booking/week";
import type { DayResult } from "@/hooks/use-booking-availability";
import type { BookingView } from "@/components/appointments-booking/booking-toolbar";
import { BOOKED_CLASS, FREE_CLASS } from "@/components/appointments-booking/availability-month";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The week of free spots: Monday–Saturday columns × the hour rows the type's times use (only those in
// the Any/Morning/Afternoon window). Each cell is the hour's free spots (Free) or booked count (Booked),
// in the month's colour buckets; a click picks that day and the hour's first time with room. Past,
// holiday and not-set-up columns are grey; a column whose request failed asks again on click.

type Column =
  | { kind: "inert"; label?: string }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; day: DaySlots };

export function WeekGrid({
  week,
  todayIso,
  holidays,
  days,
  view,
  window,
  selected,
  picked,
  ringDate,
  onPick,
  onRetry,
}: {
  /** The six shown days, Monday–Saturday. */
  week: string[];
  todayIso: string;
  holidays: string[];
  days: Record<string, DayResult>;
  view: BookingView;
  window: TimeWindow;
  selected?: string;
  /** The picked time on the selected day (its cell is outlined). */
  picked: string | null;
  ringDate?: string;
  onPick: (date: string, time: string) => void;
  onRetry: (date: string) => void;
}) {
  const t = useTranslations("appointmentsBooking.month");
  const tw = useTranslations("appointmentsBooking.week");
  const format = useFormatter();

  const columnOf = (date: string): Column => {
    const k = dayKind(date, monthOf(date).month0, todayIso, holidays);
    if (k === "past") return { kind: "inert" };
    if (k === "holiday") return { kind: "inert", label: t("holiday") };
    if (k === "sunday") return { kind: "inert", label: t("closed") };
    const d = days[date];
    if (d === undefined) return { kind: "loading" };
    if (d === "error") return { kind: "error" };
    if (d === null) return { kind: "inert", label: t("unavailable") };
    return { kind: "ready", day: d };
  };
  const columns = week.map((date) => ({ date, col: columnOf(date) }));
  const hours = weekHours(
    columns.flatMap(({ col }) => (col.kind === "ready" ? [col.day] : [])),
    window,
  );
  const loading = columns.some(({ col }) => col.kind === "loading");
  const pickedHour = picked?.slice(0, 2);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1" data-slot="week-grid">
      <div className="grid grid-cols-[3rem_repeat(6,minmax(0,1fr))] gap-1 text-center text-xs font-medium text-muted-foreground">
        <div />
        {columns.map(({ date, col }) => {
          const d = parseDayUTC(date);
          return (
            <div
              key={date}
              className={cn(
                "flex flex-col rounded-md py-1",
                date === todayIso && "text-primary",
                date === ringDate && "ring-2 ring-orange-500",
              )}
            >
              <span className="first-letter:uppercase">{d ? format.dateTime(d, "dayWeekdayNum") : date}</span>
              {col.kind === "inert" && col.label && <span className="font-normal">{col.label}</span>}
              {col.kind === "error" && (
                <button
                  type="button"
                  className="font-normal text-destructive underline-offset-2 hover:underline"
                  onClick={() => onRetry(date)}
                >
                  {t("errorRetry")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {hours.length === 0 ? (
        <p className="m-auto text-sm text-muted-foreground">
          {loading ? tw("loading") : tw("noTimes")}
        </p>
      ) : (
        <div
          className="grid min-h-0 flex-1 grid-cols-[3rem_repeat(6,minmax(0,1fr))] gap-1 overflow-y-auto"
          style={{ gridAutoRows: "minmax(2rem, 1fr)" }}
        >
          {hours.map((hour) => (
            <WeekRow
              key={hour}
              hour={hour}
              columns={columns}
              view={view}
              window={window}
              selected={selected}
              pickedHour={pickedHour}
              onPick={onPick}
              emptyLabel={tw("noTimeShort")}
              cellLabel={(date, value) =>
                tw(view === "booked" ? "cellBooked" : "cellFree", {
                  day: format.dateTime(parseDayUTC(date) ?? new Date(0), "dayWeekdayShort"),
                  time: hourLabel(hour),
                  n: value,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WeekRow({
  hour,
  columns,
  view,
  window,
  selected,
  pickedHour,
  onPick,
  emptyLabel,
  cellLabel,
}: {
  hour: string;
  columns: { date: string; col: Column }[];
  view: BookingView;
  window: TimeWindow;
  selected?: string;
  pickedHour?: string;
  onPick: (date: string, time: string) => void;
  emptyLabel: string;
  cellLabel: (date: string, value: number) => string;
}) {
  const base = "flex min-h-0 items-center justify-center rounded-md text-sm tabular-nums";
  return (
    <>
      <div className="flex items-start justify-end pt-1 pr-1 text-xs text-muted-foreground tabular-nums">
        {hourLabel(hour)}
      </div>
      {columns.map(({ date, col }) => {
        if (col.kind === "loading") {
          return (
            <div key={date} className={cn(base, "bg-muted/30")}>
              <span className="h-3 w-5 animate-pulse rounded bg-muted" aria-hidden />
            </div>
          );
        }
        if (col.kind !== "ready") {
          return <div key={date} className={cn(base, "bg-muted/60")} />;
        }
        const cell = weekCell(col.day, hour, window);
        if (!cell) {
          return (
            <div key={date} className={cn(base, "bg-muted/40 text-muted-foreground")} aria-label={emptyLabel}>
              –
            </div>
          );
        }
        const value = view === "booked" ? cell.booked : cell.free;
        const className =
          view === "booked" ? BOOKED_CLASS[bookedBucket(cell.booked, cell.capacity)] : FREE_CLASS[freeBucket(cell.free)];
        const isPicked = date === selected && hour === pickedHour;
        return (
          <button
            key={date}
            type="button"
            className={cn(
              base,
              className,
              "font-semibold hover:brightness-95",
              isPicked && "outline-2 outline-offset-1 outline-primary",
            )}
            aria-pressed={isPicked}
            aria-label={cellLabel(date, value)}
            onClick={() => onPick(date, cell.time)}
          >
            {value}
          </button>
        );
      })}
    </>
  );
}
