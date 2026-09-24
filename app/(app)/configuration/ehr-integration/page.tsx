"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getEhrConfig, setEhrConfig, type EhrConfig } from "@/lib/api/ehr-integration";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { Switch } from "@/components/ui/switch";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Configuración → el interruptor «enchufe» del enganche con el EHR (cmr-ehr), POR CENTRO. Encendido:
// al marcar Presente en Atención se empuja el paciente al EHR (lo hace el BE) y el FE exige antes los 5
// datos. Apagado: no pasa nada. Handoff be-ehr-integration-presente-handoff.
export default function EhrIntegrationConfigPage() {
  const t = useTranslations("ehrIntegration");
  const estado = useCentroPantalla("ehr-integration.config", "ehr-integration.config");

  return (
    <ConfigGuard permiso="ehr-integration.config">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} actions={<CentroPantallaSelector estado={estado} />} />
        {estado.cargando ? null : estado.centroActivo ? (
          <EhrToggle centroId={estado.fetchCentroId} puedeEscribir={estado.puedeEscribir} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("elegirCentro")}</p>
        )}
      </PageContainer>
    </ConfigGuard>
  );
}

function EhrToggle({ centroId, puedeEscribir }: { centroId?: string; puedeEscribir: boolean }) {
  const t = useTranslations("ehrIntegration");
  const tRoot = useTranslations();
  const { state } = useResource<EhrConfig>(() => getEhrConfig(centroId), [centroId]);
  // Estado local con rollback: si el PUT falla, se vuelve al último valor bueno del servidor.
  const [on, setOn] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [seededFor, setSeededFor] = React.useState<{ centroId?: string } | null>(null);
  if (state.kind === "ok" && (seededFor === null || seededFor.centroId !== centroId)) {
    setSeededFor({ centroId });
    setOn(state.data.habilitado);
  }

  if (state.kind === "fail") return <p className="text-sm text-destructive">{state.message}</p>;
  if (state.kind === "loading" || on === null) return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;

  async function cambiar(next: boolean) {
    if (busy || !puedeEscribir) return;
    const prev = on;
    setOn(next);
    setBusy(true);
    try {
      await setEhrConfig(next, centroId);
      toast.success(t("saved"));
    } catch (e) {
      setOn(prev); // rollback
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{t("toggleLabel")}</p>
        <p className="text-xs text-muted-foreground">{t("toggleHelp")}</p>
      </div>
      <Switch checked={on} onCheckedChange={cambiar} disabled={busy || !puedeEscribir} />
    </div>
  );
}
