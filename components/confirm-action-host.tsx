"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { setConfirmHandler, type ConfirmRequest } from "@/lib/api/confirm-action";
import { getPaciente } from "@/lib/api/pacientes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// The «¿Aceptar o no?» dialog of the safety shield (BE #529). Mounted ONCE in the app shell; the HTTP
// client calls it on a 428 (lib/api/confirm-action.ts) and repeats the request only on «Aceptar».
// Title = actionLabelKey, the translated effects, and the patient / date / status change from `params`.
type Pending = { req: ConfirmRequest; resolve: (ok: boolean) => void };

export function ConfirmActionHost() {
  const t = useTranslations("confirmation");
  const tRoot = useTranslations();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [patient, setPatient] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(
    () =>
      setConfirmHandler(
        (req) =>
          new Promise<boolean>((resolve) => {
            setPending({ req, resolve });
            const pid = typeof req.params.patientId === "string" ? req.params.patientId : null;
            if (pid)
              getPaciente(pid)
                .then((p) => setPatient({ id: pid, name: [p.lastName, p.firstName].filter(Boolean).join(", ") }))
                .catch(() => {});
          }),
      ),
    [],
  );

  const tr = (key: string | null | undefined, fallback: string) => (key && tRoot.has(key) ? tRoot(key) : fallback);
  function answer(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
    setPatient(null);
  }

  const req = pending?.req;
  const p = req?.params ?? {};
  const pid = typeof p.patientId === "string" ? p.patientId : null;
  const statusChange = typeof p.from === "string" && typeof p.to === "string" ? `${tr(`changeLog.status.${p.from}`, p.from)} → ${tr(`changeLog.status.${p.to}`, p.to)}` : null;

  return (
    <AlertDialog open={!!pending} onOpenChange={(v) => !v && answer(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{req ? tr(req.actionLabelKey, t("unknownAction", { action: req.action })) : ""}</AlertDialogTitle>
          <AlertDialogDescription>{t("required")}</AlertDialogDescription>
        </AlertDialogHeader>
        {req && (
          <div className="space-y-3 text-sm">
            {(pid || typeof p.date === "string" || statusChange) && (
              <div className="rounded-md bg-muted px-3 py-2">
                {pid && patient?.id === pid && <div className="font-medium">{patient.name}</div>}
                <div className="text-muted-foreground">
                  {[typeof p.date === "string" ? p.date : null, statusChange].filter(Boolean).join(" · ")}
                </div>
              </div>
            )}
            {req.effects.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {req.effects.map((e) => (
                  <li key={e}>{tr(e, e)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => answer(true)}>{t("accept")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
