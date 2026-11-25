"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Field } from "@/components/kit/form-dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SheetNotice } from "@/components/agenda/sheet-notice";
import { SlotPicker, type Slot } from "@/components/agenda/slot-picker";
import { useWeekFree } from "@/hooks/use-week-free";
import { dayParts, shiftWeek, weekStrip } from "@/lib/agenda/appointment-when";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import type { SheetCheck } from "@/lib/agenda/sheet";

type Holiday = { name: string; blocksSchedule: boolean };

// The «Cuándo» side of the appointment dialog (components/agenda/cita-modal.tsx). A week strip (Monday
// to Saturday, each day with the type's free places that day) with ‹ › to move a week and «Elegir otra
// fecha…» for the calendar, the picked day spelled out, then its hours split into morning and
// afternoon. Nothing here blocks: a full hour can still be picked (the BE warns).
export function AppointmentWhenFields({
  date,
  onDateChange,
  dateLocked,
  min,
  slots,
  time,
  onTimeChange,
  holiday,
  sheet,
  clinicId,
  typeId,
}: {
  date: string;
  onDateChange: (date: string) => void;
  /** Edit mode: a new date is a reschedule, not an edit. */
  dateLocked?: boolean;
  /** Earliest pickable day (YYYY-MM-DD) — APPOINTMENT_DATE_IN_PAST (cmr-be #697): the BE never books a past day. */
  min?: string;
  slots: Slot[];
  time: string;
  onTimeChange: (time: string) => void;
  holiday?: Holiday | null;
  sheet?: SheetCheck | null;
  /** For the strip's per-day free places. */
  clinicId: string;
  typeId: string;
}) {
  const t = useTranslations("agenda.modal");
  const tSlot = useTranslations("agenda.slot");
  const format = useFormatter();
  const today = todayPR();
  const day = date ? date.slice(0, 10) : today;
  const week = weekStrip(day, dateLocked ? "0000-00-00" : (min ?? "0000-00-00"));
  const free = useWeekFree(clinicId, dateLocked ? [] : week.map((d) => d.date), typeId);
  const slotFull = !!time && slots.some((s) => s.time === time && s.vacios <= 0);
  const picked = parseDayUTC(day);
  const parts = dayParts(slots);
  const label = (d: string, f: "dayWeekdayOnly" | "dayWeekdayLong") => {
    const x = parseDayUTC(d);
    return x ? format.dateTime(x, f) : d;
  };

  return (
    <>
      <Field label={t("date")} required>
        <div className="flex items-stretch gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-auto w-8 shrink-0"
            aria-label={t("previousWeek")}
            disabled={dateLocked || (!!min && week[0].date <= min)}
            onClick={() => onDateChange(shiftWeek(day, -1, min ?? today))}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </Button>
          <div className="grid flex-1 grid-cols-6 gap-1.5">
            {week.map((d) => {
              const on = d.date === day;
              const n = free[d.date];
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={dateLocked || d.past}
                  aria-pressed={on}
                  aria-label={label(d.date, "dayWeekdayLong")}
                  onClick={() => onDateChange(d.date)}
                  className={cn(
                    "flex min-w-0 flex-col items-center rounded-lg border px-1 py-1.5 text-center transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
                  )}
                >
                  <span className={cn("text-[11px] capitalize", on ? "opacity-85" : "text-muted-foreground")}>
                    {label(d.date, "dayWeekdayOnly")}
                  </span>
                  <span className="text-base leading-tight font-semibold tabular-nums">{d.date.slice(8, 10).replace(/^0/, "")}</span>
                  <span
                    className={cn(
                      "h-4 truncate text-[10.5px] font-medium tabular-nums",
                      on ? "" : "text-muted-foreground",
                    )}
                  >
                    {n != null && !d.past ? tSlot("free", { n }) : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-auto w-8 shrink-0"
            aria-label={t("nextWeek")}
            disabled={dateLocked}
            onClick={() => onDateChange(shiftWeek(day, 1, min ?? today))}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Button>
        </div>
        {/* The picked day spelled out (on the phone people say "el jueves"); it opens the calendar for
            a day outside this week. */}
        <div className="mt-1.5 flex items-center gap-2 text-sm">
          <DatePicker
            variant="button"
            displayFormat="dayWeekdayShort"
            value={day}
            onChange={(v) => v && onDateChange(v)}
            min={min}
            disabled={dateLocked}
            aria-label={t("otherDate")}
            title={t("otherDate")}
            className="h-8 w-auto px-2.5"
          />
          {picked && !dateLocked && <span className="text-xs text-muted-foreground">{t("otherDateHint")}</span>}
        </div>
      </Field>

      <Field label={t("time")} required>
        {holiday && (
          <p
            role="status"
            className={
              "mb-2 rounded-md border px-3 py-2 text-xs " +
              (holiday.blocksSchedule
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-warning/40 bg-warning/10 text-warning-foreground")
            }
          >
            {holiday.blocksSchedule ? t("holidayClosed", { name: holiday.name }) : t("holidayInfo", { name: holiday.name })}
          </p>
        )}
        <SheetNotice sheet={sheet ?? null} className="mb-2" />
        {slots.length === 0 ? (
          <SlotPicker slots={slots} value={time} onChange={onTimeChange} variant="chips" />
        ) : (
          <div className="space-y-3">
            {(
              [
                ["morning", parts.morning],
                ["afternoon", parts.afternoon],
              ] as const
            )
              .filter(([, list]) => list.length > 0)
              .map(([part, list]) => (
                <div key={part} className="space-y-1.5">
                  <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{t(part)}</p>
                  <SlotPicker slots={list} value={time} onChange={onTimeChange} variant="chips" />
                </div>
              ))}
          </div>
        )}
        {/* Non-blocking: the chosen hour has no place left. The BE books it anyway, so the FE warns. */}
        {slotFull && (
          <p className="mt-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
            {t("slotFullWarn")}
          </p>
        )}
      </Field>
    </>
  );
}
