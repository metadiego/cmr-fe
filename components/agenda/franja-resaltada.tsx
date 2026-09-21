"use client";

import { franjaActual } from "@/lib/agenda/franja-actual";
import { useHoraActual } from "@/hooks/use-hora-actual";
import { cn } from "@/lib/utils";

// Feeds franjaActual() with a live clock so a day-view's "current franja" highlight
// moves on its own as time advances (owner's request, 2026-09-21). No useMemo here: callers
// pass a fresh `.map()` array each render anyway, so memoizing on it would never hit.
export function useFranjaResaltada(horas: (string | null)[]): string | null {
  const horaActual = useHoraActual();
  return franjaActual(
    horas.filter((h): h is string => h !== null),
    horaActual,
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
