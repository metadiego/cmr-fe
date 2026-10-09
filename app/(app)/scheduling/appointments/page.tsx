"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

// Agenda: two calendars over the same shell — medical appointments (citas, with
// time) and service sessions (frontdesk, by day). `?tab=servicios` deep-links
// the services tab.
// The active tab is driven by the URL (not kept as local state), so a deep link always opens the tab it
// names and switching tabs updates the URL; reload and Back then land on the same tab. There is no
// in-page "back" link: the sidebar and the browser's Back already cover it.
// Scheduling configuration (slots, resources, holidays) is reached from the settings button on the
// tab row, not from the sidebar: it is configuration OF this screen, so it lives with it.
export default function CitasPage() {
  const t = useTranslations("agenda");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") === "servicios" ? "servicios" : "medicas";

  function selectTab(next: string) {
    const q = new URLSearchParams(params.toString());
    if (next === "servicios") q.set("tab", next);
    else q.delete("tab");
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <PageContainer>
      <Tabs value={tab} onValueChange={selectTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="medicas">{t("tabMedicas")}</TabsTrigger>
            <TabsTrigger value="servicios">{t("tabServicios")}</TabsTrigger>
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
