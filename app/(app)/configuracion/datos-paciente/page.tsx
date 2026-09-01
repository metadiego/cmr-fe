"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { ConfigAltaAdmin } from "@/components/clientes/config-alta-admin";

// Configuración → Datos obligatorios del paciente: qué exige el alta (además de nombres). Distinto de
// "Requisitos por servicio". Gate pacientes.config (el BE es la autoridad). Opera sobre el centro activo.
export default function ConfigDatosPacientePage() {
  const t = useTranslations("configAlta");
  const { can, ready } = useCan();

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && !can("pacientes.config") ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <ConfigAltaAdmin />
      )}
    </div>
  );
}
