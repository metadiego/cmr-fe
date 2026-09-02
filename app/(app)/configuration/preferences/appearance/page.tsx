"use client";

import { useTranslations } from "next-intl";

import { PageContainer, PageHeader } from "@/components/ui/page";
import { AvatarUploader } from "@/components/media/avatar-uploader";

// Apariencia PERSONAL: solo el avatar. La personalización de color/tema y el fondo se
// retiraron — el color de marca es una decisión POR CENTRO que fija un admin en
// Configuración › Apariencia, y el resto del diseño lo fija el sistema (globals.css).
export default function AppearancePage() {
  const t = useTranslations("appearance");

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />

      {/* Avatar (media de perfil, independiente de las capas de tema) */}
      <div className="rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 backdrop-blur">
        <h2 className="mb-4 text-sm font-medium">{t("avatarTitle")}</h2>
        <AvatarUploader />
      </div>
    </PageContainer>
  );
}
