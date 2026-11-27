"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { addDaysToDay, RETURN_SHORTCUTS, skipSundayClient } from "@/lib/agenda/next-appointment";
import { getNextAvailableDate } from "@/lib/api/disponibilidad";
import { getBookingHolidays } from "@/lib/api/festivos";
import { isBlockedBookingDay } from "@/lib/agenda/booking/holidays";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

type ResolvedChip = { date: string; moved: boolean; reason?: string | null };

// "When is the patient back?": 1 week / 2 weeks / 1 month / 3 months chips, counted from today, plus the
// calendar for any other day. Shared by the post-visit modal (Nueva cita) and the "Next appt" cell, so
// both offer the same shortcuts.
//
// Handoff-citas-domingos-y-feriados (27-nov-2026): a candidate that lands on Sunday or a closing
// holiday is resolved to the next OPEN day before the chip ever shows it — not left for the BE to
// silently move on save. With a doctor chosen, `next-available-date` also considers their own
// schedule/absences; with none chosen, the client can only skip Sunday (the BE still corrects the
// rest once a doctor is picked and the appointment is actually saved).
export function ReturnDatePicker({
  value,
  onChange,
  doctorId,
  centro,
  className,
}: {
  value: string;
  onChange: (day: string) => void;
  doctorId?: string;
  centro?: string;
  className?: string;
}) {
  const t = useTranslations("nuevaCita");
  const tRoot = useTranslations();
  const format = useFormatter();
  const today = todayPR();

  const candidates = React.useMemo(() => RETURN_SHORTCUTS.map((q) => addDaysToDay(today, q.days)), [today]);
  const key = `${today}|${doctorId ?? ""}|${centro ?? ""}`;
  const { state } = useResource<ResolvedChip[]>(
    () =>
      doctorId
        ? Promise.all(
            candidates.map((c) =>
              getNextAvailableDate(doctorId, c, centro).then(
                (r): ResolvedChip => ({ date: r.date ?? c, moved: r.moved, reason: r.reason }),
              ),
            ),
          )
        : Promise.resolve(candidates.map((c): ResolvedChip => {
            const skipped = skipSundayClient(c);
            return { date: skipped, moved: skipped !== c, reason: skipped !== c ? "sunday" : null };
          })),
    [key],
  );
  const resolved: ResolvedChip[] = state.kind === "ok" ? state.data : candidates.map((c) => ({ date: c, moved: false, reason: null }));

  // Holidays for the calendar's own grid (current year + next, in case a pick spans the new year).
  const years = [...new Set([today.slice(0, 4), addDaysToDay(today, 95).slice(0, 4)])].map(Number);
  const { state: holidaysState } = useResource(
    () => (centro ? getBookingHolidays(years, centro) : Promise.resolve([])),
    [years.join(","), centro],
  );
  const holidaySet = holidaysState.kind === "ok" ? new Set(holidaysState.data) : new Set<string>();
  const excludeDate = (iso: string) => isBlockedBookingDay(iso, holidaySet);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {RETURN_SHORTCUTS.map((q, i) => {
        const chip = resolved[i];
        const active = value === chip.date;
        const movedDay = parseDayUTC(chip.date);
        const movedNote = chip.moved
          ? `${movedDay ? format.dateTime(movedDay, "dayWeekdayShort") : chip.date}${
              chip.reason && tRoot.has(`citas.quickDateReason.${chip.reason}`) ? ` (${tRoot(`citas.quickDateReason.${chip.reason}`)})` : ""
            }`
          : null;
        return (
          <button
            key={q.key}
            type="button"
            onClick={() => onChange(chip.date)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {t(q.key)}
            {movedNote && <span className="ml-1 opacity-80">· {movedNote}</span>}
          </button>
        );
      })}
      <DatePicker value={value} onChange={onChange} className="w-[9.5rem]" min={today} excludeDate={excludeDate} />
    </div>
  );
}
