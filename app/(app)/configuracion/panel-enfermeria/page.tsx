"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { PanelSeccionesAdmin } from "@/components/paneles/panel-secciones-admin";

// Configuración → Panel de enfermería: CRUD de las SECCIONES del panel (definir qué avisos hay).
// Un solo panel hoy ('enfermeria'); el CRUD opera sobre el centro activo (X-Tenant-ID). Gate
// panel.config (el BE es la autoridad; borrar exige además rol admin). Ancho completo.
const PANEL_CLAVE = "enfermeria";

export default function ConfigPanelEnfermeriaPage() {
  const t = useTranslations("panelAdmin");
  const { can, ready } = useCan();

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-3xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && !can("panel.config") ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <PanelSeccionesAdmin clave={PANEL_CLAVE} />
      )}
    </div>
  );
}
