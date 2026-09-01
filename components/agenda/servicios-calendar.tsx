"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { listSesionesRango, type Sesion } from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { getFestivos, type Festivo } from "@/lib/api/disponibilidad";
import { listPacientes } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { usePacienteMap } from "@/lib/agenda/use-paciente-map";
import { monthMatrix, toISO } from "@/lib/agenda/calendar";
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
import { MonthCalendar, type AgendaEvent } from "@/components/agenda/month-calendar";
import { SesionModal } from "@/components/agenda/sesion-modal";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import type { Paciente } from "@/lib/api/pacientes";

const ALL = "__all__";

// Service appointments calendar (frontdesk). Day-based (no time); filtered by
// service. Sessions: GET /frontdesk/sesiones?desde&hasta&servicioId.
export function ServiciosCalendar() {
  const t = useTranslations("agenda");
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());
  const [servicioId, setServicioId] = React.useState(ALL);
  const [modal, setModal] = React.useState<{ fecha: string; paciente?: Paciente } | null>(null);
  const [newPatientOpen, setNewPatientOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  // Selector de centro EN la pantalla (patrón único): agendar/leer servicios en otro centro sin tocar la sesión.
  const centro = useCentroPantalla("frontdesk.read", "frontdesk.create");

  const weeks = monthMatrix(year, month0);
  const desde = toISO(weeks[0][0]);
  const hasta = toISO(weeks[weeks.length - 1][6]);

  const serviciosRes = useResource<Servicio[]>(() => getServicios());
  const festivosRes = useResource<Festivo[]>(() => getFestivos(year), [year]);
  const servicios = React.useMemo(
    () => (serviciosRes.state.kind === "ok" ? serviciosRes.state.data : []),
    [serviciosRes.state],
  );
  const festivos = festivosRes.state.kind === "ok" ? festivosRes.state.data : [];

  const { state, reload } = useResource<Sesion[]>(
    () =>
      listSesionesRango({
        desde,
        hasta,
        servicioId: servicioId === ALL ? undefined : servicioId,
        centroId: centro.fetchCentroId,
      }),
    [desde, hasta, servicioId, centro.fetchCentroId],
  );
  const sesiones = React.useMemo(() => (state.kind === "ok" ? state.data : []), [state]);

  React.useEffect(() => {
    const id = setInterval(reload, 20000);
    return () => clearInterval(id);
  }, [reload]);

  const pacientes = usePacienteMap(sesiones.map((s) => s.pacienteId));
  const servById = React.useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const s of sesiones) {
      const p = pacientes[s.pacienteId];
      const label = p ? (p.nombreMostrar || [p.nombres, p.apellidos].filter(Boolean).join(" ")) : "…";
      const color = servById.get(s.servicioId)?.color ?? "#4a90d9";
      const arr = map.get(s.fecha) ?? [];
      arr.push({ id: s.id, hora: null, label, color });
      map.set(s.fecha, arr);
    }
    return map;
  }, [sesiones, pacientes, servById]);

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

  const monthLabel = new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`dow.${i}`));

  const patientResults = useResource(
    () =>
      q.trim().length >= 1
        ? listPacientes({ q, limit: 8 })
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 8 } }),
    [q],
  );

  const servicioInicial = servicioId === ALL ? undefined : servicioId;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="prev">‹</Button>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="next">›</Button>
          <h2 className="ml-1 text-xl font-semibold capitalize">{monthLabel}</h2>
          <Button variant="ghost" size="sm" onClick={goToday}>{t("today")}</Button>
          <div className="ml-auto flex items-center gap-2">
            {/* Selector de centro EN la pantalla: solo si hay más de uno; chip «Solo lectura» si no puede agendar allí. */}
            <CentroPantallaSelector estado={centro} />
            <Select value={servicioId} onValueChange={setServicioId}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allServices")}</SelectItem>
                {servicios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* «Nuevo servicio» según el permiso de creación EN el centro elegido, no según «es mi centro». */}
            {centro.puedeEscribir && (
              <Button size="sm" onClick={() => setModal({ fecha: toISO(new Date()) })}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
                {t("newService")}
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
            festivos={festivos}
            onDayClick={(iso) => setModal({ fecha: iso })}
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
                      {(p.nombres?.[0] ?? "") + (p.apellidos?.[0] ?? "")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{(p.nombreMostrar || [p.nombres, p.apellidos].filter(Boolean).join(" "))}</span>
                      {p.telefono && <span className="block truncate text-xs text-muted-foreground">{p.telefono}</span>}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("serviceLegend")}</h2>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {servicios.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="size-3 rounded-sm" style={{ backgroundColor: s.color ?? "#4a90d9" }} />
                {s.nombre}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {modal && (
        <SesionModal
          open
          fecha={modal.fecha}
          servicios={servicios}
          servicioInicial={servicioInicial}
          pacienteInicial={modal.paciente}
          centroInicial={centro.centroActivo || undefined}
          onOpenChange={(o) => !o && setModal(null)}
          onSaved={reload}
        />
      )}
      <PacienteFormSheet open={newPatientOpen} onOpenChange={setNewPatientOpen} onSaved={() => setNewPatientOpen(false)} />
    </div>
  );
}
