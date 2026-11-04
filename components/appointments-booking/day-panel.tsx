"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { inWindow, type BookingSlot, type TimeWindow } from "@/lib/agenda/booking/availability";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import type { DayResult } from "@/hooks/use-booking-availability";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The selected day's times: Morning and Afternoon groups in a 4-column grid. Open times are green with
// "{n} left"; full ones are dashed grey and still clickable (overbook); unavailable ones are dashed,
// inert, and say why on hover. Below the grid: the "Move here?" box while moving an appointment, or the
// booking form slot (`children`, the service form) once a time is picked. Scrolls inside itself.

export interface DayPanelMoving {
  /** The appointment's current day and time, already formatted ("Thu, Nov 5 · 8:00"). */
  fromLabel: string;
  /** Medical moves need a reason (POST /appointments/:id/reschedule); service moves do not. */
  needsReason: boolean;
  onConfirm: (reason?: string) => Promise<void>;
  onCancel: () => void;
}

export function DayPanel({
  date,
  kind,
  typeName,
  day,
  window,
  picked,
  onPickTime,
  onRetry,
  moving,
  fullDayHref,
  children,
}: {
  date: string | undefined;
  kind: BookingKind;
  typeName: string;
  day: DayResult | undefined;
  window: TimeWindow;
  picked: string | null;
  onPickTime: (time: string) => void;
  onRetry: () => void;
  moving?: DayPanelMoving;
  fullDayHref: string | undefined;
  /** The booking form slot, shown under the grid once a time is picked (not while moving). */
  children?: React.ReactNode;
}) {
  const t = useTranslations("appointmentsBooking.day");
  const tb = useTranslations("appointmentsBooking");
  const format = useFormatter();
  const d = date ? parseDayUTC(date) : null;

  if (!date || !d) {
    return (
      <aside className="flex min-h-0 flex-col" data-slot="day-panel">
        <EmptyState title={t("pickDay")} className="flex-1" />
      </aside>
    );
  }

  const slots = day && day !== "error" ? day.slots.filter((s) => inWindow(s.time, window)) : [];
  const morning = slots.filter((s) => inWindow(s.time, "morning"));
  const afternoon = slots.filter((s) => inWindow(s.time, "afternoon"));
  const pickedSlot = picked ? slots.find((s) => s.time === picked) : undefined;

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1" data-slot="day-panel">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold first-letter:uppercase">
          {format.dateTime(d, "dayWeekdayLong")}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{typeName}</span>
          {fullDayHref && (
            <Link
              href={fullDayHref}
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-medium text-primary hover:underline"
            >
              {t("openFullDay")}
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
            </Link>
          )}
        </div>
      </div>

      {day === undefined ? (
        <p className="text-sm text-muted-foreground">{tb("loading")}</p>
      ) : day === "error" ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          {tb("month.errorRetry")}
          <Button variant="outline" size="xs" onClick={onRetry}>
            {tb("retry")}
          </Button>
        </div>
      ) : day === null ? (
        <EmptyState title={tb("month.notConfigured")} description={tb("month.notConfiguredHint")} />
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noTimes")}</p>
      ) : (
        <>
          {morning.length > 0 && (
            <TimeGroup title={t("morning")} slots={morning} picked={picked} onPick={onPickTime} />
          )}
          {afternoon.length > 0 && (
            <TimeGroup title={t("afternoon")} slots={afternoon} picked={picked} onPick={onPickTime} />
          )}
        </>
      )}

      {picked && moving ? (
        <MoveBox
          key={`${date} ${picked}`}
          moving={moving}
          toLabel={`${format.dateTime(d, "dayWeekdayShort")} · ${shortTime(picked)}`}
          full={pickedSlot?.state === "full"}
        />
      ) : picked && kind === "service" ? (
        children
      ) : null}
    </aside>
  );
}

function TimeGroup({
  title,
  slots,
  picked,
  onPick,
}: {
  title: string;
  slots: BookingSlot[];
  picked: string | null;
  onPick: (time: string) => void;
}) {
  const t = useTranslations("appointmentsBooking.day");
  const tRoot = useTranslations();

  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground uppercase">{title}</h4>
      <div className="grid grid-cols-4 gap-1.5">
        {slots.map((s) => {
          const isPicked = s.time === picked;
          const pickedRing = isPicked && "ring-2 ring-primary ring-offset-1";
          const timeClass = "flex w-full flex-col items-center rounded-md px-1 py-1.5 text-sm";
          if (s.state === "unavailable") {
            const reason = s.reasonKey && tRoot.has(s.reasonKey) ? tRoot(s.reasonKey) : t("unavailable");
            return (
              <Tooltip key={s.time} content={reason} className="flex w-full">
                <span
                  className={cn(timeClass, "border border-dashed text-muted-foreground/60")}
                  aria-disabled
                  aria-label={`${shortTime(s.time)} · ${reason}`}
                >
                  <span className="font-medium tabular-nums">{shortTime(s.time)}</span>
                  <span className="text-[11px]">{t("unavailable")}</span>
                </span>
              </Tooltip>
            );
          }
          if (s.state === "full" || s.free <= 0) {
            return (
              <Tooltip key={s.time} content={t("fullTooltip")} className="flex w-full">
                <button
                  type="button"
                  className={cn(timeClass, "border border-dashed bg-muted/40 text-muted-foreground hover:bg-muted", pickedRing)}
                  aria-pressed={isPicked}
                  onClick={() => onPick(s.time)}
                >
                  <span className="font-medium tabular-nums">{shortTime(s.time)}</span>
                  <span className="text-[11px]">{t("full")}</span>
                </button>
              </Tooltip>
            );
          }
          return (
            <button
              key={s.time}
              type="button"
              className={cn(
                timeClass,
                "border border-success-foreground/20 bg-success text-success-foreground hover:bg-success/70",
                pickedRing,
              )}
              aria-pressed={isPicked}
              onClick={() => onPick(s.time)}
            >
              <span className="font-medium tabular-nums">{shortTime(s.time)}</span>
              <span className="text-[11px]">{t("left", { n: s.free })}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MoveBox({
  moving,
  toLabel,
  full,
}: {
  moving: DayPanelMoving;
  toLabel: string;
  full: boolean;
}) {
  const t = useTranslations("appointmentsBooking.move");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const missingReason = moving.needsReason && reason.trim() === "";

  const confirm = async () => {
    setBusy(true);
    try {
      await moving.onConfirm(moving.needsReason ? reason.trim() : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm dark:border-orange-800 dark:bg-orange-950/40">
      <p className="font-semibold">{t("title")}</p>
      <p>{t("fromTo", { from: moving.fromLabel, to: toLabel })}</p>
      {full && <p className="text-warning-foreground">{t("fullWarning")}</p>}
      {moving.needsReason && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="booking-move-reason">{t("reasonLabel")}</Label>
          <Textarea
            id="booking-move-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            rows={2}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={confirm} disabled={busy || missingReason}>
          {t("confirm")}
        </Button>
        <Button size="sm" variant="ghost" onClick={moving.onCancel} disabled={busy}>
          {t("notThis")}
        </Button>
      </div>
    </div>
  );
}
