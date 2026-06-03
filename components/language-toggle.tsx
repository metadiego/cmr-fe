// components/language-toggle.tsx
"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { setLocale } from "@/i18n/locale-actions";
import { locales, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";

// Cycles through the supported locales, persists the choice via the setLocale
// Server Action, then refreshes so Server Components re-render translated.
export function LanguageToggle() {
  const current = useLocale() as Locale;
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchLocale() {
    const next = locales[(locales.indexOf(current) + 1) % locales.length];
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("label")}
      onClick={switchLocale}
      disabled={pending}
    >
      <span className="text-xs font-semibold uppercase">{current}</span>
    </Button>
  );
}
