"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Selector de UNA hora a partir de los CUPOS del día (una franja = una hora con sus huecos libres). Sustituye
// los dos campos Hora Inicio/Hora Fin: la hora de fin se deriva sola de la duración del tipo. NO BLOQUEANTE: las
// franjas llenas se ven atenuadas pero se pueden elegir igual (el BE avisa, no impide). Dos variantes para
// comparar cuál sirve mejor (decisión pendiente del dueño). Handoff citas-hora-por-cupo-handoff-be.
export type Slot = { time: string; vacios: number; cupo: number };
export type SlotVariant = "dropdown" | "chips";

export function SlotPicker({
  slots,
  value,
  onChange,
  variant,
}: {
  slots: Slot[];
  value: string;
  onChange: (time: string) => void;
  variant: SlotVariant;
}) {
  const t = useTranslations("agenda.slot");
  const libresLabel = (s: Slot) => (s.vacios > 0 ? t("free", { n: s.vacios }) : t("full"));

  if (slots.length === 0) {
    // Sin cupos para este tipo/día: NO se atrapa al usuario (no bloqueante), pero tampoco el reloj con minutos
    // ni horas de noche — las citas médicas son por HORA ENTERA, de día. Desplegable 7:00–18:00, hora en punto.
    const horas = Array.from({ length: 12 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`);
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue placeholder={t("placeholder")} /></SelectTrigger>
        <SelectContent>
          {horas.map((h) => (
            <SelectItem key={h} value={h}><span className="font-mono tabular-nums">{h}</span></SelectItem>
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
                <span className="font-mono tabular-nums">{s.time}</span>
                <span className="text-xs">· {libresLabel(s)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // chips
  return (
    <div className="flex flex-wrap gap-1.5">
      {slots.map((s) => {
        const sel = value === s.time;
        const full = s.vacios <= 0;
        return (
          <button
            key={s.time}
            type="button"
            onClick={() => onChange(s.time)}
            title={libresLabel(s)}
            className={cn(
              "flex flex-col items-center rounded-md border px-2.5 py-1 text-sm transition-colors",
              sel
                ? "border-primary bg-primary text-primary-foreground"
                : full
                  ? "border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/60"
                  : "border-input hover:border-primary hover:text-primary",
            )}
          >
            <span className="font-mono tabular-nums">{s.time}</span>
            <span className="text-[10px] opacity-80">{full ? t("full") : t("freeShort", { n: s.vacios })}</span>
          </button>
        );
      })}
    </div>
  );
}
