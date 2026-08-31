import * as React from "react";
import { cn } from "@/lib/utils";
import { Table, TableRow, TableCell } from "@/components/ui/table";

// Card-framed wrapper for a data table. Put <TableHeader>/<TableBody> inside.
function DataTable({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table"
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm shadow-[rgba(16,32,64,0.06)]",
        className,
      )}
      {...props}
    >
      <Table>{children}</Table>
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
