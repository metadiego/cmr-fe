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
import { Field } from "@/components/kit/form-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// «Programar una serie del tren» — el tren ENTERO en varios días de un tirón, no una terapia suelta
// (handoff .personal/handoff-tren-en-serie.md, BE PR #520). A diferencia de RecurringBookingModal (que
// arma el plan en el cliente contra `getAvailability`), aquí el BE hace TODO el cálculo
// (`POST /resources/train-series`): el FE solo pinta `days[]` y, si el usuario confirma, manda esos
// mismos días tal cual a `POST /frontdesk/sessions/book-train-series`. Todo o nada, como el resto del tren.

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

  const [startDate, setStartDate] = React.useState(defaultDate < floor ? floor : defaultDate);
  const [weekdays, setWeekdays] = React.useState<Set<number>>(() => new Set([weekdayOf(defaultDate < floor ? floor : defaultDate)]));
  const [preferredTime, setPreferredTime] = React.useState(defaultTime ?? "09:00");
  const [until, setUntil] = React.useState("");
  const [maxDays, setMaxDays] = React.useState("");
  const [sessionsInput, setSessionsInput] = React.useState<Record<string, string>>({});
  const [missingIds, setMissingIds] = React.useState<Set<string>>(new Set());
  const [plan, setPlan] = React.useState<TrainSeriesPlan | null>(null);
  const [calculating, setCalculating] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  // Igual que RecurringBookingModal: se carga fresco al abrir, no en cada tecla.
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
    setPlan(null);
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

  function reasonText(day: TrainSeriesDay): string {
    const base = day.reasonKey && tRoot.has(day.reasonKey) ? tRoot(day.reasonKey) : (day.reasonKey ?? "");
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
    if (weekdays.size === 0) return;
    setCalculating(true);
    setMissingIds(new Set());
    try {
      const today = todayPR();
      const effectiveStart = (fromDate ?? startDate) < today ? today : (fromDate ?? startDate);
      const sessions: Record<string, number> = {};
      for (const id of serviceIds) {
        const v = sessionsInput[id]?.trim();
        if (v) sessions[id] = Number(v);
      }
      const data = await planTrainSeries(
        {
          patientId,
          serviceIds,
          areas,
          sessions,
          preferredTime,
          weekdays: [...weekdays],
          startDate: effectiveStart,
          days: maxDays.trim() ? Number(maxDays) : undefined,
          until: until.trim() || undefined,
          keepOrder,
        },
        centro,
      );
      setPlan(data);
      // Rellena lo deducido (comprado y aún no agendado) SOLO donde el usuario no escribió nada —
      // «permitir bajarlo» significa que puede editarlo después, nunca que se le pisa lo que ya puso.
      setSessionsInput((prev) => {
        const next = { ...prev };
        for (const [id, n] of Object.entries(data.counts)) {
          if (!next[id]?.trim()) next[id] = String(n);
        }
        return next;
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "THERAPY_SERIES_COUNT_REQUIRED") {
        const ids = Array.isArray(err.data?.serviceIds) ? (err.data.serviceIds as string[]) : [];
        setMissingIds(new Set(ids));
        const names = ids.map((id) => servById.get(id)?.name ?? id).join(", ");
        toast.error(names ? `${tRoot("therapies.seriesCountRequired")}: ${names}` : tRoot("therapies.seriesCountRequired"));
      } else {
        toastError(err, tRoot);
      }
    } finally {
      setCalculating(false);
    }
  }

  async function confirmBook() {
    if (!plan || confirming) return;
    const planned = plan.days.filter((d): d is TrainSeriesDay & { time: string } => d.status === "planned" && !!d.time);
    if (planned.length === 0) return;
    setConfirming(true);
    try {
      const { data, warnings } = await bookTrainSeries(
        { patientId, areas, keepOrder, days: planned.map((d) => ({ date: d.date, time: d.time, serviceIds: d.serviceIds })) },
        centro,
      );
      mostrarAvisos(warnings, tRoot);
      toast.success(t("trainSeriesBooked", { n: data.booked, days: data.days.length }));
      onBooked();
      onOpenChange(false);
      setPlan(null);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "THERAPY_SERIES_DAY_DOES_NOT_FIT" || err.code === "FRONTDESK_SESSION_SAME_DAY" || err.code === "SHEET_SLOT_TAKEN")) {
        const date = typeof err.data?.date === "string" ? err.data.date : undefined;
        const reasonKey = typeof err.data?.reasonKey === "string" ? err.data.reasonKey : undefined;
        const serviceId = typeof err.data?.serviceId === "string" ? err.data.serviceId : undefined;
        const service = serviceId ? servById.get(serviceId)?.name : undefined;
        const reason = reasonKey && tRoot.has(reasonKey) ? tRoot(reasonKey) : apiLabel(err, tRoot);
        const base = service ? t("trainBlockedBy", { reason, service }) : reason;
        toast.error(date ? `${date} — ${base}` : base);
      } else if (err instanceof ApiError && err.code === "THERAPY_TRAIN_ROLLBACK_INCOMPLETE") {
        const date = typeof err.data?.date === "string" ? err.data.date : "";
        const cause = typeof err.data?.cause === "string" ? err.data.cause : "";
        toast.error(`${tRoot("therapies.trainRollbackIncomplete")} (${date} — ${cause})`, { duration: Infinity });
      } else {
        toastError(err, tRoot);
      }
    } finally {
      setConfirming(false);
    }
  }

  const plannedCount = plan?.days.filter((d) => d.status === "planned").length ?? 0;
  const unmetEntries = plan ? Object.entries(plan.unmet).filter(([, n]) => n > 0) : [];
  const lastDay = plan?.days.at(-1)?.date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("trainSeriesTitle", { patient: patientName })}</DialogTitle>
          <DialogDescription>{t("recurringHelp")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("recurringStartDate")}>
            <DatePicker min={floor} value={startDate} onChange={(v) => { setStartDate(v < floor ? floor : v); setPlan(null); }} />
          </Field>
          <Field label={t("recurringTime")}>
            <TimePicker value={preferredTime} onChange={(v) => { setPreferredTime(v); setPlan(null); }} />
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
                      weekdays.has(d) ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                  >
                    {t(WEEKDAY_KEY[d])}
                  </button>
                ))}
              </div>
            </Field>
            {weekdays.size === 0 && <p className="text-xs text-destructive">{t("recurringPickAWeekday")}</p>}
          </div>
          <Field label={t("trainSeriesUntil")}>
            <DatePicker min={startDate} value={until} onChange={(v) => { setUntil(v); setPlan(null); }} clearable />
          </Field>
          <Field label={t("trainSeriesMaxDays")}>
            <Input type="number" min={1} max={36} value={maxDays} onChange={(e) => { setMaxDays(e.target.value); setPlan(null); }} />
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
                  value={sessionsInput[id] ?? ""}
                  onChange={(e) => { setSessionsInput((v) => ({ ...v, [id]: e.target.value })); setPlan(null); }}
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
        <Field label={t("maxShift")}>
          <Input
            type="number"
            min={0}
            value={maxShiftInput}
            onChange={(e) => setMaxShiftInput(e.target.value)}
            onBlur={() => saveConfig({ maxShiftMinutes: maxShiftInput.trim() ? Number(maxShiftInput) : null })}
            className="w-40"
          />
        </Field>

        <Button variant="outline" onClick={() => calculate()} disabled={calculating || weekdays.size === 0}>
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
              <Button type="button" variant="outline" size="sm" onClick={() => { setStartDate(addDays(lastDay, 1)); calculate(addDays(lastDay, 1)); }}>
                {t("trainSeriesContinue")}
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>{tRoot("common.cancel")}</Button>
          <Button onClick={confirmBook} disabled={!plan || plannedCount === 0 || confirming}>
            {confirming ? t("recurringConfirming") : t("trainSeriesConfirmButton", { days: plannedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function apiLabel(err: ApiError, t: { has: (k: string) => boolean } & ((k: string) => string)): string {
  if (err.labelKey && t.has(err.labelKey)) return t(err.labelKey);
  return err.message;
}
