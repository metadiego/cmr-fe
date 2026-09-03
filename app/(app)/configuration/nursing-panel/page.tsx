"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { PanelSeccionesAdmin } from "@/components/paneles/panel-secciones-admin";

// Configuración → Panel de enfermería: CRUD de las SECCIONES del panel (definir qué avisos hay).
// Un solo panel hoy ('enfermeria'); el CRUD opera sobre el centro activo (X-Tenant-ID). Gate
// panel.config (el BE es la autoridad; borrar exige además rol admin). Ancho completo.
const PANEL_CLAVE = "enfermeria";

export default function ConfigPanelEnfermeriaPage() {
  const t = useTranslations("panelAdmin");
  const { can, ready } = useCan();

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && !can("panel.config") ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <PanelSeccionesAdmin clave={PANEL_CLAVE} />
      )}
    </PageContainer>
  );
}
