"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getLiveStock } from "@/lib/api/scale-live-stock";
import { liveIndex, type LiveCell } from "@/lib/inventory/live-stock";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";

// Scale counts of a center, indexed by product + warehouse, for the «Live» column of Existencias. A
// failure (or no permission) just leaves the column empty: book stock must never depend on it.
export function useLiveIndex(centroId?: string): Map<string, LiveCell> {
  const { state } = useResource(
    () => (centroId ? getLiveStock({ centroId }).catch(() => null) : Promise.resolve(null)),
    [centroId],
  );
  return React.useMemo(() => liveIndex(state.kind === "ok" && state.data ? state.data.warehouses : []), [state]);
}

// «Live 59»: what the scale counts, beside book stock and never added to it.
export function LiveCount({ cell, className }: { cell: LiveCell | null; className?: string }) {
  const t = useTranslations("liveStock");
  const format = useFormatter();
  if (!cell) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1",
        cell.doubtful ? "bg-warning text-warning-foreground ring-warning-foreground/30" : "bg-primary/10 text-primary ring-primary/20",
        className,
      )}
      title={[cell.doubtful ? t("doubtful") : null, cell.measuredAt ? format.dateTime(new Date(cell.measuredAt), "dateAndTime") : null]
        .filter(Boolean)
        .join(" · ")}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {t("liveShort")} {cell.units}
    </span>
  );
}
