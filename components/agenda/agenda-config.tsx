"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CuposConfig } from "@/components/agenda/cupos-config";
import { CuposServicioConfig } from "@/components/agenda/cupos-servicio-config";
import { FestivosConfig } from "@/components/agenda/festivos-config";
import { PageContainer } from "@/components/ui/page";

// Config hub for Citas Médicas scheduling: hourly capacity (cupos) + holidays.
export function AgendaConfig() {
  const t = useTranslations("agenda");
  const year = new Date().getFullYear();

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/citas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {t("today")}
        </Link>
        <h1 className="text-xl font-semibold">{t("cupos.title")}</h1>
      </div>

      <Tabs defaultValue="cupos">
        <TabsList className="mb-4">
          <TabsTrigger value="cupos">{t("cupos.tab")}</TabsTrigger>
          <TabsTrigger value="servicios">{t("cupos.serviceTab")}</TabsTrigger>
          <TabsTrigger value="festivos">{t("festivos.tab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="cupos">
          <CuposConfig />
        </TabsContent>
        <TabsContent value="servicios">
          <CuposServicioConfig />
        </TabsContent>
        <TabsContent value="festivos">
          <FestivosConfig year={year} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
