"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { AuditoriaLog } from "@/components/auditoria/auditoria-log";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Since cmr-be #557 /auditoria needs only auditoria.read: no role on top of it.
// Monitoreo → Auditoría. Bitácora automática del sistema (BE: AuditLogController, ya en prod).
// Ancho completo como /admin (no max-w): tabla densa que aprovecha toda la pantalla.
export default function AuditoriaPage() {
  const t = useTranslations("auditoria");
  const { can, ready } = useCan();
  const autorizado = can("auditoria.read");

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && !autorizado ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <AuditoriaLog />
      )}
    </PageContainer>
  );
}
