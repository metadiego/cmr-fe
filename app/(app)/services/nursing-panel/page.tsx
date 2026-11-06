"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { PanelEnfermeria } from "@/components/paneles/panel-enfermeria";
import { PageContainer } from "@/components/ui/page";

// Panel de Enfermería (kiosco). Gate `panel.read`. Multi-tenant por centro activo.
// Debe abrirse con un usuario de enfermería sin permisos de recepción.
// El gate de centro (igual que facturación/caja): sin esto, un usuario con 2+ centros y ninguno activo
// resuelto (p. ej. viendo "Ambos") se quedaba con `centro` undefined y el panel salía EN BLANCO, sin
// decir por qué — indistinguible de un 403 de verdad (ver panel-enfermeria.tsx para ese otro arreglo).
export default function PanelEnfermeriaPage() {
  const t = useTranslations("panel");
  const { can, ready } = useCan();
  const gate = useCentroGate();

  if (ready && !can("panel.read")) {
    return <PageContainer className="text-center text-sm text-muted-foreground">{t("sinPermiso")}</PageContainer>;
  }
  if (gate.sinCentro) {
    return <PageContainer className="text-center text-sm text-muted-foreground">{t("sinCentro")}</PageContainer>;
  }
  if (gate.necesitaPicker) {
    return (
      <PageContainer>
        <CentroPicker centros={gate.centros} onPick={gate.pick} />
      </PageContainer>
    );
  }
  return <PanelEnfermeria centro={gate.centro} />;
}
