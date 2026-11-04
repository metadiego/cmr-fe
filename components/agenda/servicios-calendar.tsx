"use client";

import * as React from "react";
import { sentenceCase } from "@/lib/format/text";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { listSesionesRango, type Sesion } from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { getFestivos, type Festivo } from "@/lib/api/disponibilidad";
import { listPacientes } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { useCalendarClinics } from "@/hooks/use-calendar-clinics";
import { monthMatrix, toISO } from "@/lib/agenda/calendar";
import { dayHoliday, servicesByName } from "@/lib/agenda/calendar-clinics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Can } from "@/components/kit/can";
import { CenterFilter } from "@/components/kit/center-filter";
import { ControlSkeleton } from "@/components/kit/skeletons";
import { LegendSkeleton, MonthCalendar, type AgendaEvent } from "@/components/agenda/month-calendar";
import { PlanificarDiaModal } from "@/components/agenda/planificar-dia-modal";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import type { Paciente } from "@/lib/api/pacientes";

const ALL = "__all__";

// Service appointments calendar (frontdesk). Day-based (no time); filtered by
// service. Sessions: GET /frontdesk/sesiones?desde&hasta&servicioId. Every clinic the person reads the
// front desk in, with a clinic filter (clinic-read-scope): each session says its clinic. A day click
// opens the day view on ONE clinic (the single ticked one, else the active one); planning runs there.
export function ServiciosCalendar() {
  const t = useTranslations("agenda");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());
  // A service by NAME: each clinic has its own row of the same service (lib/agenda/calendar-clinics.ts).
  const [servicioKey, setServicioKey] = React.useState(ALL);
  const [modal, setModal] = React.useState<{ fecha: string; paciente?: Paciente } | null>(null);
  const [newPatientOpen, setNewPatientOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const clinics = useCalendarClinics("frontdesk.read", "frontdesk.create");

  const weeks = monthMatrix(year, month0);
  const desde = toISO(weeks[0][0]);
  const hasta = toISO(weeks[weeks.length - 1][6]);

  // Services are per clinic and their list reads ONE (X-Tenant-ID): with several clinics, one read each.
  // A clinic whose catalog fails only loses its colors/names; the others and the sessions still show.
  const shownKey = clinics.shownIds.join(",");
  const serviciosRes = useResource<Servicio[]>(
    () =>
      clinics.showFilter
        ? Promise.all(clinics.shownIds.map((id) => getServicios(id).catch(() => [] as Servicio[]))).then((all) => all.flat())
        : getServicios(),
    [clinics.showFilter, shownKey],
  );
  const festivosRes = useResource<Festivo[]>(() => getFestivos(year, clinics.choice), [year, clinics.choiceKey]);
  const servicios = React.useMemo(
    () => (serviciosRes.state.kind === "ok" ? serviciosRes.state.data : []),
    [serviciosRes.state],
  );
  const opciones = React.useMemo(() => servicesByName(servicios), [servicios]);
  const festivos = festivosRes.state.kind === "ok" ? festivosRes.state.data : [];
  // A service no longer among the clinics shown reads as «all» (no state reset: React Compiler).
  const opcion = opciones.find((o) => o.key === servicioKey);
  // One row → asked as before (`serviceId`); the same service in several clinics → filtered here.
  const servicioId = opcion?.ids.length === 1 ? opcion.ids[0] : undefined;

  const { state, refresh } = useResource<Sesion[]>(
    () =>
      listSesionesRango({
        desde,
        hasta,
        servicioId,
        // The clinics shown: the ticked ones, or `null` = every clinic with frontdesk.read.
        centroId: clinics.choice,
      }),
    [desde, hasta, servicioId, clinics.choiceKey],
  );
  const sesiones = React.useMemo(() => {
    const all = state.kind === "ok" ? state.data : [];
    const ids = opcion && opcion.ids.length > 1 ? new Set(opcion.ids) : null;
    return ids ? all.filter((s) => ids.has(s.serviceId)) : all;
  }, [state, opcion]);

  React.useEffect(() => {
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const servById = React.useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);

  const { showColumn: showClinic, shortOf } = clinics;
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const s of sesiones) {
      // Nombre + récord vienen adjuntos en la sesión (no se pide el paciente fila a fila). El récord al
      // frente ayuda a identificar de un vistazo. Handoff el-paciente-viaja-con-su-record.
      const nombre = s.patient?.name ?? "…";
      const record = s.patient?.medicalRecordNumber;
      const label = record ? `#${record} · ${nombre}` : nombre;
      const color = servById.get(s.serviceId)?.color ?? "#4a90d9";
      const arr = map.get(s.date) ?? [];
      // Its clinic, when the person reads several (even filtered to one).
      const clinic = showClinic ? shortOf(s.clinicName) || undefined : undefined;
      arr.push({ id: s.id, hora: null, label, color, clinic });
      map.set(s.date, arr);
    }
    return map;
  }, [sesiones, servById, showClinic, shortOf]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month0 + delta, 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  }
  function goToday() {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  }

  // Follows the APP language, not the browser's: `toLocaleDateString(undefined, ...)`
  // rendered "septiembre 2026" in an English session on a Spanish-configured machine.
  // Date.UTC plus the `monthYear` format (which pins UTC) keeps the month from sliding:
  // the previous `new Date(year, month0, 1)` was LOCAL midnight, which on a browser east
  // of the meridian lands in the PREVIOUS month once rendered in clinic time.
  // Sentence case: only the first letter is raised ("Octubre de 2026"). A CSS `capitalize` would
  // raise every word and print "Octubre De 2026".
  const monthRaw = format.dateTime(new Date(Date.UTC(year, month0, 1, 12)), "monthYear");
  const monthLabel = sentenceCase(monthRaw);
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`dow.${i}`));

  const patientResults = useResource(
    () =>
      q.trim().length >= 1
        ? listPacientes({ q, limit: 8 })
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 8 } }),
    [q],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        {/* One toolbar row, same shape on both tabs so switching tabs does not move controls.
            LEFT: navigation (prev/next/today + the month shown), then the filters that narrow it.
            RIGHT (ml-auto): actions, the primary create action rightmost. */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label={tCommon("prev")}>
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label={tCommon("next")}>
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
          <Button variant="outline" onClick={goToday}>{t("today")}</Button>
          {/* Fixed min width: a short month name must not pull the filters left of where a long one puts them. */}
          <h2 className="min-w-52 px-1 text-xl font-semibold whitespace-nowrap">{monthLabel}</h2>
          {clinics.showFilter && (
            <CenterFilter centers={clinics.centers} selected={clinics.selected} onChange={clinics.setSelected} />
          )}
          {serviciosRes.state.kind === "loading" ? (
            <ControlSkeleton className="w-52" />
          ) : (
          <Select value={opcion ? opcion.key : ALL} onValueChange={setServicioKey}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allServices")}</SelectItem>
              {opciones.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* «Nuevo servicio» in ONE clinic (the single ticked one, else the active one), by the create
                permission THERE; it says which when the person reads several. */}
            {clinics.canCreate && (
              <Button onClick={() => router.push(`/scheduling/appointments/services/${toISO(new Date())}${clinics.dayQuery}`)}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                {t("newService")}
                {clinics.showColumn && <span className="opacity-70">· {clinics.shortOf(clinics.oneName)}</span>}
              </Button>
            )}
          </div>
        </div>

        {state.kind === "fail" ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        ) : (
          <MonthCalendar
            year={year}
            month0={month0}
            weekdays={weekdays}
            eventsByDate={eventsByDate}
            loading={state.kind === "loading"}
            festivos={festivos}
            holidayOf={(iso) => dayHoliday(festivos, iso, clinics.shownIds, clinics.shortOf)}
            // The day view is ONE clinic: named in the link (`?centro=`), shown in its picker.
            onDayClick={(iso) => router.push(`/scheduling/appointments/services/${iso}${clinics.dayQuery}`)}
            onEventClick={() => { /* sessions are managed on the day-of board */ }}
          />
        )}
      </div>

      <aside className="space-y-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("patients")}</h2>
            <Can permiso="pacientes.create">
              <Button variant="outline" size="icon" className="size-7" onClick={() => setNewPatientOpen(true)}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
              </Button>
            </Can>
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPatient")} />
          <ul className="mt-2 space-y-1">
            {patientResults.state.kind === "ok" &&
              patientResults.state.data.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setModal({ fecha: toISO(new Date()), paciente: p })}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                      {(p.firstName?.[0] ?? "") + (p.lastName?.[0] ?? "")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{(p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" "))}</span>
                      {p.phone && <span className="block truncate text-xs text-muted-foreground">{p.phone}</span>}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("serviceLegend")}</h2>
          {serviciosRes.state.kind === "loading" ? (
            <LegendSkeleton className="max-h-72 overflow-y-auto" />
          ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {opciones.map((o) => (
              <li key={o.key} className="flex items-center gap-2 text-sm">
                <span className="size-3 rounded-sm" style={{ backgroundColor: o.color ?? "#4a90d9" }} />
                {o.name}
              </li>
            ))}
          </ul>
          )}
        </section>
      </aside>

      {modal && (
        <PlanificarDiaModal
          open
          fecha={modal.fecha}
          paciente={modal.paciente}
          centro={clinics.one || undefined}
          centroNombre={clinics.showColumn ? clinics.oneName : undefined}
          onOpenChange={(o) => !o && setModal(null)}
          onSaved={refresh}
        />
      )}
      <PacienteFormSheet open={newPatientOpen} onOpenChange={setNewPatientOpen} onSaved={() => setNewPatientOpen(false)} />
    </div>
  );
}
