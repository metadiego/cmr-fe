// components/mode-toggle.tsx
"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("common");

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Sun shows in dark mode (click → go light); Moon shows in light mode. */}
      <HugeiconsIcon icon={Sun03Icon} className="hidden dark:block" />
      <HugeiconsIcon icon={Moon02Icon} className="block dark:hidden" />
      <span className="sr-only">{t("toggleTheme")}</span>
    </Button>
  );
}
