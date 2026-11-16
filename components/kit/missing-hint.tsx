"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";

import { footerState } from "@/lib/forms/missing";

/** What is missing (or why submit is blocked), shown above the footer buttons. */
export function MissingHint({
  id,
  missing,
  reason,
  blocked,
}: {
  id: string;
  missing?: readonly string[];
  reason?: string | null;
  blocked?: boolean;
}) {
  const t = useTranslations("common.form");
  const { hint } = footerState({ missing, reason, blocked });
  if (!hint) return null;
  return (
    <p id={id} className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
      <HugeiconsIcon icon={InformationCircleIcon} className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        {hint.kind === "missing" ? `${t("missingPrefix")} ${hint.items.join(" · ")}` : hint.text}
      </span>
    </p>
  );
}
