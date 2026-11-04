"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Can } from "@/components/kit/can";
import { LiveBadge } from "@/components/live-badge";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { WhosCallingPanel } from "@/components/appointments-booking/whos-calling-panel";
import { TypePickerPanel } from "@/components/appointments-booking/type-picker-panel";
import { PatientCard } from "@/components/appointments-booking/patient-card";
import { BookingCalendar, type CalendarMoving } from "@/components/appointments-booking/booking-calendar";
import { ServiceBookingForm } from "@/components/appointments-booking/service-booking-form";
import {
  EditAppointmentModal,
  PatientRail,
  useAppointmentLabel,
} from "@/components/appointments-booking/patient-rail";
import type { BookingView } from "@/components/appointments-booking/booking-toolbar";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { useFillViewportHeight } from "@/hooks/use-fill-viewport-height";
import { useResource } from "@/hooks/use-resource";
import { useBookingTypes } from "@/hooks/use-booking-types";
import { useBookingCalendar } from "@/hooks/use-booking-calendar";
import { calendarCenter } from "@/lib/agenda/booking/calendar-center";
import { usePatientAppointments } from "@/hooks/use-patient-appointments";
import type { PatientAppointment } from "@/lib/agenda/booking/patient-appointments";
import { normalizeTime, type TimeWindow } from "@/lib/agenda/booking/availability";
import { parseBookingParams, toBookingSearch, type BookingKind } from "@/lib/agenda/booking/url-state";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { reagendarCita, type Cita } from "@/lib/api/citas";
import { reagendarSesion } from "@/lib/api/frontdesk";
import { apiErrorLabel } from "@/lib/api/errors";
import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { todayPR } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The appointments booking screen (/scheduling/appointments, and the old /services tab route): who is
// calling + what we are booking → a month of free spots → the day's times → book / move / cancel.
// Spec: docs/specs/2026-11-04-appointments-booking-calendar-design.md ("The screen").
//
// Four layouts, by whether a patient and a type are chosen (the spec's states table):
//   no patient, no type → Who's calling? | What are we booking?   (two equal panels)
//   no patient, type    → Who's calling? (narrow) | calendar slot
//   patient, no type    → patient rail | "Book for <name>: what?"
//   patient, type       → patient rail | calendar slot
// kind/typeId/date/patientId live in the URL (?type=kind:id&date=&patient=) so reload and links restore
// the screen; the rest (time window, Free/Booked, visible month, the appointment being moved) is local.
// The work area fills the window (useFillViewportHeight); the panels scroll inside it, never the page.

export type { BookingView };

export interface BookingScreenState {
  kind?: BookingKind;
  typeId?: string;
  date?: string; // YYYY-MM-DD, the selected day
  patientId?: string;
  window: TimeWindow;
  view: BookingView; // "booked" is only offered for medical types
  month: { year: number; month0: number };
  movingId: string | null; // the appointment being moved (patient rail → day panel)
}

function monthOf(iso: string): { year: number; month0: number } {
  return { year: Number(iso.slice(0, 4)), month0: Number(iso.slice(5, 7)) - 1 };
}

function initialState(sp: URLSearchParams): BookingScreenState {
  const url = parseBookingParams(sp);
  return { ...url, window: "any", view: "free", month: monthOf(url.date ?? todayPR()), movingId: null };
}

export function BookingScreen() {
  const t = useTranslations("appointmentsBooking");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const centro = useCentroPantalla("citas.read", "citas.create");
  const center = centro.centroActivo || undefined;

  const [state, setState] = React.useState<BookingScreenState>(() =>
    initialState(new URLSearchParams(searchParams.toString())),
  );
  const search = toBookingSearch(state);
  const urlSearch = toBookingSearch(parseBookingParams(new URLSearchParams(searchParams.toString())));

  // State → URL, written by the change itself (not by an effect), so the screen knows which URLs it
  // wrote: `pending` holds them until the router reports them back. Replace, not push: picking a
  // patient or a type is not a history step. Several `update`s in one event all land: the state uses a
  // functional updater, and `latest` (written only here and after each commit, read only in handlers)
  // carries the merged state so each call compares the URL against the previous call's result.
  const [pending, setPending] = React.useState<string[]>([]);
  const latest = React.useRef(state);
  React.useEffect(() => {
    latest.current = state;
  });
  const update = (patch: Partial<BookingScreenState>) => {
    const prev = latest.current;
    const next = { ...prev, ...patch };
    latest.current = next;
    setState((s) => ({ ...s, ...patch }));
    const nextSearch = toBookingSearch(next);
    if (nextSearch !== toBookingSearch(prev)) {
      setPending((p) => [...p, nextSearch]);
      router.replace(`${pathname}${nextSearch}`, { scroll: false });
    }
  };

  // URL → state: a navigation this screen did not make (the sidebar's "Citas" link to the bare route, a
  // link carrying ?patient= or ?type=) re-derives the URL-held fields. Our own writes coming back are
  // dropped from `pending` instead. Adjusted during render (React's "derive from a changed prop" pattern).
  const [seenUrl, setSeenUrl] = React.useState(urlSearch);
  if (urlSearch !== seenUrl) {
    setSeenUrl(urlSearch);
    const echo = pending.indexOf(urlSearch);
    if (echo >= 0) {
      setPending(pending.slice(echo + 1));
    } else {
      setPending([]);
      if (urlSearch !== search) {
        const url = parseBookingParams(new URLSearchParams(urlSearch));
        setState({
          ...state,
          kind: url.kind,
          typeId: url.typeId,
          date: url.date,
          patientId: url.patientId,
          month: url.date ? monthOf(url.date) : state.month,
          movingId: null,
        });
      }
    }
  }

  // ---- Patient: the object picked in the search, or loaded from ?patient=<id> on reload.
  const [picked, setPicked] = React.useState<Paciente | null>(null);
  // Patients are read in every center where the user holds `pacientes.read` (not only the screen's
  // `citas.read` centers): the search and the ?patient load pass them as `centerIds`.
  const patientCentersRes = useResource<Centro[]>(() => getCentrosDondePuedo("pacientes.read"));
  const patientCenters =
    patientCentersRes.state.kind === "ok" ? patientCentersRes.state.data : patientCentersRes.state.kind === "fail" ? [] : null;
  const centerIds = (patientCenters ?? []).map((c) => c.id).join(",");
  const needsLoad = !!state.patientId && picked?.id !== state.patientId;
  const patientRes = useResource<Paciente | null>(
    () =>
      needsLoad && patientCenters && state.patientId
        ? getPaciente(state.patientId, undefined, centerIds ? { centerIds: centerIds.split(",") } : {})
        : Promise.resolve(null),
    [state.patientId, needsLoad, !!patientCenters, centerIds],
  );
  const patient =
    picked && picked.id === state.patientId
      ? picked
      : patientRes.state.kind === "ok"
        ? patientRes.state.data
        : null;

  const pickPatient = (p: Paciente) => {
    setPicked(p);
    update({ patientId: p.id, movingId: null });
  };
  const clearPatient = () => {
    setPicked(null);
    update({ patientId: undefined, movingId: null });
  };

  // ---- Type: medical appointment type or service of the screen's center.
  const types = useBookingTypes(center);
  const chosenType = types.find(state.kind, state.typeId);
  // A type from the URL that does not exist here (another center's service, or deactivated) counts as
  // none chosen once the lists are in, so the picker shows instead of an empty calendar.
  const typeChosen = !!state.kind && !!state.typeId && (types.loading || !!chosenType);
  const pickType = (kind: BookingKind, typeId: string) =>
    update({ kind, typeId, view: kind === "medical" ? state.view : "free", movingId: null });
  const clearType = () => update({ kind: undefined, typeId: undefined, date: undefined, movingId: null });

  // Services belong to a center: switching center drops a chosen service (medical types are global).
  // A move never changes an appointment's center, so switching center by hand also stops a move.
  const centroEstado = {
    ...centro,
    setCentro: (id: string) => {
      centro.setCentro(id);
      if (state.kind === "service") clearType();
      else if (state.movingId) update({ movingId: null });
    },
  };

  // ---- Patient rail: the patient's upcoming/past appointments of both kinds.
  const rail = usePatientAppointments(state.patientId, center);
  const reloadRail = rail.reload;

  // ---- Move: the rail's Move points the calendar at the appointment (its type, day and month, orange
  // ring on its day). A move never changes the appointment's center, so while it moves the calendar
  // reads availability from the appointment's OWN center (calendarCenter), whatever the picker or the
  // top bar shows, with a note saying so. The day panel's "Move here?" box commits. Stop, Esc, a change
  // of the screen's center or a reload that no longer lists it ends the move.
  const appointmentLabel = useAppointmentLabel();
  const movingItem = state.movingId ? rail.upcoming.find((a) => a.id === state.movingId) : undefined;
  const calCenter = calendarCenter(center, movingItem);
  const calCenterName =
    movingItem && calCenter !== center
      ? [...centro.centros, ...(patientCenters ?? [])].find((c) => c.id === calCenter)?.name
      : undefined;

  // ---- Calendar data: holidays, the month's free spots, the selected day, Next free and the live
  // refresh (which re-asks the month dates and the selected day an event touches).
  const calendar = useBookingCalendar({
    center: calCenter,
    kind: typeChosen ? state.kind : undefined,
    typeId: typeChosen ? state.typeId : undefined,
    month: state.month,
    date: state.date,
    patientId: state.patientId,
    window: state.window,
  });
  const live = calendar.live;
  const refreshCalendarDates = calendar.refreshDates;

  // After a booking, move, edit or cancel: refresh those dates (month + day) and the patient's list.
  const onAppointmentsChanged = (dates: string[]) => {
    refreshCalendarDates([...new Set(dates.filter(Boolean))]);
    reloadRail();
  };

  const startMove = (a: PatientAppointment) => {
    update({
      movingId: a.id,
      kind: a.kind,
      typeId: a.typeId,
      date: a.date,
      month: monthOf(a.date),
      view: a.kind === "medical" ? state.view : "free",
    });
  };
  const stopMove = () => update({ movingId: null });
  const onEscape = React.useEffectEvent((e: KeyboardEvent) => {
    // An open dialog (e.g. CitaModal) handles its own Esc first.
    if (e.key === "Escape" && !e.defaultPrevented) stopMove();
  });
  const isMoving = !!state.movingId;
  React.useEffect(() => {
    if (!isMoving) return;
    const onKey = (e: KeyboardEvent) => onEscape(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMoving]);
  // The screen's center changing for any reason (picker, top bar, session) while moving ends the move.
  // Adjusted during render (as the URL → state sync above); movingId is not in the URL, so a plain
  // setState is enough and `latest` catches up after the commit.
  const [seenCenter, setSeenCenter] = React.useState(center);
  if (center !== seenCenter) {
    setSeenCenter(center);
    if (state.movingId) setState((s) => ({ ...s, movingId: null }));
  }

  const moving: CalendarMoving | undefined = movingItem && {
    fromLabel: appointmentLabel(movingItem.date, movingItem.time),
    needsReason: movingItem.kind === "medical",
    onConfirm: async (to, reason) => {
      const a = movingItem;
      // The call runs in the appointment's own center (X-Tenant-ID) and keeps it there: no `centerId`
      // (omit = keep current) and no `doctorId` on the medical reschedule.
      const tenant = a.centerId ?? center;
      const why = reason?.trim() ?? "";
      if (a.kind === "medical" && !why) {
        toast.error(t("toasts.moveReasonRequired"));
        return false;
      }
      try {
        if (a.kind === "medical") {
          await reagendarCita(a.id, { date: to.date, time: to.time, reason: why }, tenant);
        } else {
          await reagendarSesion(a.id, to.date, tenant, to.time);
        }
      } catch (err) {
        toast.error(t("toasts.moveFailed", { message: apiErrorLabel(err) }));
        return false;
      }
      toast.success(
        t("toasts.moved", { from: appointmentLabel(a.date, a.time), to: appointmentLabel(to.date, to.time) }),
      );
      update({ movingId: null });
      onAppointmentsChanged([a.date, to.date]);
      return true;
    },
  };

  // ---- Service booking: the form under the day's times for the picked time (never while moving: the
  // calendar shows it only then). It books in the calendar's center; a patient chosen in the form
  // becomes the screen's patient once something is booked.
  const serviceForm =
    state.kind === "service" && state.typeId
      ? ({ date, time, clear }: { date: string; time: string; clear: () => void }) => {
          const day = calendar.day;
          const slot =
            day && day !== "error" ? day.slots.find((s) => s.time === normalizeTime(time)) : undefined;
          return (
            <ServiceBookingForm
              key={`${state.typeId}|${date}|${time}`}
              center={calCenter}
              serviceId={state.typeId ?? ""}
              serviceName={chosenType?.name ?? ""}
              date={date}
              time={time}
              pickedFull={!!slot && (slot.state === "full" || slot.free <= 0)}
              patient={patient}
              patientCenterIds={patientCenters?.map((c) => c.id)}
              onBooked={(r) => {
                if (!state.patientId) pickPatient(r.patient);
                onAppointmentsChanged(r.dates);
                if (r.done) clear();
              }}
              onBack={clear}
            />
          );
        }
      : undefined;

  // ---- Edit (medical only): the shared CitaModal in edit mode, on the rail's raw appointment.
  const [editing, setEditing] = React.useState<Cita | null>(null);

  // ---- Layout: the work area ends at the window's bottom; its two columns scroll inside themselves.
  const workRef = React.useRef<HTMLDivElement>(null);
  const height = useFillViewportHeight(workRef);
  const start = !state.patientId && !typeChosen;
  const firstName = patient?.firstName;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <CentroPantallaSelector estado={centroEstado} />
            {typeChosen && live && <LiveBadge label={t("live")} />}
            <Can permiso="citas.config">
              <Button variant="outline" asChild>
                <Link href="/scheduling/slots">
                  <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} data-icon="inline-start" />
                  {t("settings")}
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <div
        ref={workRef}
        style={height ? { height } : undefined}
        className={cn(
          "grid min-h-0 grid-cols-1 gap-4 lg:grid-rows-[minmax(0,1fr)]",
          start ? "lg:grid-cols-2" : "lg:grid-cols-[22rem_minmax(0,1fr)]",
        )}
      >
        {/* LEFT: who is calling, or the chosen patient with their upcoming/past appointments. */}
        {state.patientId ? (
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto" data-slot="booking-patient-rail">
            <PatientCard
              patientId={state.patientId}
              patient={patient}
              failed={patientRes.state.kind === "fail"}
              centers={patientCenters ?? []}
              onClose={clearPatient}
            />
            <PatientRail
              center={center}
              data={rail}
              typeLookup={(kind, id) => types.find(kind, id)}
              movingId={movingItem ? movingItem.id : null}
              onMove={startMove}
              onStopMove={stopMove}
              onEdit={(a) => setEditing(rail.citaOf(a.id) ?? null)}
              onCancelled={(a) => onAppointmentsChanged([a.date])}
            />
          </aside>
        ) : (
          <WhosCallingPanel centers={patientCenters} onPick={pickPatient} />
        )}

        {/* RIGHT: what we are booking, or the calendar for the chosen type. */}
        {!typeChosen ? (
          <TypePickerPanel
            title={
              state.patientId && firstName
                ? t("typePicker.titleFor", { name: firstName })
                : t("typePicker.title")
            }
            center={center}
            patientId={state.patientId}
            types={types}
            onPick={pickType}
          />
        ) : (
          <BookingCalendar
            data={calendar}
            center={calCenter}
            centerNote={calCenterName ? t("move.showingCenter", { center: calCenterName }) : undefined}
            kind={state.kind ?? "medical"}
            typeId={state.typeId ?? ""}
            typeName={chosenType?.name ?? t("loading")}
            color={chosenType?.color ?? null}
            label={firstName ? t("toolbar.bookingFor", { name: firstName }) : t("toolbar.booking")}
            onClearType={clearType}
            date={state.date}
            month={state.month}
            window={state.window}
            view={state.view}
            onChange={update}
            patient={patient}
            appointmentTypes={types.appointmentTypes}
            moving={moving}
            ringDate={movingItem?.date}
            serviceForm={serviceForm}
            onAppointmentsChanged={onAppointmentsChanged}
          />
        )}
      </div>

      {editing && (
        <EditAppointmentModal
          key={editing.id}
          cita={editing}
          center={center}
          appointmentTypes={types.appointmentTypes}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const old = editing.date;
            setEditing(null);
            onAppointmentsChanged([old, saved?.date ? String(saved.date).slice(0, 10) : ""]);
          }}
        />
      )}
    </PageContainer>
  );
}
