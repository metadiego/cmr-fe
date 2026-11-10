"use client";

import { useTranslations } from "next-intl";

import { sheetDown, type SheetCheck } from "@/lib/agenda/sheet";

// The call-center sheet did not answer (data.sheet.ok === false): the hours shown may be stale. A warning,
// never a block (BE #521, docs/specs/reservar-en-la-hoja-handoff.md). Nothing when reservation is off.
export function SheetNotice({ sheet, className }: { sheet: SheetCheck; className?: string }) {
  const t = useTranslations("sheet");
  if (!sheetDown(sheet)) return null;
  return (
    <p role="status" className={"rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground " + (className ?? "")}>
      {t("down")}
    </p>
  );
}
