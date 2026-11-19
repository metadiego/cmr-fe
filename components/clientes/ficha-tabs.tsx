"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";

import { listCitasEveryCenter, getTiposCita, type Cita, type TipoCita } from "@/lib/api/citas";
import { getHistorialPaciente, type HistorialSesion } from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { parseAcciones } from "@/lib/frontdesk/acciones";
import { FormatosModal } from "@/components/frontdesk/formatos-modal";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { LegacyLabelDialog } from "@/components/clientes/legacy-label-dialog";
import { LegacyRenumberDialog } from "@/components/clientes/legacy-renumber-dialog";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HistorialDialog } from "@/components/citas/cita-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingPanel, Panel, RecordTable, Td, Th } from "@/components/kit/panel";
import { StatusBadge } from "@/components/kit/status-badge";

// Tabs of the patient record (hub): each one calls ONLY its own endpoint (nothing recomputes what the
// BE already sums). Kept out of the page to keep it under the ceiling. Handoff
// ficha-del-paciente-hub-y-certificacion-de-gastos.

// Month FIRST (US/PR business), the same in es and en: MM/DD/YYYY. Explicit en-US locale on purpose
// (allowed by rule 3b): named formats follow the locale's order and Spanish would put the day first.
// UTC + parseDayUTC: a BE day is a day, not an instant.
const monthFirst = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });

function useDia() {
  return (iso?: string | null) => {
    if (!iso) return "—";
    const d = parseDayUTC(iso);
    return d ? monthFirst.format(d) : String(iso);
  };
}

// Today as the BE writes a day (YYYY-MM-DD), in the browser's calendar.
function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const byDateTimeDesc = (a: Cita, b: Cita) =>
  `${b.date ?? ""} ${b.time ?? ""}`.localeCompare(`${a.date ?? ""} ${a.time ?? ""}`);

type AppointmentView = "all" | "upcoming" | "past";

// The patient's appointments in every clinic the person can read, each with its clinic. Upcoming
// ones (today onwards) can be split from past ones; upcoming read soonest-first, past newest-first.
export function FichaCitas({ pacienteId }: { pacienteId: string }) {
  const t = useTranslations("patients.hub");
  const dia = useDia();
  const [histOpen, setHistOpen] = React.useState(false);
  const [view, setView] = React.useState<AppointmentView>("all");
  const citasRes = useResource<{ items: Cita[] }>(() => listCitasEveryCenter({ patientId: pacienteId, limit: 100 }), [pacienteId]);
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const citas = citasRes.state.kind === "ok" ? citasRes.state.data.items : [];
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const tipoNombre = (id?: string | null) => tipos.find((x) => x.id === id)?.name ?? "—";
  // The doctor of EACH appointment is projected by the BE as `doctorName` (resolved across centers;
  // not in the generated type yet, hence the cast). It is that appointment's doctor, not a roster one.
  const medicoNombre = (c: Cita) => (c as { doctorName?: string | null }).doctorName ?? "—";

  const today = todayIso();
  const upcoming = citas.filter((c) => (c.date ?? "") >= today).sort((a, b) => -byDateTimeDesc(a, b));
  const past = citas.filter((c) => (c.date ?? "") < today).sort(byDateTimeDesc);
  const rows = view === "upcoming" ? upcoming : view === "past" ? past : [...upcoming].reverse().concat(past);

  if (citasRes.state.kind === "loading") return <LoadingPanel />;
  if (citasRes.state.kind === "fail") return <ErrorState message={citasRes.state.message} />;
  return (
    <>
      <Panel
        description={t("appointmentsCount", { n: citas.length })}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as AppointmentView)}>
              <TabsList>
                <TabsTrigger value="all">{t("appointmentsAll")} <Count n={citas.length} /></TabsTrigger>
                <TabsTrigger value="upcoming">{t("appointmentsUpcoming")} <Count n={upcoming.length} /></TabsTrigger>
                <TabsTrigger value="past">{t("appointmentsPast")} <Count n={past.length} /></TabsTrigger>
              </TabsList>
            </Tabs>
            {/* The reschedule trail is NOT listed here (the BE no longer returns `reprogramada`): it sits
                behind this button. Handoff be-citas-el-rastro-va-detras-de-un-boton. */}
            <Button variant="ghost" size="sm" onClick={() => setHistOpen(true)}>
              <HugeiconsIcon icon={Clock01Icon} className="size-4" />
              {t("historialReagendamientos")}
            </Button>
          </>
        }
      >
        {citas.length === 0 ? (
          <EmptyState>{t("noCitas")}</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>{t("nothingInView")}</EmptyState>
        ) : (
          <RecordTable
            head={
              <>
                <Th>{t("date")}</Th>
                <Th>{t("type")}</Th>
                <Th>{t("doctor")}</Th>
                <Th>{t("clinic")}</Th>
                <Th>{t("status")}</Th>
              </>
            }
          >
            {rows.map((c) => (
              <tr key={c.id} className={cn("hover:bg-muted/30", c.date === today && "bg-info/30")}>
                <Td className="whitespace-nowrap">
                  <span className="font-medium tabular-nums">{dia(c.date)}</span>
                  {c.time && <span className="ml-1.5 text-muted-foreground tabular-nums">{c.time}</span>}
                  {c.date === today && <Badge variant="info" className="ml-2">{t("today")}</Badge>}
                </Td>
                <Td className="font-medium">{tipoNombre(c.appointmentTypeId)}</Td>
                <Td className="text-muted-foreground">{medicoNombre(c)}</Td>
                <Td className="text-muted-foreground">{c.clinicName ?? "—"}</Td>
                <Td><StatusBadge kind="appointment" value={c.status} /></Td>
              </tr>
            ))}
          </RecordTable>
        )}
      </Panel>
      {histOpen && <ReagendamientosDialog pacienteId={pacienteId} onClose={() => setHistOpen(false)} />}
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-xs text-muted-foreground tabular-nums">{n}</span>;
}

// Modal with the patient's RESCHEDULED appointments (date, time, reason). Each opens its full
// before→after trail through HistorialDialog. GET /appointments?patientId&status=reprogramada.
function ReagendamientosDialog({ pacienteId, onClose }: { pacienteId: string; onClose: () => void }) {
  const t = useTranslations("patients.hub");
  const tc = useTranslations("common");
  const dia = useDia();
  const res = useResource<{ items: Cita[] }>(
    () => listCitasEveryCenter({ patientId: pacienteId, status: "reprogramada", limit: 100 }),
    [pacienteId],
  );
  const [trace, setTrace] = React.useState<Cita | null>(null);
  const items = res.state.kind === "ok" ? res.state.data.items : [];
  const sorted = [...items].sort(byDateTimeDesc);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("historialReagendamientos")}</DialogTitle>
        </DialogHeader>
        {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
        {res.state.kind === "fail" && <ErrorState message={res.state.message} />}
        {res.state.kind === "ok" && sorted.length === 0 && <EmptyState bare>{t("noReagendamientos")}</EmptyState>}
        {sorted.length > 0 && (
          <ol className="divide-y overflow-hidden rounded-lg border">
            {sorted.map((c) => (
              <li key={c.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium tabular-nums">{dia(c.date)}{c.time ? ` · ${c.time}` : ""}</span>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setTrace(c)}>{t("verRastro")}</Button>
                </div>
                {c.reason && <p className="mt-1 text-xs text-muted-foreground">{c.reason}</p>}
              </li>
            ))}
          </ol>
        )}
        {trace && <HistorialDialog cita={trace} onClose={() => setTrace(null)} />}
      </DialogContent>
    </Dialog>
  );
}

// Before, the ONLY way to a format (GLP-1, APEX…) was the day's frontdesk board, hunting for the
// right row there — and that hunt caused a mistaken "unattend" on another row (06-nov-2026). The
// engine (FormatosModal) was already reusable; it is offered here per session, like on the board row.
export function FichaTerapias({
  pacienteId,
  pacienteNombre,
  record,
  centro,
}: {
  pacienteId: string;
  pacienteNombre: string;
  record?: string | null;
  centro?: string;
}) {
  const t = useTranslations("patients.hub");
  const dia = useDia();
  const [filter, setFilter] = React.useState<string>(""); // "" = all; otherwise serviceId/name
  const [formatRow, setFormatRow] = React.useState<HistorialSesion | null>(null);
  // Legacy «n/m» fixes (cmr-be #641): only migrated rows, only with the availability-edit permission and a center.
  const { can } = useCan();
  const tl = useTranslations("legacyLabel");
  const canFix = !!centro && can("frontdesk.disponibilidad.editar");
  const [labelRow, setLabelRow] = React.useState<HistorialSesion | null>(null);
  const [renumberOpen, setRenumberOpen] = React.useState(false);
  const res = useResource<HistorialSesion[]>(() => getHistorialPaciente(pacienteId, undefined, centro), [pacienteId, centro]);
  const serviciosRes = useResource<Servicio[]>(() => getServicios(centro), [centro]);
  const servicioPorId = React.useMemo(
    () => new Map((serviciosRes.state.kind === "ok" ? serviciosRes.state.data : []).map((s) => [s.id, s])),
    [serviciosRes.state],
  );
  const reportsOf = (serviceId: string) => parseAcciones(servicioPorId.get(serviceId)?.formActions).reports ?? [];
  const hist = React.useMemo(() => (res.state.kind === "ok" ? res.state.data : []), [res.state]);
  const serviceKey = (s: HistorialSesion) => s.serviceId ?? s.serviceName ?? "";
  // The filter only offers services the patient ALREADY has.
  const services = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of hist) {
      const k = serviceKey(s);
      if (k) m.set(k, s.serviceName ?? k);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [hist]);
  const rows = [...hist]
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .filter((s) => !filter || serviceKey(s) === filter);

  const filteredService = filter ? hist.find((s) => s.serviceId === filter) : undefined;
  const canRenumber = canFix && !!filteredService && rows.some((s) => s.migrated);

  if (res.state.kind === "loading") return <LoadingPanel />;
  if (res.state.kind === "fail") return <ErrorState message={res.state.message} />;
  return (
    <Panel
      description={hist.length > 0 ? t("sessionsCount", { n: rows.length }) : undefined}
      actions={
        // Only when there is more than one service: with one, filtering does nothing.
        <>
        {canRenumber && (
          <Button variant="outline" size="sm" onClick={() => setRenumberOpen(true)}>{tl("renumber")}</Button>
        )}
        {services.length > 1 ? (
          <Select value={filter || "__all__"} onValueChange={(v) => setFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("allServices")}</SelectItem>
              {services.map(([k, name]) => (
                <SelectItem key={k} value={k}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        </>
      }
    >
      {hist.length === 0 ? (
        <EmptyState>{t("noTerapias")}</EmptyState>
      ) : (
        <RecordTable
          head={
            <>
              <Th>{t("date")}</Th>
              <Th>{t("service")}</Th>
              <Th>{t("session")}</Th>
              <Th>{t("technician")}</Th>
              <Th>{t("status")}</Th>
              <Th right>{t("formats")}</Th>
            </>
          }
        >
          {rows.map((s) => {
            const reports = reportsOf(s.serviceId);
            return (
              <tr key={s.id} className="hover:bg-muted/30">
                <Td className="font-medium whitespace-nowrap tabular-nums">{dia(s.date)}</Td>
                <Td className="font-medium">{s.serviceName ?? "—"}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <SessionProgress n={s.sesionNumero} total={s.totalSessions} />
                    {canFix && s.migrated && (
                      <Button variant="ghost" size="icon" className="size-7" aria-label={tl("correct")} title={tl("correct")} onClick={() => setLabelRow(s)}>
                        <HugeiconsIcon icon={PencilEdit02Icon} className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </Td>
                <Td className="text-muted-foreground">{s.staffNombre ?? "—"}</Td>
                <Td><StatusBadge kind="therapy" value={s.status} /></Td>
                <Td className="text-right">
                  {reports.length > 0 ? (
                    <Button variant="outline" size="sm" onClick={() => setFormatRow(s)}>{t("formats")}</Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </RecordTable>
      )}
      {labelRow && centro && (
        <LegacyLabelDialog
          open
          onOpenChange={(o) => !o && setLabelRow(null)}
          session={{
            id: labelRow.id,
            number: labelRow.sesionNumero,
            total: labelRow.totalSessions,
            label: `${dia(labelRow.date)} · ${labelRow.serviceName ?? ""} · ${labelRow.sesionNumero ?? "—"}/${labelRow.totalSessions ?? "—"}`,
          }}
          centerId={centro}
          onDone={() => res.refresh()}
        />
      )}
      {renumberOpen && filteredService && centro && (
        <LegacyRenumberDialog
          open
          onOpenChange={setRenumberOpen}
          patientId={pacienteId}
          service={{ id: filteredService.serviceId, name: filteredService.serviceName ?? "" }}
          centerId={centro}
          day={dia}
          onDone={() => res.refresh()}
        />
      )}
      {formatRow && (
        <FormatosModal
          open={!!formatRow}
          onOpenChange={(o) => !o && setFormatRow(null)}
          servicioNombre={formatRow.serviceName ?? ""}
          formAcciones={servicioPorId.get(formatRow.serviceId)?.formActions}
          pacienteNombre={pacienteNombre}
          record={record}
          sesionNN={formatRow.sesionNumero != null && formatRow.totalSessions != null ? `${formatRow.sesionNumero}/${formatRow.totalSessions}` : undefined}
          servicioId={formatRow.serviceId}
          pacienteId={pacienteId}
          tecnicoNombre={formatRow.staffNombre}
          sesionId={formatRow.id}
          fecha={formatRow.date}
          centro={centro}
          onApplied={() => res.refresh()}
        />
      )}
    </Panel>
  );
}

// "3/10" with a thin bar, so where the patient is in a package reads at a glance.
function SessionProgress({ n, total }: { n: number | null; total: number | null }) {
  if (n == null || total == null || total <= 0) return <span className="text-muted-foreground">—</span>;
  const pct = Math.min(100, Math.round((n / total) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-sm tabular-nums">{n}/{total}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// The «Facturación» tab lives in its own file (full history, paginated).
export { FichaFacturacion } from "@/components/clientes/ficha-facturacion";

// «Last visit» card of the summary: the patient's most recent appointment, in any clinic the person can read.
export function FichaUltimaVisita({ pacienteId }: { pacienteId: string }) {
  const t = useTranslations("patients.hub");
  const dia = useDia();
  const citasRes = useResource<{ items: Cita[] }>(() => listCitasEveryCenter({ patientId: pacienteId, limit: 100 }), [pacienteId]);
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const citas = citasRes.state.kind === "ok" ? citasRes.state.data.items : [];
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const today = todayIso();
  const last = citas.filter((c) => c.date && c.date <= today).sort(byDateTimeDesc)[0];
  const typeName = (id?: string | null) => tipos.find((x) => x.id === id)?.name ?? "—";
  return (
    <Panel title={t("lastVisit")}>
      {citasRes.state.kind === "loading" ? (
        <div className="px-5 py-4"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></div>
      ) : last ? (
        <div className="space-y-1.5 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{typeName(last.appointmentTypeId)}</span>
            <StatusBadge kind="appointment" value={last.status} />
          </div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {dia(last.date)}{last.time ? ` · ${last.time}` : ""}
            {last.clinicName ? ` · ${last.clinicName}` : ""}
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 text-sm text-muted-foreground">{t("noLastVisit")}</div>
      )}
    </Panel>
  );
}
