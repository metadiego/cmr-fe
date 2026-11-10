"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, DragDropIcon } from "@hugeicons/core-free-icons";

import { getServicios, type Servicio } from "@/lib/api/servicios";
import { getServiciosConSaldo, listSesionesRango, type ServicioConSaldo, type Sesion } from "@/lib/api/frontdesk";
import { bookTrain, planPatientTrain, type PatientTrain } from "@/lib/api/resources";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { todayPR, inDaysPR } from "@/lib/format/fecha";
import { toastError } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/types";
import { getMyPreferences } from "@/lib/api/preferences";
import { type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { ExistingSessionsBadge } from "@/components/agenda/existing-sessions-badge";
import { RecurringBookingModal } from "@/components/agenda/recurring-booking-modal";
import { AddTherapySelect } from "@/components/agenda/add-therapy-select";
import { TherapyTrainGrid, trainLegsText } from "@/components/agenda/therapy-train-grid";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanSummarySkeleton } from "@/components/agenda/therapy-day-skeleton";

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
  defaultServiceId,
  centro,
  onBooked,
}: {
  defaultDate?: string;
  defaultPatient?: Paciente | null;
  // Paciente FIJADO (p. ej. desde «Citar» tras Asistir): se muestra el héroe y no se pide buscar.
  lockedPatient?: PatientLite;
  // Preselecciona una tarjeta de servicio al cargar (p. ej. el servicio activo del tablero de
  // Frontdesk, o el de la fila que disparó «Asistido»). Se ignora si no está en el catálogo del centro.
  defaultServiceId?: string;
  centro?: string;
  // `close: true` = el botón «agendar y cerrar»; `close: false` = «agendar y seguir» (limpia la
  // selección y se queda abierto para agregar más terapias al mismo paciente/día).
  onBooked?: (opts: { close: boolean }) => void;
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
  // Preselección de `defaultServiceId` (Frontdesk: servicio activo del tablero, o el de la fila que
  // disparó «Asistido»). Si el id no existe en el catálogo del centro, `chosen`/`servById` (más abajo,
  // derivados de `servicios`) simplemente no lo muestran — no hace falta validar contra el catálogo acá.
  const [sel, setSel] = React.useState<Set<string>>(() => (defaultServiceId ? new Set([defaultServiceId]) : new Set()));
  const [areas, setAreas] = React.useState<Record<string, number>>({});
  const [selId, setSelId] = React.useState<string>(defaultServiceId ?? "");
  const [date, setDate] = React.useState(defaultDate ?? todayPR());
  const [time, setTime] = React.useState("");
  // Apagado por defecto: el motor pone primero lo más pesado (trainWeight) y reordena lo ligero.
  const [keepOrder, setKeepOrder] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  // Which card's "schedule a series" modal is open (its serviceId), or null — additive-only feature,
  // fully independent from the single-date flow above.
  const [recurringFor, setRecurringFor] = React.useState<string | null>(null);

  const areasOf = (id: string) => areas[id] ?? 1;

  const servRes = useResource<Servicio[]>(() => getServicios(centro), [centro]);
  const servicios = servRes.state.kind === "ok" ? servRes.state.data : [];
  const servById = React.useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);

  // Whether the free-slot indicators pulse — a layered preference (system→center→user→override),
  // not a code decision: this exact behavior was flipped by hand twice in one week (removed as a
  // suspected glitch, reverted the same day because the owner likes it). Default true so nobody who
  // hasn't set a preference sees a behavior change. docs/specs/therapy-slot-color-and-blink-config-handoff-be.md
  const prefsRes = useResource(() => getMyPreferences());
  const blinkEnabled = prefsRes.state.kind === "ok" ? (prefsRes.state.data.effective.availability?.blinkEnabled ?? true) : true;

  // Servicios comprados con saldo pendiente (para agregar de un toque). Degrada a [] si el endpoint falla.
  const saldoRes = useResource<ServicioConSaldo[]>(
    () => (paciente ? getServiciosConSaldo(paciente.id, centro).catch(() => []) : Promise.resolve([])),
    [paciente?.id, centro],
  );
  const saldo = saldoRes.state.kind === "ok" ? saldoRes.state.data : [];

  // Sesiones YA agendadas del paciente (hoy en adelante, cualquier servicio): hace visible el doble-agendado
  // — el motivo de esto es real (una técnica citó lo mismo que ya había citado otra). Ventana amplia (120
  // días) para no perder algo agendado bien a futuro; se re-lee sola al cambiar de paciente o tras reagendar.
  // `Date.now()` va DENTRO del fetcher (corre en un efecto, no en render) — llamarlo en render viola la
  // regla de pureza de hooks (react-hooks/purity).
  const upcomingRes = useResource<Sesion[]>(() => {
    if (!paciente) return Promise.resolve([]);
    const hoy = todayPR();
    const horizonte = inDaysPR(120);
    return listSesionesRango({ desde: hoy, hasta: horizonte, pacienteId: paciente.id, centroId: centro });
  }, [paciente?.id, centro]);
  const upcomingByService = React.useMemo(() => {
    const m = new Map<string, Sesion[]>();
    if (upcomingRes.state.kind === "ok") {
      for (const s of upcomingRes.state.data) {
        if (s.status === "cancelada" || s.status === "asistido") continue;
        const arr = m.get(s.serviceId) ?? [];
        arr.push(s);
        m.set(s.serviceId, arr);
      }
    }
    return m;
  }, [upcomingRes.state]);

  const chosen = servicios.filter((s) => sel.has(s.id));
  // Tarjeta activa — solo para el resalte visual de la izquierda. Si la seleccionada ya no está, cae
  // en la primera elegida.
  const selEff = sel.has(selId) ? selId : chosen[0]?.id ?? "";
  const serviceIds = React.useMemo(() => [...sel], [sel]);
  const areasPayload: Record<string, number> = {};
  for (const id of serviceIds) areasPayload[id] = areasOf(id);

  // El TREN entero: horas de ENTRADA donde cabe todo lo marcado (una sola terapia también vale, mismo
  // endpoint). Reemplaza `getAvailability` + `planPatientDay`: una llamada, el BE arma el orden y los
  // tramos — nunca se calculan horas en el cliente. Handoff .personal/handoff-tren-de-terapias.md.
  const trainRes = useResource<PatientTrain | null>(
    () =>
      serviceIds.length
        ? planPatientTrain({ date, serviceIds, areas: areasPayload, patientId: paciente?.id, keepOrder }, centro)
        : Promise.resolve(null),
    [serviceIds.join(","), date, JSON.stringify(areasPayload), paciente?.id, keepOrder, centro],
  );
  const train = trainRes.state.kind === "ok" ? trainRes.state.data : null;
  const selectedSlot = train?.slots.find((s) => s.time === time) ?? null;

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
  function reason(sl: { fits: boolean; reasonKey?: string | null; serviceId?: string | null }) {
    const base = sl.reasonKey && tRoot.has(sl.reasonKey) ? tRoot(sl.reasonKey) : (sl.reasonKey ?? "");
    const blocker = sl.serviceId ? servById.get(sl.serviceId)?.name : null;
    return blocker ? t("trainBlockedBy", { reason: base, service: blocker }) : base;
  }

  const canBook = !!paciente && sel.size > 0 && !!date && !!time && !submitting;

  async function book(close: boolean) {
    if (!paciente || sel.size === 0 || !time) return;
    setSubmitting(true);
    try {
      const { data, warnings } = await bookTrain(
        { patientId: paciente.id, date, time, serviceIds: [...sel], areas: areasPayload, keepOrder },
        centro,
      );
      toast.success(tp("resumen", { creadas: data.sessions.length, omitidas: 0 }));
      mostrarAvisos(warnings, tRoot);
      // «Agendar y seguir»: limpia selección/hora/áreas para el próximo grupo de terapias del MISMO
      // paciente/día, sin cerrar. El paciente se conserva a propósito. `areas` también se limpia: si
      // no, re-agregar el mismo servicio en la próxima ronda heredaba en silencio el número de áreas
      // de la ronda anterior en vez de arrancar en 1.
      if (!close) {
        setSel(new Set());
        setTime("");
        setAreas({});
      }
      upcomingRes.refresh();
      onBooked?.({ close });
    } catch (err) {
      if (err instanceof ApiError && err.code === "THERAPY_TRAIN_DOES_NOT_FIT") {
        const reasonKey = typeof err.data?.reasonKey === "string" ? err.data.reasonKey : undefined;
        const blockedId = typeof err.data?.serviceId === "string" ? err.data.serviceId : undefined;
        toast.error(reason({ fits: false, reasonKey, serviceId: blockedId }) || tRoot("therapies.trainDoesNotFit"));
        trainRes.refresh();
      } else if (err instanceof ApiError && err.code === "THERAPY_TRAIN_ROLLBACK_INCOMPLETE") {
        const left = Array.isArray(err.data?.left) ? (err.data.left as Array<{ serviceId?: string }>) : [];
        const names = left.map((l) => (l.serviceId ? (servById.get(l.serviceId)?.name ?? l.serviceId) : "")).filter(Boolean);
        toast.error(
          names.length ? `${tRoot("therapies.trainRollbackIncomplete")}: ${names.join(", ")}` : tRoot("therapies.trainRollbackIncomplete"),
          { duration: Infinity },
        );
        upcomingRes.refresh();
      } else {
        toastError(err, tRoot);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const dragHint = (
    <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <HugeiconsIcon icon={DragDropIcon} className="size-3.5" />
      {t("dragHint")}
    </p>
  );

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
                <AddTherapySelect
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
                    const existentes = upcomingByService.get(s.id) ?? [];
                    const color = s.color ?? "#4a90d9";
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
                          "group cursor-grab rounded-lg border-l-4 bg-card p-2.5 pl-3 ring-1 transition-all active:cursor-grabbing",
                          active ? "shadow-md" : "ring-foreground/10 hover:ring-foreground/20",
                        )}
                        style={{
                          borderLeftColor: color,
                          // Activa = mismo color de la tarjeta, no un azul genérico: es el vínculo visual
                          // con el borde/punto del panel de horas a la derecha (mismo color en los dos lados).
                          ...(active ? { boxShadow: `0 0 0 2px ${color}66`, backgroundColor: `${color}0f` } : {}),
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {active ? (
                            <span aria-hidden className="size-2.5 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: color }} />
                          ) : (
                            <HugeiconsIcon icon={DragDropIcon} className="size-4 shrink-0 text-muted-foreground/50" />
                          )}
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
                        <ExistingSessionsBadge
                          sesiones={existentes}
                          centro={centro}
                          onChanged={() => {
                            // Reagendar puede liberar o consumir un puesto en la fecha/hora que la
                            // tarjeta activa está mostrando ahora mismo — sin esto quedaban obsoletos.
                            upcomingRes.refresh();
                            trainRes.refresh();
                          }}
                        />
                        {/* Additive-only entry point: opens the pattern-based bulk scheduler for THIS
                            service, never touches the single-date flow above. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecurringFor(s.id);
                          }}
                          className="mt-1 text-[11px] text-primary hover:underline"
                        >
                          {t("recurringButton")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ————— DERECHA: horas de ENTRADA del tren completo ————— */}
        {/* Borde izquierdo del color de la primera tarjeta marcada: el vínculo visual con la izquierda.
            Con 2+ terapias el panel ya no es de UNA tarjeta — es el tren entero (handoff tren-de-terapias). */}
        <section
          className="rounded-xl border-l-4 bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10"
          style={{ borderLeftColor: chosen[0] ? (chosen[0].color ?? "#4a90d9") : "transparent" }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {chosen.map((s) => (
                  <span
                    key={s.id}
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color ?? "#4a90d9" }}
                  />
                ))}
                {chosen.length ? t("entryHours") : t("pickCard")}
              </div>
              {chosen.length > 0 && trainRes.state.kind === "loading" && <Skeleton aria-hidden className="mt-0.5 h-4 w-40" />}
              {train && train.patientMinutes > 0 && (
                <div className="mt-0.5 text-xs text-muted-foreground">{t("minutes", { n: train.patientMinutes })}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={keepOrder} onCheckedChange={setKeepOrder} aria-label={t("keepOrder")} />
                <span className="text-muted-foreground">{t("keepOrder")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("date")}</span>
                <DatePicker value={date} onChange={changeDate} className="w-auto" />
              </label>
            </div>
          </div>

          {!chosen.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("pickCard")}</p>
          ) : (
            <TherapyTrainGrid
              train={train}
              loading={trainRes.state.kind === "loading"}
              error={trainRes.state.kind === "fail" ? trainRes.state.message : null}
              time={time}
              onPick={setTime}
              onDrop={(id, t2) => {
                if (id) setSelId(id);
                setTime(t2);
              }}
              blinkEnabled={blinkEnabled}
              servById={servById}
              dragHint={dragHint}
            />
          )}
        </section>
      </div>

      {/* ————— ABAJO: resumen vivo + agendar ————— */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
        <div className="min-w-0 space-y-1 text-sm">
          {!time ? (
            <p className="text-muted-foreground">{t("noHour")}</p>
          ) : trainRes.state.kind === "loading" ? (
            <PlanSummarySkeleton />
          ) : selectedSlot && train ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {selectedSlot.fits ? <Badge variant="success">{t("fits")}</Badge> : <Badge variant="destructive">{t("noFits")}</Badge>}
                <span className="font-medium">{t("startAt", { time })}</span>
                <span className="text-muted-foreground">· {t("patientMinutes", { n: train.patientMinutes })}</span>
              </div>
              {selectedSlot.fits ? (
                <p className="text-muted-foreground">{trainLegsText(selectedSlot, servById, "")}</p>
              ) : (
                <p className="text-destructive">{reason(selectedSlot)}</p>
              )}
              {train.unconfiguredServiceIds.length > 0 && (
                <p className="text-warning-foreground">
                  {t("sinRecurso", { list: train.unconfiguredServiceIds.map((id) => servById.get(id)?.name ?? id).join(", ") })}
                </p>
              )}
              {selectedSlot.staffBlocks.map((b, i) => (
                <p key={i} className="text-warning-foreground">{t("staffBlock", { from: b.from, to: b.to })}</p>
              ))}
            </>
          ) : null}
        </div>
        {/* Dos botones en vez de un cierre automático: el mostrador suele citar varias terapias del
            MISMO paciente en una sola visita — cerrar tras la primera obligaba a reabrir. «Seguir»
            limpia la selección y se queda en el mismo paciente/día; «Cerrar» hace lo de antes. */}
        <div className="flex items-center gap-2">
          <Button size="lg" variant="outline" onClick={() => book(false)} disabled={!canBook}>
            {submitting ? tRoot("common.saving") : t("bookAndContinue")}
          </Button>
          <Button size="lg" onClick={() => book(true)} disabled={!canBook}>
            {submitting ? tRoot("common.saving") : t("bookAndClose")}
          </Button>
        </div>
      </div>

      {recurringFor && paciente && (
        <RecurringBookingModal
          open
          serviceId={recurringFor}
          serviceName={servById.get(recurringFor)?.name ?? ""}
          serviceColor={servById.get(recurringFor)?.color}
          patientId={paciente.id}
          areas={areasOf(recurringFor)}
          centro={centro}
          defaultDate={date}
          defaultTime={time || undefined}
          existingDates={(upcomingByService.get(recurringFor) ?? []).map((s) => s.date)}
          onOpenChange={(o) => !o && setRecurringFor(null)}
          onBooked={() => {
            upcomingRes.refresh();
            trainRes.refresh();
          }}
        />
      )}
    </div>
  );
}
