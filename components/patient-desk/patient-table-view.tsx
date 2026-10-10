"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import type { PatientDay } from "@/lib/frontdesk/patient-day";
import type { PatientDayData } from "@/hooks/use-patient-day";
import { PatientChips, PatientDetail, type ScheduleRequest } from "@/components/patient-desk/patient-detail";
import { cn } from "@/lib/utils";
import { fmtHora as formatTime } from "@/components/frontdesk/frontdesk-board.helpers";

interface Props {
  patients: PatientDay[];
  data: PatientDayData;
  date: string;
  centerId: string | undefined;
  openIds: Set<string>;
  onToggle: (id: string) => void;
  onSchedule: (r: ScheduleRequest) => void;
}

// Option 2 — one table of the day's patients; a click opens the row in place with all their services
// and their columns. Several can be open at once.
export function PatientTableView({ patients, data, date, centerId, openIds, onToggle, onSchedule }: Props) {
  const t = useTranslations("patientDesk");
  return (
    <div className="overflow-x-auto rounded-lg bg-card ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-2 py-2" />
            <th className="px-3 py-2 font-semibold">{t("colPatient")}</th>
            <th className="px-3 py-2 font-semibold">{t("record")}</th>
            <th className="px-3 py-2 font-semibold">{t("colBooked")}</th>
            <th className="px-3 py-2 font-semibold">{t("colArrived")}</th>
            <th className="px-3 py-2 font-semibold">{t("colToday")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {patients.map((p) => {
            const open = openIds.has(p.patientId);
            return (
              <React.Fragment key={p.patientId}>
                <tr
                  className={cn("cursor-pointer hover:bg-muted/40", open && "bg-primary/5", p.allCancelled && "opacity-60")}
                  onClick={() => onToggle(p.patientId)}
                  aria-expanded={open}
                >
                  <td className="px-2 py-2 text-muted-foreground">
                    <HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowRight01Icon} className="size-4" />
                  </td>
                  <td className="px-3 py-2 font-semibold">{p.name || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">{p.record}</td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">{p.earliestTime ?? ""}</td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">{formatTime(p.presentAt)}</td>
                  <td className="px-3 py-2"><PatientChips patient={p} data={data} /></td>
                </tr>
                {open && (
                  <tr className="bg-muted/20">
                    <td colSpan={6} className="px-3 py-3">
                      <PatientDetail patient={p} data={data} date={date} centerId={centerId} onSchedule={onSchedule} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
