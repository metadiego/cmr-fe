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
// its turn in the train (with 2+ ticked) and, for a per-area therapy, the areas stepper. No colours:
// selection is the accent background, the balance is the Citas success pill.
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
  const tType = useTranslations("appointmentsBooking.typePicker");
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
              "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]",
              on ? "bg-accent/50" : "hover:bg-muted/50",
            )}
          >
            <Checkbox id={id} checked={on} disabled={disabled} onCheckedChange={() => onToggle(s.id)} />
            <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col">
              <span className="truncate text-sm font-medium">{s.name}</span>
              {s.minutes != null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {s.perArea ? t("minutesPerArea", { n: s.minutes }) : t("minutes", { n: s.minutes })}
                </span>
              )}
            </label>
            <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:justify-end">
              {on && s.perArea && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success-foreground tabular-nums">
                {tType("sessionsLeft", { n: s.bookable })}
              </span>
              {showTurns && (
                <span className="w-6 text-right text-xs font-medium text-muted-foreground tabular-nums" aria-hidden={!on}>
                  {on && turn >= 0 ? t("turn", { n: turn + 1 }) : ""}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
