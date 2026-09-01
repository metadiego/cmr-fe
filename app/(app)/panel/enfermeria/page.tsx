"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { PanelEnfermeria } from "@/components/paneles/panel-enfermeria";
import { PageContainer } from "@/components/ui/page";

// Panel de Enfermería (kiosco). Gate `panel.read`. Multi-tenant por centro activo.
// Debe abrirse con un usuario de enfermería sin permisos de recepción.
export default function PanelEnfermeriaPage() {
  const t = useTranslations("panel");
  const { can, ready } = useCan();
  const { centro } = useCentroGate();

  if (ready && !can("panel.read")) {
    return <PageContainer className="text-center text-sm text-muted-foreground">{t("sinPermiso")}</PageContainer>;
  }
  return <PanelEnfermeria centro={centro} />;
}
