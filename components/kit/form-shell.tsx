"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { footerState } from "@/lib/forms/missing";
import { shouldSubmitOnEnter } from "@/lib/forms/enter";
import { FormFooter } from "./form-footer";

/** Props shared by FormDialog and FormSheet. */
export type FormShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  missing?: readonly string[];
  reason?: string | null;
  blocked?: boolean;
  extra?: ReactNode;
  /** @deprecated use missing/blocked; removed in PR 4 */
  canSubmit?: boolean;
};

/** Behaviour common to both shells: blocked close while submitting, Enter to submit, footer. */
export function useFormShell(p: FormShellProps) {
  const t = useTranslations("common");
  const hintId = `${useId()}-hint`;
  const submitting = !!p.submitting;
  const blocked = !!p.blocked || p.canSubmit === false;
  const { disabled } = footerState({ missing: p.missing, reason: p.reason, blocked, submitting });

  const onOpenChange = (o: boolean) => {
    if (!o && submitting) return;
    p.onOpenChange(o);
  };
  // Radix content props that make Esc and outside clicks no-ops while saving.
  const contentGuards = {
    onEscapeKeyDown: (e: Event) => submitting && e.preventDefault(),
    onPointerDownOutside: (e: Event) => submitting && e.preventDefault(),
    onInteractOutside: (e: Event) => submitting && e.preventDefault(),
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Portalled content (Select options, popovers, nested dialogs) bubbles through React but is not in the body.
    if (e.defaultPrevented || !e.currentTarget.contains(e.target as Node)) return;
    const el = e.target as HTMLElement;
    const ok = shouldSubmitOnEnter(
      {
        key: e.key,
        shiftKey: e.shiftKey,
        isComposing: e.nativeEvent.isComposing,
        keyCode: e.keyCode,
        targetTag: el.tagName,
        targetRole: el.getAttribute("role"),
        targetExpanded: el.getAttribute("aria-expanded") === "true",
      },
      disabled,
    );
    if (!ok) return;
    e.preventDefault();
    void p.onSubmit();
  };

  const footer = (
    <FormFooter
      className="shrink-0"
      hintId={hintId}
      primary={{ label: p.submitLabel ?? t("save"), onClick: () => void p.onSubmit() }}
      missing={p.missing}
      reason={p.reason}
      blocked={blocked}
      submitting={submitting}
      submittingLabel={p.submittingLabel}
      onCancel={() => onOpenChange(false)}
      cancelLabel={p.cancelLabel}
      extra={p.extra}
    />
  );

  return { onOpenChange, contentGuards, onKeyDown, footer, submitting };
}
