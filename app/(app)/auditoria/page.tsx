"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useMe } from "@/hooks/use-me";
import { AuditoriaLog } from "@/components/auditoria/auditoria-log";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Roles que el BE exige para /auditoria (además del permiso auditoria.read). Gate cosmético: sin esto,
// un usuario con el permiso pero sin el rol recibía el 403 del BE como error genérico de tabla.
const ROLES_AUDITORIA = ["admin", "super_admin", "gerente"];

// Monitoreo → Auditoría. Bitácora automática del sistema (BE: AuditLogController, ya en prod).
// Ancho completo como /admin (no max-w): tabla densa que aprovecha toda la pantalla.
export default function AuditoriaPage() {
  const t = useTranslations("auditoria");
  const { can, ready } = useCan();
  const me = useMe();
  const tieneRol =
    me.kind === "ok" && (me.me.isMaster || me.me.roles.some((r) => ROLES_AUDITORIA.includes(r)));
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
