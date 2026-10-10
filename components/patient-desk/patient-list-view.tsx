"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { PatientDay, PatientKind } from "@/lib/frontdesk/patient-day";
import type { PatientDayData } from "@/hooks/use-patient-day";
import { PatientChips, PatientDetail, type ScheduleRequest } from "@/components/patient-desk/patient-detail";
import { cn } from "@/lib/utils";

interface Props {
  patients: PatientDay[];
  data: PatientDayData;
  kind: PatientKind;
  date: string;
  centerId: string | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSchedule: (r: ScheduleRequest) => void;
}

// Master/detail: the day's patients on the left, the selected one's services on the right.
// The list scrolls on its own so the detail stays in view on a wide screen.
export function PatientListView({ patients, data, kind, date, centerId, selectedId, onSelect, onSchedule }: Props) {
  const t = useTranslations("patientDesk");
  const selected = patients.find((p) => p.patientId === selectedId) ?? null;
  return (
    <div className="grid min-h-[60vh] gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <ul className="max-h-[calc(100vh-15rem)] space-y-1.5 overflow-y-auto rounded-lg bg-card p-2 ring-1 ring-foreground/10" aria-label={t("patients")}>
        {patients.map((p) => (
          <li key={p.patientId}>
            <button
              type="button"
              onClick={() => onSelect(p.patientId)}
              aria-current={p.patientId === selectedId}
              className={cn(
                "w-full rounded-md px-3 py-2 text-left transition",
                p.patientId === selectedId ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60",
                p.allCancelled && "opacity-60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{p.name || "—"}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{p.earliestTime ?? ""}</span>
              </div>
              <div className="mb-1 text-[11px] text-muted-foreground">{p.record ? `#${p.record}` : ""}</div>
              <PatientChips patient={p} data={data} compact />
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
        {selected ? (
          <PatientDetail patient={selected} data={data} kind={kind} date={date} centerId={centerId} onSchedule={onSchedule} />
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("pickPatient")}</p>
        )}
      </div>
    </div>
  );
}
