"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getAvailability } from "@/lib/api/resources";
import { agendarMultiple } from "@/lib/api/frontdesk";
import { buildRecurringPlan, type RecurringPlanItem, type RecurringPlanStatus } from "@/lib/agenda/recurring-plan";
import type { ApiWarning } from "@/lib/api/types";
import { formatFechaSolo } from "@/lib/format/fecha";
import { toastError } from "@/lib/api/errors";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/kit/form-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  onOpenChange: (open: boolean) => void;
  onBooked: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();
  const [startDate, setStartDate] = React.useState(defaultDate);
  const [everyDays, setEveryDays] = React.useState(2);
  const [time, setTime] = React.useState(defaultTime ?? "09:00");
  const [count, setCount] = React.useState(10);
  const [plan, setPlan] = React.useState<RecurringPlanItem[] | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function preview() {
    setPreviewing(true);
    setPlan(null);
    try {
      const items = await buildRecurringPlan(
        {
          serviceId,
          centro,
          areas,
          startDate,
          everyDays: Math.max(1, everyDays),
          preferredTime: time,
          count: Math.max(1, count),
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
    try {
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
      let booked = 0;
      const allWarnings: ApiWarning[] = [];
      for (const [groupTime, fechas] of byTime) {
        const { warnings } = await agendarMultiple({ patientId, serviceId, fechas, time: groupTime }, centro);
        booked += fechas.length;
        allWarnings.push(...warnings);
      }
      mostrarAvisos(allWarnings, tRoot);
      toast.success(t("recurringSummary", { booked, skipped }));
      onBooked();
      onOpenChange(false);
      setPlan(null);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setConfirming(false);
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
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPlan(null); }} />
          </Field>
          <Field label={t("recurringTime")}>
            <Input type="time" value={time} onChange={(e) => { setTime(e.target.value); setPlan(null); }} />
          </Field>
          <Field label={t("recurringEveryLabel")}>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                value={everyDays}
                onChange={(e) => { setEveryDays(Math.max(1, Number(e.target.value) || 1)); setPlan(null); }}
                className="w-16"
              />
              <span className="text-sm text-muted-foreground">{t("recurringDays")}</span>
            </div>
          </Field>
          <Field label={t("recurringCount")}>
            <Input
              type="number"
              min={1}
              value={count}
              onChange={(e) => { setCount(Math.max(1, Number(e.target.value) || 1)); setPlan(null); }}
            />
          </Field>
        </div>

        <Button variant="outline" onClick={preview} disabled={previewing}>
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
