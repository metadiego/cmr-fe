"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import type { SeriesDay } from "@/hooks/use-series-availability";
import type { SeriesRow } from "@/lib/agenda/booking/series";
import { rowTimeOptions } from "@/lib/agenda/booking/series-booking";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The dates of a weekly series: each row's day, its time (a select over that day's times), its status
// chip and, when it is full or blocked, the planner's "Use … instead". A row can be dropped.

export function useDayLabel(): (date: string) => string {
  const format = useFormatter();
  return (date) => {
    const d = parseDayUTC(date);
    return d ? format.dateTime(d, "dayWeekdayShort") : date;
  };
}

export function SeriesRows({
  rows,
  days,
  checking,
  disabled,
  canDrop,
  onTime,
  onSuggestion,
  onDrop,
}: {
  rows: SeriesRow[];
  days: Record<string, SeriesDay>;
  /** Existing sessions / holidays still loading: every row is still being checked. */
  checking: boolean;
  disabled: boolean;
  canDrop: boolean;
  onTime: (index: number, time: string) => void;
  onSuggestion: (index: number, s: { date: string; time: string }) => void;
  onDrop: (index: number) => void;
}) {
  const t = useTranslations("appointmentsBooking.series");
  const dayLabel = useDayLabel();

  return (
    <ol className="flex flex-col gap-1.5" aria-label={t("dates")}>
      {rows.map((r) => {
        const day = days[r.date];
        const loading = checking || day === undefined;
        const failed = day === "error";
        const options = rowTimeOptions(day === "error" ? null : day, r.time);
        const blocked = !loading && !failed && r.status === "blocked";
        const chip = loading
          ? { label: t("checking"), tone: "text-muted-foreground" }
          : failed
            ? { label: t("checkFailed"), tone: "bg-destructive/10 text-destructive" }
            : r.status === "free"
              ? { label: t("statusFree"), tone: "bg-success text-success-foreground" }
              : r.status === "full"
                ? { label: t("statusFull"), tone: "bg-warning text-warning-foreground" }
                : {
                    label: t(
                      r.reason === "holiday"
                        ? "statusHoliday"
                        : r.reason === "duplicate"
                          ? "statusDuplicate"
                          : "statusClosed",
                    ),
                    tone: "bg-destructive/10 text-destructive",
                  };
        const s = !loading && !failed ? r.suggestion : null;
        return (
          <li
            key={`${r.index}|${r.date}`}
            className={cn(
              "flex flex-col gap-1 rounded-md border px-2 py-1.5 text-sm",
              (blocked || failed) && "border-destructive/50 bg-destructive/5",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{dayLabel(r.date)}</span>
              <select
                aria-label={t("time")}
                className="h-7 rounded-md border border-input bg-background px-1 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={r.time}
                disabled={disabled || loading}
                onChange={(e) => onTime(r.index, e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.time} value={o.time} disabled={o.disabled}>
                    {o.full ? t("fullOption", { time: shortTime(o.time) }) : shortTime(o.time)}
                  </option>
                ))}
              </select>
              {canDrop && (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("remove")}
                  title={t("remove")}
                  disabled={disabled}
                  onClick={() => onDrop(r.index)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", chip.tone)}>{chip.label}</span>
              {s && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => onSuggestion(r.index, s)}
                >
                  {s.date === r.date
                    ? t("useTimeInstead", { time: shortTime(s.time) })
                    : t("useDateInstead", { date: `${dayLabel(s.date)} · ${shortTime(s.time)}` })}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
