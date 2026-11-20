"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Field } from "@/components/kit/form-dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SheetNotice } from "@/components/agenda/sheet-notice";
import { SlotPicker, type Slot } from "@/components/agenda/slot-picker";
import { shiftDay } from "@/lib/agenda/appointment-form";
import { parseDayUTC } from "@/lib/format/fecha";
import type { SheetCheck } from "@/lib/agenda/sheet";

type Holiday = { name: string; blocksSchedule: boolean };

// The appointment's day and hour (components/agenda/cita-modal.tsx): the date with ‹ › to step a day
// and the weekday spelled out (on the phone people say "el jueves"), then the day's hours as buttons
// with their free places. The hours come from the type's slots that day; nothing here blocks.
export function AppointmentWhenFields({
  date,
  onDateChange,
  dateLocked,
  slots,
  time,
  endTime,
  onTimeChange,
  holiday,
  sheet,
}: {
  date: string;
  onDateChange: (date: string) => void;
  /** Edit mode: a new date is a reschedule, not an edit. */
  dateLocked?: boolean;
  slots: Slot[];
  time: string;
  endTime: string;
  onTimeChange: (time: string) => void;
  holiday?: Holiday | null;
  sheet?: SheetCheck | null;
}) {
  const t = useTranslations("agenda.modal");
  const format = useFormatter();
  const slotFull = !!time && slots.some((s) => s.time === time && s.vacios <= 0);
  const day = date ? parseDayUTC(date.slice(0, 10)) : null;

  return (
    <>
      <Field label={t("date")} required>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={t("previousDay")}
            disabled={dateLocked || !date}
            onClick={() => onDateChange(shiftDay(date, -1))}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </Button>
          <DatePicker
            className="w-44 shrink-0"
            value={date}
            onChange={(v) => v && onDateChange(v)}
            disabled={dateLocked}
            aria-label={t("date")}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={t("nextDay")}
            disabled={dateLocked || !date}
            onClick={() => onDateChange(shiftDay(date, 1))}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Button>
          {day && (
            <span className="truncate text-sm font-medium capitalize text-muted-foreground">
              {format.dateTime(day, "weekdayLong")}
            </span>
          )}
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
        <SlotPicker slots={slots} value={time} onChange={onTimeChange} variant="chips" selectedEnd={endTime} />
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
