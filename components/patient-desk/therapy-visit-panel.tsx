"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TherapyAddList, TrainVisitList, type PickableTherapy } from "@/components/patient-desk/therapy-picker-list";

// The left panel of the patient desk's therapy form, «1 · La visita»: what blocks listing the therapies
// (no patient, a failed catalogue or balance, loading), else the therapies that can be added on top
// and, under them, the visit in its order with who decides that order.

export type VisitPanelState = "noPatient" | "catalogueFailed" | "balanceHidden" | "balanceFailed" | "loading" | "ready";

export function TherapyVisitPanel({
  state,
  onRetryCatalogue,
  onRetryBalance,
  pickable,
  selected,
  order,
  areas,
  keepOrder,
  disabled,
  stay,
  onReorder,
  onAutoOrder,
  onToggle,
  onAreas,
}: {
  state: VisitPanelState;
  onRetryCatalogue: () => void;
  onRetryBalance: () => void;
  pickable: PickableTherapy[];
  selected: string[];
  /** The visit's ids in the order they are done. */
  order: string[];
  areas: Record<string, number>;
  /** The order is the user's (dragged), not the BE's. */
  keepOrder: boolean;
  disabled: boolean;
  stay: string;
  onReorder: (ids: string[]) => void;
  onAutoOrder: () => void;
  onToggle: (id: string) => void;
  onAreas: (id: string, n: number) => void;
}) {
  const t = useTranslations("therapyBooking");
  const tSeries = useTranslations("appointmentsBooking.series");
  const tType = useTranslations("appointmentsBooking.typePicker");
  const tRoot = useTranslations();
  const retry = tRoot("appointmentsBooking.retry");

  if (state === "noPatient") return <p className="text-sm text-muted-foreground">{tSeries("pickPatient")}</p>;
  if (state === "catalogueFailed" || state === "balanceFailed")
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span>{state === "catalogueFailed" ? t("catalogueFailed") : tType("bookableFailed")}</span>
        <Button type="button" size="xs" variant="outline" onClick={state === "catalogueFailed" ? onRetryCatalogue : onRetryBalance}>
          {retry}
        </Button>
      </div>
    );
  if (state === "balanceHidden") return <p className="text-sm text-muted-foreground">{tType("noBookablePermission")}</p>;
  if (state === "loading")
    return (
      <div className="divide-y overflow-hidden rounded-xl border bg-card" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-14" />
          </div>
        ))}
      </div>
    );
  if (pickable.length === 0) return <p className="text-sm text-muted-foreground">{t("noneBookable")}</p>;

  const visit = order.map((id) => pickable.find((p) => p.id === id)).filter((p): p is PickableTherapy => !!p);
  const others = pickable.filter((p) => !selected.includes(p.id));
  return (
    <>
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t("addTherapy")}</p>
          <TherapyAddList services={others} disabled={disabled} onAdd={onToggle} />
        </div>
      )}
      {selected.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-3 py-4 text-center text-sm text-muted-foreground">
          {t("visitEmpty")}
        </p>
      ) : (
        <div className="space-y-1.5">
          <TrainVisitList
            visit={visit}
            areas={areas}
            disabled={disabled}
            stay={stay}
            onReorder={onReorder}
            onRemove={onToggle}
            onAreas={onAreas}
          />
          {selected.length > 1 && (
            <p className="flex flex-wrap justify-between gap-x-3 px-1 text-xs text-muted-foreground">
              <span>{keepOrder ? t("orderKept") : t("orderAuto")}</span>
              {keepOrder ? (
                <button type="button" className="font-medium text-primary hover:underline" disabled={disabled} onClick={onAutoOrder}>
                  {t("resetOrder")}
                </button>
              ) : (
                <span>{t("dragHint")}</span>
              )}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** «1 · La visita» / «2 · Las fechas»: what each side of the form is for. */
export function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      <span className="grid size-[18px] place-items-center rounded-full bg-foreground text-[10px] tracking-normal text-background">
        {n}
      </span>
      {children}
    </p>
  );
}
