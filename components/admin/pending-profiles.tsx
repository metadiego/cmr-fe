"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getPendingProfiles,
  approveProfile,
  rejectProfile,
  type Perfil,
} from "@/lib/api/profiles";
import { ApiError } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type State =
  | { kind: "loading" }
  | { kind: "ok"; profiles: Perfil[] }
  | { kind: "fail"; message: string };

function errMessage(err: unknown): string {
  return err instanceof ApiError
    ? `${err.code} · ${err.message}`
    : err instanceof Error
      ? err.message
      : String(err);
}

export function PendingProfiles() {
  const t = useTranslations("admin");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Reject dialog state.
  const [reject, setReject] = React.useState<{ profile: Perfil; motivo: string } | null>(null);
  const [rejecting, setRejecting] = React.useState(false);

  // Refetch the pending list. Called on mount and after a mutation. Does not
  // set "loading" synchronously (initial state is already loading); handlers
  // surface progress via per-row busy state and toasts.
  const load = React.useCallback(async () => {
    try {
      const profiles = await getPendingProfiles();
      setState({ kind: "ok", profiles });
    } catch (err) {
      setState({ kind: "fail", message: errMessage(err) });
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    getPendingProfiles()
      .then((profiles) => active && setState({ kind: "ok", profiles }))
      .catch(
        (err: unknown) =>
          active && setState({ kind: "fail", message: errMessage(err) }),
      );
    return () => {
      active = false;
    };
  }, []);

  async function onApprove(p: Perfil) {
    setBusyId(p.id);
    try {
      await approveProfile(p.id);
      toast.success(t("approved", { email: p.email }));
      load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmReject() {
    if (!reject || !reject.motivo.trim()) return;
    setRejecting(true);
    try {
      await rejectProfile(reject.profile.id, reject.motivo.trim());
      toast.success(t("rejected", { email: reject.profile.email }));
      setReject(null);
      load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setRejecting(false);
    }
  }

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  if (state.kind === "fail") {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.message}
      </p>
    );
  }

  if (state.profiles.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("emptyPending")}</p>;
  }

  return (
    <>
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
              <TableCell>{[p.nombre, p.apellido].filter(Boolean).join(" ")}</TableCell>
              <TableCell>{p.accessMode}</TableCell>
              <TableCell>
                <Badge variant="secondary">{p.estado}</Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                <Button
                  size="sm"
                  onClick={() => onApprove(p)}
                  disabled={busyId === p.id}
                >
                  {t("approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReject({ profile: p, motivo: "" })}
                  disabled={busyId === p.id}
                >
                  {t("reject")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={reject !== null}
        onOpenChange={(open) => !open && setReject(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>
              {t("rejectDescription", { email: reject?.profile.email ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reject?.motivo ?? ""}
            onChange={(e) =>
              setReject((r) => (r ? { ...r, motivo: e.target.value } : r))
            }
            placeholder={t("motivoPlaceholder")}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmReject}
              disabled={rejecting || !reject?.motivo.trim()}
            >
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
