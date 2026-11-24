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
import type { ExistingSession } from "@/hooks/use-train-series-availability";

// What goes under one date of the patient desk's therapy form: how that day's train runs, one therapy
// per line with the start and end the BE planned and its minutes (the row above already shows when the
// patient leaves). Each therapy can be taken off that date (never the day's last one) and put back.
// When the day is refused because the patient already has one of its therapies, it first says what
// they already have and at what time, so the clashing one can be taken off.

const STATUS_KEYS = ["pendiente", "presente", "en_terapia", "asistido"] as const;

export function TrainDayDetail({
  row,
  train,
  sessions,
  serviceIds,
  removed,
  serviceName,
  disabled,
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
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const t = useTranslations("therapyBooking");
  const duplicate = row.status === "blocked" && row.reason === "duplicate";
  const had = duplicate ? sameDaySessions(sessions, row.date, serviceIds) : [];
  const plan = trainSchedule(train, row.time);
  // Without a plan for that hour (closed, holiday) the therapies are still listed, without times.
  const lines = plan
    ? plan.legs
    : serviceIds.map((serviceId) => ({ serviceId, start: null, end: null, minutes: null, parallel: false, together: false }));
  const canRemove = serviceIds.length > 1;

  return (
    <div className="ml-7 flex flex-col gap-1">
      {had.length > 0 && (
        <p className="text-xs text-destructive tabular-nums">
          {t("alreadyHas")}{" "}
          {had.map((s, i) => (
            <React.Fragment key={`${s.serviceId}|${s.time}|${i}`}>
              {i > 0 && " · "}
              <span className="font-medium">{serviceName(s.serviceId)}</span>
              {s.time && ` ${shortTime(s.time)}`}
              {(STATUS_KEYS as readonly string[]).includes(s.status) &&
                ` (${t(`sessionStatus.${s.status as (typeof STATUS_KEYS)[number]}`)})`}
            </React.Fragment>
          ))}
        </p>
      )}
      <ol className="max-w-md border-l pl-3 text-xs tabular-nums" aria-label={t("daySchedule")}>
        {lines.map((leg) => (
          <li key={leg.serviceId} className="grid min-h-6 grid-cols-[5.5rem_1fr_auto_1.5rem] items-center gap-x-3">
            <span className="font-medium">{leg.start && leg.end ? `${shortTime(leg.start)} – ${shortTime(leg.end)}` : "—"}</span>
            <span className="min-w-0 truncate">
              {serviceName(leg.serviceId)}
              {(leg.parallel || leg.together) && <span className="text-muted-foreground"> · {t("alongside")}</span>}
            </span>
            <span className="text-muted-foreground">{leg.minutes !== null ? t("minutes", { n: leg.minutes }) : ""}</span>
            {canRemove ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground"
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
        ))}
      </ol>
      {removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-3 text-xs text-muted-foreground">
          <span>{t("removedFromDay")}</span>
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
