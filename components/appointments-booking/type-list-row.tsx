"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { useNextOpening } from "@/hooks/use-next-opening";
import type { BookingType } from "@/hooks/use-booking-types";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import { NEXT_OPENING_DAYS } from "@/lib/agenda/booking/type-list";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// One row of "What are we booking?": a thin colour bar (accent only), the name, a meta line (duration
// and "with doctor" for medical types, "N sessions left" for a patient's package) and, on the right, the
// next free time. The next free time is asked only once the row is on screen (IntersectionObserver).

export function TypeListRow({
  type,
  center,
  holidays,
  sessionsLeft,
  onPick,
}: {
  type: BookingType;
  center: string | undefined;
  holidays: string[] | null;
  sessionsLeft: number;
  onPick: (kind: BookingKind, typeId: string) => void;
}) {
  const t = useTranslations("appointmentsBooking.typePicker");
  const format = useFormatter();

  // Seen once = stays enabled: scrolling away does not drop a scan that is already under way.
  const ref = React.useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  const next = useNextOpening({ center, kind: type.kind, typeId: type.id, holidays, enabled: seen });
  const notConfigured = next.state === "notConfigured";

  const meta: string[] = [];
  if (type.durationMinutes) meta.push(t("minutes", { n: type.durationMinutes }));
  if (type.kind === "medical" && type.requiresDoctor) meta.push(t("withDoctor"));

  let nextLabel: React.ReactNode;
  if (next.state === "found") {
    const d = parseDayUTC(next.date);
    const day = next.date === todayPR() ? t("today") : d ? format.dateTime(d, "dayWeekdayNum") : next.date;
    nextLabel = (
      <span className="font-semibold text-success-foreground first-letter:uppercase">
        {day} · {shortTime(next.time)}
      </span>
    );
  } else if (next.state === "idle" || next.state === "loading") {
    nextLabel = <span className="ml-auto block h-4 w-16 animate-pulse rounded bg-muted" aria-label={t("checking")} />;
  } else {
    const title =
      next.state === "none"
        ? next.early
          ? t("noneBookable", { days: next.scanned })
          : t("noneSoon", { days: next.scanned || NEXT_OPENING_DAYS })
        : next.state === "error"
          ? t("nextFailed")
          : undefined;
    nextLabel = (
      <span className="text-muted-foreground" title={title} aria-label={title}>
        —
      </span>
    );
  }

  return (
    <li>
      <button
        ref={ref}
        type="button"
        data-type-row
        onClick={() => onPick(type.kind, type.id)}
        className={cn(
          "grid w-full grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left",
          "hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          notConfigured && "opacity-60",
        )}
      >
        <span
          className="h-full min-h-8 w-1 rounded-full bg-muted-foreground/40"
          style={type.color ? { backgroundColor: type.color } : undefined}
          aria-hidden
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{type.name}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {notConfigured ? <span>{t("notSetUp")}</span> : meta.length > 0 && <span>{meta.join(" · ")}</span>}
            {sessionsLeft > 0 && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 font-medium text-success-foreground">
                {t("sessionsLeft", { n: sessionsLeft })}
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-col items-end text-right text-xs">
          <span className="text-muted-foreground">{t("nextFree")}</span>
          {nextLabel}
        </span>
      </button>
    </li>
  );
}
