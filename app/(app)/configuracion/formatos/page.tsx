"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && !can("formatos.config") ? (
        <p className="text-sm text-muted-foreground">{t("sinPermiso")}</p>
      ) : necesitaPicker ? (
        <div className="max-w-xl"><CentroPicker centros={centros} onPick={pick} /></div>
      ) : (
        <FormatosAdmin centro={centro ?? centros[0]?.id} />
      )}
    </div>
  );
}
