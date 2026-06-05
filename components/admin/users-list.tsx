"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getProfiles, type Perfil } from "@/lib/api/profiles";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { AssignCenterDialog } from "@/components/admin/assign-center-dialog";

type State =
  | { kind: "loading" }
  | { kind: "ok"; profiles: Perfil[] }
  | { kind: "fail"; message: string };

export function UsersList() {
  const t = useTranslations("admin");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [assignFor, setAssignFor] = React.useState<Perfil | null>(null);

  const load = React.useCallback(async () => {
    try {
      const profiles = await getProfiles();
      setState({ kind: "ok", profiles });
    } catch (err) {
      setState({ kind: "fail", message: apiErrorMessage(err) });
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    getProfiles()
      .then((profiles) => active && setState({ kind: "ok", profiles }))
      .catch(
        (err) => active && setState({ kind: "fail", message: apiErrorMessage(err) }),
      );
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          {t("users.invite")}
        </Button>
      </div>

      {state.kind === "loading" && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}

      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {state.kind === "ok" &&
        (state.profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("users.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.email")}</TableHead>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.accessMode")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.email}</TableCell>
                  <TableCell>
                    {[p.nombre, p.apellido].filter(Boolean).join(" ")}
                  </TableCell>
                  <TableCell>{p.isMaster ? "master" : p.accessMode}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignFor(p)}
                    >
                      {t("users.assign")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={load}
        onRequestAssign={(profile) => setAssignFor(profile)}
      />
      <AssignCenterDialog
        profile={assignFor}
        open={assignFor !== null}
        onOpenChange={(open) => !open && setAssignFor(null)}
        onAssigned={load}
      />
    </div>
  );
}
