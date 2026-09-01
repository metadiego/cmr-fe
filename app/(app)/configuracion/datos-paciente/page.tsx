"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ConfigAltaAdmin } from "@/components/clientes/config-alta-admin";

// Configuración → Datos obligatorios del paciente: qué exige el alta (además de nombres). Distinto de
// "Requisitos por servicio". Gate pacientes.config (el BE es la autoridad). Opera sobre el centro activo.
export default function ConfigDatosPacientePage() {
  const t = useTranslations("configAlta");
  const { can, ready } = useCan();

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && !can("pacientes.config") ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <ConfigAltaAdmin />
      )}
    </PageContainer>
  );
}
