"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  bookedBucket,
  bookedIn,
  freeBucket,
  freeIn,
  inWindow,
  type DaySlots,
  type TimeWindow,
} from "@/lib/agenda/booking/availability";
import { dayKind } from "@/lib/agenda/booking/month";
import type { DayResult } from "@/hooks/use-booking-availability";
import type { BookingView } from "@/components/appointments-booking/booking-toolbar";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The month of free spots: one cell per day with its number (free in the time window, or booked in
// Booked view), a small label and a colour bucket. Only the weeks the month needs; the rows share the
// available height. Past days, Sundays, holidays and days with nothing set up are grey and inert; a day
// whose request failed shows "—" and asks again on click. The ‹ Today › row and the title live in the
// PeriodHeader above it.

export const FREE_CLASS: Record<ReturnType<typeof freeBucket>, string> = {
  full: "bg-destructive/10 text-destructive",
  low: "bg-warning text-warning-foreground",
  some: "bg-success/50 text-success-foreground",
  many: "bg-success text-success-foreground",
};

export const BOOKED_CLASS: Record<ReturnType<typeof bookedBucket>, string> = {
  0: "bg-primary/5",
  1: "bg-primary/15",
  2: "bg-primary/25",
  3: "bg-primary/40",
  4: "bg-primary/60",
};

type Cell =
  | { kind: "outside" }
  | { kind: "inert"; label?: string }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "value"; value: number; label: string; className: string };

export function AvailabilityMonth({
  weeks,
  month0,
  todayIso,
  holidays,
  days,
  view,
  window,
  selected,
  ringDate,
  onSelect,
  onRetry,
}: {
  weeks: string[][];
  month0: number;
  todayIso: string;
  holidays: string[];
  days: Record<string, DayResult>;
  view: BookingView;
  window: TimeWindow;
  selected?: string;
  /** Moving: the appointment's current day, ringed in orange. */
  ringDate?: string;
  onSelect: (date: string) => void;
  onRetry: (date: string) => void;
}) {
  const t = useTranslations("appointmentsBooking.month");
  const format = useFormatter();

  const cellOf = (date: string): Cell => {
    const k = dayKind(date, month0, todayIso, holidays);
    if (k === "outside") return { kind: "outside" };
    if (k === "past") return { kind: "inert" };
    if (k === "sunday") return { kind: "inert", label: t("closed") };
    if (k === "holiday") return { kind: "inert", label: t("holiday") };
    const d = days[date];
    if (d === undefined) return { kind: "loading" };
    if (d === "error") return { kind: "error" };
    if (d === null) return { kind: "inert", label: t("unavailable") };
    return valueCell(d);
  };

  const valueCell = (d: DaySlots): Cell => {
    const open = d.slots.filter((s) => s.state !== "unavailable" && inWindow(s.time, window));
    if (open.length === 0) return { kind: "inert", label: t("closed") };
    if (view === "booked") {
      const { booked, capacity } = bookedIn({ ...d, slots: open });
      return {
        kind: "value",
        value: booked,
        label: t("booked"),
        className: BOOKED_CLASS[bookedBucket(booked, capacity)],
      };
    }
    const n = freeIn(d, window);
    const bucket = freeBucket(n);
    return {
      kind: "value",
      value: n,
      label: bucket === "full" ? t("full") : t("free"),
      className: FREE_CLASS[bucket],
    };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-slot="availability-month">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {(weeks[0] ?? []).map((d) => {
          const day = parseDayUTC(d);
          return <div key={d}>{day ? format.dateTime(day, "dayWeekdayOnly") : ""}</div>;
        })}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-7 gap-1"
        style={{ gridAutoRows: "minmax(0, 1fr)" }}
      >
        {weeks.flat().map((date) => {
          const cell = cellOf(date);
          const dayNum = Number(date.slice(8, 10));
          const isSelected = date === selected;
          const isRing = date === ringDate;
          const base = cn(
            "relative flex min-h-0 flex-col rounded-md p-1.5 text-left text-xs transition-colors",
            isSelected && "outline-2 outline-offset-1 outline-primary",
            isRing && "ring-2 ring-orange-500",
          );

          if (cell.kind === "outside") {
            return <div key={date} className={cn(base, "text-muted-foreground/40")}>{dayNum}</div>;
          }
          if (cell.kind === "inert") {
            return (
              <div key={date} className={cn(base, "bg-muted/60 text-muted-foreground")}>
                <span>{dayNum}</span>
                {cell.label && <span className="mt-auto truncate">{cell.label}</span>}
              </div>
            );
          }
          if (cell.kind === "loading") {
            return (
              <div key={date} className={cn(base, "bg-muted/30")}>
                <span>{dayNum}</span>
                <span className="m-auto h-4 w-6 animate-pulse rounded bg-muted" aria-hidden />
              </div>
            );
          }
          if (cell.kind === "error") {
            return (
              <button
                key={date}
                type="button"
                className={cn(base, "border border-dashed hover:bg-muted")}
                title={t("errorRetry")}
                aria-label={t("errorRetry")}
                onClick={() => onRetry(date)}
              >
                <span>{dayNum}</span>
                <span className="m-auto text-lg leading-none text-muted-foreground">—</span>
              </button>
            );
          }
          return (
            <button
              key={date}
              type="button"
              className={cn(base, cell.className, "hover:brightness-95")}
              aria-pressed={isSelected}
              onClick={() => onSelect(date)}
            >
              <span>{dayNum}</span>
              <span className="m-auto text-xl leading-none font-semibold tabular-nums">{cell.value}</span>
              <span className="truncate opacity-80">{cell.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
