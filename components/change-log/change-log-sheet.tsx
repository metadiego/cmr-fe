"use client";

import { useTranslations } from "next-intl";

import type { ChangeLogFilter } from "@/lib/api/change-log";
import { ChangeLogList } from "@/components/change-log/change-log-list";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// «Historial de cambios» in a side panel: one session (from the row menu) or a patient's day.
export function ChangeLogSheet({
  open,
  onOpenChange,
  filter,
  title,
  subtitle,
  onUndone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filter: ChangeLogFilter;
  title?: string;
  subtitle?: string;
  onUndone?: () => void;
}) {
  const t = useTranslations("changeLog");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title ?? t("title")}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>
        <div className="px-4 pb-4">{open && <ChangeLogList filter={filter} onUndone={onUndone} />}</div>
      </SheetContent>
    </Sheet>
  );
}
