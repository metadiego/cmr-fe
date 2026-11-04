"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { shortTime } from "@/components/appointments-booking/booking-toolbar";
import { SeriesRows, useDayLabel } from "@/components/appointments-booking/series-rows";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { suggestionKey, useSeriesAvailability, type SeriesNeed } from "@/hooks/use-series-availability";
import { buildSeriesRows, canBookSeries, seriesDates } from "@/lib/agenda/booking/series";
import {
  MAX_SESSIONS,
  MIN_SESSIONS,
  applySuggestion,
  defaultSessions,
  dropRow,
  groupByTime,
  notCreated,
  overridesOf,
  setRowTime,
  suggestionExclusions,
  type SeriesItem,
} from "@/lib/agenda/booking/series-booking";
import { normalizeTime, type DaySlots } from "@/lib/agenda/booking/availability";
import type { RecurringPlanItem } from "@/lib/agenda/recurring-plan";
import { agendarVariosServicios, crearSesion, getServiciosConSaldo } from "@/lib/api/frontdesk";
import type { ApiWarning } from "@/lib/api/types";
import type { Paciente } from "@/lib/api/pacientes";
import { apiErrorLabel } from "@/lib/api/errors";
import { warningText } from "@/lib/frontdesk/avisos";

// The service booking form under the day's times (spec "Booking form", Service): the patient (the
// screen's, or a search here), then Book for the picked day and time, or "Repeat weekly" → every 1|2
// weeks, N sessions, one row per date with its own time, status and the planner's suggestion. A full
// time is bookable (overbook) with a warning; a blocked row (holiday, closed, already has the service
// that day) must be fixed or dropped first. A series goes out as one bulk request per distinct time.

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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

  const [repeat, setRepeat] = React.useState(false);
  const [everyWeeks, setEveryWeeks] = React.useState<1 | 2>(1);
  const [countChoice, setCountChoice] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Sessions left on the patient's package for this service: the default number of sessions.
  const saldoRes = useResource(
    () => (patientId && center ? getServiciosConSaldo(patientId, center) : Promise.resolve([])),
    [patientId, center],
  );
  const sessionsLeft =
    saldoRes.state.kind === "ok" ? saldoRes.state.data.find((s) => s.serviceId === serviceId)?.pending : undefined;
  const count = countChoice ?? defaultSessions(sessionsLeft);

  // The rows as generated, unless edited (time, suggestion, drop) for this cadence and count.
  const genKey = `${everyWeeks}|${count}`;
  const [edits, setEdits] = React.useState<{ key: string; items: SeriesItem[] } | null>(null);
  const items: SeriesItem[] =
    edits && edits.key === genKey ? edits.items : seriesDates(date, everyWeeks, count).map((d) => ({ date: d }));
  const editItems = (fn: (items: SeriesItem[]) => SeriesItem[]) => setEdits({ key: genKey, items: fn(items) });

  const rowDates = repeat && patientId ? items.map((i) => i.date) : [];
  const series = useSeriesAvailability({ center, serviceId, patientId, dates: rowDates });

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

  const ready = !!patient && canBook && !busy && (!repeat || seriesOk);

  const bookSingle = async (p: Paciente) => {
    try {
      const { warnings } = await crearSesion({ patientId: p.id, serviceId, date, time: normalizeTime(time) }, center);
      toast.success(t("toasts.booked", { n: 1 }));
      if (warnings.length) toast.warning(t("toasts.warnings", { list: warnings.map((w) => warningText(w, tRoot)).join(" · ") }));
      onBooked({ patient: p, dates: [date], done: true });
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
        warnings.push(...res.warnings);
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
      if (repeat) await bookSeries(patient);
      else await bookSingle(patient);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 text-sm"
      data-slot="service-booking-form"
    >
      <p className="font-semibold">
        {serviceName} · {dayLabel(date)} · {shortTime(time)}
      </p>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("series.patient")}</span>
        {screenPatient ? (
          <span className="font-medium">
            {screenPatient.displayName || [screenPatient.firstName, screenPatient.lastName].filter(Boolean).join(" ")}
          </span>
        ) : (
          <PacienteSelect value={localPatient} onChange={setLocalPatient} centerIds={patientCenterIds} />
        )}
        {sessionsLeft != null && sessionsLeft > 0 && (
          <span className="text-xs text-muted-foreground">{t("typePicker.sessionsLeft", { n: sessionsLeft })}</span>
        )}
      </div>

      {!repeat && pickedFull && <p className="text-warning-foreground">{t("series.fullWarning")}</p>}

      <div className="flex items-center gap-2">
        <Checkbox
          id="service-booking-repeat"
          checked={repeat}
          disabled={busy}
          onCheckedChange={(v) => setRepeat(v === true)}
        />
        <Label htmlFor="service-booking-repeat">{t("series.repeatWeekly")}</Label>
      </div>

      {repeat && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="service-booking-every">{t("series.every")}</Label>
            <select
              id="service-booking-every"
              className={SELECT_CLASS}
              value={everyWeeks}
              disabled={busy}
              onChange={(e) => setEveryWeeks(e.target.value === "2" ? 2 : 1)}
            >
              {[1, 2].map((n) => (
                <option key={n} value={n}>
                  {t("series.everyWeeks", { n })}
                </option>
              ))}
            </select>
            <Label htmlFor="service-booking-count">{t("series.sessions")}</Label>
            <select
              id="service-booking-count"
              className={SELECT_CLASS}
              value={count}
              disabled={busy}
              onChange={(e) => setCountChoice(Number(e.target.value))}
            >
              {Array.from({ length: MAX_SESSIONS - MIN_SESSIONS + 1 }, (_, i) => MIN_SESSIONS + i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {!patient ? (
            <p className="text-muted-foreground">{t("series.pickPatient")}</p>
          ) : (
            <>
              <SeriesRows
                rows={rows}
                days={series.days}
                checking={!series.ready}
                disabled={busy}
                canDrop={rows.length > 1}
                onTime={(index, v) => editItems((list) => setRowTime(list, index, v, time))}
                onSuggestion={(index, s) => editItems((list) => applySuggestion(list, index, s, time))}
                onDrop={(index) => editItems((list) => dropRow(list, index))}
              />
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

      {permsReady && !canBook && <p className="text-muted-foreground">{t("series.noPermission")}</p>}

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={book} disabled={!ready}>
          {repeat ? t("series.bookSeries", { n: rows.length }) : t("series.book")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onBack} disabled={busy}>
          {t("series.back")}
        </Button>
      </div>
    </div>
  );
}
