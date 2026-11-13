"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { isAdmin, useMe } from "@/hooks/use-me";
import { hasRole } from "@/lib/access/role-keys";
import { AuditoriaLog } from "@/components/auditoria/auditoria-log";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Before cmr-be #557 /auditoria also demands a role (admin or manager) besides auditoria.read. Cosmetic
// gate: without it a person with the permission but not the role got the backend's 403 as a table error.
// The role is compared through hasRole, so the old key ("gerente") and the new one ("manager") both pass.
const AUDIT_ROLE = "manager";

// Monitoreo → Auditoría. Bitácora automática del sistema (BE: AuditLogController, ya en prod).
// Ancho completo como /admin (no max-w): tabla densa que aprovecha toda la pantalla.
export default function AuditoriaPage() {
  const t = useTranslations("auditoria");
  const { can, ready } = useCan();
  const me = useMe();
  const tieneRol =
    me.kind === "ok" && (isAdmin(me.me) || hasRole(me.me.roles, AUDIT_ROLE));
  const autorizado = can("auditoria.read") && tieneRol;

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && me.kind === "ok" && !autorizado ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <AuditoriaLog />
      )}
    </PageContainer>
  );
}
