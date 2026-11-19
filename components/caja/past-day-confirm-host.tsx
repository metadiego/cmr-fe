"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { setPastDayHandler, setPastDayChangedHandler, type PastDayModifyRequest } from "@/lib/api/confirm-action";
import { money } from "@/lib/caja/totales";
import { pastDayMissing } from "@/lib/caja/past-day-missing";
import { Input } from "@/components/ui/input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";

type Pending = { req: PastDayModifyRequest; resolve: (r: { reason: string } | null) => void };

// El diálogo DEL DÍA PASADO (BE PR #582-583, owner 13-nov-2026, handoff
// .personal/handoff-bloqueo-dias-pasados.md) — NO es el genérico (ConfirmActionHost): pide un MOTIVO
// que se manda como `X-Change-Reason`, y cuando ya hay firmas muestra quién firmó y cuánto cambia por
// forma de pago. Se dispara dos veces en la misma escritura si hace falta: primero un 400 (sin motivo
// todavía, sin esas cifras), luego el 428 de siempre (con ellas) — por eso el día/firmas/delta son
// OPCIONALES aquí, no siempre vienen. Mounted once in the app shell.
export function PastDayConfirmHost() {
  const t = useTranslations("cash.pastDay");
  const tc = useTranslations("confirmation");
  const tRoot = useTranslations();
  const format = useFormatter();
  const [pending, setPending] = React.useState<Pending | null>(null);
  // Re-initialised for every request (the pending object is the key), pre-filled with a reason given earlier.
  const [{ reason }, setForm] = useDialogForm(() => ({ reason: pending?.req.reason ?? "" }), !!pending, pending);

  React.useEffect(() => setPastDayHandler((req) => new Promise((resolve) => setPending({ req, resolve }))), []);
  React.useEffect(
    () =>
      setPastDayChangedHandler((w) => {
        toast.warning(w.labelKey && tRoot.has(w.labelKey) ? tRoot(w.labelKey, { day: w.day ?? "" }) : t("changed", { day: w.day ?? "" }));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function answer(ok: boolean) {
    pending?.resolve(ok ? { reason: reason.trim() } : null);
    setPending(null);
  }

  const req = pending?.req;
  const day = req?.day ? format.dateTime(new Date(`${req.day}T12:00:00`), "dayLong") : "";
  const missing = pastDayMissing({ reason }).map(() => t("reasonLabel"));

  return (
    <FormDialog
      open={!!pending}
      onOpenChange={(v) => !v && answer(false)}
      title={req?.actionLabelKey && tRoot.has(req.actionLabelKey) ? tRoot(req.actionLabelKey, { day }) : t("dialogTitle", { day })}
      description={tc("required")}
      onSubmit={() => answer(true)}
      submitLabel={t("confirmButton", { day })}
      cancelLabel={tc("cancel")}
      missing={missing}
    >
      {req && (
        <div className="space-y-3 text-sm">
          {req.effects && req.effects.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {req.effects.map((e) => (
                <li key={e}>{tRoot.has(e) ? tRoot(e) : e}</li>
              ))}
            </ul>
          )}
          {req.signed && req.signatures && req.signatures.length > 0 && (
            <div className="rounded-md bg-muted px-3 py-2">
              <p className="font-medium">{t("alreadySigned")}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {req.signatures.map((s, i) => (
                  <li key={i}>
                    {s.name} ({tRoot.has(`caja.signOff.${s.role}`) ? tRoot(`caja.signOff.${s.role}`) : s.role}) · {format.dateTime(new Date(s.signedAt), "dateAndTime")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {req.delta && req.delta.length > 0 && (
            <table className="w-full text-xs">
              <tbody className="divide-y">
                {req.delta.map((d, i) => (
                  <tr key={i}>
                    <td className="py-1">{d.method ?? t("deltaTotal")}</td>
                    <td className={"py-1 text-right font-medium tabular-nums " + (d.amount < 0 ? "text-destructive" : "text-success-foreground")}>
                      {money(d.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Field label={t("reasonLabel")} htmlFor="past-day-reason" required>
            <Input
              id="past-day-reason"
              value={reason}
              onChange={(e) => setForm({ reason: e.target.value })}
              // Changing a past day is deliberate: Enter in the reason must not confirm it.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              autoFocus
            />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}
