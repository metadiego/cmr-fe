"use client";

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
    <p id={id} className="text-xs text-muted-foreground">
      {hint.kind === "missing"
        ? `${t("missingPrefix")} ${hint.items.join(", ")}`
        : hint.text}
    </p>
  );
}
