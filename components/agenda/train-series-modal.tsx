"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  bookTrainSeries,
  getRecurringBookingConfig,
  planTrainSeries,
  setRecurringBookingConfig,
  type TrainSeriesDay,
  type TrainSeriesPlan,
} from "@/lib/api/resources";
import { type Servicio } from "@/lib/api/servicios";
import { addDays, weekdayOf } from "@/lib/agenda/recurring-plan";
import { todayPR, parseDayUTC } from "@/lib/format/fecha";
import { toastError } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/types";
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
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import {
  bookableTrainDays,
  trainSeriesBlock,
  trainSeriesMissing,
  type TrainSeriesBlock,
  type TrainSeriesField,
} from "@/lib/agenda/train-series-missing";

// «Schedule a train series» — the WHOLE train over several days in one go, not a single therapy
// (handoff .personal/handoff-tren-en-serie.md, BE PR #520). Unlike RecurringBookingModal (which builds the
// plan on the client against `getAvailability`), here the BE does ALL the calculation
// (`POST /resources/train-series`): the FE only draws `days[]` and, if the user confirms, sends those same
// days as they are to `POST /frontdesk/sessions/book-train-series`. All or nothing, like the rest of the train.

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_KEY: Record<number, string> = {
  0: "weekdaySun", 1: "weekdayMon", 2: "weekdayTue", 3: "weekdayWed", 4: "weekdayThu", 5: "weekdayFri", 6: "weekdaySat",
};

export function TrainSeriesModal({
  open,
  patientId,
  patientName,
  serviceIds,
  servById,
  areas,
  keepOrder,
  centro,
  defaultDate,
  defaultTime,
  onOpenChange,
  onBooked,
}: {
  open: boolean;
  patientId: string;
  patientName: string;
  serviceIds: string[];
  servById: Map<string, Servicio>;
  areas: Record<string, number>;
  keepOrder: boolean;
  centro?: string;
  defaultDate: string;
  defaultTime?: string;
  onOpenChange: (open: boolean) => void;
  onBooked: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();
  const format = useFormatter();
  const floor = todayPR();

  // Clean form on every open (and for another patient): the dialog stays mounted while closed, so a
  // previous calculation or another day's defaults must not come back.
  const [f, update] = useDialogForm(() => {
    const start = defaultDate < floor ? floor : defaultDate;
    return {
      startDate: start,
      weekdays: [weekdayOf(start)] as number[],
      preferredTime: defaultTime ?? "09:00",
      until: "",
      maxDays: "",
      sessions: {} as Record<string, string>,
      missingIds: [] as string[],
      plan: null as TrainSeriesPlan | null,
    };
  }, open, patientId);
  const plan = f.plan;
  const [calculating, setCalculating] = React.useState(false);

  // Same as RecurringBookingModal: loaded fresh on open, not on every keystroke.
  const [preferForwardTime, setPreferForwardTime] = React.useState(true);
  const [maxShiftInput, setMaxShiftInput] = React.useState("");
  const [savingConfig, setSavingConfig] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    getRecurringBookingConfig(centro)
      .then((c) => {
        setPreferForwardTime(c.preferForwardTime);
        setMaxShiftInput(c.maxShiftMinutes != null ? String(c.maxShiftMinutes) : "");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function saveConfig(patch: { preferForwardTime?: boolean; maxShiftMinutes?: number | null }) {
    setSavingConfig(true);
    try {
      await setRecurringBookingConfig(patch, centro);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSavingConfig(false);
    }
    update({ plan: null });
  }

  function toggleWeekday(d: number) {
    update((s) => ({ ...s, weekdays: s.weekdays.includes(d) ? s.weekdays.filter((w) => w !== d) : [...s.weekdays, d], plan: null }));
  }

  const missingKeys = trainSeriesMissing({ startDate: f.startDate, time: f.preferredTime, weekdayCount: f.weekdays.length });
  const fieldLabel: Record<TrainSeriesField, string> = {
    startDate: t("recurringStartDate"),
    time: t("recurringTime"),
    weekdays: t("recurringWeekdays"),
  };
  const missing = missingKeys.map((k) => fieldLabel[k]);
  const block = trainSeriesBlock(plan);
  const blockReason: Record<TrainSeriesBlock, string> = {
    notCalculated: t("trainSeriesCalculateFirst"),
    nothingPlanned: t("trainSeriesNothingPlanned"),
  };

  // BE #547: `reasonKeys` carries every reason (before, only the first one in `reasonKey`).
  function reasonText(day: TrainSeriesDay): string {
    const keys = day.reasonKeys?.length ? day.reasonKeys : day.reasonKey ? [day.reasonKey] : [];
    const base = keys.map((k) => (tRoot.has(k) ? tRoot(k) : k)).join(" · ");
    const service = day.serviceId ? servById.get(day.serviceId)?.name : null;
    return service ? t("trainBlockedBy", { reason: base, service }) : base;
  }

  function legsText(day: TrainSeriesDay): string {
    const parts: string[] = [];
    for (const leg of day.legs ?? []) {
      const name = servById.get(leg.serviceId)?.name ?? leg.serviceId;
      if (leg.parallel && parts.length) parts[parts.length - 1] += ` + ${name}`;
      else parts.push(`${leg.start} ${name}`);
    }
    return parts.join(" · ");
  }

  async function calculate(fromDate?: string) {
    setCalculating(true);
    update({ missingIds: [] });
    try {
      const today = todayPR();
      const effectiveStart = (fromDate ?? f.startDate) < today ? today : (fromDate ?? f.startDate);
      const sessions: Record<string, number> = {};
      for (const id of serviceIds) {
        const v = f.sessions[id]?.trim();
        if (v) sessions[id] = Number(v);
      }
      const data = await planTrainSeries(
        {
          patientId,
          serviceIds,
          areas,
          sessions,
          preferredTime: f.preferredTime,
          weekdays: [...f.weekdays],
          startDate: effectiveStart,
          days: f.maxDays.trim() ? Number(f.maxDays) : undefined,
          until: f.until.trim() || undefined,
          keepOrder,
        },
        centro,
      );
      // Fill in the deduced counts (purchased and not yet booked) ONLY where the user typed nothing —
      // "allow lowering it" means they can edit it afterwards, never that what they typed gets overwritten.
      update((s) => {
        const next = { ...s.sessions };
        for (const [id, n] of Object.entries(data.counts)) {
          if (!next[id]?.trim()) next[id] = String(n);
        }
        return { ...s, plan: data, sessions: next };
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "THERAPY_SERIES_COUNT_REQUIRED") {
        const ids = Array.isArray(err.data?.serviceIds) ? (err.data.serviceIds as string[]) : [];
        update({ missingIds: ids });
        const names = ids.map((id) => servById.get(id)?.name ?? id).join(", ");
        toast.error(names ? `${tRoot("therapies.seriesCountRequired")}: ${names}` : tRoot("therapies.seriesCountRequired"));
      } else {
        toastError(err, tRoot);
      }
    } finally {
      setCalculating(false);
    }
  }

  // Books the calculated days as they are. The button is blocked until a plan has a planned day, so the
  // throw is only a backstop.
  async function bookSeries() {
    const planned = plan ? bookableTrainDays(plan.days) : [];
    if (planned.length === 0) throw new Error(t("trainSeriesCalculateFirst"));
    const { data, warnings, advertencias } = await bookTrainSeries(
      { patientId, areas, keepOrder, days: planned.map((d) => ({ date: d.date, time: d.time, serviceIds: d.serviceIds })) },
      centro,
    );
    mostrarAvisos(warnings, tRoot);
    mostrarAvisos(advertencias, tRoot); // BE #547: non-blocking rule, warned after saving
    toast.success(t("trainSeriesBooked", { n: data.booked, days: data.days.length }));
    onBooked();
  }

  // The day-specific errors get their own toast (which day and why); anything else gets the generic one.
  function bookError(err: unknown): boolean {
    if (err instanceof ApiError && (err.code === "THERAPY_SERIES_DAY_DOES_NOT_FIT" || err.code === "FRONTDESK_SESSION_SAME_DAY" || err.code === "SHEET_SLOT_TAKEN")) {
      const date = typeof err.data?.date === "string" ? err.data.date : undefined;
      const reasonKey = typeof err.data?.reasonKey === "string" ? err.data.reasonKey : undefined;
      const serviceId = typeof err.data?.serviceId === "string" ? err.data.serviceId : undefined;
      const service = serviceId ? servById.get(serviceId)?.name : undefined;
      const reason = reasonKey && tRoot.has(reasonKey) ? tRoot(reasonKey) : apiLabel(err, tRoot);
      const base = service ? t("trainBlockedBy", { reason, service }) : reason;
      toast.error(date ? `${date} — ${base}` : base);
      return true;
    }
    if (err instanceof ApiError && err.code === "THERAPY_TRAIN_ROLLBACK_INCOMPLETE") {
      const date = typeof err.data?.date === "string" ? err.data.date : "";
      const cause = typeof err.data?.cause === "string" ? err.data.cause : "";
      toast.error(`${tRoot("therapies.trainRollbackIncomplete")} (${date} — ${cause})`, { duration: Infinity });
      return true;
    }
    return false;
  }

  const { submitting, submit } = useSubmit(bookSeries, { onSuccess: () => onOpenChange(false), onError: bookError });

  const plannedCount = plan ? bookableTrainDays(plan.days).length : 0;
  const unmetEntries = plan ? Object.entries(plan.unmet).filter(([, n]) => n > 0) : [];
  const lastDay = plan?.days.at(-1)?.date;
  const missingIds = new Set(f.missingIds);

  // Booking a whole series is outward: only the button books, never Enter.
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t("trainSeriesTitle", { patient: patientName })}
      description={t("recurringHelp")}
      missing={missing}
      blocked={block !== null}
      reason={block ? blockReason[block] : null}
      submitting={submitting}
      submittingLabel={t("recurringConfirming")}
      onSubmit={() => {}}
      actions={[{ label: t("trainSeriesConfirmButton", { days: plannedCount }), onClick: () => submit() }]}
    >
      <RequiredLegend />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("recurringStartDate")} htmlFor="train-series-start" required>
          <DatePicker
            id="train-series-start"
            min={floor}
            value={f.startDate}
            onChange={(v) => update({ startDate: v < floor ? floor : v, plan: null })}
          />
        </Field>
        <Field label={t("recurringTime")} htmlFor="train-series-time" required>
          <TimePicker id="train-series-time" value={f.preferredTime} onChange={(v) => update({ preferredTime: v, plan: null })} />
        </Field>
        <Field
          className="col-span-2"
          label={t("recurringWeekdays")}
          required
          error={f.weekdays.length === 0 ? t("recurringPickAWeekday") : null}
        >
          <div className="flex gap-1">
            {WEEKDAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleWeekday(d)}
                aria-pressed={f.weekdays.includes(d)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  f.weekdays.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:border-primary hover:text-primary",
                )}
              >
                {t(WEEKDAY_KEY[d])}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("trainSeriesUntil")} htmlFor="train-series-until">
          <DatePicker id="train-series-until" min={f.startDate} value={f.until} onChange={(v) => update({ until: v, plan: null })} clearable />
        </Field>
        <Field label={t("trainSeriesMaxDays")} htmlFor="train-series-max-days">
          <Input
            id="train-series-max-days"
            type="number"
            min={1}
            max={36}
            value={f.maxDays}
            onChange={(e) => update({ maxDays: e.target.value, plan: null })}
          />
        </Field>
      </div>

      <div className="space-y-1.5 rounded-md border p-3">
        <p className="text-sm font-medium">{t("trainSeriesSessions")}</p>
        {serviceIds.map((id) => {
          const s = servById.get(id);
          return (
            <label key={id} className="flex items-center gap-2 text-sm">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s?.color ?? "#4a90d9" }} />
              <span className="min-w-0 flex-1 truncate">{s?.name ?? id}</span>
              <Input
                type="number"
                min={1}
                placeholder={t("trainSeriesSessionsPlaceholder")}
                value={f.sessions[id] ?? ""}
                onChange={(e) => update((st) => ({ ...st, sessions: { ...st.sessions, [id]: e.target.value }, plan: null }))}
                className={cn("h-8 w-20 text-xs", missingIds.has(id) && "border-destructive")}
              />
              {plan?.countsSource[id] === "availability" && (
                <span className="text-[10px] text-muted-foreground">{t("trainSeriesFromPurchased")}</span>
              )}
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t("recurringPreferForward")}</p>
          <p className="text-xs text-muted-foreground">{t("recurringPreferForwardHelp")}</p>
        </div>
        <Switch
          checked={preferForwardTime}
          onCheckedChange={(v) => { setPreferForwardTime(v); saveConfig({ preferForwardTime: v }); }}
          disabled={savingConfig}
        />
      </div>
      <Field label={t("maxShift")} htmlFor="train-series-max-shift">
        <Input
          id="train-series-max-shift"
          type="number"
          min={0}
          value={maxShiftInput}
          onChange={(e) => setMaxShiftInput(e.target.value)}
          onBlur={() => saveConfig({ maxShiftMinutes: maxShiftInput.trim() ? Number(maxShiftInput) : null })}
          className="w-40"
        />
      </Field>

      <Button variant="outline" onClick={() => calculate()} disabled={calculating || missing.length > 0}>
        {calculating ? t("trainSeriesCalculating") : t("trainSeriesCalculate")}
      </Button>

      {plan && (
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {plan.days.map((day) => {
            const planned = day.status === "planned";
            const dayDate = parseDayUTC(day.date);
            return (
              <div
                key={day.date}
                className={cn("flex items-center justify-between gap-2 rounded px-2 py-1 text-sm", !planned && "text-muted-foreground line-through")}
              >
                <span className="font-mono tabular-nums">
                  {dayDate ? format.dateTime(dayDate, "dayWeekdayShort") : day.date} {planned && day.time}
                </span>
                <span className="flex min-w-0 flex-1 justify-end gap-2 truncate text-right">
                  {planned ? (
                    <>
                      {day.overbooked && <Badge variant="warning">{reasonText(day) || t("trainSeriesOverbooked")}</Badge>}
                      {day.adjusted && (
                        <Badge variant="warning">{t("trainSeriesMoved", { from: day.requestedTime, to: day.time ?? "" })}</Badge>
                      )}
                      <span className="truncate text-xs text-muted-foreground">{legsText(day)}</span>
                    </>
                  ) : (
                    <span className="truncate text-xs">{t("trainSeriesSkipped")} — {reasonText(day)}</span>
                  )}
                </span>
              </div>
            );
          })}
          {unmetEntries.length > 0 && (
            <p className="px-2 py-1 text-xs text-warning-foreground">
              {t("trainSeriesUnmet", { list: unmetEntries.map(([id, n]) => `${servById.get(id)?.name ?? id} ×${n}`).join(", ") })}
            </p>
          )}
          {plan.stoppedBy === "bookingLimit" && lastDay && (
            <Button type="button" variant="outline" size="sm" onClick={() => { update({ startDate: addDays(lastDay, 1) }); calculate(addDays(lastDay, 1)); }}>
              {t("trainSeriesContinue")}
            </Button>
          )}
        </div>
      )}
    </FormDialog>
  );
}

function apiLabel(err: ApiError, t: { has: (k: string) => boolean } & ((k: string) => string)): string {
  if (err.labelKey && t.has(err.labelKey)) return t(err.labelKey);
  return err.message;
}
