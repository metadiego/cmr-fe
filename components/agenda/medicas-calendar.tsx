"use client";

import * as React from "react";
import { sentenceCase } from "@/lib/format/text";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import {
  countByDay,
  getTiposCita,
  type Cita,
  type ConteoPorDia,
  type TipoCita,
} from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getFestivos, type Festivo } from "@/lib/api/disponibilidad";
import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
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
import { ControlSkeleton } from "@/components/kit/skeletons";
import { LegendSkeleton, MonthCalendar, type DayTypeCount } from "@/components/agenda/month-calendar";
import { CitaModal } from "@/components/agenda/cita-modal";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";

const ALL = "__all__";

// Medical appointments calendar (doctor + hora/horaFin). Call-center scheduling.
export function MedicasCalendar() {
  const t = useTranslations("agenda");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const format = useFormatter();
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

  // Month calendar: un número por (día × tipo), no cada cita (BE PR #440, 16-oct-2026) — antes era
  // `listCitasRango` + contar a mano, lo que mandaba CADA cita del mes solo para sumarlas.
  const { state, refresh } = useResource<ConteoPorDia[]>(
    () =>
      countByDay({
        from: desde,
        to: hasta,
        doctorId: medicoEfectivo === ALL ? undefined : medicoEfectivo,
        centroId: centro.fetchCentroId,
      }),
    [desde, hasta, medicoEfectivo, centro.fetchCentroId],
  );
  const conteos = React.useMemo(() => (state.kind === "ok" ? state.data : []), [state]);

  React.useEffect(() => {
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  // Orden del catálogo (no el de llegada de la respuesta); tipo nulo (cita sin tipo) en gris, al final.
  const countsByDate = React.useMemo(() => {
    const porFecha = new Map<string, Map<string | null, number>>();
    for (const row of conteos) {
      const porTipo = porFecha.get(row.date) ?? new Map<string | null, number>();
      porTipo.set(row.appointmentTypeId, row.total);
      porFecha.set(row.date, porTipo);
    }
    const map = new Map<string, DayTypeCount[]>();
    for (const [fecha, porTipo] of porFecha) {
      const list: DayTypeCount[] = tipos
        .filter((tipo) => porTipo.has(tipo.id))
        .map((tipo) => ({
          tipoCitaId: tipo.id,
          total: porTipo.get(tipo.id)!,
          color: tipo.color,
          label: tipo.name,
        }));
      if (porTipo.has(null)) {
        list.push({
          tipoCitaId: null,
          total: porTipo.get(null)!,
          color: "var(--muted-foreground)",
          label: tRoot("citas.calendario.sinTipo"),
        });
      }
      map.set(fecha, list);
    }
    return map;
  }, [conteos, tipos, tRoot]);

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
          {/* Selector de centro EN la pantalla: solo si hay más de uno; chip «Solo lectura» si no puede agendar allí. */}
          <CentroPantallaSelector estado={centro} />
          {/* The doctor list hangs off the centre, so a centre change shows the placeholder again. */}
          {medicosRes.state.kind === "loading" ? (
            <ControlSkeleton className="w-52" />
          ) : (
          <Select value={medicoEfectivo} onValueChange={setMedico}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allDoctors")}</SelectItem>
              {medicos.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {[m.name, m.lastName].filter(Boolean).join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* «Nueva Cita» según el permiso de creación EN el centro elegido, no según «es mi centro». */}
            {centro.puedeEscribir && (
              <Button onClick={() => setModal({ fecha: toISO(new Date()) })}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
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
            countsByDate={countsByDate}
            loading={state.kind === "loading"}
            festivos={festivos}
            // Un número por tipo ya no es una cita individual que editar — clic en el día sigue
            // llevando al día (donde sí se edita cada cita una por una; el rol `citas` llega ahí
            // igual, handoff agenda-abrir-la-cita, sin cambios).
            onDayClick={(iso) => router.push(`/scheduling/appointments/${iso}`)}
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
          <h2 className="mb-2 text-sm font-semibold">{t("typeLegend")}</h2>
          {tiposRes.state.kind === "loading" ? (
            <LegendSkeleton />
          ) : (
          <ul className="space-y-1.5">
            {tipos.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <span className="size-3 rounded-sm" style={{ backgroundColor: x.color }} />
                {x.name}
              </li>
            ))}
          </ul>
          )}
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
          canal="callcenter"
          onOpenChange={(o) => !o && setModal(null)}
          onSaved={refresh}
        />
      )}
      <PacienteFormSheet open={newPatientOpen} onOpenChange={setNewPatientOpen} onSaved={() => setNewPatientOpen(false)} />
    </div>
  );
}
