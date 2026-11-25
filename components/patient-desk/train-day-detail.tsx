"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import type { PatientTrain } from "@/lib/api/resources";
import type { SeriesRow } from "@/lib/agenda/booking/series";
import { sameDaySessions, trainSchedule } from "@/lib/agenda/booking/train-rows";
import { closingOf, type SlotWhy } from "@/lib/agenda/booking/train-why";
import type { ExistingSession } from "@/hooks/use-train-series-availability";
import { cn } from "@/lib/utils";

// The timetable under one date of the patient desk's therapy form: one line per therapy with the start
// and end the BE planned and its minutes (the row above shows when the patient leaves), in a quiet inset
// box. A therapy the patient already has that day is marked on its own line, red, with the time and
// status of what is booked, so it can be taken off right there. Each therapy can be taken off that date
// (never the last one; the ✕ shows on hover from sm up) and put back from the chips below.

const STATUS_KEYS = ["pendiente", "presente", "en_terapia", "asistido"] as const;
const SHORT_REASONS: Record<string, "whyFull" | "whyNoStaff" | "whyOverMax" | "whyHoliday"> = {
  "therapies.full": "whyFull",
  "therapies.noStaff": "whyNoStaff",
  "therapies.overMaxPerPatient": "whyOverMax",
  "therapies.holiday": "whyHoliday",
};

/**
 * One short line for an arrival hour, from the BE's plan: when the patient leaves if it is free, else
 * which therapy does not fit and why (room full, no staff, over the per-patient limit, holiday), or by
 * how many minutes the visit ends after closing. Overbookable hours start with «sobrecupo».
 */
export function useWhyText(serviceName: (id: string) => string): (why: SlotWhy, train: PatientTrain | undefined) => string {
  const t = useTranslations("therapyBooking");
  return (why, train) => {
    if (why.kind === "free") return why.endsAt ? t("leaves", { time: shortTime(why.endsAt) }) : t("free");
    const therapy = why.serviceId ? serviceName(why.serviceId) : t("theVisit");
    const closing = closingOf(train);
    const short =
      why.lateBy !== null && why.endsAt && closing
        ? t("whyPastClosing", { end: shortTime(why.endsAt), n: why.lateBy, closing: shortTime(closing) })
        : SHORT_REASONS[why.reasons[0] ?? ""]
          ? t(SHORT_REASONS[why.reasons[0]], { therapy })
          : t("whyOther", { therapy });
    return why.kind === "overbook" ? `${t("overbookShort")} · ${short}` : short;
  };
}

export function TrainDayDetail({
  row,
  train,
  sessions,
  serviceIds,
  removed,
  serviceName,
  disabled,
  why,
  freeAlt,
  left,
  others,
  onUseTime,
  onRemove,
  onRestore,
}: {
  row: SeriesRow;
  train: PatientTrain | undefined;
  sessions: ExistingSession[];
  /** That day's therapies (tick order). */
  serviceIds: string[];
  /** Ticked therapies taken off that day. */
  removed: string[];
  serviceName: (id: string) => string;
  disabled: boolean;
  /** What the plan says about the row's hour. */
  why: SlotWhy | null;
  /** The nearest free hour that day, to offer when the row's hour does not fit. */
  freeAlt: string | null;
  /** Sessions of each therapy left once this visit is booked (absent while the balance loads). */
  left?: Record<string, number>;
  /** The patient's other appointments that day (another therapy, a medical one), by time. */
  others: { time: string | null; name: string }[];
  onUseTime: (time: string) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const t = useTranslations("therapyBooking");
  const tStatus = useTranslations("therapyBooking.sessionStatus");
  const booked = new Map<string, ExistingSession | { time: string | null; status: string }>();
  for (const s of sameDaySessions(sessions, row.date, serviceIds)) if (!booked.has(s.serviceId)) booked.set(s.serviceId, s);
  const plan = trainSchedule(train, row.time);
  // Without a plan for that hour (closed, holiday) the therapies are still listed, without times.
  const lines = plan
    ? plan.legs
    : serviceIds.map((serviceId) => ({ serviceId, start: null, end: null, minutes: null, parallel: false, together: false }));
  const canRemove = serviceIds.length > 1;
  const whyText = useWhyText(serviceName);
  // The therapy that does not fit at this hour is marked on its line (overbooking or not bookable).
  const stuck = why && why.kind !== "free" ? why : null;

  return (
    <div className="ml-7 flex flex-col gap-1.5">
      <ol
        className="rounded-lg bg-muted/40 px-3 py-1 text-xs tabular-nums dark:bg-muted/25"
        aria-label={t("daySchedule")}
      >
        {lines.map((leg) => {
          const had = booked.get(leg.serviceId);
          const status = had && (STATUS_KEYS as readonly string[]).includes(had.status) ? tStatus(had.status as (typeof STATUS_KEYS)[number]) : null;
          return (
            <li key={leg.serviceId} className="group grid min-h-7 grid-cols-[5.75rem_minmax(0,1fr)_auto_1.5rem] items-center gap-x-3">
              <span className={cn("font-medium", !leg.start && "text-muted-foreground")}>
                {leg.start && leg.end ? `${shortTime(leg.start)} – ${shortTime(leg.end)}` : "—"}
              </span>
              <span className="flex min-w-0 flex-col py-1 leading-tight">
                <span
                  className={cn(
                    "truncate",
                    stuck?.serviceId === leg.serviceId && "font-medium text-warning-foreground",
                    had && "font-medium text-destructive",
                  )}
                >
                  {serviceName(leg.serviceId)}
                  {(leg.parallel || leg.together) && <span className="font-normal text-muted-foreground"> · {t("alongside")}</span>}
                  {left?.[leg.serviceId] !== undefined && (
                    <span className={cn("font-normal", left[leg.serviceId] > 0 ? "text-success-foreground" : "text-warning-foreground")}>
                      {" · "}
                      {left[leg.serviceId] > 0 ? t("left", { n: left[leg.serviceId] }) : t("lastOne")}
                    </span>
                  )}
                </span>
                {had && (
                  <span className="truncate text-[11px] text-destructive/80">
                    {had.time ? t("bookedAt", { time: shortTime(had.time) }) : t("alreadyBooked", { n: 1 })}
                    {status && ` · ${status}`}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">{leg.minutes !== null ? t("minutes", { n: leg.minutes }) : ""}</span>
              {canRemove ? (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className={cn(
                    "text-muted-foreground transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                    had && "text-destructive sm:opacity-100",
                  )}
                  disabled={disabled}
                  aria-label={t("removeFromDay", { therapy: serviceName(leg.serviceId) })}
                  title={t("removeFromDay", { therapy: serviceName(leg.serviceId) })}
                  onClick={() => onRemove(leg.serviceId)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ol>
      {others.length > 0 && (
        <p className="rounded-lg bg-info/60 px-3 py-1.5 text-xs text-info-foreground tabular-nums">
          {t("sameDayOthers", {
            list: others.map((o) => (o.time ? `${shortTime(o.time)} ${o.name}` : o.name)).join(" · "),
          })}
        </p>
      )}
      {stuck && row.reason !== "duplicate" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning/40 px-3 py-2 text-xs text-warning-foreground">
          <span>
            {t(stuck.kind === "overbook" ? "whyOverbook" : "whyBlocked", {
              time: shortTime(row.time),
              reason: whyText({ ...stuck, kind: "blocked" }, train),
            })}
          </span>
          {freeAlt && freeAlt !== row.time && (
            <Button type="button" size="xs" variant="outline" disabled={disabled} onClick={() => onUseTime(freeAlt)}>
              {t("useTime", { time: shortTime(freeAlt) })}
            </Button>
          )}
        </div>
      )}
      {removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t("notThisDay")}</span>
          {removed.map((id) => (
            <Button
              key={id}
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled}
              title={t("restoreToDay", { therapy: serviceName(id) })}
              onClick={() => onRestore(id)}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              {serviceName(id)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
