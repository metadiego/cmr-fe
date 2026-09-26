"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Add01Icon } from "@hugeicons/core-free-icons";

import { listSesionesRango, type Sesion, type EstadoSesion } from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { listPersonal } from "@/lib/api/personal";
import { getAvailability, type Availability } from "@/lib/api/resources";
import { useResource } from "@/hooks/use-resource";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { usePacienteMap } from "@/lib/agenda/use-paciente-map";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kpi, Chip } from "@/components/agenda/dia-kpi";
import { PlanificarDiaModal } from "@/components/agenda/planificar-dia-modal";
import { PageContainer } from "@/components/ui/page";
import type { Paciente } from "@/lib/api/pacientes";

const ALL = "__all__";

// Vista de DÍA de citas de servicio: el mismo panorama amplio que la vista-día de consultas (KPIs + lista +
// filtros), más las HORAS con puestos libres/llenos del recurso a golpe de vista cuando se filtra un servicio.
// Sustituye la vieja alta a ciegas: el clic en la fecha del calendario de servicios entra aquí. Planificar
// abre el MISMO scheduler reutilizable con la fecha puesta.
export function ServiceDayView({ fecha }: { fecha: string }) {
  const t = useTranslations("serviceDay");
  const tEstado = useTranslations("frontdesk.histEstadoVal");
  const tPlanner = useTranslations("therapyPlanner");
  const tRoot = useTranslations();
  const tc = useTranslations("common");
  const tAgenda = useTranslations("agenda");
  const format = useFormatter();

  const centro = useCentroPantalla("frontdesk.read", "frontdesk.create");
  const [servicioId, setServicioId] = React.useState(ALL);
  const [estado, setEstado] = React.useState<EstadoSesion | typeof ALL>(ALL);
  const [pacienteQ, setPacienteQ] = React.useState("");
  const [planFor, setPlanFor] = React.useState<{ paciente?: Paciente | null } | null>(null);

  const serviciosRes = useResource<Servicio[]>(() => getServicios(centro.fetchCentroId), [centro.fetchCentroId]);
  const servicios = serviciosRes.state.kind === "ok" ? serviciosRes.state.data : [];
  const servById = React.useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);

  const personalRes = useResource(() => listPersonal({ limit: 100 }, centro.fetchCentroId), [centro.fetchCentroId]);
  const personalById = React.useMemo(() => {
    const m = new Map<string, string>();
    if (personalRes.state.kind === "ok") {
      for (const p of personalRes.state.data.items) {
        m.set(p.id, [p.name, p.lastName].filter(Boolean).join(" ").trim());
      }
    }
    return m;
  }, [personalRes.state]);

  const { state, reload } = useResource<Sesion[]>(
    () => listSesionesRango({ desde: fecha, hasta: fecha, centroId: centro.fetchCentroId }),
    [fecha, centro.fetchCentroId],
  );
  const sesiones = React.useMemo(() => (state.kind === "ok" ? state.data : []), [state]);

  // Refresco vivo cada 20 s (igual que los calendarios).
  React.useEffect(() => {
    const id = setInterval(reload, 20000);
    return () => clearInterval(id);
  }, [reload]);

  const pacientes = usePacienteMap(sesiones.map((s) => s.patientId));

  // El día, sin canceladas, es lo que cuenta para el panorama.
  const vivas = React.useMemo(() => sesiones.filter((s) => s.status !== "cancelada"), [sesiones]);
  const kpis = React.useMemo(() => {
    let present = 0, attended = 0, pending = 0;
    for (const s of vivas) {
      if (s.status === "asistido") attended++;
      else if (s.status === "presente" || s.status === "en_terapia") present++;
      else if (s.status === "pendiente") pending++;
    }
    return { total: vivas.length, present, attended, pending };
  }, [vivas]);

  // Chips: Todos + un chip por servicio presente ese día, con su conteo y color.
  const porServicio = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of vivas) m.set(s.serviceId, (m.get(s.serviceId) ?? 0) + 1);
    return [...m.entries()]
      .map(([id, n]) => ({ id, n, name: servById.get(id)?.name ?? "…", color: servById.get(id)?.color ?? "#4a90d9" }))
      .sort((a, b) => b.n - a.n);
  }, [vivas, servById]);

  // Conteo por estado (para los chips) — sobre el filtro de servicio, no sobre el de estado.
  const porEstado = React.useMemo(() => {
    const base = servicioId === ALL ? vivas : vivas.filter((s) => s.serviceId === servicioId);
    const m = new Map<EstadoSesion, number>();
    for (const s of base) m.set(s.status, (m.get(s.status) ?? 0) + 1);
    return m;
  }, [vivas, servicioId]);

  const q = pacienteQ.trim().toLowerCase();
  const filtradas = React.useMemo(() => {
    return vivas
      .filter((s) => servicioId === ALL || s.serviceId === servicioId)
      .filter((s) => estado === ALL || s.status === estado)
      .filter((s) => {
        if (!q) return true;
        const p = pacientes[s.patientId];
        const nombre = p ? (p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ")) : "";
        return nombre.toLowerCase().includes(q) || (p?.medicalRecordNumber ?? "").toLowerCase().includes(q);
      })
      .slice()
      .sort(sortByTime);
  }, [vivas, servicioId, estado, q, pacientes]);

  // Huecos por hora del servicio filtrado (solo si tiene recurso configurado). Panorama del cuello de botella.
  const availRes = useResource<Availability | null>(
    () => (servicioId !== ALL ? getAvailability({ date: fecha, serviceId: servicioId, areas: 1 }, centro.fetchCentroId) : Promise.resolve(null)),
    [servicioId, fecha, centro.fetchCentroId],
  );
  const avail = availRes.state.kind === "ok" ? availRes.state.data : null;

  const dayTitle = format.dateTime(parseDayUTC(fecha) ?? new Date(), "dayLong");
  const prev = shiftDay(fecha, -1);
  const next = shiftDay(fecha, +1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageContainer>
      <Link
        href="/scheduling/appointments?tab=servicios"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        {tc("back")}
      </Link>

      {/* Cabecera: día + navegación + centro + planificar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold capitalize">{dayTitle}</h1>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" aria-label="prev">
            <Link href={`/scheduling/appointments/${prev}?tab=servicios`}>‹</Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="next">
            <Link href={`/scheduling/appointments/${next}?tab=servicios`}>›</Link>
          </Button>
          {fecha !== today && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/scheduling/appointments/${today}?tab=servicios`}>{tAgenda("today")}</Link>
            </Button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CentroPantallaSelector estado={centro} />
          {centro.puedeEscribir && (
            <Button onClick={() => setPlanFor({})}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              {t("plan")}
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("kpi.total")} value={kpis.total} />
        <Kpi label={t("kpi.present")} value={kpis.present} tono="ok" />
        <Kpi label={t("kpi.attended")} value={kpis.attended} tono="muted" />
        <Kpi label={t("kpi.pending")} value={kpis.pending} tono="warn" />
      </div>

      {/* Filtro por servicio (terapia) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("filterService")}</span>
        <Chip active={servicioId === ALL} onClick={() => setServicioId(ALL)}>
          {t("all")} ({vivas.length})
        </Chip>
        {porServicio.map((s) => (
          <Chip key={s.id} active={servicioId === s.id} onClick={() => setServicioId(s.id)}>
            <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: s.color }} />
            {s.name} ({s.n})
          </Chip>
        ))}
      </div>

      {/* Filtro por estado + búsqueda por paciente */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("filterStatus")}</span>
        <Chip active={estado === ALL} onClick={() => setEstado(ALL)}>{t("all")}</Chip>
        {(["pendiente", "presente", "en_terapia", "asistido"] as EstadoSesion[]).map((e) => (
          <Chip key={e} active={estado === e} onClick={() => setEstado(e)}>
            {tEstado(e)} ({porEstado.get(e) ?? 0})
          </Chip>
        ))}
        <div className="ml-auto w-full sm:w-64">
          <Input value={pacienteQ} onChange={(ev) => setPacienteQ(ev.target.value)} placeholder={t("searchPatient")} className="h-9" />
        </div>
      </div>

      {/* Huecos por hora del servicio filtrado (parpadean los libres; apagados los llenos) */}
      {servicioId !== ALL && (
        <div className="mb-5 rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <div className="mb-2 text-sm font-semibold">
            {t("occupancy", { service: servById.get(servicioId)?.name ?? "" })}
          </div>
          {availRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
          {avail && !avail.configured && <p className="text-sm text-muted-foreground">{tPlanner("notConfigured")}</p>}
          {avail && avail.configured && (
            <div className="flex flex-wrap gap-2">
              {avail.slots.map((sl) => (
                <div
                  key={sl.time}
                  title={sl.fits ? (sl.freeStations != null ? tPlanner("freeStations", { n: sl.freeStations }) : "") : reasonText(sl.reasonKey, tRoot)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 font-mono text-sm tabular-nums",
                    sl.fits
                      ? "animate-pulse border-success/50 bg-success/10 text-success-foreground"
                      : "border-dashed border-muted-foreground/30 text-muted-foreground/40",
                  )}
                >
                  {sl.time}
                  {sl.fits && sl.freeStations != null && <span className="ml-1 text-[10px] opacity-70">({sl.freeStations})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista del día */}
      {state.kind === "fail" ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("col.time")}</th>
                <th className="px-3 py-2 font-medium">{t("col.service")}</th>
                <th className="px-3 py-2 font-medium">{t("col.patient")}</th>
                <th className="px-3 py-2 font-medium">{t("col.qty")}</th>
                <th className="px-3 py-2 font-medium">{t("col.staff")}</th>
                <th className="px-3 py-2 font-medium">{t("col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => {
                const p = pacientes[s.patientId];
                const nombre = p ? p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ") : "…";
                const serv = servById.get(s.serviceId);
                const staff = s.technicianId ?? s.nurseId ?? s.doctorId;
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{s.time ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: serv?.color ?? "#4a90d9" }} />
                        {serv?.name ?? "…"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{nombre}</td>
                    <td className="px-3 py-2 tabular-nums">{s.quantity}</td>
                    <td className="px-3 py-2 text-muted-foreground">{staff ? personalById.get(staff) ?? "—" : "—"}</td>
                    <td className="px-3 py-2">
                      <EstadoBadge estado={s.status} label={tEstado(s.status)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {planFor && (
        <PlanificarDiaModal
          open
          fecha={fecha}
          paciente={planFor.paciente}
          centro={centro.centroActivo || undefined}
          onOpenChange={(o) => !o && setPlanFor(null)}
          onSaved={reload}
        />
      )}
    </PageContainer>
  );
}

function sortByTime(a: Sesion, b: Sesion): number {
  // Con hora primero (orden natural), luego las sin hora (day-based) al final.
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return 0;
}

function shiftDay(iso: string, delta: number): string {
  const d = parseDayUTC(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function reasonText(reasonKey: string | null | undefined, tRoot: { has: (k: string) => boolean; (k: string): string }): string {
  if (!reasonKey) return "";
  return tRoot.has(reasonKey) ? tRoot(reasonKey) : reasonKey;
}

function EstadoBadge({ estado, label }: { estado: EstadoSesion; label: string }) {
  const tone =
    estado === "asistido" ? "bg-muted text-muted-foreground"
    : estado === "presente" || estado === "en_terapia" ? "bg-success/15 text-success-foreground"
    : estado === "cancelada" ? "bg-destructive/15 text-destructive"
    : "bg-warning/15 text-warning-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}
