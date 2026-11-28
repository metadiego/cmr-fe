"use client";

import { useTranslations } from "next-intl";

import { correctLegacyPackage, type LegacyPackage } from "@/lib/api/legacy-packages";
import {
  closePackageForm,
  legacyPackageCorrectionInvalid,
  legacyPackageCorrectionMissing,
  legacyPackageCorrectionPayload,
} from "@/lib/frontdesk/legacy-package-correction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

// "Corregir" on a legacy package (handoff correccion-paquetes-del-legado, cmr-be PR #740,
// 28-nov-2026): total and delivered start prefilled with the package's own numbers, a reason is
// mandatory, and PATCH only sends the field(s) that actually moved (lib/frontdesk/legacy-package-correction.ts).
export function LegacyPackageCorrectDialog({
  paquete,
  centroId,
  onClose,
  onDone,
}: {
  paquete: LegacyPackage | null; // null = closed (dialog controlled by the parent)
  centroId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("legacyPackages");
  const tRoot = useTranslations();
  const fieldLabel = { total: t("total"), delivered: t("delivered"), reason: t("reason") } as const;

  const [form, setForm] = useDialogForm(
    () => ({
      totalSessions: paquete ? String(paquete.totalSessions) : "",
      deliveredSessions: paquete ? String(paquete.deliveredSessions) : "",
      motivo: "",
    }),
    paquete != null,
    paquete?.id ?? null,
  );

  const missing = legacyPackageCorrectionMissing(form).map((f) => fieldLabel[f]);
  const invalid = legacyPackageCorrectionInvalid(form);
  const reason =
    invalid === "deliveredOverTotal"
      ? t("invalidDeliveredOverTotal")
      : invalid === "negative"
        ? t("invalidNegative")
        : invalid === "notInteger"
          ? t("invalidNotInteger")
          : null;

  const { submitting, submit } = useSubmit(
    async () => {
      if (!paquete) return;
      const payload = legacyPackageCorrectionPayload(form, paquete);
      await correctLegacyPackage(paquete.id, payload, centroId);
    },
    {
      successMessage: t("correctDone"),
      onSuccess: () => {
        onClose();
        onDone();
      },
    },
  );

  return (
    <FormDialog
      open={paquete != null}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={t("correct")}
      description={paquete?.productName ?? ""}
      onSubmit={() => submit()}
      submitLabel={tRoot("common.save")}
      submitting={submitting}
      missing={missing}
      reason={reason}
      blocked={invalid != null}
    >
      {paquete && (
        <>
          <div className="flex gap-3">
            <Field label={t("total")} htmlFor="legacy-pkg-total" required className="flex-1 space-y-1">
              <Input
                id="legacy-pkg-total"
                type="number"
                min={0}
                value={form.totalSessions}
                onChange={(e) => setForm((s) => ({ ...s, totalSessions: e.target.value }))}
              />
            </Field>
            <Field label={t("delivered")} htmlFor="legacy-pkg-delivered" required className="flex-1 space-y-1">
              <Input
                id="legacy-pkg-delivered"
                type="number"
                min={0}
                value={form.deliveredSessions}
                onChange={(e) => setForm((s) => ({ ...s, deliveredSessions: e.target.value }))}
              />
            </Field>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setForm(closePackageForm(form))}>
            {t("closePackage")}
          </Button>
          <Field label={t("reason")} htmlFor="legacy-pkg-reason" required className="space-y-1">
            <Textarea
              id="legacy-pkg-reason"
              value={form.motivo}
              onChange={(e) => setForm((s) => ({ ...s, motivo: e.target.value }))}
              placeholder={t("reasonPlaceholder")}
              rows={2}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
