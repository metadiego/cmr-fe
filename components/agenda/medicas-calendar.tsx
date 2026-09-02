"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  listCitasRango,
  getTiposCita,
  type Cita,
  type TipoCita,
} from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getFestivos, type Festivo } from "@/lib/api/disponibilidad";
import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { usePacienteMap } from "@/lib/agenda/use-paciente-map";
import { monthMatrix, toISO, colorDeEvento } from "@/lib/agenda/calendar";
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
import { CitaModal } from "@/components/agenda/cita-modal";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";

const ALL = "__all__";

// Medical appointments calendar (doctor + hora/horaFin). Call-center scheduling.
export function MedicasCalendar() {
  const t = useTranslations("agenda");
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());
  const [medico, setMedico] = React.useState(ALL);
  const [modal, setModal] = React.useState<{ fecha: string; cita?: Cita; paciente?: Paciente } | null>(null);
  const [newPatientOpen, setNewPatientOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  // Selector de centro EN la pantalla (patrón único): agendar/leer en otro centro sin tocar la sesión.
  const centro = useCentroPantalla("citas.read", "citas.create");

  const weeks = monthMatrix(year, month0);
  const desde = toISO(weeks[0][0]);
  const hasta = toISO(weeks[weeks.length - 1][6]);

  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  // Médicos del centro que se está MIRANDO (cuelga del centro): recargar al cambiarlo, o se agendaría con
  // un médico que no está allí. Handoff selector-de-centro §«Todo lo que cuelga del centro se recarga».
  const medicosRes = useResource<Personal[]>(() => getMedicos(centro.fetchCentroId), [centro.fetchCentroId]);
  const festivosRes = useResource<Festivo[]>(() => getFestivos(year), [year]);
  const tipos = React.useMemo(
    () => (tiposRes.state.kind === "ok" ? tiposRes.state.data : []),
    [tiposRes.state],
  );
  const medicos = React.useMemo(
    () => (medicosRes.state.kind === "ok" ? medicosRes.state.data : []),
    [medicosRes.state],
  );
  const festivos = festivosRes.state.kind === "ok" ? festivosRes.state.data : [];

  // Si al cambiar de centro el médico filtrado ya no existe allí, se trata como «todos» (sin resetear
  // estado — lo prohíbe el React Compiler): así no se filtra por un médico de otro centro.
  const medicoEfectivo = medico === ALL || medicos.some((m) => m.id === medico) ? medico : ALL;

  const { state, reload } = useResource<Cita[]>(
    () =>
      listCitasRango({
        desde,
        hasta,
        medicoId: medicoEfectivo === ALL ? undefined : medicoEfectivo,
        centroId: centro.fetchCentroId,
      }),
    [desde, hasta, medicoEfectivo, centro.fetchCentroId],
  );
  const citas = React.useMemo(() => (state.kind === "ok" ? state.data : []), [state]);

  React.useEffect(() => {
    const id = setInterval(reload, 20000);
    return () => clearInterval(id);
  }, [reload]);

  const pacientes = usePacienteMap(citas.map((c) => c.pacienteId));
  const tipoById = React.useMemo(() => new Map(tipos.map((x) => [x.id, x])), [tipos]);
  const medById = React.useMemo(() => new Map(medicos.map((m) => [m.id, m])), [medicos]);
  const citaById = React.useMemo(() => new Map(citas.map((c) => [c.id, c])), [citas]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const c of citas) {
      const p = pacientes[c.pacienteId];
      const label = p ? [p.nombres, p.apellidos].filter(Boolean).join(" ") : "…";
      const color = colorDeEvento(
        null,
        tipoById.get(c.tipoCitaId)?.color,
        c.medicoId ? medById.get(c.medicoId)?.color : null,
      );
      const arr = map.get(c.fecha) ?? [];
      arr.push({ id: c.id, hora: c.hora, label, color });
      map.set(c.fecha, arr);
    }
    return map;
  }, [citas, pacientes, tipoById, medById]);

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
            <Select value={medicoEfectivo} onValueChange={setMedico}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allDoctors")}</SelectItem>
                {medicos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {[m.nombre, m.apellido].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* «Nueva Cita» según el permiso de creación EN el centro elegido, no según «es mi centro». */}
            {centro.puedeEscribir && (
              <Button size="sm" onClick={() => setModal({ fecha: toISO(new Date()) })}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
                {t("new")}
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
            onDayClick={(iso) => router.push(`/scheduling/appointments/${iso}`)}
            onEventClick={(id) => {
              const c = citaById.get(id);
              router.push(`/scheduling/appointments/${c ? c.fecha : ""}`);
            }}
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
                      <span className="block truncate">{[p.nombres, p.apellidos].filter(Boolean).join(" ")}</span>
                      {p.telefono && <span className="block truncate text-xs text-muted-foreground">{p.telefono}</span>}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("typeLegend")}</h2>
          <ul className="space-y-1.5">
            {tipos.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <span className="size-3 rounded-sm" style={{ backgroundColor: x.color }} />
                {x.nombre}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {modal && (
        <CitaModal
          open
          fecha={modal.fecha}
          cita={modal.cita}
          pacienteInicial={modal.paciente}
          centroId={centro.centroActivo || undefined}
          tipos={tipos}
          medicos={medicos}
          onOpenChange={(o) => !o && setModal(null)}
          onSaved={reload}
        />
      )}
      <PacienteFormSheet open={newPatientOpen} onOpenChange={setNewPatientOpen} onSaved={() => setNewPatientOpen(false)} />
    </div>
  );
}
