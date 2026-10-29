"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedicasCalendar } from "@/components/agenda/medicas-calendar";
import { ServiciosCalendar } from "@/components/agenda/servicios-calendar";
import { PageContainer } from "@/components/ui/page";
import { Can } from "@/components/kit/can";
import { useTabRoute } from "@/hooks/use-tab-route";
import { APPOINTMENTS_TABS } from "@/lib/nav/tab-routes";

// Agenda: two calendars over the same shell — medical appointments (with time) at
// /scheduling/appointments and service sessions (frontdesk, by day) at /scheduling/appointments/services.
// The active tab is the URL path (lib/nav/tab-routes.ts), so a link opens the tab it names and reload
// lands on the same tab. This is the layout of both tab routes, so switching tabs keeps it mounted.
// There is no in-page "back" link: the sidebar and the browser's Back already cover it.
// Scheduling configuration (slots, resources, holidays) is reached from the settings button on the
// tab row, not from the sidebar: it is configuration OF this screen, so it lives with it.
export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("agenda");
  const [tab, selectTab] = useTabRoute(APPOINTMENTS_TABS);

  return (
    <PageContainer>
      <Tabs value={tab} onValueChange={selectTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="medical">{t("tabMedicas")}</TabsTrigger>
            <TabsTrigger value="services">{t("tabServicios")}</TabsTrigger>
          </TabsList>
          <Can permiso="citas.config">
            <Button variant="outline" asChild>
              <Link href="/scheduling/slots">
                <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} data-icon="inline-start" />
                {t("settings")}
              </Link>
            </Button>
          </Can>
        </div>
        <TabsContent value="medical">
          <MedicasCalendar />
        </TabsContent>
        <TabsContent value="services">
          <ServiciosCalendar />
        </TabsContent>
      </Tabs>
      {children}
    </PageContainer>
  );
}
