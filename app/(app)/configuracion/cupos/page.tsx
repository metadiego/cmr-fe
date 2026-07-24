"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { CuposServicioConfig } from "@/components/agenda/cupos-servicio-config";

// Configuración → Cupos por hora POR SERVICIO (frontdesk). 100% dato (CRUD /citas/cupos con servicioId).
// Gate `citas.config` (mostrar/ocultar). Ver handoff be-cupos-config-ui-handoff.
export default function ConfigCuposPage() {
  const t = useTranslations("agenda");
  const { can, ready } = useCan();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("cupos.serviceTitle")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("cupos.serviceHelp")}</p>
      {ready && !can("citas.config") ? (
        <p className="text-sm text-muted-foreground">{t("cupos.noPermiso")}</p>
      ) : (
        <CuposServicioConfig />
      )}
    </div>
  );
}
