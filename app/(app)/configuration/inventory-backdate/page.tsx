"use client";

import { useTranslations } from "next-intl";

import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { InventoryBackdateSettings } from "@/components/configuracion/inventory-backdate-settings";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Configuración → Inventario → adjustments dated in the past (cmr-be #646): window and negative-day policy.
export default function InventoryBackdatePage() {
  const t = useTranslations("inventoryBackdateSettings");
  const estado = useCentroPantalla("inventory.read", "inventory.backdate_settings");
  return (
    <ConfigGuard permiso="inventory.read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("pageHelp")} actions={<CentroPantallaSelector estado={estado} />} />
        {!estado.cargando && estado.centroActivo && (
          <InventoryBackdateSettings centerId={estado.centroActivo} canWrite={estado.puedeEscribir} />
        )}
      </PageContainer>
    </ConfigGuard>
  );
}
