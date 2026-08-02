"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { AuditoriaLog } from "@/components/auditoria/auditoria-log";

// Monitoreo → Auditoría. Bitácora automática del sistema (BE: AuditLogController, ya en prod).
// Gate cosmético auditoria.read (el BE exige el permiso + rol admin/gerente y responde 403).
// Ancho completo como /admin (no max-w): tabla densa que aprovecha toda la pantalla.
export default function AuditoriaPage() {
  const t = useTranslations("auditoria");
  const { can, ready } = useCan();

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-3xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && !can("auditoria.read") ? (
        <p className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <AuditoriaLog />
      )}
    </div>
  );
}
