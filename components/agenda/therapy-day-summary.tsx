"use client";

import { useTranslations } from "next-intl";

import { type PatientTrain } from "@/lib/api/resources";
import { type Servicio } from "@/lib/api/servicios";
import { slotWarns } from "@/lib/agenda/slot-pick";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trainLegsText } from "@/components/agenda/therapy-train-grid";
import { PlanSummarySkeleton } from "@/components/agenda/therapy-day-skeleton";
import { FormFooter } from "@/components/kit/form-footer";
import { RequiredLegend } from "@/components/kit/required-mark";

// Bottom bar of the therapy day scheduler: the live real time in the clinic, the warnings and the
// «Agendar» buttons on the kit's FormFooter (what is missing shows above them). Presentational:
// state and handlers come in by props.

type TrainSlot = PatientTrain["slots"][number];

export type TherapyDaySummaryProps = {
  time: string;
  trainLoading: boolean;
  train: PatientTrain | null;
  selectedSlot: TrainSlot | null;
  servById: Map<string, Servicio>;
  /** Text explaining why a slot does not fit. */
  slotReason: (slot: TrainSlot) => string;
  /** Labels of the required fields still empty (on-screen order); non-empty disables booking. */
  missing: string[];
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
  missing,
  submitting,
  hasSelection,
  onOpenSeries,
  onBook,
}: TherapyDaySummaryProps) {
  const t = useTranslations("therapyPlanner");

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
        <p>
          <RequiredLegend />
        </p>
      </div>
      {/* Dos botones en vez de un cierre automático: el mostrador suele citar varias terapias del
          MISMO paciente en una sola visita — cerrar tras la primera obligaba a reabrir. «Seguir»
          limpia la selección y se queda en el mismo paciente/día; «Cerrar» hace lo de antes. */}
      <FormFooter
        className="ml-auto"
        missing={missing}
        submitting={submitting}
        primary={[
          { label: t("bookAndContinue"), variant: "outline", onClick: () => onBook(false) },
          { label: t("bookAndClose"), onClick: () => onBook(true) },
        ]}
        extra={
          <Button size="sm" variant="ghost" onClick={onOpenSeries} disabled={!hasSelection}>
            {t("trainSeriesButton")}
          </Button>
        }
      />
    </div>
  );
}
