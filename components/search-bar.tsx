"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Presentational search field styled after the shadcn docs nav: a soft filled
// input with a leading search icon and a ⌘K affordance. Wiring to a real search
// is future work — this is the visual surface only.
export function SearchBar({ className }: { className?: string }) {
  const t = useTranslations("nav");

  return (
    <div className={cn("relative hidden md:block", className)}>
      <HugeiconsIcon
        icon={Search01Icon}
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        placeholder={t("searchPlaceholder")}
        aria-label={t("search")}
        className="h-9 w-40 border-transparent bg-muted/60 pr-12 pl-9 hover:bg-muted focus-visible:bg-background lg:w-56 xl:w-72"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none sm:flex">
        ⌘K
      </kbd>
    </div>
  );
}
