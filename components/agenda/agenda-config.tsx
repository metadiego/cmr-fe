"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CuposConfig } from "@/components/agenda/cupos-config";
import { FestivosConfig } from "@/components/agenda/festivos-config";
import { ResourcesConfig } from "@/components/configuracion/resources-config";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Config hub de agenda: citas médicas (cupos, motor de tope fijo) Y servicio/terapias (recursos,
// motor de cuartos+personal real) EN UNA SOLA pantalla — son motores TOTALMENTE distintos (regla
// del dueño, 27-sep-2026: no se mezclan), pero comparten el mismo propósito de disponibilidad y el
// dueño no quiere brincar de /scheduling/slots a /configuration/resources para verlos. La pestaña
// "Recursos" es el mismo componente que /configuration/resources (que sigue viva, standalone, por
// si algo la enlaza). See docs/specs/recursos-reemplaza-cupos-servicio.md.
export function AgendaConfig() {
  const t = useTranslations("agenda");
  const year = new Date().getFullYear();

  return (
    <PageContainer>
      <PageHeader
        title={t("cupos.title")}
        actions={
          <Link
            href="/scheduling/appointments"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            {t("today")}
          </Link>
        }
      />

      <Tabs defaultValue="cupos">
        <TabsList className="mb-4">
          <TabsTrigger value="cupos">{t("cupos.tab")}</TabsTrigger>
          <TabsTrigger value="recursos">{t("recursos.tab")}</TabsTrigger>
          <TabsTrigger value="festivos">{t("festivos.tab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="cupos">
          <CuposConfig />
        </TabsContent>
        <TabsContent value="recursos">
          <ResourcesConfig embedded />
        </TabsContent>
        <TabsContent value="festivos">
          <FestivosConfig year={year} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
