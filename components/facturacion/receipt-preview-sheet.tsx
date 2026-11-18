"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Invoice01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * The live receipt preview, hidden by default: a header button opens it in a side drawer, so the
 * invoice editor keeps the full width for the lines. `children` is the paper (ReciboTermico).
 * Printing does not depend on it: it goes through ReceiptPrintDialog.
 */
export function ReceiptPreviewSheet({ children }: { children: React.ReactNode }) {
  const t = useTranslations("receipt");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="no-print" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={Invoice01Icon} className="size-4" />
        {t("preview")}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="no-print w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("previewTitle")}</SheetTitle>
            <SheetDescription>{t("previewDescription")}</SheetDescription>
          </SheetHeader>
          <div className="bg-muted/40 px-4 pb-6">
            <div className="mx-auto w-fit shadow-md ring-1 ring-border">{children}</div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
