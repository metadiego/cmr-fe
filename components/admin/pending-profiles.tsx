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
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useConfirm } from "@/components/kit/confirm-host";
import { missingFields } from "@/lib/forms/missing";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/ui/data-table";

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
  const confirm = useConfirm();
  // Reject dialog state.
  const [reject, setReject] = React.useState<{ profile: Perfil; motivo: string } | null>(null);

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

  // `asking` stops a second click / Enter auto-repeat from queueing a second confirm prompt.
  const asking = React.useRef(false);
  async function onApprove(p: Perfil) {
    if (asking.current) return;
    asking.current = true;
    const ok = await confirm({
      title: t("approveTitle"),
      description: t("approveBody", { email: p.email }),
      confirmLabel: t("approve"),
      destructive: false,
    }).finally(() => (asking.current = false));
    if (!ok) return;
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

  const rejectMissing = missingFields([[t("rejectReason"), !!reject?.motivo.trim()]]);
  const { submitting: rejecting, submit: confirmReject } = useSubmit(
    async () => {
      if (!reject) throw new Error("no profile"); // unreachable: the dialog is open only with a profile
      await rejectProfile(reject.profile.id, reject.motivo.trim());
      return reject.profile.email;
    },
    {
      onSuccess: (email) => {
        toast.success(t("rejected", { email }));
        setReject(null);
        load();
      },
      onError: (err) => {
        toast.error(errMessage(err));
        return true;
      },
    },
  );

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
      <DataTable>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.email")}</TableHead>
            <TableHead>{t("columns.name")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="text-right">{t("columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.profiles.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.email}</TableCell>
              <TableCell>{[p.name, p.lastName].filter(Boolean).join(" ")}</TableCell>
              <TableCell>
                <Badge variant="secondary">{p.status}</Badge>
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
      </DataTable>

      <FormDialog
        open={reject !== null}
        onOpenChange={(open) => !open && setReject(null)}
        size="md"
        title={t("rejectTitle")}
        description={t("rejectDescription", { email: reject?.profile.email ?? "" })}
        // Rejecting is outward and final: only the button fires it (Enter in the textarea is a newline).
        onSubmit={() => {}}
        actions={[
          { label: t("confirmReject"), variant: "destructive", onClick: () => confirmReject() },
        ]}
        cancelLabel={t("cancel")}
        submitting={rejecting}
        missing={rejectMissing}
      >
        <Field label={t("rejectReason")} htmlFor="reject-profile-reason" required>
          <Textarea
            id="reject-profile-reason"
            value={reject?.motivo ?? ""}
            onChange={(e) =>
              setReject((r) => (r ? { ...r, motivo: e.target.value } : r))
            }
            placeholder={t("motivoPlaceholder")}
            rows={3}
          />
        </Field>
      </FormDialog>
    </>
  );
}
