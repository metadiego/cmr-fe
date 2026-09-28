"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CuposConfig } from "@/components/agenda/cupos-config";
import { FestivosConfig } from "@/components/agenda/festivos-config";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Config hub for Citas Médicas scheduling: hourly capacity (cupos) + holidays. Therapy/service
// capacity moved to /configuration/resources (27-sep-2026) — real physical/staff fit instead of a
// hand-typed hourly cap. See docs/specs/recursos-reemplaza-cupos-servicio.md.
export function AgendaConfig() {
  const t = useTranslations("agenda");
  const year = new Date().getFullYear();

  return (
    <PageContainer>
      <PageHeader
        title={t("cupos.title")}
        actions={
          <>
            <Link
              href="/configuration/resources"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("goToResources")}
            </Link>
            <Link
              href="/scheduling/appointments"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              {t("today")}
            </Link>
          </>
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">{t("resourcesMovedNote")}</p>

      <Tabs defaultValue="cupos">
        <TabsList className="mb-4">
          <TabsTrigger value="cupos">{t("cupos.tab")}</TabsTrigger>
          <TabsTrigger value="festivos">{t("festivos.tab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="cupos">
          <CuposConfig />
        </TabsContent>
        <TabsContent value="festivos">
          <FestivosConfig year={year} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
