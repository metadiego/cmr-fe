"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, DragDropIcon } from "@hugeicons/core-free-icons";

import { type Servicio } from "@/lib/api/servicios";
import { type ServicioConSaldo, type Sesion } from "@/lib/api/frontdesk";
import { type Paciente } from "@/lib/api/pacientes";
import { bookedCount, toBookCount } from "@/lib/agenda/service-balance";
import { todayPR } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { ExistingSessionsBadge } from "@/components/agenda/existing-sessions-badge";
import { AddTherapySelect } from "@/components/agenda/add-therapy-select";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/kit/required-mark";
import type { PatientLite } from "@/components/agenda/therapy-day-scheduler";

// Left column of the therapy day scheduler: patient hero, bought-service chips and the day's therapy
// cards. Presentational: all state lives in TherapyDayScheduler and comes in by props.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "·";
}

export type TherapyDayCardsProps = {
  patient: PatientLite | null;
  lockedPatient?: PatientLite;
  centro?: string;
  /** Services with a pending balance (the "bought" chips). */
  balance: ServicioConSaldo[];
  /** Full catalogue of the center (for the add-therapy select). */
  services: Servicio[];
  /** Ids of the checked services. */
  selectedIds: Set<string>;
  /** The checked services, as catalogue rows. */
  chosen: Servicio[];
  /** Id of the active card. */
  activeId: string;
  upcomingByService: Map<string, Sesion[]>;
  areaServiceIds: Set<string>;
  areasOf: (id: string) => number;
  onPickPatient: (p: Paciente) => void;
  onChangePatient: () => void;
  onToggle: (id: string) => void;
  /** Card drag started: make it the active one without clearing the hour. */
  onActivate: (id: string) => void;
  /** Card clicked: make it active and clear the hour. */
  onSelectCard: (id: string) => void;
  onAreasChange: (id: string, areas: number) => void;
  onRemove: (id: string) => void;
  onOpenRecurring: (id: string) => void;
  /** An existing session was rescheduled: refresh upcoming sessions and the train. */
  onSessionsChanged: () => void;
};

export function TherapyDayCards({
  patient: paciente,
  lockedPatient,
  centro,
  balance: saldo,
  services: servicios,
  selectedIds: sel,
  chosen,
  activeId: selEff,
  upcomingByService,
  areaServiceIds,
  areasOf,
  onPickPatient,
  onChangePatient,
  onToggle,
  onActivate,
  onSelectCard,
  onAreasChange,
  onRemove,
  onOpenRecurring,
  onSessionsChanged,
}: TherapyDayCardsProps) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();

  return (
    <>
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
                onClick={onChangePatient}
              >
                {t("change")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t("pickPatient")}
            <RequiredMark />
          </label>
          <PacienteSelect value={null} onChange={(p) => p && onPickPatient(p)} />
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
              // The explicit compradas/usadas/agendadas/por-agendar breakdown (handoff
              // saldo-al-citar-explicito, 28-nov-2026): "quedan N" alone read as if a session had
              // already been discounted the moment a purchase auto-marked the patient present,
              // when the package was untouched. Falls back to the old chip while the BE doesn't
              // send purchased/used yet.
              const booked = bookedCount(upcomingByService.get(s.serviceId) ?? [], todayPR());
              const toBook = toBookCount(s.pending, booked);
              const balance =
                s.purchased == null || s.used == null
                  ? t("remaining", { n: s.pending })
                  : booked > 0
                    ? t("balance", { purchased: s.purchased, used: s.used, booked, toBook })
                    : t("balanceNoBooked", { purchased: s.purchased, used: s.used, toBook });
              return (
                <button
                  key={s.serviceId}
                  type="button"
                  onClick={() => onToggle(s.serviceId)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    on ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
                  )}
                >
                  {s.name}
                  <span className="ml-1 opacity-70">· {balance}</span>
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
            <label className="text-sm font-medium">
              {t("pickServices")}
              <RequiredMark />
            </label>
            <AddTherapySelect servicios={servicios} selectedIds={sel} onToggle={onToggle} label={t("addTherapy")} />
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
                      onActivate(s.id);
                      e.dataTransfer.setData("text/plain", s.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onSelectCard(s.id)}
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
                        {areaServiceIds.has(s.id) && (
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
                                onAreasChange(s.id, Math.max(1, Number(e.target.value) || 1));
                              }}
                              className="h-6 w-14 px-1 py-0 text-xs"
                            />
                          </label>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(s.id);
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
                      // Reagendar puede liberar o consumir un puesto en la fecha/hora que la
                      // tarjeta activa está mostrando ahora mismo — sin esto quedaban obsoletos.
                      onChanged={onSessionsChanged}
                    />
                    {/* Additive-only entry point: opens the pattern-based bulk scheduler for THIS
                        service, never touches the single-date flow above. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRecurring(s.id);
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
    </>
  );
}
