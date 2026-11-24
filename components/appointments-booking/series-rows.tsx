"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import type { SeriesDay } from "@/hooks/use-series-availability";
import type { SeriesRow } from "@/lib/agenda/booking/series";
import { rowTimeOptions } from "@/lib/agenda/booking/series-booking";
import { rejectDate, type DateRejection } from "@/lib/agenda/booking/series-edit";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The dates of a weekly series: each row's day, its time (a select over that day's times), its status
// chip and, when it is full or blocked, the planner's "Use … instead". A row's date can be changed
// (past days are greyed in the calendar; a Sunday or another row's date is refused with the reason),
// and a row can be dropped.

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
  onDate,
  onSuggestion,
  onDrop,
  optionHint,
}: {
  rows: SeriesRow[];
  days: Record<string, SeriesDay>;
  /** Existing sessions / holidays still loading: every row is still being checked. */
  checking: boolean;
  disabled: boolean;
  canDrop: boolean;
  onTime: (index: number, time: string) => void;
  /** Row `index` takes `date` (already checked: not past, not Sunday, not another row's). */
  onDate: (index: number, date: string) => void;
  onSuggestion: (index: number, s: { date: string; time: string }) => void;
  onDrop: (index: number) => void;
  /** Replaces the "N left" text after each hour (the patient desk's train shows its end time). */
  optionHint?: (date: string, time: string) => string | null;
}) {
  const t = useTranslations("appointmentsBooking.series");
  const tDay = useTranslations("appointmentsBooking.day");
  const dayLabel = useDayLabel();
  const [refused, setRefused] = React.useState<{ index: number; reason: DateRejection } | null>(null);
  const today = todayPR();

  const pickDate = (index: number, date: string) => {
    if (!date) return;
    const reason = rejectDate(rows, index, date, today);
    setRefused(reason ? { index, reason } : null);
    if (!reason && date !== rows[index]?.date) onDate(index, date);
  };

  return (
    <ol className="divide-y rounded-xl border bg-card" aria-label={t("dates")}>
      {rows.map((r, i) => {
        const day = days[r.date];
        const loading = checking || day === undefined;
        const failed = day === "error";
        const options = rowTimeOptions(day === "error" ? null : day, r.time);
        const blocked = !loading && !failed && r.status === "blocked";
        // Free is the normal case: a quiet green dot. Only what needs a look gets a coloured pill.
        const chip = loading
          ? { label: t("checking"), tone: "text-muted-foreground" }
          : failed
            ? { label: t("checkFailed"), tone: "bg-destructive/10 text-destructive" }
            : r.status === "free"
              ? { label: t("statusFree"), tone: "text-success-foreground", dot: true }
              : r.status === "full"
                ? { label: t("statusFull"), tone: "bg-warning text-warning-foreground" }
                : {
                    label: t(
                      r.reason === "holiday"
                        ? "statusHoliday"
                        : r.reason === "duplicate"
                          ? "statusDuplicate"
                          : r.reason === "cancelled"
                            ? "statusCancelled"
                            : "statusClosed",
                    ),
                    tone: "bg-destructive/10 text-destructive",
                  };
        const s = !loading && !failed ? r.suggestion : null;
        return (
          <li
            key={`${r.index}|${r.date}`}
            className={cn("flex flex-col gap-1 px-3 py-1.5 text-sm", (blocked || failed) && "bg-destructive/5")}
          >
            {/* One line per date: number, day (opens the calendar), time, status, drop. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{i + 1}</span>
              <DatePicker
                variant="button"
                displayFormat="dayWeekdayShort"
                value={r.date}
                onChange={(d) => pickDate(r.index, d)}
                min={today}
                disabled={disabled}
                aria-label={t("changeDate", { date: dayLabel(r.date) })}
                title={t("changeDate", { date: dayLabel(r.date) })}
                className="h-8 w-36 border-transparent bg-transparent px-2 font-medium shadow-none hover:border-input hover:bg-muted/50"
              />
              <Select value={r.time} onValueChange={(v) => onTime(r.index, v)} disabled={disabled || loading}>
                <SelectTrigger
                  size="sm"
                  aria-label={t("time")}
                  className="w-40 border-transparent bg-transparent tabular-nums shadow-none hover:border-input hover:bg-muted/50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.time} value={o.time} disabled={o.disabled}>
                      {/* Each hour with its free places, like the day panel, so another hour is chosen
                          knowing what is open that day. */}
                      <span className="tabular-nums">{shortTime(o.time)}</span>
                      {!o.disabled && (
                        <span className={cn("text-xs", o.full ? "text-warning-foreground" : "text-muted-foreground")}>
                          {optionHint
                            ? optionHint(r.date, o.time)
                            : o.full
                              ? t("fullShort")
                              : tDay("left", { n: o.free })}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1.5 text-xs font-medium",
                  chip.dot || loading ? "" : "rounded-full px-2 py-0.5",
                  chip.tone,
                )}
              >
                {chip.dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
                {chip.label}
              </span>
              {canDrop && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  aria-label={t("remove")}
                  title={t("remove")}
                  disabled={disabled}
                  onClick={() => {
                    setRefused(null);
                    onDrop(r.index);
                  }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              )}
            </div>
            {refused?.index === r.index && (
              <p role="alert" className="pl-7 text-xs text-destructive">
                {t(refused.reason === "past" ? "datePast" : refused.reason === "sunday" ? "dateSunday" : "dateTaken")}
              </p>
            )}
            {s && (
              <div className="pl-7">
                <Button type="button" size="xs" variant="outline" disabled={disabled} onClick={() => onSuggestion(r.index, s)}>
                  {s.date === r.date
                    ? t("useTimeInstead", { time: shortTime(s.time) })
                    : t("useDateInstead", { date: `${dayLabel(s.date)} · ${shortTime(s.time)}` })}
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
