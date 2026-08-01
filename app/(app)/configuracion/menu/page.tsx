"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { MenuEditor } from "@/components/configuracion/menu-editor";

// Configuración → Editor del menú (arrastrar y soltar, hasta 4 niveles). CRUD contra /menu
// (@Roles admin en el BE, que es la autoridad). El gate rbac.read es cosmético.
export default function ConfigMenuPage() {
  const t = useTranslations("menuEditor");
  const { can, ready } = useCan();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && !can("rbac.read") ? (
        <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
      ) : (
        <MenuEditor />
      )}
    </div>
  );
}
