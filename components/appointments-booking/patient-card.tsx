"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { patientName } from "@/components/appointments-booking/whos-calling-panel";
import type { Paciente } from "@/lib/api/pacientes";
import type { Centro } from "@/lib/api/centers";

// The chosen patient at the top of the rail: who is on the phone (name, record, phone, center), a link
// to the record, and ✕ back to the start panels. `patient` is null while it loads from the URL
// (`?patient=<id>`); `failed` when that load failed, so ✕ is still there to get out.
export function PatientCard({
  patientId,
  patient,
  failed,
  centers,
  onClose,
}: {
  patientId: string;
  patient: Paciente | null;
  failed: boolean;
  centers: Centro[];
  onClose: () => void;
}) {
  const t = useTranslations("appointmentsBooking");
  const center = patient?.clinicId ? centers.find((c) => c.id === patient.clinicId)?.name : undefined;

  return (
    <div className="flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="min-w-0 flex-1">
        {patient ? (
          <>
            <p className="truncate text-base font-semibold">{patientName(patient)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                patient.medicalRecordNumber && t("patient.record", { record: patient.medicalRecordNumber }),
                patient.phone,
                center,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <Link href={`/patients/${patientId}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
              {t("patient.openRecord")}
            </Link>
          </>
        ) : (
          <p className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {failed ? t("patient.notFound") : t("loading")}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose} aria-label={t("patient.clear")}>
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
      </Button>
    </div>
  );
}
