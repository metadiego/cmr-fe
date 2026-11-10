"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { type PatientTrain, type TrainSlot } from "@/lib/api/resources";
import { type Servicio } from "@/lib/api/servicios";
import { cn } from "@/lib/utils";
import { SlotGridSkeleton } from "@/components/agenda/therapy-day-skeleton";

// La rejilla del TREN de terapias (handoff .personal/handoff-tren-de-terapias.md): cada botón es una
// hora de ENTRADA donde cabe el tren entero (POST /resources/patient-train), no una terapia suelta.
// Partido de TherapyDayScheduler para no pasar su tope de líneas (CEILING=600, eslint.config.mjs).

export function trainLegsText(slot: TrainSlot, servById: Map<string, Servicio>, endsAtText: string): string {
  const parts: string[] = [];
  for (const leg of slot.legs) {
    const name = servById.get(leg.serviceId)?.name ?? leg.serviceId;
    if (leg.parallel && parts.length) parts[parts.length - 1] += ` + ${name}`;
    else parts.push(`${leg.start} ${name}`);
  }
  if (endsAtText) parts.push(endsAtText);
  return parts.join(" · ");
}

export function TherapyTrainGrid({
  train,
  loading,
  error,
  time,
  onPick,
  onDrop,
  blinkEnabled,
  servById,
  dragHint,
}: {
  train: PatientTrain | null;
  loading: boolean;
  error: string | null;
  time: string;
  onPick: (time: string) => void;
  onDrop: (serviceId: string, time: string) => void;
  blinkEnabled: boolean;
  servById: Map<string, Servicio>;
  dragHint: React.ReactNode;
}) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  function reason(sl: TrainSlot): string {
    const base = sl.reasonKey && tRoot.has(sl.reasonKey) ? tRoot(sl.reasonKey) : (sl.reasonKey ?? "");
    const service = sl.serviceId ? servById.get(sl.serviceId)?.name : null;
    return service ? t("trainBlockedBy", { reason: base, service }) : base;
  }

  if (loading) return <SlotGridSkeleton hint={dragHint} />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!train) return null;

  return (
    <>
      {dragHint}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {train.slots.map((sl) => {
          const active = time === sl.time;
          const over = dragOver === sl.time;
          const endsAtText = sl.fits ? t("trainEndsAt", { time: sl.endsAt }) : "";
          return (
            <button
              key={sl.time}
              type="button"
              disabled={!sl.fits}
              title={sl.fits ? trainLegsText(sl, servById, endsAtText) : reason(sl)}
              onClick={() => sl.fits && onPick(sl.time)}
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
                setDragOver(null);
                onDrop(id, sl.time);
              }}
              className={cn(
                "flex flex-col items-start rounded-lg border p-2 text-left transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : sl.fits
                    ? cn("border-success/40 bg-success/10 hover:bg-success/20", blinkEnabled && "animate-pulse hover:animate-none")
                    : "cursor-not-allowed border-dashed border-muted-foreground/25 bg-muted/20 text-muted-foreground/40",
                over && "scale-105 ring-2 ring-success",
              )}
            >
              <span className="font-mono text-sm font-semibold tabular-nums">{sl.time}</span>
              <span className={cn("mt-1 line-clamp-2 text-[10px]", active ? "opacity-90" : "opacity-70")}>
                {sl.fits ? endsAtText : reason(sl)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
