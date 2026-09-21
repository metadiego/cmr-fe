"use client";

import { useTranslations } from "next-intl";

import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { useCan } from "@/hooks/use-can";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { SchedulingBridgeStatusCards } from "@/components/configuracion/scheduling-bridge-status-cards";
import { SchedulingBridgeConfigForm } from "@/components/configuracion/scheduling-bridge-config-form";
import {
  DoctorMappingsTable,
  AgentMappingsTable,
} from "@/components/configuracion/scheduling-bridge-mappings";
import { SchedulingBridgeRunsLog } from "@/components/configuracion/scheduling-bridge-runs-log";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Configuration → Integrations. Handoff docs/specs/scheduling-bridge-handoff-fe.md.
// Read/write are per-center (X-Tenant-ID); the status overview above fetches ALL
// visible centers at once via ?centerIds= since it's a health dashboard, not an edit form.
export default function SchedulingBridgePage() {
  const t = useTranslations("schedulingBridge");
  const { can } = useCan();
  const estado = useCentroPantalla("scheduling-bridge.read", "scheduling-bridge.config");

  const centroNombre = (id: string) => estado.centros.find((c) => c.id === id)?.name ?? id;

  return (
    <ConfigGuard permiso="scheduling-bridge.read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} actions={<CentroPantallaSelector estado={estado} />} />

        {estado.cargando ? null : (
          <div className="space-y-6">
            <SchedulingBridgeStatusCards
              centerIds={estado.centros.map((c) => c.id)}
              centroNombre={centroNombre}
              puedeRun={can("scheduling-bridge.run")}
            />

            {estado.centroActivo && (
              <>
                <SchedulingBridgeConfigForm centroId={estado.centroActivo} puedeEscribir={estado.puedeEscribir} />
                <DoctorMappingsTable centroId={estado.centroActivo} puedeEscribir={estado.puedeEscribir} />
                <AgentMappingsTable centroId={estado.centroActivo} puedeEscribir={estado.puedeEscribir} />
                <SchedulingBridgeRunsLog centroId={estado.centroActivo} />
              </>
            )}
          </div>
        )}
      </PageContainer>
    </ConfigGuard>
  );
}
