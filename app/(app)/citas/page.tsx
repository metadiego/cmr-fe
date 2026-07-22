"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedicasCalendar } from "@/components/agenda/medicas-calendar";
import { ServiciosCalendar } from "@/components/agenda/servicios-calendar";

// Agenda: two calendars over the same shell — medical appointments (citas, with
// time) and service sessions (frontdesk, by day). `?tab=servicios` deep-links
// the services tab (used by the Frontdesk "Citar" button).
export default function CitasPage() {
  const t = useTranslations("agenda");
  const tab = useSearchParams().get("tab");
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Tabs defaultValue={tab === "servicios" ? "servicios" : "medicas"}>
        <TabsList className="mb-4">
          <TabsTrigger value="medicas">{t("tabMedicas")}</TabsTrigger>
          <TabsTrigger value="servicios">{t("tabServicios")}</TabsTrigger>
        </TabsList>
        <TabsContent value="medicas">
          <MedicasCalendar />
        </TabsContent>
        <TabsContent value="servicios">
          <ServiciosCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
