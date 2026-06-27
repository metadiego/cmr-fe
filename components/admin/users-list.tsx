"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getProfiles, type Perfil } from "@/lib/api/profiles";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/kit/data-table";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { AssignCenterDialog } from "@/components/admin/assign-center-dialog";
import { AccessDialog } from "@/components/admin/access-dialog";

export function UsersList() {
  const t = useTranslations("admin");
  const { state, reload } = useResource<Perfil[]>(() => getProfiles());
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [assignFor, setAssignFor] = React.useState<Perfil | null>(null);
  const [accessFor, setAccessFor] = React.useState<Perfil | null>(null);

  const columns: Column<Perfil>[] = [
    {
      key: "email",
      header: t("columns.email"),
      cell: (p) => <span className="font-medium">{p.email}</span>,
    },
    {
      key: "name",
      header: t("columns.name"),
      cell: (p) => [p.nombre, p.apellido].filter(Boolean).join(" "),
    },
    {
      key: "accessMode",
      header: t("columns.accessMode"),
      cell: (p) => (p.isMaster ? "master" : p.accessMode),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (p) => <Badge variant="secondary">{p.estado}</Badge>,
    },
    {
      key: "actions",
      header: t("columns.actions"),
      align: "right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setAccessFor(p)}>
            {t("users.access")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAssignFor(p)}>
            {t("users.assign")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          {t("users.invite")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        state={state}
        getRowKey={(p) => p.id}
        onReload={reload}
        labels={{ empty: t("users.empty") }}
      />

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={reload}
        onRequestAssign={(profile) => setAssignFor(profile)}
      />
      <AssignCenterDialog
        profile={assignFor}
        open={assignFor !== null}
        onOpenChange={(open) => !open && setAssignFor(null)}
        onAssigned={reload}
      />
      <AccessDialog
        profile={accessFor}
        onOpenChange={(open) => !open && setAccessFor(null)}
      />
    </div>
  );
}
