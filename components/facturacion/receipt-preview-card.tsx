"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Invoice editor grid, from lg up: items | summary — one card per column, both the SAME height (grid
// stretch). The items column takes what is left (minmax(0,1fr)); the summary is a bit narrower until 2xl
// so the items keep room for the table and the add-line form. The receipt preview no longer takes a
// column: it opens on demand in a side drawer (receipt-preview-sheet.tsx). Below lg everything stacks.
// Shared by the loaded page and its skeleton (invoice-detail-skeleton.tsx).
export const EDITOR_GRID =
  "grid gap-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-5";

// For the page container (a flex column): from lg up the page is at least one screen tall, so the
// editor grid (lg:flex-1) grows into the space left under the header and the cards reach the bottom
// of the window instead of leaving it empty. 6.5rem = the app shell's 3.5rem top bar + its main's
// 1.5rem padding top and bottom (components/app-shell.tsx) — change both together.
export const INVOICE_PAGE_FILL = "lg:min-h-[calc(100svh-6.5rem)]";

/** A divided section inside a column card (summary: discount, VAT exemption, payments). */
export function CardSection({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("border-t px-(--card-spacing) pt-(--card-spacing)", className)} {...props} />;
}
