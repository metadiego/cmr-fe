"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TimeWindow } from "@/lib/agenda/booking/availability";
import { parseDayUTC } from "@/lib/format/fecha";

// The booking calendar's top rows: "Booking" / "Book for Ana" + the type chip (✕ to change it), the
// time-of-day window, the Free/Booked switch (medical types only) and the "Next free" strip.

export type BookingView = "free" | "booked";

const WINDOWS: { value: TimeWindow; key: "windowAny" | "windowMorning" | "windowAfternoon" }[] = [
  { value: "any", key: "windowAny" },
  { value: "morning", key: "windowMorning" },
  { value: "afternoon", key: "windowAfternoon" },
];

/** "08:00" → "8:00" (24-hour digits carry no language). */
export function shortTime(time: string): string {
  return time.replace(/^0(\d)/, "$1");
}

export function BookingToolbar({
  label,
  typeName,
  color,
  onClearType,
  window,
  onWindow,
  view,
  onView,
  nextFree,
  nextFreeLoading,
  onPickNext,
}: {
  label: string;
  typeName: string;
  color: string | null;
  onClearType: () => void;
  window: TimeWindow;
  onWindow: (w: TimeWindow) => void;
  /** Omit (with onView) to hide the Free/Booked switch: services only offer Free. */
  view?: BookingView;
  onView?: (v: BookingView) => void;
  nextFree: { date: string; time: string }[];
  nextFreeLoading?: boolean;
  onPickNext: (date: string, time: string) => void;
}) {
  const t = useTranslations("appointmentsBooking.toolbar");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-2.5 text-sm">
          <span
            className="size-2.5 rounded-full bg-muted-foreground/40"
            style={color ? { backgroundColor: color } : undefined}
            aria-hidden
          />
          {typeName}
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClearType}
            aria-label={t("changeType")}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
          </Button>
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Tabs value={window} onValueChange={(v) => onWindow(v as TimeWindow)}>
            <TabsList aria-label={t("windowLabel")}>
              {WINDOWS.map((w) => (
                <TabsTrigger key={w.value} value={w.value}>
                  {t(w.key)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {view && onView && (
            <Tabs value={view} onValueChange={(v) => onView(v as BookingView)}>
              <TabsList aria-label={t("viewLabel")}>
                <TabsTrigger value="free">{t("free")}</TabsTrigger>
                <TabsTrigger value="booked">{t("booked")}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("nextFree")}</span>
        {nextFree.map((n) => {
          const d = parseDayUTC(n.date);
          return (
            <Button
              key={`${n.date} ${n.time}`}
              variant="outline"
              size="sm"
              className="border-success-foreground/30 bg-success text-success-foreground hover:bg-success/80"
              onClick={() => onPickNext(n.date, n.time)}
            >
              {d ? format.dateTime(d, "dayWeekdayShort") : n.date} · {shortTime(n.time)}
            </Button>
          );
        })}
        {nextFree.length === 0 && !nextFreeLoading && (
          <span className="text-muted-foreground">{t("noNextFree")}</span>
        )}
      </div>
    </div>
  );
}
