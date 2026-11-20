"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { slotTone, timeRange } from "@/lib/agenda/appointment-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Selector de UNA hora a partir de los CUPOS del día (una franja = una hora con sus huecos libres). Sustituye
// los dos campos Hora Inicio/Hora Fin: la hora de fin se deriva sola de la duración del tipo. NO BLOQUEANTE: las
// franjas llenas se ven atenuadas pero se pueden elegir igual (el BE avisa, no impide). Dos variantes para
// comparar cuál sirve mejor (decisión pendiente del dueño). Handoff citas-hora-por-cupo-handoff-be.
// enHoja: full because the call-center sheet has no seat left (cappedBy 'hoja'), not our own slots.
export type Slot = { time: string; vacios: number; cupo: number; enHoja?: boolean };
export type SlotVariant = "dropdown" | "chips";

export function SlotPicker({
  slots,
  value,
  onChange,
  variant,
  selectedEnd,
}: {
  slots: Slot[];
  value: string;
  onChange: (time: string) => void;
  variant: SlotVariant;
  /** End time of the chosen hour: the chosen chip reads "07:00–08:00" instead of a separate line. */
  selectedEnd?: string;
}) {
  const t = useTranslations("agenda.slot");
  const fullLabel = (s: Slot) => (s.enHoja ? t("fullInSheet") : t("full"));
  const libresLabel = (s: Slot) => (s.vacios > 0 ? t("free", { n: s.vacios }) : fullLabel(s));

  if (slots.length === 0) {
    // Sin cupos para este tipo/día: NO se atrapa al usuario (no bloqueante), pero tampoco el reloj con minutos
    // ni horas de noche — las citas médicas son por HORA ENTERA, de día. Desplegable 7:00–18:00, hora en punto.
    const horas = Array.from({ length: 12 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`);
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue placeholder={t("placeholder")} /></SelectTrigger>
        <SelectContent>
          {horas.map((h) => (
            <SelectItem key={h} value={h}><span className="tabular-nums">{h}</span></SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variant === "dropdown") {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue placeholder={t("placeholder")} /></SelectTrigger>
        <SelectContent>
          {slots.map((s) => (
            <SelectItem key={s.time} value={s.time}>
              <span className={cn("inline-flex items-center gap-2", s.vacios <= 0 && "text-muted-foreground")}>
                <span className="tabular-nums">{s.time}</span>
                <span className="text-xs">· {libresLabel(s)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // chips: one button per hour. Amber = one place left, dashed and faded = full (still pickable: the
  // BE warns, it does not block).
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5">
      {slots.map((s) => {
        const sel = value === s.time;
        const tone = slotTone(s.vacios);
        return (
          <button
            key={s.time}
            type="button"
            onClick={() => onChange(s.time)}
            aria-pressed={sel}
            title={libresLabel(s)}
            className={cn(
              "flex flex-col items-center rounded-md border px-2 py-1.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              sel
                ? "border-primary bg-primary text-primary-foreground"
                : tone === "full"
                  ? "border-dashed border-muted-foreground/30 text-muted-foreground/60 hover:border-muted-foreground/60"
                  : tone === "low"
                    ? "border-warning/60 bg-warning/10 hover:border-primary"
                    : "border-input hover:border-primary hover:text-primary",
            )}
          >
            <span className="font-medium tabular-nums">{sel && selectedEnd ? timeRange(s.time, selectedEnd) : s.time}</span>
            <span
              className={cn(
                "text-xs tabular-nums",
                sel ? "opacity-90" : tone === "low" ? "text-warning-foreground" : "text-muted-foreground",
              )}
            >
              {libresLabel(s)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
