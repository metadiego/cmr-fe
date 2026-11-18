"use client";

import { useTranslations } from "next-intl";

import { type PatientTrain } from "@/lib/api/resources";
import { type Servicio } from "@/lib/api/servicios";
import { slotWarns } from "@/lib/agenda/slot-pick";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trainLegsText } from "@/components/agenda/therapy-train-grid";
import { PlanSummarySkeleton } from "@/components/agenda/therapy-day-skeleton";

// Bottom bar of the therapy day scheduler: the live real time in the clinic, the warnings and the
// «Agendar» buttons. Presentational: state and handlers come in by props.

type TrainSlot = PatientTrain["slots"][number];

export type TherapyDaySummaryProps = {
  time: string;
  trainLoading: boolean;
  train: PatientTrain | null;
  selectedSlot: TrainSlot | null;
  servById: Map<string, Servicio>;
  /** Text explaining why a slot does not fit. */
  slotReason: (slot: TrainSlot) => string;
  canBook: boolean;
  submitting: boolean;
  /** A patient and at least one therapy are chosen (enables the series button). */
  hasSelection: boolean;
  onOpenSeries: () => void;
  onBook: (close: boolean) => void;
};

export function TherapyDaySummary({
  time,
  trainLoading,
  train,
  selectedSlot,
  servById,
  slotReason,
  canBook,
  submitting,
  hasSelection,
  onOpenSeries,
  onBook,
}: TherapyDaySummaryProps) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <div className="min-w-0 space-y-1 text-sm">
        {!time ? (
          <p className="text-muted-foreground">{t("noHour")}</p>
        ) : trainLoading ? (
          <PlanSummarySkeleton />
        ) : selectedSlot && train ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {selectedSlot.fits ? <Badge variant="success">{t("fits")}</Badge> : <Badge variant={slotWarns(selectedSlot) ? "warning" : "destructive"}>{slotWarns(selectedSlot) ? t("fullWarns") : t("noFits")}</Badge>}
              <span className="font-medium">{t("startAt", { time })}</span>
              <span className="text-muted-foreground">· {t("patientMinutes", { n: train.patientMinutes })}</span>
            </div>
            {selectedSlot.fits ? (
              <p className="text-muted-foreground">{trainLegsText(selectedSlot, servById, "")}</p>
            ) : (
              <p className={slotWarns(selectedSlot) ? "text-warning-foreground" : "text-destructive"}>{slotReason(selectedSlot)}</p>
            )}
            {train.unconfiguredServiceIds.length > 0 && (
              <p className="text-warning-foreground">
                {t("sinRecurso", { list: train.unconfiguredServiceIds.map((id) => servById.get(id)?.name ?? id).join(", ") })}
              </p>
            )}
            {selectedSlot.staffBlocks.map((b, i) => (
              <p key={i} className="text-warning-foreground">{t("staffBlock", { from: b.from, to: b.to })}</p>
            ))}
          </>
        ) : null}
      </div>
      {/* Dos botones en vez de un cierre automático: el mostrador suele citar varias terapias del
          MISMO paciente en una sola visita — cerrar tras la primera obligaba a reabrir. «Seguir»
          limpia la selección y se queda en el mismo paciente/día; «Cerrar» hace lo de antes. */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onOpenSeries} disabled={!hasSelection}>
          {t("trainSeriesButton")}
        </Button>
        <Button size="lg" variant="outline" onClick={() => onBook(false)} disabled={!canBook}>
          {submitting ? tRoot("common.saving") : t("bookAndContinue")}
        </Button>
        <Button size="lg" onClick={() => onBook(true)} disabled={!canBook}>
          {submitting ? tRoot("common.saving") : t("bookAndClose")}
        </Button>
      </div>
    </div>
  );
}
