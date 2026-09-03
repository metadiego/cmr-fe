"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { MenuEditor } from "@/components/configuracion/menu-editor";

// Configuración → Editor del menú (arrastrar y soltar, hasta 4 niveles). CRUD contra /menu
// (@Roles admin en el BE, que es la autoridad). El gate rbac.read es cosmético.
export default function ConfigMenuPage() {
  const t = useTranslations("menuEditor");
  const { can, ready } = useCan();

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && !can("rbac.read") ? (
        <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
      ) : (
        <MenuEditor />
      )}
    </PageContainer>
  );
}
