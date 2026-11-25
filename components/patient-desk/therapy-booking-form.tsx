"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { SeriesRows, useDayLabel } from "@/components/appointments-booking/series-rows";
import { SeriesFrequency, type SeriesMode } from "@/components/appointments-booking/series-frequency";
import { useBookingResult } from "@/components/appointments-booking/booking-result-provider";
import { type PickableTherapy } from "@/components/patient-desk/therapy-picker-list";
import { StepLabel, TherapyVisitPanel } from "@/components/patient-desk/therapy-visit-panel";
import { TrainDayDetail, useWhyText } from "@/components/patient-desk/train-day-detail";
import { PatientPickerWithCreate } from "@/components/citas/patient-picker-with-create";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { usePatientBookingRules } from "@/hooks/use-patient-booking-rules";
import { useTrainSeriesAvailability } from "@/hooks/use-train-series-availability";
import { buildSeriesRows, canBookSeries } from "@/lib/agenda/booking/series";
import { overridesOf, setRowTime, dropRow, seriesHealth, seriesSpan } from "@/lib/agenda/booking/series-booking";
import {
  addItem,
  fitLoadedTimes,
  fittedTime,
  generateWeeklyPattern,
  nextDate,
  replaceDate,
  type EditableItem,
} from "@/lib/agenda/booking/series-edit";
import { trainBookingResult } from "@/lib/agenda/booking/booking-result";
import { sameDaySessions, trainCap, trainOrder, trainRequest } from "@/lib/agenda/booking/train-rows";
import {
  dayTherapies,
  forgetTherapy,
  moveOff,
  overCapTherapy,
  removeOff,
  restoreOff,
  summaryTrain,
  trainMaxRows,
  type DayOff,
} from "@/lib/agenda/booking/train-days";
import { nearestFree, slotWhy, trainTimeOptions } from "@/lib/agenda/booking/train-why";
import { firstVisitDate, refitRows, seriesKey, trainFormReason, type TrainFormReason } from "@/lib/agenda/booking/train-form";
import type { DaySlots } from "@/lib/agenda/booking/availability";
import { weekdayOf } from "@/lib/agenda/recurring-plan";
import { todayPR } from "@/lib/format/fecha";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { listResources, bookTrain, bookTrainSeries, type Resource } from "@/lib/api/resources";
import { getCentrosDondePuedo, getMyCentros, type Centro } from "@/lib/api/centers";
import { ApiError, type ApiWarning } from "@/lib/api/types";
import { warningText } from "@/lib/frontdesk/avisos";
import { patientName } from "@/lib/pacientes/display-name";
import type { Paciente } from "@/lib/api/pacientes";
import { CONFIRM_PERMISSION, createConfirmed } from "@/lib/lifecycle/confirm-on-create";
import { useCanInCenter } from "@/hooks/use-can-in-center";
import { Switch } from "@/components/ui/switch";

// «Cita de servicio» on the patient desk: the Citas service form (patient, Frecuencia, one row per date,
// the success dialog) with a «Terapias» field where several are ticked. Each visit is the WHOLE train at
// one entry time, planned by the BE (POST /resources/patient-train per row date): one row books with
// book-train, several with book-train-series (all or nothing). Spec:
// docs/specs/2026-11-24-patient-center-therapy-booking-form-design.md

export function TherapyBookingForm({
  patient: givenPatient,
  center,
  defaultDate,
  defaultServiceId,
  onClose,
  onBooked,
}: {
  /** The desk's patient; absent (the header's «Agendar servicio») = picked here, as in Citas. */
  patient?: { id: string; name: string; record?: string | null };
  center: string | undefined;
  defaultDate: string;
  /** Ticked on open when the patient has sessions of it left. */
  defaultServiceId?: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const t = useTranslations("therapyBooking");
  const tSeries = useTranslations("appointmentsBooking.series");
  const tType = useTranslations("appointmentsBooking.typePicker");
  const tRoot = useTranslations();
  const { can, ready: permsReady } = useCan();
  const canBook = can("frontdesk.create");
  const dayLabel = useDayLabel();
  const { show: showResult } = useBookingResult();
  const [picked, setPicked] = React.useState<Paciente | null>(null);
  const patient =
    givenPatient ?? (picked ? { id: picked.id, name: patientName(picked), record: picked.medicalRecordNumber ?? null } : null);

  // ---- Catalogues: names, per-area services, the booking center, the patient's balance.
  const servRes = useResource<Servicio[]>(() => getServicios(center), [center]);
  const resRes = useResource<Resource[]>(() => listResources(center), [center]);
  const centersRes = useResource<Centro[]>(() => getMyCentros());
  const patientCentersRes = useResource<Centro[]>(() => getCentrosDondePuedo("pacientes.read"));
  const patientCenterIds = patientCentersRes.state.kind === "ok" ? patientCentersRes.state.data.map((c) => c.id) : [];
  const rules = usePatientBookingRules(
    patientCentersRes.state.kind === "ok" ? patient?.id : undefined,
    center,
    patientCenterIds,
  );
  const balanceState = patientCentersRes.state.kind === "fail" ? "fail" : rules.bookableState;
  const reloadBalance = patientCentersRes.state.kind === "fail" ? patientCentersRes.reload : rules.reloadBookable;

  const servById = React.useMemo(
    () => new Map((servRes.state.kind === "ok" ? servRes.state.data : []).map((s) => [s.id, s])),
    [servRes.state],
  );
  const perAreaIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (resRes.state.kind === "ok") for (const r of resRes.state.data) for (const s of r.services) if (s.per === "area") ids.add(s.serviceId);
    return ids;
  }, [resRes.state]);
  const serviceName = (id: string) => servById.get(id)?.name ?? "—";
  const whyText = useWhyText(serviceName);

  // ---- What is being booked.
  const [selected, setSelected] = React.useState<string[]>([]);
  const [areas, setAreas] = React.useState<Record<string, number>>({});
  const [keepOrder, setKeepOrder] = React.useState(false);
  // Born confirmed (cmr-be 4a `confirmed` on book-train; the series door takes none): only with
  // appointments.confirm in this center.
  const canConfirmHere = useCanInCenter(CONFIRM_PERMISSION, center);
  const [confirmed, setConfirmed] = React.useState(false);
  // The desk's service starts ticked once the balance says the patient has sessions of it left.
  const [defaultApplied, setDefaultApplied] = React.useState(false);
  if (!defaultApplied && balanceState === "ok" && rules.bookable) {
    setDefaultApplied(true);
    if (defaultServiceId && (rules.bookable.get(defaultServiceId)?.bookable ?? 0) > 0) setSelected([defaultServiceId]);
  }

  // ---- The rows: the Citas series model (generated unless edited for this mode/days/total).
  // The first visit: the desk's day when still to come, else tomorrow (fixed once the form opens).
  const [startDate] = React.useState(() => firstVisitDate(defaultDate, todayPR()));
  const startDay = weekdayOf(startDate);
  const [mode, setMode] = React.useState<SeriesMode>("manual");
  const [days, setDays] = React.useState<number[]>(() => (startDay === 0 ? [] : [startDay]));
  const [totalChoice, setTotalChoice] = React.useState<number | null>(null);
  // The visits start at the smallest balance among the ticked (every therapy on every day) and may go up
  // to the largest: a therapy is then taken off some dates (SÓNICA on 2 of 8 visits).
  const balance = balanceState === "ok" ? rules.bookable : undefined;
  const cap = trainCap(balance, selected);
  const maxRows = Math.max(1, trainMaxRows(balance, selected));
  const total = Math.max(1, Math.min(maxRows, totalChoice ?? cap.max));
  const weekly = mode === "weekly";
  const genKey = seriesKey(mode, days, totalChoice);
  // Hand edits: the rows and the therapies taken off each date (kept per date, see train-days.ts).
  const [edits, setEdits] = React.useState<{ key: string; items: EditableItem[]; off: DayOff } | null>(null);
  const edited = !!edits && edits.key === genKey;
  const off: DayOff = edited ? edits.off : {};
  const therapiesOn = (date: string) => dayTherapies(selected, off, date);
  // Generated rows fit their own day: the series time when the train fits there, else that day's first.
  const baseItems: EditableItem[] = edited
    ? edits.items
    : weekly
      ? generateWeeklyPattern(startDate, days, total).map((i) => ({ ...i, fitTime: true }))
      : [{ date: startDate, fitTime: true }];

  const avail = useTrainSeriesAvailability({
    center,
    patientId: patient?.id,
    rows: selected.length ? baseItems.map((i) => ({ date: i.date, serviceIds: therapiesOn(i.date) })) : [],
    areas,
    keepOrder,
  });
  const loadedDays: Record<string, DaySlots | null> = {};
  for (const [d, v] of Object.entries(avail.days)) if (v !== "error") loadedDays[d] = v;

  // The series time: the one picked, else the first time the whole train fits on the first row's day.
  const [baseTime, setBaseTime] = React.useState("");
  const firstDay = avail.days[baseItems[0]?.date ?? ""];
  const autoTime =
    firstDay && firstDay !== "error" && firstDay.slots.some((s) => s.free > 0) ? fittedTime(firstDay, "00:00") : "";
  if (!baseTime && autoTime) setBaseTime(autoTime);
  const seriesTime = baseTime || autoTime || "09:00";

  const items = fitLoadedTimes(baseItems, avail.days, seriesTime);
  const editItems = (fn: (list: EditableItem[]) => EditableItem[], nextOff: DayOff = off) =>
    setEdits({ key: genKey, items: fn(items), off: nextOff });
  // Another train (therapies, areas, order) re-fits hand-edited rows; generated ones fit on their own.
  const trainChanged = () => {
    const next = refitRows(edited, items);
    if (next) setEdits({ key: genKey, items: next, off });
  };
  // Taking a therapy off one date (or putting it back) is a hand edit of that row.
  const editDayTherapies = (date: string, nextOff: DayOff) =>
    setEdits({ key: genKey, items: refitRows(true, items, date) ?? items, off: nextOff });

  const rowDates = selected.length ? items.map((i) => i.date) : [];
  const rows = buildSeriesRows({
    dates: rowDates,
    time: seriesTime,
    overrides: overridesOf(items),
    days: loadedDays,
    holidays: avail.holidays,
    existingDates: avail.existingDates,
  });
  const rowsLoaded = avail.ready && rowDates.every((d) => avail.days[d] !== undefined);
  const rowsFailed = avail.failed || rowDates.some((d) => avail.days[d] === "error");
  // The summary (visit length, minutes, turns) describes a date with every ticked therapy on it.
  const summary = summaryTrain(
    rows.map((r) => ({ date: r.date, serviceIds: therapiesOn(r.date) })),
    avail.trains,
    selected,
  );
  const firstTrain = summary.train;
  // The order shown is the one booked: yours once reordered, else the BE's (scarcest rooms first).
  const order = keepOrder ? selected : trainOrder(firstTrain, selected);
  const addDate = nextDate(items, 1, todayPR());
  const single = items.length === 1;
  const health = seriesHealth(rows);
  const span = seriesSpan(rows.map((r) => r.date));

  // ---- What blocks «Agendar».
  const missing = [
    ...(patient ? [] : [tSeries("patient")]),
    ...(selected.length ? [] : [t("therapies")]),
  ];
  // Without a patient there is no balance to judge yet: «Paciente» is the missing field, no reason.
  const catalogueFailed = servRes.state.kind === "fail" || resRes.state.kind === "fail";
  const why = !patient ? null : trainFormReason({
    permsReady,
    canBook,
    catalogueFailed,
    balanceHidden: rules.bookableHidden,
    balanceState,
    ticked: selected.length,
    overCap: overCapTherapy(
      items.map((i) => therapiesOn(i.date)),
      balance,
      selected,
    ),
    startsSunday: weekly && startDay === 0,
    rowsLoaded,
    rowsFailed,
    rowsBlocked: !canBookSeries(rows),
  });
  const reason = why ? reasonText(why) : null;
  function reasonText(r: TrainFormReason): string {
    switch (r.key) {
      case "loading":
        return tRoot("common.loading");
      case "noPermission":
        return tSeries("noPermission");
      case "catalogueFailed":
        return t("catalogueFailed");
      case "balanceHidden":
        return tType("noBookablePermission");
      case "balanceFailed":
        return tType("bookableFailed");
      case "checking":
        return tSeries("checking");
      case "overCap":
        return t("overCapDays", { therapy: serviceName(r.therapyId), used: r.used, n: r.left });
      case "dateSunday":
        return tSeries("dateSunday");
      case "checkFailed":
        return tSeries("checkFailed");
      case "fixRed":
        return tSeries("fixRed");
    }
  }

  // ---- Booking.
  const centerInfo = centersRes.state.kind === "ok" ? centersRes.state.data.find((c) => c.id === center) : undefined;
  async function book() {
    if (!patient || !selected.length || reason) throw new Error(reason ?? missing.join(" · "));
    // Each day's own therapies, in the order and with the areas its hours were planned with.
    const { areas: areaMap } = trainRequest(selected, areas, keepOrder);
    const idsOn = (date: string) => trainRequest(therapiesOn(date), areas, keepOrder).serviceIds;
    const timeOf = new Map(rows.map((r) => [r.date, r.time]));
    if (single) {
      const r = rows[0];
      const res = await bookTrain(
        {
          patientId: patient.id, date: r.date, time: r.time, serviceIds: idsOn(r.date), areas: areaMap, keepOrder,
          ...(confirmed ? { confirmed: createConfirmed(true, canConfirmHere) } : {}),
        },
        center,
      );
      return { sessions: res.data.sessions, warnings: [...res.warnings, ...res.advertencias], timeOf };
    }
    const res = await bookTrainSeries(
      { patientId: patient.id, areas: areaMap, keepOrder, days: rows.map((r) => ({ date: r.date, time: r.time, serviceIds: idsOn(r.date) })) },
      center,
    );
    return { sessions: res.data.days.flatMap((d) => d.sessions), warnings: [...res.warnings, ...res.advertencias], timeOf };
  }
  const { submitting, submit } = useSubmit(book, {
    onSuccess: ({ sessions, warnings, timeOf }) => {
      showResult(
        trainBookingResult({
          patient: { name: patient?.name ?? "", record: patient?.record ?? null },
          center: { name: centerInfo?.name ?? "", phone: centerInfo?.phone ?? null, address: centerInfo?.address ?? null },
          sessions: sessions.map((s) => ({ serviceId: s.serviceId, date: String(s.date), time: s.time })),
          serviceName,
          fallbackTime: (date) => timeOf.get(date) ?? seriesTime,
          warnings: warnings.map((w: ApiWarning) => warningText(w, tRoot)),
        }),
      );
      onBooked();
    },
    onError: (err) => {
      if (!(err instanceof ApiError)) return false;
      if (err.code === "THERAPY_SERIES_DAY_DOES_NOT_FIT" || err.code === "THERAPY_TRAIN_DOES_NOT_FIT") {
        const date = typeof err.data?.date === "string" ? err.data.date : null;
        const key = typeof err.data?.reasonKey === "string" ? err.data.reasonKey : null;
        toast.error(
          date ? t("seriesDayFailed", { date: dayLabel(date) }) : key && tRoot.has(key) ? tRoot(key) : tRoot("therapies.trainDoesNotFit"),
        );
        avail.retry();
        return true;
      }
      if (err.code === "THERAPY_TRAIN_ROLLBACK_INCOMPLETE") {
        const left = Array.isArray(err.data?.left) ? (err.data.left as Array<{ serviceId?: string }>) : [];
        const names = left.map((l) => (l.serviceId ? serviceName(l.serviceId) : "")).filter(Boolean);
        toast.error(
          names.length ? `${tRoot("therapies.trainRollbackIncomplete")}: ${names.join(", ")}` : tRoot("therapies.trainRollbackIncomplete"),
          { duration: Infinity },
        );
        avail.retry();
        return true;
      }
      if (err.code === "SHEET_SLOT_TAKEN" || err.code === "FRONTDESK_SESSION_SAME_DAY") avail.retry();
      return false;
    },
  });

  // ---- The list: only therapies with sessions left (the Citas rule), catalogue order.
  const pickable: PickableTherapy[] = [];
  if (balanceState === "ok" && rules.bookable) {
    const legs = new Map((firstTrain?.legs ?? []).map((l) => [l.serviceId, l]));
    for (const s of [...servById.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
      const left = rules.bookable.get(s.id)?.bookable ?? 0;
      if (left <= 0) continue;
      const perArea = perAreaIds.has(s.id);
      const leg = legs.get(s.id);
      // The BE gives a duration only for a planned leg; per-area therapies show it per area.
      const minutes = !leg ? null : perArea && leg.areas > 0 ? Math.round(leg.minutes / leg.areas) : leg.minutes;
      pickable.push({ id: s.id, name: s.name, bookable: left, perArea, minutes });
    }
  }
  const toggle = (id: string) => {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    const next = refitRows(edited, items);
    if (next) setEdits({ key: genKey, items: next, off: forgetTherapy(off, id) });
  };

  const title = t("title");
  const busy = submitting;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="2xl"
      title={title}
      description={givenPatient?.name}
      onSubmit={() => submit()}
      submitLabel={single ? tSeries("book") : t("bookVisits", { n: items.length })}
      submitting={submitting}
      missing={missing}
      blocked={!!reason}
      reason={reason}
      extra={
        single && canConfirmHere ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={confirmed} onCheckedChange={setConfirmed} disabled={busy} />
            {t("bornConfirmed")}
          </label>
        ) : undefined
      }
    >
      {/* Wide screens: the visit (what) in a tinted panel on the left, the dates (when) on the right; one column below lg. */}
      <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Wide screens: the visit stays in view while the dates scroll (its own scroll if taller). */}
        <div className="min-w-0 space-y-4 rounded-xl bg-muted/40 p-4 lg:sticky lg:top-0 lg:max-h-[calc(90dvh-11rem)] lg:self-start lg:overflow-y-auto dark:bg-muted/20">
          <StepLabel n={1}>{t("stepVisit")}</StepLabel>
          {!givenPatient && (
            <Field label={tSeries("patient")} required>
              <PatientPickerWithCreate
                value={picked}
                onChange={(p) => {
                  setPicked(p);
                  setSelected([]);
                  setAreas({});
                  setKeepOrder(false);
                  setDefaultApplied(false);
                  setEdits(null);
                  setBaseTime("");
                }}
                centerIds={patientCentersRes.state.kind === "ok" ? patientCenterIds : undefined}
              />
            </Field>
          )}
          <TherapyVisitPanel
            state={
              !patient
                ? "noPatient"
                : catalogueFailed
                  ? "catalogueFailed"
                  : rules.bookableHidden
                    ? "balanceHidden"
                    : balanceState === "fail"
                      ? "balanceFailed"
                      : balanceState !== "ok" || servRes.state.kind === "loading"
                        ? "loading"
                        : "ready"
            }
            onRetryCatalogue={() => {
              if (servRes.state.kind === "fail") servRes.reload();
              if (resRes.state.kind === "fail") resRes.reload();
            }}
            onRetryBalance={reloadBalance}
            pickable={pickable}
            selected={selected}
            order={order}
            areas={areas}
            keepOrder={keepOrder}
            disabled={busy}
            stay={
              firstTrain
                ? t("minutes", { n: firstTrain.patientMinutes })
                : summary.pending
                  ? tSeries("checking")
                  : t("visitVaries")
            }
            onReorder={(ids) => {
              setSelected(ids);
              setKeepOrder(true);
              trainChanged();
            }}
            onAutoOrder={() => {
              setKeepOrder(false);
              trainChanged();
            }}
            onToggle={toggle}
            onAreas={(id, n) => {
              setAreas((x) => ({ ...x, [id]: n }));
              trainChanged();
            }}
          />
        </div>
        {/* lg:pt-4 matches the left panel's padding, so both step labels sit on one line. */}
        <div className="min-w-0 space-y-4 lg:pt-4">
          <StepLabel n={2}>{t("stepDates")}</StepLabel>
          <SeriesFrequency
            mode={mode}
            onMode={(m) => {
              setMode(m);
              setEdits(null);
            }}
            days={days}
            startDay={startDay}
            onDays={(next) => {
              setDays(next);
              setEdits(null);
            }}
            total={edited ? items.length : total}
            maxTotal={maxRows}
            limitedBy20={!!balance && selected.some((id) => (balance.get(id)?.bookable ?? 0) > maxRows)}
            onTotal={(n) => {
              setTotalChoice(n);
              setEdits(null);
            }}
            disabled={busy || (weekly && startDay === 0)}
          />

          {selected.length > 0 && !(weekly && startDay === 0) && (
            <div className="flex flex-col gap-2 text-sm">
              {weekly && edited && <p className="text-xs text-muted-foreground">{tSeries("resetsEdits")}</p>}
              {span && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  {!single && (
                    <p className="text-sm font-medium tabular-nums">
                      {tSeries("span", { n: rows.length, from: dayLabel(span.first), to: dayLabel(span.last) })}
                    </p>
                  )}
                  {rowsLoaded && !rowsFailed && (
                    <p className="text-xs font-medium">
                      {health.full === 0 && health.blocked === 0 ? (
                        <span className="text-success-foreground">✓ {tSeries("allFree")}</span>
                      ) : (
                        <>
                          {health.blocked > 0 && <span className="text-destructive">{tSeries("healthBlocked", { n: health.blocked })}</span>}
                          {health.blocked > 0 && health.full > 0 && <span className="text-muted-foreground"> · </span>}
                          {health.full > 0 && <span className="text-warning-foreground">{tSeries("healthFull", { n: health.full })}</span>}
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
              <SeriesRows
                rows={rows}
                days={avail.days}
                checking={!avail.ready}
                disabled={busy}
                canDrop={rows.length > 1}
                onTime={(index, v) => editItems((list) => setRowTime(list, index, v, seriesTime))}
                onDate={(index, d) =>
                  editItems((list) => replaceDate(list, index, d), moveOff(off, items[index]?.date ?? d, d))
                }
                onSuggestion={() => {}}
                onDrop={(index) => editItems((list) => dropRow(list, index), moveOff(off, items[index]?.date ?? "", null))}
                timeOptions={trainTimeOptions}
                optionHint={(date, time) => {
                  const why = slotWhy(avail.trains[date], time);
                  return why ? whyText(why, avail.trains[date]) : null;
                }}
                statusLabel={(r) => {
              if (r.status !== "blocked" || r.reason !== "duplicate") return null;
              const n = new Set(sameDaySessions(avail.sessions, r.date, therapiesOn(r.date)).map((x) => x.serviceId)).size;
              return n ? t("alreadyBooked", { n }) : null;
            }}
            rowDetail={(r) => (
                  <TrainDayDetail
                    row={r}
                    train={avail.trains[r.date]}
                    sessions={avail.sessions}
                    serviceIds={therapiesOn(r.date)}
                    removed={selected.filter((id) => !therapiesOn(r.date).includes(id))}
                    serviceName={serviceName}
                    disabled={busy}
                    why={slotWhy(avail.trains[r.date], r.time)}
                    freeAlt={nearestFree(loadedDays[r.date], r.time)}
                    onUseTime={(time) => editItems((list) => setRowTime(list, r.index, time, seriesTime))}
                    onRemove={(id) => editDayTherapies(r.date, removeOff(off, r.date, id, selected))}
                    onRestore={(id) => editDayTherapies(r.date, restoreOff(off, r.date, id))}
                  />
                )}
              />
              {!weekly && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={busy || !addDate || items.length >= maxRows}
                    onClick={() => addDate && editItems((list) => addItem(list, addDate))}
                  >
                    {tSeries("addDate")}
                  </Button>
                </div>
              )}
              {rowsFailed && (
                <div className="flex items-center gap-2 text-destructive">
                  <span>{tSeries("checkFailed")}</span>
                  <Button type="button" size="xs" variant="outline" onClick={avail.retry}>
                    {tRoot("appointmentsBooking.retry")}
                  </Button>
                </div>
              )}
              {rowsLoaded && health.full > 0 && <p className="text-warning-foreground">{tSeries("fullWarning")}</p>}
            </div>
          )}
        </div>
      </div>
    </FormDialog>
  );
}

