"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Settings02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Can } from "@/components/kit/can";
import { LiveBadge } from "@/components/live-badge";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { WhosCallingPanel } from "@/components/appointments-booking/whos-calling-panel";
import { TypePickerPanel } from "@/components/appointments-booking/type-picker-panel";
import { PatientCard } from "@/components/appointments-booking/patient-card";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { useFillViewportHeight } from "@/hooks/use-fill-viewport-height";
import { useResource } from "@/hooks/use-resource";
import { useBookingTypes } from "@/hooks/use-booking-types";
import { useBookingLive } from "@/hooks/use-booking-availability";
import type { TimeWindow } from "@/lib/agenda/booking/availability";
import { monthWeeks } from "@/lib/agenda/booking/month";
import { parseBookingParams, toBookingSearch, type BookingKind } from "@/lib/agenda/booking/url-state";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
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

export type BookingView = "free" | "booked";

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
  const update = React.useCallback(
    (patch: Partial<BookingScreenState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );

  // URL ← state (replace: picking a patient or a type is not a history step).
  const search = toBookingSearch(state);
  React.useEffect(() => {
    const current = toBookingSearch(parseBookingParams(new URLSearchParams(window.location.search)));
    if (current !== search) router.replace(`${pathname}${search}`, { scroll: false });
  }, [search, pathname, router]);

  // ---- Patient: the object picked in the search, or loaded from ?patient=<id> on reload.
  const [picked, setPicked] = React.useState<Paciente | null>(null);
  const centerIds = centro.centros.map((c) => c.id).join(",");
  const needsLoad = !!state.patientId && picked?.id !== state.patientId;
  const patientRes = useResource<Paciente | null>(
    () =>
      needsLoad && !centro.cargando && state.patientId
        ? getPaciente(state.patientId, undefined, centerIds ? { centerIds: centerIds.split(",") } : {})
        : Promise.resolve(null),
    [state.patientId, needsLoad, centro.cargando, centerIds],
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

  // ---- Month on screen and live refresh. The calendar slot (Task 7) plugs its month/day refresh into
  // onLiveRefresh; until then the stream only drives the Live pill.
  const weeks = React.useMemo(() => monthWeeks(state.month.year, state.month.month0), [state.month]);
  const visibleDates = React.useMemo(() => weeks.flat(), [weeks]);
  const onLiveRefresh = React.useCallback(() => {}, []);
  const { live } = useBookingLive({
    center: typeChosen ? center : undefined,
    visible: visibleDates,
    onRefresh: onLiveRefresh,
  });

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
              centers={centro.centros}
              onClose={clearPatient}
            />
          </aside>
        ) : (
          <WhosCallingPanel centers={centro.centros} onPick={pickPatient} />
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
          // Calendar slot (Task 7: BookingToolbar + AvailabilityMonth + DayPanel; Task 9: the service form
          // inside the day panel). For now: the toolbar's label and the type chip with ✕ to change it.
          <section
            className="flex min-h-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            data-slot="booking-calendar"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {firstName ? t("toolbar.bookingFor", { name: firstName }) : t("toolbar.booking")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-2.5 text-sm">
                <span
                  className="size-2.5 rounded-full bg-muted-foreground/40"
                  style={chosenType?.color ? { backgroundColor: chosenType.color } : undefined}
                  aria-hidden
                />
                {chosenType?.name ?? t("loading")}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={clearType}
                  aria-label={t("toolbar.changeType")}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
                </Button>
              </span>
            </div>
            <div className="min-h-0 flex-1" />
          </section>
        )}
      </div>
    </PageContainer>
  );
}
