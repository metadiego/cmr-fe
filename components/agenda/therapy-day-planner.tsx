"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getAvailability, planPatientDay, type Availability, type PatientDayResult } from "@/lib/api/resources";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// PIEZA REUTILIZABLE: programar el día de terapias de UN paciente viendo los HUECOS reales (parpadean los
// que caben) y validando el día completo antes de agendar. Va DENTRO del «Citar» del frontdesk y también en
// una ruta aparte — el MISMO componente en los dos sitios. Recibe paciente + servicios; no agenda (eso sigue
// por frontdesk): calcula/valida. Handoff HANDOFF-FE-agenda-de-terapias (Pantalla 2).
export type PlannerService = { id: string; name: string; areas?: number };

export function TherapyDayPlanner({
  patient,
  services,
  centro,
  defaultDate,
  date: dateProp,
  onDateChange,
  time: timeProp,
  onTimeChange,
  onConfirm,
}: {
  patient: { id: string; name: string; record?: string | null };
  services: PlannerService[];
  centro?: string;
  defaultDate?: string;
  // Fecha/hora CONTROLADAS (opcionales): cuando el contenedor agenda (p. ej. el
  // scheduler del calendario) necesita leer la fecha y la hora elegidas. Sin
  // ellas, el planner las gestiona por dentro (embed del Citar, uso suelto).
  date?: string;
  onDateChange?: (date: string) => void;
  time?: string;
  onTimeChange?: (time: string) => void;
  onConfirm?: (date: string, time: string) => void;
}) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();
  const [dateSelf, setDateSelf] = React.useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [timeSelf, setTimeSelf] = React.useState<string>("");
  const date = dateProp ?? dateSelf;
  const time = timeProp ?? timeSelf;
  const setTime = React.useCallback(
    (v: string) => (onTimeChange ? onTimeChange(v) : setTimeSelf(v)),
    [onTimeChange],
  );
  // Cambiar la fecha limpia la hora (los huecos son de esa fecha).
  const changeDate = (d: string) => {
    if (onDateChange) onDateChange(d);
    else setDateSelf(d);
    setTime("");
  };
  const [areas, setAreas] = React.useState<Record<string, number>>({});
  const [selId, setSelId] = React.useState<string>(services[0]?.id ?? "");

  const areasOf = (id: string) => areas[id] ?? 1;
  const serviceIds = React.useMemo(() => services.map((s) => s.id), [services]);

  // Huecos del servicio seleccionado (parpadean los que caben). Cambia con fecha/servicio/áreas.
  const availRes = useResource<Availability>(
    () => (selId ? getAvailability({ date, serviceId: selId, areas: areasOf(selId) }, centro) : Promise.resolve({ configured: false, minutes: 0, slots: [] })),
    [selId, date, areas[selId], centro],
  );
  const avail = availRes.state.kind === "ok" ? availRes.state.data : null;

  // El día completo, cuando ya hay hora elegida: minutos reales + avisos.
  const planRes = useResource<PatientDayResult | null>(
    () => (time ? planPatientDay({ serviceIds, date, time }, centro) : Promise.resolve(null)),
    [time, date, serviceIds.join(","), centro],
  );
  const plan = planRes.state.kind === "ok" ? planRes.state.data : null;

  return (
    <div className="space-y-5">
      {/* Paciente + récord + fecha */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{patient.name}</div>
          {patient.record && <div className="text-sm text-muted-foreground">{tRoot("patients.hub.record")} #{patient.record}</div>}
        </div>
        <label className="text-sm">
          <span className="mr-2 text-muted-foreground">{t("date")}</span>
          <Input type="date" value={date} onChange={(e) => changeDate(e.target.value)} className="inline-block h-9 w-auto" />
        </label>
      </div>

      {/* Mini-cards: una por terapia. Se elige una para ver sus huecos. Láser lleva áreas. */}
      <div className="flex flex-wrap gap-2">
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setSelId(s.id); setTime(""); }}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-sm transition-colors",
              selId === s.id ? "border-primary bg-primary/10" : "border-input hover:border-primary/50",
            )}
          >
            <div className="font-medium">{s.name}</div>
            <label className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
              {t("areas")}
              <Input
                type="number"
                min={1}
                value={areasOf(s.id)}
                onChange={(e) => { setAreas((a) => ({ ...a, [s.id]: Math.max(1, Number(e.target.value) || 1) })); if (s.id === selId) setTime(""); }}
                className="h-6 w-14 px-1 py-0 text-xs"
              />
            </label>
          </button>
        ))}
      </div>

      {/* Huecos del servicio elegido */}
      <div>
        {availRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
        {availRes.state.kind === "fail" && <p className="text-sm text-destructive">{availRes.state.message}</p>}
        {avail && !avail.configured && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">{t("notConfigured")}</p>
        )}
        {avail && avail.configured && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">{t("minutes", { n: avail.minutes })}{avail.resource ? ` · ${t("capacity", { n: avail.resource.capacity })}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {avail.slots.map((sl) => {
                const reason = sl.reasonKey && tRoot.has(sl.reasonKey) ? tRoot(sl.reasonKey) : sl.reasonKey ?? "";
                const chosen = time === sl.time;
                return (
                  <button
                    key={sl.time}
                    type="button"
                    disabled={!sl.fits}
                    onClick={() => setTime(sl.time)}
                    title={sl.fits ? (sl.freeStations != null ? t("freeStations", { n: sl.freeStations }) : "") : reason}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-sm font-mono tabular-nums transition-colors",
                      chosen
                        ? "border-primary bg-primary text-primary-foreground"
                        : sl.fits
                          ? "border-success/50 bg-success/10 text-success-foreground animate-pulse hover:bg-success/20"
                          : "cursor-not-allowed border-dashed border-muted-foreground/30 text-muted-foreground/40",
                    )}
                  >
                    {sl.time}
                    {sl.fits && sl.freeStations != null && <span className="ml-1 text-[10px] opacity-70">({sl.freeStations})</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Validación del día completo a la hora elegida */}
      {time && (
        <div className="rounded-md bg-card p-4 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          {planRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
          {planRes.state.kind === "fail" && <p className="text-sm text-destructive">{planRes.state.message}</p>}
          {plan && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {plan.ok ? <Badge variant="success">{t("fits")}</Badge> : <Badge variant="destructive">{t("noFits")}</Badge>}
                <span className="font-medium">{t("startAt", { time })}</span>
              </div>
              {!plan.ok && plan.reasonKey && (
                <p className="text-destructive">{tRoot.has(plan.reasonKey) ? tRoot(plan.reasonKey) : plan.reasonKey}</p>
              )}
              <p className="text-muted-foreground">{t("patientMinutes", { n: plan.minutosDelPaciente })}</p>
              {plan.sinRecurso.length > 0 && (
                <p className="text-warning-foreground">{t("sinRecurso", { list: plan.sinRecurso.join(", ") })}</p>
              )}
              {plan.staffBlocks.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning-foreground">
                  {plan.staffBlocks.map((b, i) => (
                    <p key={i}>{t("staffBlock", { from: b.from, to: b.to })}</p>
                  ))}
                </div>
              )}
              {onConfirm && plan.ok && (
                <div className="flex justify-end pt-1">
                  <Button size="sm" onClick={() => onConfirm(date, time)}>{t("confirm")}</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
