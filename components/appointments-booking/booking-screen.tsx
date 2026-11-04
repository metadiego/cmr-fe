"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { BookingCalendar } from "@/components/appointments-booking/booking-calendar";
import type { BookingView } from "@/components/appointments-booking/booking-toolbar";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { useFillViewportHeight } from "@/hooks/use-fill-viewport-height";
import { useResource } from "@/hooks/use-resource";
import { useBookingTypes } from "@/hooks/use-booking-types";
import { useBookingCalendar } from "@/hooks/use-booking-calendar";
import type { TimeWindow } from "@/lib/agenda/booking/availability";
import { parseBookingParams, toBookingSearch, type BookingKind } from "@/lib/agenda/booking/url-state";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
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
  const centroEstado = {
    ...centro,
    setCentro: (id: string) => {
      centro.setCentro(id);
      if (state.kind === "service") clearType();
    },
  };

  // ---- Calendar data: holidays, the month's free spots, the selected day, Next free and the live
  // refresh (which re-asks the month dates and the selected day an event touches).
  const calendar = useBookingCalendar({
    center,
    kind: typeChosen ? state.kind : undefined,
    typeId: typeChosen ? state.typeId : undefined,
    month: state.month,
    date: state.date,
    patientId: state.patientId,
    window: state.window,
  });
  const live = calendar.live;
  const refreshCalendarDates = calendar.refreshDates;
  // After a booking (and, Task 8, a move or cancel): refresh those dates; Task 8 also reloads the
  // patient rail's upcoming/past list from here.
  const onAppointmentsChanged = (dates: string[]) => {
    refreshCalendarDates(dates);
  };

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
        {/* LEFT: who is calling, or the chosen patient (rail slot: Task 8 adds upcoming/past below the card). */}
        {state.patientId ? (
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto" data-slot="booking-patient-rail">
            <PatientCard
              patientId={state.patientId}
              patient={patient}
              failed={patientRes.state.kind === "fail"}
              centers={patientCenters ?? []}
              onClose={clearPatient}
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
            center={center}
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
            onAppointmentsChanged={onAppointmentsChanged}
          />
        )}
      </div>
    </PageContainer>
  );
}
