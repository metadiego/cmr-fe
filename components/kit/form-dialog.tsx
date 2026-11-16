"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useFormShell, type FormShellProps } from "./form-shell";

// Existing imports of `Field` from this module keep working.
export { Field } from "./field";

export type FormSize = "sm" | "md" | "lg" | "xl" | "2xl";

const WIDTH: Record<FormSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-5xl",
};

/**
 * Submit-form dialog: header, scrolling body, always-visible footer with the
 * missing-fields hint. `missing` drives `disabled`; `reason` only explains.
 *
 *   <FormDialog open={open} onOpenChange={setOpen} title={t("title")}
 *     missing={missing} submitting={submitting} onSubmit={submit}>
 *     <Field label={...} required><Input .../></Field>
 *   </FormDialog>
 */
export function FormDialog(p: FormShellProps & { size?: FormSize }) {
  const { onOpenChange, contentGuards, onKeyDown, footer, submitting } = useFormShell(p);
  return (
    <Dialog open={p.open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex max-h-[90dvh] flex-col", WIDTH[p.size ?? "md"])}
        showCloseButton={!submitting}
        {...contentGuards}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{p.title}</DialogTitle>
          {p.description && <DialogDescription>{p.description}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 -mx-1" onKeyDown={onKeyDown}>
          {p.children}
        </div>
        {footer}
      </DialogContent>
    </Dialog>
  );
}
