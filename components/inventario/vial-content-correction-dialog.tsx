"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { correctVialContent } from "@/lib/api/inventario"
import { missingFields } from "@/lib/forms/missing"
import {
  vialCorrectionCheck,
  type VialCorrectionSign,
} from "@/lib/inventory/vial-correction"
import { FormDialog, Field } from "@/components/kit/form-dialog"
import { SegmentedControl } from "@/components/kit/segmented-control"
import { useDialogForm } from "@/components/kit/use-dialog-form"
import { useSubmit } from "@/components/kit/use-submit"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// «Corregir contenido» of ONE open vial (cmr-be #726, docs/specs/correccion-de-contenido-de-vial.md):
// put content back into it or take it out, with a reason, optionally closing the vial. It moves stock,
// so Enter never fires it — only the button. The 428 confirmation (and the backdate one) is asked by
// apiFetch itself.
export type CorrectableVial = {
  id: string
  number: number | null
  remnant: number
  capacity: number
}

export function VialContentCorrectionDialog({
  vial,
  unit,
  tenant,
  onClose,
  onDone,
}: {
  vial: CorrectableVial | null
  unit: string | null
  tenant?: string | null
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations("inventarioViales.correction")
  const open = vial != null
  const [form, update] = useDialogForm(
    () => ({
      amount: "",
      sign: "retirar" as VialCorrectionSign,
      reason: "",
      close: false,
    }),
    open,
    vial?.id
  )

  const check = vialCorrectionCheck({
    raw: form.amount,
    sign: form.sign,
    remnant: vial?.remnant ?? 0,
    capacity: vial?.capacity ?? 0,
  })
  const u = unit ? ` ${unit}` : ""
  const missing = missingFields([
    [t("amount"), check.amount != null],
    [t("reason"), !!form.reason.trim()],
  ])
  const reason = check.outOfRange
    ? t(form.sign === "retirar" ? "tooMuchOut" : "tooMuchIn", {
        max: `${check.max}${u}`,
      })
    : undefined

  const { submitting, submit } = useSubmit(
    async () => {
      if (!vial || check.amount == null || check.outOfRange)
        throw new Error(t("amount"))
      await correctVialContent(
        vial.id,
        {
          quantity: check.amount,
          sign: form.sign,
          reason: form.reason.trim(),
          ...(form.close ? { status: "descartado" as const } : {}),
        },
        tenant
      )
    },
    { successMessage: t("saved"), onSuccess: onDone }
  )

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={t("title", { n: vial?.number ?? "—" })}
      description={t("holds", {
        left: `${vial?.remnant ?? 0}${u}`,
        capacity: `${vial?.capacity ?? 0}${u}`,
      })}
      missing={missing}
      blocked={check.outOfRange}
      reason={reason}
      submitting={submitting}
      onSubmit={() => {}}
      actions={[{ label: t("submit"), onClick: () => submit() }]}
    >
      <Field label={t("direction")} required>
        <SegmentedControl
          ariaLabel={t("direction")}
          value={form.sign}
          onChange={(sign) => update({ sign })}
          options={[
            { value: "retirar", label: t("out") },
            { value: "devolver", label: t("in") },
          ]}
        />
      </Field>
      <Field
        label={unit ? `${t("amount")} (${unit})` : t("amount")}
        htmlFor="vial-correction-amount"
        required
        hint={t("maxHint", { max: `${check.max}${u}` })}
      >
        <Input
          id="vial-correction-amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          className="tabular-nums"
          value={form.amount}
          aria-invalid={check.outOfRange || undefined}
          onChange={(e) => update({ amount: e.target.value })}
        />
      </Field>
      <Field label={t("reason")} htmlFor="vial-correction-reason" required>
        <Textarea
          id="vial-correction-reason"
          rows={2}
          value={form.reason}
          onChange={(e) => update({ reason: e.target.value })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.close}
          onCheckedChange={(v) => update({ close: v === true })}
        />
        {t("closeVial")}
      </label>
    </FormDialog>
  )
}
