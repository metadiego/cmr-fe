"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { listScaleStockEvents, type ScaleStockEvent } from "@/lib/api/scale-live-stock";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// What the history panel is about: one pad of one scale, or one supplier presentation (variant).
export type HistoryTarget =
  | { kind: "pad"; deviceId: string; pad: number; title: string }
  | { kind: "product"; supplierPresentationId: string; title: string };

// Event history of a pad or a variant, newest first: «13 → 12», the kind and the time.
export function LiveStockHistorySheet({
  target,
  centroId,
  warehouseId,
  onClose,
}: {
  target: HistoryTarget;
  centroId?: string;
  warehouseId: string;
  onClose: () => void;
}) {
  const t = useTranslations("liveStock");
  const format = useFormatter();
  const key = target.kind === "pad" ? `${target.deviceId}:${target.pad}` : target.supplierPresentationId;
  const { state } = useResource<ScaleStockEvent[]>(
    () =>
      listScaleStockEvents({
        centroId,
        warehouseId,
        ...(target.kind === "pad"
          ? { deviceId: target.deviceId, pad: target.pad }
          : { supplierPresentationId: target.supplierPresentationId }),
      }),
    [centroId, warehouseId, key],
  );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("historyTitle")}</SheetTitle>
          <SheetDescription>{target.title}</SheetDescription>
        </SheetHeader>
        <ol className="divide-y px-6 pb-4">
          {state.kind === "loading" && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="my-2 h-8 w-full" />)}
          {state.kind === "fail" && <li className="py-4 text-sm text-destructive">{state.message}</li>}
          {state.kind === "ok" && state.data.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{t("historyEmpty")}</li>}
          {state.kind === "ok" &&
            state.data.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-20 shrink-0 whitespace-nowrap text-base font-semibold tabular-nums">
                  {e.previousUnits != null ? `${e.previousUnits} → ${e.units}` : e.units}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-[10px]", e.kind !== "change" && "text-muted-foreground")}>
                      {t(`kind.${e.kind}`)}
                    </Badge>
                    {e.doubtful && (
                      <Badge variant="outline" className="border-warning-foreground/30 bg-warning text-[10px] text-warning-foreground">
                        {t("doubtful")}
                      </Badge>
                    )}
                  </span>
                  {target.kind === "product" && (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {e.deviceId} · {t("padN", { n: e.pad })}
                    </span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {format.dateTime(new Date(e.measuredAt), "dateAndTime")}
                </span>
              </li>
            ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
