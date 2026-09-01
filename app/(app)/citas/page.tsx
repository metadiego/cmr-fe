"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedicasCalendar } from "@/components/agenda/medicas-calendar";
import { ServiciosCalendar } from "@/components/agenda/servicios-calendar";
import { PageContainer } from "@/components/ui/page";

// Agenda: two calendars over the same shell — medical appointments (citas, with
// time) and service sessions (frontdesk, by day). `?tab=servicios` deep-links
// the services tab. `?volver=<ruta>` muestra un botón "Volver" al origen de la
// llamada (p. ej. el tablero del frontdesk); sin rutas bespoke.
export default function CitasPage() {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab");
  const volver = params.get("volver");

  return (
    <PageContainer>
      {volver && (
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 gap-1.5"
          onClick={() => router.push(volver)}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {tc("back")}
        </Button>
      )}
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
    </PageContainer>
  );
}
