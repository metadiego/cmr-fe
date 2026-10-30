"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// Invoice editor grid, from lg up: items | summary | receipt preview — one card per column, all
// with the same chrome and all the SAME height (grid stretch). The row is as tall as
// the items or the summary card, whichever is taller; the receipt fills that and scrolls inside, so
// its long paper never sets the row height — which is also why the receipt column has a fixed width
// (72mm paper at 85% + padding ≈ 17rem; 100% from 2xl ≈ 20rem) instead of sizing to its content.
// The items column takes what is left (minmax(0,1fr)); the summary is a bit narrower until 2xl so
// the items keep room for the table and the add-line form. Below lg everything stacks, receipt last. Shared by the loaded page and its
// skeleton (invoice-detail-skeleton.tsx).
export const EDITOR_GRID =
  "grid gap-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_18rem_17rem] 2xl:grid-cols-[minmax(0,1fr)_20rem_20rem] 2xl:gap-5";

// For the page container (a flex column): from lg up the page is at least one screen tall, so the
// editor grid (lg:flex-1) grows into the space left under the header and the cards reach the bottom
// of the window instead of leaving it empty. 6.5rem = the app shell's 3.5rem top bar + its main's
// 1.5rem padding top and bottom (components/app-shell.tsx) — change both together.
export const INVOICE_PAGE_FILL = "lg:min-h-[calc(100svh-6.5rem)]";

/** A divided section inside a column card (summary: discount, VAT exemption, payments). */
export function CardSection({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("border-t px-(--card-spacing) pt-(--card-spacing)", className)} {...props} />;
}

/**
 * The receipt preview card, the editor grid's last cell: just the paper (`children`, or its skeleton)
 * on a muted panel — no header: it is obviously a preview, and printing lives in the page header.
 * Side by side (lg+) the paper area is taken out of the flow (absolute, scrolling) so the card only
 * stretches to the row's height instead of setting it; stacked, it flows normally. Below 2xl the
 * paper is drawn at 85% (CSS zoom) to keep the column narrow. The print: resets keep none of that
 * from clipping or scaling the in-page print (.recibo-print).
 */
export function ReceiptPreviewCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="gap-0 bg-muted/40 py-0 print:overflow-visible print:bg-transparent print:shadow-none print:ring-0">
      <CardContent className="px-0 lg:relative lg:min-h-80 lg:flex-1 print:static">
        <div className="overflow-y-auto px-(--card-spacing) py-4 lg:absolute lg:inset-0 print:static print:overflow-visible print:p-0">
          <div className="mx-auto w-fit shadow-md ring-1 ring-border [zoom:0.85] 2xl:[zoom:1] print:shadow-none print:ring-0 print:[zoom:1]">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
