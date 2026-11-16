"use client";

import { useTranslations } from "next-intl";

/** Red asterisk for a required field; screen readers hear "required" instead. */
export function RequiredMark() {
  const t = useTranslations("common.form");
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-destructive">
        *
      </span>
      <span className="sr-only">{t("required")}</span>
    </>
  );
}

/** "* Required fields" legend for forms with several required fields. */
export function RequiredLegend({ className }: { className?: string }) {
  const t = useTranslations("common.form");
  return (
    <span className={className ?? "text-xs text-muted-foreground"}>
      <span aria-hidden="true" className="text-destructive">
        *
      </span>{" "}
      {t("requiredLegend")}
    </span>
  );
}
