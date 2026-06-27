"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// A labelled form field wrapper (extracted from the original invite-dialog.tsx).
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A submit-form dialog: title/description header, arbitrary fields as children,
// and a Cancel/Submit footer with a busy state. Mirrors the proven pattern in
// invite-dialog.tsx — onSubmit is awaited, the submit button shows `submitting`,
// and the parent controls open state (resetting its own form on close).
//
//   <FormDialog open={open} onOpenChange={setOpen} title={t("title")}
//     submitting={busy} canSubmit={valid} onSubmit={save}>
//     <Field label={...}><Input .../></Field>
//   </FormDialog>
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitting = false,
  canSubmit = true,
  submitLabel,
  submittingLabel,
  cancelLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  canSubmit?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
}) {
  const t = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">{children}</div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button onClick={() => onSubmit()} disabled={submitting || !canSubmit}>
            {submitting ? (submittingLabel ?? t("saving")) : (submitLabel ?? t("save"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
