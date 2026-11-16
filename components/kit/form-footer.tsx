"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { footerState } from "@/lib/forms/missing";
import { MissingHint } from "./missing-hint";

export type FooterAction = {
  label: string;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  /** When any action sets `busy`, only those show the submitting label. */
  busy?: boolean;
};

/** Hint above the buttons; primaries are disabled by `missing`/`blocked`/`submitting`. */
export function FormFooter({
  primary,
  missing,
  reason,
  blocked,
  submitting,
  submittingLabel,
  onCancel,
  cancelLabel,
  extra,
  hintId,
  className,
}: {
  primary: FooterAction | FooterAction[];
  missing?: readonly string[];
  reason?: string | null;
  blocked?: boolean;
  submitting?: boolean;
  submittingLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  extra?: ReactNode;
  /** Set when the caller needs to know the hint id; generated otherwise. */
  hintId?: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const generated = useId();
  const id = hintId ?? `${generated}-hint`;
  const { disabled, hint } = footerState({
    missing,
    reason,
    blocked,
    submitting,
  });
  const actions = Array.isArray(primary) ? primary : [primary];
  const anyBusy = actions.some((a) => a.busy);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="sm:text-right">
        <MissingHint id={id} missing={missing} reason={reason} blocked={blocked} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {extra}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {cancelLabel ?? t("cancel")}
          </Button>
        )}
        {actions.map((a) => (
          <Button
            key={a.label}
            type="button"
            variant={a.variant}
            onClick={a.onClick}
            disabled={disabled}
            aria-describedby={hint ? id : undefined}
          >
            {submitting && (anyBusy ? a.busy : true) ? (submittingLabel ?? t("saving")) : a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
