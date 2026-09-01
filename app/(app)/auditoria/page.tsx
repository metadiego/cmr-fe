"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useMe } from "@/hooks/use-me";
import { AuditoriaLog } from "@/components/auditoria/auditoria-log";

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
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-3xl text-sm text-muted-foreground">{t("help")}</p>
      {ready && me.kind === "ok" && !autorizado ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <AuditoriaLog />
      )}
    </div>
  );
}
