"use client";

import { useTranslations } from "next-intl";

import { getActiveCentro } from "@/lib/tenant";
import { TherapyDayScheduler } from "@/components/agenda/therapy-day-scheduler";
import { CreateClinicGate } from "@/components/kit/create-clinic-gate";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Ruta APARTE para «programar el día del paciente», para quien la prefiera separada del calendario. Monta el
// MISMO TherapyDayScheduler que el modal del calendario de «Citas de servicio» y el «Citar» del frontdesk —
// una sola pieza, se edita una vez y sirve en los tres sitios. Handoff HANDOFF-FE-agenda-de-terapias (P2).
export default function TherapyDayPage() {
  const t = useTranslations("therapyPlanner");
  // One clinic in the top bar: that one. «Ambos»: the page asks which clinic first.
  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <CreateClinicGate permission="frontdesk.create">
        {(clinicId) => <TherapyDayScheduler centro={clinicId ?? getActiveCentro() ?? undefined} />}
      </CreateClinicGate>
    </PageContainer>
  );
}
