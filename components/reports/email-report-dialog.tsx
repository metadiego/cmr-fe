"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { missingFields } from "@/lib/forms/missing"
import { validEmailList } from "@/lib/frontdesk/day-summary"
import { useMe } from "@/hooks/use-me"
import { FormDialog } from "@/components/kit/form-dialog"
import { Field } from "@/components/kit/field"
import { useSubmit } from "@/components/kit/use-submit"
import { Input } from "@/components/ui/input"

// «Email» of the report bar: the BE renders the PDF with the letterhead and sends it attached
// (POST /export, channel email), logged in /export/jobs. Sending is outward, so Enter does not fire it.
export function EmailReportDialog({
  open,
  onOpenChange,
  title,
  send,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  send: (destination: string) => Promise<unknown>
}) {
  const t = useTranslations("reports")
  const me = useMe()
  const mine = me.kind === "ok" ? (me.me.email ?? "") : ""
  // Prefilled with my own address until I type (null = untouched).
  const [to, setTo] = React.useState<string | null>(null)
  const value = to ?? mine
  const sending = useSubmit(() => send(value.trim()), {
    successMessage: t("emailSent"),
    onSuccess: () => onOpenChange(false),
  })
  const missing = missingFields([[t("emailTo"), !!value.trim()]])
  const invalid = !!value.trim() && !validEmailList(value)

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("emailTitle")}
      description={title}
      onSubmit={() => {}}
      actions={[{ label: t("emailSend"), onClick: () => sending.submit() }]}
      submittingLabel={t("emailSending")}
      cancelLabel={t("cancel")}
      submitting={sending.submitting}
      missing={missing}
      reason={invalid ? t("emailInvalid") : null}
      blocked={invalid}
    >
      <Field label={t("emailTo")} htmlFor="report-email-to" required hint={t("emailHint")}>
        <Input
          id="report-email-to"
          type="text"
          inputMode="email"
          value={value}
          onChange={(e) => setTo(e.target.value)}
          aria-invalid={invalid}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
      </Field>
    </FormDialog>
  )
}
