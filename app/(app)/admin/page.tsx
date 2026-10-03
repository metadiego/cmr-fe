"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { AdminGuard } from "@/components/admin/admin-guard";
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

// «Personal y accesos»: una sola página en vez de Administración + Personal por dos puertas (handoff
// personal-y-accesos-una-sola-pagina). Personal va PRIMERA (primero existe la persona, luego su acceso) y
// la pestaña es enlazable por `?tab=` para no obligar a buscarla. La ficha de Personal también sigue en su
// ruta propia (/configuration/staff) para quien no es admin; aquí convive con usuarios/roles/permisos.
export default function AdminPage() {
  const t = useTranslations("admin");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab = sp.get("tab") || "personal";
  const setTab = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set("tab", v);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <AdminGuard>
      <PageContainer>
        <PageHeader title={t("hubTitle")} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="personal">{t("tabs.personal")}</TabsTrigger>
            <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
            <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>
            <TabsTrigger value="permisos">{t("tabs.permisos")}</TabsTrigger>
            <TabsTrigger value="editorRol">{t("tabs.editorRol")}</TabsTrigger>
            <TabsTrigger value="pending">{t("tabs.pending")}</TabsTrigger>
            <TabsTrigger value="centers">{t("tabs.centers")}</TabsTrigger>
            <TabsTrigger value="theme">{t("tabs.theme")}</TabsTrigger>
            <TabsTrigger value="menu">{t("tabs.menu")}</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4">
            <StaffPanel />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UsersList />
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <RbacSettings />
          </TabsContent>

          <TabsContent value="permisos" className="mt-4">
            <PermisosCatalogo />
          </TabsContent>

          <TabsContent value="editorRol" className="mt-4">
            <EditorRolUnificado />
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <PendingProfiles />
          </TabsContent>

          <TabsContent value="centers" className="mt-4">
            <CentersList />
          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <ThemeSettings />
          </TabsContent>

          <TabsContent value="menu" className="mt-4">
            <MenuAdmin />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AdminGuard>
  );
}
