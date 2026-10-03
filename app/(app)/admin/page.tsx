"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

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

// Pestañas que son de ADMINISTRACIÓN (usuarios/roles/permisos/menú…): solo las ve un admin. Personal se ve
// con el permiso de personal (el menú ya gatea la entrada), así el gerente entra a su ficha por el mismo sitio.
const TABS_ADMIN = new Set(["users", "roles", "permisos", "editorRol", "pending", "centers", "theme", "menu"]);

// «Personal y accesos»: una sola página en vez de Administración + Personal por dos puertas (handoff
// personal-y-accesos-una-sola-pagina). Personal va PRIMERA (primero existe la persona, luego su acceso) y
// la pestaña es enlazable por `?tab=`. Ya NO es solo-admin: el gerente ve Personal; el resto de pestañas
// (usuarios/roles/permisos/…) solo aparecen para admin. La ficha sigue también en /configuration/staff.
export default function AdminPage() {
  const t = useTranslations("admin");
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const admin = me.kind === "ok" && isAdmin(me.me);
  const pedido = sp.get("tab") || "personal";
  // Un no-admin nunca cae en una pestaña de admin (p. ej. por un enlace viejo): se le devuelve a Personal.
  const tab = !admin && TABS_ADMIN.has(pedido) ? "personal" : pedido;
  const setTab = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set("tab", v);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

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
          <TabsTrigger value="personal">{t("tabs.personal")}</TabsTrigger>
          {admin && <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>}
          {admin && <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>}
          {admin && <TabsTrigger value="permisos">{t("tabs.permisos")}</TabsTrigger>}
          {admin && <TabsTrigger value="editorRol">{t("tabs.editorRol")}</TabsTrigger>}
          {admin && <TabsTrigger value="pending">{t("tabs.pending")}</TabsTrigger>}
          {admin && <TabsTrigger value="centers">{t("tabs.centers")}</TabsTrigger>}
          {admin && <TabsTrigger value="theme">{t("tabs.theme")}</TabsTrigger>}
          {admin && <TabsTrigger value="menu">{t("tabs.menu")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <StaffPanel />
        </TabsContent>

        {admin && (
          <>
            <TabsContent value="users" className="mt-4"><UsersList /></TabsContent>
            <TabsContent value="roles" className="mt-4"><RbacSettings /></TabsContent>
            <TabsContent value="permisos" className="mt-4"><PermisosCatalogo /></TabsContent>
            <TabsContent value="editorRol" className="mt-4"><EditorRolUnificado /></TabsContent>
            <TabsContent value="pending" className="mt-4"><PendingProfiles /></TabsContent>
            <TabsContent value="centers" className="mt-4"><CentersList /></TabsContent>
            <TabsContent value="theme" className="mt-4"><ThemeSettings /></TabsContent>
            <TabsContent value="menu" className="mt-4"><MenuAdmin /></TabsContent>
          </>
        )}
      </Tabs>
    </PageContainer>
  );
}
