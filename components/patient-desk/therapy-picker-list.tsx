"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/appointments-booking/series-frequency";
import { moveItem } from "@/lib/agenda/booking/train-why";
import { cn } from "@/lib/utils";

export interface PickableTherapy {
  id: string;
  name: string;
  /** Sessions left to book (only therapies with some are listed). */
  bookable: number;
  /** Charged per area (the laser): a therapy in the visit shows the areas stepper. */
  perArea: boolean;
  /** Per visit, or per area when `perArea`; null = not known yet (the BE plans it once in the visit). */
  minutes: number | null;
}

const MAX_AREAS = 6;

// The left side of the patient desk's therapy form. «La visita»: the therapies in the visit, numbered in
// the order they are done, reordered by dragging (or with the arrow keys on the handle, or the ↑↓ shown
// on phones), each with its areas stepper when charged per area and a ✕ to take it out; the patient's
// time at the clinic closes the list. «Añadir terapia»: the others the patient has sessions left for.

function Meta({ s }: { s: PickableTherapy }) {
  const t = useTranslations("therapyBooking");
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {s.minutes != null && (
        <>
          {s.perArea ? t("minutesPerArea", { n: s.minutes }) : t("minutes", { n: s.minutes })}
          <span aria-hidden> · </span>
        </>
      )}
      <span className="font-medium text-success-foreground">{t("left", { n: s.bookable })}</span>
    </span>
  );
}

export function TrainVisitList({
  visit,
  areas,
  disabled,
  stay,
  onReorder,
  onRemove,
  onAreas,
}: {
  /** The therapies in the visit, in the order they are done. */
  visit: PickableTherapy[];
  areas: Record<string, number>;
  disabled: boolean;
  /** What closes the list: the patient's time at the clinic, or why it is not known. */
  stay: string;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  onAreas: (id: string, n: number) => void;
}) {
  const t = useTranslations("therapyBooking");
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);
  const ids = visit.map((s) => s.id);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    onReorder(moveItem(ids, from, to));
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <ol aria-label={t("stepVisit")}>
        {visit.map((s, i) => (
          <li
            key={s.id}
            draggable={!disabled && visit.length > 1}
            onDragStart={(e) => {
              setDragging(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, i);
              setDragging(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            className={cn(
              "flex items-center gap-2 border-t px-2 py-2 first:border-t-0",
              dragging === i && "opacity-50",
              over === i && dragging !== null && dragging !== i && "bg-accent/60",
            )}
          >
            {visit.length > 1 ? (
              <button
                type="button"
                disabled={disabled}
                className="hidden cursor-grab rounded p-0.5 text-muted-foreground/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing sm:block"
                aria-label={t("dragHandle", { therapy: s.name })}
                title={t("dragHandle", { therapy: s.name })}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(i, i - 1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(i, i + 1);
                  }
                }}
              >
                <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} className="size-4" />
              </button>
            ) : (
              <span className="hidden w-5 sm:block" />
            )}
            <span
              title={t("turn", { n: i + 1 })}
              className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums"
            >
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{s.name}</span>
              <Meta s={s} />
            </span>
            {s.perArea && (
              <Stepper
                compact
                label={`${t("areas")} · ${s.name}`}
                value={areas[s.id] ?? 1}
                min={1}
                max={MAX_AREAS}
                disabled={disabled}
                onChange={(n) => onAreas(s.id, n)}
              />
            )}
            {visit.length > 1 && (
              <span className="flex flex-col sm:hidden">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled || i === 0}
                  aria-label={t("moveUp", { therapy: s.name })}
                  onClick={() => move(i, i - 1)}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled || i === visit.length - 1}
                  aria-label={t("moveDown", { therapy: s.name })}
                  onClick={() => move(i, i + 1)}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                </Button>
              </span>
            )}
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground"
              disabled={disabled}
              aria-label={t("removeFromVisit", { therapy: s.name })}
              title={t("removeFromVisit", { therapy: s.name })}
              onClick={() => onRemove(s.id)}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex items-baseline justify-between gap-3 border-t bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">{t("patientStays")}</span>
        <span className="font-semibold tabular-nums">{stay}</span>
      </div>
    </div>
  );
}

export function TherapyAddList({
  services,
  disabled,
  onAdd,
}: {
  services: PickableTherapy[];
  disabled: boolean;
  onAdd: (id: string) => void;
}) {
  const t = useTranslations("therapyBooking");
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-label={t("addTherapy")}>
      {services.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm">{s.name}</span>
            <Meta s={s} />
          </span>
          <Button type="button" size="xs" variant="outline" disabled={disabled} onClick={() => onAdd(s.id)}>
            + {t("add")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
