"use client";

import { useTranslations } from "next-intl";

import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { CashCountModeAdmin } from "@/components/configuracion/cash-count-mode-admin";
import { CashCloseSettingAdmin } from "@/components/configuracion/cash-close-setting";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Configuración → el interruptor por centro de cómo se cuenta el efectivo del día (BE #566,
// handoff .personal/handoff-cuadre-uno-o-dos-conteos.md). Lejos de los usuarios del cuadre: solo
// aquí, y solo editable con `caja.count_mode` (concesión explícita, ningún rol la trae por defecto).
export default function CashCountModePage() {
  const t = useTranslations("cashCountMode");
  const estado = useCentroPantalla("caja.read", "caja.count_mode");

  return (
    <ConfigGuard permiso="caja.read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("help")} actions={<CentroPantallaSelector estado={estado} />} />
        {!estado.cargando && estado.centroActivo && (
          <>
            <CashCountModeAdmin centroId={estado.fetchCentroId} puedeEscribir={estado.puedeEscribir} />
            <CashCloseSettingAdmin centerId={estado.fetchCentroId} canWrite={estado.puedeEscribir} />
          </>
        )}
      </PageContainer>
    </ConfigGuard>
  );
}
