"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && !can("servicios.config") ? (
        <p className="text-sm text-muted-foreground">{t("sinPermiso")}</p>
      ) : (
        <RequeridosConfig centro={centro} />
      )}
    </div>
  );
}
