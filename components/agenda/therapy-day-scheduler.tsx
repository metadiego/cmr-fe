"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon, DragDropIcon } from "@hugeicons/core-free-icons";

import { getServicios, type Servicio } from "@/lib/api/servicios";
import { agendarVariosServicios, getServiciosConSaldo, type ServicioConSaldo } from "@/lib/api/frontdesk";
import {
  getAvailability,
  planPatientDay,
  type Availability,
  type PatientDayResult,
} from "@/lib/api/resources";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { toastError } from "@/lib/api/errors";
import { type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// COCKPIT PARTIDO — la pieza que ve el mostrador al citar terapias (aprobado por el dueño 26-sep, sobre su
// visión del 24). IZQUIERDA: paciente + récord (héroe) y las terapias del día como mini-tarjetas de color con
// sus áreas. DERECHA: al elegir una tarjeta se abren las HORAS del día y PARPADEAN solo donde de verdad cabe
// —puesto físico Y técnico (el BE lo resuelve: reasonKey full/noStaff/overMaxPerPatient)—; se arrastra la
// tarjeta al hueco o se hace clic. ABAJO: el tiempo REAL en la clínica + avisos (bloqueo de la doctora) y
// agendar. Una sola pieza: ruta aparte, modal del calendario de servicios y «Citar» del frontdesk.
// Reserva por el MISMO endpoint del frontdesk (book-multiple). Handoff HANDOFF-FE-agenda-de-terapias.

export type PatientLite = { id: string; name: string; record?: string | null; phone?: string | null };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "·";
}

export function TherapyDayScheduler({
  defaultDate,
  defaultPatient,
  lockedPatient,
  centro,
  onBooked,
}: {
  defaultDate?: string;
  defaultPatient?: Paciente | null;
  // Paciente FIJADO (p. ej. desde «Citar» tras Asistir): se muestra el héroe y no se pide buscar.
  lockedPatient?: PatientLite;
  centro?: string;
  onBooked?: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  const tp = useTranslations("programarCitas");
  const tRoot = useTranslations();

  const asLite = (p: Paciente): PatientLite => ({
    id: p.id,
    name: p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ").trim(),
    record: p.medicalRecordNumber,
    phone: p.phone,
  });

  const [paciente, setPaciente] = React.useState<PatientLite | null>(
    lockedPatient ?? (defaultPatient ? asLite(defaultPatient) : null),
  );
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [areas, setAreas] = React.useState<Record<string, number>>({});
  const [selId, setSelId] = React.useState<string>("");
  const [date, setDate] = React.useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = React.useState("");
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const areasOf = (id: string) => areas[id] ?? 1;

  const servRes = useResource<Servicio[]>(() => getServicios(centro), [centro]);
  const servicios = servRes.state.kind === "ok" ? servRes.state.data : [];
  const servById = React.useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);

  // Servicios comprados con saldo pendiente (para agregar de un toque). Degrada a [] si el endpoint falla.
  const saldoRes = useResource<ServicioConSaldo[]>(
    () => (paciente ? getServiciosConSaldo(paciente.id, centro).catch(() => []) : Promise.resolve([])),
    [paciente?.id, centro],
  );
  const saldo = saldoRes.state.kind === "ok" ? saldoRes.state.data : [];

  const chosen = servicios.filter((s) => sel.has(s.id));
  // Tarjeta activa (sus horas se muestran). Si la seleccionada ya no está, cae en la primera elegida.
  const selEff = sel.has(selId) ? selId : chosen[0]?.id ?? "";
  const serviceIds = React.useMemo(() => [...sel], [sel]);

  // Huecos del servicio activo — parpadean los que caben (puesto + técnico). Cambia con fecha/servicio/áreas.
  const availRes = useResource<Availability | null>(
    () => (selEff ? getAvailability({ date, serviceId: selEff, areas: areasOf(selEff) }, centro) : Promise.resolve(null)),
    [selEff, date, areas[selEff], centro],
  );
  const avail = availRes.state.kind === "ok" ? availRes.state.data : null;

  // El día completo a la hora elegida: minutos REALES en la clínica + avisos (bloqueo de la doctora).
  const planRes = useResource<PatientDayResult | null>(
    () => (time && serviceIds.length ? planPatientDay({ serviceIds, date, time }, centro) : Promise.resolve(null)),
    [time, date, serviceIds.join(","), centro],
  );
  const plan = planRes.state.kind === "ok" ? planRes.state.data : null;

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setSelId(id);
    setTime("");
  }
  function removeService(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setTime("");
  }
  function changeDate(d: string) {
    setDate(d);
    setTime("");
  }
  function reason(sl: { fits: boolean; freeStations?: number; reasonKey?: string | null }) {
    if (sl.fits) return sl.freeStations != null ? t("freeStations", { n: sl.freeStations }) : "";
    if (sl.reasonKey && tRoot.has(sl.reasonKey)) return tRoot(sl.reasonKey);
    return sl.reasonKey ?? "";
  }

  const canBook = !!paciente && sel.size > 0 && !!date && !submitting;

  async function book() {
    if (!paciente || sel.size === 0) return;
    setSubmitting(true);
    try {
      const { data, warnings } = await agendarVariosServicios(
        { patientId: paciente.id, serviceIds: [...sel], fechas: [date], time: time || undefined },
        centro,
      );
      const creadas = Array.isArray(data.creadas) ? data.creadas.length : 0;
      const omitidas = Number(data.omitidas ?? 0);
      toast.success(tp("resumen", { creadas, omitidas }));
      mostrarAvisos(warnings, tRoot);
      if (data.aviso) toast.warning(tp("avisoDisponibilidad"));
      onBooked?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSubmitting(false);
    }
  }

  const cap = avail?.resource?.capacity ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[24rem_1fr]">
        {/* ————— IZQUIERDA: paciente + terapias del día ————— */}
        <aside className="space-y-4">
          {/* Héroe del paciente */}
          {paciente ? (
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 ring-1 ring-primary/20">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-sm">
                {initials(paciente.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold leading-tight">{paciente.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  {paciente.record && <span>{tRoot("patients.hub.record")} #{paciente.record}</span>}
                  {paciente.phone && <span>· {paciente.phone}</span>}
                </div>
                {!lockedPatient && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-primary hover:underline"
                    onClick={() => {
                      setPaciente(null);
                      setSel(new Set());
                      setTime("");
                    }}
                  >
                    {t("change")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("pickPatient")}</label>
              <PacienteSelect value={null} onChange={(p) => p && setPaciente(asLite(p))} />
              <p className="text-xs text-muted-foreground">{t("choosePatientFirst")}</p>
            </div>
          )}

          {/* Comprados con saldo — agregar de un toque */}
          {paciente && saldo.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("bought")}</label>
              <div className="flex flex-wrap gap-1.5">
                {saldo.map((s) => {
                  const on = sel.has(s.serviceId);
                  return (
                    <button
                      key={s.serviceId}
                      type="button"
                      onClick={() => toggle(s.serviceId)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
                      )}
                    >
                      {s.name}
                      <span className="ml-1 opacity-70">· {t("remaining", { n: s.pending })}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terapias del día (mini-tarjetas) + agregar */}
          {paciente && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("pickServices")}</label>
                <AddTherapy
                  servicios={servicios.filter((s) => !sel.has(s.id))}
                  onAdd={(id) => toggle(id)}
                  label={t("addTherapy")}
                />
              </div>
              {chosen.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("noServices")}
                </p>
              ) : (
                <div className="space-y-2">
                  {chosen.map((s) => {
                    const active = selEff === s.id;
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => {
                          setSelId(s.id);
                          e.dataTransfer.setData("text/plain", s.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => {
                          setSelId(s.id);
                          setTime("");
                        }}
                        className={cn(
                          "group flex cursor-grab items-center gap-2 rounded-lg border-l-4 bg-card p-2.5 pl-3 ring-1 transition-all active:cursor-grabbing",
                          active ? "shadow-md ring-primary/40" : "ring-foreground/10 hover:ring-foreground/20",
                        )}
                        style={{ borderLeftColor: s.color ?? "#4a90d9" }}
                      >
                        <HugeiconsIcon icon={DragDropIcon} className="size-4 shrink-0 text-muted-foreground/50" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{s.name}</div>
                          <label
                            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t("areas")}
                            <Input
                              type="number"
                              min={1}
                              value={areasOf(s.id)}
                              onChange={(e) => {
                                setAreas((a) => ({ ...a, [s.id]: Math.max(1, Number(e.target.value) || 1) }));
                                if (s.id === selEff) setTime("");
                              }}
                              className="h-6 w-14 px-1 py-0 text-xs"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeService(s.id);
                          }}
                          className="shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label={tRoot("common.delete")}
                        >
                          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ————— DERECHA: horas del servicio activo ————— */}
        <section className="rounded-xl bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">
                {selEff ? t("hoursFor", { service: servById.get(selEff)?.name ?? "" }) : t("pickCard")}
              </div>
              {avail?.configured && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("minutes", { n: avail.minutes })}
                  {avail.resource ? ` · ${t("capacity", { n: avail.resource.capacity })}` : ""}
                </div>
              )}
            </div>
            <label className="text-sm">
              <span className="mr-2 text-muted-foreground">{t("date")}</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => changeDate(e.target.value)}
                className="inline-block h-9 w-auto"
              />
            </label>
          </div>

          {!selEff ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("pickCard")}</p>
          ) : availRes.state.kind === "loading" ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>
          ) : availRes.state.kind === "fail" ? (
            <p className="text-sm text-destructive">{availRes.state.message}</p>
          ) : avail && !avail.configured ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
              {t("notConfigured")}
            </p>
          ) : avail ? (
            <>
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={DragDropIcon} className="size-3.5" />
                {t("dragHint")}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {avail.slots.map((sl) => {
                  const active = time === sl.time;
                  const free = sl.freeStations ?? (sl.fits ? 1 : 0);
                  const over = dragOver === sl.time;
                  return (
                    <button
                      key={sl.time}
                      type="button"
                      disabled={!sl.fits}
                      title={reason(sl)}
                      onClick={() => sl.fits && setTime(sl.time)}
                      onDragOver={(e) => {
                        if (sl.fits) {
                          e.preventDefault();
                          setDragOver(sl.time);
                        }
                      }}
                      onDragLeave={() => setDragOver((d) => (d === sl.time ? null : d))}
                      onDrop={(e) => {
                        if (!sl.fits) return;
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        if (id) setSelId(id);
                        setTime(sl.time);
                        setDragOver(null);
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-lg border p-2 text-left transition-all",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : sl.fits
                            ? "animate-pulse border-success/40 bg-success/10 hover:animate-none hover:bg-success/20"
                            : "cursor-not-allowed border-dashed border-muted-foreground/25 bg-muted/20 text-muted-foreground/40",
                        over && "scale-105 ring-2 ring-success",
                      )}
                    >
                      <span className="font-mono text-sm font-semibold tabular-nums">{sl.time}</span>
                      {/* Barra de puestos: llenos vs libres */}
                      {cap > 0 && sl.fits && (
                        <span className="mt-1 flex gap-0.5">
                          {Array.from({ length: cap }).map((_, i) => (
                            <span
                              key={i}
                              className={cn(
                                "h-1.5 w-2 rounded-sm",
                                i < cap - free ? "bg-current opacity-30" : "bg-success",
                              )}
                            />
                          ))}
                        </span>
                      )}
                      <span className={cn("mt-1 text-[10px]", active ? "opacity-90" : "opacity-70")}>
                        {sl.fits ? t("freeStations", { n: free }) : reason(sl)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* ————— ABAJO: resumen vivo + agendar ————— */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
        <div className="min-w-0 space-y-1 text-sm">
          {!time ? (
            <p className="text-muted-foreground">{t("noHour")}</p>
          ) : planRes.state.kind === "loading" ? (
            <p className="text-muted-foreground">{tRoot("common.loading")}</p>
          ) : plan ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {plan.ok ? <Badge variant="success">{t("fits")}</Badge> : <Badge variant="destructive">{t("noFits")}</Badge>}
                <span className="font-medium">{t("startAt", { time })}</span>
                <span className="text-muted-foreground">· {t("patientMinutes", { n: plan.minutosDelPaciente })}</span>
              </div>
              {!plan.ok && plan.reasonKey && (
                <p className="text-destructive">{tRoot.has(plan.reasonKey) ? tRoot(plan.reasonKey) : plan.reasonKey}</p>
              )}
              {plan.sinRecurso.length > 0 && (
                <p className="text-warning-foreground">{t("sinRecurso", { list: plan.sinRecurso.join(", ") })}</p>
              )}
              {plan.staffBlocks.map((b, i) => (
                <p key={i} className="text-warning-foreground">{t("staffBlock", { from: b.from, to: b.to })}</p>
              ))}
            </>
          ) : null}
        </div>
        <Button size="lg" onClick={book} disabled={!canBook}>
          {submitting ? tRoot("common.saving") : t("bookN", { n: sel.size })}
        </Button>
      </div>
    </div>
  );
}

// «Agregar terapia»: un select compacto de los servicios aún no elegidos.
function AddTherapy({
  servicios,
  onAdd,
  label,
}: {
  servicios: Servicio[];
  onAdd: (id: string) => void;
  label: string;
}) {
  if (servicios.length === 0) return null;
  return (
    <Select value="" onValueChange={onAdd}>
      <SelectTrigger className="h-8 w-auto gap-1 border-dashed text-xs">
        <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {servicios.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color ?? "#4a90d9" }} />
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
