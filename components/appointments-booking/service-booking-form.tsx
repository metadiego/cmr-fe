"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import { SeriesRows, useDayLabel } from "@/components/appointments-booking/series-rows";
import { SeriesFrequency, type SeriesMode } from "@/components/appointments-booking/series-frequency";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import type { BookableState } from "@/hooks/use-patient-booking-rules";
import { suggestionKey, useSeriesAvailability, type SeriesNeed } from "@/hooks/use-series-availability";
import { buildSeriesRows, canBookSeries } from "@/lib/agenda/booking/series";
import {
  MAX_SESSIONS,
  applySuggestion,
  defaultSessions,
  dropRow,
  groupByTime,
  notCreated,
  seriesHealth,
  seriesSpan,
  overridesOf,
  setRowTime,
  suggestionExclusions,
} from "@/lib/agenda/booking/series-booking";
import {
  addItem,
  daysMatch,
  fitLoadedTimes,
  generateWeeklyPattern,
  nextDate,
  replaceDate,
  type EditableItem,
} from "@/lib/agenda/booking/series-edit";
import { weekdayOf } from "@/lib/agenda/recurring-plan";
import { todayPR } from "@/lib/format/fecha";
import { normalizeTime, type DaySlots } from "@/lib/agenda/booking/availability";
import type { RecurringPlanItem } from "@/lib/agenda/recurring-plan";
import { agendarVariosServicios, crearSesion, getServiciosConSaldo, type BookableService } from "@/lib/api/frontdesk";
import type { ApiWarning } from "@/lib/api/types";
import type { Paciente } from "@/lib/api/pacientes";
import { apiErrorLabel } from "@/lib/api/errors";
import { warningText } from "@/lib/frontdesk/avisos";

// The service booking dialog, opened by picking a time in the day panel (spec "Booking form", Service),
// the same way a medical time opens the appointment dialog: the patient (the screen's, or a search
// here), then the rows, one per date with its own time, status and the planner's suggestion.
// Frequency Manual (default) = the picked date, plus any date added by hand; Semanal = times per week,
// which weekdays and how many in total, the dates filled in from the picked date. One row books as a
// single session; two or more go out as one bulk request per distinct time. A full time is bookable
// (overbook) with a warning; a blocked row (holiday, closed, already has the service that day) must
// be fixed or dropped first. Once a row is edited (time, date, suggestion, drop, "+ Add date") the
// rows are that explicit list; changing the mode, days or total regenerates them.


export interface ServiceBooked {
  patient: Paciente;
  /** Every date that got a session (refresh these). */
  dates: string[];
  /** Everything asked was attempted without a request failing: the form can close. */
  done: boolean;
}

export function ServiceBookingForm({
  center,
  serviceId,
  serviceName,
  date,
  time,
  pickedFull,
  patient: screenPatient,
  patientCenterIds,
  onBooked,
  onBack,
}: {
  center: string | undefined;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  /** The picked time is full in the day panel (booking it overbooks). */
  pickedFull: boolean;
  /** The screen's patient; null = choose one here. */
  patient: Paciente | null;
  /** Centers to search patients in (same as Who's calling). */
  patientCenterIds?: string[];
  /** The screen's patient's bookable balance per service (usePatientBookingRules); not used yet. */
  bookable?: ReadonlyMap<string, BookableService>;
  /** Load state of `bookable`; not used yet. */
  bookableState?: BookableState;
  onBooked: (r: ServiceBooked) => void;
  onBack: () => void;
}) {
  const t = useTranslations("appointmentsBooking");
  const tRoot = useTranslations();
  const { can, ready: permsReady } = useCan();
  const canBook = can("frontdesk.create");
  const dayLabel = useDayLabel();

  const [localPatient, setLocalPatient] = React.useState<Paciente | null>(null);
  const patient = screenPatient ?? localPatient;
  const patientId = patient?.id;

  // The form is keyed on the picked date, so the start's weekday is fixed for its lifetime.
  const startDay = weekdayOf(date);
  const [mode, setMode] = React.useState<SeriesMode>("manual");
  const [perWeek, setPerWeekState] = React.useState(1);
  const [days, setDays] = React.useState<number[]>(() => (startDay === 0 ? [] : [startDay]));
  const [totalChoice, setTotalChoice] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Sessions left on the patient's package for this service: the default number of sessions.
  const saldoRes = useResource(
    () => (patientId && center ? getServiciosConSaldo(patientId, center) : Promise.resolve([])),
    [patientId, center],
  );
  const sessionsLeft =
    saldoRes.state.kind === "ok" ? saldoRes.state.data.find((s) => s.serviceId === serviceId)?.pending : undefined;
  const total = Math.min(MAX_SESSIONS, Math.max(1, totalChoice ?? defaultSessions(sessionsLeft)));

  // The rows as generated, unless edited for this mode, days and total. A row whose date just
  // changed gets its time fitted to that day as soon as the day loads (derived, so no extra render).
  const weekly = mode === "weekly";
  const genKey = weekly ? `${date}|weekly|${days.join(",")}|${total}` : `${date}|manual`;
  const [edits, setEdits] = React.useState<{ key: string; items: EditableItem[] } | null>(null);
  const edited = !!edits && edits.key === genKey;
  const baseItems: EditableItem[] = edited
    ? edits.items
    : weekly
      ? generateWeeklyPattern(date, days, total)
      : [{ date }];

  const rowDates = patientId ? baseItems.map((i) => i.date) : [];
  const series = useSeriesAvailability({ center, serviceId, patientId, dates: rowDates });
  const items = fitLoadedTimes(baseItems, series.days, time);
  const editItems = (fn: (items: EditableItem[]) => EditableItem[]) => setEdits({ key: genKey, items: fn(items) });
  const addDate = nextDate(items, 1, todayPR());

  const loadedDays: Record<string, DaySlots | null> = {};
  for (const [d, v] of Object.entries(series.days)) if (v !== "error") loadedDays[d] = v;
  const rowInput = {
    dates: rowDates,
    time,
    overrides: overridesOf(items),
    days: loadedDays,
    holidays: series.holidays,
    existingDates: series.existingDates,
    cancelledDates: series.cancelledDates,
  };
  const firstPass = buildSeriesRows(rowInput);
  const allLoaded = series.ready && rowDates.every((d) => series.days[d] !== undefined);
  const anyFailed = series.failed || rowDates.some((d) => series.days[d] === "error");

  // The planner's suggestion for each loaded row that is not free (asked once per row state).
  const needs: (SeriesNeed & { key: string })[] = series.ready
    ? firstPass
        .filter((r) => r.status !== "free" && series.days[r.date] !== undefined && series.days[r.date] !== "error")
        .map((r) => ({
          index: r.index,
          date: r.date,
          time: r.time,
          key: suggestionKey(r, suggestionExclusions(rowDates, r.index, series.existingDates, series.holidays)),
        }))
    : [];
  const needsKey = needs.map((n) => n.key).join(";");
  const wantSuggestions = series.wantSuggestions;
  const needsRef = React.useRef(needs);
  React.useEffect(() => {
    needsRef.current = needs;
  });
  React.useEffect(() => {
    if (needsKey) wantSuggestions(needsRef.current);
  }, [needsKey, wantSuggestions]);

  const plan: RecurringPlanItem[] = [];
  for (const n of needs) {
    const s = series.suggestions[n.key];
    if (s) {
      plan.push({
        index: n.index,
        requestedDate: n.date,
        date: s.date,
        time: s.time,
        status: s.date === n.date ? "adjustedTime" : "adjustedDate",
      });
    }
  }
  const rows = plan.length ? buildSeriesRows({ ...rowInput, plan }) : firstPass;
  const seriesOk = rows.length > 0 && allLoaded && !anyFailed && canBookSeries(rows);
  const fullRows = rows.filter((r) => r.status === "full").length;

  const span = seriesSpan(rows.map((r) => r.date));
  const health = seriesHealth(rows);
  const single = rows.length === 1;
  const sunday = startDay === 0;
  const pickDays = weekly && !daysMatch(days, perWeek);
  const ready = !!patient && canBook && !busy && !sunday && !pickDays && seriesOk;
  // What keeps «Agendar» grey, said above it (forms kit): the patient is a missing field; no permission,
  // a Sunday start, weekdays still to pick or rows that cannot go yet are a reason.
  const missing = patient ? [] : [t("series.patient")];
  const reason = !permsReady
    ? tRoot("common.loading")
    : !canBook
      ? t("series.noPermission")
      : sunday
        ? t("series.dateSunday")
        : pickDays
          ? t("series.pickDaysReason", { n: perWeek })
          : patient && !seriesOk
            ? anyFailed
              ? t("series.checkFailed")
              : allLoaded
                ? t("series.fixRed")
                : t("series.checking")
            : null;

  // One row: a single session on that row's date and time (the picked ones unless edited).
  const bookSingle = async (p: Paciente) => {
    const row = rows[0];
    try {
      const { warnings } = await crearSesion(
        { patientId: p.id, serviceId, date: row.date, time: normalizeTime(row.time) },
        center,
      );
      toast.success(t("toasts.booked", { n: 1 }));
      if (warnings.length) toast.warning(t("toasts.warnings", { list: warnings.map((w) => warningText(w, tRoot)).join(" · ") }));
      onBooked({ patient: p, dates: [row.date], done: true });
    } catch (err) {
      toast.error(t("toasts.bookFailed", { message: apiErrorLabel(err, tRoot) }));
    }
  };

  const bookSeries = async (p: Paciente) => {
    const groups = groupByTime(rows);
    const created: string[] = [];
    let createdCount = 0;
    const skipped: string[] = [];
    const warnings: ApiWarning[] = [];
    let failures = 0;
    for (const g of groups) {
      try {
        const res = await agendarVariosServicios(
          { patientId: p.id, serviceIds: [serviceId], dates: g.dates, time: g.time },
          center,
        );
        const list = Array.isArray(res.data.creadas) ? res.data.creadas : [];
        const made = list.map((s) => (s.date ? String(s.date).slice(0, 10) : "")).filter(Boolean);
        createdCount += list.length;
        created.push(...made);
        // The BE only counts what it skipped (a date the patient already has the service on); the dates
        // are the asked ones it did not create, when every created session carries its date.
        if (Number(res.data.omitidas ?? 0) > 0 && made.length === list.length) {
          skipped.push(...notCreated(g.dates, made));
        }
        // `advertencias` carries BOOKING_DAY_SKIPPED (a day a blocking rule skipped, BE #547): said, never dropped.
        warnings.push(...res.warnings, ...res.advertencias);
      } catch (err) {
        failures++;
        toast.error(t("toasts.bookFailed", { message: apiErrorLabel(err, tRoot) }));
      }
    }
    if (createdCount > 0) toast.success(t("toasts.booked", { n: createdCount }));
    const notes = [
      ...(skipped.length ? [t("toasts.skipped", { dates: skipped.map(dayLabel).join(", ") })] : []),
      ...warnings.map((w) => warningText(w, tRoot)),
    ];
    if (notes.length) toast.warning(t("toasts.warnings", { list: notes.join(" · ") }));
    if (failures > 0) {
      // Keep only the rows still to book, so a retry does not ask for the booked ones again.
      const done = new Set([...created, ...skipped]);
      editItems((list) => list.filter((i) => !done.has(i.date)));
      series.retry();
    }
    if (createdCount > 0 || failures === 0) {
      onBooked({ patient: p, dates: [...new Set([...created, ...groups.flatMap((g) => g.dates)])], done: failures === 0 });
    }
  };

  // A ref, not only the state: two fast clicks land before the re-render that disables the button.
  const inFlight = React.useRef(false);
  const book = async () => {
    if (!patient || !ready || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (single) await bookSingle(patient);
      else await bookSeries(patient);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
      size="xl"
      title={`${serviceName} · ${dayLabel(date)} · ${shortTime(time)}`}
      onSubmit={book}
      submitLabel={single ? t("series.book") : t("series.bookSeries", { n: rows.length })}
      submitting={busy}
      missing={missing}
      blocked={!!reason}
      reason={reason}
    >
      <Field label={t("series.patient")} required>
        {screenPatient ? (
          <span className="block text-sm font-medium">
            {screenPatient.displayName || [screenPatient.firstName, screenPatient.lastName].filter(Boolean).join(" ")}
          </span>
        ) : (
          <PacienteSelect value={localPatient} onChange={setLocalPatient} centerIds={patientCenterIds} />
        )}
        {sessionsLeft != null && sessionsLeft > 0 && (
          <span className="block text-xs text-muted-foreground">{t("typePicker.sessionsLeft", { n: sessionsLeft })}</span>
        )}
      </Field>

      {pickedFull && items.length === 1 && !(patient && allLoaded) && (
        <p className="text-sm text-warning-foreground">{t("series.fullWarning")}</p>
      )}

      <SeriesFrequency
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setEdits(null);
        }}
        perWeek={perWeek}
        days={days}
        startDay={startDay}
        onDays={(next) => {
          setDays(next.days);
          setPerWeekState(next.perWeek);
          setEdits(null);
        }}
        total={edited ? items.length : total}
        maxTotal={MAX_SESSIONS}
        onTotal={(n) => {
          setTotalChoice(n);
          setEdits(null);
        }}
        disabled={busy || sunday}
      />

      {!sunday && (
        <div className="flex flex-col gap-2 text-sm">
          {edited && <p className="text-xs text-muted-foreground">{t("series.resetsEdits")}</p>}

          {!patient ? (
            <p className="text-muted-foreground">{t("series.pickPatient")}</p>
          ) : (
            <>
              {span && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium tabular-nums">
                    {single ? "" : t("series.span", { n: rows.length, from: dayLabel(span.first), to: dayLabel(span.last) })}
                  </p>
                  {allLoaded && !anyFailed && (
                    <p className="text-xs font-medium">
                      {health.full === 0 && health.blocked === 0 ? (
                        <span className="text-success-foreground">✓ {t("series.allFree")}</span>
                      ) : (
                        <>
                          {health.blocked > 0 && <span className="text-destructive">{t("series.healthBlocked", { n: health.blocked })}</span>}
                          {health.blocked > 0 && health.full > 0 && <span className="text-muted-foreground"> · </span>}
                          {health.full > 0 && <span className="text-warning-foreground">{t("series.healthFull", { n: health.full })}</span>}
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
              <SeriesRows
                rows={rows}
                days={series.days}
                checking={!series.ready}
                disabled={busy}
                canDrop={rows.length > 1}
                onTime={(index, v) => editItems((list) => setRowTime(list, index, v, time))}
                onDate={(index, d) => editItems((list) => replaceDate(list, index, d))}
                onSuggestion={(index, s) => editItems((list) => applySuggestion(list, index, s, time))}
                onDrop={(index) => editItems((list) => dropRow(list, index))}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={busy || !addDate}
                  onClick={() => addDate && editItems((list) => addItem(list, addDate))}
                >
                  {t("series.addDate")}
                </Button>
                {items.length >= MAX_SESSIONS && (
                  <span className="text-xs text-muted-foreground">{t("series.maxDates", { n: MAX_SESSIONS })}</span>
                )}
              </div>
              {anyFailed && (
                <div className="flex items-center gap-2 text-destructive">
                  <span>{t("series.checkFailed")}</span>
                  <Button type="button" size="xs" variant="outline" onClick={series.retry}>
                    {t("retry")}
                  </Button>
                </div>
              )}
              {allLoaded && !anyFailed && !canBookSeries(rows) && (
                <p className="text-destructive">{t("series.fixRed")}</p>
              )}
              {allLoaded && fullRows > 0 && <p className="text-warning-foreground">{t("series.fullWarning")}</p>}
            </>
          )}
        </div>
      )}
    </FormDialog>
  );
}

