"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { FormatosAdmin } from "@/components/formatos/formatos-admin";

// Configuración → Formatos de terapia (CRUD data-driven). Gate formatos.config. Multi-tenant por centro.
export default function ConfigFormatosPage() {
  const t = useTranslations("formatosAdmin");
  const { can, ready } = useCan();
  const { centro } = useCentroGate();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && !can("formatos.config") ? (
        <p className="text-sm text-muted-foreground">{t("sinPermiso")}</p>
      ) : (
        <FormatosAdmin centro={centro} />
      )}
    </div>
  );
}
