"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getAvailability } from "@/lib/api/resources";
import { agendarMultiple } from "@/lib/api/frontdesk";
import { buildRecurringPlan, weekdayOf, type RecurringPlanItem, type RecurringPlanStatus } from "@/lib/agenda/recurring-plan";
import type { ApiWarning } from "@/lib/api/types";
import { formatFechaSolo, todayPR, nowTimePR } from "@/lib/format/fecha";
import { toastError } from "@/lib/api/errors";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/kit/form-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// 0=Sunday..6=Saturday, Monday-first display order (L-M-M-J-V-S-D). Labels come from i18n
// (therapyPlanner.weekday*) so English shows M-T-W-T-F-S-S instead of the Spanish letters.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_KEY: Record<number, string> = {
  0: "weekdaySun",
  1: "weekdayMon",
  2: "weekdayTue",
  3: "weekdayWed",
  4: "weekdayThu",
  5: "weekdayFri",
  6: "weekdaySat",
};

// "Schedule a series" — additive, opt-in mode alongside the normal single-date flow (never replaces it,
// never touches its code path). Solves the gap the owner named directly: wiring the BE's bulk endpoint
// (agendar-multiple) BLINDLY — just posting N dates and hoping they land in open slots — would defeat the
// whole point of the resource-aware scheduler already built. Every candidate date/time here is checked
// against real availability (lib/agenda/recurring-plan.ts) before anything is proposed to the user, who
// still confirms before anything is booked.
const STATUS_VARIANT: Record<RecurringPlanStatus, "success" | "warning" | "destructive"> = {
  asRequested: "success",
  adjustedTime: "warning",
  adjustedDate: "warning",
  unresolved: "destructive",
};

export function RecurringBookingModal({
  open,
  serviceId,
  serviceName,
  serviceColor,
  patientId,
  areas,
  centro,
  defaultDate,
  defaultTime,
  existingDates,
  onOpenChange,
  onBooked,
}: {
  open: boolean;
  serviceId: string;
  serviceName: string;
  serviceColor?: string | null;
  patientId: string;
  areas: number;
  centro?: string;
  defaultDate: string;
  defaultTime?: string;
  // Dates this patient already has a pending session of this service on (the caller already has this —
  // it's the same data behind the "Already scheduled" badge) — kept off the table, see recurring-plan.ts.
  existingDates?: string[];
  onOpenChange: (open: boolean) => void;
  onBooked: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();
  // Never before today — the date input's own `min` blocks the picker, this is the belt-and-suspenders
  // floor for whatever value arrives via `defaultDate`. Owner's rule (2026-09-27): no appointment before
  // right now, ever.
  const floor = todayPR();
  const [startDate, setStartDate] = React.useState(defaultDate < floor ? floor : defaultDate);
  const [weekdays, setWeekdays] = React.useState<Set<number>>(() => new Set([weekdayOf(defaultDate < floor ? floor : defaultDate)]));
  const [time, setTime] = React.useState(defaultTime ?? "09:00");
  const [count, setCount] = React.useState(10);
  const [plan, setPlan] = React.useState<RecurringPlanItem[] | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
    setPlan(null);
  }

  async function preview() {
    if (weekdays.size === 0) return;
    setPreviewing(true);
    setPlan(null);
    try {
      const items = await buildRecurringPlan(
        {
          serviceId,
          centro,
          areas,
          startDate,
          weekdays: [...weekdays],
          preferredTime: time,
          count: Math.max(1, count),
          existingDates,
          // Only today's own date gets a floor — buildRecurringPlan applies it exclusively to `startDate`.
          minTimeOnStartDate: startDate === todayPR() ? nowTimePR() : undefined,
        },
        (date, sid, ar, c) => getAvailability({ date, serviceId: sid, areas: ar }, c),
      );
      setPlan(items);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setPreviewing(false);
    }
  }

  function removeItem(index: number) {
    setPlan((p) => (p ? p.filter((i) => i.index !== index) : p));
  }

  async function confirm() {
    if (!plan || confirming) return;
    setConfirming(true);
    const bookable = plan.filter((i) => i.status !== "unresolved");
    const skipped = plan.length - bookable.length;
    // The BE endpoint takes ONE time for ALL its dates — group by exact resolved time so a series that
    // mostly landed on the preferred hour still goes out as one call per distinct time, not one per date.
    const byTime = new Map<string, string[]>();
    for (const item of bookable) {
      const arr = byTime.get(item.time) ?? [];
      arr.push(item.date);
      byTime.set(item.time, arr);
    }
    // Each time-group is its own try/catch: one group failing (network error, 500) must not stop the
    // others from being attempted, and the summary must reflect only what actually got created — not
    // what was merely requested. Found by adversarial review before this shipped (2026-09-26).
    let booked = 0;
    let failedGroups = 0;
    const allWarnings: ApiWarning[] = [];
    for (const [groupTime, fechas] of byTime) {
      try {
        const { warnings } = await agendarMultiple({ patientId, serviceId, fechas, time: groupTime }, centro);
        booked += fechas.length;
        allWarnings.push(...warnings);
      } catch (err) {
        failedGroups++;
        toastError(err, tRoot);
      }
    }
    mostrarAvisos(allWarnings, tRoot);
    if (booked > 0) {
      toast.success(t("recurringSummary", { booked, skipped }));
      onBooked();
    }
    setConfirming(false);
    // Only close/reset on full success — a failed group leaves the plan visible so staff can see exactly
    // what still needs a retry instead of a modal that vanished on a partial success.
    if (failedGroups === 0) {
      onOpenChange(false);
      setPlan(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {serviceColor && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: serviceColor }} />}
            {t("recurringTitle", { service: serviceName })}
          </DialogTitle>
          <DialogDescription>{t("recurringHelp")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("recurringStartDate")}>
            <Input
              type="date"
              min={floor}
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value < floor ? floor : e.target.value); setPlan(null); }}
            />
          </Field>
          <Field label={t("recurringTime")}>
            <Input type="time" value={time} onChange={(e) => { setTime(e.target.value); setPlan(null); }} />
          </Field>
          <div className="col-span-2 space-y-1.5">
            <Field label={t("recurringWeekdays")}>
              <div className="flex gap-1">
                {WEEKDAY_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleWeekday(d)}
                    aria-pressed={weekdays.has(d)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                      weekdays.has(d)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                  >
                    {t(WEEKDAY_KEY[d])}
                  </button>
                ))}
              </div>
            </Field>
            {weekdays.size === 0 && <p className="text-xs text-destructive">{t("recurringPickAWeekday")}</p>}
          </div>
          <Field label={t("recurringCount")}>
            <Input
              type="number"
              min={1}
              value={count}
              onChange={(e) => { setCount(Math.max(1, Number(e.target.value) || 1)); setPlan(null); }}
            />
            {/* Sessions are DAYS, not raw calendar time: 12 sessions on Mon/Wed/Fri (3 days/week) is
                exactly 4 weeks — owner's framing (2026-09-27), shown live as the two inputs change. */}
            {weekdays.size > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("recurringWeeksApprox", { n: Math.ceil(count / weekdays.size) })}
              </p>
            )}
          </Field>
        </div>

        <Button variant="outline" onClick={preview} disabled={previewing || weekdays.size === 0}>
          {previewing ? t("recurringPreviewing") : t("recurringPreview")}
        </Button>

        {plan && (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {plan.map((item) => (
              <div key={item.index} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-accent/50">
                <span className="font-mono tabular-nums">
                  {formatFechaSolo(item.date)} {item.time}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[item.status]}>
                    {item.status === "asRequested" && t("recurringAsRequested")}
                    {item.status === "adjustedTime" && t("recurringAdjustedTime")}
                    {item.status === "adjustedDate" && t("recurringAdjustedDate")}
                    {item.status === "unresolved" && t("recurringUnresolved")}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => removeItem(item.index)}
                    className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                  >
                    {t("recurringRemove")}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {tRoot("common.cancel")}
          </Button>
          <Button onClick={confirm} disabled={!plan || plan.length === 0 || confirming}>
            {confirming ? t("recurringConfirming") : t("recurringConfirm", { n: plan?.filter((i) => i.status !== "unresolved").length ?? 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
