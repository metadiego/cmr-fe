"use client";

import * as React from "react";

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
/**
 * True while the scrolling body has more below its fold: the footer then draws a hairline on top, so
 * it reads as cutting off what is under it, not as the end of the form.
 */
function useCutOff(): [React.RefCallback<HTMLDivElement>, boolean] {
  const [cut, setCut] = React.useState(false);
  const cleanup = React.useRef<(() => void) | null>(null);
  const ref = React.useCallback((el: HTMLDivElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const check = () => setCut(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    cleanup.current = () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);
  return [ref, cut];
}

export function FormDialog(p: FormShellProps & { size?: FormSize }) {
  const { onOpenChange, contentGuards, onKeyDown, footer, submitting } = useFormShell(p);
  const [bodyRef, cutOff] = useCutOff();
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
        {/* Padding + negative margin keep focus rings from being clipped by overflow-y-auto. */}
        <div
          ref={bodyRef}
          className="-mx-1 -my-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-1"
          onKeyDown={onKeyDown}
        >
          {p.children}
        </div>
        {/* Same box either way (the -mt cancels the pt inside the dialog's gap): only the line comes and goes. */}
        <div className={cn("-mx-6 -mt-4 shrink-0 border-t px-6 pt-4 transition-colors", !cutOff && "border-transparent")}>
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
