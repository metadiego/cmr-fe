"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERIODS, type BookingPeriod } from "@/lib/agenda/booking/period";
import { weekDays } from "@/lib/agenda/booking/week";
import type { MonthRef } from "@/lib/agenda/booking/month";
import { parseDayUTC } from "@/lib/format/fecha";

// The calendar's period row, like Google Calendar: ‹ Today › (navigation only: Today jumps to today in
// the current view), the period's title, and on the right the view menu (Day D / Week W / Month M).

const SHORTCUT: Record<BookingPeriod, string> = { day: "D", week: "W", month: "M" };

export function PeriodHeader({
  period,
  month,
  anchor,
  date,
  canGoBack,
  onShift,
  onPeriod,
}: {
  period: BookingPeriod;
  month: MonthRef;
  /** Week view: any day of the shown week. */
  anchor: string;
  /** Day view: the shown day. */
  date: string;
  /** False disables ‹ (Day view never goes before today). */
  canGoBack: boolean;
  /** -1 / +1 period, or 0 for today. */
  onShift: (delta: -1 | 0 | 1) => void;
  onPeriod: (p: BookingPeriod) => void;
}) {
  const t = useTranslations("appointmentsBooking.period");
  const tt = useTranslations("appointmentsBooking.toolbar");
  const format = useFormatter();

  let title = "";
  if (period === "month") {
    const d = parseDayUTC(`${month.year}-${String(month.month0 + 1).padStart(2, "0")}-01`);
    title = d ? format.dateTime(d, "monthYear") : "";
  } else if (period === "week") {
    const days = weekDays(anchor);
    const a = parseDayUTC(days[0]);
    const b = parseDayUTC(days[5]);
    title = a && b ? format.dateTimeRange(a, b, "dayMonthYear") : "";
  } else {
    const d = parseDayUTC(date);
    title = d ? format.dateTime(d, "dayWeekdayLong") : "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="period-header">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onShift(-1)}
          disabled={!canGoBack}
          aria-label={t(`prev.${period}`)}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onShift(0)}>
          {tt("today")}
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => onShift(1)} aria-label={t(`next.${period}`)}>
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
        </Button>
      </div>
      <h2 className="text-base font-semibold first-letter:uppercase">{title}</h2>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="ml-auto" aria-label={t("menuLabel")}>
            {t(`views.${period}`)}
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 min-w-44">
          <DropdownMenuRadioGroup value={period} onValueChange={(v) => onPeriod(v as BookingPeriod)}>
            {PERIODS.map((p) => (
              <DropdownMenuRadioItem key={p} value={p}>
                {t(`views.${p}`)}
                <DropdownMenuShortcut>{SHORTCUT[p]}</DropdownMenuShortcut>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
