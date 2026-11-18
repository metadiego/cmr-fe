"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getAvailability, getRecurringBookingConfig, setRecurringBookingConfig } from "@/lib/api/resources";
import { agendarMultiple } from "@/lib/api/frontdesk";
import { buildRecurringPlan, weekdayOf, type RecurringPlanItem, type RecurringPlanStatus } from "@/lib/agenda/recurring-plan";
import type { ApiWarning } from "@/lib/api/types";
import { formatFechaSolo, todayPR, nowTimePR } from "@/lib/format/fecha";
import { noSeatDays } from "@/lib/agenda/sheet";
import { toastError } from "@/lib/api/errors";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FormDialog } from "@/components/kit/form-dialog";
import { Field } from "@/components/kit/field";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";
import {
  recurringBookingBlock,
  recurringBookingMissing,
  type RecurringBookingBlock,
  type RecurringBookingField,
} from "@/lib/agenda/recurring-booking-missing";

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

/** Some time-groups failed: each already showed its own error toast, so useSubmit adds none. */
class SeriesPartlyFailed extends Error {}

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
  // Per-center preference (GET /resources/recurring-booking-config): does the planner prefer a
  // same-or-later time over the closest one in either direction? Loaded fresh each time the modal
  // opens (not on every keystroke) and editable right here — no separate settings screen needed for
  // one switch. See docs/specs/reversas-de-la-serie-solo-hacia-adelante.md.
  const [preferForwardTime, setPreferForwardTime] = React.useState(true);
  const [savingPreference, setSavingPreference] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    getRecurringBookingConfig(centro)
      .then((c) => setPreferForwardTime(c.preferForwardTime))
      .catch(() => {}); // Best-effort: the default (true) already matches the fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function togglePreferForward(next: boolean) {
    setPreferForwardTime(next); // Optimistic: the toggle should feel instant.
    setSavingPreference(true);
    try {
      await setRecurringBookingConfig({ preferForwardTime: next }, centro);
    } catch (err) {
      setPreferForwardTime(!next); // Revert on failure — never claim a preference that didn't save.
      toastError(err, tRoot);
    } finally {
      setSavingPreference(false);
    }
    setPlan(null); // The existing preview no longer reflects the new preference.
  }

  function toggleWeekday(d: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
    setPlan(null);
  }

  // The parent mounts this dialog only while it is open, so every open starts from a clean form.
  const missingKeys = recurringBookingMissing({ startDate, time, weekdayCount: weekdays.size });
  const fieldLabel: Record<RecurringBookingField, string> = {
    startDate: t("recurringStartDate"),
    time: t("recurringTime"),
    weekdays: t("recurringWeekdays"),
  };
  const missing = missingKeys.map((f) => fieldLabel[f]);
  const block = recurringBookingBlock(plan);
  const blockReason: Record<RecurringBookingBlock, string> = {
    noPreview: t("recurringPreviewFirst"),
    nothingBookable: t("recurringNothingBookable"),
  };
  const bookableCount = plan?.filter((i) => i.status !== "unresolved").length ?? 0;

  async function preview() {
    setPreviewing(true);
    setPlan(null);
    try {
      // Re-floor against a FRESH "today", not the `startDate` state value: if this modal was left open
      // across midnight without anyone touching the date field, `startDate` (set once at mount/on-change)
      // would otherwise silently read as yesterday relative to the real clock, skipping the minTime floor
      // for a date that's actually in the past. Found by adversarial review (2026-09-27).
      const today = todayPR();
      const effectiveStart = startDate < today ? today : startDate;
      const items = await buildRecurringPlan(
        {
          serviceId,
          centro,
          areas,
          startDate: effectiveStart,
          weekdays: [...weekdays],
          preferredTime: time,
          count: Math.max(1, count),
          existingDates,
          // Only today's own date gets a floor — buildRecurringPlan applies it exclusively to `startDate`.
          minTimeOnStartDate: effectiveStart === today ? nowTimePR() : undefined,
          preferForwardTime,
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

  // Books the previewed series. The button is blocked until a preview has a bookable date, so the throw
  // is only a backstop.
  async function bookSeries() {
    if (!plan) throw new Error(t("recurringPreviewFirst"));
    const bookable = plan.filter((i) => i.status !== "unresolved");
    if (bookable.length === 0) throw new Error(t("recurringNothingBookable"));
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
    const noSeat: string[] = []; // days the call-center sheet had no seat for (BE #521)
    for (const [groupTime, dates] of byTime) {
      try {
        const { data, warnings, advertencias } = await agendarMultiple({ patientId, serviceId, dates, time: groupTime }, centro);
        noSeat.push(...noSeatDays(data));
        booked += dates.length;
        allWarnings.push(...warnings, ...advertencias); // BE #547: regla no bloqueante avisada tras guardar
      } catch (err) {
        failedGroups++;
        toastError(err, tRoot);
      }
    }
    mostrarAvisos(allWarnings, tRoot);
    if (noSeat.length) toast.warning(tRoot("sheet.noSeatDays", { days: [...new Set(noSeat)].sort().map((d) => formatFechaSolo(d)).join(", ") }), { duration: 10000 });
    if (booked > 0) {
      toast.success(t("recurringSummary", { booked, skipped }));
      onBooked();
    }
    // Only close on full success — a failed group leaves the plan visible so staff can see exactly what
    // still needs a retry instead of a modal that vanished on a partial success.
    if (failedGroups > 0) throw new SeriesPartlyFailed();
  }

  const { submitting, submit } = useSubmit(bookSeries, {
    onSuccess: () => onOpenChange(false),
    onError: (err) => err instanceof SeriesPartlyFailed,
  });

  // Booking many appointments at once is outward: only the button books, never Enter.
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t("recurringTitle", { service: serviceName })}
      description={t("recurringHelp")}
      missing={missing}
      blocked={block !== null}
      reason={block ? blockReason[block] : null}
      submitting={submitting}
      submittingLabel={t("recurringConfirming")}
      onSubmit={() => {}}
      actions={[{ label: t("recurringConfirm", { n: bookableCount }), onClick: () => submit() }]}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {serviceColor && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: serviceColor }} />}
          <span className="truncate">{serviceName}</span>
        </span>
        <RequiredLegend />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("recurringStartDate")} htmlFor="recurring-start-date" required>
          <DatePicker
            id="recurring-start-date"
            min={floor}
            value={startDate}
            onChange={(v) => { setStartDate(v < floor ? floor : v); setPlan(null); }}
          />
        </Field>
        <Field label={t("recurringTime")} htmlFor="recurring-time" required>
          <TimePicker id="recurring-time" value={time} onChange={(v) => { setTime(v); setPlan(null); }} />
        </Field>
        <Field
          className="col-span-2"
          label={t("recurringWeekdays")}
          required
          error={weekdays.size === 0 ? t("recurringPickAWeekday") : null}
        >
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
        {/* Sessions are DAYS, not raw calendar time: 12 sessions on Mon/Wed/Fri (3 days/week) is
            exactly 4 weeks — owner's framing (2026-09-27), shown live as the two inputs change. */}
        <Field
          label={t("recurringCount")}
          htmlFor="recurring-count"
          hint={weekdays.size > 0 ? t("recurringWeeksApprox", { n: Math.ceil(count / weekdays.size) }) : undefined}
        >
          <Input
            id="recurring-count"
            type="number"
            min={1}
            value={count}
            onChange={(e) => { setCount(Math.max(1, Number(e.target.value) || 1)); setPlan(null); }}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t("recurringPreferForward")}</p>
          <p className="text-xs text-muted-foreground">{t("recurringPreferForwardHelp")}</p>
        </div>
        <Switch
          checked={preferForwardTime}
          onCheckedChange={togglePreferForward}
          disabled={savingPreference}
        />
      </div>

      <Button variant="outline" onClick={preview} disabled={previewing || missing.length > 0}>
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
    </FormDialog>
  );
}
