"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { RequeridosConfig } from "@/components/servicios/requeridos-config";

// Configuración → Campos requeridos por servicio (formAcciones.campos, con binding a la entidad).
// Gate servicios.config: configuración DELICADA (solo admin), no `servicios.update` del día a día. El BE
// es la autoridad (403 nombrando el permiso); esta guarda es para ver un aviso, no una pantalla que falla
// al guardar. Handoff configuracion-delicada-solo-admin.
export default function ConfigRequeridosPage() {
  const t = useTranslations("requeridos");
  const { can, ready } = useCan();
  const { centro } = useCentroGate();

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && !can("servicios.config") ? (
        <p className="text-sm text-muted-foreground">{t("sinPermiso")}</p>
      ) : (
        <RequeridosConfig centro={centro} />
      )}
    </PageContainer>
  );
}
