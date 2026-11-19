"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { ChangeLogSheet } from "@/components/change-log/change-log-sheet";

// «Historial del día» in the patient's detail: every change to this patient's sessions that day, with
// undo (BE #529). Only with change_log.read.
export function PatientDayChangesButton({
  patientId,
  date,
  centerId,
  patientName,
  onUndone,
}: {
  patientId: string;
  date: string;
  centerId?: string;
  patientName?: string;
  onUndone?: () => void;
}) {
  const t = useTranslations("changeLog");
  const { can } = useCan();
  const [open, setOpen] = React.useState(false);
  if (!can("change_log.read")) return null;
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("dayTitle")}
      </Button>
      <ChangeLogSheet
        open={open}
        onOpenChange={setOpen}
        title={t("dayTitle")}
        subtitle={patientName ? `${patientName} · ${date}` : date}
        filter={{ patientId, date, centerIds: centerId ? [centerId] : undefined }}
        onUndone={onUndone}
      />
    </>
  );
}
