"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CuposConfig } from "@/components/agenda/cupos-config";
import { FestivosConfig } from "@/components/agenda/festivos-config";
import { ResourcesSection } from "@/components/configuracion/resources-config";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Config hub de agenda: citas médicas (cupos, motor de tope fijo) Y servicio/terapias (recursos,
// motor de cuartos+personal real) EN UNA SOLA pantalla — son motores TOTALMENTE distintos (regla
// del dueño, 27-sep-2026: no se mezclan), pero comparten el mismo propósito de disponibilidad y el
// dueño no quiere brincar de /scheduling/slots a /configuration/resources para verlos. La pestaña
// "Recursos" es el mismo componente que /configuration/resources (que sigue viva, standalone, por
// si algo la enlaza). See docs/specs/recursos-reemplaza-cupos-servicio.md.
//
// One flat row of tabs: the two resource sections (list + per-service consumption) are top-level
// tabs here rather than a tab bar nested inside a "Recursos" tab. They share one centre choice,
// whose selector sits at the right of the tab row and only shows on those two tabs.
const RESOURCE_TABS = new Set(["resources", "consumption"]);

export function AgendaConfig() {
  const t = useTranslations("agenda");
  const tRes = useTranslations("resources");
  const year = new Date().getFullYear();
  const [tab, setTab] = React.useState("slots");
  const resourcesEstado = useCentroPantalla("resources.read", "resources.config");

  return (
    <PageContainer>
      <PageHeader title={t("cupos.title")} />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="slots">{t("cupos.tab")}</TabsTrigger>
            <TabsTrigger value="resources">{t("recursos.tab")}</TabsTrigger>
            <TabsTrigger value="consumption">{tRes("tabConsumo")}</TabsTrigger>
            <TabsTrigger value="holidays">{t("festivos.tab")}</TabsTrigger>
          </TabsList>
          {RESOURCE_TABS.has(tab) && (
            <CentroPantallaSelector estado={resourcesEstado} />
          )}
        </div>
        <TabsContent value="slots">
          <CuposConfig />
        </TabsContent>
        <TabsContent value="resources">
          <ConfigGuard permiso="resources.read">
            <ResourcesSection estado={resourcesEstado} section="resources" />
          </ConfigGuard>
        </TabsContent>
        <TabsContent value="consumption">
          <ConfigGuard permiso="resources.read">
            <ResourcesSection estado={resourcesEstado} section="consumption" />
          </ConfigGuard>
        </TabsContent>
        <TabsContent value="holidays">
          <FestivosConfig year={year} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
