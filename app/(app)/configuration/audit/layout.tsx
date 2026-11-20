"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { AuditoriaLog } from "@/components/auditoria/auditoria-log";
import { AuditSessions } from "@/components/auditoria/audit-sessions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { useTabRoute } from "@/hooks/use-tab-route";
import { AUDIT_TABS } from "@/lib/nav/tab-routes";

// Since cmr-be #557 /auditoria needs only auditoria.read: no role on top of it.
// Monitoreo → Auditoría. Bitácora (BE: AuditLogController) and Sesiones (BE #648, entradas y
// salidas de login) are two different logs over the same permission, as tabs of one screen — each
// its own path (/configuration/audit/sessions), per lib/nav/tab-routes.ts. This is the layout of
// every tab route, so switching tabs keeps the picked filters/page mounted instead of refetching.
export default function AuditoriaLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auditoria");
  const { can, ready } = useCan();
  const autorizado = can("auditoria.read");
  const [tab, setTab] = useTabRoute(AUDIT_TABS);

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {ready && !autorizado ? (
        <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t("noPermission")}
        </p>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="log">{t("tabs.log")}</TabsTrigger>
            <TabsTrigger value="sessions">{t("tabs.sessions")}</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="mt-4">
            <AuditoriaLog />
          </TabsContent>
          <TabsContent value="sessions" className="mt-4">
            <AuditSessions />
          </TabsContent>
        </Tabs>
      )}
      {children}
    </PageContainer>
  );
}
