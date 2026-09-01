"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { FormatosAdmin } from "@/components/formatos/formatos-admin";

// Configuración → Formatos de terapia (CRUD data-driven). Gate formatos.config. Multi-tenant: SIEMPRE
// scoped a un centro (si no hay activo y el usuario tiene varios, se pide elegir) para no mezclar los
// formatos de los dos centros (Amnisome ×2). Sin centro concreto, /formatos devuelve todos los centros.
export default function ConfigFormatosPage() {
  const t = useTranslations("formatosAdmin");
  const { can, ready } = useCan();
  const { centro, centros, necesitaPicker, pick } = useCentroGate();

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && !can("formatos.config") ? (
        <p className="text-sm text-muted-foreground">{t("sinPermiso")}</p>
      ) : necesitaPicker ? (
        <div className="max-w-xl"><CentroPicker centros={centros} onPick={pick} /></div>
      ) : (
        <FormatosAdmin centro={centro ?? centros[0]?.id} />
      )}
    </PageContainer>
  );
}
