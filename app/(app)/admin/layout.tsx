"use client";

import { useTranslations } from "next-intl";

import { useMe, isAdmin } from "@/hooks/use-me";
import { StaffPanel } from "@/app/(app)/configuration/staff/page";
import { UsersList } from "@/components/admin/users-list";
import { CentersList } from "@/components/admin/centers-list";
import { PendingProfiles } from "@/components/admin/pending-profiles";
import { ThemeSettings } from "@/components/admin/theme-settings";
import { RbacSettings } from "@/components/admin/rbac-settings";
import { PermisosCatalogo } from "@/components/admin/permisos-catalogo";
import { MenuAdmin } from "@/components/admin/menu-admin";
import { EditorRolUnificado } from "@/components/admin/editor-rol";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { useTabRoute } from "@/hooks/use-tab-route";
import { ADMIN_TABS } from "@/lib/nav/tab-routes";

// ADMINISTRATION tabs (users/roles/permissions/menu…): only an admin sees them. Staff is seen with the
// staff permission (the menu already gates the entry), so a manager reaches their record the same way.
const TABS_ADMIN = new Set<string>(["users", "roles", "permissions", "role-editor", "pending", "centers", "theme", "menu"]);

// "Staff and access": one page instead of Administration + Staff behind two doors (handoff
// personal-y-accesos-una-sola-pagina). Staff comes FIRST (the person exists before their access) and
// each tab is its own path (/admin/users, /admin/role-editor — lib/nav/tab-routes.ts). Not admin-only
// any more: a manager sees Staff; the other tabs (users/roles/permissions/…) appear only for an admin.
// The staff record is also at /configuration/staff. This is the layout of every tab route, so switching
// tabs keeps it mounted.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const me = useMe();
  const admin = me.kind === "ok" && isAdmin(me.me);
  const [requested, setTab] = useTabRoute(ADMIN_TABS);
  // A non-admin never lands on an admin tab (e.g. through an old link): they get Staff instead.
  const tab = !admin && TABS_ADMIN.has(requested) ? "staff" : requested;

  if (me.kind === "loading") {
    return (
      <PageContainer>
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={t("hubTitle")} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="staff">{t("tabs.personal")}</TabsTrigger>
          {admin && <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>}
          {admin && <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>}
          {admin && <TabsTrigger value="permissions">{t("tabs.permisos")}</TabsTrigger>}
          {admin && <TabsTrigger value="role-editor">{t("tabs.editorRol")}</TabsTrigger>}
          {admin && <TabsTrigger value="pending">{t("tabs.pending")}</TabsTrigger>}
          {admin && <TabsTrigger value="centers">{t("tabs.centers")}</TabsTrigger>}
          {admin && <TabsTrigger value="theme">{t("tabs.theme")}</TabsTrigger>}
          {admin && <TabsTrigger value="menu">{t("tabs.menu")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <StaffPanel />
        </TabsContent>

        {admin && (
          <>
            <TabsContent value="users" className="mt-4"><UsersList /></TabsContent>
            <TabsContent value="roles" className="mt-4"><RbacSettings /></TabsContent>
            <TabsContent value="permissions" className="mt-4"><PermisosCatalogo /></TabsContent>
            <TabsContent value="role-editor" className="mt-4"><EditorRolUnificado /></TabsContent>
            <TabsContent value="pending" className="mt-4"><PendingProfiles /></TabsContent>
            <TabsContent value="centers" className="mt-4"><CentersList /></TabsContent>
            <TabsContent value="theme" className="mt-4"><ThemeSettings /></TabsContent>
            <TabsContent value="menu" className="mt-4"><MenuAdmin /></TabsContent>
          </>
        )}
      </Tabs>
      {children}
    </PageContainer>
  );
}
