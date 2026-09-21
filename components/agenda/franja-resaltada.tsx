"use client";

import * as React from "react";

import { franjaActual } from "@/lib/agenda/franja-actual";
import { useHoraActual } from "@/hooks/use-hora-actual";
import { cn } from "@/lib/utils";

// Feeds franjaActual() with a live clock so a day-view's "current franja" highlight
// moves on its own as time advances (owner's request, 2026-09-21).
export function useFranjaResaltada(horas: (string | null)[]): string | null {
  const horaActual = useHoraActual();
  return React.useMemo(
    () => franjaActual(horas.filter((h): h is string => h !== null), horaActual),
    [horas, horaActual],
  );
}

export function AhoraBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
