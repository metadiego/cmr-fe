"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { DragDropIcon } from "@hugeicons/core-free-icons";

import { getServicios, type Servicio } from "@/lib/api/servicios";
import { getServiciosConSaldo, listSesionesRango, type ServicioConSaldo, type Sesion } from "@/lib/api/frontdesk";
import { bookTrain, listResources, planPatientTrain, type PatientTrain, type Resource } from "@/lib/api/resources";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { todayPR, inDaysPR } from "@/lib/format/fecha";
import { ApiError } from "@/lib/api/types";
import { getMyPreferences } from "@/lib/api/preferences";
import { type Paciente } from "@/lib/api/pacientes";
import { SheetNotice } from "@/components/agenda/sheet-notice";
import { isSheetSlotTaken } from "@/lib/agenda/sheet";
import { useResource } from "@/hooks/use-resource";
import { RecurringBookingModal } from "@/components/agenda/recurring-booking-modal";
import { TrainSeriesModal } from "@/components/agenda/train-series-modal";
import { TherapyTrainGrid } from "@/components/agenda/therapy-train-grid";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { RequiredMark } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";
import { therapyDayMissing, type TherapyDayField } from "@/lib/agenda/therapy-day-missing";
import { TherapyDayCards } from "@/components/agenda/therapy-day-cards";
import { TherapyDaySummary } from "@/components/agenda/therapy-day-summary";

// COCKPIT PARTIDO — la pieza que ve el mostrador al citar terapias (aprobado por el dueño 26-sep, sobre su
// visión del 24). IZQUIERDA: paciente + récord (héroe) y las terapias del día como mini-tarjetas de color con
// sus áreas. DERECHA: al elegir una tarjeta se abren las HORAS del día y PARPADEAN solo donde de verdad cabe
// —puesto físico Y técnico (el BE lo resuelve: reasonKey full/noStaff/overMaxPerPatient)—; se arrastra la
// tarjeta al hueco o se hace clic. ABAJO: el tiempo REAL en la clínica + avisos (bloqueo de la doctora) y
// agendar. Una sola pieza: ruta aparte, modal del calendario de servicios y «Citar» del frontdesk.
// Reserva por el MISMO endpoint del frontdesk (book-multiple). Handoff HANDOFF-FE-agenda-de-terapias.

export type PatientLite = { id: string; name: string; record?: string | null; phone?: string | null };

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
  // Which card's "schedule a series" modal is open (its serviceId), or null — additive-only feature,
  // fully independent from the single-date flow above.
  const [recurringFor, setRecurringFor] = React.useState<string | null>(null);
  // «Programar una serie del tren»: el tren ENTERO, no una tarjeta suelta — handoff tren-en-serie.
  const [seriesOpen, setSeriesOpen] = React.useState(false);

  const areasOf = (id: string) => areas[id] ?? 1;

  const servRes = useResource<Servicio[]>(() => getServicios(centro), [centro]);
  const servicios = servRes.state.kind === "ok" ? servRes.state.data : [];
  const servById = React.useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);

  // Para nombrar el recurso que bloquea en un servicio de varias líneas (BE PR #518, NPT: técnico Y
  // enfermera): «Sin personal — Enfermería», no solo el id crudo.
  const recRes = useResource<Resource[]>(() => listResources(centro), [centro]);
  const recursos = recRes.state.kind === "ok" ? recRes.state.data : [];
  const recursosById = React.useMemo(() => new Map(recursos.map((r) => [r.id, r])), [recursos]);
  // «Areas» solo tiene sentido en una terapia que de verdad cobra por área (el Láser): antes salía en
  // TODAS las tarjetas, Vit C y NPT incluidos, donde no significa nada. Un servicio es «por área» si
  // CUALQUIERA de sus líneas lo es (`ServiceResourceLine.per`), visto desde `Resource.services[]`.
  const areaServiceIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const r of recursos) for (const svc of r.services) if (svc.per === "area") ids.add(svc.serviceId);
    return ids;
  }, [recursos]);

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
  // BE #547: `reasonKeys` trae TODOS los motivos (antes solo el primero en `reasonKey`).
  function reason(sl: { fits: boolean; reasonKey?: string | null; reasonKeys?: string[]; serviceId?: string | null; resourceId?: string | null }) {
    const keys = sl.reasonKeys?.length ? sl.reasonKeys : sl.reasonKey ? [sl.reasonKey] : [];
    const base = keys.map((k) => (tRoot.has(k) ? tRoot(k) : k)).join(" · ");
    const service = sl.serviceId ? servById.get(sl.serviceId)?.name : null;
    const resource = sl.resourceId ? recursosById.get(sl.resourceId)?.name : null;
    if (service && resource) return `${t("trainBlockedBy", { reason: base, service })} (${resource})`;
    if (service) return t("trainBlockedBy", { reason: base, service });
    if (resource) return t("blockedByResource", { reason: base, resource });
    return base;
  }

  // What booking still needs, in on-screen order: this list alone disables «Agendar» and is shown
  // above the buttons (a Bayamón receptionist was stuck on a grey button that never said «hora»).
  const fieldLabel: Record<TherapyDayField, string> = {
    patient: t("pickPatient"),
    therapies: t("pickServices"),
    date: t("date"),
    hour: tRoot("agenda.time"),
  };
  // Once the catalogue has loaded, count only therapies actually shown (a preselected id missing from the
  // centre's catalogue renders no card, so it must not hide «therapies» from the hint).
  const missingServiceIds = servRes.state.kind === "ok" ? chosen.map((s) => s.id) : serviceIds;
  const missing = therapyDayMissing({ patientId: paciente?.id, serviceIds: missingServiceIds, date, time }).map(
    (f) => fieldLabel[f],
  );

  // The buttons are disabled while anything is missing, so this throw is only a backstop.
  async function book(close: boolean) {
    if (!paciente || sel.size === 0 || !time) throw new Error(missing.join(" · "));
    const res = await bookTrain(
      { patientId: paciente.id, date, time, serviceIds: [...sel], areas: areasPayload, keepOrder },
      centro,
    );
    return { ...res, close };
  }

  // useSubmit: one booking at a time (double click / Enter never books twice); a failed booking keeps
  // the selection and toasts why.
  const { submitting, submit } = useSubmit(book, {
    onSuccess: ({ data, warnings, advertencias, close }) => {
      toast.success(tp("resumen", { creadas: data.sessions.length, omitidas: 0 }));
      mostrarAvisos(warnings, tRoot);
      mostrarAvisos(advertencias, tRoot); // BE #547: la reserva avisó alguna regla no bloqueante, ya se guardó
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
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "THERAPY_TRAIN_DOES_NOT_FIT") {
        const reasonKey = typeof err.data?.reasonKey === "string" ? err.data.reasonKey : undefined;
        const reasonKeys = Array.isArray(err.data?.reasonKeys) ? (err.data.reasonKeys as string[]) : undefined;
        const blockedId = typeof err.data?.serviceId === "string" ? err.data.serviceId : undefined;
        const blockedResourceId = typeof err.data?.resourceId === "string" ? err.data.resourceId : undefined;
        toast.error(
          reason({ fits: false, reasonKey, reasonKeys, serviceId: blockedId, resourceId: blockedResourceId }) || tRoot("therapies.trainDoesNotFit"),
        );
        trainRes.refresh();
        return true;
      }
      if (err instanceof ApiError && err.code === "THERAPY_TRAIN_ROLLBACK_INCOMPLETE") {
        const left = Array.isArray(err.data?.left) ? (err.data.left as Array<{ serviceId?: string }>) : [];
        const names = left.map((l) => (l.serviceId ? (servById.get(l.serviceId)?.name ?? l.serviceId) : "")).filter(Boolean);
        toast.error(
          names.length ? `${tRoot("therapies.trainRollbackIncomplete")}: ${names.join(", ")}` : tRoot("therapies.trainRollbackIncomplete"),
          { duration: Infinity },
        );
        upcomingRes.refresh();
        return true;
      }
      // Generic toast from useSubmit; someone took the seat after the grid was drawn → redraw it.
      if (isSheetSlotTaken(err)) trainRes.refresh();
      return false;
    },
  });

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
          <TherapyDayCards
            patient={paciente}
            lockedPatient={lockedPatient}
            centro={centro}
            balance={saldo}
            services={servicios}
            selectedIds={sel}
            chosen={chosen}
            activeId={selEff}
            upcomingByService={upcomingByService}
            areaServiceIds={areaServiceIds}
            areasOf={areasOf}
            onPickPatient={(p) => setPaciente(asLite(p))}
            onChangePatient={() => {
              setPaciente(null);
              setSel(new Set());
              setTime("");
            }}
            onToggle={toggle}
            onActivate={setSelId}
            onSelectCard={(id) => {
              setSelId(id);
              setTime("");
            }}
            onAreasChange={(id, n) => {
              setAreas((a) => ({ ...a, [id]: n }));
              if (id === selEff) setTime("");
            }}
            onRemove={removeService}
            onOpenRecurring={setRecurringFor}
            onSessionsChanged={() => {
              upcomingRes.refresh();
              trainRes.refresh();
            }}
          />
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
                <RequiredMark />
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

          <SheetNotice sheet={train?.sheet} className="mb-2" />
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
              recursosById={recursosById}
              dragHint={dragHint}
            />
          )}
        </section>
      </div>

      {/* ————— ABAJO: resumen vivo + agendar ————— */}
      <TherapyDaySummary
        time={time}
        trainLoading={trainRes.state.kind === "loading"}
        train={train}
        selectedSlot={selectedSlot}
        servById={servById}
        slotReason={reason}
        missing={missing}
        submitting={submitting}
        hasSelection={!!paciente && sel.size > 0}
        onOpenSeries={() => setSeriesOpen(true)}
        onBook={(close) => submit(close)}
      />

      {paciente && sel.size > 0 && (
        <TrainSeriesModal
          open={seriesOpen}
          patientId={paciente.id}
          patientName={paciente.name}
          serviceIds={serviceIds}
          servById={servById}
          areas={areasPayload}
          keepOrder={keepOrder}
          centro={centro}
          defaultDate={date}
          defaultTime={time || undefined}
          onOpenChange={setSeriesOpen}
          onBooked={() => {
            upcomingRes.refresh();
            trainRes.refresh();
          }}
        />
      )}

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
