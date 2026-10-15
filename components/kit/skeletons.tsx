"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

// Loading placeholders that copy the loaded layout (docs/specs/2026-10-10-skeletons-de-carga.md):
// the real frame — titles, tabs, toolbars, table headers — renders immediately and these fill ONLY
// the data-dependent regions, in the same container and at the same size as what replaces them.

/** Wraps a loading region: `aria-busy` plus a screen-reader "Loading…"; the bars inside are decorative. */
export function LoadingRegion({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const t = useTranslations("common");
  return (
    <div aria-busy="true" className={className} {...props}>
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

/** What a column holds, so its bar reads like the loaded cell. */
export type CellShape =
  | "text" // a word or two
  | "long" // a name / description
  | "short" // a number, code, time
  | "avatar" // avatar circle + name
  | "badge" // a status chip
  | "button" // an action button
  | "icon" // an icon-only action button
  | "control" // an inline select / input
  | "dot"; // colour dot + label

// Varying widths row to row keeps the block from reading as a solid grid.
const WIDTHS: Record<"text" | "long" | "short", string[]> = {
  text: ["w-20", "w-24", "w-16", "w-28"],
  long: ["w-36", "w-44", "w-32", "w-40"],
  short: ["w-10", "w-12", "w-8", "w-14"],
};

export function CellSkeleton({ shape, row = 0 }: { shape: CellShape; row?: number }) {
  switch (shape) {
    case "avatar":
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className={cn("h-4", WIDTHS.long[row % 4])} />
        </div>
      );
    case "badge":
      return <Skeleton className="h-5 w-20 rounded-full" />;
    case "button":
      return <Skeleton className="ml-auto h-8 w-20" />;
    case "icon":
      return <Skeleton className="ml-auto size-8" />;
    case "control":
      return <Skeleton className="h-8 w-36" />;
    case "dot":
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <Skeleton className={cn("h-4", WIDTHS.text[row % 4])} />
        </div>
      );
    default:
      return <Skeleton className={cn("h-4", WIDTHS[shape][row % 4])} />;
  }
}

/**
 * Body rows for a table whose real <TableHeader> is already rendered: drop it inside <TableBody> in
 * place of the "Loading…" row. One shape per column, in column order.
 */
export function TableRowsSkeleton({
  columns,
  rows = 8,
  rowClassName,
}: {
  columns: CellShape[];
  rows?: number;
  rowClassName?: string;
}) {
  const t = useTranslations("common");
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} aria-busy={r === 0 ? true : undefined} className={cn("hover:bg-transparent", rowClassName)}>
          {columns.map((shape, c) => (
            <TableCell key={c}>
              {r === 0 && c === 0 && <span className="sr-only">{t("loading")}</span>}
              <div aria-hidden>
                <CellSkeleton shape={shape} row={r + c} />
              </div>
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Same as TableRowsSkeleton for screens that use a raw <table> (plain <tr>/<td>, caller's cell padding). */
export function RawRowsSkeleton({
  columns,
  rows = 8,
  cellClassName = "px-3 py-2.5",
  rowClassName = "border-b last:border-0",
}: {
  columns: CellShape[];
  rows?: number;
  cellClassName?: string;
  rowClassName?: string;
}) {
  const t = useTranslations("common");
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-busy={r === 0 ? true : undefined} className={rowClassName}>
          {columns.map((shape, c) => (
            <td key={c} className={cellClassName}>
              {r === 0 && c === 0 && <span className="sr-only">{t("loading")}</span>}
              <div aria-hidden>
                <CellSkeleton shape={shape} row={r + c} />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Placeholder for a control waiting for its options (e.g. a Select fed by a catalog). */
export function ControlSkeleton({ className }: { className?: string }) {
  return <Skeleton aria-hidden className={cn("h-9 w-40 rounded-md", className)} />;
}

/** Event pills inside a calendar day cell; a stable pseudo-random 0–2 per cell so the month looks real. */
export function PillsSkeleton({ seed, max = 2, className }: { seed: number; max?: number; className?: string }) {
  const n = (seed * 7 + 3) % (max + 2) === 0 ? 0 : ((seed * 5) % max) + 1;
  return (
    <div aria-hidden className={cn("flex flex-col gap-1", className)}>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className={cn("h-4 rounded-sm", i % 2 ? "w-3/4" : "w-full")} />
      ))}
    </div>
  );
}
