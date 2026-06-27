"use client";

import { useTranslations } from "next-intl";

import { AdminGuard } from "@/components/admin/admin-guard";
import { UsersList } from "@/components/admin/users-list";
import { CentersList } from "@/components/admin/centers-list";
import { PendingProfiles } from "@/components/admin/pending-profiles";
import { ThemeSettings } from "@/components/admin/theme-settings";
import { RbacSettings } from "@/components/admin/rbac-settings";
import { MenuAdmin } from "@/components/admin/menu-admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  const t = useTranslations("admin");

  return (
    <AdminGuard>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

        <Tabs defaultValue="users" className="mt-6">
          <TabsList>
            <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
            <TabsTrigger value="centers">{t("tabs.centers")}</TabsTrigger>
            <TabsTrigger value="theme">{t("tabs.theme")}</TabsTrigger>
            <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>
            <TabsTrigger value="menu">{t("tabs.menu")}</TabsTrigger>
            <TabsTrigger value="pending">{t("tabs.pending")}</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <UsersList />
          </TabsContent>

          <TabsContent value="centers" className="mt-4">
            <CentersList />
          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <ThemeSettings />
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <RbacSettings />
          </TabsContent>

          <TabsContent value="menu" className="mt-4">
            <MenuAdmin />
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <PendingProfiles />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
