"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Stepper } from "@/components/appointments-booking/series-frequency";
import { cn } from "@/lib/utils";

export interface PickableTherapy {
  id: string;
  name: string;
  /** Sessions left to book (only therapies with some are listed). */
  bookable: number;
  /** Charged per area (the laser): a ticked row shows the areas stepper. */
  perArea: boolean;
  /** Per visit, or per area when `perArea`; null = not known yet (the BE plans it once ticked). */
  minutes: number | null;
}

const MAX_AREAS = 6;

// The «Terapias» field of the patient desk's booking form: one bordered list with a row per therapy the
// patient has sessions left for, the same shape as the Citas type list and date rows. A ticked row shows
// its turn in the train (with 2+ ticked) as a numbered badge before the name and, for a per-area
// therapy, the areas stepper on the right. Duration and sessions left share one quiet line under the name.
export function TherapyPickerList({
  services,
  selected,
  order,
  areas,
  disabled,
  onToggle,
  onAreas,
}: {
  services: PickableTherapy[];
  selected: readonly string[];
  /** The ticked ids in the order the train does them. */
  order: readonly string[];
  areas: Record<string, number>;
  disabled: boolean;
  onToggle: (id: string) => void;
  onAreas: (id: string, n: number) => void;
}) {
  const t = useTranslations("therapyBooking");
  const showTurns = order.length > 1;

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-label={t("therapies")}>
      {services.map((s) => {
        const on = selected.includes(s.id);
        const turn = order.indexOf(s.id);
        const id = `therapy-${s.id}`;
        return (
          <li
            key={s.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 transition-colors",
              on ? "bg-accent/50" : "hover:bg-muted/50",
            )}
          >
            <Checkbox id={id} checked={on} disabled={disabled} onCheckedChange={() => onToggle(s.id)} />
            <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2">
                {/* Its turn in the train, once two or more are ticked. */}
                {showTurns && on && turn >= 0 && (
                  <span
                    title={t("turn", { n: turn + 1 })}
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums"
                  >
                    {turn + 1}
                  </span>
                )}
                <span className="truncate text-sm font-medium">{s.name}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {s.minutes != null && (
                  <>
                    {s.perArea ? t("minutesPerArea", { n: s.minutes }) : t("minutes", { n: s.minutes })}
                    <span aria-hidden> · </span>
                  </>
                )}
                <span className="font-medium text-success-foreground">{t("left", { n: s.bookable })}</span>
              </span>
            </label>
            {on && s.perArea && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                {t("areas")}
                <Stepper
                  compact
                  label={`${t("areas")} · ${s.name}`}
                  value={areas[s.id] ?? 1}
                  min={1}
                  max={MAX_AREAS}
                  disabled={disabled}
                  onChange={(n) => onAreas(s.id, n)}
                />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
