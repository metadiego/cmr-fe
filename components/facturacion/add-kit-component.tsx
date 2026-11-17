"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { addKitComponent, getItemOpcionales, type ItemOpcional } from "@/lib/api/facturas";
import { kitComponentInvalid, kitComponentMissing } from "@/lib/facturacion/kit-component-missing";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

// «Agregar componente (sin cambiar el monto)» on a kit line of an ISSUED invoice (BE #574): an optional
// left out by mistake (the shoulder protocol's infiltration on 001229) is added without reopening the
// invoice, which would cancel the day's sessions. Shown only with factura.kit_agregar and only when the
// line has optionals not yet included. The 428 shield is answered by the shared confirm dialog.
export function AddKitComponent({
  invoiceId,
  itemId,
  centerId,
  disabled,
  onDone,
}: {
  invoiceId: string;
  itemId: string;
  centerId?: string;
  disabled?: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("facturacion.kit");
  const [options, setOptions] = React.useState<ItemOpcional[]>([]);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = useDialogForm(() => ({ picked: "", reason: "" }), open);

  React.useEffect(() => {
    let active = true;
    getItemOpcionales(invoiceId, itemId, centerId)
      .then((list) => active && setOptions(list.filter((o) => !o.incluido)))
      .catch(() => active && setOptions([]));
    return () => {
      active = false;
    };
  }, [invoiceId, itemId, centerId]);

  const labels = { component: t("component"), reason: t("reason") } as const;
  const missing = kitComponentMissing({ componentId: form.picked, reason: form.reason }).map((f) => labels[f]);
  const problem = kitComponentInvalid({ reason: form.reason });

  // toastError (inside useSubmit) stays quiet when the person declined the 428 confirmation.
  const { submitting, submit } = useSubmit(
    async () => {
      const picked = form.picked;
      await addKitComponent(invoiceId, itemId, { componenteId: picked, reason: form.reason.trim() }, centerId);
      return picked;
    },
    {
      successMessage: t("componentAdded"),
      onSuccess: (picked) => {
        setOptions((list) => list.filter((o) => o.componentId !== picked));
        setOpen(false);
        onDone();
      },
    },
  );

  if (options.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="ml-2 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
      >
        {t("addComponentIssued")}
      </button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        size="md"
        title={t("addComponentIssued")}
        description={t("addComponentIssuedHint")}
        onSubmit={() => submit()}
        submitLabel={t("addComponentConfirm")}
        submitting={submitting}
        missing={missing}
        reason={problem ? t(problem) : null}
        // A reason under 3 characters kept the button disabled before too.
        blocked={problem != null}
      >
        <Field label={t("component")} required>
          <div role="radiogroup" aria-label={t("component")} className="space-y-1.5">
            {options.map((o) => (
              <label
                key={o.componentId}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="kit-component"
                  value={o.componentId}
                  checked={form.picked === o.componentId}
                  onChange={() => setForm({ picked: o.componentId })}
                />
                <span className="flex-1">{o.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">×{o.quantity}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label={t("reason")} htmlFor="kit-component-reason" required>
          <Textarea
            id="kit-component-reason"
            value={form.reason}
            onChange={(e) => setForm({ reason: e.target.value })}
            maxLength={500}
            rows={3}
            placeholder={t("reasonPlaceholder")}
            aria-invalid={problem != null}
          />
        </Field>
      </FormDialog>
    </>
  );
}
