"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Table, TableRow, TableCell } from "@/components/ui/table";
import { useFillViewportHeight } from "@/hooks/use-fill-viewport-height";

// Card-framed wrapper for a data table. Put <TableHeader>/<TableBody> inside.
// `fill`: on desktop the card never runs past the bottom of the window (leaving room for whatever
// the page renders below it, e.g. pagination). Rows scroll inside the card and the header row
// stays pinned, instead of the whole page scrolling. A short table keeps its natural height.
// `footer`: rendered inside the card below the rows (pagination, totals); it never scrolls away.
function DataTable({
  className,
  children,
  fill = false,
  footer,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "footer"> & { fill?: boolean; footer?: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const maxHeight = useFillViewportHeight(ref, { enabled: fill, minHeight: 320 });
  return (
    <div
      ref={ref}
      data-slot="data-table"
      style={maxHeight ? { ...style, maxHeight } : style}
      className={cn(
        "overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]",
        fill &&
          "flex flex-col [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1 [&>[data-slot=table-container]]:overflow-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-card [&_thead_th]:shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
      {...props}
    >
      <Table>{children}</Table>
      {footer != null && footer !== false && (
        <div data-slot="data-table-footer" className="shrink-0 border-t px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  );
}

// Standard full-width states. `colSpan` must match the table's column count.
function TableState({ colSpan, children, tone }: { colSpan: number; children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={cn("h-24 whitespace-normal p-6 text-center text-sm", tone === "error" ? "text-destructive" : "text-muted-foreground")}>
        {children}
      </TableCell>
    </TableRow>
  );
}
const TableEmpty = ({ colSpan, children }: { colSpan: number; children: React.ReactNode }) => <TableState colSpan={colSpan} tone="muted">{children}</TableState>;
const TableLoading = ({ colSpan, children }: { colSpan: number; children: React.ReactNode }) => <TableState colSpan={colSpan} tone="muted">{children}</TableState>;
const TableError = ({ colSpan, children }: { colSpan: number; children: React.ReactNode }) => <TableState colSpan={colSpan} tone="error">{children}</TableState>;

export { DataTable, TableEmpty, TableLoading, TableError };
