"use client";

import * as React from "react";

import type { Festivo } from "@/lib/api/disponibilidad";
import { monthMatrix, toISO, isFestivo } from "@/lib/agenda/calendar";
import { cn } from "@/lib/utils";

// Domain-agnostic event: the parent maps `id` back to its entity on click.
export interface AgendaEvent {
  id: string;
  hora: string | null; // null for day-based events (service sessions)
  label: string;
  color: string;
}

// Month grid (Sun→Sat). Days outside the month are dimmed; holidays are tinted
// and labelled. Clicking a day opens scheduling; clicking an event edits it.
export function MonthCalendar({
  year,
  month0,
  weekdays,
  eventsByDate,
  festivos,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month0: number;
  weekdays: string[]; // 7, Sun→Sat
  eventsByDate: Map<string, AgendaEvent[]>;
  festivos: Festivo[];
  onDayClick: (iso: string) => void;
  onEventClick: (id: string) => void;
}) {
  const weeks = monthMatrix(year, month0);
  const todayIso = toISO(new Date());

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {weekdays.map((d) => (
          <div key={d} className="px-2 py-2 text-center uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((date) => {
          const iso = toISO(date);
          const inMonth = date.getMonth() === month0;
          const fest = isFestivo(festivos, iso);
          const events = eventsByDate.get(iso) ?? [];
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDayClick(iso)}
              className={cn(
                "min-h-28 border-r border-b p-1.5 text-left align-top transition-colors hover:bg-accent/40",
                !inMonth && "bg-muted/20 text-muted-foreground",
                fest && "bg-rose-500/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-sm",
                    iso === todayIso && "bg-primary text-primary-foreground",
                  )}
                >
                  {date.getDate()}
                </span>
                {fest && (
                  <span className="truncate text-[10px] text-rose-500" title={fest.nombre}>
                    {fest.nombre}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {events.slice(0, 4).map((e) => (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(e.id);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") {
                        ev.stopPropagation();
                        onEventClick(e.id);
                      }
                    }}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] text-white"
                    style={{ backgroundColor: e.color }}
                    title={`${e.hora ?? ""} ${e.label}`}
                  >
                    {e.hora && <span className="font-mono">{e.hora}</span>}
                    <span className="truncate">{e.label}</span>
                  </div>
                ))}
                {events.length > 4 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{events.length - 4}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
