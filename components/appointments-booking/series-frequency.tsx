"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/kit/form-dialog";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { toggleWeekday } from "@/lib/agenda/booking/series-edit";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

export type SeriesMode = "manual" | "weekly";

// A known week (2024-01-01 is a Monday): weekday d (1 Mon … 6 Sat) is 2024-01-0d. Only used to
// render the weekday's name in the app's language.
const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;
const sampleDay = (d: number) => parseDayUTC(`2024-01-0${d}`);

/**
 * How a service series is built: Manual (the picked date, plus any dates added by hand) or Semanal
 * (which weekdays and how many in total; the dates fill in). The times per week ARE the days chosen, so
 * they are only shown, never set separately (owner, 2026-11-23). The picked date's weekday is selected
 * and locked. Controls only: the form owns the state and the rows.
 */
export function SeriesFrequency({
  mode,
  onMode,
  days,
  startDay,
  onDays,
  total,
  maxTotal,
  limitedBy20,
  onTotal,
  disabled,
}: {
  mode: SeriesMode;
  onMode: (mode: SeriesMode) => void;
  days: number[];
  /** The picked date's weekday (getUTCDay numbering). */
  startDay: number;
  onDays: (days: number[]) => void;
  total: number;
  maxTotal: number;
  /** `maxTotal` is the 20-per-booking limit (not the patient's balance): say so at the top. */
  limitedBy20: boolean;
  onTotal: (total: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("appointmentsBooking.series");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("frequency")}>
        <SegmentedControl<SeriesMode>
          ariaLabel={t("frequency")}
          disabled={disabled}
          value={mode}
          options={[
            { value: "manual", label: t("manual") },
            { value: "weekly", label: t("weeklyPattern") },
          ]}
          onChange={onMode}
        />
      </Field>
      {mode === "weekly" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field label={t("days")} hint={t("perWeekSummary", { n: days.length })}>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("days")}>
              {WEEKDAYS.map((d) => {
                const on = days.includes(d);
                const locked = d === startDay;
                const day = sampleDay(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled || locked}
                    onClick={() => onDays(toggleWeekday(days, d, startDay))}
                    className={cn(
                      "h-9 min-w-11 rounded-full border px-3 text-sm font-medium capitalize transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                      locked && "disabled:opacity-100",
                      disabled && "disabled:opacity-50",
                    )}
                  >
                    {day ? format.dateTime(day, "dayWeekdayOnly") : ""}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("total")} hint={limitedBy20 && total >= maxTotal ? t("maxPerBooking", { n: maxTotal }) : undefined}>
            <Stepper label={t("total")} value={total} min={1} max={maxTotal} disabled={disabled} onChange={onTotal} />
          </Field>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  const t = useTranslations("appointmentsBooking.series");
  return (
    <div className="flex h-9 w-fit items-center rounded-md border border-input" role="group" aria-label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={`${label}: ${t("fewer")}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <HugeiconsIcon icon={MinusSignIcon} className="size-4" />
      </Button>
      <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={`${label}: ${t("more")}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
      </Button>
    </div>
  );
}
